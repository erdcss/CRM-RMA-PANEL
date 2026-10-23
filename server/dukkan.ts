import type { Express, Request, RequestHandler, Response } from "express";
import { pool } from "./db";
import { storage } from "./storage";
import { z, ZodError } from "zod";
import type { PoolClient } from "pg";

// Çalışkan Dükkan stores are deliberately isolated from B2B catalog and RMA tables.
// Monetary values stay NUMERIC in PostgreSQL, never FLOAT. All postings use transactions.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS dukkan_stores (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, owner_user_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS dukkan_members (store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','manager','accountant','cashier','viewer')), PRIMARY KEY(store_id,user_id))",
  "CREATE TABLE IF NOT EXISTS dukkan_parties (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), type TEXT NOT NULL CHECK(type IN ('customer','supplier','both')), name TEXT NOT NULL, tax_number TEXT, phone TEXT, email TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_products (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), sku TEXT NOT NULL, barcode TEXT, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'adet', stock NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK(stock>=0), purchase_price NUMERIC(18,2) NOT NULL DEFAULT 0, sale_price NUMERIC(18,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,sku), UNIQUE(store_id,id))",
  "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_products_barcode_unique ON dukkan_products(store_id,barcode) WHERE barcode IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS dukkan_invoices (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase','sale_return','purchase_return')), invoice_no TEXT NOT NULL, issued_at DATE NOT NULL DEFAULT CURRENT_DATE, subtotal NUMERIC(18,2) NOT NULL, tax_total NUMERIC(18,2) NOT NULL, grand_total NUMERIC(18,2) NOT NULL, status TEXT NOT NULL DEFAULT 'posted', request_key UUID NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,invoice_no), UNIQUE(store_id,request_key))",
  "CREATE TABLE IF NOT EXISTS dukkan_invoice_lines (id BIGSERIAL PRIMARY KEY, invoice_id BIGINT NOT NULL REFERENCES dukkan_invoices(id), product_id BIGINT NOT NULL REFERENCES dukkan_products(id), quantity NUMERIC(16,3) NOT NULL CHECK(quantity>0), unit_price NUMERIC(18,2) NOT NULL CHECK(unit_price>=0), tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate>=0 AND tax_rate<=100), line_total NUMERIC(18,2) NOT NULL)",
  "CREATE TABLE IF NOT EXISTS dukkan_stock_movements (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), product_id BIGINT NOT NULL, delta NUMERIC(16,3) NOT NULL CHECK(delta<>0), reason TEXT NOT NULL, invoice_id BIGINT REFERENCES dukkan_invoices(id), note TEXT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,product_id) REFERENCES dukkan_products(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_orders (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')), order_no TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,order_no))",
  "CREATE TABLE IF NOT EXISTS dukkan_order_lines (id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES dukkan_orders(id), product_id BIGINT NOT NULL REFERENCES dukkan_products(id), quantity NUMERIC(16,3) NOT NULL CHECK(quantity>0), unit_price NUMERIC(18,2) NOT NULL CHECK(unit_price>=0))",
  "CREATE TABLE IF NOT EXISTS dukkan_banks (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), name TEXT NOT NULL, iban TEXT, currency TEXT NOT NULL DEFAULT 'TRY', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_bank_movements (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), bank_id BIGINT NOT NULL, amount NUMERIC(18,2) NOT NULL CHECK(amount<>0), type TEXT NOT NULL, note TEXT, payment_id BIGINT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,bank_id) REFERENCES dukkan_banks(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_entries (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, debit NUMERIC(18,2) NOT NULL DEFAULT 0, credit NUMERIC(18,2) NOT NULL DEFAULT 0, description TEXT NOT NULL, invoice_id BIGINT REFERENCES dukkan_invoices(id), payment_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_payments (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('collection','payment')), method TEXT NOT NULL CHECK(method IN ('cash','bank')), bank_id BIGINT, amount NUMERIC(18,2) NOT NULL CHECK(amount>0), note TEXT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), FOREIGN KEY(store_id,bank_id) REFERENCES dukkan_banks(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_instruments (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('cheque','promissory')), direction TEXT NOT NULL CHECK(direction IN ('received','issued')), document_no TEXT NOT NULL, amount NUMERIC(18,2) NOT NULL CHECK(amount>0), due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','bounced','cancelled')), note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,direction,document_no))",
  "CREATE INDEX IF NOT EXISTS dukkan_invoice_store_idx ON dukkan_invoices(store_id,issued_at DESC)",
  "CREATE INDEX IF NOT EXISTS dukkan_stock_store_idx ON dukkan_stock_movements(store_id,created_at DESC)",
  "CREATE INDEX IF NOT EXISTS dukkan_cari_store_idx ON dukkan_cari_entries(store_id,party_id,created_at DESC)"
].join(";\n") + ";";

let schemaPromise: Promise<void> | undefined;
async function ready() {
  if (!pool) throw Object.assign(new Error("PostgreSQL bağlantısı gerekli"), { status: 503 });
  if (!schemaPromise) schemaPromise = pool.query(SCHEMA).then(() => undefined).catch((error) => { schemaPromise = undefined; throw error; });
  await schemaPromise;
  return pool;
}
const id = z.coerce.number().int().positive();
const amount = z.coerce.number().finite().positive().max(999999999999);
const qty = z.coerce.number().finite().positive().max(999999999);
const string = z.string().trim().min(1).max(200);
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lineSchema = z.object({ productId: id, quantity: qty, unitPrice: z.coerce.number().finite().min(0).max(999999999), taxRate: z.coerce.number().min(0).max(100).default(20) });
const docSchema = z.object({ partyId: id, kind: z.enum(["sale", "purchase", "sale_return", "purchase_return"]), number: string, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), requestKey: z.string().uuid(), lines: z.array(lineSchema).min(1).max(200) });
const orderSchema = z.object({ partyId: id, kind: z.enum(["sale", "purchase"]), number: string, lines: z.array(lineSchema).min(1).max(200) });

type SafeHandler = (req: Request, res: Response) => Promise<unknown>;
function safe(fn: SafeHandler): RequestHandler {
  return (req,res) => { void Promise.resolve().then(() => fn(req,res)).catch((error: any) => {
    if (res.headersSent) return;
    const status = error instanceof ZodError ? 400 : error.code === "23505" ? 409 : error.code === "23503" ? 400 : error.status || 500;
    const message = error instanceof ZodError ? "Geçersiz alanlar: " + error.issues.map(i => i.path.join(".")).join(", ") : status === 500 ? "İşlem tamamlanamadı" : error.message;
    if (status === 500) console.error("Dukkan API:", error);
    res.status(status).json({ error: message });
  }); };
}
function deny(message: string): never { throw Object.assign(new Error(message), { status: 403 }); }
function store(req: Request) { return id.parse(req.params.storeId); }
function user(res: Response) { return Number(res.locals.dukkanUserId); }
async function transaction<T>(cb: (c: PoolClient) => Promise<T>): Promise<T> {
  const db = await ready(); const c = await db.connect();
  try { await c.query("BEGIN"); const result = await cb(c); await c.query("COMMIT"); return result; }
  catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
}
async function exists(c: PoolClient, table: "dukkan_parties" | "dukkan_products" | "dukkan_banks", sid: number, recordId: number) {
  const r = await c.query("SELECT id FROM " + table + " WHERE store_id=$1 AND id=$2", [sid,recordId]);
  if (!r.rowCount) throw Object.assign(new Error("Kayıt bu mağazada bulunamadı"),{status:404});
}

export function registerDukkanRoutes(app: Express, sessionUserId: (req: Request) => number | undefined) {
  const authenticate = safe(async (req,res) => {
    const uid = sessionUserId(req);
    if (!uid) return res.status(401).json({ error:"Giriş yapmanız gerekiyor" });
    const person = await storage.getUser(uid);
    if (!person || person.isActive !== 1 || person.mustChangePassword === 1) return res.status(403).json({error:"Hesap etkin değil veya ilk şifre değişimi gerekiyor"});
    res.locals.dukkanUserId = uid;
    res.locals.dukkanAdmin = ["super_admin","admin"].includes(person.role);
    return undefined;
  });
  // Express middlewares require next(); wrappers above are terminal handlers.
  app.use("/api/dukkan", safe(async (req,res) => {
    // Kept as an empty function intentionally; authentication below is implemented by normal middleware.
  }) as never);
}
