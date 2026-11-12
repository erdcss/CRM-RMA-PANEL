import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { ensureB2BNotificationTables } from "./b2b-notification-center";
import { sendPushToUsers } from "./push-notifications";

/**
 * One-shot back-in-stock requests, bound to the currently authenticated customer.
 * A single central worker watches BOTH company and approved supplier stock.
 * Queue claims use SKIP LOCKED because the API may run in several Railway replicas.
 */
type ProductKind = "b2b" | "marketplace";

const SAFE_UNITS = "(CASE WHEN (v.content->>'unitsPerBox') ~ '^[0-9]{1,6}$' THEN GREATEST(1,(v.content->>'unitsPerBox')::integer) ELSE 1 END)";
const SAFE_MIN_BOXES = "(CASE WHEN (v.content->>'minBoxes') ~ '^[0-9]{1,6}$' THEN GREATEST(1,(v.content->>'minBoxes')::integer) ELSE 1 END)";
let schemaReady: Promise<void> | null = null;

export function ensureB2BStockAlertTables(): Promise<void> {
  if (!pool) return Promise.reject(new Error("Veritabanı bağlantısı yok"));
  if (!schemaReady) {
    schemaReady = pool.query([
      "CREATE TABLE IF NOT EXISTS b2b_stock_alert_subscriptions (",
      "id BIGSERIAL PRIMARY KEY,",
      "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
      "product_kind TEXT NOT NULL CHECK(product_kind IN ('b2b','marketplace')),",
      "product_id TEXT NOT NULL CHECK(length(product_id) BETWEEN 1 AND 80),",
      "status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','processing','notified','cancelled')),",
      "cycle INTEGER NOT NULL DEFAULT 1,",
      "claimed_at TIMESTAMPTZ, notified_at TIMESTAMPTZ,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "UNIQUE(user_id,product_kind,product_id));",
      "CREATE INDEX IF NOT EXISTS b2b_stock_alerts_pending_idx",
      "ON b2b_stock_alert_subscriptions(status,created_at);"
    ].join(" ")).then(() => undefined).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function identity(req: any): { kind: ProductKind; id: string } | null {
  const kind = req.params.kind;
  const id = String(req.params.id || "");
  if ((kind !== "b2b" && kind !== "marketplace") || !/^[1-9][0-9]{0,17}$/.test(id)) return null;
  return { kind, id };
}

async function findProduct(kind: ProductKind, id: string): Promise<{name:string;available:boolean} | null> {
  if (!pool) return null;
  if (kind === "b2b") {
    const result = await pool.query(
      "SELECT name, (GREATEST(0,stock) >= GREATEST(1,COALESCE(units_per_box,1))*GREATEST(1,COALESCE(min_order_qty,1))) AS available FROM b2b_products WHERE id::text=$1 AND is_active IS DISTINCT FROM FALSE LIMIT 1",
      [id]
    );
    return result.rows[0] ? { name:String(result.rows[0].name || "Ürün"), available:result.rows[0].available===true } : null;
  }
  const result = await pool.query(
    "SELECT COALESCE(v.content->>'name','Ürün') AS name, (m.stock >= " + SAFE_UNITS + " * " + SAFE_MIN_BOXES + ") AS available " +
    "FROM mp_products m JOIN mp_suppliers s ON s.id=m.supplier_id AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE " +
    "JOIN mp_product_versions v ON v.product_id=m.id AND v.is_live=TRUE AND v.status='approved' " +
    "WHERE m.id::text=$1 AND m.is_enabled=TRUE LIMIT 1",
    [id]
  );
  return result.rows[0] ? {name:String(result.rows[0].name || "Ürün"),available:result.rows[0].available===true} : null;
}

const claimQuery = [
  "WITH candidates AS (",
  "SELECT a.id FROM b2b_stock_alert_subscriptions a",
  "JOIN users u ON u.id=a.user_id AND u.role='b2b_customer' AND u.is_active=1",
  "WHERE (a.status='active' OR (a.status='processing' AND a.claimed_at < NOW()-INTERVAL '5 minutes'))",
  "AND ((a.product_kind='b2b' AND EXISTS(",
  "SELECT 1 FROM b2b_products b WHERE b.id::text=a.product_id",
  "AND b.is_active IS DISTINCT FROM FALSE",
  "AND GREATEST(0,b.stock) >= GREATEST(1,COALESCE(b.units_per_box,1))*GREATEST(1,COALESCE(b.min_order_qty,1))",
  ")) OR (a.product_kind='marketplace' AND EXISTS(",
  "SELECT 1 FROM mp_products m",
  "JOIN mp_suppliers s ON s.id=m.supplier_id AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE",
  "JOIN mp_product_versions v ON v.product_id=m.id AND v.is_live=TRUE AND v.status='approved'",
  "WHERE m.id::text=a.product_id AND m.is_enabled=TRUE AND m.stock >= ",
  SAFE_UNITS + " * " + SAFE_MIN_BOXES,
  "))) ORDER BY a.created_at LIMIT 25 FOR UPDATE OF a SKIP LOCKED",
  ") UPDATE b2b_stock_alert_subscriptions AS a",
  "SET status='processing',claimed_at=NOW(),updated_at=NOW() FROM candidates c",
  "WHERE a.id=c.id RETURNING a.id,a.user_id,a.product_kind,a.product_id,a.cycle"
].join(" ");

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function runB2BStockAlertCheck(): Promise<number> {
  if (!pool || running) return 0;
  running = true;
  try {
    await ensureB2BStockAlertTables();
    await ensureB2BNotificationTables();
    const claims = await pool.query(claimQuery);
    for (const item of claims.rows) {
      const dedupe = "restock:" + String(item.id) + ":" + String(item.cycle);
      try {
        const product = await findProduct(item.product_kind as ProductKind,String(item.product_id));
        // The product can disappear/become unavailable between claim and send.
        if (!product?.available) {
          await pool.query(
            "UPDATE b2b_stock_alert_subscriptions SET status='active',claimed_at=NULL,updated_at=NOW() WHERE id=$1 AND cycle=$2 AND status='processing'",
            [item.id,item.cycle]
          );
          continue;
        }
        const path = "/urun/" + (item.product_kind === "marketplace" ? "mp-" : "") + String(item.product_id);
        const title = "Beklediğiniz ürün yeniden stokta";
        const body = product.name.slice(0,180) + " yeniden siparişe açıldı. Ürünü inceleyebilirsiniz.";
        // Only process if the subscriber has not cancelled or rearmed their request.
        const stillActive = await pool.query(
          "SELECT 1 FROM b2b_stock_alert_subscriptions WHERE id=$1 AND cycle=$2 AND status='processing'",
          [item.id,item.cycle]
        );
        if (!stillActive.rowCount) continue;
        const saved = await pool.query(
          "INSERT INTO b2b_notifications(user_id,title,body,source,event_key,dedupe_key,target_path) " +
          "VALUES($1,$2,$3,'automatic','stock_replenished',$4,$5) " +
          "ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id",
          [item.user_id,title,body,dedupe,path]
        );
        if (saved.rows[0]) {
          // Notification inbox is durable even when device permission is denied.
          await sendPushToUsers([Number(item.user_id)], {
            title,body,data:{type:"stock_replenished",eventKey:"stock_replenished",notificationId:String(saved.rows[0].id),targetPath:path}
          }).catch(error => console.error("Stock alert Expo push failed",error));
        }
        await pool.query(
          "UPDATE b2b_stock_alert_subscriptions SET status='notified',notified_at=NOW(),updated_at=NOW() WHERE id=$1 AND cycle=$2 AND status='processing'",
          [item.id,item.cycle]
        );
      } catch(error) {
        console.error("B2B stock alert notification failed", {subscriptionId:item.id,error});
        await pool.query(
          "UPDATE b2b_stock_alert_subscriptions SET status='active',claimed_at=NULL,updated_at=NOW() WHERE id=$1 AND cycle=$2 AND status='processing'",
          [item.id,item.cycle]
        ).catch(() => undefined);
      }
    }
    return claims.rows.length;
  } finally {
    running = false;
  }
}

export function startB2BStockAlertWorker() {
  if (timer) return;
  // Stock changes arrive from admin, supplier, document imports and the Dükkan bridge.
  // Polling their shared committed DB state also catches stock edited outside the API.
  timer = setInterval(() => {
    void runB2BStockAlertCheck().catch(error => console.error("B2B stock alert poll failed",error));
  }, 30_000);
  timer.unref?.();
  void runB2BStockAlertCheck().catch(error => console.error("B2B stock alert initial check failed",error));
}

export function registerB2BStockAlertRoutes(app: Express, requireB2B: RequestHandler) {
  app.get("/api/b2b/stock-alerts/:kind/:id",requireB2B,async(req,res)=>{
    const ref=identity(req);
    if(!ref)return res.status(400).json({error:"Geçersiz ürün kodu"});
    try {
      await ensureB2BStockAlertTables();
      const user=(res.locals as any).b2bUser;
      const result=await pool!.query(
        "SELECT status,cycle FROM b2b_stock_alert_subscriptions WHERE user_id=$1 AND product_kind=$2 AND product_id=$3",
        [user.id,ref.kind,ref.id]
      );
      res.setHeader("Cache-Control","private, no-store");
      return res.json({subscribed:["active","processing"].includes(String(result.rows[0]?.status)),status:result.rows[0]?.status || "none"});
    }catch(error) {
      console.error("Stock subscription lookup failed",error);
      return res.status(503).json({error:"Stok bildirimi kontrol edilemedi"});
    }
  });
  app.post("/api/b2b/stock-alerts/:kind/:id",requireB2B,async(req,res)=>{
    const ref=identity(req);
    if(!ref)return res.status(400).json({error:"Geçersiz ürün kodu"});
    try{
      await ensureB2BStockAlertTables();
      const product=await findProduct(ref.kind,ref.id);
      if(!product)return res.status(404).json({error:"Ürün bulunamadı veya satışa kapalı"});
      if(product.available)return res.status(409).json({error:"Ürün yeniden stokta. Sipariş verebilirsiniz."});
      const user=(res.locals as any).b2bUser;
      const result=await pool!.query(
        "INSERT INTO b2b_stock_alert_subscriptions(user_id,product_kind,product_id) VALUES($1,$2,$3) " +
        "ON CONFLICT(user_id,product_kind,product_id) DO UPDATE SET " +
        "status='active',cycle=CASE WHEN b2b_stock_alert_subscriptions.status IN ('active','processing') " +
        "THEN b2b_stock_alert_subscriptions.cycle ELSE b2b_stock_alert_subscriptions.cycle+1 END, " +
        "claimed_at=NULL,updated_at=NOW() RETURNING status,cycle",
        [user.id,ref.kind,ref.id]
      );
      res.setHeader("Cache-Control","private, no-store");
      return res.json({subscribed:true,status:result.rows[0].status});
    }catch(error){
      console.error("Stock alert subscription failed",error);
      return res.status(503).json({error:"Stok bildirimi kaydedilemedi"});
    }
  });
  app.delete("/api/b2b/stock-alerts/:kind/:id",requireB2B,async(req,res)=>{
    const ref=identity(req);
    if(!ref)return res.status(400).json({error:"Geçersiz ürün kodu"});
    try {
      await ensureB2BStockAlertTables();
      const user=(res.locals as any).b2bUser;
      await pool!.query(
        "UPDATE b2b_stock_alert_subscriptions SET status='cancelled',updated_at=NOW() " +
        "WHERE user_id=$1 AND product_kind=$2 AND product_id=$3 AND status IN ('active','processing')",
        [user.id,ref.kind,ref.id]
      );
      res.setHeader("Cache-Control","private, no-store");
      return res.json({subscribed:false,status:"cancelled"});
    }catch(error){
      console.error("Stock alert unsubscribe failed",error);
      return res.status(503).json({error:"Stok bildirimi iptal edilemedi"});
    }
  });
}
