import type {Express,RequestHandler} from "express";
import {pool} from "./db";
import {B2B_LIVE_PAGE_LABELS,classifyB2BLivePage,type B2BLivePageKey} from "@shared/b2b-live-pages";

// One row per browser tab/session. Both guests and signed-in customers are counted.
// Page buckets intentionally contain no personal data, query strings or product IDs.
let schemaReady:Promise<void>|null=null;
async function ensurePresenceSchema():Promise<void>{
  if(!pool)throw new Error("Veritabanı bağlantısı yok");
  if(!schemaReady)schemaReady=pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_live_page_presence(
      visitor_id TEXT PRIMARY KEY,
      page_key TEXT NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS b2b_live_page_presence_recent_idx
      ON b2b_live_page_presence(last_seen_at DESC,page_key);
  `).then(()=>undefined).catch(error=>{schemaReady=null;throw error;});
  await schemaReady;
}

let lastPrune=0;
export async function recordB2BLivePage(visitorId:string,pagePath:unknown){
  if(!pool)return;
  const pageKey=classifyB2BLivePage(pagePath);
  if(!pageKey)return;
  await ensurePresenceSchema();
  await pool.query(`
    INSERT INTO b2b_live_page_presence(visitor_id,page_key,last_seen_at)
    VALUES($1,$2,NOW())
    ON CONFLICT(visitor_id) DO UPDATE SET
      page_key=EXCLUDED.page_key,last_seen_at=NOW()
  `,[visitorId,pageKey]);
  if(Date.now()-lastPrune>60*60*1000){
    lastPrune=Date.now();
    // Maintenance must not delay the visitor heartbeat response.
    void pool.query("DELETE FROM b2b_live_page_presence WHERE last_seen_at < NOW() - INTERVAL '2 days'")
      .catch(error=>console.error("B2B presence cleanup failed",error));
  }
}
export function registerB2BLivePageDashboard(app:Express,requireAdmin:RequestHandler){
  app.get("/api/admin/b2b-live-pages",requireAdmin,async(_req,res)=>{
    res.setHeader("Cache-Control","private, no-store");
    if(!pool)return res.status(503).json({error:"Canlı ziyaret veritabanı kullanılamıyor"});
    try{
      await ensurePresenceSchema();
      const result=await pool.query(`
        SELECT page_key,COUNT(*)::int AS count
        FROM b2b_live_page_presence
        WHERE last_seen_at>NOW()-INTERVAL '5 minutes'
        GROUP BY page_key
      `);
      const counts=new Map<string,number>(result.rows.map(row=>[String(row.page_key),Number(row.count)||0]));
      const pages=(Object.entries(B2B_LIVE_PAGE_LABELS) as [B2BLivePageKey,string][])
        .map(([key,label])=>({key,label,count:counts.get(key)||0}))
        .sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"tr"));
      return res.json({total:pages.reduce((sum,row)=>sum+row.count,0),windowMinutes:5,pages});
    }catch(error){
      console.error("B2B page presence dashboard failed",error);
      return res.status(503).json({error:"Canlı sayfa ziyaretçileri şu anda alınamıyor"});
    }
  });
}
