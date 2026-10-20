import type { Express, Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";

const required = (n: number) => z.string().trim().min(1).max(n);
const picture = z.string().max(5_600_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
const gallerySchema=z.array(picture).min(1).max(4);
function gallery(image:string|undefined,images:string[]|undefined){
  const list=images?.length?images:(image?[image]:[]);
  if(!list.length||list.length>4||list.reduce((total,src)=>total+src.length,0)>12_000_000)
    throw Error("En fazla 4 görsel, toplam 12 MB seçebilirsiniz.");
  return list;
}
const details = z.object({
  sku:required(90), name:required(220), barcode:required(60), brand:required(120),
  category:required(120), description:required(3000), model:required(120),
  color:required(100), material:required(120), size:required(150),
  collectionName:required(120), tags:z.array(required(70)).min(1).max(12),
  price:z.number().finite().positive().max(100000000),
  stock:z.number().int().min(0).max(100000000),
  unitsPerBox:z.number().int().min(1).max(100000),
  minOrderQty:z.number().int().min(1).max(100000),
  leadDays:z.number().int().min(1).max(14),
  image:picture,
  images:gallerySchema.optional(),
}).strict().superRefine((value,ctx)=>{
  if(value.images?.length&&value.images[0]!==value.image)
    ctx.addIssue({code:"custom",path:["images"],message:"Kapak fotoğrafı ilk fotoğraf olmalıdır."});
});
const hints = z.object({
  name:z.string().trim().max(220).default(""), brand:z.string().trim().max(120).default(""),
  barcode:z.string().trim().max(60).default(""), sku:z.string().trim().max(90).default(""),
  category:z.string().trim().max(120).default(""), notes:z.string().trim().max(700).default(""),
}).strict();
const extraction = z.object({
  image:picture.optional(),images:gallerySchema.optional(),hints
}).strict().refine(data=>!!data.image||!!data.images?.length,{message:"En az 1 görsel ekleyin"});
type Actor={id:number;role:"super_admin"|"b2b_seller";supplierId?:number};
const limits=new Map<number,number[]>();
const cache=new Map<string,{expires:number;product:Record<string,string>}>();
const fields=["sku","name","barcode","brand","category","description","model","color","material","size","collectionName","tags"] as const;

function imageBytes(data:string):Buffer {
  const bytes=Buffer.from(data.slice(data.indexOf(",")+1),"base64");
  const mime=data.slice(5,data.indexOf(";"));
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  if(!bytes.length||bytes.length>4*1024*1024||!(mime==="image/png"&&png||mime==="image/jpeg"&&jpeg||mime==="image/webp"&&webp))
    throw Error("Geçerli bir JPG, PNG veya WebP görseli (en fazla 4 MB) seçin.");
  return bytes;
}
async function actorFor(req:Request,userId:(r:Request)=>number|undefined):Promise<Actor|null>{
  const id=userId(req);
  if(!id||!pool)return null;
  const user=await pool.query("SELECT role,is_active FROM users WHERE id=$1",[id]);
  const active=user.rows[0]?.is_active;
  if(!(active===true||active===1))return null;
  if(user.rows[0].role==="super_admin")return {id,role:"super_admin"};
  if(user.rows[0].role!=="b2b_seller")return null;
  await ensureMarketplaceSchema();
  const rows=await pool.query("SELECT id FROM mp_suppliers WHERE owner_user_id=$1 AND status='approved' AND is_admin_paused=FALSE LIMIT 1",[id]);
  return rows.rows[0]?{id,role:"b2b_seller",supplierId:Number(rows.rows[0].id)}:null;
}
function enrichDescription(v:z.infer<typeof details>){
  return [v.description,"","ÜRÜN ÖZELLİKLERİ","Model: "+v.model,"Renk: "+v.color,"Malzeme: "+v.material,"Ölçü: "+v.size].join("\n");
}

export function registerBusinessAiProductRoutes(app:Express,userId:(r:Request)=>number|undefined){
  app.post("/api/business/ai-products/analyze",async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    try{
      const actor=await actorFor(req,userId);
      if(!actor)return res.status(403).json({error:"AI ürün stüdyosuna erişim yetkiniz yok."});
      if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"AI sunucu anahtarı yapılandırılmamış."});
      const parsed=extraction.safeParse(req.body);
      if(!parsed.success)return res.status(400).json({error:"Ürün görselini ve ipuçlarını kontrol edin."});
      const sources=gallery(parsed.data.image,parsed.data.images);
      const bytes=sources.map(imageBytes);
      const now=Date.now(),recent=(limits.get(actor.id)||[]).filter(time=>now-time<60000);
      if(recent.length>=8)return res.status(429).json({error:"Bir dakikada en fazla 8 analiz yapılabilir."});
      limits.set(actor.id,[...recent,now]);
      const hashParts=createHash("sha256");
      for(const bytesPart of bytes)hashParts.update(bytesPart).update("|");
      const hash=hashParts.update(JSON.stringify(parsed.data.hints)).digest("hex");
      const hit=cache.get(hash);
      if(hit&&hit.expires>now)return res.json({product:hit.product,cached:true});
      const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:20000,maxRetries:0});
      const start=Date.now();
      const reply=await ai.responses.create({
        model:process.env.OPENAI_BUSINESS_PRODUCT_MODEL||"gpt-4.1-mini",
        input:[{role:"user",content:[
          {type:"input_text",text:[
            "Bu aynı ürüne ait "+sources.length+" farklı fotoğraftan TEK bir Çalışkan B2B ürün kartı oluştur.",
            "Ön, arka, etiket ve barkod fotoğraflarını birlikte incele; okunabilen bilgileri birleştir.",
            "Fotoğraflarda bilgiler çelişiyorsa bilinmeyen alanı boş bırak.",
            "Yanıtın yalnızca JSON nesnesi olsun; her alan string:",
            fields.join(", "),
            "tags alanını virgülle ayrılmış string yap.",
            "Yalnızca görselde görünen veya kullanıcının sağladığı kesin bilgileri kullan.",
            "Marka, model, barkod, stok kodu, renk, ölçü veya malzeme bilgisi okunmuyorsa boş string döndür.",
            "Fiyat, stok, koli sayısı, teslimat günü tahmin etme.",
            "Açıklama kısa ve gerçekçi olsun; teknik özellik uydurma.",
            "İpuçları:",JSON.stringify(parsed.data.hints)
          ].join("\n")},
          ...sources.map((src,index)=>({
            type:"input_image" as const,
            image_url:src,
            detail:(index===0?"low":"high") as "low"|"high"
          }))
        ]}],
        text:{format:{type:"json_object"}},
        max_output_tokens:1100
      });
      const raw=JSON.parse(reply.output_text||"{}") as Record<string,unknown>;
      const product:Record<string,string>={};
      for(const key of fields)product[key]=typeof raw[key]==="string"?String(raw[key]).trim().slice(0,key==="description"?1600:220):"";
      for(const key of ["name","sku","barcode","brand","category"] as const){
        if(parsed.data.hints[key])product[key]=parsed.data.hints[key];
      }
      if(cache.size>100)cache.clear();
      cache.set(hash,{expires:Date.now()+20*60_000,product});
      return res.json({product,cached:false,elapsedMs:Date.now()-start});
    }catch(e){console.error("Business AI extract",e);return res.status(502).json({error:e instanceof Error&&e.message.includes("görseli")?e.message:"AI analiz edilemedi; fotoğrafı tekrar deneyin."});}
  });

  app.post("/api/business/ai-products/submit",async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    try{
      const actor=await actorFor(req,userId);
      if(!actor||!pool)return res.status(403).json({error:"Ürün yayınlama yetkisi yok."});
      const checked=details.safeParse(req.body);
      if(!checked.success)return res.status(400).json({error:"Bütün ürün alanları zorunludur.",fields:checked.error.issues.map(issue=>issue.path.join("."))});
      const p=checked.data,sources=gallery(p.image,p.images);
      const bytes=sources.map(imageBytes),description=enrichDescription(p);
      if(actor.role==="super_admin"){
        const row=await pool.query(
          "INSERT INTO b2b_products(sku,name,brand,category,description,price,stock,min_order_qty,units_per_box,image_data,images,barcode,collection_name,tags,variants,is_active,updated_at) "+
          "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::text[],'[]'::jsonb,TRUE,NOW()) RETURNING id",
          [p.sku,p.name,p.brand,p.category,description,p.price,p.stock,p.minOrderQty,p.unitsPerBox,sources[0],JSON.stringify(sources),p.barcode,p.collectionName,p.tags]
        );
        return res.status(201).json({productId:row.rows[0].id,status:"approved",isLive:true,message:"Çalışkan ürünü doğrudan yayında."});
      }
      await pool.query("CREATE TABLE IF NOT EXISTS mp_media(id TEXT PRIMARY KEY,supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE CASCADE,mime TEXT NOT NULL,data BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const supplier=await client.query("SELECT id FROM mp_suppliers WHERE id=$1 AND owner_user_id=$2 AND status='approved' FOR UPDATE",[actor.supplierId,actor.id]);
        if(!supplier.rows.length){await client.query("ROLLBACK");return res.status(403).json({error:"Tedarikçi yetkisi doğrulanamadı"});}
        const savedUrls:string[]=[];
        for(let index=0;index<sources.length;index++){
          const mediaId=randomBytes(16).toString("hex");
          const mime=sources[index].slice(5,sources[index].indexOf(";"));
          await client.query("INSERT INTO mp_media(id,supplier_id,mime,data) VALUES($1,$2,$3,$4)",
            [mediaId,actor.supplierId,mime,bytes[index]]);
          savedUrls.push("/api/marketplace/media/"+mediaId);
        }
        const item=await client.query("INSERT INTO mp_products(supplier_id,sku,stock,current_price) VALUES($1,$2,$3,$4) RETURNING id",[actor.supplierId,p.sku,p.stock,p.price.toFixed(2)]);
        const product={sku:p.sku,name:p.name,category:p.category,brand:p.brand,description,barcode:p.barcode,
          imageUrl:savedUrls[0],imageUrls:savedUrls,price:p.price,unitsPerBox:p.unitsPerBox,
          minBoxes:p.minOrderQty,leadDays:p.leadDays,collectionName:p.collectionName,
          tags:p.tags,model:p.model,color:p.color,material:p.material,size:p.size};
        const version=await client.query(
          "INSERT INTO mp_product_versions(product_id,content,status,is_live,review_note) VALUES($1,$2::jsonb,'pending',FALSE,'AI ürün stüdyosu: yönetici incelemesi') RETURNING id",
          [item.rows[0].id,JSON.stringify(product)]
        );
        await client.query("COMMIT");
        return res.status(201).json({productId:item.rows[0].id,revisionId:version.rows[0].id,status:"pending",isLive:false,message:"Ürün yönetici onayına gönderildi."});
      }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
    }catch(e){
      console.error("Business AI submit",e);
      if((e as {code?:string}).code==="23505")return res.status(409).json({error:"Bu stok koduyla zaten bir ürün var."});
      return res.status(500).json({error:"Ürün kaydı başarısız. Tekrar deneyin."});
    }
  });
}
