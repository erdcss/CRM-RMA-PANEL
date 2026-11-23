import type {Express,Request,Response,NextFunction} from "express";
import type {Pool} from "pg";
import OpenAI,{toFile} from "openai";
import {base64Image,imageDimensions,qualityBand,isExactOfficialMatch} from "./dukkan-image-meta";
import {syncDukkanToB2B} from "./dukkan-b2b-sync";
import {productImageEditModel,userFacingImageEditError} from "./product-image-edit-model";

let schema:Promise<void>|null=null;
export function ensureImageRecovery(pool:Pool):Promise<void>{
 if(!schema)schema=pool.query([
 "CREATE TABLE IF NOT EXISTS dukkan_image_recovery(",
 "store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),",
 "product_id BIGINT NOT NULL REFERENCES dukkan_products(id),",
 "source_sha TEXT NOT NULL,original_image TEXT NOT NULL,",
 "source_width INT NOT NULL,source_height INT NOT NULL,state TEXT NOT NULL,",
 "candidate_image TEXT,candidate_origin TEXT,candidate_source_url TEXT,",
 "candidate_width INT,candidate_height INT,review_note TEXT,",
 "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(store_id,product_id))",
 ].join(" ")+";").then(()=>{}).catch(e=>{schema=null;throw e});
 return schema;
}
function manager(res:Response){
 if(!["owner","manager"].includes(String(res.locals.dukkanRole||"")))
  throw Object.assign(new Error("Görsel düzenleme için yönetici yetkisi gerekiyor"),{status:403});
}
const safe=(fn:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{
 void Promise.resolve().then(()=>fn(req,res)).catch(next);
};
const id=(v:unknown)=>{
 const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Object.assign(new Error("Geçersiz kimlik"),{status:400});return n;
};
const official:Record<string,string>={
 "UV-16":"https://toptan.musullu.com/baofeng-uv-16-pro-su-ve-toza-dayankli-telsiz",
 "MT-G3500M":"https://musullu.com/musullu-premium-max-3500w-et-kiyma-makinesi",
 "MSL-2037":"https://musullu.com/musullu-izgara-tost-waffle-makinesi-msl-2037",
 "MSL-2038":"https://musullu.com/musullu-tost-ve-waffle-makinesi-msl-2038",
 "MSL-CM212":"https://musullu.com/musullu-msl-cm212-elektrikli-cezve-celik",
 "MSL-3004":"https://musullu.com/musullu-msl-3004-superchef-max-2200w-10l-stand-mikser-2-paslanmaz-celik-kase-9-hiz-led-ekran-3-aparat",
 "MT-G1600M":"https://musullu.com/musullu-1600w-mt-g1600m-super-turbo-et-kiyma-makinesi",
 "P15UV":"https://toptan.musullu.com/baofeng-p15uv-walkie-talkie-su-ve-toza-dayanikli-telsiz",
};
function meta(html:string,key:string){
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  if(!tag.toLowerCase().includes(key.toLowerCase()))continue;
  const m=tag.match(/content=["']([^"']+)["']/i);
  if(m)return m[1].replace(/&amp;/g,"&").replace(/&quot;/g,'"');
 }
 return "";
}
function imageHost(source:string):boolean{
 try{
  const u=new URL(source);
  return u.protocol==="https:"&&!u.username&&!u.password&&
   ["cdn.myikas.com","musullu.com","www.musullu.com","toptan.musullu.com"].includes(u.hostname)&&!u.port;
 }catch{return false;}
}
export async function scanMusulluRecovery(pool:Pool,storeId:number){
 await ensureImageRecovery(pool);
 const q=await pool.query(
  "SELECT id,sku,images,image_data FROM dukkan_products WHERE store_id=$1 "+
  "AND deleted_at IS NULL AND description LIKE 'Kaynak: Musullu Kasım 2026 tedarikçi PDF%' ORDER BY id",[storeId]);
 const counts={total:q.rows.length,critical:0,low:0,adequate:0,missing:0};
 for(const row of q.rows){
  const image=Array.isArray(row.images)?row.images[0]:row.image_data;
  const m=imageDimensions(image);const state=qualityBand(m);
  counts[state]++;
  if(!m||typeof image!=="string")continue;
  await pool.query(
   "INSERT INTO dukkan_image_recovery(store_id,product_id,source_sha,original_image,source_width,source_height,state) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(store_id,product_id) DO NOTHING",
   [storeId,row.id,m.sha256,image,m.width,m.height,state]);
 }
 return counts;
}
async function readRow(pool:Pool,storeId:number,productId:number){
 const q=await pool.query(
  "SELECT r.*,p.name,p.brand,p.sku FROM dukkan_image_recovery r "+
  "JOIN dukkan_products p ON p.id=r.product_id AND p.store_id=r.store_id "+
  "WHERE r.store_id=$1 AND r.product_id=$2 AND p.deleted_at IS NULL",[storeId,productId]);
 if(!q.rows[0])throw Object.assign(new Error("Ürün kalite kaydı bulunamadı"),{status:404});
 return q.rows[0];
}
async function discoverOfficialUrl(product:{sku:string;brand:string;name:string}):Promise<string|null>{
 if(!process.env.OPENAI_API_KEY)return null;
 const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:35000,maxRetries:0});
 const result=await openai.responses.create({
  model:process.env.OPENAI_WEB_SEARCH_MODEL||process.env.OPENAI_PRODUCT_MODEL||"gpt-4o-mini",
  tools:[{type:"web_search"} as any],
  max_output_tokens:300,
  input:[{role:"user",content:"Find the product detail page for this EXACT product, using web search. "+
   "Only consider the manufacturer's own domains musullu.com or toptan.musullu.com. "+
   "Never return a homepage, search page, category page, different model, color or accessory. "+
   "If you find exact product page, return ONLY its full HTTPS URL, otherwise NOT_FOUND. "+
   "Brand: "+product.brand+", model code: "+product.sku+", product name: "+product.name}],
 } as any);
 const raw=String(result.output_text||"");
 const urls=raw.match(/https:\/\/[^\s<>"')\]]+/gi)||[];
 for(const candidate of urls){
  try{
   const u=new URL(candidate.replace(/[.,;]+$/,""));
   if(["musullu.com","www.musullu.com","toptan.musullu.com"].includes(u.hostname) &&
     u.protocol==="https:" && !u.username && !u.password && !u.port)return u.toString();
  }catch{ /* ignore invalid model result */ }
 }
 return null;
}
async function officialImage(pool:Pool,storeId:number,productId:number){
 const p=await readRow(pool,storeId,productId);
 const link=official[String(p.sku)]||await discoverOfficialUrl({
  sku:String(p.sku),brand:String(p.brand||""),name:String(p.name||"")
 });
 if(!link)throw Object.assign(new Error("Bu modelin birebir resmî ürün sayfası bulunamadı; fotoğraf korunuyor"),{status:404});
 const page=await fetch(link,{redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!page.ok)throw new Error("Resmî ürün sayfasına ulaşılamadı");
 const html=(await page.text()).slice(0,300000);
 const title=meta(html,"og:title")||(html.match(/<title[^>]*>([^<]+)/i)||[])[1]||"";
 if(!isExactOfficialMatch(String(p.sku),String(p.brand||""),title,html))
  throw Object.assign(new Error("Marka/model kesin eşleşmedi; mevcut fotoğraf korundu"),{status:409});
 const exactGalleryImages:Record<string,string>={
  "MSL-2038":"https://cdn.myikas.com/images/949426e2-307e-45d7-a385-4ffd55560760/861acadb-e217-45c2-8b0e-55c51af9cc12/image_3840.webp",
  "MSL-CM212":"https://cdn.myikas.com/images/949426e2-307e-45d7-a385-4ffd55560760/43f35de9-200a-4f10-956e-4db89f24892d/image_3840.webp",
 };
 const image=exactGalleryImages[String(p.sku)]||meta(html,"og:image")||meta(html,"twitter:image");
 if(!imageHost(image))throw new Error("Resmî görselin kaynak adresi doğrulanamadı");
 // myikas og:image can point at a tiny preview; the identical media UUID
 // also has a full-resolution image_3840.webp representation.
 const imageUrl=new URL(image);
 const fullSize=imageUrl.hostname==="cdn.myikas.com"?
  image.replace(/image_[0-9]+\.(?:webp|png|jpg|jpeg)(?:\?.*)?$/i,"image_3840.webp"):image;
 let chosen:{data:string;metrics:NonNullable<ReturnType<typeof imageDimensions>>}|null=null;
 for(const candidate of [...new Set([fullSize,image])]){
  if(!imageHost(candidate))continue;
  try{
   const response=await fetch(candidate,{redirect:"error",signal:AbortSignal.timeout(15000)});
   if(!response.ok)continue;
   const mime=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
   if(!["image/jpeg","image/png","image/webp"].includes(mime))continue;
   if(Number(response.headers.get("content-length")||0)>2800000)continue;
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<100||bytes.length>2800000)continue;
   const data="data:"+mime+";base64,"+bytes.toString("base64");
   const metrics=imageDimensions(data);
   if(!metrics||Math.max(metrics.width,metrics.height)<700)continue;
   chosen={data,metrics};break;
  }catch{ /* try the next resolution for this exact product asset */ }
 }
 if(!chosen)throw new Error("Resmî kaynak fotoğrafı yeterince net değil");
 const {data,metrics}=chosen;
 await pool.query(
  "UPDATE dukkan_image_recovery SET candidate_image=$3,candidate_origin='official',candidate_source_url=$4,"+
  "candidate_width=$5,candidate_height=$6,state='pending_review',review_note=$7,updated_at=NOW() "+
  "WHERE store_id=$1 AND product_id=$2",
  [storeId,productId,data,link,metrics.width,metrics.height,
   "Resmî siteyle marka/model eşleşti. Varyantı inceleyip onaylayın."]);
 return {candidate:true,source:"official",width:metrics.width,height:metrics.height};
}
async function aiImage(pool:Pool,storeId:number,productId:number){
 const p=await readRow(pool,storeId,productId);
 if(p.state==="pending_review")throw Object.assign(new Error("Bu ürünün zaten onay bekleyen bir görseli var."),{status:409});
 if(!process.env.OPENAI_API_KEY)throw Object.assign(new Error("Yapay zekâ servisi yapılandırılmamış"),{status:503});
 const source=base64Image(p.original_image);
 if(!source)throw new Error("Orijinal ürün görseli okunamadı");
 const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:120000,maxRetries:0});
 const result=await openai.images.edit({
  model:productImageEditModel(),
  image:await toFile(source.buffer,"original."+source.mime.split("/")[1],{type:source.mime}),
  prompt:"Enhance this exact product photo as an ecommerce image on a pure white background. Keep the real product shape, colors, antenna, buttons, model, logo and number of accessories exactly unchanged. Do not fabricate or rewrite tiny details or text, do not crop or add objects. The original may be blurry; generated details are not verified.",
  size:"1024x1024",output_format:"png",
 });
 const b64=result.data?.[0]?.b64_json;
 if(!b64)throw new Error("AI görseli üretilemedi");
 const image="data:image/png;base64,"+b64,meta=imageDimensions(image);
 if(!meta)throw new Error("AI görsel dosyası geçersiz");
 await pool.query(
  "UPDATE dukkan_image_recovery SET candidate_image=$3,candidate_origin='ai',"+
  "candidate_source_url=NULL,candidate_width=$4,candidate_height=$5,state='pending_review',"+
  "review_note='AI taslağı: Düşük kaliteli fotoğraflarda ürün detayları değişebilir. Manuel onay gerekir.',updated_at=NOW() "+
  "WHERE store_id=$1 AND product_id=$2",
  [storeId,productId,image,meta.width,meta.height]);
 return {candidate:true,source:"ai",width:meta.width,height:meta.height};
}
export async function approveRecovery(pool:Pool,storeId:number,productId:number){
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const q=await c.query(
   "SELECT * FROM dukkan_image_recovery WHERE store_id=$1 AND product_id=$2 FOR UPDATE",[storeId,productId]);
  const r=q.rows[0];
  if(!r||r.state!=="pending_review"||!r.candidate_image)
   throw Object.assign(new Error("Onaylanabilecek aday görsel bulunamadı"),{status:409});
  const source=await c.query(
   "SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",
   [storeId,productId]);
  const p=source.rows[0];
  if(!p)throw Object.assign(new Error("Ürün bulunamadı"),{status:404});
  const gallery=Array.isArray(p.images)?p.images:[];
  const next=[r.candidate_image,r.original_image,...gallery].filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).slice(0,6);
  const done=await c.query(
   "UPDATE dukkan_products SET images=$3::jsonb,image_data=$4 WHERE store_id=$1 AND id=$2 RETURNING *",
   [storeId,productId,JSON.stringify(next),next[0]]);
  await syncDukkanToB2B(c,done.rows[0]);
  await c.query(
   "UPDATE dukkan_image_recovery SET state='approved',review_note='Görsel onaylandı; orijinal PDF fotoğrafı korundu.',updated_at=NOW() "+
   "WHERE store_id=$1 AND product_id=$2",[storeId,productId]);
  await c.query("COMMIT");
  return {ok:true,productId,originalPreserved:true};
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
}
export async function prepareMusulluOfficialSample(pool:Pool,storeId:number){
 const verifiedSkus=["UV-16","MSL-2037","MSL-2038","MSL-CM212","MSL-3004","MT-G1600M","P15UV"];
 const q=await pool.query(
  "SELECT r.product_id,r.state,r.candidate_origin,p.sku FROM dukkan_image_recovery r "+
  "JOIN dukkan_products p ON p.id=r.product_id AND p.store_id=r.store_id "+
  "WHERE r.store_id=$1 AND p.sku=ANY($2::text[]) ORDER BY p.sku",
  [storeId,verifiedSkus]);
 const outcome={checked:q.rows.length,applied:0,already:0,failed:[] as string[]};
 for(const row of q.rows){
  if(row.state==="approved"){outcome.already++;continue;}
  if(row.state==="pending_review"&&row.candidate_origin==="ai")continue;
  try{
   if(row.state!=="pending_review")await officialImage(pool,storeId,Number(row.product_id));
   await approveRecovery(pool,storeId,Number(row.product_id));
   outcome.applied++;
  }catch(e){
   outcome.failed.push(row.sku+": "+(e instanceof Error?e.message:"unknown"));
  }
 }
 return outcome;
}

export function registerDukkanImageRecovery(app:Express,pool:Pool){
 const root="/api/dukkan/stores/:storeId/image-recovery";
 const sid=(req:Request)=>id(req.params.storeId),pid=(req:Request)=>id(req.params.productId);
 app.get(root,safe(async(req,res)=>{
  manager(res);await ensureImageRecovery(pool);
  const q=await pool.query(
   "SELECT r.product_id,p.sku,p.name,p.brand,r.source_width,r.source_height,r.state,"+
   "r.candidate_origin,r.candidate_width,r.candidate_height,r.candidate_source_url,r.review_note "+
   "FROM dukkan_image_recovery r JOIN dukkan_products p ON p.store_id=r.store_id AND p.id=r.product_id "+
   "WHERE r.store_id=$1 AND p.deleted_at IS NULL ORDER BY "+
   "CASE r.state WHEN 'pending_review' THEN 0 WHEN 'critical' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,r.product_id DESC LIMIT 250",
   [sid(req)]);
  const counts:Record<string,number>={};
  for(const r of q.rows)counts[r.state]=(counts[r.state]||0)+1;
  res.setHeader("Cache-Control","private,no-store");res.json({total:q.rows.length,counts,items:q.rows});
 }));
 app.post(root+"/scan",safe(async(req,res)=>{
  manager(res);res.json(await scanMusulluRecovery(pool,sid(req)));
 }));
 app.get(root+"/:productId/candidate",safe(async(req,res)=>{
  manager(res);const q=await pool.query(
   "SELECT candidate_image FROM dukkan_image_recovery WHERE store_id=$1 AND product_id=$2",
   [sid(req),pid(req)]);
  const bytes=base64Image(q.rows[0]?.candidate_image);
  if(!bytes){res.status(404).end();return;}
  res.setHeader("Content-Type",bytes.mime);res.setHeader("Cache-Control","private,no-store");res.send(bytes.buffer);
 }));
 app.post(root+"/:productId/official",safe(async(req,res)=>{
  manager(res);res.json(await officialImage(pool,sid(req),pid(req)));
 }));
 app.post(root+"/:productId/ai",safe(async(req,res)=>{
  manager(res);
  try{
   res.setHeader("Cache-Control","private,no-store");
   res.json(await aiImage(pool,sid(req),pid(req)));
  }catch(err){
   const original=err as {status?:number;code?:string};
   if(original?.status===409)return res.status(409).json({code:"pending_review",error:"Bu ürün için onay bekleyen bir aday fotoğraf zaten mevcut."});
   if(original?.status===404)return res.status(404).json({code:"missing_source",error:"Kaynak fotoğraf bulunamadı. Önce ürün görsellerini yeniden tara."});
   if(original?.status===503&&!process.env.OPENAI_API_KEY)return res.status(503).json({code:"missing_api_key",error:"Sunucuda OpenAI API anahtarı tanımlı değil."});
   const report=userFacingImageEditError(err);
   console.error("Dukkan image edit failed",{productId:req.params.productId,storeId:req.params.storeId,status:original?.status||null,code:original?.code||report.code,model:productImageEditModel()});
   return res.status(report.status).json({code:report.code,error:report.error});
  }
 }));
 app.post(root+"/:productId/approve",safe(async(req,res)=>{
  manager(res);res.json(await approveRecovery(pool,sid(req),pid(req)));
 }));
 app.post(root+"/:productId/reject",safe(async(req,res)=>{
  manager(res);await pool.query(
   "UPDATE dukkan_image_recovery SET candidate_image=NULL,candidate_origin=NULL,candidate_source_url=NULL,"+
   "candidate_width=NULL,candidate_height=NULL,state='critical',review_note='Görsel reddedildi, PDF orijinali korundu.',updated_at=NOW() "+
   "WHERE store_id=$1 AND product_id=$2 AND state='pending_review'",
   [sid(req),pid(req)]);res.json({ok:true});
 }));
}