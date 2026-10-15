import type { Express, Request, RequestHandler } from "express";
import { pool } from "./db";

type Owner = (req: Request) => number | undefined;
type Item = { id: string; name: string; completed: boolean };
type Supplier = { id: string; name: string; items: Item[] };
let schema: Promise<void> | undefined;
async function ready() {
  if (!pool) throw new Error("Veritabanı bağlantısı yok");
  if (!schema) {
    schema = pool.query(
      "CREATE TABLE IF NOT EXISTS b2b_shortage_lists (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL DEFAULT '[]'::jsonb, revision INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    ).then(() => {}).catch(error => { schema = undefined; throw error; });
  }
  await schema;
}
function normalized(rows: unknown): Supplier[] {
  if (!Array.isArray(rows)) throw new Error("Geçersiz firma listesi");
  if (rows.length > 100) throw new Error("Firma sınırı aşıldı");
  const ids = new Set<string>();
  return rows.map((raw: any) => {
    const id = String(raw?.id || "").slice(0, 80);
    const name = String(raw?.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (!id || !name || ids.has(id)) throw new Error("Firma adı veya kimliği geçersiz");
    ids.add(id);
    if (!Array.isArray(raw.items) || raw.items.length > 500) throw new Error("Ürün sınırı aşıldı");
    const itemIds = new Set<string>();
    const items = raw.items.map((entry: any): Item => {
      const itemId = String(entry?.id || "").slice(0, 80);
      const itemName = String(entry?.name || "").trim().replace(/\s+/g, " ").slice(0, 240);
      if (!itemId || !itemName || itemIds.has(itemId)) throw new Error("Ürün adı veya kimliği geçersiz");
      itemIds.add(itemId);
      return { id: itemId, name: itemName, completed: entry.completed === true };
    });
    return { id, name, items };
  });
}

export function registerB2BShortageRoutes(app: Express, requireB2B: RequestHandler, getOwner: Owner) {
  app.get("/api/b2b/shortages", requireB2B, async (req, res) => {
    try {
      await ready();
      const result = await pool!.query(
        "SELECT data, revision FROM b2b_shortage_lists WHERE user_id=$1",
        [getOwner(req)]
      );
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ suppliers: result.rows[0]?.data || [], revision: result.rows[0]?.revision || 0 });
    } catch (error) {
      console.error("Shortage list fetch failed:", error);
      return res.status(500).json({ error: "Eksik listesi yüklenemedi" });
    }
  });
  app.put("/api/b2b/shortages", requireB2B, async (req, res) => {
    let suppliers: Supplier[];
    try { suppliers = normalized(req.body?.suppliers); }
    catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Liste hatalı" });
    }
    const revision = Number(req.body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({ error: "Liste sürümü geçersiz" });
    }
    try {
      await ready();
      const result = await pool!.query(
        "INSERT INTO b2b_shortage_lists(user_id,data,revision,updated_at) " +
        "VALUES($1,$2::jsonb,1,NOW()) " +
        "ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data, " +
        "revision=b2b_shortage_lists.revision+1, updated_at=NOW() " +
        "WHERE b2b_shortage_lists.revision=$3 RETURNING revision",
        [getOwner(req), JSON.stringify(suppliers), revision]
      );
      if (!result.rowCount) {
        return res.status(409).json({ error: "Liste başka cihazda güncellendi. Yeniden yükleyin." });
      }
      return res.json({ suppliers, revision: result.rows[0].revision });
    } catch (error) {
      console.error("Shortage list save failed:", error);
      return res.status(500).json({ error: "Eksik listesi kaydedilemedi" });
    }
  });
}
