import type { Express, RequestHandler } from "express";
import { pool } from "./db";

const SESSION_RE = /^[A-Za-z0-9_-]{12,100}$/;
const PRODUCT_RE = /^[A-Za-z0-9_-]{1,120}$/;
let ready: Promise<void> | null = null;
let lastPruneAt = 0;

async function ensureUsageSchema() {
  if (!pool) throw new Error("Database unavailable");
  if (!ready) {
    ready = (async () => {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS b2b_customer_usage_events (" +
        "id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
        "session_id TEXT NOT NULL,platform TEXT NOT NULL CHECK(platform IN ('web','mobile'))," +
        "event_type TEXT NOT NULL CHECK(event_type IN ('session','product_view','product_duration'))," +
        "product_id TEXT,product_name TEXT,duration_seconds INTEGER NOT NULL DEFAULT 0," +
        "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS b2b_customer_usage_by_user_time " +
        "ON b2b_customer_usage_events(user_id,created_at DESC)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS b2b_customer_usage_product_idx " +
        "ON b2b_customer_usage_events(user_id,product_id,created_at DESC)",
      );
    })().catch(error => { ready = null; throw error; });
  }
  await ready;
  // Keep only a short rolling window of account-linked behavioral data.
  if (Date.now()-lastPruneAt > 24*60*60*1000) {
    lastPruneAt = Date.now();
    try { await pool.query("DELETE FROM b2b_customer_usage_events WHERE created_at < NOW()-INTERVAL '90 days'"); }
    catch (error) { lastPruneAt = 0; console.error("Usage retention cleanup failed:",error); }
  }
}

export function registerB2BCustomerInsights(
  app: Express, requireB2B: RequestHandler, requireAdmin: RequestHandler,
) {
  app.post("/api/b2b/usage-event", requireB2B, async (req,res) => {
    res.setHeader("Cache-Control","no-store");
    if (!pool) return res.status(503).json({error:"Kullanım kaydı şu anda kullanılamıyor"});
    const user = res.locals.b2bUser as {id?:number} | undefined;
    const id=Number(user?.id||0);
    const sessionId=String(req.body?.sessionId||"");
    const platform=req.body?.platform;
    const type=req.body?.type;
    const productId=req.body?.productId==null?"":String(req.body.productId);
    const productName=typeof req.body?.productName==="string"
      ? req.body.productName.trim().replace(/\s+/g," ").slice(0,220):"";
    const seconds=Number(req.body?.seconds);
    if (!id || !SESSION_RE.test(sessionId) || !["web","mobile"].includes(platform)
      || !["session","product_view","product_duration"].includes(type)
      || (type!=="session" && !PRODUCT_RE.test(productId))
      || (type==="product_duration" && (!Number.isInteger(seconds)||seconds<1||seconds>300))) {
      return res.status(400).json({error:"Kullanım etkinliği geçersiz"});
    }
    try {
      await ensureUsageSchema();
      // Limit duplicated client sessions; a repeat does not increase frequency.
      if (type==="session") {
        await pool.query(
          "INSERT INTO b2b_customer_usage_events(user_id,session_id,platform,event_type) "+
          "SELECT $1,$2,$3,'session' WHERE NOT EXISTS ("+
          "SELECT 1 FROM b2b_customer_usage_events WHERE user_id=$1 AND session_id=$2 "+
          "AND event_type='session' AND created_at>NOW()-INTERVAL '30 minutes')",
          [id,sessionId,platform],
        );
      } else {
        await pool.query(
          "INSERT INTO b2b_customer_usage_events "+
          "(user_id,session_id,platform,event_type,product_id,product_name,duration_seconds) "+
          "VALUES($1,$2,$3,$4,$5,$6,$7)",
          [id,sessionId,platform,type,productId,productName,type==="product_duration"?seconds:0],
        );
      }
      return res.status(204).end();
    }catch(error){
      console.error("B2B usage event failed:",error);
      return res.status(503).json({error:"Kullanım kaydı kaydedilemedi"});
    }
  });

  app.get("/api/admin/b2b-customer-center/:id/insights", requireAdmin, async (req,res) => {
    res.setHeader("Cache-Control","private, no-store");
    const id=Number(req.params.id);
    if (!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:"Geçersiz firma numarası"});
    if (!pool)return res.status(503).json({error:"Veritabanı kullanılamıyor"});
    try {
      await ensureUsageSchema();
      const user=await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='b2b_customer'",[id]);
      if (!user.rowCount)return res.status(404).json({error:"Firma bulunamadı"});
      const [overview,products,daily,recent]=await Promise.all([
        pool.query(
          "SELECT COUNT(*) FILTER (WHERE event_type='product_view')::int AS product_views,"+
          "COUNT(DISTINCT (created_at AT TIME ZONE 'Europe/Istanbul')::date) "+
          "FILTER (WHERE event_type='session')::int AS active_days,"+
          "COUNT(DISTINCT (platform,session_id)) FILTER (WHERE event_type='session')::int AS sessions,"+
          "COUNT(DISTINCT (platform,session_id)) FILTER (WHERE event_type='session' AND platform='web')::int AS web_sessions,"+
          "COUNT(DISTINCT (platform,session_id)) FILTER (WHERE event_type='session' AND platform='mobile')::int AS mobile_sessions,"+
          "COALESCE(SUM(duration_seconds),0)::int AS seconds,"+
          "MAX(created_at) AS last_seen "+
          "FROM b2b_customer_usage_events WHERE user_id=$1 AND created_at>=NOW()-INTERVAL '30 days'",[id]),
        pool.query(
          "SELECT product_id,MAX(NULLIF(product_name,'')) AS product_name, "+
          "COUNT(*) FILTER(WHERE event_type='product_view')::int AS views,"+
          "COALESCE(SUM(duration_seconds),0)::int AS seconds,MAX(created_at) AS last_seen "+
          "FROM b2b_customer_usage_events WHERE user_id=$1 AND product_id IS NOT NULL "+
          "AND created_at>=NOW()-INTERVAL '30 days' GROUP BY product_id "+
          "ORDER BY views DESC,seconds DESC LIMIT 30",[id]),
        pool.query(
          "SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date::text AS day,"+
          "COUNT(*) FILTER(WHERE event_type='product_view')::int AS views,"+
          "COUNT(*) FILTER(WHERE event_type='session')::int AS sessions "+
          "FROM b2b_customer_usage_events WHERE user_id=$1 "+
          "AND created_at>=NOW()-INTERVAL '14 days' "+
          "GROUP BY 1 ORDER BY day ASC",[id]),
        pool.query(
          "SELECT platform,event_type,product_id,product_name,duration_seconds,created_at "+
          "FROM b2b_customer_usage_events WHERE user_id=$1 "+
          "AND created_at>=NOW()-INTERVAL '30 days' "+
          "ORDER BY created_at DESC LIMIT 30",[id]),
      ]);
      return res.json({periodDays:30,summary:overview.rows[0],products:products.rows,
        daily:daily.rows,recent:recent.rows,
        note:"Süreler görünür/aktif ekrandaki yaklaşık süredir; geçmiş dönemde izlenmeyen ziyaretler hesaplanamaz."});
    }catch(error) {
      console.error("B2B customer insight fetch failed:",error);
      return res.status(503).json({error:"Kullanım raporu alınamadı"});
    }
  });
}
