import type { Express, Request, RequestHandler, Response, NextFunction } from "express";
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
const twoDecimals=(n:number)=>Math.abs(n*100-Math.round(n*100))<0.00001;
const threeDecimals=(n:number)=>Math.abs(n*1000-Math.round(n*1000))<0.00001;
const amount = z.coerce.number().finite().min(0.01).max(999999999999).refine(twoDecimals,"Tutar en fazla iki ondalık basamak içerebilir");
const qty = z.coerce.number().finite().positive().max(999999999).refine(threeDecimals,"Miktar en fazla üç ondalık basamak içerebilir");
const string = z.string().trim().min(1).max(200);
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lineSchema = z.object({ productId: id, quantity: qty, unitPrice: z.coerce.number().finite().min(0).max(999999999).refine(twoDecimals), taxRate: z.coerce.number().min(0).max(100).default(20) });
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
function accountant(res: Response) { if (!["owner","manager","accountant"].includes(res.locals.dukkanRole)) deny("Muhasebe yetkisi gerekiyor"); }
function manager(res: Response) { if (!["owner","manager"].includes(res.locals.dukkanRole)) deny("Mağaza yönetim yetkisi gerekiyor"); }
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
    parties:"SELECT p.*,COALESCE(SUM(e.debit-e.credit),0) AS balance FROM dukkan_parties p LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id WHERE p.store_id=$1 GROUP BY p.id ORDER BY p.id DESC LIMIT 500",
    products:"SELECT * FROM dukkan_products WHERE store_id=$1 ORDER BY id DESC LIMIT 500",
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
    const sql=cashier&&resource==="invoices"?query.replace("ORDER BY i.id DESC","AND i.kind IN (\'sale\',\'sale_return\') ORDER BY i.id DESC"):query;
    const r=await db.query(sql,[store(req)]);
    const rows=cashier&&resource==="products"?r.rows.map(({purchase_price,...rest})=>rest):cashier&&resource==="parties"?r.rows.map(({balance,...rest})=>rest):r.rows;
    res.json(rows);
  }));
  app.get("/api/dukkan/stores/:storeId/report",safe(async(req,res)=>{
    if(res.locals.dukkanRole==="cashier")deny("Rapor yetkisi gerekiyor");
    const db=await ready();const sid=store(req);
    const [sales,purchases,stock,receivables,banks,overdue]=await Promise.all([
      db.query("SELECT COALESCE(SUM(CASE WHEN kind='sale' THEN grand_total WHEN kind='sale_return' THEN -grand_total ELSE 0 END),0) AS total FROM dukkan_invoices WHERE store_id=$1",[sid]),
      db.query("SELECT COALESCE(SUM(CASE WHEN kind='purchase' THEN grand_total WHEN kind='purchase_return' THEN -grand_total ELSE 0 END),0) AS total FROM dukkan_invoices WHERE store_id=$1",[sid]),
      db.query("SELECT COUNT(*)::int AS product_count,COALESCE(SUM(stock*purchase_price),0) AS stock_cost FROM dukkan_products WHERE store_id=$1",[sid]),
      db.query("SELECT COALESCE(SUM(debit-credit),0) AS net_balance FROM dukkan_cari_entries WHERE store_id=$1",[sid]),
      db.query("SELECT COALESCE(SUM(amount),0) AS bank_balance FROM dukkan_bank_movements WHERE store_id=$1",[sid]),
      db.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(amount),0) AS amount FROM dukkan_instruments WHERE store_id=$1 AND status='pending' AND due_date<CURRENT_DATE",[sid])
    ]);
    res.json({sales:sales.rows[0].total,purchases:purchases.rows[0].total,stock:stock.rows[0],netBalance:receivables.rows[0].net_balance,bankBalance:banks.rows[0].bank_balance,overdue:overdue.rows[0]});
  }));

  app.post("/api/dukkan/stores/:storeId/parties",safe(async(req,res)=>{
    const p=z.object({name:string,type:z.enum(["customer","supplier","both"]),taxNumber:z.string().max(30).optional(),phone:z.string().max(40).optional(),email:z.string().max(200).optional()}).parse(req.body);
    const db=await ready();const r=await db.query("INSERT INTO dukkan_parties(store_id,name,type,tax_number,phone,email) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[store(req),p.name,p.type,p.taxNumber||null,p.phone||null,p.email||null]);res.status(201).json(r.rows[0]);
  }));
  app.post("/api/dukkan/stores/:storeId/products",safe(async(req,res)=>{
    manager(res);
    const p=z.object({name:string,sku:string,barcode:z.string().trim().max(64).optional(),unit:z.string().max(20).default("adet"),purchasePrice:z.coerce.number().min(0).default(0),salePrice:z.coerce.number().min(0).default(0)}).parse(req.body);
    const db=await ready();const r=await db.query("INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,purchase_price,sale_price) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[store(req),p.name,p.sku,p.barcode||null,p.unit,money(p.purchasePrice),money(p.salePrice)]);res.status(201).json(r.rows[0]);
  }));
  app.post("/api/dukkan/stores/:storeId/stock-movements",safe(async(req,res)=>{
    manager(res);
    const p=z.object({productId:id,delta:z.coerce.number().finite().refine(v=>v!==0&&threeDecimals(v)),note:z.string().max(500).optional()}).parse(req.body);
    const sid=store(req);
    const r=await transaction(async c=>{
      const updated=await c.query("UPDATE dukkan_products SET stock=stock+$3 WHERE store_id=$1 AND id=$2 AND stock+$3>=0 RETURNING stock",[sid,p.productId,p.delta]);
      if(!updated.rowCount) throw Object.assign(new Error("Ürün bulunamadı veya stok eksiye düşüyor"),{status:409});
      const created=await c.query("INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,note,created_by) VALUES($1,$2,$3,'adjustment',$4,$5) RETURNING *",[sid,p.productId,p.delta,p.note||null,user(res)]);
      return {...created.rows[0],stock:updated.rows[0].stock};
    });
    res.status(201).json(r);
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
      const inserted=await c.query("INSERT INTO dukkan_invoices(store_id,party_id,kind,invoice_no,issued_at,subtotal,tax_total,grand_total,request_key,created_by) VALUES($1,$2,$3,$4,COALESCE($5::date,CURRENT_DATE),$6,$7,$8,$9,$10) RETURNING *",[sid,p.partyId,p.kind,p.number,p.date||null,subtotal,taxTotal,grandTotal,p.requestKey,user(res)]);
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
      await c.query("INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,invoice_id) VALUES($1,$2,$3,$4,$5,$6)",[sid,p.partyId,debit,credit,p.kind+" "+p.number,doc.id]);
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
    const p=z.object({partyId:id,kind:z.enum(["cheque","promissory"]),direction:z.enum(["received","issued"]),number:string,amount,dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),note:z.string().max(500).optional()}).parse(req.body);
    const sid=store(req);
    const result=await transaction(async c=>{
      await exists(c,"dukkan_parties",sid,p.partyId);
      const r=await c.query("INSERT INTO dukkan_instruments(store_id,party_id,kind,direction,document_no,amount,due_date,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[sid,p.partyId,p.kind,p.direction,p.number,money(p.amount),p.dueDate,p.note||null]);return r.rows[0];
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
}
