
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";
import { z } from "zod";
import { randomBytes } from "crypto";

const DDL=`
CREATE TABLE IF NOT EXISTS mp_cart_lines (
 id BIGSERIAL PRIMARY KEY,
 buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES mp_products(id) ON DELETE RESTRICT,
 boxes INTEGER NOT NULL CHECK(boxes>0),
 delivery_mode TEXT NOT NULL DEFAULT 'direct' CHECK(delivery_mode IN ('direct','warehouse')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(buyer_user_id,product_id)
);
CREATE TABLE IF NOT EXISTS mp_order_drafts (
 id BIGSERIAL PRIMARY KEY,
 buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','cancelled')),
 subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'TRY',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(buyer_user_id,request_key)
);
CREATE TABLE IF NOT EXISTS mp_supplier_order_drafts (
 id BIGSERIAL PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES mp_order_drafts(id) ON DELETE CASCADE,
 supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE RESTRICT,
 delivery_mode TEXT NOT NULL CHECK(delivery_mode IN ('direct','warehouse')),
 subtotal NUMERIC(14,2) NOT NULL,
 platform_fee_estimate NUMERIC(14,2) NOT NULL,
 warehouse_fee_estimate NUMERIC(14,2) NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'draft',
 UNIQUE(order_id,supplier_id,delivery_mode)
);
CREATE TABLE IF NOT EXISTS mp_supplier_order_items (
 id BIGSERIAL PRIMARY KEY,
 supplier_order_id BIGINT NOT NULL REFERENCES mp_supplier_order_drafts(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES mp_products(id) ON DELETE RESTRICT,
 revision_id BIGINT NOT NULL REFERENCES mp_product_versions(id) ON DELETE RESTRICT,
 boxes INTEGER NOT NULL,
 units_per_box INTEGER NOT NULL,
 unit_price NUMERIC(14,2) NOT NULL,
 line_total NUMERIC(14,2) NOT NULL
);
`;
let schema:Promise<unknown>|undefined;
async function ready(){
 await ensureMarketplaceSchema();
 if(!pool)throw new Error("PostgreSQL bağlantısı bulunamadı");
 if(!schema)schema=pool.query(DDL).catch(e=>{schema=undefined;throw e;});
 await schema;return pool;
}
const listQuery=`SELECT c.id,c.product_id,c.boxes,c.delivery_mode,p.stock,p.sku,s.id AS supplier_id,s.company_name,
 v.id AS revision_id,v.content
 FROM mp_cart_lines c JOIN mp_products p ON p.id=c.product_id
 JOIN mp_suppliers s ON s.id=p.supplier_id
 LEFT JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
 WHERE c.buyer_user_id=$1 ORDER BY s.id,c.id`;
function asMoney(value:number){return Math.round((value+Number.EPSILON)*100)/100;}
function lines(rows:any[]){
 let subtotal=0;
 const values=rows.map(r=>{
   const units=Number(r.content?.unitsPerBox||0),price=Number(r.content?.price),boxes=Number(r.boxes);
   const min=Number(r.content?.minBoxes||1);
   const available=r.content!=null&&r.stock>=boxes*units&&boxes>=min;
   const total=Number.isFinite(price)?asMoney(price*units*boxes):0;
   subtotal+=total;
   return {...r,total,valid:available,unitsPerBox:units,price};
 });
 const groups=new Map<string,{supplierId:number;companyName:string;deliveryMode:string;subtotal:number;platformFee:number;warehouseFee:number}>();
 for(const line of values){
   const key=line.supplier_id+":"+line.delivery_mode;
   if(!groups.has(key))groups.set(key,{supplierId:Number(line.supplier_id),companyName:line.company_name,
     deliveryMode:line.delivery_mode,subtotal:0,platformFee:0,warehouseFee:0});
   groups.get(key)!.subtotal=asMoney(groups.get(key)!.subtotal+line.total);
 }
 for(const g of groups.values()){g.platformFee=asMoney(g.subtotal*0.03);g.warehouseFee=g.deliveryMode==="warehouse"?asMoney(g.subtotal*0.03):0;}
 return {items:values,subtotal:asMoney(subtotal),supplierOrders:[...groups.values()],currency:"TRY",
   paymentEnabled:false,notice:"Ödeme, resmi satıcı mutabakatı ve fatura entegrasyonu tamamlanmadan aktif değildir."};
}
const validateCart=z.object({productId:z.number().int().positive(),boxes:z.number().int().min(1).max(10000),
  deliveryMode:z.enum(["direct","warehouse"])}).strict();
export function registerMarketplaceCartRoutes(app:Express,requireB2B:RequestHandler){
 app.get("/api/marketplace/cart",requireB2B,async(_req,res)=>{
  try{const db=await ready();const r=await db.query(listQuery,[Number((res.locals as any).b2bUser.id)]);
    res.setHeader("Cache-Control","private,no-store");res.json(lines(r.rows));}
  catch(e){console.error("Cart:",e);res.status(500).json({error:"Sepet yüklenemedi"});}
 });
 app.post("/api/marketplace/cart",requireB2B,async(req,res)=>{
  const parsed=validateCart.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Geçersiz ürün veya koli adedi"});
  try{
    const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
    const p=await db.query(`SELECT p.stock,p.supplier_id,v.content
      FROM mp_products p JOIN mp_suppliers s ON s.id=p.supplier_id
      JOIN mp_store_versions st ON st.supplier_id=s.id AND st.is_live=TRUE
      JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
      WHERE p.id=$1 AND p.is_enabled AND s.status='approved' LIMIT 1`,[parsed.data.productId]);
    const x=p.rows[0];
    if(!x)return res.status(404).json({error:"Satışa açık ürün bulunamadı"});
    const units=Number(x.content.unitsPerBox),min=Number(x.content.minBoxes);
    if(parsed.data.boxes<min||parsed.data.boxes*units>Number(x.stock))
      return res.status(409).json({error:"Minimum koli veya stok koşulu sağlanmadı"});
    const result=await db.query(`INSERT INTO mp_cart_lines(buyer_user_id,product_id,boxes,delivery_mode)
      VALUES($1,$2,$3,$4) ON CONFLICT(buyer_user_id,product_id)
      DO UPDATE SET boxes=EXCLUDED.boxes,delivery_mode=EXCLUDED.delivery_mode,updated_at=NOW() RETURNING id`,
      [uid,parsed.data.productId,parsed.data.boxes,parsed.data.deliveryMode]);
    res.json(result.rows[0]);
  }catch(e){console.error("Cart add:",e);res.status(500).json({error:"Sepete eklenemedi"});}
 });
 app.delete("/api/marketplace/cart/:id",requireB2B,async(req,res)=>{
  const line=Number(req.params.id);
  if(!Number.isSafeInteger(line)||line<1)return res.status(400).json({error:"Geçersiz sepet satırı"});
  try{const db=await ready();await db.query("DELETE FROM mp_cart_lines WHERE id=$1 AND buyer_user_id=$2",[line,Number((res.locals as any).b2bUser.id)]);
    res.json({ok:true});}catch(e){res.status(500).json({error:"Sepetten silinemedi"});}
 });
 // Drafts are NOT paid orders; no payment, invoice, stock deduction, or shipping may be triggered from this endpoint.
 app.post("/api/marketplace/order-drafts",requireB2B,async(req,res)=>{
  const data=z.object({requestKey:z.string().uuid()}).strict().safeParse(req.body);
  if(!data.success)return res.status(400).json({error:"Tekrarlama korumalı işlem anahtarı gerekiyor"});
  let client:Awaited<ReturnType<NonNullable<typeof pool>["connect"]>>|undefined;
  try{
    const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
    client=await db.connect();await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[uid]);
    const previous=await client.query("SELECT id,subtotal,status FROM mp_order_drafts WHERE buyer_user_id=$1 AND request_key=$2",[uid,data.data.requestKey]);
    if(previous.rows[0]){await client.query("COMMIT");return res.json({...previous.rows[0],paymentEnabled:false});}
    const q=await client.query(`SELECT c.id,c.product_id,c.boxes,c.delivery_mode,p.stock,p.sku,s.id AS supplier_id,s.company_name,
      v.id AS revision_id,v.content FROM mp_cart_lines c JOIN mp_products p ON p.id=c.product_id
      JOIN mp_suppliers s ON s.id=p.supplier_id AND s.status='approved'
      JOIN mp_store_versions st ON st.supplier_id=s.id AND st.is_live=TRUE
      JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
      WHERE c.buyer_user_id=$1 AND p.is_enabled=TRUE ORDER BY p.id FOR UPDATE OF p`,[uid]);
    const cart=lines(q.rows);
    if(!cart.items.length)throw new Error("Sepet boş veya ürün yayından kaldırılmış");
    if(cart.items.some(i=>!i.valid||!Number.isFinite(i.price)||i.price<=0))throw new Error("Ürün stok, miktar veya fiyatı güncellendi; sepeti kontrol edin");
    const order=await client.query(`INSERT INTO mp_order_drafts(buyer_user_id,request_key,subtotal)
      VALUES($1,$2,$3) RETURNING *`,[uid,data.data.requestKey,cart.subtotal.toFixed(2)]);
    for(const group of cart.supplierOrders){
      const sub=await client.query(`INSERT INTO mp_supplier_order_drafts
        (order_id,supplier_id,delivery_mode,subtotal,platform_fee_estimate,warehouse_fee_estimate)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[order.rows[0].id,group.supplierId,group.deliveryMode,
          group.subtotal.toFixed(2),group.platformFee.toFixed(2),group.warehouseFee.toFixed(2)]);
      const its=cart.items.filter(i=>Number(i.supplier_id)===group.supplierId&&i.delivery_mode===group.deliveryMode);
      for(const it of its){
        await client.query(`INSERT INTO mp_supplier_order_items(supplier_order_id,product_id,revision_id,boxes,units_per_box,unit_price,line_total)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,[sub.rows[0].id,it.product_id,it.revision_id,it.boxes,it.unitsPerBox,
            it.price.toFixed(2),it.total.toFixed(2)]);
      }
    }
    await client.query("COMMIT");
    res.status(201).json({id:order.rows[0].id,status:"draft",subtotal:cart.subtotal,splitCount:cart.supplierOrders.length,
      paymentEnabled:false,message:"Taslak kaydedildi. Canlı tahsilat henüz aktif değil."});
  }catch(e){if(client)await client.query("ROLLBACK").catch(()=>{});res.status(409).json({error:e instanceof Error?e.message:"Taslak oluşturulamadı"});}
  finally{client?.release();}
 });
 app.get("/api/marketplace/order-drafts",requireB2B,async(_req,res)=>{
  try{const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
    const r=await db.query(`SELECT o.id,o.subtotal,o.status,o.created_at,
      (SELECT COUNT(*)::int FROM mp_supplier_order_drafts d WHERE d.order_id=o.id) AS supplier_orders
      FROM mp_order_drafts o WHERE o.buyer_user_id=$1 ORDER BY o.id DESC LIMIT 50`,[uid]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:"Taslaklar yüklenemedi"});}
 });
}
