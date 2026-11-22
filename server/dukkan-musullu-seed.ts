import type { Pool } from "pg";
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

export async function seedRequestedMusulluCatalog(pool: Pool): Promise<{
  status: "already_completed"|"no_matching_store"|"ambiguous_store"|"created";
  storeId?:number;inputCount?:number;inserted?:number;skipped?:number;
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
      return {status:"already_completed",storeId,inputCount:116,
        inserted:Number(previous.rows[0].inserted_count),skipped:Number(previous.rows[0].updated_count)};
    }
    const products = [...musullu1,...musullu2,...musullu3,...musullu4];
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
    return {status:"created",storeId,inputCount:result.inputCount,
      inserted:result.inserted,skipped:result.skipped};
  }catch(error){
    await c.query("ROLLBACK").catch(()=>{});
    throw error;
  }finally{c.release();}
}
