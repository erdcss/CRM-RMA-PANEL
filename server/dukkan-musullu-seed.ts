import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import musullu1 from "./musullu-data/part-1.json";
import musullu2 from "./musullu-data/part-2.json";
import musullu3 from "./musullu-data/part-3.json";
import musullu4 from "./musullu-data/part-4.json";
import { importMusulluDukkanCatalog } from "./dukkan-musullu-import";

/**
 * User-requested 22 Nov 2026 direct product import.
 * 116 catalogue items with 142 original PDF images, source cost + 10% markup.
 * This never imports supplier availability as warehouse inventory.
 * All new Dükkan products have stock 0 and B2B publication disabled.
 * Existing SKUs are never overwritten. If a barcode is already in use, preserve
 * it in the description and leave the scanner barcode empty for review.
 */
export const MUSULLU_PDF_BATCH_KEY = "musullu-pdf-98-direct-116-2026-11-22-v1";

const SOURCE_PRODUCTS = [...musullu1,...musullu2,...musullu3,...musullu4];
type Verification = {
  found:number; expected:number; nameMatches:number; priceMatches:number;
  originalImageMatches:number; matchingImageCount:number; zeroStock:number;
  unpublishedInDukkan:number; hiddenInB2B:number; activeInDukkan:number;
  missingSkus:string[]; priceMismatchSkus:string[]; imageMismatchSkus:string[];
};
async function verifyMusulluCatalog(c:PoolClient,storeId:number):Promise<Verification>{
  const source=new Map(SOURCE_PRODUCTS.map(p=>[p.sku,p]));
  const rows=await c.query(
    "SELECT p.sku,p.name,p.purchase_price,p.sale_price,p.stock,p.publish_b2b,p.archived_at,p.deleted_at,p.b2b_product_id,"+
    "COALESCE((SELECT array_agg(md5(img) ORDER BY ord) FROM jsonb_array_elements_text(p.images) "+
    "WITH ORDINALITY AS refs(img,ord)),ARRAY[]::text[]) AS image_hashes,"+
    "b.is_active AS b2b_active FROM dukkan_products p "+
    "LEFT JOIN b2b_products b ON b.id::text=p.b2b_product_id "+
    "WHERE p.store_id=$1 AND p.sku=ANY($2::text[])",
    [storeId,[...source.keys()]],
  );
  const seen=new Set<string>();
  const v:Verification={
    found:rows.rows.length,expected:SOURCE_PRODUCTS.length,nameMatches:0,priceMatches:0,
    originalImageMatches:0,matchingImageCount:0,zeroStock:0,
    unpublishedInDukkan:0,hiddenInB2B:0,activeInDukkan:0,
    missingSkus:[],priceMismatchSkus:[],imageMismatchSkus:[],
  };
  for(const row of rows.rows){
    const p=source.get(String(row.sku));
    if(!p)continue;
    seen.add(p.sku);
    if(String(row.name)===p.name)v.nameMatches++;
    if(Math.round(Number(row.purchase_price)*100)===Math.round(p.purchasePrice*100)&&
      Math.abs(Number(row.sale_price)-Math.round(p.purchasePrice*110)/100)<0.011)v.priceMatches++;
    else v.priceMismatchSkus.push(p.sku);
    if(Number(row.stock)===0)v.zeroStock++;
    if(row.publish_b2b===false)v.unpublishedInDukkan++;
    if(row.b2b_product_id!=null&&row.b2b_active===false)v.hiddenInB2B++;
    if(!row.archived_at&&!row.deleted_at)v.activeInDukkan++;
    const hashes=p.images.map(im=>createHash("md5").update(im).digest("hex"));
    const stored=Array.isArray(row.image_hashes)?row.image_hashes:[];
    if(stored.length===hashes.length&&stored.every((hash:string,i:number)=>hash===hashes[i])){
      v.originalImageMatches++;
      v.matchingImageCount+=hashes.length;
    }else v.imageMismatchSkus.push(p.sku);
  }
  v.missingSkus=[...source.keys()].filter(sku=>!seen.has(sku));
  // Concise logs only; never expose image data or wholesale price values.
  v.missingSkus=v.missingSkus.slice(0,15);
  v.priceMismatchSkus=v.priceMismatchSkus.slice(0,15);
  v.imageMismatchSkus=v.imageMismatchSkus.slice(0,15);
  return v;
}


export async function seedRequestedMusulluCatalog(pool: Pool): Promise<{
  status: "already_completed"|"no_matching_store"|"ambiguous_store"|"created";
  storeId?:number;inputCount?:number;inserted?:number;skipped?:number;verification?:Verification;
}> {
  const stores = await pool.query(
    "SELECT id FROM dukkan_stores WHERE LOWER(TRIM(name))=LOWER('ÇALIŞKAN GROUP') ORDER BY id LIMIT 2",
  );
  if(stores.rows.length===0) return {status:"no_matching_store"};
  if(stores.rows.length!==1) return {status:"ambiguous_store"};
  const storeId = Number(stores.rows[0].id);
  if(!Number.isSafeInteger(storeId)||storeId<=0)throw Error("Çalışkan Dükkan mağazası geçersiz");

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",["dukkan_catalog_"+storeId+"_"+MUSULLU_PDF_BATCH_KEY]);
    await c.query(
      "CREATE TABLE IF NOT EXISTS dukkan_requested_product_batches("+
      "store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),"+
      "batch_key TEXT NOT NULL,inserted_count INT NOT NULL,"+
      "updated_count INT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"+
      "PRIMARY KEY(store_id,batch_key))",
    );
    const previous=await c.query(
      "SELECT inserted_count,updated_count FROM dukkan_requested_product_batches WHERE store_id=$1 AND batch_key=$2",
      [storeId,MUSULLU_PDF_BATCH_KEY],
    );
    if(previous.rows[0]){
      await c.query("COMMIT");
      const verification=await verifyMusulluCatalog(c,storeId);
      return {status:"already_completed",storeId,inputCount:116,verification,
        inserted:Number(previous.rows[0].inserted_count),skipped:Number(previous.rows[0].updated_count)};
    }
    const products = SOURCE_PRODUCTS;
    if(products.length!==116)throw Error("Musullu kaynak ürün sayısı 116 değil");
    if(products.reduce((s,p)=>s+p.images.length,0)!==142)
      throw Error("Musullu kaynak görsel sayısı 142 değil");
    const result=await importMusulluDukkanCatalog(c,storeId,{
      format:"caliskan-dukkan-musullu-v1",
      source:"Musullu Toptan(98).pdf",
      products,
    });
    await c.query(
      "INSERT INTO dukkan_requested_product_batches(store_id,batch_key,inserted_count,updated_count) "+
      "VALUES($1,$2,$3,$4)",
      [storeId,MUSULLU_PDF_BATCH_KEY,result.inserted,result.skipped],
    );
    await c.query("COMMIT");
    const verification=await verifyMusulluCatalog(c,storeId);
    return {status:"created",storeId,inputCount:result.inputCount,verification,
      inserted:result.inserted,skipped:result.skipped};
  }catch(error){
    await c.query("ROLLBACK").catch(()=>{});
    throw error;
  }finally{c.release();}
}
