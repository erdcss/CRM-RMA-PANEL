
import type { Express, RequestHandler } from "express";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";
import { supplierOrderView } from "./supplier-privacy";
import { generateSupplierOrderPdf } from "./supplier-order-pdf";
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
 if(!schema)schema=pool.query(DDL)
  .then(()=>pool!.query("ALTER TABLE mp_order_drafts DROP CONSTRAINT IF EXISTS mp_order_drafts_status_check; ALTER TABLE mp_order_drafts ADD CONSTRAINT mp_order_drafts_status_check CHECK (status IN ('draft','cancelled','pending_confirmation'));"))
  .catch(e=>{schema=undefined;throw e;});
 await schema;return pool;
}
const listQuery=`SELECT c.id,c.product_id,c.boxes,c.delivery_mode,p.stock,p.sku,p.is_enabled,
 s.id AS supplier_id,s.slug AS seller_slug,s.company_name,
 s.status AS supplier_status,s.is_holiday,s.is_admin_paused,
 v.id AS revision_id,(v.content || jsonb_build_object('price',COALESCE(p.current_price,(v.content->>'price')::numeric))) AS content
 FROM mp_cart_lines c JOIN mp_products p ON p.id=c.product_id
 JOIN mp_suppliers s ON s.id=p.supplier_id
 LEFT JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE AND v.status='approved'
 WHERE c.buyer_user_id=$1 ORDER BY s.id,c.id`;
function asMoney(value:number){return Math.round((value+Number.EPSILON)*100)/100;}
function lines(rows:any[]){
 let subtotal=0;
 const values=rows.map(r=>{
   const units=Number(r.content?.unitsPerBox||0),price=Number(r.content?.price),boxes=Number(r.boxes);
   const min=Number(r.content?.minBoxes||1);
   const available=r.supplier_status==='approved'&&!r.is_holiday&&!r.is_admin_paused&&r.is_enabled===true&&r.content!=null&&Number.isSafeInteger(units)&&units>0&&Number.isFinite(price)&&price>0&&boxes>=min&&r.stock>=boxes*units;
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
   paymentEnabled:process.env.B2B_SUPPLIER_CHECKOUT_ENABLED==="true"&&values.every(line=>line.valid),
   notice:process.env.B2B_SUPPLIER_CHECKOUT_ENABLED==="true"?
     "Onaylı tedarikçi ürünlerini B2B ödeme sayfasından satın alabilirsiniz; bu sepetin taslak talebi ödeme değildir.":
     "Tedarikçi ödemesi yönetici tarafından henüz etkinleştirilmedi."};
}
const validateCart=z.object({productId:z.number().int().positive(),boxes:z.number().int().min(1).max(10000),
  deliveryMode:z.enum(["direct","warehouse"])}).strict();
export function registerMarketplaceCartRoutes(app:Express,requireB2B:RequestHandler,requireSeller:RequestHandler){
 async function loadSupplierOrders(uid:number){
   const db=await ready();
   const result=await db.query(`SELECT d.id,d.order_id,d.status,d.subtotal,d.delivery_mode,
     o.created_at,o.currency,
     COALESCE(json_agg(json_build_object('productId',i.product_id,'sku',p.sku,'name',v.content->>'name',
       'boxes',i.boxes,'unitsPerBox',i.units_per_box,'price',i.unit_price,'total',i.line_total))
       FILTER(WHERE i.id IS NOT NULL),'[]'::json) AS items
     FROM mp_supplier_order_drafts d JOIN mp_order_drafts o ON o.id=d.order_id
     JOIN mp_suppliers s ON s.id=d.supplier_id AND s.owner_user_id=$1
     LEFT JOIN mp_supplier_order_items i ON i.supplier_order_id=d.id
     LEFT JOIN mp_products p ON p.id=i.product_id
     LEFT JOIN mp_product_versions v ON v.id=i.revision_id
     WHERE o.status='pending_confirmation' AND d.status='pending_confirmation'
     GROUP BY d.id,o.id ORDER BY d.id DESC LIMIT 100`,[uid]);
   // Verified checkout orders are exposed exclusively to their owning supplier;
   // other sellers' items from a mixed order never leave this endpoint.
   const paid=await db.query(`
     SELECT o.id AS order_id,o.created_at,'paid'::text AS status,
       o.shipping_method AS delivery_mode,
       MAX(o.billing_details->>'companyName') AS customer_company,
       CONCAT_WS(', ',
         NULLIF(MAX(o.shipping_address->>'addressLine'),''),
         NULLIF(MAX(o.shipping_address->>'district'),''),
         NULLIF(MAX(o.shipping_address->>'city'),'')
       ) AS delivery_address,
       MAX(o.payment_method) AS payment_method,
       SUM(COALESCE(NULLIF(line.item->>'total','')::numeric,0))::numeric(14,2) AS subtotal,
       jsonb_agg(jsonb_build_object(
         'productId',regexp_replace(line.item->>'productId','^mp-','')::bigint,
         'sku',line.item->>'sku','name',line.item->>'name',
         'boxes',line.item->>'quantity','unitsPerBox',line.item->>'unitsPerBox',
         'price',line.item->>'unitPrice','total',line.item->>'total'
       )) AS items
     FROM b2b_orders o
     CROSS JOIN LATERAL jsonb_array_elements(o.items) line(item)
     JOIN mp_suppliers s ON s.id::text=line.item->>'supplierId' AND s.owner_user_id=$1
     WHERE o.payment_status IN ('SUCCESS','bank_confirmed')
       AND line.item->>'productId' LIKE 'mp-%'
     GROUP BY o.id,o.created_at,o.shipping_method
     ORDER BY o.id DESC LIMIT 100`,[uid]);
   // Explicit allowlist: never expose customer contacts, addresses, e-mail
   // or buyer identifiers to any seller, including through nested item JSON.
   const combined=[
     ...paid.rows.map((row:any)=>supplierOrderView({...row,id:-Number(row.order_id),currency:'TRY'})),
     ...result.rows.map(supplierOrderView),
   ];
   combined.sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
   return combined;
 }
 const pdfTickets=new Map<string,{buffer:Buffer;expiresAt:number;fileName:string}>();
 app.get("/api/marketplace/seller/orders/pdf/:ticket",(req,res)=>{
   const ticket=String(req.params.ticket||"");
   const entry=pdfTickets.get(ticket);
   pdfTickets.delete(ticket);
   res.setHeader("Cache-Control","no-store, private");
   if(!entry||Date.now()>entry.expiresAt)return res.status(404).send("PDF bağlantısı geçersiz veya süresi dolmuş.");
   res.setHeader("Content-Type","application/pdf");
   res.setHeader("Content-Disposition",'attachment; filename="'+entry.fileName+'"');
   res.setHeader("X-Content-Type-Options","nosniff");
   return res.end(entry.buffer);
 });
 app.post("/api/marketplace/seller/orders/:id/pdf-link",requireSeller,async(req,res)=>{
   res.setHeader("Cache-Control","private,no-store");
   try{
     const rawId=Number(req.params.id);
     const uid=Number((res.locals as any).b2bUser.id);
     if(!Number.isSafeInteger(rawId)||rawId===0)return res.status(400).json({error:"Geçersiz sipariş kimliği"});
     const orders=await loadSupplierOrders(uid);
     const order=orders.find((candidate)=>Number(candidate.id)===rawId);
     if(!order)return res.status(404).json({error:"Bu siparişin PDF dosyasına erişim yetkiniz yok"});
     const buffer=generateSupplierOrderPdf(order);
     const ticket=randomBytes(32).toString("hex");
     const fileName="Caliskan-B2B-Tedarikci-Siparis-"+Math.abs(rawId)+".pdf";
     for(const [key,value] of pdfTickets)if(value.expiresAt<Date.now())pdfTickets.delete(key);
     if(pdfTickets.size>80){const key=pdfTickets.keys().next().value;if(key)pdfTickets.delete(key);}
     pdfTickets.set(ticket,{buffer,expiresAt:Date.now()+120000,fileName});
     return res.json({url:"https://admin.ecalisgan.com/api/marketplace/seller/orders/pdf/"+ticket,expiresInSeconds:120});
   }catch(error){
     console.error("Supplier order PDF:",error instanceof Error?error.message:"unknown");
     return res.status(500).json({error:"Sipariş PDF dosyası hazırlanamadı"});
   }
 });
 app.get("/api/marketplace/seller/orders",requireSeller,async(_req,res)=>{
   try{
     const uid=Number((res.locals as any).b2bUser.id);
     const combined=await loadSupplierOrders(uid);
     res.setHeader("Cache-Control","private, no-store");
     return res.json(combined);
   }catch(e){console.error("Seller orders:",e);return res.status(500).json({error:"Siparişler yüklenemedi"});}
 });
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
      FROM mp_products p JOIN mp_suppliers s ON s.id=p.supplier_id AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE
      JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE
      WHERE p.id=$1 AND p.is_enabled AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE LIMIT 1`,[parsed.data.productId]);
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
  let client:PoolClient|undefined;
  try{
    const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
    client=await db.connect();await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[uid]);
    const previous=await client.query("SELECT id,subtotal,status FROM mp_order_drafts WHERE buyer_user_id=$1 AND request_key=$2",[uid,data.data.requestKey]);
    if(previous.rows[0]){await client.query("COMMIT");return res.json({...previous.rows[0],paymentEnabled:false});}
    const q=await client.query(`SELECT c.id,c.product_id,c.boxes,c.delivery_mode,p.stock,p.sku,s.id AS supplier_id,s.slug AS seller_slug,s.company_name,
      v.id AS revision_id,(v.content || jsonb_build_object('price',COALESCE(p.current_price,(v.content->>'price')::numeric))) AS content FROM mp_cart_lines c JOIN mp_products p ON p.id=c.product_id
      JOIN mp_suppliers s ON s.id=p.supplier_id AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE
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

 // Submit the cart as an unpaid order awaiting supplier confirmation.
 app.post("/api/marketplace/orders",requireB2B,async(req,res)=>{
  const data=z.object({requestKey:z.string().uuid()}).strict().safeParse(req.body);
  if(!data.success)return res.status(400).json({error:"İşlem anahtarı eksik veya geçersiz"});
  let client:PoolClient|undefined;
  try {
   const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
   client=await db.connect();
   await client.query("BEGIN");
   await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[uid]);
   const prior=await client.query(
    "SELECT id,status,subtotal FROM mp_order_drafts WHERE buyer_user_id=$1 AND request_key=$2",
    [uid,data.data.requestKey]);
   if(prior.rows[0]){
    await client.query("COMMIT");
    return res.json({...prior.rows[0],paymentStatus:"unpaid",paymentEnabled:false});
   }
   const q=await client.query(`SELECT c.id,c.product_id,c.boxes,c.delivery_mode,p.stock,p.sku,s.id AS supplier_id,s.slug AS seller_slug,s.company_name,
     v.id AS revision_id,(v.content || jsonb_build_object('price',COALESCE(p.current_price,(v.content->>'price')::numeric))) AS content
     FROM mp_cart_lines c JOIN mp_products p ON p.id=c.product_id
     JOIN mp_suppliers s ON s.id=p.supplier_id AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE
     JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE AND v.status='approved'
     WHERE c.buyer_user_id=$1 AND p.is_enabled=TRUE ORDER BY p.id FOR UPDATE OF p`,[uid]);
   const cart=lines(q.rows);
   if(!cart.items.length)throw new Error("Sepette sipariş verilebilecek onaylı ürün bulunmuyor.");
   if(cart.items.some(i=>!i.valid||!Number.isFinite(i.price)||i.price<=0))
    throw new Error("Stok, fiyat veya minimum koli bilgisi değişti. Sepeti yenileyin.");
   const allLines=await client.query("SELECT COUNT(*)::int AS count FROM mp_cart_lines WHERE buyer_user_id=$1",[uid]);
   if(Number(allLines.rows[0]?.count)!==cart.items.length)throw new Error("Sepette yayından kaldırılmış ürün var. Sepeti kontrol edin.");
   const order=await client.query(`INSERT INTO mp_order_drafts(buyer_user_id,request_key,status,subtotal)
     VALUES($1,$2,'pending_confirmation',$3) RETURNING id,status,subtotal`,
     [uid,data.data.requestKey,cart.subtotal.toFixed(2)]);
   for(const group of cart.supplierOrders){
    const sub=await client.query(`INSERT INTO mp_supplier_order_drafts
      (order_id,supplier_id,delivery_mode,subtotal,platform_fee_estimate,warehouse_fee_estimate,status)
      VALUES($1,$2,$3,$4,$5,$6,'pending_confirmation') RETURNING id`,
      [order.rows[0].id,group.supplierId,group.deliveryMode,
       group.subtotal.toFixed(2),group.platformFee.toFixed(2),group.warehouseFee.toFixed(2)]);
    for(const it of cart.items.filter(i=>Number(i.supplier_id)===group.supplierId&&i.delivery_mode===group.deliveryMode)){
     await client.query(`INSERT INTO mp_supplier_order_items
       (supplier_order_id,product_id,revision_id,boxes,units_per_box,unit_price,line_total)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
       [sub.rows[0].id,it.product_id,it.revision_id,it.boxes,it.unitsPerBox,
        it.price.toFixed(2),it.total.toFixed(2)]);
    }
   }
   await client.query("DELETE FROM mp_cart_lines WHERE buyer_user_id=$1",[uid]);
   await client.query("COMMIT");
   return res.status(201).json({...order.rows[0],paymentStatus:"unpaid",paymentEnabled:false,
    message:"Siparişiniz oluşturuldu. Tedarikçi onayı bekleniyor; henüz ödeme alınmadı."});
  }catch(e){
   if(client)await client.query("ROLLBACK").catch(()=>{});
   return res.status(409).json({error:e instanceof Error?e.message:"Sipariş oluşturulamadı"});
  }finally{client?.release();}
 });
 app.post("/api/marketplace/orders/from-list",requireB2B,async(req,res)=>{
  const data=z.object({requestKey:z.string().uuid(),items:z.array(z.object({productId:z.number().int().positive(),boxes:z.number().int().min(1).max(10000)}).strict()).min(1).max(100)}).strict().safeParse(req.body);
  if(!data.success)return res.status(400).json({error:"İşlem anahtarı eksik veya geçersiz"});
  let client:PoolClient|undefined;
  try {
   const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
   client=await db.connect();
   await client.query("BEGIN");
   await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[uid]);
   const prior=await client.query(
    "SELECT id,status,subtotal FROM mp_order_drafts WHERE buyer_user_id=$1 AND request_key=$2",
    [uid,data.data.requestKey]);
   if(prior.rows[0]){
    await client.query("COMMIT");
    return res.json({...prior.rows[0],paymentStatus:"unpaid",paymentEnabled:false});
   }
   const chosen=data.data.items;
   const keys=new Set(chosen.map(x=>x.productId));
   if(keys.size!==chosen.length)throw new Error("Sipariş listenizde tekrarlanan ürün var.");
   const q=await client.query(`SELECT NULL::bigint AS id,c.product_id,c.boxes,'direct'::text AS delivery_mode,
     p.stock,p.sku,s.id AS supplier_id,s.company_name,
     v.id AS revision_id,(v.content || jsonb_build_object('price',COALESCE(p.current_price,(v.content->>'price')::numeric))) AS content
     FROM jsonb_to_recordset($2::jsonb) AS c(product_id bigint,boxes integer)
     JOIN mp_products p ON p.id=c.product_id AND p.is_enabled=TRUE
     JOIN mp_suppliers s ON s.id=p.supplier_id AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE
     JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE AND v.status='approved'
     ORDER BY p.id FOR UPDATE OF p`,[uid,JSON.stringify(chosen.map(x=>({product_id:x.productId,boxes:x.boxes})))]);
   if(q.rows.length!==chosen.length)throw new Error("Sipariş listesindeki bir ürün onaylı değil veya yayından kaldırılmış.");
   const cart=lines(q.rows);
   if(!cart.items.length)throw new Error("Sipariş listenizde onaylı tedarikçi ürünü bulunmuyor.");
   if(cart.items.some(i=>!i.valid||!Number.isFinite(i.price)||i.price<=0))
    throw new Error("Stok, fiyat veya minimum koli bilgisi değişti. Sipariş listesini yenileyin.");
   // Only explicitly submitted products are included. The old marketplace cart is not used.
   const order=await client.query(`INSERT INTO mp_order_drafts(buyer_user_id,request_key,status,subtotal)
     VALUES($1,$2,'pending_confirmation',$3) RETURNING id,status,subtotal`,
     [uid,data.data.requestKey,cart.subtotal.toFixed(2)]);
   for(const group of cart.supplierOrders){
    const sub=await client.query(`INSERT INTO mp_supplier_order_drafts
      (order_id,supplier_id,delivery_mode,subtotal,platform_fee_estimate,warehouse_fee_estimate,status)
      VALUES($1,$2,$3,$4,$5,$6,'pending_confirmation') RETURNING id`,
      [order.rows[0].id,group.supplierId,group.deliveryMode,
       group.subtotal.toFixed(2),group.platformFee.toFixed(2),group.warehouseFee.toFixed(2)]);
    for(const it of cart.items.filter(i=>Number(i.supplier_id)===group.supplierId&&i.delivery_mode===group.deliveryMode)){
     await client.query(`INSERT INTO mp_supplier_order_items
       (supplier_order_id,product_id,revision_id,boxes,units_per_box,unit_price,line_total)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
       [sub.rows[0].id,it.product_id,it.revision_id,it.boxes,it.unitsPerBox,
        it.price.toFixed(2),it.total.toFixed(2)]);
    }
   }
   await client.query("DELETE FROM mp_cart_lines WHERE buyer_user_id=$1 AND product_id=ANY($2::bigint[])",[uid,chosen.map(x=>x.productId)]);
   await client.query("COMMIT");
   return res.status(201).json({...order.rows[0],paymentStatus:"unpaid",paymentEnabled:false,
    message:"Siparişiniz oluşturuldu. Tedarikçi onayı bekleniyor; henüz ödeme alınmadı."});
  }catch(e){
   if(client)await client.query("ROLLBACK").catch(()=>{});
   return res.status(409).json({error:e instanceof Error?e.message:"Sipariş oluşturulamadı"});
  }finally{client?.release();}
 });
 app.get("/api/marketplace/orders",requireB2B,async(_req,res)=>{
  try{
   const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
   const q=await db.query(`SELECT o.id,o.status,o.subtotal,o.currency,o.created_at,
     (SELECT COUNT(*)::int FROM mp_supplier_order_drafts d WHERE d.order_id=o.id) AS supplier_orders
     FROM mp_order_drafts o WHERE o.buyer_user_id=$1 AND o.status='pending_confirmation'
     ORDER BY o.id DESC LIMIT 100`,[uid]);
   res.setHeader("Cache-Control","private, no-store");
   res.json(q.rows);
  }catch(e){res.status(500).json({error:"Siparişler yüklenemedi"});}
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
