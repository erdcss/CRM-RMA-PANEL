
import { randomBytes } from "crypto";
import type { Express, Request, RequestHandler } from "express";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";

const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_VIDEO = 9 * 1024 * 1024;
let init:Promise<unknown>|undefined;
async function ready(){
  await ensureMarketplaceSchema();
  if(!pool)throw new Error("Veritabanı bağlantısı yok");
  if(!init)init=pool.query(`CREATE TABLE IF NOT EXISTS mp_media (
    id TEXT PRIMARY KEY,
    supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`).catch(e=>{init=undefined;throw e;});
  await init;return pool;
}
export function registerMarketplaceMediaRoutes(app:Express,requireB2B:RequestHandler,sessionUserId:(req:Request)=>number|undefined){
  app.post("/api/marketplace/seller/media",requireB2B,async(req,res)=>{
    try{
      const uid=Number((res.locals as any).b2bUser?.id);
      const db=await ready();
      const supplier=await db.query("SELECT id FROM mp_suppliers WHERE owner_user_id=$1 AND status='approved'",[uid]);
      if(!supplier.rows[0])return res.status(403).json({error:"Onaylı tedarikçi hesabı gerekiyor"});
      const raw=req.body?.dataUrl;
      if(typeof raw!=="string"||raw.length>13_500_000)return res.status(400).json({error:"Medya boyutu geçersiz"});
      const match=/^data:(image\/(?:jpeg|png|webp)|video\/mp4);base64,([a-zA-Z0-9+/=]+)$/i.exec(raw);
      if(!match)return res.status(400).json({error:"JPEG, PNG, WebP veya MP4 yükleyin"});
      const mime=match[1].toLowerCase();
      const bytes=Buffer.from(match[2],"base64");
      const max=mime==="video/mp4"?MAX_VIDEO:MAX_IMAGE;
      if(bytes.length<24||bytes.length>max)return res.status(413).json({error:"Dosya boyutu sınırı aşıldı"});
      const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
      const mp4=bytes.toString("ascii",4,8)==="ftyp";
      if(!(mime==="image/png"&&png||mime==="image/jpeg"&&jpg||mime==="image/webp"&&webp||mime==="video/mp4"&&mp4)){
        return res.status(415).json({error:"Dosya biçimi beklenen medya türüyle uyuşmuyor"});
      }
      const id=randomBytes(16).toString("hex");
      await db.query("INSERT INTO mp_media(id,supplier_id,mime,data) VALUES($1,$2,$3,$4)",[id,supplier.rows[0].id,mime,bytes]);
      res.status(201).json({url:"/api/marketplace/media/"+id,mime,size:bytes.length});
    }catch(e){console.error("Marketplace media upload:",e);res.status(500).json({error:"Medya yüklenemedi"});}
  });
  app.get("/api/marketplace/media/:id",async(req,res)=>{
    if(!/^[0-9a-f]{32}$/.test(req.params.id))return res.status(404).end();
    try{
      const db=await ready();
      const url="/api/marketplace/media/"+req.params.id;
      const result=await db.query(`SELECT m.mime,m.data,s.owner_user_id,
        (
          s.status='approved' AND (
           EXISTS(SELECT 1 FROM mp_store_versions v WHERE v.supplier_id=s.id AND v.is_live=TRUE
             AND (v.content->>'logoUrl'=$2 OR v.content->>'bannerUrl'=$2))
           OR EXISTS(SELECT 1 FROM mp_products p JOIN mp_product_versions v ON v.product_id=p.id
             WHERE p.supplier_id=s.id AND p.is_enabled AND v.is_live=TRUE AND v.content->>'imageUrl'=$2)
           OR EXISTS(SELECT 1 FROM mp_reels r WHERE r.supplier_id=s.id AND r.is_live=TRUE AND r.video_url=$2)
          )
        ) AS public_media
        FROM mp_media m JOIN mp_suppliers s ON s.id=m.supplier_id WHERE m.id=$1`,[req.params.id,url]);
      if(!result.rows[0])return res.status(404).end();
      const asset=result.rows[0];
      if(!asset.public_media){
        const current=sessionUserId(req);
        if(!current)return res.status(404).end();
        const viewer=await db.query("SELECT role,is_active FROM users WHERE id=$1",[current]);
        const canView=Number(asset.owner_user_id)===current ||
          (viewer.rows[0]?.role==="super_admin" && Number(viewer.rows[0]?.is_active)===1);
        if(!canView)return res.status(404).end();
      }
      const bytes:Buffer=result.rows[0].data;const length=bytes.length;
      res.setHeader("Content-Type",result.rows[0].mime);
      res.setHeader("Cache-Control",asset.public_media?"public,max-age=31536000,immutable":"private,no-store");
      res.setHeader("X-Content-Type-Options","nosniff");
      res.setHeader("Accept-Ranges","bytes");
      if(req.headers.range){
        const m=/^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range));
        if(!m||(!m[1]&&!m[2])){res.setHeader("Content-Range","bytes */"+length);return res.status(416).end();}
        let start=m[1]?Number(m[1]):Math.max(0,length-Number(m[2]));
        const end=m[1]?(m[2]?Number(m[2]):length-1):length-1;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>=length||start>end){
          res.setHeader("Content-Range","bytes */"+length);return res.status(416).end();
        }
        res.status(206);res.setHeader("Content-Range","bytes "+start+"-"+end+"/"+length);
        res.setHeader("Content-Length",end-start+1);
        return res.end(bytes.subarray(start,end+1));
      }
      res.setHeader("Content-Length",length);return res.end(bytes);
    }catch(e){console.error("Marketplace media request:",e);return res.status(500).end();}
  });
}
