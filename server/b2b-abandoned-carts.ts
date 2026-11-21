import type {Express,RequestHandler} from "express";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {pool} from "./db";
import {ensurePrivateProductSchema} from "./b2b-private-products";
import {ensureB2BNotificationTables} from "./b2b-notification-center";
import {sendPushToUsers} from "./push-notifications";
import {cartReminderDue,CART_REMINDER_DELAY_MS} from "./b2b-cart-reminder-rules";

// Every customer has one cart cycle across web, mobile and marketplace.
// A reminder is allowed once per cycle, four hours after the LAST change.

const snapshotSchema=z.object({
  source:z.enum(["web","mobile"]),
  items:z.array(z.object({
    productId:z.union([z.string(),z.number()]),
    quantity:z.number().int().min(1).max(10000),
  }).strict()).max(100),
}).strict();
type Source="web"|"mobile"|"marketplace";
type Line={productId:string;sku:string;name:string;price:number;quantity:number;unitsPerBox:number;total:number;source:Source;seller?:string};
let prepared:Promise<void>|null=null;
let workerRunning=false;
let workerBusy=false;

function money(value:unknown):number{
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:0;
}
export async function ensureB2BCartTracking(){
  if(!pool)throw Error("PostgreSQL bağlantısı bulunamadı");
  if(!prepared)prepared=pool.query([
    "CREATE TABLE IF NOT EXISTS b2b_customer_carts(",
    "user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,",
    "web_items JSONB NOT NULL DEFAULT '[]'::jsonb,",
    "mobile_items JSONB NOT NULL DEFAULT '[]'::jsonb,",
    "marketplace_items JSONB NOT NULL DEFAULT '[]'::jsonb,",
    "last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
    "cycle_id UUID NOT NULL,reminded_at TIMESTAMPTZ,",
    "reminder_status TEXT,reminder_notification_id BIGINT,",
    "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "CREATE INDEX IF NOT EXISTS b2b_customer_carts_pending_idx",
    "ON b2b_customer_carts(last_activity_at) WHERE reminded_at IS NULL;"
  ].join(" ")).then(()=>undefined).catch(error=>{prepared=null;throw error});
  return prepared;
}
async function upsertCart(userId:number,source:Source,items:Line[]){
  if(!pool||!Number.isSafeInteger(userId)||userId<=0)return;
  await ensureB2BCartTracking();
  // Strict allowlist; never interpolate a client-provided column name.
  const col=source==="web"?"web_items":source==="mobile"?"mobile_items":"marketplace_items";
  const wasEmpty="jsonb_array_length(c.web_items)=0 AND jsonb_array_length(c.mobile_items)=0 AND jsonb_array_length(c.marketplace_items)=0";
  const startedNewCycle="("+wasEmpty+" AND jsonb_array_length(EXCLUDED."+col+")>0)";
  await pool.query([
    "INSERT INTO b2b_customer_carts AS c(user_id,"+col+",cycle_id)",
    "VALUES($1,$2::jsonb,$3::uuid)",
    "ON CONFLICT(user_id) DO UPDATE SET",
    col+"=EXCLUDED."+col+",",
    "last_activity_at=NOW(),updated_at=NOW(),",
    "cycle_id=CASE WHEN "+startedNewCycle+" THEN EXCLUDED.cycle_id ELSE c.cycle_id END,",
    "reminded_at=CASE WHEN "+startedNewCycle+" THEN NULL ELSE c.reminded_at END,",
    "reminder_status=CASE WHEN "+startedNewCycle+" THEN NULL ELSE c.reminder_status END,",
    "reminder_notification_id=CASE WHEN "+startedNewCycle+" THEN NULL ELSE c.reminder_notification_id END",
    "WHERE c."+col+" IS DISTINCT FROM EXCLUDED."+col
  ].join(" ").replace("ON CONFLICT(user_id) DO UPDATE SET","ON CONFLICT(user_id) DO UPDATE SET"),[userId,JSON.stringify(items),randomUUID()]);
}
async function hydrateOwnProducts(source:"web"|"mobile",raw:z.infer<typeof snapshotSchema>["items"],customerId:number):Promise<Line[]>{
  if(!pool||!raw.length)return [];
  await ensurePrivateProductSchema();
  const requested=new Map<string,number>();
  for(const row of raw){
    const id=String(row.productId).trim();
    if(!/^[1-9]\d{0,15}$/.test(id))continue;
    requested.set(id,row.quantity);
  }
  if(!requested.size)return [];
  const result=await pool.query([
    "SELECT id,sku,name,price,campaign_price,units_per_box FROM b2b_products",
    "WHERE id::text=ANY($1::text[]) AND is_active=TRUE AND (assigned_customer_id IS NULL OR assigned_customer_id=$2)"
  ].join(" "),[[...requested.keys()],customerId]);
  return result.rows.map(row=>{
    const productId=String(row.id),quantity=requested.get(productId)||1;
    const unitsPerBox=Math.max(1,Number(row.units_per_box)||1);
    const price=money(Number(row.campaign_price)>0?row.campaign_price:row.price);
    return {productId,sku:String(row.sku||""),name:String(row.name||"Ürün"),
      price,quantity,unitsPerBox,total:money(price*unitsPerBox*quantity),source};
  }).sort((a,b)=>a.productId.localeCompare(b.productId,"en",{numeric:true}));
}
/** Rebuild marketplace snapshot from server-owned rows, never user-submitted prices. */
export async function syncMarketplaceCartTracking(userId:number){
  if(!pool)return;
  const result=await pool.query([
    "SELECT c.product_id,c.boxes,p.sku,p.current_price,s.company_name,",
    "v.content FROM mp_cart_lines c",
    "JOIN mp_products p ON p.id=c.product_id",
    "JOIN mp_suppliers s ON s.id=p.supplier_id",
    "LEFT JOIN LATERAL (SELECT content FROM mp_product_versions",
    "WHERE product_id=p.id AND is_live=TRUE AND status='approved' ORDER BY id DESC LIMIT 1) v ON TRUE",
    "WHERE c.buyer_user_id=$1 ORDER BY c.product_id"
  ].join(" "),[userId]);
  const items:Line[]=result.rows.map(row=>{
    const content=row.content||{};
    const price=money(row.current_price??content.price);
    const quantity=Math.max(1,Number(row.boxes)||1),unitsPerBox=Math.max(1,Number(content.unitsPerBox)||1);
    return {productId:"mp-"+String(row.product_id),sku:String(row.sku||""),
      name:String(content.name||"Tedarikçi ürünü"),price,quantity,unitsPerBox,
      total:money(price*quantity*unitsPerBox),seller:String(row.company_name||"Tedarikçi"),source:"marketplace"};
  });
  await upsertCart(userId,"marketplace",items);
}
export function registerB2BAbandonedCartRoutes(
  app:Express,requireAdmin:RequestHandler,requireB2B:RequestHandler
){
  app.post("/api/b2b/cart-tracking/snapshot",requireB2B,async(req,res)=>{
    res.setHeader("Cache-Control","private,no-store");
    const parsed=snapshotSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:"Sepet bilgileri geçersiz"});
    const user=(res.locals as any).b2bUser;
    if(user?.role!=="b2b_customer"||Number(user?.isActive??user?.is_active)!==1)
      return res.status(403).json({error:"Yalnızca aktif B2B müşterileri"});
    try{
      const items=await hydrateOwnProducts(parsed.data.source,parsed.data.items,Number(user.id));
      await upsertCart(Number(user.id),parsed.data.source,items);
      return res.json({ok:true,items:items.length});
    }catch(error){
      console.error("B2B cart snapshot",error);
      return res.status(503).json({error:"Sepet kaydedilemedi"});
    }
  });
  app.get("/api/admin/b2b-pending-carts",requireAdmin,async(_req,res)=>{
    res.setHeader("Cache-Control","private,no-store");
    try{
      await ensureB2BCartTracking();
      const result=await pool!.query([
        "SELECT c.user_id,u.company_name,u.email,u.phone,c.web_items,c.mobile_items,",
        "c.marketplace_items,c.last_activity_at,c.reminded_at,c.reminder_status,c.reminder_notification_id",
        "FROM b2b_customer_carts c JOIN users u ON u.id=c.user_id",
        "WHERE u.role='b2b_customer' AND u.is_active=1",
        "AND (jsonb_array_length(c.web_items)+jsonb_array_length(c.mobile_items)",
        "+jsonb_array_length(c.marketplace_items))>0",
        "AND COALESCE(c.reminder_status,'')<>'order_placed'",
        "AND NOT EXISTS (SELECT 1 FROM b2b_orders o",
        "WHERE o.user_id=c.user_id AND o.created_at>=c.last_activity_at",
        "AND LOWER(COALESCE(o.status,'')) IN",
        "('paid','paid_stock_review','completed','awaiting_bank_transfer',",
        "'awaiting_bank_confirmation','approved','confirmed','onaylandi'))",
        "ORDER BY c.last_activity_at DESC LIMIT 300"
      ].join(" "));
      const carts=result.rows.map(row=>{
        const items:Line[]=[...row.web_items,...row.mobile_items,...row.marketplace_items];
        const total=items.reduce((n,i)=>n+money(i.total),0);
        return {userId:row.user_id,companyName:row.company_name||"Firma",
          email:row.email||"",phone:row.phone||"",
          lastActivityAt:row.last_activity_at,remindedAt:row.reminded_at,
          reminderStatus:row.reminder_status||"pending",
          reminderNotificationId:row.reminder_notification_id,
          itemCount:items.length,boxCount:items.reduce((n,i)=>n+i.quantity,0),
          estimatedTotal:money(total),
          remindAt:new Date(new Date(row.last_activity_at).getTime()+CART_REMINDER_DELAY_MS).toISOString(),
          items};
      });
      return res.json({carts,customerCount:carts.length,totalItems:carts.reduce((n,c)=>n+c.itemCount,0),
        pendingReminders:carts.filter(c=>!c.remindedAt).length});
    }catch(error){
      console.error("Admin pending cart overview",error);
      return res.status(503).json({error:"Sepette bekleyen ürünler alınamadı"});
    }
  });
}

export async function processB2BCartReminders(now=new Date()){
  if(!pool||workerBusy)return;
  workerBusy=true;
  try{
    await ensureB2BCartTracking();
    await ensureB2BNotificationTables();
    const client=await pool.connect();
    const queued:Array<{userId:number;notificationId:string;title:string;body:string}>=[];
    try{
      await client.query("BEGIN");
      const found=await client.query([
        "SELECT c.user_id,c.cycle_id,c.last_activity_at,c.web_items,c.mobile_items,c.marketplace_items",
        "FROM b2b_customer_carts c JOIN users u ON u.id=c.user_id",
        "WHERE c.reminded_at IS NULL AND c.last_activity_at<=$1::timestamptz-interval '4 hours'",
        "AND u.role='b2b_customer' AND u.is_active=1 AND u.application_status='approved'",
        "AND (jsonb_array_length(c.web_items)+jsonb_array_length(c.mobile_items)",
        "+jsonb_array_length(c.marketplace_items))>0",
        "ORDER BY c.last_activity_at LIMIT 30 FOR UPDATE OF c SKIP LOCKED"
      ].join(" "),[now]);
      const rule=await client.query(
        "SELECT enabled,title_template,body_template FROM b2b_notification_rules WHERE event_key='cart_reminder'");
      const customRule=rule.rows[0];
      for(const cart of found.rows){
        const count=cart.web_items.length+cart.mobile_items.length+cart.marketplace_items.length;
        if(!cartReminderDue({lastActivityAt:cart.last_activity_at,now,remindedAt:null,itemCount:count}))continue;
        // An order placed after the last cart edit means this isn't abandoned checkout.
        const placed=await client.query([
          "SELECT 1 FROM b2b_orders WHERE user_id=$1 AND created_at >= $2",
          "AND LOWER(COALESCE(status,'')) IN",
          "('paid','paid_stock_review','completed','awaiting_bank_transfer',",
          "'awaiting_bank_confirmation','approved','confirmed','onaylandi') LIMIT 1"
        ].join(" "),[cart.user_id,cart.last_activity_at]);
        let supplierPlaced=false;
        if(cart.marketplace_items.length&&!placed.rowCount){
          const supplier=await client.query([
            "SELECT 1 FROM mp_order_drafts",
            "WHERE buyer_user_id=$1 AND created_at >= $2",
            "AND status='pending_confirmation' LIMIT 1"
          ].join(" "),[cart.user_id,cart.last_activity_at]);
          supplierPlaced=Boolean(supplier.rowCount);
        }
        if(placed.rowCount||supplierPlaced||customRule?.enabled===false){
          await client.query([
            "UPDATE b2b_customer_carts SET reminded_at=NOW(),",
            "reminder_status=$2,updated_at=NOW() WHERE user_id=$1"
          ].join(" "),[cart.user_id,customRule?.enabled===false?"disabled":"order_placed"]);
          continue;
        }
        const title=String(customRule?.title_template||"Sepetinizde ürünler sizi bekliyor").slice(0,180);
        const body=String(customRule?.body_template||
          "Sipariş sepetinizde ürünler bulunuyor. Siparişinizi tamamlamak için sepetinizi kontrol edebilirsiniz.").slice(0,800);
        const dedupeKey="cart_reminder:"+cart.cycle_id;
        const inserted=await client.query([
          "INSERT INTO b2b_notifications(user_id,title,body,source,event_key,dedupe_key,target_path)",
          "VALUES($1,$2,$3,'automatic','cart_reminder',$4,'/pazaryeri-sepetim')",
          "ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id"
        ].join(" "),[cart.user_id,title,body,dedupeKey]);
        await client.query([
          "UPDATE b2b_customer_carts SET reminded_at=NOW(),",
          "reminder_status=$2,reminder_notification_id=$3,updated_at=NOW() WHERE user_id=$1"
        ].join(" "),[cart.user_id,inserted.rowCount?"recorded":"duplicate",inserted.rows[0]?.id||null]);
        if(inserted.rows[0])queued.push({userId:Number(cart.user_id),
          notificationId:String(inserted.rows[0].id),title,body});
      }
      await client.query("COMMIT");
    }catch(error){
      await client.query("ROLLBACK").catch(()=>undefined);
      throw error;
    }finally{client.release();}
    for(const notice of queued){
      const accepted=await sendPushToUsers([notice.userId],{
        title:notice.title,body:notice.body,
        data:{type:"cart_reminder",eventKey:"cart_reminder",
          targetPath:"/pazaryeri-sepetim",notificationId:notice.notificationId}
      }).catch(error=>{
        console.error("Cart reminder push",error);
        return {sent:0,tokenCount:0};
      });
      await pool.query("UPDATE b2b_customer_carts SET reminder_status=$2 WHERE user_id=$1 AND reminder_notification_id=$3",
        [notice.userId,accepted.sent>0?"push_accepted":"inbox_only",notice.notificationId])
        .catch(error=>console.error("Cart reminder push audit",error));
    }
  }finally{workerBusy=false;}
}
export function startB2BCartReminderWorker(){
  if(workerRunning||!pool)return;
  workerRunning=true;
  void processB2BCartReminders().catch(error=>console.error("B2B cart reminder init",error));
  const interval=setInterval(()=>void processB2BCartReminders()
    .catch(error=>console.error("B2B cart reminder worker",error)),60_000);
  interval.unref?.();
}
