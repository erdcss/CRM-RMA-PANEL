import type { Express, Request, RequestHandler, Response, NextFunction } from "express";
import { pool } from "./db";
import { storage } from "./storage";
import { z, ZodError } from "zod";
import type { PoolClient } from "pg";
import { backfillExistingDukkanProducts, ensureDukkanB2BBridge, importAllB2BToDukkan, syncDukkanToB2B, validateDukkanImages } from "./dukkan-b2b-sync";
import { notifyMetaCatalogChange } from "./meta-catalog-sync";
import { dukkanStockTotalsSql, dukkanStockHistorySql } from "./dukkan-stock-ledger";
import {createManualStockMovement,changeManualStockMovement} from "./dukkan-stock-adjustments";
import { buildCariExcel } from "./dukkan-cari-excel";
import {extractPositionedPdfWords,parsePositionedCariStatement,importedStatementSchema} from "./dukkan-cari-statement-parser";
import {documentSha256,postImportedStatement,summarizeImportedStatement} from "./dukkan-cari-import";
import {defaultInvoiceForm,invoiceFormSchema,resolveInvoiceForm,resolveInvoiceFormForStore,type InvoiceFormKind} from "../shared/dukkan-invoice-forms";

// Store records stay owner-scoped. B2B integration is an explicit mapped catalog bridge.
// Monetary values stay NUMERIC in PostgreSQL, never FLOAT. All postings use transactions.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS dukkan_stores (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, owner_user_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS dukkan_members (store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','manager','accountant','cashier','viewer')), PRIMARY KEY(store_id,user_id))",
  "CREATE TABLE IF NOT EXISTS dukkan_invoice_form_templates (store_id BIGINT NOT NULL REFERENCES dukkan_stores(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')),settings JSONB NOT NULL DEFAULT '{}'::jsonb,updated_by INTEGER REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(store_id,kind))",
  "CREATE TABLE IF NOT EXISTS dukkan_parties (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), type TEXT NOT NULL CHECK(type IN ('customer','supplier','both')), name TEXT NOT NULL, tax_number TEXT, phone TEXT, email TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,id))",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS source_cari_no TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS account_code TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS city TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS special_code TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS account_kind TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS contact_primary TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS contact_secondary TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS phone_secondary TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS fax_number TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS mobile_number TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS address TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS district TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS tax_office TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS special_code_2 TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS special_code_3 TEXT",
  "ALTER TABLE dukkan_parties ADD COLUMN IF NOT EXISTS notes TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_parties_source_cari_unique ON dukkan_parties(store_id,source_cari_no) WHERE source_cari_no IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS dukkan_products (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), sku TEXT NOT NULL, barcode TEXT, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'adet', stock NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK(stock>=0), purchase_price NUMERIC(18,2) NOT NULL DEFAULT 0, sale_price NUMERIC(18,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,sku), UNIQUE(store_id,id))",
  "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
  "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
  "CREATE INDEX IF NOT EXISTS dukkan_products_store_visibility_idx ON dukkan_products(store_id,archived_at,deleted_at)",
  "CREATE SEQUENCE IF NOT EXISTS dukkan_invoice_number_seq AS BIGINT START WITH 10000000000000 MINVALUE 10000000000000 MAXVALUE 99999999999999 NO CYCLE",
  "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_products_barcode_unique ON dukkan_products(store_id,barcode) WHERE barcode IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS dukkan_invoices (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase','sale_return','purchase_return')), invoice_no TEXT NOT NULL, issued_at DATE NOT NULL DEFAULT CURRENT_DATE, subtotal NUMERIC(18,2) NOT NULL, tax_total NUMERIC(18,2) NOT NULL, grand_total NUMERIC(18,2) NOT NULL, status TEXT NOT NULL DEFAULT 'posted', request_key UUID NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,invoice_no), UNIQUE(store_id,request_key))",
  "CREATE TABLE IF NOT EXISTS dukkan_invoice_lines (id BIGSERIAL PRIMARY KEY, invoice_id BIGINT NOT NULL REFERENCES dukkan_invoices(id), product_id BIGINT NOT NULL REFERENCES dukkan_products(id), quantity NUMERIC(16,3) NOT NULL CHECK(quantity>0), unit_price NUMERIC(18,2) NOT NULL CHECK(unit_price>=0), tax_rate NUMERIC(5,2) NOT NULL CHECK(tax_rate>=0 AND tax_rate<=100), line_total NUMERIC(18,2) NOT NULL)",
  "CREATE TABLE IF NOT EXISTS dukkan_stock_movements (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), product_id BIGINT NOT NULL, delta NUMERIC(16,3) NOT NULL CHECK(delta<>0), reason TEXT NOT NULL, invoice_id BIGINT REFERENCES dukkan_invoices(id), note TEXT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,product_id) REFERENCES dukkan_products(store_id,id))",
  "ALTER TABLE dukkan_stock_movements ADD COLUMN IF NOT EXISTS request_key UUID",
  "ALTER TABLE dukkan_stock_movements ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ",
  "ALTER TABLE dukkan_stock_movements ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id)",
  "ALTER TABLE dukkan_stock_movements ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ",
  "ALTER TABLE dukkan_stock_movements ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES users(id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_stock_request_key_unique ON dukkan_stock_movements(store_id,request_key) WHERE request_key IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS dukkan_stock_movement_audit (id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL, movement_id BIGINT NOT NULL REFERENCES dukkan_stock_movements(id),action TEXT NOT NULL CHECK(action IN ('edit','delete')),previous_delta NUMERIC(16,3) NOT NULL,new_delta NUMERIC(16,3) NOT NULL,previous_note TEXT,new_note TEXT,stock_before NUMERIC(16,3) NOT NULL,stock_after NUMERIC(16,3) NOT NULL,changed_by INTEGER NOT NULL REFERENCES users(id),changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS dukkan_stock_audit_store_movement_idx ON dukkan_stock_movement_audit(store_id,movement_id,changed_at DESC)",
  "CREATE TABLE IF NOT EXISTS dukkan_orders (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')), order_no TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,order_no))",
  "CREATE TABLE IF NOT EXISTS dukkan_order_lines (id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES dukkan_orders(id), product_id BIGINT NOT NULL REFERENCES dukkan_products(id), quantity NUMERIC(16,3) NOT NULL CHECK(quantity>0), unit_price NUMERIC(18,2) NOT NULL CHECK(unit_price>=0))",
  "CREATE TABLE IF NOT EXISTS dukkan_banks (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), name TEXT NOT NULL, iban TEXT, currency TEXT NOT NULL DEFAULT 'TRY', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_bank_movements (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), bank_id BIGINT NOT NULL, amount NUMERIC(18,2) NOT NULL CHECK(amount<>0), type TEXT NOT NULL, note TEXT, payment_id BIGINT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,bank_id) REFERENCES dukkan_banks(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_entries (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, debit NUMERIC(18,2) NOT NULL DEFAULT 0, credit NUMERIC(18,2) NOT NULL DEFAULT 0, description TEXT NOT NULL, invoice_id BIGINT REFERENCES dukkan_invoices(id), payment_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_import_batches (id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),party_id BIGINT NOT NULL,source_sha256 TEXT NOT NULL,source_filename TEXT NOT NULL,source_company TEXT,source_currency TEXT,report_date TEXT,source_page_count INTEGER,entry_count INTEGER,reported_balance NUMERIC(18,2),imported_by INTEGER NOT NULL REFERENCES users(id),imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(store_id,party_id,source_sha256),FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_import_entries (id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL,party_id BIGINT NOT NULL,batch_id BIGINT NOT NULL REFERENCES dukkan_cari_import_batches(id),entry_id BIGINT NOT NULL UNIQUE REFERENCES dukkan_cari_entries(id),document_date DATE NOT NULL,due_date DATE,kind TEXT NOT NULL,document_no TEXT NOT NULL,source_description TEXT,source_balance NUMERIC(18,2),source_page INTEGER NOT NULL,source_position INTEGER NOT NULL,FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id),UNIQUE(store_id,party_id,kind,document_date,document_no))",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_import_lines (id BIGSERIAL PRIMARY KEY,import_entry_id BIGINT NOT NULL REFERENCES dukkan_cari_import_entries(id),line_position INTEGER NOT NULL,product_name TEXT NOT NULL,quantity NUMERIC(16,3) NOT NULL,unit TEXT NOT NULL,unit_price NUMERIC(18,2) NOT NULL,discounted_unit_price NUMERIC(18,2),line_total NUMERIC(18,2) NOT NULL,UNIQUE(import_entry_id,line_position))",
  "CREATE INDEX IF NOT EXISTS dukkan_cari_import_entries_store_lookup_idx ON dukkan_cari_import_entries(store_id,party_id,document_date,entry_id)",
  "CREATE INDEX IF NOT EXISTS dukkan_cari_import_lines_entry_idx ON dukkan_cari_import_lines(import_entry_id,line_position)",
  "CREATE TABLE IF NOT EXISTS dukkan_payments (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('collection','payment')), method TEXT NOT NULL CHECK(method IN ('cash','bank')), bank_id BIGINT, amount NUMERIC(18,2) NOT NULL CHECK(amount>0), note TEXT, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), FOREIGN KEY(store_id,bank_id) REFERENCES dukkan_banks(store_id,id))",
  "ALTER TABLE dukkan_payments DROP CONSTRAINT IF EXISTS dukkan_payments_method_check",
  "ALTER TABLE dukkan_payments ADD CONSTRAINT dukkan_payments_method_check CHECK(method IN ('cash','bank','card','other'))",
  "ALTER TABLE dukkan_payments ADD COLUMN IF NOT EXISTS paid_on DATE",
  "ALTER TABLE dukkan_payments ADD COLUMN IF NOT EXISTS document_no TEXT",
  "ALTER TABLE dukkan_payments ADD COLUMN IF NOT EXISTS request_key UUID",
  "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_payments_request_key_unique ON dukkan_payments(store_id,request_key) WHERE request_key IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS dukkan_cari_openings (store_id BIGINT NOT NULL, party_id BIGINT NOT NULL, entry_id BIGINT NOT NULL REFERENCES dukkan_cari_entries(id), opened_on DATE NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(store_id,party_id), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id))",
  "CREATE TABLE IF NOT EXISTS dukkan_instruments (id BIGSERIAL PRIMARY KEY, store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), party_id BIGINT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('cheque','promissory')), direction TEXT NOT NULL CHECK(direction IN ('received','issued')), document_no TEXT NOT NULL, amount NUMERIC(18,2) NOT NULL CHECK(amount>0), due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','bounced','cancelled')), note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(store_id,party_id) REFERENCES dukkan_parties(store_id,id), UNIQUE(store_id,kind,direction,document_no))",
  "ALTER TABLE dukkan_instruments ADD COLUMN IF NOT EXISTS issued_on DATE",
  "CREATE INDEX IF NOT EXISTS dukkan_invoice_store_idx ON dukkan_invoices(store_id,issued_at DESC)",
  "CREATE INDEX IF NOT EXISTS dukkan_stock_store_idx ON dukkan_stock_movements(store_id,created_at DESC)",
  "CREATE INDEX IF NOT EXISTS dukkan_stock_product_history_idx ON dukkan_stock_movements(store_id,product_id,created_at DESC,id DESC)",
  "CREATE INDEX IF NOT EXISTS dukkan_invoice_lines_product_history_idx ON dukkan_invoice_lines(product_id,invoice_id,id)",
  "CREATE INDEX IF NOT EXISTS dukkan_cari_store_idx ON dukkan_cari_entries(store_id,party_id,created_at DESC)"
].join(";\n") + ";";

let schemaPromise: Promise<void> | undefined;
async function ready() {
  if (!pool) throw Object.assign(new Error("PostgreSQL bağlantısı gerekli"), { status: 503 });
  if (!schemaPromise) schemaPromise = pool.query(SCHEMA)
    .then(() => ensureDukkanB2BBridge(pool!))
    .then(() => backfillExistingDukkanProducts(pool!))
    .then(async()=>{
      // Seed the requested ÇALIŞKAN GROUP catalog on service initialization,
      // without waiting for the browser to open its Products page.
      try{
        const primary=await pool!.query(
          "SELECT id FROM dukkan_stores WHERE LOWER(TRIM(name))=LOWER('ÇALIŞKAN GROUP') ORDER BY id LIMIT 1",
        );
        if(primary.rows[0]){
          const result=await importAllB2BToDukkan(pool!,Number(primary.rows[0].id));
          console.info("Dukkan B2B initial catalog sync:",result);
        }
      }catch(error){
        console.error("Dukkan B2B initial sync failed; existing store data remains available:",error);
      }
    })
    .catch((error) => { schemaPromise = undefined; throw error; });
  await schemaPromise;
  return pool;
}
// Full B2B reconciliation must not block the product-list HTTP response.
const catalogImportRunning=new Map<number,Promise<void>>();
const catalogImportCheckedAt=new Map<number,number>();
function syncMissingB2BWithoutBlocking(db:Parameters<typeof importAllB2BToDukkan>[0],sid:number){
  if(catalogImportRunning.has(sid)||Date.now()-(catalogImportCheckedAt.get(sid)||0)<15000)return;
  catalogImportCheckedAt.set(sid,Date.now());
  const task=importAllB2BToDukkan(db,sid).then(r=>{
    if(r.imported||r.skipped)console.info("Dukkan catalog sync:",{sid,...r});
  }).catch(err=>console.error("Dukkan catalog sync failed:",err))
    .finally(()=>{catalogImportRunning.delete(sid);});
  catalogImportRunning.set(sid,task);
}
const id = z.coerce.number().int().positive();
const twoDecimals=(n:number)=>Math.abs(n*100-Math.round(n*100))<0.00001;
const threeDecimals=(n:number)=>Math.abs(n*1000-Math.round(n*1000))<0.00001;
const amount = z.coerce.number().finite().min(0.01).max(999999999999).refine(twoDecimals,"Tutar en fazla iki ondalık basamak içerebilir");
const qty = z.coerce.number().finite().positive().max(999999999).refine(threeDecimals,"Miktar en fazla üç ondalık basamak içerebilir");
const string = z.string().trim().min(1).max(200);
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lineSchema = z.object({ productId: id, quantity: qty, unitPrice: z.coerce.number().finite().min(0).max(999999999).refine(twoDecimals), taxRate: z.coerce.number().min(0).max(100).default(20) });
const docSchema = z.object({ partyId: id, kind: z.enum(["sale", "purchase", "sale_return", "purchase_return"]), number: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), requestKey: z.string().uuid(), lines: z.array(lineSchema).min(1).max(200) });
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
function accountant(res: Response) { if (!["owner","manager","accountant"].includes(res.locals.dukkanRole)) deny("Muhasebe yetkisi gerekiyor"); }
function manager(res: Response) { if (!["owner","manager"].includes(res.locals.dukkanRole)) deny("Mağaza yönetim yetkisi gerekiyor"); }
// Inventory reconciliation is allowed for store managers, accountants and platform admins.
// Cashiers/viewers still cannot edit or void stock history.
function stockEditor(res: Response) {
  if (!res.locals.dukkanAdmin && !["owner","manager","accountant"].includes(String(res.locals.dukkanRole)))
    deny("Stok hareketlerini düzenlemek için mağaza yönetim veya muhasebe yetkisi gerekiyor");
}
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
  app.use("/api/dukkan", (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve().then(async () => {
      const uid = sessionUserId(req);
      if (!uid) return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
      const person = await storage.getUser(uid);
      if (!person || person.isActive !== 1 || person.mustChangePassword === 1)
        return res.status(403).json({ error: "Hesap etkin değil veya ilk şifre değişimi gerekiyor" });
      res.locals.dukkanUserId = uid;
      res.locals.dukkanAdmin = ["super_admin", "admin"].includes(person.role);
      next();
    }).catch(next);
  });

  app.get("/api/dukkan/stores", safe(async (_req,res) => {
    const db=await ready();
    const result=await db.query(
      "SELECT s.*,m.role FROM dukkan_stores s JOIN dukkan_members m ON m.store_id=s.id WHERE m.user_id=$1 ORDER BY s.id",
      [user(res)]
    );
    res.json(result.rows);
  }));
  app.post("/api/dukkan/stores", safe(async (req,res) => {
    if (!res.locals.dukkanAdmin) deny("Mağaza açmak için Çalışkan Admin yetkisi gerekir");
    const payload=z.object({name:string}).parse(req.body);
    const output=await transaction(async c => {
      const r=await c.query("INSERT INTO dukkan_stores(name,owner_user_id) VALUES($1,$2) RETURNING *",[payload.name,user(res)]);
      await c.query("INSERT INTO dukkan_members(store_id,user_id,role) VALUES($1,$2,'owner')",[r.rows[0].id,user(res)]);
      return r.rows[0];
    });
    res.status(201).json(output);
  }));

  app.use("/api/dukkan/stores/:storeId", (req: Request,res: Response,next: NextFunction) => {
    void Promise.resolve().then(async () => {
      const sid=store(req);
      const db=await ready();
      const r=await db.query("SELECT role FROM dukkan_members WHERE store_id=$1 AND user_id=$2",[sid,user(res)]);
      if (!r.rowCount) return res.status(403).json({error:"Bu mağazaya erişiminiz yok"});
      res.locals.dukkanStoreId=sid;
      res.locals.dukkanRole=r.rows[0].role as string;
      if (req.method!=="GET" && res.locals.dukkanRole==="viewer")
        return res.status(403).json({error:"Salt okunur kullanıcı işlem yapamaz"});
      next();
    }).catch(next);
  });

  app.post("/api/dukkan/stores/:storeId/members",safe(async(req,res)=>{
    if (!["owner","manager"].includes(res.locals.dukkanRole)) deny("Üye ekleme yetkiniz yok");
    const p=z.object({userId:id.optional(),username:z.string().trim().min(1).max(254).optional(),role:z.enum(["manager","accountant","cashier","viewer"])}).refine(v=>Boolean(v.userId||v.username),"Kullanıcı seçiniz").parse(req.body);
    const db=await ready();
    const existsUser=p.userId?await storage.getUser(p.userId):await storage.getUserByUsername(p.username||"");
    if(!existsUser || existsUser.isActive!==1) return res.status(404).json({error:"Aktif kullanıcı bulunamadı"});
    await db.query("INSERT INTO dukkan_members(store_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(store_id,user_id) DO UPDATE SET role=EXCLUDED.role WHERE dukkan_members.role<>'owner'",[store(req),existsUser.id,p.role]);
    res.status(201).json({ok:true});
  }));
  app.get("/api/dukkan/stores/:storeId/members",safe(async(req,res)=>{
    if (!["owner","manager"].includes(res.locals.dukkanRole)) deny("Üye listesi için yetkiniz yok");
    const db=await ready();const r=await db.query("SELECT m.user_id,u.username,m.role FROM dukkan_members m JOIN users u ON u.id=m.user_id WHERE m.store_id=$1 ORDER BY m.user_id",[store(req)]);res.json(r.rows);
  }));

  const listQueries: Record<string,string> = {
    parties:"SELECT p.*,COALESCE(SUM(e.debit-e.credit),0) AS balance,MAX(e.created_at) AS last_transaction_at FROM dukkan_parties p LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id WHERE p.store_id=$1 GROUP BY p.id ORDER BY p.id DESC LIMIT 5000",
    products:"SELECT id,store_id,COALESCE(b2b_source_sku,sku) AS sku,COALESCE(b2b_source_barcode,barcode) AS barcode,name,unit,stock,purchase_price,sale_price,brand,category,description,publish_b2b,b2b_product_id,units_per_box,min_order_qty,created_at,archived_at,deleted_at,CASE WHEN image_data LIKE 'data:image/%' THEN '/api/dukkan/stores/'||store_id||'/products/'||id||'/image' ELSE image_data END AS image_url,CASE WHEN jsonb_typeof(images)='array' AND COALESCE(images->>0,'') LIKE 'https://%' THEN images->>0 ELSE NULL END AS image_external_url,CASE WHEN jsonb_typeof(images)='array' THEN jsonb_array_length(images) ELSE 0 END AS image_count FROM dukkan_products WHERE store_id=$1 AND deleted_at IS NULL AND ($2::boolean OR archived_at IS NULL) ORDER BY id DESC LIMIT 5000",
    invoices:"SELECT i.*,p.name AS party_name FROM dukkan_invoices i JOIN dukkan_parties p ON p.id=i.party_id AND p.store_id=i.store_id WHERE i.store_id=$1 ORDER BY i.id DESC LIMIT 500",
    orders:"SELECT o.*,p.name AS party_name FROM dukkan_orders o JOIN dukkan_parties p ON p.id=o.party_id AND p.store_id=o.store_id WHERE o.store_id=$1 ORDER BY o.id DESC LIMIT 500",
    "stock-movements":"SELECT m.*,p.name AS product_name FROM dukkan_stock_movements m JOIN dukkan_products p ON p.id=m.product_id AND p.store_id=m.store_id WHERE m.store_id=$1 ORDER BY m.id DESC LIMIT 500",
    banks:"SELECT b.*, COALESCE(SUM(m.amount),0) AS balance FROM dukkan_banks b LEFT JOIN dukkan_bank_movements m ON m.store_id=b.store_id AND m.bank_id=b.id WHERE b.store_id=$1 GROUP BY b.id ORDER BY b.id DESC",
    "bank-movements":"SELECT m.*,b.name AS bank_name FROM dukkan_bank_movements m JOIN dukkan_banks b ON b.id=m.bank_id AND b.store_id=m.store_id WHERE m.store_id=$1 ORDER BY m.id DESC LIMIT 500",
    instruments:"SELECT n.*,p.name AS party_name FROM dukkan_instruments n JOIN dukkan_parties p ON p.id=n.party_id AND p.store_id=n.store_id WHERE n.store_id=$1 ORDER BY n.due_date ASC LIMIT 500",
    payments:"SELECT t.*,p.name AS party_name FROM dukkan_payments t JOIN dukkan_parties p ON p.id=t.party_id AND p.store_id=t.store_id WHERE t.store_id=$1 ORDER BY t.id DESC LIMIT 500",
    "cari-movements":"SELECT e.*,p.name AS party_name FROM dukkan_cari_entries e JOIN dukkan_parties p ON p.id=e.party_id AND p.store_id=e.store_id WHERE e.store_id=$1 ORDER BY e.id DESC LIMIT 500"
  };
  app.get("/api/dukkan/stores/:storeId/data/:resource",safe(async(req,res)=>{
    const resource=req.params.resource;
    const query=listQueries[resource];
    if (!query) return res.status(404).json({error:"Bölüm bulunamadı"});
    const cashier=res.locals.dukkanRole==="cashier";
    if(cashier && ["banks","bank-movements","instruments","payments","cari-movements"].includes(resource))deny("Bu bölüm için muhasebe yetkisi gerekiyor");
    const db=await ready();
    if(resource==="invoices"){
      // Imported cari statements already posted their ledger movements. Expose
      // their invoice evidence as READ-ONLY archive documents; do not insert
      // into dukkan_invoices or repost stock, KDV or cari balances.
      const sid=store(req);
      const standardSql=cashier
        ?query.replace("ORDER BY i.id DESC","AND i.kind IN ('sale','sale_return') ORDER BY i.id DESC")
        :query;
      const [standard,archived]=await Promise.all([
        db.query(standardSql,[sid]),
        db.query(
          "SELECT ('archive-'||ie.id::text) AS id,ie.store_id,ie.party_id,"+
          "ie.document_no AS invoice_no,ie.kind,ie.document_date AS issued_at,"+
          "NULL::numeric AS subtotal,NULL::numeric AS tax_total,"+
          "(e.debit+e.credit) AS grand_total,'archived_import' AS status,"+
          "TRUE AS imported_archive,b.imported_at AS created_at,"+
          "b.source_filename AS source_filename,ie.source_page AS source_page,"+
          "p.name AS party_name "+
          "FROM dukkan_cari_import_entries ie "+
          "JOIN dukkan_cari_entries e ON e.id=ie.entry_id AND e.store_id=ie.store_id AND e.party_id=ie.party_id "+
          "JOIN dukkan_parties p ON p.id=ie.party_id AND p.store_id=ie.store_id "+
          "JOIN dukkan_cari_import_batches b ON b.id=ie.batch_id AND b.store_id=ie.store_id "+
          "WHERE ie.store_id=$1 AND ie.kind IN ('sale','purchase') "+
          (cashier?"AND ie.kind='sale' ":"")+
          "AND NOT EXISTS(SELECT 1 FROM dukkan_invoices i "+
          "WHERE i.store_id=ie.store_id AND i.party_id=ie.party_id "+
          "AND i.kind=ie.kind AND i.invoice_no=ie.document_no) "+
          "ORDER BY ie.document_date DESC,ie.id DESC LIMIT 5000",
          [sid]
        ),
      ]);
      const asDay=(value:unknown)=>value instanceof Date
        ?value.toISOString().slice(0,10):String(value||"").slice(0,10);
      const records=[...standard.rows,...archived.rows].sort((a,b)=>{
        const aDate=asDay(a.issued_at);
        const bDate=asDay(b.issued_at);
        return bDate.localeCompare(aDate)||String(b.id).localeCompare(String(a.id));
      }).slice(0,5000);
      res.setHeader("Cache-Control","private,no-store");
      return res.json(records);
    }
    if(resource==="products")syncMissingB2BWithoutBlocking(db,store(req));
    res.setHeader("Cache-Control","private, no-store");
    const sql=cashier&&resource==="invoices"?query.replace("ORDER BY i.id DESC","AND i.kind IN (\'sale\',\'sale_return\') ORDER BY i.id DESC"):query;
    const values=resource==="products"?[store(req),!cashier&&req.query.includeArchived==="1"]:[store(req)];
    const r=await db.query(sql,values);
    const rows=cashier&&resource==="products"?r.rows.map(({purchase_price,...rest})=>rest):cashier&&resource==="parties"?r.rows.map(({balance,...rest})=>rest):r.rows;
    res.json(rows);
  }));
  // Small, read-only stock picker payload; avoids loading invoices, customer
  // balances, reports and B2B bulk-import locks during stock-page navigation.
  app.get("/api/dukkan/stores/:storeId/stock-products",safe(async(req,res)=>{
    const sid=store(req),db=await ready();
    const result=await db.query(
      "SELECT id,COALESCE(b2b_source_sku,sku) AS sku,"+
      "COALESCE(b2b_source_barcode,barcode) AS barcode,name,brand,unit,stock,"+
      "CASE WHEN image_data LIKE 'data:image/%' THEN "+
      "'/api/dukkan/stores/'||store_id||'/products/'||id||'/image' "+
      "ELSE image_data END AS image_url "+
      "FROM dukkan_products WHERE store_id=$1 AND archived_at IS NULL AND deleted_at IS NULL ORDER BY name,id LIMIT 10000",
      [sid],
    );
    res.setHeader("Cache-Control","private, no-store");
    res.json(result.rows);
  }));
  app.get("/api/dukkan/stores/:storeId/report",safe(async(req,res)=>{
    if(res.locals.dukkanRole==="cashier")deny("Rapor yetkisi gerekiyor");
    const db=await ready();const sid=store(req);
    const [sales,purchases,stock,receivables,banks,overdue]=await Promise.all([
      db.query("SELECT COALESCE(SUM(CASE WHEN kind='sale' THEN grand_total WHEN kind='sale_return' THEN -grand_total ELSE 0 END),0) AS total FROM dukkan_invoices WHERE store_id=$1",[sid]),
      db.query("SELECT COALESCE(SUM(CASE WHEN kind='purchase' THEN grand_total WHEN kind='purchase_return' THEN -grand_total ELSE 0 END),0) AS total FROM dukkan_invoices WHERE store_id=$1",[sid]),
      db.query("SELECT COUNT(*)::int AS product_count,COALESCE(SUM(stock*purchase_price),0) AS stock_cost FROM dukkan_products WHERE store_id=$1 AND deleted_at IS NULL",[sid]),
      db.query("SELECT COALESCE(SUM(debit-credit),0) AS net_balance FROM dukkan_cari_entries WHERE store_id=$1",[sid]),
      db.query("SELECT COALESCE(SUM(amount),0) AS bank_balance FROM dukkan_bank_movements WHERE store_id=$1",[sid]),
      db.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(amount),0) AS amount FROM dukkan_instruments WHERE store_id=$1 AND status='pending' AND due_date<CURRENT_DATE",[sid])
    ]);
    res.json({sales:sales.rows[0].total,purchases:purchases.rows[0].total,stock:stock.rows[0],netBalance:receivables.rows[0].net_balance,bankBalance:banks.rows[0].bank_balance,overdue:overdue.rows[0]});
  }));


  // Export the CURRENT signed ledger balances, not the historical Excel opening snapshot.
  // Like /report this stays scoped to a logged-in store member, never to the public B2B API.
  app.get("/api/dukkan/stores/:storeId/report/cari-excel",safe(async(req,res)=>{
    if(res.locals.dukkanRole==="cashier")deny("Cari Excel raporunu indirme yetkiniz yok");
    const kind=req.query.type;
    if(kind!=="debt"&&kind!=="credit")return res.status(400).json({error:"Rapor türü borçlu veya alacaklı olmalıdır"});
    const sid=store(req);
    const db=await ready();
    const result=await db.query(`
      SELECT p.source_cari_no,p.account_code,p.name,p.city,p.phone,p.type,p.tax_number,
             p.email,p.special_code,COALESCE(SUM(e.debit-e.credit),0) AS balance
        FROM dukkan_parties p
        LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id
       WHERE p.store_id=$1
       GROUP BY p.id
      HAVING COALESCE(SUM(e.debit-e.credit),0) ${kind==="debt"?">":"<"} 0
       ORDER BY ABS(COALESCE(SUM(e.debit-e.credit),0)) DESC,p.name ASC
    `,[sid]);
    const title=await db.query("SELECT name FROM dukkan_stores WHERE id=$1",[sid]);
    const bytes=buildCariExcel(kind,title.rows[0]?.name||"Çalışkan Dükkan",result.rows);
    const filename="caliskan-dukkan-"+(kind==="debt"?"borclu":"alacakli")+"-cariler-"+new Date().toISOString().slice(0,10)+".xlsx";
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",'attachment; filename="'+filename+'"');
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    return res.status(200).send(bytes);
  }));

  // Multi-page customer statement preview. PDF text coordinates are preserved:
  // no PDF screenshot/OCR guessing, no ledger writes during extraction.
  app.post("/api/dukkan/stores/:storeId/ai-documents/preview-cari-statement",safe(async(req,res)=>{
    accountant(res);
    const payload=z.object({
      filename:z.string().trim().min(1).max(180),
      mimeType:z.literal("application/pdf"),
      base64:z.string().min(20).max(11_000_000).regex(/^[a-zA-Z0-9+/]+={0,2}$/),
    }).parse(req.body);
    const sid=store(req);
    const bytes=Buffer.from(payload.base64,"base64");
    if(bytes.length<64||bytes.length>8_000_000||bytes.subarray(0,5).toString()!=="%PDF-")
      return res.status(400).json({error:"Geçerli, en fazla 8 MB büyüklüğünde PDF yükleyin."});
    const pages=await extractPositionedPdfWords(bytes);
    const statement=parsePositionedCariStatement(pages);
    const summary=summarizeImportedStatement(statement);
    const db=await ready();
    const existing=await db.query(
      "SELECT id,name,source_cari_no FROM dukkan_parties "+
      "WHERE store_id=$1 AND source_cari_no=$2",
      [sid,statement.party.sourceCariNo],
    );
    const alreadyImported=existing.rows[0]?await db.query(
      "SELECT id,imported_at FROM dukkan_cari_import_batches "+
      "WHERE store_id=$1 AND party_id=$2 AND source_sha256=$3",
      [sid,existing.rows[0].id,documentSha256(bytes)],
    ): {rows:[]};
    const ledger=existing.rows[0]?await db.query(
      "SELECT COUNT(*)::integer AS count,COALESCE(SUM(debit-credit),0) AS balance, "+
      "MAX(CASE WHEN invoice_id IS NULL AND payment_id IS NULL AND "+
      "(description ILIKE 'Excel açılış bakiyesi%' OR description ILIKE 'Açılış bakiyesi%') "+
      "THEN 1 ELSE 0 END) AS opening "+
      "FROM dukkan_cari_entries WHERE store_id=$1 AND party_id=$2",
      [sid,existing.rows[0].id],
    ):null;
    const ledgerInfo=ledger?.rows[0];
    res.setHeader("Cache-Control","private,no-store");
    res.json({
      statement,summary,sha256:documentSha256(bytes),filename:payload.filename,
      existingParty:existing.rows[0]||null,
      existingLedger:{
        count:Number(ledgerInfo?.count||0),
        balance:Number(ledgerInfo?.balance||0),
        canReplaceOpening:Number(ledgerInfo?.count||0)===1&&
          Number(ledgerInfo?.opening||0)===1,
      },
      duplicate:alreadyImported.rows.length>0,
    });
  }));
  app.post("/api/dukkan/stores/:storeId/ai-documents/import-cari-statement",safe(async(req,res)=>{
    accountant(res);
    const input=z.object({
      sha256:z.string().regex(/^[a-f0-9]{64}$/),
      filename:z.string().trim().min(1).max(180),
      partyId:z.number().int().positive().optional(),
      confirmExisting:z.boolean().optional(),
      replaceOpening:z.boolean().optional(),
      statement:importedStatementSchema,
      confirmed:z.literal(true),
    }).strict().parse(req.body);
    const sid=store(req);
    const saved=await transaction(async c=>postImportedStatement(c,{
      storeId:sid,actor:user(res),sha256:input.sha256,filename:input.filename,
      partyId:input.partyId,statement:input.statement,
      confirmExisting:input.confirmExisting,replaceOpening:input.replaceOpening,
    }));
    res.setHeader("Cache-Control","no-store");
    res.status(201).json(saved);
  }));
  // Financial documents are interpreted by AI only after an authenticated member uploads them.
  // This route NEVER posts a ledger entry. All extracted fields require explicit review.
  app.post("/api/dukkan/stores/:storeId/ai-documents/extract", safe(async(req,res)=>{
    const payload=z.object({
      section:z.enum(["products","stock","instruments","parties","sales","purchases"]),
      filename:z.string().trim().min(1).max(180),
      mimeType:z.enum(["application/pdf","image/png","image/jpeg","image/webp"]),
      base64:z.string().min(20).max(11_000_000).regex(/^[a-zA-Z0-9+/]+={0,2}$/)
    }).parse(req.body);
    const role=String(res.locals.dukkanRole||"");
    if (["products","stock"].includes(payload.section)) manager(res);
    else if (["instruments","purchases"].includes(payload.section)) accountant(res);
    if (role==="viewer") deny("Belge içe aktarma yetkiniz yok");
    const bytes=Buffer.from(payload.base64,"base64");
    if (bytes.byteLength>8_000_000 || bytes.byteLength<64)throw Object.assign(new Error("Belge 8 MB sınırını aşıyor veya boş"),{status:413});
    const magic=bytes.subarray(0,12);
    const isPdf=magic.subarray(0,5).toString()==="%PDF-";
    const isPng=magic.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg=magic[0]===255&&magic[1]===216&&magic[2]===255;
    const isWebp=magic.subarray(0,4).toString()==="RIFF"&&magic.subarray(8,12).toString()==="WEBP";
    if (!({ "application/pdf":isPdf,"image/png":isPng,"image/jpeg":isJpeg,"image/webp":isWebp } as Record<string,boolean>)[payload.mimeType])
      throw Object.assign(new Error("Dosyanın gerçek biçimi ile uzantısı uyuşmuyor"),{status:400});
    if (!process.env.OPENAI_API_KEY)throw Object.assign(new Error("AI belge analizi sunucuda henüz yapılandırılmamış"),{status:503});
    const sid=store(req),db=await ready();
    const [parties,products]=await Promise.all([
      db.query("SELECT id,name,tax_number FROM dukkan_parties WHERE store_id=$1 LIMIT 500",[sid]),
      db.query("SELECT id,name,sku,barcode FROM dukkan_products WHERE store_id=$1 LIMIT 500",[sid])
    ]);
    const prompt=[
      "Sen bir Türkçe ticari belge veri ayıklama sistemisin. Kullanıcının yüklediği belgeyi incele.",
      "Belge türü: "+payload.section+". Kesinlikle olmayan bir bilgiyi uydurma. Okunamayanları boş bırak.",
      "Yalnız geçerli JSON döndür; markdown veya açıklama ekleme.",
      'Şema: {"fields":{"name":"","sku":"","barcode":"","unit":"","purchasePrice":"","salePrice":"","partyName":"","partyTaxNumber":"","sourceCariNo":"","accountCode":"","city":"","district":"","address":"","taxNumber":"","taxOffice":"","phone":"","phoneSecondary":"","mobileNumber":"","faxNumber":"","email":"","contactPrimary":"","contactSecondary":"","specialCode":"","specialCode2":"","specialCode3":"","accountKind":"","notes":"","date":"","kind":"","delta":"","direction":"","number":"","amount":"","dueDate":"","note":""},"lines":[{"productName":"","sku":"","barcode":"","quantity":"","unitPrice":"","taxRate":""}],"products":[{"name":"","sku":"","barcode":"","unit":"","purchasePrice":"","salePrice":""}],"warnings":["..."]}.',
      "Cari belgelerinde cari adı, cari kodu, hesap kodu, adres, il, ilçe, vergi, iletişim, ilgili kişi ve özel kod gibi bulunan bütün alanları fields içine çıkar. Cari no ile vergi no birbirine karıştırılmamalı; belge yoksa boş bırak.",
      "Tarihler YYYY-MM-DD, sayılar noktalı ondalık formatta yazılmalı. Yüzde KDV yalnız oran olarak verilmeli.",
      "Çek veya senet için kind cheque veya promissory, direction received veya issued.",
      "Satış ve alışta kind sale veya purchase. Fatura satırlarını lines içine yaz.",
      "Ürün listesi ürünleri products içine, ürün kartı tekse fields içine ekle.",
      "Stok hareketi delta pozitif giriş, negatif çıkış; tahmini miktar üretme.",
      "Ürün ve cari kayıtlarını numara/isim benzerliğine göre tahmin ederek kimlik atama; yalnızca belgedeki bilgileri çıkar."
    ].join("\n");
    const media=payload.mimeType==="application/pdf"
      ?{type:"input_file",filename:payload.filename,file_data:"data:application/pdf;base64,"+payload.base64}
      :{type:"input_image",image_url:"data:"+payload.mimeType+";base64,"+payload.base64,detail:"high"};
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),60000);
    let result:any;
    try{
      const response=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",signal:controller.signal,
        headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({model:process.env.DUKKAN_DOC_AI_MODEL||"gpt-4.1-mini",max_output_tokens:2500,
          input:[{role:"user",content:[{type:"input_text",text:prompt},media]}]})
      });
      if(!response.ok)throw Object.assign(new Error("Belge analiz hizmetine erişilemiyor"),{status:502});
      result=await response.json();
    }catch(error){if((error as Error).name==="AbortError")throw Object.assign(new Error("Belge analizi zaman aşımına uğradı"),{status:504});throw error;}
    finally{clearTimeout(timeout);}
    const output=(result.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n");
    const match=output.match(/\{[\s\S]*\}/);
    if(!match)throw Object.assign(new Error("Belge okunamadı. Daha net bir belge yükleyin."),{status:422});
    let extracted:any;
    try{extracted=JSON.parse(match[0]);}catch{throw Object.assign(new Error("Belge alanları doğrulanamadı"),{status:422});}
    const clean=(v:any)=>String(v??"").trim().slice(0,220);
    const fields:Record<string,string>={};
    for(const key of ["name","sku","barcode","unit","purchasePrice","salePrice","partyName","partyTaxNumber","sourceCariNo","accountCode","city","district","address","taxNumber","taxOffice","phone","phoneSecondary","mobileNumber","faxNumber","email","contactPrimary","contactSecondary","specialCode","specialCode2","specialCode3","accountKind","notes","date","kind","delta","direction","number","amount","dueDate","note"]){
      fields[key]=key==="notes"?String(extracted.fields?.[key]||"").trim().slice(0,6000):key==="address"?String(extracted.fields?.[key]||"").trim().slice(0,1000):clean(extracted.fields?.[key]);
    }
    const warnings:string[]=Array.isArray(extracted.warnings)?extracted.warnings.slice(0,10).map(clean):[];
    const norm=(v:any)=>String(v||"").trim().toLocaleLowerCase("tr-TR");
    const party=parties.rows.filter((p:any)=>fields.partyTaxNumber?norm(p.tax_number)===norm(fields.partyTaxNumber):fields.partyName&&norm(p.name)===norm(fields.partyName));
    if(party.length===1)fields.partyId=String(party[0].id);
    else if(["sales","purchases","instruments"].includes(payload.section))warnings.push("Cari hesap eşleşmedi veya birden fazla eşleşme var; kullanıcı seçmeli.");
    const resolveProduct=(item:any)=>{
      const match=products.rows.filter((p:any)=>(item.barcode&&norm(p.barcode)===norm(item.barcode))||
        (item.sku&&norm(p.sku)===norm(item.sku))||(!item.barcode&&!item.sku&&item.productName&&norm(p.name)===norm(item.productName)));
      if(match.length!==1)warnings.push("Ürün eşleşmesi kontrol edilmeli: "+clean(item.productName||item.sku));
      return match.length===1?String(match[0].id):"";
    };
    if(payload.section==="stock")fields.productId=resolveProduct({productName:fields.name,sku:fields.sku,barcode:fields.barcode});
    const lines=(Array.isArray(extracted.lines)?extracted.lines:[]).slice(0,200).map((v:any)=>({
      productId:resolveProduct(v),productName:clean(v.productName),sku:clean(v.sku),
      quantity:clean(v.quantity),unitPrice:clean(v.unitPrice),taxRate:clean(v.taxRate||"20")
    }));
    const productRows=(Array.isArray(extracted.products)?extracted.products:[]).slice(0,100).map((v:any)=>({
      name:clean(v.name),sku:clean(v.sku),barcode:clean(v.barcode),unit:clean(v.unit||"adet"),
      purchasePrice:clean(v.purchasePrice||"0"),salePrice:clean(v.salePrice||"0")
    }));
    res.setHeader("Cache-Control","no-store");
    res.json({section:payload.section,fields,lines,products:productRows,warnings});
  }));

  // Bulk product approval is atomic: a duplicate SKU/barcode rolls back every row.
  app.post("/api/dukkan/stores/:storeId/ai-documents/import-products",safe(async(req,res)=>{
    manager(res);
    const row=z.object({name:string,sku:string,barcode:z.string().trim().max(64).optional(),
      unit:z.string().trim().min(1).max(20).default("adet"),
      purchasePrice:z.coerce.number().finite().min(0).refine(twoDecimals),
      salePrice:z.coerce.number().finite().min(0).refine(twoDecimals)});
    const payload=z.object({products:z.array(row).min(1).max(100)}).parse(req.body);
    const sid=store(req);
    const imported=await transaction(async c=>{
      const records=[];
      for(const p of payload.products){
        const result=await c.query("INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,purchase_price,sale_price) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[
          sid,p.name,p.sku,p.barcode||null,p.unit,money(p.purchasePrice),money(p.salePrice)
        ]);
        const linked=await syncDukkanToB2B(c,result.rows[0]);
        records.push({id:linked.id,sku:linked.sku,b2b_product_id:linked.b2b_product_id});
      }
      return records;
    });
    notifyMetaCatalogChange();
    res.status(201).json({created:imported.length,records:imported});
  }));

  const cariProfileSchema=z.object({
    name:string,
    type:z.enum(["customer","supplier","both"]),
    sourceCariNo:z.string().trim().max(80).optional(),
    taxNumber:z.string().trim().max(30).optional(),
    phone:z.string().trim().max(40).optional(),
    email:z.union([z.literal(""),z.string().trim().email().max(200)]).optional(),
    accountCode:z.string().trim().max(80).optional(),
    city:z.string().trim().max(120).optional(),
    specialCode:z.string().trim().max(200).optional(),
    accountKind:z.enum(["buyer","seller","both",""]).optional(),
    contactPrimary:z.string().trim().max(180).optional(),
    contactSecondary:z.string().trim().max(180).optional(),
    phoneSecondary:z.string().trim().max(50).optional(),
    faxNumber:z.string().trim().max(50).optional(),
    mobileNumber:z.string().trim().max(50).optional(),
    address:z.string().trim().max(1000).optional(),
    district:z.string().trim().max(120).optional(),
    taxOffice:z.string().trim().max(160).optional(),
    specialCode2:z.string().trim().max(200).optional(),
    specialCode3:z.string().trim().max(200).optional(),
    notes:z.string().trim().max(8000).optional()
  });
  const cariValues=(p:z.infer<typeof cariProfileSchema>)=>[
    p.name,p.type,p.sourceCariNo||null,p.accountCode||null,p.city||null,
    p.taxNumber||null,p.phone||null,p.email||null,p.specialCode||null,
    p.accountKind||null,p.contactPrimary||null,p.contactSecondary||null,
    p.phoneSecondary||null,p.faxNumber||null,p.mobileNumber||null,
    p.address||null,p.district||null,p.taxOffice||null,
    p.specialCode2||null,p.specialCode3||null,p.notes||null
  ];
  app.post("/api/dukkan/stores/:storeId/parties",safe(async(req,res)=>{
    accountant(res);
    const p=cariProfileSchema.parse(req.body);
    const db=await ready();
    try{
      const r=await db.query(
        "INSERT INTO dukkan_parties(store_id,name,type,source_cari_no,account_code,city,tax_number,phone,email,special_code,account_kind,contact_primary,contact_secondary,phone_secondary,fax_number,mobile_number,address,district,tax_office,special_code_2,special_code_3,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *",
        [store(req),...cariValues(p)]
      );
      res.status(201).json(r.rows[0]);
    }catch(error){
      if((error as {code?:string}).code==="23505")return res.status(409).json({error:"Bu cari numarası zaten mevcut."});
      throw error;
    }
  }));
  // Deep-linkable cari detail; the store scope prevents cross-store access.
  app.get("/api/dukkan/stores/:storeId/parties/:partyId",safe(async(req,res)=>{
    accountant(res);
    const sid=store(req),partyId=id.parse(req.params.partyId),db=await ready();
    const party=await db.query(
      "SELECT p.*,COALESCE(SUM(e.debit-e.credit),0) AS balance,MAX(e.created_at) AS last_transaction_at "+
      "FROM dukkan_parties p LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id "+
      "WHERE p.store_id=$1 AND p.id=$2 GROUP BY p.id",
      [sid,partyId]
    );
    if(!party.rowCount)return res.status(404).json({error:"Cari hesap bulunamadı veya bu mağazaya ait değil."});
    const movements=await db.query(
      "SELECT id,debit,credit,description,created_at FROM dukkan_cari_entries "+
      "WHERE store_id=$1 AND party_id=$2 ORDER BY created_at DESC,id DESC LIMIT 20",
      [sid,partyId]
    );
    res.setHeader("Cache-Control","private, no-store");
    res.json({...party.rows[0],recent_movements:movements.rows});
  }));
  app.patch("/api/dukkan/stores/:storeId/parties/:partyId",safe(async(req,res)=>{
    accountant(res);
    const sid=store(req),partyId=id.parse(req.params.partyId),p=cariProfileSchema.parse(req.body);
    try{
      const db=await ready();
      const r=await db.query(
        "UPDATE dukkan_parties SET name=$3,type=$4,source_cari_no=$5,account_code=$6,city=$7,tax_number=$8,phone=$9,email=$10,special_code=$11,account_kind=$12,contact_primary=$13,contact_secondary=$14,phone_secondary=$15,fax_number=$16,mobile_number=$17,address=$18,district=$19,tax_office=$20,special_code_2=$21,special_code_3=$22,notes=$23 WHERE store_id=$1 AND id=$2 RETURNING *",
        [sid,partyId,...cariValues(p)]
      );
      if(!r.rowCount)return res.status(404).json({error:"Cari hesap bu mağazada bulunamadı."});
      res.setHeader("Cache-Control","private, no-store");
      res.json(r.rows[0]);
    }catch(error){
      if((error as {code?:string}).code==="23505")return res.status(409).json({error:"Bu cari numarası zaten mevcut."});
      throw error;
    }
  }));

  // A complete, paginated chronological ledger. Both formats contain every financial
  // entry; the detailed variant adds original invoice lines and product quantities.
  app.get("/api/dukkan/stores/:storeId/parties/:partyId/statement",safe(async(req,res)=>{
    accountant(res);
    const sid=store(req),partyId=id.parse(req.params.partyId);
    const mode=z.enum(["standard","detailed"]).parse(req.query.mode||"standard");
    // Mobile may request newest-first history; preserve chronological web/PDF default.
    const sort=z.enum(["chronological","latest"]).parse(req.query.sort||"chronological");
    const direction=sort==="latest"?"DESC":"ASC";
    const offset=z.coerce.number().int().min(0).max(10000000).parse(req.query.offset||0);
    const batchSize=250;
    const db=await ready();
    const found=await db.query(
      "SELECT id,name,source_cari_no,account_code,type,phone,city,address,tax_number "+
      "FROM dukkan_parties WHERE store_id=$1 AND id=$2",[sid,partyId]
    );
    if(!found.rows.length)return res.status(404).json({error:"Bu mağazada cari hesap bulunamadı."});
    const shop=await db.query("SELECT name FROM dukkan_stores WHERE id=$1",[sid]);
    const result=await db.query(
      "SELECT x.*,SUM(x.debit-x.credit) OVER (ORDER BY x.document_date,x.created_at,x.id "+
      "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance "+
      "FROM ("+
      "SELECT e.id,e.created_at,e.description,e.debit,e.credit,e.invoice_id,e.payment_id,"+
      "COALESCE(legacy.document_date,i.issued_at,p.paid_on,o.opened_on,e.created_at::date) AS document_date,"+
      "i.invoice_no,COALESCE(i.kind,CASE WHEN legacy.kind IN ('sale','purchase') THEN legacy.kind END) AS invoice_kind,"+
      "COALESCE(p.direction,CASE WHEN legacy.kind='collection' THEN 'collection' "+
      "WHEN legacy.kind='payment' THEN 'payment' END) AS payment_direction,"+
      "p.method AS payment_method,COALESCE(p.document_no,legacy.document_no) AS document_no,"+
      "legacy.kind AS archived_kind,legacy.due_date,legacy.source_balance,legacy.id AS import_entry_id "+
      "FROM dukkan_cari_entries e "+
      "LEFT JOIN dukkan_invoices i ON i.id=e.invoice_id AND i.store_id=e.store_id AND i.party_id=e.party_id "+
      "LEFT JOIN dukkan_payments p ON p.id=e.payment_id AND p.store_id=e.store_id AND p.party_id=e.party_id "+
      "LEFT JOIN dukkan_cari_openings o ON o.store_id=e.store_id AND o.party_id=e.party_id AND o.entry_id=e.id "+
      "LEFT JOIN dukkan_cari_import_entries legacy ON legacy.entry_id=e.id AND legacy.store_id=e.store_id AND legacy.party_id=e.party_id "+
      "WHERE e.store_id=$1 AND e.party_id=$2"+
      ") x ORDER BY x.document_date "+direction+",x.created_at "+direction+",x.id "+direction+
      " LIMIT $3 OFFSET $4",[sid,partyId,batchSize,offset]
    );
    const records=result.rows;
    const invoiceIds=mode==="detailed"?[...new Set(records.map(row=>row.invoice_id).filter(Boolean))]:[];
    let lines:Record<string,unknown[]>={};
    if(invoiceIds.length){
      const details=await db.query(
        "SELECT l.invoice_id,l.quantity,l.unit_price,l.tax_rate,l.line_total,"+
        "prod.name AS product_name,prod.sku,prod.unit "+
        "FROM dukkan_invoice_lines l "+
        "JOIN dukkan_invoices inv ON inv.id=l.invoice_id AND inv.store_id=$1 AND inv.party_id=$2 "+
        "JOIN dukkan_products prod ON prod.id=l.product_id AND prod.store_id=$1 "+
        "WHERE l.invoice_id=ANY($3::bigint[]) ORDER BY l.invoice_id,l.id",
        [sid,partyId,invoiceIds]
      );
      for(const row of details.rows)(lines[String(row.invoice_id)]??=[]).push(row);
    }
    const importedIds=mode==="detailed"?records.filter(row=>row.import_entry_id)
      .map(row=>row.import_entry_id):[];
    const importedLines:Record<string,unknown[]>={};
    if(importedIds.length){
      const imported=await db.query(
        "SELECT ie.entry_id,line.product_name,line.quantity,line.unit,line.unit_price,"+
        "line.discounted_unit_price,line.line_total,NULL::text AS sku,NULL::numeric AS tax_rate "+
        "FROM dukkan_cari_import_lines line "+
        "JOIN dukkan_cari_import_entries ie ON ie.id=line.import_entry_id "+
        "WHERE ie.store_id=$1 AND ie.party_id=$2 AND ie.entry_id=ANY($3::bigint[]) "+
        "ORDER BY ie.entry_id,line.line_position",
        [sid,partyId,importedIds],
      );
      for(const row of imported.rows)(importedLines[String(row.entry_id)]??=[]).push(row);
    }
    res.setHeader("Cache-Control","private,no-store");
    res.json({
      party:found.rows[0],storeName:shop.rows[0]?.name||"Çalışkan Dükkan",mode,sort,offset,
      nextOffset:records.length===batchSize?offset+batchSize:null,
      entries:records.map(row=>({
        ...row,invoice_lines:mode==="detailed"?
          (row.import_entry_id?importedLines[String(row.id)]||[]:lines[String(row.invoice_id)]||[]):undefined
      }))
    });
  }));

  // Incoming collection decreases the party debit balance; an outgoing payment
  // increases it. Cash or real bank movement is posted in the same transaction.
  app.post("/api/dukkan/stores/:storeId/parties/:partyId/payments",safe(async(req,res)=>{
    accountant(res);
    const sid=store(req),partyId=id.parse(req.params.partyId);
    const data=z.object({
      direction:z.enum(["collection","payment"]),amount,
      method:z.enum(["cash","bank","card","other"]),bankId:id.optional(),
      date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      documentNo:z.string().trim().max(80).optional(),
      note:z.string().trim().max(500).optional(),
      requestKey:z.string().uuid(),
    }).parse(req.body);
    if(data.method==="bank"&&!data.bankId)
      return res.status(400).json({error:"Havale / EFT için banka seçmelisiniz."});
    const output=await transaction(async c=>{
      const locked=await c.query("SELECT id FROM dukkan_parties WHERE store_id=$1 AND id=$2 FOR UPDATE",[sid,partyId]);
      if(!locked.rowCount)throw Object.assign(new Error("Cari hesap bulunamadı."),{status:404});
      if(data.method==="bank")await exists(c,"dukkan_banks",sid,data.bankId!);
      const previous=await c.query("SELECT id FROM dukkan_payments WHERE store_id=$1 AND request_key=$2",[sid,data.requestKey]);
      if(previous.rowCount)return {id:previous.rows[0].id,replayed:true};
      const pay=await c.query(
        "INSERT INTO dukkan_payments(store_id,party_id,direction,method,bank_id,amount,note,created_by,paid_on,document_no,request_key) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) "+
        "ON CONFLICT (store_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id",
        [sid,partyId,data.direction,data.method,data.method==="bank"?data.bankId:null,
          money(data.amount),data.note||null,user(res),data.date,data.documentNo||null,data.requestKey]
      );
      if(!pay.rowCount){
        const replay=await c.query("SELECT id FROM dukkan_payments WHERE store_id=$1 AND request_key=$2",[sid,data.requestKey]);
        if(replay.rowCount)return {id:replay.rows[0].id,replayed:true};
        throw Object.assign(new Error("Aynı ödeme işlemi işleniyor, tekrar deneyin."),{status:409});
      }
      const paymentId=pay.rows[0].id;
      await c.query(
        "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,payment_id) "+
        "VALUES($1,$2,$3,$4,$5,$6)",
        [sid,partyId,data.direction==="payment"?money(data.amount):0,
          data.direction==="collection"?money(data.amount):0,
          (data.direction==="collection"?"Tahsilat":"Ödeme")+
          (data.documentNo?" · "+data.documentNo:"")+(data.note?" · "+data.note:""),paymentId]
      );
      if(data.method==="bank")await c.query(
        "INSERT INTO dukkan_bank_movements(store_id,bank_id,amount,type,note,payment_id,created_by) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7)",
        [sid,data.bankId,data.direction==="collection"?money(data.amount):-money(data.amount),
          data.direction,data.note||null,paymentId,user(res)]
      );
      return {id:paymentId,replayed:false};
    });
    res.setHeader("Cache-Control","private,no-store");
    res.status(output.replayed?200:201).json(output);
  }));

  // One opening balance per party, including legacy imported opening entries.
  app.post("/api/dukkan/stores/:storeId/parties/:partyId/opening",safe(async(req,res)=>{
    accountant(res);
    const sid=store(req),partyId=id.parse(req.params.partyId);
    const data=z.object({
      type:z.enum(["debit","credit"]),amount,
      date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note:z.string().trim().max(500).optional()
    }).parse(req.body);
    const saved=await transaction(async c=>{
      const locked=await c.query("SELECT id FROM dukkan_parties WHERE store_id=$1 AND id=$2 FOR UPDATE",[sid,partyId]);
      if(!locked.rowCount)throw Object.assign(new Error("Cari hesap bulunamadı."),{status:404});
      const existing=await c.query(
        "SELECT e.id FROM dukkan_cari_entries e WHERE e.store_id=$1 AND e.party_id=$2 "+
        "AND (e.description ILIKE 'Excel açılış bakiyesi%' OR e.description ILIKE 'Açılış bakiyesi%') LIMIT 1",
        [sid,partyId]
      );
      const reserved=await c.query("SELECT entry_id FROM dukkan_cari_openings WHERE store_id=$1 AND party_id=$2",[sid,partyId]);
      if(existing.rowCount||reserved.rowCount)
        throw Object.assign(new Error("Bu cari için açılış bakiyesi mevcut. İkinci kez açılamaz."),{status:409});
      const row=await c.query(
        "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [sid,partyId,data.type==="debit"?money(data.amount):0,
          data.type==="credit"?money(data.amount):0,
          "Açılış bakiyesi"+(data.note?" · "+data.note:"")]
      );
      await c.query(
        "INSERT INTO dukkan_cari_openings(store_id,party_id,entry_id,opened_on,created_by) VALUES($1,$2,$3,$4,$5)",
        [sid,partyId,row.rows[0].id,data.date,user(res)]
      );
      return {entryId:row.rows[0].id};
    });
    res.status(201).json(saved);
  }));

  // Hard-deletion is allowed only for a completely untouched account. A zero
  // balance is NOT sufficient: invoices/orders/cheques/ledger entries block it.
  app.delete("/api/dukkan/stores/:storeId/parties/:partyId",safe(async(req,res)=>{
    manager(res);
    const sid=store(req),partyId=id.parse(req.params.partyId);
    const confirm=z.object({confirmName:z.string().trim().min(1)}).parse(req.body);
    await transaction(async c=>{
      const party=await c.query(
        "SELECT name FROM dukkan_parties WHERE store_id=$1 AND id=$2 FOR UPDATE",[sid,partyId]
      );
      if(!party.rowCount)throw Object.assign(new Error("Cari hesap bulunamadı."),{status:404});
      if(confirm.confirmName!==party.rows[0].name)
        throw Object.assign(new Error("Son onay için firma adını doğru girin."),{status:400});
      const checks=[
        "dukkan_cari_entries","dukkan_invoices","dukkan_orders",
        "dukkan_payments","dukkan_instruments","dukkan_cari_openings"
      ] as const;
      for(const table of checks){
        const existsRow=await c.query("SELECT 1 FROM "+table+" WHERE store_id=$1 AND party_id=$2 LIMIT 1",[sid,partyId]);
        if(existsRow.rowCount)throw Object.assign(
          new Error("Cari hesapta işlem/hareket bulunduğu için silinemez. Hareketler korunmalıdır."),{status:409}
        );
      }
      try{
        await c.query("DELETE FROM dukkan_parties WHERE store_id=$1 AND id=$2",[sid,partyId]);
      }catch(error){
        if((error as {code?:string}).code==="23503")
          throw Object.assign(new Error("Bu cari başka bir belgeye bağlı olduğu için silinemez."),{status:409});
        throw error;
      }
    });
    res.json({deleted:true});
  }));

  const productPayload = z.object({
    name:string,sku:string,
    barcode:z.string().trim().max(64).optional(),
    unit:z.string().trim().min(1).max(20).default("adet"),
    purchasePrice:z.coerce.number().finite().min(0).refine(twoDecimals).default(0),
    salePrice:z.coerce.number().finite().min(0).refine(twoDecimals).default(0),
    brand:z.string().trim().max(100).default(""),
    category:z.string().trim().max(120).default(""),
    description:z.string().trim().max(4000).default(""),
    unitsPerBox:z.coerce.number().int().min(1).max(100000).default(1),
    minOrderQty:z.coerce.number().int().min(1).max(10000).default(1),
    publishB2B:z.boolean().default(false),
    images:z.unknown().optional(),
  });
  // Dashboard product counts must come from canonical database records,
  // not from the number of linked/imported catalog rows.
  app.get("/api/dukkan/stores/:storeId/catalog/summary",safe(async(req,res)=>{
    const db=await ready();
    const counts=await db.query(
      "SELECT (SELECT COUNT(*)::integer FROM b2b_products WHERE is_active IS DISTINCT FROM FALSE) AS published_b2b, "+
      "(SELECT COUNT(*)::integer FROM dukkan_products WHERE store_id=$1 AND deleted_at IS NULL) AS dukkan_total",
      [store(req)],
    );
    res.setHeader("Cache-Control","private, no-store");
    res.json({
      publishedB2B:Number(counts.rows[0]?.published_b2b||0),
      dukkanTotal:Number(counts.rows[0]?.dukkan_total||0),
    });
  }));
  // The B2B catalog is visible here without granting access to other stores' private costs.
  // Linked products are excluded: their current Dükkan row already appears in /data/products.
  app.get("/api/dukkan/stores/:storeId/catalog/b2b",safe(async(req,res)=>{
    if (res.locals.dukkanRole==="cashier") deny("Ürün kataloğu için yetki gerekiyor");
    const db=await ready();
    const r=await db.query(
      "SELECT p.id,p.sku,p.name,p.barcode,p.brand,p.category,p.price,p.stock,p.image_data," +
      "p.units_per_box,p.min_order_qty,p.is_active,p.updated_at," +
      "EXISTS(SELECT 1 FROM dukkan_products other WHERE other.b2b_product_id=p.id::text) AS linked_to_store " +
      "FROM b2b_products p WHERE (p.is_active IS DISTINCT FROM FALSE OR $2::boolean) AND NOT EXISTS(" +
      "SELECT 1 FROM dukkan_products d WHERE d.store_id=$1 AND d.b2b_product_id=p.id::text) ORDER BY p.updated_at DESC LIMIT 500",
      [store(req),Boolean(res.locals.dukkanAdmin)],
    );
    // No sensitive internal purchase cost; clients use a lightweight public thumbnail endpoint.
    res.setHeader("Cache-Control","private, no-store");
    res.json(r.rows.map(row=>({...row,
      image_url:typeof row.image_data==="string"&&row.image_data.startsWith("data:image/")
        ? "/api/b2b/product-image/"+row.id : row.image_data,
      image_data:undefined,
    })));
  }));

  // B2B global catalogue editing requires both store-manager and platform-admin access.
  // Linked products must be edited from their owning store, where stock is authoritative.
  const editableGlobalB2B = async (c: PoolClient, productId: string) => {
    // Lock the catalog row before checking store ownership, matching the import
    // transaction's lock order so concurrent editing cannot take over a link.
    const product=await c.query("SELECT * FROM b2b_products WHERE id::text=$1 FOR UPDATE",[productId]);
    if(!product.rows[0])throw Object.assign(new Error("B2B ürünü bulunamadı"),{status:404});
    const linked=await c.query(
      "SELECT store_id,id FROM dukkan_products WHERE b2b_product_id=$1 LIMIT 1",[productId],
    );
    if(linked.rowCount)throw Object.assign(
      new Error("Ürün mağaza stoklarına bağlı. Bağlı mağazanın ürün kartından düzenleyin."),{status:409},
    );
    return product.rows[0];
  };
  const globalB2BAdmin = (res:Response) => {
    manager(res);
    if(!res.locals.dukkanAdmin)deny("B2B kataloğunu düzenlemek için Çalışkan Admin yetkisi gerekiyor");
  };
  const globalId = z.string().trim().min(1).max(128);
  app.get("/api/dukkan/stores/:storeId/catalog/b2b/:b2bId",safe(async(req,res)=>{
    globalB2BAdmin(res);
    const productId=globalId.parse(req.params.b2bId),db=await ready();
    const found=await db.query(
      "SELECT id,sku,name,brand,category,description,price,stock,min_order_qty,units_per_box,"+
      "image_data,images,barcode,is_active FROM b2b_products WHERE id::text=$1 LIMIT 1",[productId],
    );
    if(!found.rows[0])return res.status(404).json({error:"B2B ürünü bulunamadı"});
    res.setHeader("Cache-Control","private, no-store");
    res.json(found.rows[0]);
  }));
  app.patch("/api/dukkan/stores/:storeId/catalog/b2b/:b2bId",safe(async(req,res)=>{
    globalB2BAdmin(res);
    const productId=globalId.parse(req.params.b2bId);
    const p=z.object({
      name:string,sku:string,barcode:z.string().trim().max(64).optional(),
      brand:z.string().trim().max(100).default(""),
      category:z.string().trim().max(120).default(""),
      description:z.string().trim().max(4000).default(""),
      salePrice:z.coerce.number().finite().min(0).max(999999999).refine(twoDecimals),
      stock:z.coerce.number().int().min(0).max(2147483647),
      unitsPerBox:z.coerce.number().int().min(1).max(100000),
      minOrderQty:z.coerce.number().int().min(1).max(10000),
      publishB2B:z.boolean(),
      images:z.unknown().optional(),
    }).parse(req.body);
    const updated=await transaction(async c=>{
      const before=await editableGlobalB2B(c,productId);
      const images=p.images===undefined
        ? (Array.isArray(before.images)&&before.images.length?before.images:before.image_data?[before.image_data]:[])
        : validateDukkanImages(p.images);
      if(p.publishB2B&&!images.length)throw Object.assign(
        new Error("B2B'de yayınlamak için en az bir ürün görseli ekleyin"),{status:400});
      const output=await c.query(
        "UPDATE b2b_products SET name=$2,sku=$3,barcode=$4,brand=$5,category=$6,description=$7,"+
        "price=$8,stock=$9,units_per_box=$10,min_order_qty=$11,is_active=$12,image_data=$13,"+
        "images=$14::jsonb,updated_at=NOW() WHERE id::text=$1 RETURNING id,is_active",
        [productId,p.name,p.sku,p.barcode||null,p.brand||null,p.category||null,
         p.description||null,money(p.salePrice),p.stock,p.unitsPerBox,p.minOrderQty,
         p.publishB2B,images[0]||null,JSON.stringify(images)],
      );
      return output.rows[0];
    });
    notifyMetaCatalogChange();
    res.json(updated);
  }));
  // Fast publication switches change no product content, prices or stock.
  app.patch("/api/dukkan/stores/:storeId/catalog/b2b/:b2bId/publication",safe(async(req,res)=>{
    globalB2BAdmin(res);
    const productId=globalId.parse(req.params.b2bId);
    const requested=z.object({published:z.boolean()}).parse(req.body);
    const updated=await transaction(async c=>{
      const before=await editableGlobalB2B(c,productId);
      if(requested.published&&!before.image_data&&(!Array.isArray(before.images)||!before.images.length))
        throw Object.assign(new Error("Yayınlamak için en az bir ürün görseli gerekli"),{status:400});
      const result=await c.query(
        "UPDATE b2b_products SET is_active=$2,updated_at=NOW() WHERE id::text=$1 RETURNING id,is_active",
        [productId,requested.published],
      );
      return result.rows[0];
    });
    notifyMetaCatalogChange();
    res.json(updated);
  }));
  // Atomic store-scoped operations: validate every selected product before writing.
  app.post("/api/dukkan/stores/:storeId/products/bulk",safe(async(req,res)=>{
    manager(res);
    const sid=store(req);
    const body=z.object({action:z.enum(["publish","archive","restore","delete"]),
      ids:z.array(id).min(1).max(100)}).parse(req.body);
    const ids=[...new Set(body.ids)];
    if(ids.length!==body.ids.length)
      return res.status(400).json({error:"Aynı ürün birden fazla kez seçilemez."});
    const outcome=await transaction(async c=>{
      const selected=await c.query(
        "SELECT * FROM dukkan_products WHERE store_id=$1 AND id=ANY($2::bigint[]) "+
        "AND deleted_at IS NULL ORDER BY id FOR UPDATE",[sid,ids]);
      if(selected.rows.length!==ids.length)
        throw Object.assign(new Error("Bazı ürünler bulunamadı veya silinmiş. Listeyi yenileyin."),{status:409});
      for(const product of selected.rows){
        const label=String(product.name||product.sku||product.id);
        if(body.action==="publish"){
          if(product.archived_at)
            throw Object.assign(new Error("Arşivdeki ürün yayınlanamaz: "+label+". Önce arşivden çıkarın."),{status:409});
          if(!product.image_data&&(!Array.isArray(product.images)||!product.images.length))
            throw Object.assign(new Error("B2B yayını için ürün görseli eksik: "+label),{status:409});
        }
        if(body.action==="delete"){
          if(Number(product.stock)!==0)
            throw Object.assign(new Error("Stok miktarı sıfır olmayan ürün silinemez: "+label+". Arşivleyebilirsiniz."),{status:409});
          const history=await c.query(
            "SELECT EXISTS(SELECT 1 FROM dukkan_stock_movements WHERE store_id=$1 AND product_id=$2) "+
            "OR EXISTS(SELECT 1 FROM dukkan_invoice_lines WHERE product_id=$2) "+
            "OR EXISTS(SELECT 1 FROM dukkan_order_lines WHERE product_id=$2) AS referenced",
            [sid,product.id]);
          if(history.rows[0]?.referenced)
            throw Object.assign(new Error("İşlem geçmişi olan ürün silinemez: "+label+". Arşivleyebilirsiniz."),{status:409});
        }
      }
      for(const product of selected.rows){
        if(body.action==="publish"){
          const saved=await c.query("UPDATE dukkan_products SET publish_b2b=TRUE WHERE store_id=$1 AND id=$2 RETURNING *",[sid,product.id]);
          await syncDukkanToB2B(c,saved.rows[0]);
        }else if(body.action==="archive"||body.action==="delete"){
          const saved=await c.query(
            "UPDATE dukkan_products SET archived_at=COALESCE(archived_at,NOW()),"+
            "deleted_at=CASE WHEN $3::boolean THEN NOW() ELSE deleted_at END,"+
            "publish_b2b=FALSE WHERE store_id=$1 AND id=$2 RETURNING *",
            [sid,product.id,body.action==="delete"]);
          if(saved.rows[0].b2b_product_id)await syncDukkanToB2B(c,saved.rows[0]);
        }else{
          const saved=await c.query("UPDATE dukkan_products SET archived_at=NULL WHERE store_id=$1 AND id=$2 RETURNING *",[sid,product.id]);
          // Restore never changes publication from false to true.
          if(saved.rows[0].b2b_product_id)await syncDukkanToB2B(c,saved.rows[0]);
        }
      }
      return {action:body.action,affected:ids.length,ids};
    });
    notifyMetaCatalogChange();
    res.setHeader("Cache-Control","private,no-store");
    res.json(outcome);
  }));

  app.patch("/api/dukkan/stores/:storeId/products/:productId/publication",safe(async(req,res)=>{
    manager(res);
    const sid=store(req),productId=id.parse(req.params.productId);
    const {published}=z.object({published:z.boolean()}).parse(req.body);
    const updated=await transaction(async c=>{
      const found=await c.query("SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2 FOR UPDATE",[sid,productId]);
      if(!found.rows[0])throw Object.assign(new Error("Mağaza ürünü bulunamadı"),{status:404});
      if(found.rows[0].deleted_at||Boolean(found.rows[0].archived_at))
        throw Object.assign(new Error("Silinmiş veya arşivlenmiş ürünün yayını değiştirilemez."),{status:409});
      if(published&&!found.rows[0].image_data&&(!Array.isArray(found.rows[0].images)||!found.rows[0].images.length))
        throw Object.assign(new Error("Yayınlamak için ürün görseli ekleyin"),{status:400});
      const result=await c.query(
        "UPDATE dukkan_products SET publish_b2b=$3 WHERE store_id=$1 AND id=$2 RETURNING *",
        [sid,productId,published],
      );
      return syncDukkanToB2B(c,result.rows[0]);
    });
    notifyMetaCatalogChange();
    res.json({id:updated.id,publish_b2b:updated.publish_b2b});
  }));

  // Importing makes a B2B product a local inventory item. Unique ownership prevents
  // two stores independently overwriting the same B2B stock.
  app.post("/api/dukkan/stores/:storeId/catalog/b2b/:b2bId/import",safe(async(req,res)=>{
    manager(res);
    // A local store manager may sell its own products, but taking over an
    // existing global B2B product requires verified platform-admin authority.
    if(!res.locals.dukkanAdmin)deny("B2B ürününü mağazaya bağlamak için Çalışkan Admin yetkisi gerekiyor");
    const sid=store(req),b2bId=z.string().trim().min(1).max(128).parse(req.params.b2bId);
    const item=await transaction(async c=>{
      const result=await c.query(
        "SELECT id,sku,name,barcode,brand,category,description,price,stock,image_data,images,units_per_box,min_order_qty " +
        "FROM b2b_products WHERE id::text=$1 AND is_active IS DISTINCT FROM FALSE FOR UPDATE",
        [b2bId],
      );
      const row=result.rows[0];
      if(!row)throw Object.assign(new Error("B2B ürünü bulunamadı"),{status:404});
      const existing=await c.query("SELECT id,store_id FROM dukkan_products WHERE b2b_product_id=$1 LIMIT 1",[b2bId]);
      if(existing.rows[0]){
        if(String(existing.rows[0].store_id)===String(sid))
          throw Object.assign(new Error("Ürün bu mağazaya zaten aktarılmış"),{status:409});
        throw Object.assign(new Error("Bu B2B ürünü başka bir mağazanın stoklarına bağlı"),{status:409});
      }
      const imported=await c.query(
        "INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,stock,purchase_price,sale_price,"+
        "brand,category,description,image_data,images,units_per_box,min_order_qty,publish_b2b,b2b_product_id) "+
        "VALUES($1,$2,$3,$4,'adet',$5,0,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,TRUE,$14) RETURNING *",
        [sid,row.name,row.sku,row.barcode||null,row.stock,row.price||0,row.brand||null,
         row.category||null,row.description||null,row.image_data||null,JSON.stringify(row.images||[]),
         row.units_per_box||1,row.min_order_qty||1,row.id],
      );
      return imported.rows[0];
    });
    res.status(201).json(item);
  }));
  // File upload itself is not public: only store members can read the original images.
  app.get("/api/dukkan/stores/:storeId/products/:productId/image",safe(async(req,res)=>{
    const productId=id.parse(req.params.productId),sid=store(req);
    const index=req.query.index===undefined?0:Number(req.query.index);
    if(!Number.isInteger(index)||index<0||index>5) return res.status(400).end();
    const db=await ready();
    const found=await db.query(
      "SELECT image_data,images FROM dukkan_products WHERE store_id=$1 AND id=$2 LIMIT 1",[sid,productId]);
    if(!found.rows[0]) return res.status(404).end();
    const arr=Array.isArray(found.rows[0].images)?found.rows[0].images:[];
    const image=arr[index]||(index===0?found.rows[0].image_data:null);
    if(typeof image!=="string")return res.status(404).end();
    const match=/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(image);
    if(match){
      res.setHeader("Content-Type",match[1]);
      res.setHeader("Cache-Control","private,max-age=60");
      return res.send(Buffer.from(match[2],"base64"));
    }
    if(/^https:\/\//i.test(image)||/^\/uploads\/[a-z0-9._-]+$/i.test(image))
      return res.redirect(302,image);
    return res.status(404).end();
  }));
  app.get("/api/dukkan/stores/:storeId/products/:productId",safe(async(req,res)=>{
    manager(res);
    const db=await ready(),sid=store(req),productId=id.parse(req.params.productId);
    const r=await db.query("SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2 LIMIT 1",[sid,productId]);
    if(!r.rows[0])return res.status(404).json({error:"Ürün bulunamadı"});
    res.setHeader("Cache-Control","private,no-store");
    res.json({...r.rows[0],sku:r.rows[0].b2b_source_sku||r.rows[0].sku,
      barcode:r.rows[0].b2b_source_barcode||r.rows[0].barcode});
  }));
  app.post("/api/dukkan/stores/:storeId/products",safe(async(req,res)=>{
    manager(res);
    const p=productPayload.parse(req.body),sid=store(req);
    const images=validateDukkanImages(p.images);
    const created=await transaction(async c=>{
      const inserted=await c.query(
        "INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,purchase_price,sale_price,brand,category,"+
        "description,images,image_data,units_per_box,min_order_qty,publish_b2b) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15) RETURNING *",
        [sid,p.name,p.sku,p.barcode||null,p.unit,money(p.purchasePrice),money(p.salePrice),
         p.brand||null,p.category||null,p.description||null,JSON.stringify(images),images[0]||null,
         p.unitsPerBox,p.minOrderQty,p.publishB2B],
      );
      return syncDukkanToB2B(c,inserted.rows[0]);
    });
    notifyMetaCatalogChange();
    res.status(201).json(created);
  }));
  app.patch("/api/dukkan/stores/:storeId/products/:productId",safe(async(req,res)=>{
    manager(res);
    const sid=store(req),productId=id.parse(req.params.productId);
    const p=productPayload.parse(req.body);
    const updated=await transaction(async c=>{
      const before=await c.query("SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2 FOR UPDATE",[sid,productId]);
      if(!before.rows[0]||before.rows[0].deleted_at)
        throw Object.assign(new Error("Bu mağazada etkin ürün bulunamadı"),{status:404});
      if(before.rows[0].archived_at&&p.publishB2B)
        throw Object.assign(new Error("Arşivlenen ürün önce arşivden çıkarılmalıdır."),{status:409});
      const images=p.images===undefined?before.rows[0].images:validateDukkanImages(p.images);
      const original=before.rows[0];
      const importedFromB2B=Boolean(original.b2b_source_sku);
      // Imported catalog rows keep their original sales SKU / barcode visible,
      // but collisions must not break Dükkan's unique scanner/index constraints.
      const sameSku=await c.query(
        "SELECT id FROM dukkan_products WHERE store_id=$1 AND sku=$2 AND id<>$3 LIMIT 1",
        [sid,p.sku,productId],
      );
      const internalSku=importedFromB2B&&sameSku.rowCount
        ? "B2B-"+String(original.b2b_product_id) : p.sku;
      const sameBarcode=p.barcode?await c.query(
        "SELECT id FROM dukkan_products WHERE store_id=$1 AND barcode=$2 AND id<>$3 LIMIT 1",
        [sid,p.barcode,productId],
      ):null;
      const internalBarcode=importedFromB2B&&sameBarcode?.rowCount?null:p.barcode||null;
      const result=await c.query(
        "UPDATE dukkan_products SET name=$3,sku=$4,barcode=$5,unit=$6,purchase_price=$7,sale_price=$8,"+
        "brand=$9,category=$10,description=$11,images=$12::jsonb,image_data=$13,"+
        "units_per_box=$14,min_order_qty=$15,publish_b2b=$16,"+
        "b2b_source_sku=$17,b2b_source_barcode=$18 "+
        "WHERE store_id=$1 AND id=$2 RETURNING *",
        [sid,productId,p.name,internalSku,internalBarcode,p.unit,money(p.purchasePrice),
         money(p.salePrice),p.brand||null,p.category||null,p.description||null,
         JSON.stringify(images),images[0]||null,p.unitsPerBox,p.minOrderQty,p.publishB2B,
         importedFromB2B?p.sku:null,importedFromB2B?p.barcode||null:null],
      );
      return syncDukkanToB2B(c,result.rows[0]);
    });
    notifyMetaCatalogChange();
    res.json(updated);
  }));
  app.post("/api/dukkan/stores/:storeId/stock-movements",safe(async(req,res)=>{
    stockEditor(res);
    const p=z.object({
      productId:id,
      delta:z.coerce.number().finite().refine(v=>v!==0&&threeDecimals(v)),
      note:z.string().trim().min(3).max(500),
      requestKey:z.string().uuid().optional(),
    }).parse(req.body);
    const saved=await transaction(async c=>createManualStockMovement(c,{
      storeId:store(req),productId:p.productId,delta:p.delta,
      note:p.note,actor:user(res),requestKey:p.requestKey,
    }));
    res.setHeader("Cache-Control","no-store");
    res.status(saved.replayed?200:201).json(saved);
  }));
  app.patch("/api/dukkan/stores/:storeId/stock-movements/:movementId",safe(async(req,res)=>{
    stockEditor(res);
    const p=z.object({
      delta:z.coerce.number().finite().refine(v=>v!==0&&threeDecimals(v)),
      note:z.string().trim().min(3).max(500),
    }).parse(req.body);
    const changed=await transaction(async c=>changeManualStockMovement(c,{
      storeId:store(req),movementId:id.parse(req.params.movementId),
      actor:user(res),action:"edit",delta:p.delta,note:p.note,
    }));
    res.setHeader("Cache-Control","no-store");
    res.json(changed);
  }));
  app.delete("/api/dukkan/stores/:storeId/stock-movements/:movementId",safe(async(req,res)=>{
    stockEditor(res);
    const changed=await transaction(async c=>changeManualStockMovement(c,{
      storeId:store(req),movementId:id.parse(req.params.movementId),
      actor:user(res),action:"delete",
    }));
    res.setHeader("Cache-Control","no-store");
    res.json(changed);
  }));
  app.get("/api/dukkan/stores/:storeId/stock-movements/:movementId/audit",safe(async(req,res)=>{
    stockEditor(res);
    const sid=store(req),movementId=id.parse(req.params.movementId);
    const db=await ready();
    const exists=await db.query(
      "SELECT id FROM dukkan_stock_movements WHERE store_id=$1 AND id=$2 LIMIT 1",
      [sid,movementId],
    );
    if(!exists.rows[0])return res.status(404).json({error:"Stok hareketi bulunamadı"});
    const audit=await db.query(
      "SELECT a.id,a.action,a.previous_delta,a.new_delta,a.previous_note,a.new_note,"+
      "a.stock_before,a.stock_after,a.changed_at,u.username AS actor "+
      "FROM dukkan_stock_movement_audit a "+
      "LEFT JOIN users u ON u.id=a.changed_by "+
      "WHERE a.store_id=$1 AND a.movement_id=$2 ORDER BY a.id DESC LIMIT 100",
      [sid,movementId],
    );
    res.setHeader("Cache-Control","private, no-store");
    res.json(audit.rows);
  }));
  // Detailed product ledger is store-scoped and combines immutable invoice line prices
  // with their matching inventory entries. A manual adjustment has no sales/purchase
  // unit price, and imported opening stock is never represented as a fictitious invoice.
  app.get("/api/dukkan/stores/:storeId/stock-products/:productId/history",safe(async(req,res)=>{
    const sid=store(req),productId=id.parse(req.params.productId);
    const paging=z.object({
      page:z.coerce.number().int().min(1).max(100000).default(1),
      pageSize:z.coerce.number().int().min(10).max(100).default(50),
    }).parse(req.query);
    const db=await ready();
    const p=await db.query(
      "SELECT id,name,COALESCE(b2b_source_sku,sku) AS sku,COALESCE(b2b_source_barcode,barcode) AS barcode,"+
      "stock,unit,sale_price,purchase_price,b2b_product_id FROM dukkan_products WHERE store_id=$1 AND id=$2 LIMIT 1",
      [sid,productId],
    );
    if(!p.rows[0])return res.status(404).json({error:"Bu mağazada ürün bulunamadı"});
    const [totals,history,historyCount]=await Promise.all([
      db.query(dukkanStockTotalsSql,[sid,productId]),
      db.query(dukkanStockHistorySql,[sid,productId,paging.pageSize,(paging.page-1)*paging.pageSize]),
      db.query("SELECT COUNT(*)::integer AS total FROM dukkan_stock_movements WHERE store_id=$1 AND product_id=$2",[sid,productId]),
    ]);
    const stats=totals.rows[0];
    const canSeePurchasePrices=["owner","manager","accountant"].includes(String(res.locals.dukkanRole));
    const product=p.rows[0];
    const entries=history.rows.map(row=>{
      const isPurchaseSide=row.reason==="purchase"||row.reason==="purchase_return";
      return {
        ...row,
        unit_price:canSeePurchasePrices||!isPurchaseSide?row.unit_price:null,
        line_total:canSeePurchasePrices||!isPurchaseSide?row.line_total:null,
        tax_rate:canSeePurchasePrices||!isPurchaseSide?row.tax_rate:null,
      };
    });
    const openingDifference=Number(product.stock)-Number(stats.net_delta);
    res.setHeader("Cache-Control","private, no-store");
    res.json({
      product:{
        ...product,
        purchase_price:canSeePurchasePrices?product.purchase_price:null,
      },
      entries,
      stats:{
        ...stats,
        unrecorded_balance:openingDifference.toFixed(3),
      },
      page:paging.page,
      pageSize:paging.pageSize,
      historyTotal:Number(historyCount.rows[0]?.total||0),
      totalPages:Math.max(1,Math.ceil(Number(historyCount.rows[0]?.total||0)/paging.pageSize)),
    });
  }));
  // Only presentation settings can be edited. Financial values remain immutable.
  app.get("/api/dukkan/stores/:storeId/print-forms",safe(async(req,res)=>{
    const sid=store(req),db=await ready();
    const [saved,storeName]=await Promise.all([
      db.query("SELECT kind,settings FROM dukkan_invoice_form_templates WHERE store_id=$1",[sid]),
      db.query("SELECT name FROM dukkan_stores WHERE id=$1",[sid]),
    ]);
    const name=String(storeName.rows[0]?.name||"");
    const config:Record<InvoiceFormKind,ReturnType<typeof defaultInvoiceForm>>={
      sale:resolveInvoiceFormForStore("sale",null,name),
      purchase:resolveInvoiceFormForStore("purchase",null,name),
    };
    for(const item of saved.rows){
      const kind=String(item.kind);
      if(kind==="sale"||kind==="purchase")
        config[kind]=resolveInvoiceFormForStore(kind,item.settings,name);
    }
    res.setHeader("Cache-Control","private, no-store");
    res.json(config);
  }));
  app.put("/api/dukkan/stores/:storeId/print-forms/:kind",safe(async(req,res)=>{
    manager(res);
    const kind=z.enum(["sale","purchase"]).parse(req.params.kind);
    const config=invoiceFormSchema.parse(req.body);
    const sid=store(req),db=await ready();
    const saved=await db.query(
      "INSERT INTO dukkan_invoice_form_templates(store_id,kind,settings,updated_by) "+
      "VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(store_id,kind) "+
      "DO UPDATE SET settings=EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=NOW() "+
      "RETURNING settings,updated_at",
      [sid,kind,JSON.stringify(config),user(res)],
    );
    res.setHeader("Cache-Control","no-store");
    res.json({kind,template:resolveInvoiceForm(kind,saved.rows[0].settings),
      updatedAt:saved.rows[0].updated_at});
  }));
  // Read an immutable posted invoice amount from the user's authorized store.
  // The PDF renderer receives only the requested invoice and its product lines.
  // Cashiers may export sales documents only; purchases remain accountant-only.
  // Historical invoice snapshots from imported cari statements. These are
  // evidence of the source PDF, not newly posted invoices or GİB documents.
  app.get("/api/dukkan/stores/:storeId/invoices/archived/:importId/pdf-data",safe(async(req,res)=>{
    const sid=store(req),importId=id.parse(req.params.importId);
    const db=await ready();
    const row=await db.query(
      "SELECT ie.id,ie.store_id,ie.party_id,ie.document_no AS invoice_no,"+
      "ie.kind,ie.document_date AS issued_at,ie.source_description,"+
      "ie.source_page,b.source_filename,(e.debit+e.credit) AS grand_total,"+
      "NULL::numeric AS subtotal,NULL::numeric AS tax_total,"+
      "p.name AS party_name,p.tax_number AS party_tax_number,"+
      "p.phone AS party_phone,s.name AS store_name "+
      "FROM dukkan_cari_import_entries ie "+
      "JOIN dukkan_cari_entries e ON e.id=ie.entry_id AND e.store_id=ie.store_id AND e.party_id=ie.party_id "+
      "JOIN dukkan_cari_import_batches b ON b.id=ie.batch_id AND b.store_id=ie.store_id "+
      "JOIN dukkan_parties p ON p.id=ie.party_id AND p.store_id=ie.store_id "+
      "JOIN dukkan_stores s ON s.id=ie.store_id "+
      "WHERE ie.id=$1 AND ie.store_id=$2 AND ie.kind IN ('sale','purchase') LIMIT 1",
      [importId,sid]
    );
    if(!row.rowCount)return res.status(404).json({error:"Bu mağazaya ait arşiv fatura kaydı bulunamadı."});
    const document=row.rows[0];
    if(document.kind==="purchase")accountant(res);
    const details=await db.query(
      "SELECT l.id,l.product_name,l.quantity,l.unit,l.line_total,"+
      "COALESCE(l.discounted_unit_price,l.unit_price) AS unit_price,"+
      "NULL::numeric AS tax_rate,''::text AS sku "+
      "FROM dukkan_cari_import_lines l WHERE l.import_entry_id=$1 "+
      "ORDER BY l.line_position,l.id",[importId]
    );
    const type:InvoiceFormKind=document.kind==="purchase"?"purchase":"sale";
    const template=await db.query(
      "SELECT settings FROM dukkan_invoice_form_templates WHERE store_id=$1 AND kind=$2",
      [sid,type]
    );
    const canSeeBalance=["owner","manager","accountant"].includes(String(res.locals.dukkanRole));
    const balance=canSeeBalance?await db.query(
      "SELECT COALESCE(SUM(debit-credit),0) AS total FROM dukkan_cari_entries WHERE store_id=$1 AND party_id=$2",
      [sid,document.party_id]
    ):null;
    res.setHeader("Cache-Control","private,no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.json({
      invoice:{...document,party_balance:balance?.rows[0]?.total??null},
      lines:details.rows,
      template:resolveInvoiceFormForStore(type,template.rows[0]?.settings,document.store_name),
      importedArchive:true,officialInvoice:false,
      disclaimer:"Kaynak cari ekstresinden aktarılan arşiv belgesidir; resmî fatura, e-Fatura veya e-Arşiv değildir. KDV dağılımı kaynakta belirtilmiyorsa doğrulanamaz."
    });
  }));

  app.get("/api/dukkan/stores/:storeId/invoices/:invoiceId/pdf-data",safe(async(req,res)=>{
    const sid=store(req),invoiceId=id.parse(req.params.invoiceId);
    const db=await ready();
    const invoice=await db.query(
      "SELECT i.id,i.store_id,i.party_id,i.invoice_no,i.kind,i.issued_at,i.subtotal,i.tax_total,i.grand_total,i.status,p.name AS party_name,p.tax_number AS party_tax_number,p.phone AS party_phone,s.name AS store_name FROM dukkan_invoices i JOIN dukkan_parties p ON p.id=i.party_id AND p.store_id=i.store_id JOIN dukkan_stores s ON s.id=i.store_id WHERE i.id=$1 AND i.store_id=$2",
      [invoiceId,sid]
    );
    if(!invoice.rowCount)return res.status(404).json({error:"Bu mağazada fatura bulunamadı"});
    const doc=invoice.rows[0];
    const purchaseDocument=["purchase","purchase_return"].includes(doc.kind);
    if(!purchaseDocument&&!["sale","sale_return"].includes(doc.kind))
      return res.status(400).json({error:"Desteklenmeyen belge türü"});
    if(purchaseDocument)accountant(res);
    const lines=await db.query(
      "SELECT l.id,l.quantity,l.unit_price,l.tax_rate,l.line_total,p.sku,p.name AS product_name,p.unit FROM dukkan_invoice_lines l JOIN dukkan_products p ON p.id=l.product_id AND p.store_id=$2 WHERE l.invoice_id=$1 ORDER BY l.id",
      [invoiceId,sid]
    );
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    const templateKind:InvoiceFormKind=purchaseDocument?"purchase":"sale";
    const templateRows=await db.query(
      "SELECT settings FROM dukkan_invoice_form_templates WHERE store_id=$1 AND kind=$2",
      [sid,templateKind],
    );
    const canShowBalance=["owner","manager","accountant"].includes(String(res.locals.dukkanRole));
    const balance=canShowBalance?await db.query(
      "SELECT COALESCE(SUM(debit-credit),0) AS total FROM dukkan_cari_entries "+
      "WHERE store_id=$1 AND party_id=$2",
      [sid,doc.party_id],
    ):null;
    res.json({invoice:{...doc,party_balance:balance?.rows[0]?.total??null},lines:lines.rows,
      template:resolveInvoiceFormForStore(templateKind,templateRows.rows[0]?.settings,doc.store_name),
      officialInvoice:false,
      disclaimer:"Dahili ön muhasebe belgesidir; GİB e-Fatura veya e-Arşiv yerine geçmez."});
  }));

  app.post("/api/dukkan/stores/:storeId/invoices",safe(async(req,res)=>{
    const p=docSchema.parse(req.body);
    if(p.kind!=="sale")accountant(res);const sid=store(req);
    const invoice=await transaction(async c=>{
      const duplicate=await c.query("SELECT * FROM dukkan_invoices WHERE store_id=$1 AND request_key=$2",[sid,p.requestKey]);
      if(duplicate.rowCount)return duplicate.rows[0];
      await exists(c,"dukkan_parties",sid,p.partyId);
      // Invoice line values are calculated only on the server.
      const lines=p.lines.map(l=>{
        const net=money(l.quantity*money(l.unitPrice));
        const vat=money(net*l.taxRate/100);
        return {...l,net,vat,total:money(net+vat)};
      });
      const subtotal=money(lines.reduce((s,l)=>s+l.net,0));
      const taxTotal=money(lines.reduce((s,l)=>s+l.vat,0));
      const grandTotal=money(subtotal+taxTotal);
      const inserted=await c.query("INSERT INTO dukkan_invoices(store_id,party_id,kind,invoice_no,issued_at,subtotal,tax_total,grand_total,request_key,created_by) VALUES($1,$2,$3,nextval('dukkan_invoice_number_seq')::text,COALESCE($4::date,CURRENT_DATE),$5,$6,$7,$8,$9) RETURNING *",[sid,p.partyId,p.kind,p.date||null,subtotal,taxTotal,grandTotal,p.requestKey,user(res)]);
      const doc=inserted.rows[0];
      const sign=(p.kind==="purchase" || p.kind==="sale_return")?1:-1;
      for(const l of lines){
        const updated=await c.query("UPDATE dukkan_products SET stock=stock+$3 WHERE store_id=$1 AND id=$2 AND stock+$3>=0 RETURNING id",[sid,l.productId,sign*l.quantity]);
        if(!updated.rowCount) throw Object.assign(new Error("Stok yetersiz veya ürün başka mağazaya ait: "+l.productId),{status:409});
        await c.query("INSERT INTO dukkan_invoice_lines(invoice_id,product_id,quantity,unit_price,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6)",[doc.id,l.productId,l.quantity,money(l.unitPrice),l.taxRate,l.total]);
        await c.query("INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,invoice_id,created_by) VALUES($1,$2,$3,$4,$5,$6)",[sid,l.productId,sign*l.quantity,p.kind,doc.id,user(res)]);
      }
      const debit=p.kind==="sale" || p.kind==="purchase_return" ? grandTotal : 0;
      const credit=p.kind==="purchase" || p.kind==="sale_return" ? grandTotal : 0;
      await c.query("INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,invoice_id) VALUES($1,$2,$3,$4,$5,$6)",[sid,p.partyId,debit,credit,p.kind+" "+doc.invoice_no,doc.id]);
      return doc;
    });
    res.status(201).json(invoice);
  }));
  app.post("/api/dukkan/stores/:storeId/orders",safe(async(req,res)=>{
    const p=orderSchema.parse(req.body);
    if(p.kind!=="sale")accountant(res);const sid=store(req);
    const result=await transaction(async c=>{
      await exists(c,"dukkan_parties",sid,p.partyId);
      const row=await c.query("INSERT INTO dukkan_orders(store_id,party_id,kind,order_no,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",[sid,p.partyId,p.kind,p.number,user(res)]);
      for(const l of p.lines){await exists(c,"dukkan_products",sid,l.productId);await c.query("INSERT INTO dukkan_order_lines(order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4)",[row.rows[0].id,l.productId,l.quantity,money(l.unitPrice)]);}
      return row.rows[0];
    });res.status(201).json(result);
  }));
  app.post("/api/dukkan/stores/:storeId/banks",safe(async(req,res)=>{
    accountant(res);
    const p=z.object({name:string,iban:z.string().max(34).optional()}).parse(req.body);
    const db=await ready();const r=await db.query("INSERT INTO dukkan_banks(store_id,name,iban) VALUES($1,$2,$3) RETURNING *",[store(req),p.name,p.iban||null]);res.status(201).json(r.rows[0]);
  }));
  app.post("/api/dukkan/stores/:storeId/bank-movements",safe(async(req,res)=>{
    accountant(res);
    const p=z.object({bankId:id,type:z.enum(["deposit","withdrawal"]),amount, note:z.string().max(500).optional()}).parse(req.body);
    const sid=store(req);const result=await transaction(async c=>{
      await exists(c,"dukkan_banks",sid,p.bankId);
      const signed=p.type==="deposit"?money(p.amount):-money(p.amount);
      const r=await c.query("INSERT INTO dukkan_bank_movements(store_id,bank_id,amount,type,note,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[sid,p.bankId,signed,p.type,p.note||null,user(res)]);return r.rows[0];
    });res.status(201).json(result);
  }));
  app.post("/api/dukkan/stores/:storeId/payments",safe(async(req,res)=>{
    const p=z.object({partyId:id,direction:z.enum(["collection","payment"]),method:z.enum(["cash","bank"]),bankId:id.optional(),amount,note:z.string().max(500).optional()}).parse(req.body);
    if (p.method==="bank"&&!p.bankId) return res.status(400).json({error:"Banka seçmelisiniz"});
    if(p.direction==="payment" || (res.locals.dukkanRole==="cashier" && p.method==="bank"))accountant(res);
    const sid=store(req);
    const result=await transaction(async c=>{
      await exists(c,"dukkan_parties",sid,p.partyId);
      if(p.bankId)await exists(c,"dukkan_banks",sid,p.bankId);
      const pay=await c.query("INSERT INTO dukkan_payments(store_id,party_id,direction,method,bank_id,amount,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[sid,p.partyId,p.direction,p.method,p.method==="bank"?p.bankId:null,money(p.amount),p.note||null,user(res)]);
      const row=pay.rows[0];
      await c.query("INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,payment_id) VALUES($1,$2,$3,$4,$5,$6)",[sid,p.partyId,p.direction==="payment"?money(p.amount):0,p.direction==="collection"?money(p.amount):0,p.direction,row.id]);
      if(p.method==="bank"){
        await c.query("INSERT INTO dukkan_bank_movements(store_id,bank_id,amount,type,note,payment_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",[sid,p.bankId,p.direction==="collection"?money(p.amount):-money(p.amount),p.direction,p.note||null,row.id,user(res)]);
      }
      return row;
    });res.status(201).json(result);
  }));
  app.post("/api/dukkan/stores/:storeId/instruments",safe(async(req,res)=>{
    accountant(res);
    const p=z.object({partyId:id,kind:z.enum(["cheque","promissory"]),direction:z.enum(["received","issued"]),number:string,amount,dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),note:z.string().max(500).optional()}).parse(req.body);
    const sid=store(req);
    const result=await transaction(async c=>{
      await exists(c,"dukkan_parties",sid,p.partyId);
      const r=await c.query("INSERT INTO dukkan_instruments(store_id,party_id,kind,direction,document_no,amount,due_date,note,issued_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[sid,p.partyId,p.kind,p.direction,p.number,money(p.amount),p.dueDate,p.note||null,p.date||null]);return r.rows[0];
    });res.status(201).json(result);
  }));
  app.patch("/api/dukkan/stores/:storeId/instruments/:instrumentId",safe(async(req,res)=>{
    accountant(res);
    const p=z.object({status:z.enum(["pending","settled","bounced","cancelled"])}).parse(req.body);
    const db=await ready();
    const r=await db.query("UPDATE dukkan_instruments SET status=$3 WHERE store_id=$1 AND id=$2 AND status='pending' RETURNING *",[store(req),id.parse(req.params.instrumentId),p.status]);
    if(!r.rowCount)return res.status(409).json({error:"Kayıt bulunamadı veya daha önce sonuçlandırıldı"});
    // Settlement marking tracks the document only; collection/payment is a separate posting.
    res.json(r.rows[0]);
  }));
  // Start the idempotent catalog import when the server boots. It must not
  // depend on a manager visiting Products before products become available.
  void ready().catch(error=>console.error("Dukkan catalog startup sync failed:",error));
}
