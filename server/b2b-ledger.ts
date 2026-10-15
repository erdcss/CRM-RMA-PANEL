import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "./db";

/**
 * B2B customers' private, manually maintained commercial notebooks.
 * These are informational records, NOT statutory e-Defter entries.
 * All queries are scoped by the verified B2B session, never by client-supplied user IDs.
 */
const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS b2b_ledger_contacts (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(140) NOT NULL,
  kind VARCHAR(16) NOT NULL DEFAULT 'supplier' CHECK (kind IN ('supplier','customer','other')),
  phone VARCHAR(45),
  address TEXT,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS b2b_ledger_contacts_owner_idx ON b2b_ledger_contacts(user_id, is_archived, id DESC);

CREATE TABLE IF NOT EXISTS b2b_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES b2b_ledger_contacts(id) ON DELETE RESTRICT,
  type VARCHAR(16) NOT NULL CHECK (type IN ('debt','payment','receivable','collection')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
  description VARCHAR(500) NOT NULL DEFAULT '',
  effective_on DATE NOT NULL DEFAULT CURRENT_DATE,
  request_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ,
  void_reason VARCHAR(300),
  UNIQUE(user_id, request_key)
);
CREATE INDEX IF NOT EXISTS b2b_ledger_entries_contact_idx
  ON b2b_ledger_entries(user_id, contact_id, effective_on DESC, id DESC);

CREATE TABLE IF NOT EXISTS b2b_ledger_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES b2b_ledger_contacts(id) ON DELETE CASCADE,
  content VARCHAR(4000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS b2b_ledger_notes_contact_idx ON b2b_ledger_notes(user_id, contact_id, id DESC);
`;
let init: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!pool) return Promise.reject(new Error("Veritabanı bulunamadı"));
  if (!init) init = pool.query(TABLES_SQL).then(() => {}).catch(error => { init = null; throw error; });
  return init;
}
function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : "";
}
function contactId(value: unknown) {
  const raw = String(value || "");
  return /^[1-9]\d{0,17}$/.test(raw) ? raw : null;
}
function moneyCents(value: unknown): string | null {
  // String decimal input (Turkish comma permitted); never use float arithmetic.
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(raw)) return null;
  const [units, decimals = ""] = raw.split(".");
  const cents = BigInt(units) * 100n + BigInt(decimals.padEnd(2, "0") || "0");
  return cents > 0n && cents <= 999999999n ? cents.toString() : null;
}
function issue(res: any, err: unknown) {
  console.error("[b2b-ledger]", err);
  return res.status(500).json({ error: "Defter işlemi tamamlanamadı. Tekrar deneyin." });
}
function owner(res: any): number { return Number(res.locals.b2bUser.id); }
function summaryQuery() {
  return `SELECT
    c.id::text, c.name, c.kind, c.phone, c.address, c.description,
    c.is_archived, c.created_at, c.updated_at,
    COALESCE(SUM(CASE
      WHEN e.voided_at IS NULL AND e.type = 'debt' THEN e.amount_cents
      WHEN e.voided_at IS NULL AND e.type = 'payment' THEN -e.amount_cents
      ELSE 0 END),0)::text AS debt_balance_cents,
    COALESCE(SUM(CASE
      WHEN e.voided_at IS NULL AND e.type = 'receivable' THEN e.amount_cents
      WHEN e.voided_at IS NULL AND e.type = 'collection' THEN -e.amount_cents
      ELSE 0 END),0)::text AS receivable_balance_cents,
    COUNT(e.id) FILTER (WHERE e.voided_at IS NULL)::int AS movement_count
    FROM b2b_ledger_contacts c
    LEFT JOIN b2b_ledger_entries e ON e.contact_id = c.id AND e.user_id = c.user_id`;
}
const FORM_TYPES = new Set(["debt","payment","receivable","collection"]);
const CONTACT_TYPES = new Set(["supplier","customer","other"]);

export function registerB2BLedgerRoutes(app: Express, requireB2B: RequestHandler) {
  app.get("/api/b2b/ledger/contacts", requireB2B, async (_req, res) => {
    try {
      await ready();
      const result = await pool!.query(
        summaryQuery() + " WHERE c.user_id=$1 AND c.is_archived=FALSE GROUP BY c.id ORDER BY c.updated_at DESC, c.id DESC LIMIT 250",
        [owner(res)],
      );
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(result.rows);
    } catch (err) { return issue(res, err); }
  });

  app.get("/api/b2b/ledger/overview", requireB2B, async (_req, res) => {
    try {
      await ready();
      const result = await pool!.query(
        `SELECT COUNT(DISTINCT c.id)::int AS contact_count,
          COALESCE(SUM(CASE WHEN e.voided_at IS NULL AND e.type='debt' THEN e.amount_cents WHEN e.voided_at IS NULL AND e.type='payment' THEN -e.amount_cents ELSE 0 END),0)::text AS debt_balance_cents,
          COALESCE(SUM(CASE WHEN e.voided_at IS NULL AND e.type='receivable' THEN e.amount_cents WHEN e.voided_at IS NULL AND e.type='collection' THEN -e.amount_cents ELSE 0 END),0)::text AS receivable_balance_cents
         FROM b2b_ledger_contacts c LEFT JOIN b2b_ledger_entries e
         ON e.contact_id=c.id AND e.user_id=c.user_id
         WHERE c.user_id=$1 AND c.is_archived=FALSE`, [owner(res)],
      );
      return res.json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.post("/api/b2b/ledger/contacts", requireB2B, async (req, res) => {
    const name = text(req.body?.name, 140);
    const kind = String(req.body?.kind || "supplier");
    if (!name || !CONTACT_TYPES.has(kind)) return res.status(400).json({ error: "Firma adı ve türünü kontrol edin." });
    try {
      await ready();
      const count = await pool!.query("SELECT COUNT(*)::int AS count FROM b2b_ledger_contacts WHERE user_id=$1 AND is_archived=FALSE", [owner(res)]);
      if (count.rows[0].count >= 250) return res.status(409).json({ error: "En fazla 250 aktif defter oluşturulabilir." });
      const result = await pool!.query(
        `INSERT INTO b2b_ledger_contacts(user_id,name,kind,phone,address,description)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text,name,kind,phone,address,description,is_archived,created_at,updated_at`,
        [owner(res),name,kind,text(req.body?.phone,45),text(req.body?.address,1000),text(req.body?.description,1000)],
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.get("/api/b2b/ledger/contacts/:id", requireB2B, async (req, res) => {
    const id = contactId(req.params.id);
    if (!id) return res.status(400).json({ error: "Defter kimliği geçersiz." });
    try {
      await ready();
      const [contact, entries, notes] = await Promise.all([
        pool!.query(summaryQuery() + " WHERE c.user_id=$1 AND c.id=$2 GROUP BY c.id", [owner(res),id]),
        pool!.query(`SELECT id::text, type, amount_cents::text, description, effective_on, created_at, voided_at, void_reason
          FROM b2b_ledger_entries WHERE user_id=$1 AND contact_id=$2 ORDER BY effective_on DESC, id DESC LIMIT 500`,[owner(res),id]),
        pool!.query(`SELECT id::text, content, created_at, updated_at
          FROM b2b_ledger_notes WHERE user_id=$1 AND contact_id=$2 ORDER BY id DESC LIMIT 150`, [owner(res),id]),
      ]);
      if (!contact.rows.length) return res.status(404).json({ error: "Defter bulunamadı." });
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ ...contact.rows[0], entries: entries.rows, notes: notes.rows });
    } catch (err) { return issue(res, err); }
  });

  app.patch("/api/b2b/ledger/contacts/:id", requireB2B, async (req, res) => {
    const id = contactId(req.params.id);
    const name = text(req.body?.name,140), kind = String(req.body?.kind || "");
    if (!id || !name || !CONTACT_TYPES.has(kind)) return res.status(400).json({ error: "Firma bilgileri geçersiz." });
    try {
      await ready();
      const result = await pool!.query(
        `UPDATE b2b_ledger_contacts
         SET name=$3,kind=$4,phone=$5,address=$6,description=$7,updated_at=NOW()
         WHERE id=$1 AND user_id=$2 AND is_archived=FALSE RETURNING id::text,name,kind,phone,address,description`,
        [id,owner(res),name,kind,text(req.body?.phone,45),text(req.body?.address,1000),text(req.body?.description,1000)],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Defter bulunamadı." });
      return res.json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.post("/api/b2b/ledger/contacts/:id/archive", requireB2B, async (req, res) => {
    const id = contactId(req.params.id);
    if (!id) return res.status(400).json({ error: "Defter kimliği geçersiz." });
    try {
      await ready();
      const result = await pool!.query(
        `UPDATE b2b_ledger_contacts SET is_archived=TRUE, updated_at=NOW()
         WHERE id=$1 AND user_id=$2 AND is_archived=FALSE RETURNING id::text`, [id,owner(res)],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Defter bulunamadı." });
      return res.json({ archived:true });
    } catch (err) { return issue(res, err); }
  });

  app.post("/api/b2b/ledger/contacts/:id/entries", requireB2B, async (req, res) => {
    const id = contactId(req.params.id);
    const type = String(req.body?.type || "");
    const cents = moneyCents(req.body?.amount);
    const description = text(req.body?.description,500);
    const date = String(req.body?.effectiveOn || "").trim();
    const requestKey = String(req.body?.requestKey || "").trim();
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date;
    if (!id || !FORM_TYPES.has(type) || !cents || !dateValid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
      return res.status(400).json({ error: "Hareket türünü, tutarı ve tarihi kontrol edin." });
    }
    try {
      await ready();
      const result = await pool!.query(
        `INSERT INTO b2b_ledger_entries(user_id,contact_id,type,amount_cents,description,effective_on,request_key)
         SELECT $1,c.id,$3,$4,$5,$6::date,$7::uuid FROM b2b_ledger_contacts c
         WHERE c.user_id=$1 AND c.id=$2 AND c.is_archived=FALSE
         ON CONFLICT(user_id,request_key) DO NOTHING
         RETURNING id::text,type,amount_cents::text,description,effective_on,created_at,voided_at`,
        [owner(res),id,type,cents,description,date,requestKey],
      );
      if (!result.rowCount) {
        const existing = await pool!.query(
          `SELECT id::text,type,amount_cents::text,description,effective_on,created_at,voided_at, contact_id::text
           FROM b2b_ledger_entries WHERE user_id=$1 AND request_key=$2::uuid LIMIT 1`, [owner(res),requestKey],
        );
        const previous = existing.rows[0];
        if (previous && previous.contact_id === id && previous.type === type &&
            previous.amount_cents === cents && previous.description === description &&
            new Date(previous.effective_on).toISOString().slice(0, 10) === date) {
          return res.json(previous);
        }
        return res.status(409).json({ error: "Bu işlem anahtarı daha önce başka bir hareket için kullanılmış." });
      }
      return res.status(201).json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.post("/api/b2b/ledger/entries/:id/void", requireB2B, async (req, res) => {
    const id = contactId(req.params.id), reason = text(req.body?.reason,300);
    if (!id || reason.length < 3) return res.status(400).json({ error: "İptal açıklaması en az 3 karakter olmalı." });
    try {
      await ready();
      const result = await pool!.query(
        `UPDATE b2b_ledger_entries SET voided_at=NOW(),void_reason=$3
         WHERE id=$1 AND user_id=$2 AND voided_at IS NULL RETURNING id::text,voided_at,void_reason`,
        [id,owner(res),reason],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Aktif işlem bulunamadı." });
      return res.json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.post("/api/b2b/ledger/notes", requireB2B, async (req, res) => {
    const content = text(req.body?.content,4000);
    const id = req.body?.contactId == null ? null : contactId(req.body.contactId);
    if (!content || (req.body?.contactId != null && !id)) return res.status(400).json({ error: "Not veya firma kimliği geçersiz." });
    try {
      await ready();
      // Contact-scoped notes are inserted only if the same user owns the contact.
      const result = await pool!.query(
        `INSERT INTO b2b_ledger_notes(user_id,contact_id,content)
         SELECT $1,c.id,$3 FROM b2b_ledger_contacts c WHERE c.id=$2 AND c.user_id=$1 AND c.is_archived=FALSE
         RETURNING id::text,contact_id::text,content,created_at,updated_at`,
        [owner(res),id,content],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Firma bulunamadı." });
      return res.status(201).json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.patch("/api/b2b/ledger/notes/:id", requireB2B, async (req, res) => {
    const id = contactId(req.params.id), content = text(req.body?.content,4000);
    if (!id || !content) return res.status(400).json({ error: "Not içeriğini kontrol edin." });
    try {
      await ready();
      const result = await pool!.query(
        "UPDATE b2b_ledger_notes SET content=$3,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id::text,content,updated_at",
        [id,owner(res),content],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Not bulunamadı." });
      return res.json(result.rows[0]);
    } catch (err) { return issue(res, err); }
  });

  app.delete("/api/b2b/ledger/notes/:id", requireB2B, async (req, res) => {
    const id = contactId(req.params.id);
    if (!id) return res.status(400).json({ error: "Not kimliği geçersiz." });
    try {
      await ready();
      const result = await pool!.query(
        "DELETE FROM b2b_ledger_notes WHERE id=$1 AND user_id=$2 RETURNING id::text", [id,owner(res)],
      );
      if (!result.rowCount) return res.status(404).json({ error: "Not bulunamadı." });
      return res.json({ deleted:true });
    } catch (err) { return issue(res, err); }
  });
}
