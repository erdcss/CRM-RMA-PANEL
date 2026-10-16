
import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "./db";

// Marketplace data is strictly separate from the original Çalışkan B2B catalogue.
// No unapproved supplier content is ever served from the public endpoints.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS mp_suppliers (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  tax_number TEXT NOT NULL,
  tax_office TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  company_type TEXT NOT NULL DEFAULT '',
  tax_document TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS mp_store_versions (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS mp_store_one_live ON mp_store_versions(supplier_id) WHERE is_live;
CREATE INDEX IF NOT EXISTS mp_store_pending ON mp_store_versions(status, created_at DESC);
CREATE TABLE IF NOT EXISTS mp_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, sku)
);
CREATE TABLE IF NOT EXISTS mp_product_versions (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES mp_products(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS mp_product_one_live ON mp_product_versions(product_id) WHERE is_live;
CREATE INDEX IF NOT EXISTS mp_product_pending ON mp_product_versions(status, created_at DESC);
CREATE TABLE IF NOT EXISTS mp_reels (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  product_id BIGINT REFERENCES mp_products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS mp_follows (
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,
  buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (supplier_id, buyer_user_id)
);
CREATE TABLE IF NOT EXISTS mp_conversations (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,
  buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, buyer_user_id)
);
CREATE TABLE IF NOT EXISTS mp_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES mp_conversations(id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mp_messages_conversation_idx ON mp_messages(conversation_id,id DESC);
CREATE TABLE IF NOT EXISTS mp_quote_requests (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES mp_conversations(id) ON DELETE CASCADE,
  buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE RESTRICT,
  product_id BIGINT REFERENCES mp_products(id) ON DELETE RESTRICT,
  boxes INTEGER NOT NULL CHECK (boxes > 0),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','offered','accepted','rejected','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mp_quote_offers (
  id BIGSERIAL PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES mp_quote_requests(id) ON DELETE CASCADE,
  amount_per_box NUMERIC(14,2) NOT NULL CHECK (amount_per_box > 0),
  currency TEXT NOT NULL DEFAULT 'TRY',
  delivery_terms TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mp_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

let schemaPromise: Promise<unknown> | undefined;
async function ready() {
  const db = pool;
  if (!db) throw new ApiError(503, "Pazaryeri veritabanı hazır değil");
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.query(SCHEMA);
      for (const sql of [
        "ALTER TABLE mp_suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE mp_suppliers ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE mp_suppliers ADD COLUMN IF NOT EXISTS tax_document TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE mp_suppliers ADD COLUMN IF NOT EXISTS iban TEXT NOT NULL DEFAULT ''",
      ]) await db.query(sql);
      // Previously supplier applications belonged to regular customer accounts.
      // Convert only actual marketplace supplier owners to the dedicated seller
      // role, preserving their current password and company information.
      await db.query(`UPDATE users SET role='b2b_seller', app_access='seller'
        WHERE role='b2b_customer'
          AND id IN (SELECT owner_user_id FROM mp_suppliers)`);
    })().catch(error => { schemaPromise = undefined; throw error; });
  }
  await schemaPromise;
  return db;
}
export async function ensureMarketplaceSchema() { await ready(); }
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
function handle(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req,res,next) => { Promise.resolve(fn(req,res)).catch((error) => {
    if (error instanceof ApiError) return res.status(error.status).json({ error:error.message });
    if (error instanceof z.ZodError) return res.status(400).json({error:"Geçersiz bilgiler",details:error.errors});
    console.error("Marketplace API:",error);
    res.status(500).json({error:"İşlem gerçekleştirilemedi"});
  }); };
}
const id = (s: unknown) => {
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) throw new ApiError(400,"Geçersiz kimlik");
  return n;
};
const slugify = (s:string) => s.toLocaleLowerCase("tr-TR")
  .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,58);
const bodyText = (n=200) => z.string().trim().min(1).max(n);
const mediaUrl=z.string().regex(/^\/api\/marketplace\/media\/[a-f0-9]{32}$/,"Medya uygulama içine yüklenmeli");
async function verifyMedia(db:NonNullable<typeof pool>,supplierId:number,url:string,video:boolean){
  const q=await db.query("SELECT mime FROM mp_media WHERE id=$1 AND supplier_id=$2",[url.split("/").pop(),supplierId]);
  if(!q.rows[0] || (video ? q.rows[0].mime!=="video/mp4" : !String(q.rows[0].mime).startsWith("image/"))){
    throw new ApiError(400,"Yüklenen medya bu tedarikçiye ait değil");
  }
}
const storeSchema = z.object({
  title: bodyText(120), tagline:z.string().trim().max(250).default(""),
  accent:z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FACC15"),
  bannerUrl:mediaUrl.optional().nullable(),
  logoUrl:mediaUrl.optional().nullable(),
  sections:z.array(z.enum(["banner","categories","products","reels","about"])).min(1).max(10),
}).strict();
const productSchema = z.object({
  name:bodyText(220), description:z.string().trim().max(4000).default(""),
  category:bodyText(120), brand:z.string().trim().max(120).default(""),
  barcode:z.string().trim().max(60).default(""),
  imageUrl:mediaUrl,
  price:z.number().finite().positive().max(100000000),
  unitsPerBox:z.number().int().min(1).max(100000),
  minBoxes:z.number().int().min(1).max(100000).default(1)
}).strict();
const applicationSchema=z.object({
  companyName:bodyText(220),taxNumber:z.string().trim().regex(/^[0-9]{10,11}$/),
  taxOffice:z.string().trim().max(140).default(""),
  contactName:bodyText(160),contactPhone:z.string().trim().min(10).max(25),
  contactEmail:z.string().trim().email().max(254),
  description:z.string().trim().max(1200).default("")
}).strict();
const decisionSchema=z.object({
  decision:z.enum(["approved","rejected"]),
  note:z.string().trim().max(1000).default("")
}).strict();
function userId(res:Response){return Number((res.locals as any).b2bUser.id);}
async function supplierFor(res:Response) {
  const db=await ready();
  const q=await db.query("SELECT id,owner_user_id,slug,company_name,tax_number,tax_office,contact_name,contact_phone,contact_email,company_type,iban,(tax_document <> '') AS has_tax_document,description,status,review_note,created_at,reviewed_at FROM mp_suppliers WHERE owner_user_id=$1 LIMIT 1",[userId(res)]);
  if (!q.rows[0]) throw new ApiError(403,"Önce tedarikçi başvurusu oluşturun");
  if (q.rows[0].status!=="approved") throw new ApiError(403,"Tedarikçi hesabınız henüz onaylanmadı");
  return q.rows[0];
}
function sellerAdminAllowed(row:any) {
  if(row.status!=="approved") throw new ApiError(409,"Tedarikçi onaylı değil");
}
async function log(actor:number,action:string,entity:number,notes="") {
  const db=await ready();
  await db.query("INSERT INTO mp_audit_log(actor_user_id,action,entity_id,notes) VALUES($1,$2,$3,$4)",[actor,action,entity,notes]);
}
async function ownConversation(db:NonNullable<typeof pool>,conversationId:number,customerId:number) {
  const result=await db.query("SELECT c.*, s.owner_user_id FROM mp_conversations c JOIN mp_suppliers s ON s.id=c.supplier_id WHERE c.id=$1 AND (c.buyer_user_id=$2 OR s.owner_user_id=$2) LIMIT 1",[conversationId,customerId]);
  if(!result.rows[0])throw new ApiError(404,"Görüşme bulunamadı");
  return result.rows[0];
}
export function registerMarketplaceRoutes(
 app:Express, requireAdmin:RequestHandler, requireB2B:RequestHandler,
 sessionUserId:(req:Request)=>number|undefined, requireSeller:RequestHandler, requireParticipant:RequestHandler
) {
  app.get("/api/marketplace/stores", handle(async(req,res)=>{
    const db=await ready();
    const q=await db.query(`SELECT s.id,s.slug,s.company_name,s.description,v.content,
      (SELECT COUNT(*)::int FROM mp_follows f WHERE f.supplier_id=s.id) AS followers
      FROM mp_suppliers s JOIN mp_store_versions v ON v.supplier_id=s.id AND v.is_live=TRUE
      WHERE s.status='approved' ORDER BY s.id DESC LIMIT 100`);
    res.json(q.rows);
  }));
  app.get("/api/marketplace/stores/:slug",handle(async(req,res)=>{
    const db=await ready();
    const q=await db.query(`SELECT s.id,s.slug,s.company_name,s.description,v.content,
      (SELECT COUNT(*)::int FROM mp_follows f WHERE f.supplier_id=s.id) AS followers
      FROM mp_suppliers s JOIN mp_store_versions v ON v.supplier_id=s.id AND v.is_live=TRUE
      WHERE s.status='approved' AND s.slug=$1 LIMIT 1`,[req.params.slug]);
    if(!q.rows[0])throw new ApiError(404,"Mağaza bulunamadı");
    res.json(q.rows[0]);
  }));
  app.get("/api/marketplace/stores/:slug/products",handle(async(req,res)=>{
    const db=await ready();
    const priceVisible=Boolean(sessionUserId(req)); // further limited to active B2B customers below
    let canSeePrice=false;
    if(priceVisible){
      const u=await db.query("SELECT role,is_active FROM users WHERE id=$1",[sessionUserId(req)]);
      canSeePrice=u.rows[0]?.role==="b2b_customer" && Number(u.rows[0]?.is_active)===1;
    }
    const q=await db.query(`SELECT p.id,p.sku,p.stock,v.content,s.slug
      FROM mp_products p JOIN mp_suppliers s ON s.id=p.supplier_id
      JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
      JOIN mp_store_versions sv ON sv.supplier_id=s.id AND sv.is_live=TRUE
      WHERE s.slug=$1 AND s.status='approved' AND p.is_enabled=TRUE ORDER BY p.id DESC LIMIT 200`,[req.params.slug]);
    res.setHeader("Cache-Control","private, no-store");
    res.json(q.rows.map((r:any)=>({...r,content:canSeePrice?r.content:{...r.content,price:null}})));
  }));
  app.get("/api/marketplace/stores/:slug/reels",handle(async(req,res)=>{
    const db=await ready();
    const q=await db.query(`SELECT r.id,r.title,r.video_url,r.product_id,r.created_at FROM mp_reels r
      JOIN mp_suppliers s ON s.id=r.supplier_id JOIN mp_store_versions v ON v.supplier_id=s.id AND v.is_live
      WHERE s.slug=$1 AND s.status='approved' AND r.is_live=TRUE ORDER BY r.id DESC LIMIT 50`,[req.params.slug]);
    res.json(q.rows);
  }));
  app.get("/api/marketplace/me",requireSeller,handle(async(_req,res)=>{
    const db=await ready();
    const r=await db.query("SELECT id,owner_user_id,slug,company_name,tax_number,tax_office,contact_name,contact_phone,contact_email,company_type,iban,(tax_document <> '') AS has_tax_document,description,status,review_note,created_at,reviewed_at FROM mp_suppliers WHERE owner_user_id=$1",[userId(res)]);
    res.setHeader("Cache-Control","private, no-store");
    res.json(r.rows[0]||null);
  }));
  app.post("/api/marketplace/apply",requireSeller,handle(async(req,res)=>{
    const data=applicationSchema.parse(req.body);
    const db=await ready();
    const uid=userId(res);
    const check=await db.query("SELECT id FROM mp_suppliers WHERE owner_user_id=$1",[uid]);
    if(check.rows.length)throw new ApiError(409,"Başvuru zaten mevcut");
    const slug=slugify(data.companyName)+"-"+uid;
    const r=await db.query(`INSERT INTO mp_suppliers
      (owner_user_id,slug,company_name,tax_number,tax_office,contact_name,contact_phone,description,contact_email)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,slug,status`,
      [uid,slug,data.companyName,data.taxNumber,data.taxOffice,data.contactName,data.contactPhone,data.description,data.contactEmail]);
    res.status(201).json(r.rows[0]);
  }));
  app.patch("/api/marketplace/apply",requireSeller,handle(async(req,res)=>{
    const data=applicationSchema.parse(req.body);
    const db=await ready();
    const q=await db.query(`UPDATE mp_suppliers SET
      company_name=$1,tax_number=$2,tax_office=$3,contact_name=$4,
      contact_phone=$5,description=$6,contact_email=$8,status='pending',review_note='',reviewed_at=NULL
      WHERE owner_user_id=$7 AND status='rejected' RETURNING id,slug,status`,
      [data.companyName,data.taxNumber,data.taxOffice,data.contactName,data.contactPhone,data.description,userId(res),data.contactEmail]);
    if(!q.rows[0])throw new ApiError(409,"Yalnızca reddedilen başvurular düzeltilerek yeniden gönderilebilir");
    res.json(q.rows[0]);
  }));
  app.post("/api/marketplace/seller/verification",requireSeller,handle(async(req,res)=>{
    const input=z.object({
      companyType:z.enum(["sahis","limited","anonim","kooperatif","diger"]),
      iban:z.string().trim().toUpperCase().regex(/^TR[0-9]{24}$/),
      taxDocument:z.string().startsWith("data:application/pdf;base64,").max(7_000_000),
    }).strict().parse(req.body);
    const pdfMatch=/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(input.taxDocument);
    if(!pdfMatch)throw new ApiError(400,"Geçerli bir PDF vergi levhası yükleyin");
    const pdf=Buffer.from(pdfMatch[1],"base64");
    if(pdf.length<16 || pdf.length>5_000_000 || pdf.subarray(0,5).toString("utf8")!=="%PDF-")throw new ApiError(400,"Vergi levhası geçerli bir PDF olmalı ve 5 MB'ı geçmemeli");
    const ibanDigits=input.iban.slice(4)+"2927"+input.iban.slice(2,4);
    if(BigInt(ibanDigits)%97n!==1n)throw new ApiError(400,"IBAN kontrol basamakları geçersiz");
    const db=await ready();
    const supplier=await db.query("SELECT id,status FROM mp_suppliers WHERE owner_user_id=$1",[userId(res)]);
    if(!supplier.rows[0]) throw new ApiError(404,"Önce satıcı kaydınızı oluşturun");
    if(supplier.rows[0].status==="approved") throw new ApiError(409,"Hesabınız zaten onaylı");
    await db.query("UPDATE mp_suppliers SET company_type=$1,iban=$2,tax_document=$3,status='pending',review_note='' WHERE id=$4",[input.companyType,input.iban,input.taxDocument,supplier.rows[0].id]);
    res.json({message:"Doğrulama bilgileriniz yönetici incelemesine gönderildi."});
  }));
  app.get("/api/marketplace/seller/dashboard",requireSeller,handle(async(_req,res)=>{
    const s=await supplierFor(res);const db=await ready();
    const [products,stores,reels,followers,conversations,quotes]=await Promise.all([
      db.query("SELECT COUNT(*)::int AS n FROM mp_products WHERE supplier_id=$1",[s.id]),
      db.query("SELECT id,status,is_live,created_at,review_note FROM mp_store_versions WHERE supplier_id=$1 ORDER BY id DESC LIMIT 10",[s.id]),
      db.query("SELECT id,title,status,is_live,review_note FROM mp_reels WHERE supplier_id=$1 ORDER BY id DESC LIMIT 30",[s.id]),
      db.query("SELECT COUNT(*)::int AS n FROM mp_follows WHERE supplier_id=$1",[s.id]),
      db.query("SELECT COUNT(*)::int AS n FROM mp_conversations WHERE supplier_id=$1",[s.id]),
      db.query("SELECT COUNT(*)::int AS n FROM mp_quote_requests WHERE supplier_id=$1 AND status IN ('requested','offered')",[s.id])
    ]);
    res.json({supplier:s,productCount:products.rows[0]?.n,storeVersions:stores.rows,reels:reels.rows,
      followers:followers.rows[0]?.n,conversations:conversations.rows[0]?.n,openQuotes:quotes.rows[0]?.n});
  }));
  app.post("/api/marketplace/seller/store",requireSeller,handle(async(req,res)=>{
    const s=await supplierFor(res),db=await ready();
    const content=storeSchema.parse(req.body);
    for(const url of [content.bannerUrl,content.logoUrl])if(url)await verifyMedia(db,Number(s.id),url,false);
    const r=await db.query("INSERT INTO mp_store_versions(supplier_id,content) VALUES($1,$2) RETURNING id,status,created_at",[s.id,JSON.stringify(content)]);
    res.status(201).json(r.rows[0]);
  }));
  app.get("/api/marketplace/seller/products",requireSeller,handle(async(_req,res)=>{
    const s=await supplierFor(res),db=await ready();
    const r=await db.query(`SELECT p.id,p.sku,p.stock,p.is_enabled,
      (SELECT json_build_object('id',v.id,'content',v.content,'status',v.status,'review_note',v.review_note,'created_at',v.created_at)
       FROM mp_product_versions v WHERE v.product_id=p.id ORDER BY v.id DESC LIMIT 1) AS latest,
      (SELECT v.content FROM mp_product_versions v WHERE v.product_id=p.id AND v.is_live LIMIT 1) AS live
      FROM mp_products p WHERE p.supplier_id=$1 ORDER BY p.id DESC LIMIT 200`,[s.id]);
    res.json(r.rows);
  }));
  app.post("/api/marketplace/seller/products",requireSeller,handle(async(req,res)=>{
    const s=await supplierFor(res),db=await ready();
    const data=z.object({sku:bodyText(90),stock:z.number().int().min(0).max(100000000),product:productSchema}).strict().parse(req.body);
    await verifyMedia(db,Number(s.id),data.product.imageUrl,false);
    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const p=await client.query(`INSERT INTO mp_products(supplier_id,sku,stock) VALUES($1,$2,$3)
        ON CONFLICT(supplier_id,sku) DO UPDATE SET stock=EXCLUDED.stock RETURNING id`,[s.id,data.sku,data.stock]);
      const v=await client.query("INSERT INTO mp_product_versions(product_id,content) VALUES($1,$2) RETURNING id,status",[p.rows[0].id,JSON.stringify(data.product)]);
      await client.query("COMMIT");res.status(201).json({productId:p.rows[0].id,revision:v.rows[0]});
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
  app.post("/api/marketplace/seller/reels",requireSeller,handle(async(req,res)=>{
    const s=await supplierFor(res),db=await ready();
    const data=z.object({title:bodyText(160),videoUrl:mediaUrl,
      productId:z.number().int().positive().nullable().optional()}).strict().parse(req.body);
    await verifyMedia(db,Number(s.id),data.videoUrl,true);
    if(data.productId){
      const own=await db.query("SELECT id FROM mp_products WHERE id=$1 AND supplier_id=$2",[data.productId,s.id]);
      if(!own.rows.length)throw new ApiError(403,"Ürün bu mağazaya ait değil");
    }
    const r=await db.query("INSERT INTO mp_reels(supplier_id,title,video_url,product_id) VALUES($1,$2,$3,$4) RETURNING id,status",
      [s.id,data.title,data.videoUrl,data.productId||null]);
    res.status(201).json(r.rows[0]);
  }));
  app.get("/api/marketplace/follows",requireB2B,handle(async(_req,res)=>{
    const db=await ready();
    const q=await db.query(`SELECT s.slug,s.company_name,f.created_at FROM mp_follows f
      JOIN mp_suppliers s ON s.id=f.supplier_id WHERE f.buyer_user_id=$1 ORDER BY f.created_at DESC`,[userId(res)]);
    res.json(q.rows);
  }));
  app.post("/api/marketplace/stores/:slug/follow",requireB2B,handle(async(req,res)=>{
    const db=await ready();
    const q=await db.query(`INSERT INTO mp_follows(supplier_id,buyer_user_id)
      SELECT s.id,$1 FROM mp_suppliers s JOIN mp_store_versions v ON v.supplier_id=s.id AND v.is_live
      WHERE s.slug=$2 AND s.status='approved' ON CONFLICT DO NOTHING RETURNING supplier_id`,[userId(res),req.params.slug]);
    res.json({following:Boolean(q.rows.length)});
  }));
  app.delete("/api/marketplace/stores/:slug/follow",requireB2B,handle(async(req,res)=>{
    const db=await ready();
    await db.query("DELETE FROM mp_follows WHERE buyer_user_id=$1 AND supplier_id IN (SELECT id FROM mp_suppliers WHERE slug=$2)",[userId(res),req.params.slug]);
    res.json({following:false});
  }));
  // Buyers alone can open a conversation, and the FIRST message is created with it.
  app.post("/api/marketplace/conversations",requireB2B,handle(async(req,res)=>{
    const data=z.object({slug:bodyText(100),text:bodyText(4000)}).strict().parse(req.body);
    const db=await ready(),uid=userId(res),client=await db.connect();
    try{
      await client.query("BEGIN");
      const seller=await client.query(`SELECT s.id,s.owner_user_id FROM mp_suppliers s
        JOIN mp_store_versions v ON v.supplier_id=s.id AND v.is_live
        WHERE s.slug=$1 AND s.status='approved' FOR UPDATE OF s`,[data.slug]);
      if(!seller.rows[0])throw new ApiError(404,"Mağaza bulunamadı");
      if(Number(seller.rows[0].owner_user_id)===uid)throw new ApiError(400,"Kendi mağazanızla sohbet oluşturamazsınız");
      const c=await client.query(`INSERT INTO mp_conversations(supplier_id,buyer_user_id)
        VALUES($1,$2) ON CONFLICT(supplier_id,buyer_user_id)
        DO UPDATE SET buyer_user_id=EXCLUDED.buyer_user_id RETURNING id`,[seller.rows[0].id,uid]);
      await client.query("INSERT INTO mp_messages(conversation_id,author_user_id,text) VALUES($1,$2,$3)",[c.rows[0].id,uid,data.text]);
      await client.query("COMMIT");res.status(201).json({id:c.rows[0].id});
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
  app.get("/api/marketplace/conversations",requireParticipant,handle(async(_req,res)=>{
    const db=await ready(),uid=userId(res);
    const r=await db.query(`SELECT c.id,c.supplier_id,c.buyer_user_id,c.created_at,s.company_name,s.slug,
      (SELECT text FROM mp_messages m WHERE m.conversation_id=c.id ORDER BY id DESC LIMIT 1) AS latest_message
      FROM mp_conversations c JOIN mp_suppliers s ON s.id=c.supplier_id
      WHERE c.buyer_user_id=$1 OR s.owner_user_id=$1 ORDER BY c.id DESC LIMIT 100`,[uid]);
    res.json(r.rows);
  }));
  app.get("/api/marketplace/conversations/:id/messages",requireParticipant,handle(async(req,res)=>{
    const db=await ready(),cid=id(req.params.id),uid=userId(res);
    await ownConversation(db,cid,uid);
    const q=await db.query("SELECT id,author_user_id,text,created_at FROM mp_messages WHERE conversation_id=$1 ORDER BY id ASC LIMIT 200",[cid]);
    res.json(q.rows);
  }));
  app.post("/api/marketplace/conversations/:id/messages",requireParticipant,handle(async(req,res)=>{
    const db=await ready(),cid=id(req.params.id),uid=userId(res);
    const text=z.object({text:bodyText(4000)}).strict().parse(req.body).text;
    await ownConversation(db,cid,uid);
    const q=await db.query("INSERT INTO mp_messages(conversation_id,author_user_id,text) VALUES($1,$2,$3) RETURNING *",[cid,uid,text]);
    res.status(201).json(q.rows[0]);
  }));
  app.get("/api/marketplace/quotes",requireParticipant,handle(async(_req,res)=>{
    const db=await ready(),uid=userId(res);
    const q=await db.query(`SELECT q.*,s.company_name,p.sku,
      (SELECT json_build_object('amount_per_box',o.amount_per_box,'delivery_terms',o.delivery_terms,'expires_at',o.expires_at)
       FROM mp_quote_offers o WHERE o.quote_id=q.id ORDER BY o.id DESC LIMIT 1) AS latest_offer
      FROM mp_quote_requests q JOIN mp_suppliers s ON s.id=q.supplier_id
      LEFT JOIN mp_products p ON p.id=q.product_id
      WHERE q.buyer_user_id=$1 OR s.owner_user_id=$1 ORDER BY q.id DESC LIMIT 100`,[uid]);
    res.json(q.rows);
  }));
  app.post("/api/marketplace/quotes",requireParticipant,handle(async(req,res)=>{
    const db=await ready(),uid=userId(res);
    const data=z.object({conversationId:z.number().int().positive(),productId:z.number().int().positive().optional().nullable(),
      boxes:z.number().int().min(1).max(100000),details:z.string().max(2000).default("")}).strict().parse(req.body);
    const c=await ownConversation(db,data.conversationId,uid);
    if(Number(c.buyer_user_id)!==uid)throw new ApiError(403,"Teklif talebini müşteri oluşturur");
    if(data.productId) {
      const p=await db.query("SELECT id FROM mp_products WHERE id=$1 AND supplier_id=$2",[data.productId,c.supplier_id]);
      if(!p.rows.length)throw new ApiError(400,"Ürün mağazaya ait değil");
    }
    const q=await db.query(`INSERT INTO mp_quote_requests(conversation_id,buyer_user_id,supplier_id,product_id,boxes,details)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[c.id,uid,c.supplier_id,data.productId||null,data.boxes,data.details]);
    res.status(201).json(q.rows[0]);
  }));
  app.post("/api/marketplace/quotes/:id/offer",requireSeller,handle(async(req,res)=>{
    const db=await ready(),uid=userId(res),quoteId=id(req.params.id);
    const data=z.object({amountPerBox:z.number().finite().positive(),deliveryTerms:z.string().trim().max(500).default(""),
      validHours:z.number().int().min(1).max(720)}).strict().parse(req.body);
    const client=await db.connect();
    try{
      await client.query("BEGIN");
      const q=await client.query(`SELECT q.*,s.owner_user_id,s.status AS supplier_status FROM mp_quote_requests q
        JOIN mp_suppliers s ON s.id=q.supplier_id WHERE q.id=$1 FOR UPDATE OF q`,[quoteId]);
      if(!q.rows[0]||Number(q.rows[0].owner_user_id)!==uid)throw new ApiError(403,"Bu teklife erişim yok");
      if(q.rows[0].supplier_status!=="approved"||!["requested","offered"].includes(q.rows[0].status))throw new ApiError(409,"Teklif yanıtlanamaz");
      const offer=await client.query(`INSERT INTO mp_quote_offers(quote_id,amount_per_box,delivery_terms,expires_at)
        VALUES($1,$2,$3,NOW()+($4::int * INTERVAL '1 hour')) RETURNING *`,[quoteId,data.amountPerBox.toFixed(2),data.deliveryTerms,data.validHours]);
      await client.query("UPDATE mp_quote_requests SET status='offered' WHERE id=$1",[quoteId]);
      await client.query("COMMIT");res.status(201).json(offer.rows[0]);
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
  app.post("/api/marketplace/quotes/:id/decision",requireB2B,handle(async(req,res)=>{
    const db=await ready(),uid=userId(res),quoteId=id(req.params.id);
    const data=z.object({decision:z.enum(["accepted","rejected"])}).strict().parse(req.body);
    const client=await db.connect();
    try{
      await client.query("BEGIN");
      const q=await client.query(`SELECT q.*,o.expires_at FROM mp_quote_requests q
        LEFT JOIN LATERAL (SELECT expires_at FROM mp_quote_offers WHERE quote_id=q.id ORDER BY id DESC LIMIT 1) o ON true
        WHERE q.id=$1 FOR UPDATE OF q`,[quoteId]);
      if(!q.rows[0]||Number(q.rows[0].buyer_user_id)!==uid)throw new ApiError(403,"Bu teklif size ait değil");
      if(q.rows[0].status!=="offered"||!q.rows[0].expires_at||new Date(q.rows[0].expires_at)<new Date())throw new ApiError(409,"Geçerli teklif bulunamadı");
      await client.query("UPDATE mp_quote_requests SET status=$1 WHERE id=$2",[data.decision,quoteId]);
      await client.query("COMMIT");res.json({status:data.decision,checkoutEnabled:false,message:"Teklif kararı kaydedildi. Pazaryeri ödeme entegrasyonu tamamlanana dek ödeme açılmayacak."});
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
  // The admin role is enforced by the existing server authentication middleware.
  app.get("/api/admin/marketplace/overview",requireAdmin,handle(async(_req,res)=>{
    const db=await ready();
    const queries=await Promise.all([
      db.query("SELECT status,COUNT(*)::int AS total FROM mp_suppliers GROUP BY status"),
      db.query("SELECT status,COUNT(*)::int AS total FROM mp_product_versions GROUP BY status"),
      db.query("SELECT status,COUNT(*)::int AS total FROM mp_store_versions GROUP BY status"),
      db.query("SELECT status,COUNT(*)::int AS total FROM mp_reels GROUP BY status"),
      db.query("SELECT COUNT(*)::int AS total FROM mp_conversations"),
      db.query("SELECT COUNT(*)::int AS total FROM mp_quote_requests")
    ]);
    res.json({suppliers:queries[0].rows,products:queries[1].rows,stores:queries[2].rows,
      reels:queries[3].rows,conversations:queries[4].rows[0]?.total,quotes:queries[5].rows[0]?.total,
      commissionPercent:3,warehouseControlExtraPercent:3,liveSupplierCheckout:false});
  }));
  app.get("/api/admin/marketplace/review-queue",requireAdmin,handle(async(_req,res)=>{
    const db=await ready();
    const [suppliers,products,stores,reels]=await Promise.all([
      db.query("SELECT id,company_name,tax_number,tax_office,contact_name,contact_phone,contact_email,company_type,iban,(tax_document <> '') AS has_tax_document,description,created_at,status,review_note FROM mp_suppliers ORDER BY id DESC LIMIT 100"),
      db.query(`SELECT v.id,v.product_id,v.content,v.created_at,v.status,v.review_note,s.company_name FROM mp_product_versions v
        JOIN mp_products p ON p.id=v.product_id JOIN mp_suppliers s ON s.id=p.supplier_id
        ORDER BY v.id DESC LIMIT 100`),
      db.query(`SELECT v.id,v.content,v.created_at,v.status,v.is_live,v.review_note,s.company_name FROM mp_store_versions v
        JOIN mp_suppliers s ON s.id=v.supplier_id ORDER BY v.id DESC LIMIT 100`),
      db.query(`SELECT r.id,r.title,r.video_url,r.status,r.is_live,r.review_note,r.created_at,s.company_name
        FROM mp_reels r JOIN mp_suppliers s ON s.id=r.supplier_id ORDER BY r.id DESC LIMIT 100`)
    ]);
    res.json({suppliers:suppliers.rows,products:products.rows,stores:stores.rows,reels:reels.rows});
  }));
  app.get("/api/admin/marketplace/suppliers/:id/tax-document",requireAdmin,handle(async(req,res)=>{
    const db=await ready(),supplierId=id(req.params.id);
    const result=await db.query("SELECT tax_document FROM mp_suppliers WHERE id=$1",[supplierId]);
    if(!result.rows[0]?.tax_document) throw new ApiError(404,"Vergi levhası bulunamadı");
    const matched=/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(result.rows[0].tax_document);
    if(!matched) throw new ApiError(422,"Geçersiz belge");
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",'inline; filename="vergi-levhasi.pdf"');
    res.setHeader("Cache-Control","no-store");
    res.send(Buffer.from(matched[1],"base64"));
  }));
  app.post("/api/admin/marketplace/suppliers/:id/decision",requireAdmin,handle(async(req,res)=>{
    const db=await ready(),supplierId=id(req.params.id);
    const data=decisionSchema.parse(req.body),actor=sessionUserId(req);
    if(!actor)throw new ApiError(401,"Giriş yapın");
    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const r=await client.query(`UPDATE mp_suppliers SET status=$1,review_note=$2,reviewed_at=NOW()
        WHERE id=$3 AND status='pending' AND ($1 <> 'approved' OR (company_type <> '' AND tax_document <> '' AND iban <> '')) RETURNING id,status`,
        [data.decision,data.note,supplierId]);
      if(!r.rows[0])throw new ApiError(409,"Başvuru bulunamadı, zaten değerlendirilmiş veya şirket doğrulama evrakları eksik");
      await client.query("INSERT INTO mp_audit_log(actor_user_id,action,entity_id,notes) VALUES($1,$2,$3,$4)",
        [actor,"supplier_"+data.decision,supplierId,data.note]);
      await client.query("COMMIT");
      res.json(r.rows[0]);
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
  app.post("/api/admin/marketplace/reviews/:kind/:id/decision",requireAdmin,handle(async(req,res)=>{
    const db=await ready(),reviewId=id(req.params.id),data=decisionSchema.parse(req.body);
    const kind=req.params.kind;const actor=sessionUserId(req);
    if(!actor)throw new ApiError(401,"Giriş yapın");
    if(!["product","store","reel"].includes(kind))throw new ApiError(400,"İnceleme türü geçersiz");
    const table=kind==="product"?"mp_product_versions":kind==="store"?"mp_store_versions":"mp_reels";
    const ownerQuery=kind==="product"?
      "SELECT s.status FROM mp_product_versions v JOIN mp_products p ON p.id=v.product_id JOIN mp_suppliers s ON s.id=p.supplier_id WHERE v.id=$1":
      "SELECT s.status FROM "+table+" v JOIN mp_suppliers s ON s.id=v.supplier_id WHERE v.id=$1";
    const client=await db.connect();
    try{
      await client.query("BEGIN");
      const r=await client.query("SELECT * FROM "+table+" WHERE id=$1 FOR UPDATE",[reviewId]);
      if(!r.rows[0]||r.rows[0].status!=="pending")throw new ApiError(409,"İçerik zaten değerlendirilmiş");
      const own=await client.query(ownerQuery,[reviewId]);
      if(!own.rows[0]||own.rows[0].status!=="approved")throw new ApiError(409,"Önce tedarikçi onaylanmalı");
      if(data.decision==="approved" && kind==="reel" && r.rows[0].product_id) {
        const linked=await client.query(`SELECT p.id FROM mp_products p
          JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
          WHERE p.id=$1 AND p.supplier_id=$2 AND p.is_enabled=TRUE`,
          [r.rows[0].product_id,r.rows[0].supplier_id]);
        if(!linked.rows.length)throw new ApiError(409,"Videoda etiketlenen ürün henüz onaylanmadı");
      }
      if(data.decision==="approved") {
        const field=kind==="product"?"product_id":"supplier_id";
        if(kind==="reel"){
          await client.query("UPDATE mp_reels SET is_live=TRUE WHERE id=$1",[reviewId]);
        }else{
          await client.query("UPDATE "+table+" SET is_live=FALSE WHERE "+field+"=$1",[r.rows[0][field]]);
          await client.query("UPDATE "+table+" SET is_live=TRUE WHERE id=$1",[reviewId]);
        }
      }
      await client.query("UPDATE "+table+" SET status=$1,review_note=$2,reviewed_at=NOW() WHERE id=$3",[data.decision,data.note,reviewId]);
      await client.query("INSERT INTO mp_audit_log(actor_user_id,action,entity_id,notes) VALUES($1,$2,$3,$4)",
        [actor,kind+"_"+data.decision,reviewId,data.note]);
      await client.query("COMMIT");res.json({id:reviewId,status:data.decision});
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }));
}
