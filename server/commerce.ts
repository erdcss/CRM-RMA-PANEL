import type { Express } from "express";
import crypto from "crypto";
import { q, requireAdmin } from "./auth";

export async function ensureCommerceSchema(){
 await q(`
 CREATE TABLE IF NOT EXISTS b2b_products(
  id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, brand TEXT, category TEXT,
  description TEXT, price NUMERIC(12,2) NOT NULL DEFAULT 0, vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  stock INTEGER NOT NULL DEFAULT 0, min_order_qty INTEGER NOT NULL DEFAULT 1, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_data TEXT, features JSONB NOT NULL DEFAULT '[]'::jsonb, variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  units_per_box INTEGER NOT NULL DEFAULT 1, seller TEXT, collection_name TEXT, tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS image_data TEXT;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS units_per_box INTEGER NOT NULL DEFAULT 1;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS seller TEXT;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS collection_name TEXT;
 ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
 CREATE TABLE IF NOT EXISTS b2b_orders(
  id TEXT PRIMARY KEY, order_no TEXT NOT NULL UNIQUE, customer_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment', payment_status TEXT NOT NULL DEFAULT 'unpaid',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, vat_total NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS b2b_order_items(
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES b2b_products(id) ON DELETE SET NULL, sku TEXT NOT NULL, name TEXT NOT NULL,
  quantity INTEGER NOT NULL, unit_price NUMERIC(12,2) NOT NULL, vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20, line_total NUMERIC(12,2) NOT NULL
 );
 CREATE TABLE IF NOT EXISTS b2b_returns(
  id TEXT PRIMARY KEY, return_no TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested',
  note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS b2b_payments(
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE, provider TEXT NOT NULL DEFAULT 'iyzico',
  status TEXT NOT NULL DEFAULT 'pending', provider_payment_id TEXT, provider_transaction_id TEXT, token TEXT,
  amount NUMERIC(12,2) NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY', raw_response JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE INDEX IF NOT EXISTS b2b_orders_created_idx ON b2b_orders(created_at DESC);
 CREATE INDEX IF NOT EXISTS b2b_returns_created_idx ON b2b_returns(created_at DESC);
 `);
}
const admin=(req:any,res:any)=>{if(!requireAdmin(req)){res.status(403).json({error:"Yönetici yetkisi gerekiyor"});return false;}return true;};
const orderNo=()=>`CB2B-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
const returnNo=()=>`IAD-${Date.now().toString(36).toUpperCase()}`;
const list=(v:any)=>Array.isArray(v)?v.map(String).map(x=>x.trim()).filter(Boolean):[];
export function registerCommerceRoutes(app:Express){
 app.get('/api/commerce/products',async(req,res)=>{const r=await q("SELECT * FROM b2b_products ORDER BY created_at DESC");res.json(r.rows);});
 app.post('/api/commerce/products',async(req,res)=>{if(!admin(req,res))return;const x=req.body||{};if(!x.sku?.trim()||!x.name?.trim())return res.status(400).json({error:'SKU ve ürün başlığı gerekli'});if(x.imageData&&(!String(x.imageData).startsWith('data:image/')||String(x.imageData).length>7_000_000))return res.status(400).json({error:'Ürün görseli geçersiz veya çok büyük'});const variants=Array.isArray(x.variants)?x.variants.map((v:any)=>({color:String(v.color||'').trim(),size:String(v.size||'').trim()})).filter((v:any)=>v.color||v.size):[];const r=await q(`INSERT INTO b2b_products(id,sku,name,brand,category,description,price,vat_rate,stock,min_order_qty,is_active,image_data,features,variants,units_per_box,seller,collection_name,tags) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17::jsonb) RETURNING *`,[x.sku.trim(),x.name.trim(),x.brand||null,x.category||null,x.description||null,Number(x.price)||0,Number(x.vatRate??20),Math.max(0,Number(x.stock)||0),Math.max(1,Number(x.minOrderQty)||1),x.isActive!==false,x.imageData||null,JSON.stringify(list(x.features)),JSON.stringify(variants),Math.max(1,Number(x.unitsPerBox)||1),x.seller||null,x.collectionName||null,JSON.stringify(list(x.tags))]);res.status(201).json(r.rows[0]);});
 app.patch('/api/commerce/products/:id',async(req,res)=>{if(!admin(req,res))return;const x=req.body||{};const r=await q(`UPDATE b2b_products SET name=COALESCE($1,name),brand=COALESCE($2,brand),category=COALESCE($3,category),description=COALESCE($4,description),price=COALESCE($5,price),stock=COALESCE($6,stock),min_order_qty=COALESCE($7,min_order_qty),units_per_box=COALESCE($8,units_per_box),seller=COALESCE($9,seller),collection_name=COALESCE($10,collection_name),features=COALESCE($11::jsonb,features),variants=COALESCE($12::jsonb,variants),tags=COALESCE($13::jsonb,tags),is_active=COALESCE($14,is_active),updated_at=NOW() WHERE id=$15 RETURNING *`,[x.name??null,x.brand??null,x.category??null,x.description??null,x.price??null,x.stock??null,x.minOrderQty??null,x.unitsPerBox??null,x.seller??null,x.collectionName??null,x.features?JSON.stringify(list(x.features)):null,x.variants?JSON.stringify(x.variants):null,x.tags?JSON.stringify(list(x.tags)):null,typeof x.isActive==='boolean'?x.isActive:null,req.params.id]);res.json(r.rows[0]);});
 app.get('/api/commerce/orders',async(req,res)=>{if(!admin(req,res))return;const r=await q(`SELECT o.*,u.email customer_email,(SELECT COUNT(*)::int FROM b2b_order_items i WHERE i.order_id=o.id) item_count FROM b2b_orders o LEFT JOIN auth_users u ON u.id=o.customer_id ORDER BY o.created_at DESC`);res.json(r.rows);});
 app.post('/api/commerce/orders',async(req,res)=>{try{if(!req.authUser)return res.status(401).json({error:'Oturum gerekli'});const items=Array.isArray(req.body?.items)?req.body.items:[];if(!items.length)return res.status(400).json({error:'Sepet boş'});await q('BEGIN');let subtotal=0,vat=0;const normalized:any[]=[];for(const item of items){const p=(await q('SELECT * FROM b2b_products WHERE id=$1 AND is_active=TRUE FOR UPDATE',[item.productId])).rows[0];if(!p)throw new Error('Ürün bulunamadı');const qty=Math.max(Number(item.quantity)||0,p.min_order_qty||1);if(qty<=0||p.stock<qty)throw new Error(`Stok yetersiz: ${p.name}`);const base=Number(p.price)*qty;const tax=base*Number(p.vat_rate)/100;subtotal+=base;vat+=tax;normalized.push({p,qty,total:base+tax});}const id=crypto.randomUUID(),no=orderNo(),total=subtotal+vat;await q(`INSERT INTO b2b_orders(id,order_no,customer_id,subtotal,vat_total,total) VALUES($1,$2,$3,$4,$5,$6)`,[id,no,req.authUser.id,subtotal,vat,total]);for(const n of normalized)await q(`INSERT INTO b2b_order_items(id,order_id,product_id,sku,name,quantity,unit_price,vat_rate,line_total) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8)`,[id,n.p.id,n.p.sku,n.p.name,n.qty,n.p.price,n.p.vat_rate,n.total]);await q('COMMIT');res.status(201).json({id,orderNo:no,total,currency:'TRY'});}catch(e:any){await q('ROLLBACK').catch(()=>{});res.status(400).json({error:e.message||'Sipariş oluşturulamadı'});}});
 app.get('/api/commerce/returns',async(req,res)=>{if(!admin(req,res))return;const r=await q(`SELECT r.*,o.order_no,u.email customer_email FROM b2b_returns r JOIN b2b_orders o ON o.id=r.order_id LEFT JOIN auth_users u ON u.id=r.customer_id ORDER BY r.created_at DESC`);res.json(r.rows);});
 app.post('/api/commerce/returns',async(req,res)=>{if(!req.authUser)return res.status(401).json({error:'Oturum gerekli'});const {orderId,reason,note}=req.body||{};if(!orderId||!reason?.trim())return res.status(400).json({error:'Sipariş ve iade nedeni gerekli'});const o=(await q('SELECT * FROM b2b_orders WHERE id=$1 AND customer_id=$2',[orderId,req.authUser.id])).rows[0];if(!o)return res.status(404).json({error:'Sipariş bulunamadı'});const r=await q(`INSERT INTO b2b_returns(id,return_no,order_id,customer_id,reason,note) VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5) RETURNING *`,[returnNo(),orderId,req.authUser.id,reason.trim(),note||null]);res.status(201).json(r.rows[0]);});
 app.patch('/api/commerce/returns/:id',async(req,res)=>{if(!admin(req,res))return;const allowed=['requested','approved','rejected','received','refunded'];if(!allowed.includes(req.body?.status))return res.status(400).json({error:'Geçersiz durum'});const r=await q('UPDATE b2b_returns SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);res.json(r.rows[0]);});
 app.get('/api/commerce/dashboard',async(req,res)=>{if(!admin(req,res))return;const [today,paid,returns,top]=await Promise.all([q(`SELECT COUNT(*)::int n FROM b2b_orders WHERE created_at>=CURRENT_DATE`),q(`SELECT COALESCE(SUM(total),0)::numeric total FROM b2b_orders WHERE payment_status='paid' AND created_at>=CURRENT_DATE`),q(`SELECT COUNT(*)::int n FROM b2b_returns WHERE status NOT IN ('rejected','refunded')`),q(`SELECT i.product_id,i.name,SUM(i.quantity)::int quantity,SUM(i.line_total)::numeric revenue FROM b2b_order_items i JOIN b2b_orders o ON o.id=i.order_id WHERE o.payment_status='paid' GROUP BY i.product_id,i.name ORDER BY quantity DESC LIMIT 5`)]);res.json({todayOrders:today.rows[0].n,todayRevenue:Number(paid.rows[0].total),activeReturns:returns.rows[0].n,topProducts:top.rows});});
}
