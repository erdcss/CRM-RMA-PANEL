import { randomBytes } from "crypto";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";

const CHUNK_BYTES=2*1024*1024;
const MAX_BYTES=60*1024*1024;
let schema:Promise<unknown>|undefined;
async function ready(){
 await ensureMarketplaceSchema();
 if(!pool)throw Error("Veritabanı bağlantısı bulunamadı");
 if(!schema)schema=pool.query(
 "CREATE TABLE IF NOT EXISTS mp_media (id TEXT PRIMARY KEY,supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,mime TEXT NOT NULL,data BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
 "CREATE TABLE IF NOT EXISTS mp_media_uploads (id TEXT PRIMARY KEY,supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,expected_size BIGINT NOT NULL,part_count INT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
 "CREATE TABLE IF NOT EXISTS mp_media_upload_parts (upload_id TEXT NOT NULL REFERENCES mp_media_uploads(id) ON DELETE CASCADE,part_index INT NOT NULL,data BYTEA NOT NULL,PRIMARY KEY(upload_id,part_index));"
 ).catch(e=>{schema=undefined;throw e;});
 await schema;
 return pool;
}
const validId=(x:unknown)=>typeof x==="string"&&/^[a-f0-9]{32}$/.test(x);
export function registerMarketplaceVideoUploadRoutes(app:Express,requireB2B:RequestHandler){
 app.post("/api/marketplace/seller/video-upload/start",requireB2B,async(req,res)=>{
  const size=Number(req.body?.size);
  const count=Math.ceil(size/CHUNK_BYTES);
  if(!Number.isSafeInteger(size)||size<24||size>MAX_BYTES||count<1||count>30)
   return res.status(413).json({error:"MP4 boyutu 60 MB sınırını aşıyor"});
  try{
   const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
   const result=await db.query("SELECT id FROM mp_suppliers WHERE owner_user_id=$1 AND status IN ('pending','approved')",[uid]);
   if(!result.rows[0])return res.status(403).json({error:"Tedarikçi yetkisi gerekiyor"});
   await db.query("DELETE FROM mp_media_uploads WHERE created_at<NOW()-INTERVAL '12 hours'");
   const uploadId=randomBytes(16).toString("hex");
   await db.query("INSERT INTO mp_media_uploads(id,supplier_id,expected_size,part_count) VALUES($1,$2,$3,$4)",
    [uploadId,result.rows[0].id,size,count]);
   return res.status(201).json({uploadId,chunkSize:CHUNK_BYTES,partCount:count});
  }catch(e){console.error("Video upload start",e);return res.status(500).json({error:"Yükleme başlatılamadı"});}
 });
 app.post("/api/marketplace/seller/video-upload/part",requireB2B,async(req,res)=>{
  const {uploadId,data}=req.body||{},index=Number(req.body?.partIndex);
  if(!validId(uploadId)||!Number.isSafeInteger(index)||index<0||index>=30||
   typeof data!=="string"||data.length>Math.ceil(CHUNK_BYTES*4/3)+16||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
   return res.status(400).json({error:"Geçersiz video parçası"});
  try{
   const db=await ready(),uid=Number((res.locals as any).b2bUser.id);
   const found=await db.query("SELECT u.expected_size,u.part_count FROM mp_media_uploads u JOIN mp_suppliers s ON s.id=u.supplier_id WHERE u.id=$1 AND s.owner_user_id=$2 AND u.created_at>NOW()-INTERVAL '12 hours'",[uploadId,uid]);
   if(!found.rows[0]||index>=Number(found.rows[0].part_count))return res.status(404).json({error:"Yükleme bulunamadı"});
   const bytes=Buffer.from(data,"base64"),size=Number(found.rows[0].expected_size),count=Number(found.rows[0].part_count);
   const expected=index===count-1?size-(count-1)*CHUNK_BYTES:CHUNK_BYTES;
   if(bytes.length!==expected)return res.status(400).json({error:"Parça boyutu geçersiz"});
   if(index===0&&bytes.toString("ascii",4,8)!=="ftyp")return res.status(415).json({error:"Gerçek MP4 dosyası seçin"});
   await db.query("INSERT INTO mp_media_upload_parts(upload_id,part_index,data) VALUES($1,$2,$3) ON CONFLICT(upload_id,part_index) DO UPDATE SET data=EXCLUDED.data",[uploadId,index,bytes]);
   return res.json({ok:true,partIndex:index});
  }catch(e){console.error("Video upload part",e);return res.status(500).json({error:"Video parçası yüklenemedi"});}
 });
 app.post("/api/marketplace/seller/video-upload/complete",requireB2B,async(req,res)=>{
  const uploadId=req.body?.uploadId;
  if(!validId(uploadId))return res.status(400).json({error:"Geçersiz yükleme"});
  const db=await ready(),client=await db.connect();
  try{
   await client.query("BEGIN");
   const uid=Number((res.locals as any).b2bUser.id);
   const found=await client.query("SELECT u.* FROM mp_media_uploads u JOIN mp_suppliers s ON s.id=u.supplier_id WHERE u.id=$1 AND s.owner_user_id=$2 AND u.created_at>NOW()-INTERVAL '12 hours' FOR UPDATE OF u",[uploadId,uid]);
   if(!found.rows[0]){await client.query("ROLLBACK");return res.status(404).json({error:"Yükleme bulunamadı"});}
   const p=await client.query("SELECT part_index,data FROM mp_media_upload_parts WHERE upload_id=$1 ORDER BY part_index",[uploadId]);
   const n=Number(found.rows[0].part_count),size=Number(found.rows[0].expected_size);
   if(p.rows.length!==n||p.rows.some((x:any,i:number)=>x.part_index!==i)){
    await client.query("ROLLBACK");return res.status(409).json({error:"Video yüklenmesi tamamlanmadı"});
   }
   const bytes=Buffer.concat(p.rows.map((x:any)=>x.data));
   if(bytes.length!==size||bytes.toString("ascii",4,8)!=="ftyp"){
    await client.query("ROLLBACK");return res.status(400).json({error:"Video doğrulaması başarısız"});
   }
   const mediaId=randomBytes(16).toString("hex");
   await client.query("INSERT INTO mp_media(id,supplier_id,mime,data) VALUES($1,$2,'video/mp4',$3)",[mediaId,found.rows[0].supplier_id,bytes]);
   await client.query("DELETE FROM mp_media_uploads WHERE id=$1",[uploadId]);
   await client.query("COMMIT");
   return res.status(201).json({url:"/api/marketplace/media/"+mediaId,size:bytes.length,mime:"video/mp4"});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Video upload complete",e);return res.status(500).json({error:"Video kaydedilemedi"});}
  finally{client.release();}
 });
}
