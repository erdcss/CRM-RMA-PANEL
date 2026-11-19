import type {Pool} from "pg";
import {createManualStockMovement} from "./dukkan-stock-adjustments";
import {syncDukkanToB2B} from "./dukkan-b2b-sync";

/** Owner-requested Lorenzo inventory batch, 19 Nov 2026.
 * Source prices are the supplied PSF values. Sale prices are 10% above source
 * (markup on cost, not a 10% gross margin), stored precisely in kuruş.
 * All stocks denote individual units. Minimum order is one carton.
 */
export const LORENZO_23_BATCH_KEY="lorenzo-utu-masasi-merdiven-23-2026-11-19-v1";
export const LORENZO_23_ITEMS=[
  {sku:"GKY 500",name:"Otel Tipi Ütü Masası 33×110",purchaseCents:114900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 680",name:"Selvi Ütü Masası 33×110",purchaseCents:132900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 650",name:"Marmara Ütü Masası 37×115",purchaseCents:154900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 690",name:"Damla Ütü Masası 40×120",purchaseCents:189900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 100",name:"Lotus Ütü Masası 40×120",purchaseCents:199900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 203",name:"Clara Ütü Masası 40×120",purchaseCents:199900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 201",name:"Palmiye Ütü Masası 45×126",purchaseCents:209900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 540",name:"Truva Ütü Masası 45×126",purchaseCents:224900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 110",name:"Armoni Ütü Masası 44×126",purchaseCents:234900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 120",name:"Elit Ütü Masası 44×126",purchaseCents:234900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 660",name:"Samyeli Ütü Masası 44×126",purchaseCents:234900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 202",name:"Orya Ütü Masası 45×126",purchaseCents:234900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 130",name:"Ihlamur Sepetli Ütü Masası 45×126",purchaseCents:264900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 900",name:"Esila Ütü Masası 44×126",purchaseCents:264900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 700",name:"Samyeli Lüks Fişli ve Sepetli Ütü Masası 44×126",purchaseCents:276900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 600",name:"Irmak Fişli ve Sepetli Ütü Masası 44×126",purchaseCents:276900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 570",name:"Ihlamur Fişli ve Sepetli Ütü Masası 45×126",purchaseCents:276900,category:"Ütü masası",unitsPerBox:2},
  {sku:"GKY 800",name:"Akdeniz Lüks Fişli ve Sepetli Ütü Masası 44×126",purchaseCents:299900,category:"Ütü masası",unitsPerBox:2},
  {sku:"MRD-103",name:"3+1 Merdiven",purchaseCents:199900,category:"Merdiven",unitsPerBox:1},
  {sku:"MRD-104",name:"4+1 Merdiven",purchaseCents:229900,category:"Merdiven",unitsPerBox:1},
  {sku:"MRD-105",name:"5+1 Merdiven",purchaseCents:264900,category:"Merdiven",unitsPerBox:1},
  {sku:"MRD-106",name:"6+1 Merdiven",purchaseCents:299900,category:"Merdiven",unitsPerBox:1},
  {sku:"MRD-107",name:"7+1 Merdiven",purchaseCents:329900,category:"Merdiven",unitsPerBox:1},
] as const;

const BRAND="Lorenzo";
const UNIT="adet";
const MIN_ORDER_BOXES=1;
const TARGET_STOCK=12;

export function saleCentsForLorenzo23(sourceCents:number):number{
  if(!Number.isSafeInteger(sourceCents)||sourceCents<0)throw new Error("Geçersiz alış fiyatı.");
  return Math.round(sourceCents*110/100);
}
function money(cents:number):string{
  return (cents/100).toFixed(2);
}
type ImportOutcome={
  status:"already_completed"|"no_matching_store"|"ambiguous_store"|"created";
  storeId?:number;inserted?:number;updated?:number;skus?:string[];
};

export async function seedRequestedLorenzo23(pool:Pool):Promise<ImportOutcome>{
  const storeMatches=await pool.query(
    "SELECT id,owner_user_id FROM dukkan_stores WHERE UPPER(TRIM(name))='ÇALIŞKAN GROUP' ORDER BY id LIMIT 2",
  );
  if(!storeMatches.rows.length)return {status:"no_matching_store"};
  if(storeMatches.rows.length!==1)return {status:"ambiguous_store"};
  const storeId=Number(storeMatches.rows[0].id);
  const actor=Number(storeMatches.rows[0].owner_user_id);
  if(!Number.isSafeInteger(storeId)||!Number.isSafeInteger(actor))
    throw new Error("Mağaza yetkilisi doğrulanamadı.");

  const c=await pool.connect();
  try{
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",
      ["dukkan_catalog_"+storeId+"_"+LORENZO_23_BATCH_KEY]);
    await c.query(
      "CREATE TABLE IF NOT EXISTS dukkan_requested_product_batches("+
      "store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),"+
      "batch_key TEXT NOT NULL,inserted_count INT NOT NULL,"+
      "updated_count INT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"+
      "PRIMARY KEY(store_id,batch_key))"
    );
    const imported=await c.query(
      "SELECT inserted_count,updated_count FROM dukkan_requested_product_batches WHERE store_id=$1 AND batch_key=$2",
      [storeId,LORENZO_23_BATCH_KEY]);
    if(imported.rows[0]){
      await c.query("COMMIT");
      return {status:"already_completed",storeId,
        inserted:Number(imported.rows[0].inserted_count),
        updated:Number(imported.rows[0].updated_count)};
    }

    let inserted=0,updated=0;
    for(const item of LORENZO_23_ITEMS){
      const existing=await c.query(
        "SELECT * FROM dukkan_products WHERE store_id=$1 AND (sku=$2 OR b2b_source_sku=$2) FOR UPDATE",
        [storeId,item.sku]);
      if(existing.rows.length>1)
        throw new Error("Birden fazla ürün aynı stok kodunu kullanıyor: "+item.sku);
      const old=existing.rows[0];
      let productId:number;
      const purchase=money(item.purchaseCents);
      const sale=money(saleCentsForLorenzo23(item.purchaseCents));

      if(old){
        const existingName=String(old.name||"").toLocaleLowerCase("tr-TR");
        const sameType=item.category==="Merdiven"
          ?existingName.includes("merdiven")
          :existingName.includes("ütü masası");
        const sameBrand=String(old.brand||"").toLocaleLowerCase("tr-TR")==="lorenzo"||
          existingName.includes("lorenzo");
        if(old.deleted_at||old.archived_at||!sameType||!sameBrand)
          throw new Error("Farklı veya arşivli ürüne ait kod otomatik değiştirilemez: "+item.sku);
        productId=Number(old.id);
        await c.query(
          "UPDATE dukkan_products SET name=$3,unit=$4,purchase_price=$5,sale_price=$6,"+
          "brand=$7,category=$8,units_per_box=$9,min_order_qty=$10 "+
          "WHERE store_id=$1 AND id=$2",
          [storeId,productId,item.name,UNIT,purchase,sale,BRAND,item.category,
            item.unitsPerBox,MIN_ORDER_BOXES]
        );
        updated++;
      }else{
        const result=await c.query(
          "INSERT INTO dukkan_products("+
          "store_id,name,sku,barcode,unit,stock,purchase_price,sale_price,"+
          "brand,category,description,images,image_data,units_per_box,min_order_qty,publish_b2b) "+
          "VALUES($1,$2,$3,NULL,$4,0,$5,$6,$7,$8,'','[]'::jsonb,NULL,$9,$10,FALSE) RETURNING id",
          [storeId,item.name,item.sku,UNIT,purchase,sale,BRAND,item.category,
            item.unitsPerBox,MIN_ORDER_BOXES]
        );
        productId=Number(result.rows[0].id);
        inserted++;
      }
      const current=await c.query(
        "SELECT stock FROM dukkan_products WHERE store_id=$1 AND id=$2",
        [storeId,productId]);
      const delta=TARGET_STOCK-Number(current.rows[0].stock);
      if(delta!==0){
        await createManualStockMovement(c,{
          storeId,productId,delta,actor,
          note:"Lorenzo 23 ürün toplu açılış stok mutabakatı · 19.11.2026",
        });
      }
      const saved=await c.query(
        "SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2",
        [storeId,productId]);
      await syncDukkanToB2B(c,saved.rows[0]);
    }
    await c.query(
      "INSERT INTO dukkan_requested_product_batches(store_id,batch_key,inserted_count,updated_count) VALUES($1,$2,$3,$4)",
      [storeId,LORENZO_23_BATCH_KEY,inserted,updated]
    );
    await c.query("COMMIT");
    return {status:"created",storeId,inserted,updated,
      skus:LORENZO_23_ITEMS.map(x=>x.sku)};
  }catch(error){
    await c.query("ROLLBACK").catch(()=>{});
    throw error;
  }finally{c.release();}
}
