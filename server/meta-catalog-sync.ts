import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { pool } from "./db";
import { loadMetaCatalogItems, type MetaCatalogItem } from "./meta-catalog";

const GRAPH = "https://graph.facebook.com/v24.0";
const KEY = "b2b_meta_catalog_config";
type Settings = {enabled:boolean;catalogId:string};
type Change = {id:string;hash:string|null;method:"UPDATE"|"DELETE"; data?:MetaCatalogItem};
let schemaPromise:Promise<void>|undefined;
let running=false;
let retryAfter=0;
let timerStarted=false;
const errorText=(error:unknown)=>String(error instanceof Error?error.message:error).slice(0,350);

async function setup(){
  if(!pool)throw new Error("Veritabanı bağlantısı yok");
  if(!schemaPromise)schemaPromise=(async()=>{
    await pool!.query("CREATE TABLE IF NOT EXISTS meta_catalog_sync_items (catalog_id TEXT NOT NULL, product_id TEXT NOT NULL, content_hash TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(catalog_id,product_id))");
    await pool!.query("CREATE TABLE IF NOT EXISTS meta_catalog_sync_batches (id BIGSERIAL PRIMARY KEY, catalog_id TEXT NOT NULL, handle TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', items JSONB NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), checked_at TIMESTAMPTZ)");
    await pool!.query("CREATE INDEX IF NOT EXISTS meta_catalog_sync_recent ON meta_catalog_sync_batches(catalog_id,created_at DESC)");
  })().catch(e=>{schemaPromise=undefined;throw e});
  return schemaPromise;
}
async function settings():Promise<Settings>{
  if(!pool)return {enabled:false,catalogId:""};
  const r=await pool.query("SELECT value FROM platform_settings WHERE key=$1",[KEY]);
  try{
    const v=JSON.parse(String(r.rows[0]?.value||"{}"));
    return {enabled:v.enabled===true,catalogId:/^[0-9]{5,30}$/.test(String(v.catalogId||""))?String(v.catalogId):""};
  }catch{return {enabled:false,catalogId:""};}
}
const isReady=(s:Settings)=>Boolean(s.enabled && s.catalogId && (process.env.META_CATALOG_ACCESS_TOKEN||"").length>=40);
const encoded=(s:string)=>encodeURIComponent(s);
const hash=(item:MetaCatalogItem)=>createHash("sha256").update(JSON.stringify(item)).digest("hex");
async function metaFetch(path:string,body?:object):Promise<any>{
  const token=process.env.META_CATALOG_ACCESS_TOKEN||"";
  if(token.length<40)throw new Error("META_CATALOG_ACCESS_TOKEN Railway değişkeni eksik");
  const r=await fetch(GRAPH+"/"+path,{
    method:body?"POST":"GET",
    headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(25_000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error)throw new Error("Meta HTTP "+r.status+": "+String(data.error?.message||"Beklenmeyen hata").slice(0,230));
  return data;
}
async function poll(catalogId:string){
  const r=await pool!.query("SELECT id,handle,items,created_at FROM meta_catalog_sync_batches WHERE catalog_id=$1 AND state='pending' ORDER BY id LIMIT 5",[catalogId]);
  for(const job of r.rows){
    try{
      const result=await metaFetch(encoded(catalogId)+"/check_batch_request_status?handle="+encoded(job.handle)+"&load_ids_of_invalid_requests=true");
      const info=Array.isArray(result.data)?result.data[0]:result;
      const state=String(info?.status||"").toUpperCase();
      if(["FINISHED","COMPLETED","DONE","SUCCESS"].includes(state)){
        const errors=Number(info?.errors_total_count||0);
        if(errors>0){
          const msg="Meta ürün işleme hatası ("+errors+"): "+JSON.stringify(info?.errors||[]).slice(0,220);
          await pool!.query("UPDATE meta_catalog_sync_batches SET state='failed',error=$2,checked_at=NOW() WHERE id=$1",[job.id,msg]);
          retryAfter=Date.now()+120_000;
        }else{
          for(const item of job.items as Change[]){
            if(item.method==="DELETE")await pool!.query("DELETE FROM meta_catalog_sync_items WHERE catalog_id=$1 AND product_id=$2",[catalogId,item.id]);
            else if(item.hash)await pool!.query("INSERT INTO meta_catalog_sync_items(catalog_id,product_id,content_hash) VALUES($1,$2,$3) ON CONFLICT(catalog_id,product_id) DO UPDATE SET content_hash=EXCLUDED.content_hash,updated_at=NOW()",[catalogId,item.id,item.hash]);
          }
          await pool!.query("UPDATE meta_catalog_sync_batches SET state='ok',checked_at=NOW() WHERE id=$1",[job.id]);
        }
      }else if(["FAILED","ERROR","REJECTED"].includes(state)||Date.now()-new Date(job.created_at).getTime()>15*60_000){
        const msg="Meta onayı alınamadı: "+JSON.stringify(info?.errors||[]).slice(0,220);
        await pool!.query("UPDATE meta_catalog_sync_batches SET state='failed',error=$2,checked_at=NOW() WHERE id=$1",[job.id,msg]);
        retryAfter=Date.now()+120_000;
      }
    }catch(error){console.warn("Meta batch control:",errorText(error));break;}
  }
}
async function syncNow(manual=false):Promise<{status:string;count:number;message:string}>{
  if(running)return {status:"busy",count:0,message:"Senkronizasyon devam ediyor"};
  if(!pool)return {status:"unavailable",count:0,message:"Veritabanı bağlantısı yok"};
  const cfg=await settings();
  if(!isReady(cfg))return {status:"needs_setup",count:0,message:"Katalog ID veya sunucu erişim anahtarı eksik"};
  if(Date.now()<retryAfter&&!manual)return {status:"cooldown",count:0,message:"Yeniden deneme bekleniyor"};
  running=true;
  try{
    await setup();
    await poll(cfg.catalogId);
    const source=await loadMetaCatalogItems();
    if(source.sourceCount===0||source.items.length===0)throw new Error("Uygun ürün listesi boş; toplu silme güvenlik nedeniyle durduruldu");
    const r=await pool.query("SELECT product_id,content_hash FROM meta_catalog_sync_items WHERE catalog_id=$1",[cfg.catalogId]);
    const hashes=new Map<string,string>(r.rows.map(row=>[String(row.product_id),String(row.content_hash)]));
    const pending=await pool.query("SELECT items FROM meta_catalog_sync_batches WHERE catalog_id=$1 AND state='pending'",[cfg.catalogId]);
    const pendingIds=new Set<string>();
    for(const row of pending.rows)for(const item of row.items as Change[])pendingIds.add(item.id);
    const current=new Map(source.items.map(item=>[item.id,item]));
    const updates:Change[]=[];
    for(const item of source.items){
      const fingerprint=hash(item);
      if(hashes.get(item.id)!==fingerprint&&!pendingIds.has(item.id))
        updates.push({id:item.id,method:"UPDATE",hash:fingerprint,data:item});
    }
    for(const productId of hashes.keys())
      if(!current.has(productId)&&!pendingIds.has(productId))
        updates.push({id:productId,method:"DELETE",hash:null});
    if(updates.length===0)return {status:"up_to_date",count:0,message:"Ürünler güncel"};
    const chunk=updates.slice(0,100);
    const requests=chunk.map(item=>item.method==="DELETE"
      ? {method:"DELETE",data:{id:item.id}}
      : {method:"UPDATE",data:{
          id:item.id,title:item.data!.title,description:item.data!.description,
          availability:item.data!.availability,condition:"new",price:item.data!.price,
          link:item.data!.link,image_link:item.data!.image_link,brand:item.data!.brand,
          mpn:item.data!.mpn,inventory:item.data!.inventory,
          ...(item.data!.gtin?{gtin:item.data!.gtin}:{}),
        }});
    const response=await metaFetch(encoded(cfg.catalogId)+"/items_batch",
      {item_type:"PRODUCT_ITEM",allow_upsert:true,requests});
    const handles:string[]=Array.isArray(response.handles)?response.handles.map(String).filter(Boolean):[];
    if(!handles.length){
      retryAfter=Date.now()+120_000;
      throw new Error("Meta toplu gönderimi reddetti: "+JSON.stringify(response.validation_status||response).slice(0,200));
    }
    // The submitted state is not a confirmed success; check_batch_request_status decides that.
    for(const handle of handles)
      await pool.query("INSERT INTO meta_catalog_sync_batches(catalog_id,handle,items) VALUES($1,$2,$3)",[cfg.catalogId,handle,JSON.stringify(chunk)]);
    return {status:"submitted",count:chunk.length,message:"Ürünler Meta kuyruğuna iletildi; işleme sonucu kontrol ediliyor"};
  }catch(error){
    retryAfter=Date.now()+120_000;
    console.warn("Meta catalog sync:",errorText(error));
    return {status:"error",count:0,message:errorText(error)};
  }finally{running=false;}
}
async function readStatus(){
  await setup();
  const cfg=await settings();
  const stats=cfg.catalogId?await Promise.all([
    pool!.query("SELECT COUNT(*)::int n FROM meta_catalog_sync_items WHERE catalog_id=$1",[cfg.catalogId]),
    pool!.query("SELECT state,COUNT(*)::int n FROM meta_catalog_sync_batches WHERE catalog_id=$1 GROUP BY state",[cfg.catalogId]),
    pool!.query("SELECT id,state,error,created_at,checked_at,jsonb_array_length(items) AS items FROM meta_catalog_sync_batches WHERE catalog_id=$1 ORDER BY id DESC LIMIT 15",[cfg.catalogId])
  ]):[];
  let source={sourceCount:0,eligible:0,skipped:0};
  try{const snap=await loadMetaCatalogItems();source={sourceCount:snap.sourceCount,eligible:snap.items.length,skipped:snap.skipped};}catch(error){console.warn("Meta source:",errorText(error));}
  return {...cfg,tokenConfigured:(process.env.META_CATALOG_ACCESS_TOKEN||"").length>=40,
    canSync:isReady(cfg),syncIntervalSeconds:15,source,confirmedCount:stats[0]?.rows[0]?.n||0,
    batches:stats[1]?.rows||[],history:stats[2]?.rows||[],
    feedUrl:"https://b2b.ecalisgan.com/api/meta/catalog.csv"};
}
export function registerMetaCatalogAdmin(app:Express,requireAdmin:RequestHandler){
  app.get("/api/admin/meta/catalog-status",requireAdmin,async(_req,res)=>{
    try{res.setHeader("Cache-Control","no-store");return res.json(await readStatus());}
    catch(error){return res.status(503).json({error:errorText(error)});}
  });
  app.put("/api/admin/meta/catalog-config",requireAdmin,async(req,res)=>{
    const catalogId=String(req.body?.catalogId||"").trim();
    const enabled=req.body?.enabled;
    if(typeof enabled!=="boolean"||(catalogId&&!/^[0-9]{5,30}$/.test(catalogId)))
      return res.status(400).json({error:"Geçerli katalog kimliği gerekli"});
    if(enabled&&!catalogId)return res.status(400).json({error:"Önce katalog kimliğini girin"});
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    try{
      await pool.query("INSERT INTO platform_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[KEY,JSON.stringify({enabled,catalogId})]);
      return res.json(await readStatus());
    }catch(error){return res.status(503).json({error:errorText(error)});}
  });
  app.post("/api/admin/meta/sync-now",requireAdmin,async(_req,res)=>{
    const result=await syncNow(true);
    return res.status(result.status==="error"?502:result.status==="needs_setup"?409:200).json(result);
  });
  app.get("/api/admin/meta/check-connection",requireAdmin,async(_req,res)=>{
    try{
      const cfg=await settings();
      if(!isReady(cfg))return res.status(409).json({error:"Katalog kimliği veya erişim anahtarı eksik"});
      const info=await metaFetch(encoded(cfg.catalogId)+"?fields=id,name,product_count");
      return res.json({ok:true,id:info.id,name:info.name,product_count:info.product_count});
    }catch(error){return res.status(502).json({error:errorText(error)});}
  });
  if(!timerStarted&&(process.env.RAILWAY_SERVICE_NAME==="CRM-RMA-PANEL"||process.env.VITE_APP_MODE==="admin")){
    timerStarted=true;
    const timer=setInterval(()=>{void syncNow().catch(error=>console.warn("Meta schedule:",errorText(error)));},15_000);
    timer.unref();
  }
}
