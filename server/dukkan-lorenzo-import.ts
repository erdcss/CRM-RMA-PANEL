import type {Pool} from "pg";
import {createManualStockMovement} from "./dukkan-stock-adjustments";
import {syncDukkanToB2B} from "./dukkan-b2b-sync";

/** User-approved 13 Nov 2026 inventory batch. Prices are PURCHASE prices in
 * kuruş; sale prices use a 20% cost markup, not a 20% gross margin.
 * Import remains safe to run on every Railway restart: a committed batch
 * marker is checked inside the same transaction as every product and movement.
 */
export const LORENZO_KURUTMALIK_BATCH_KEY="lorenzo-kurutmalik-10-2026-11-13-v1";
export const LORENZO_KURUTMALIK_ITEMS=[
  {sku:"GKY 1070",name:"LORENZO BORULU KURUTMALIK",purchaseCents:68940},
  {sku:"GKY 1071",name:"LORENZO BORULU BONCUKLU KURUTMALIK",purchaseCents:74940},
  {sku:"GKY 1140",name:"LORENZO VESNA BORULU KURUTMALIK",purchaseCents:76140},
  {sku:"GKY 1130",name:"LORENZO ALIZE BONCUKLU BORULU KURUTMALIK",purchaseCents:83940},
  {sku:"GKY 1040",name:"LORENZO IHLAMUR ALÜMİNYUM KURUTMALIK",purchaseCents:83940},
  {sku:"GKY 1125",name:"LORENZO ELA LUX ALÜMİNYUM KURUTMALIK",purchaseCents:88140},
  {sku:"GKY 1075",name:"LORENZO DEFNE KANATLI BORULU KURUTMALIK",purchaseCents:92940},
  {sku:"GKY 1095",name:"LORENZO VENTO KANATLI BORULU KURUTMALIK",purchaseCents:101940},
  {sku:"GKY 1050",name:"LORENZO ALMINA ÇİFT KANATLI KURUTMALIK",purchaseCents:137940},
  {sku:"GKY 1110",name:"LORENZO LENDA KANATLI ALÜMİNYUM KURUTMALIK",purchaseCents:137940},
] as const;

export const LORENZO_DEFAULTS=Object.freeze({
  brand:"Lorenzo",
  category:"Kurutmalık",
  unit:"adet",
  unitsPerBox:6,
  minOrderQty:1,
  stock:18,
  description:"",
  publishB2B:false, // No supplied images; never publish image-free products.
});

export function priceFromKurus(cents:number):string{
  if(!Number.isSafeInteger(cents)||cents<0)throw new Error("Geçersiz kuruş tutarı.");
  return (cents/100).toFixed(2);
}
export function lorenzoSaleCents(purchaseCents:number):number{
  if(!Number.isSafeInteger(purchaseCents)||purchaseCents<0)
    throw new Error("Alış fiyatı kuruş biçiminde olmalı.");
  return Math.round(purchaseCents*120/100);
}
type Outcome={status:"already_completed"|"no_matching_store"|"ambiguous_store"|"created";storeId?:number;inserted?:number;updated?:number;skus?:string[]};

export async function seedRequestedLorenzoKurutmalik(pool:Pool):Promise<Outcome>{
  const stores=await pool.query(
    "SELECT id,owner_user_id FROM dukkan_stores WHERE UPPER(TRIM(name))='ÇALIŞKAN GROUP' ORDER BY id LIMIT 2",
  );
  if(!stores.rows.length)return {status:"no_matching_store"};
  if(stores.rows.length!==1)return {status:"ambiguous_store"};
  const storeId=Number(stores.rows[0].id);
  const actor=Number(stores.rows[0].owner_user_id);
  if(!Number.isSafeInteger(storeId)||!Number.isSafeInteger(actor))throw Error("Mağaza sahibi doğrulanamadı.");

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",
      ["dukkan_catalog_"+storeId+"_"+LORENZO_KURUTMALIK_BATCH_KEY]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS dukkan_requested_product_batches("+
      "store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),"+
      "batch_key TEXT NOT NULL, inserted_count INT NOT NULL,"+
      "updated_count INT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"+
      "PRIMARY KEY(store_id,batch_key))"
    );
    const already=await client.query(
      "SELECT inserted_count,updated_count FROM dukkan_requested_product_batches WHERE store_id=$1 AND batch_key=$2",
      [storeId,LORENZO_KURUTMALIK_BATCH_KEY]);
    if(already.rows[0]){
      await client.query("COMMIT");
      return {status:"already_completed",storeId,
        inserted:Number(already.rows[0].inserted_count),updated:Number(already.rows[0].updated_count)};
    }

    let inserted=0,updated=0;
    for(const item of LORENZO_KURUTMALIK_ITEMS){
      const previous=await client.query(
        "SELECT * FROM dukkan_products WHERE store_id=$1 AND (sku=$2 OR b2b_source_sku=$2) FOR UPDATE",
        [storeId,item.sku]);
      if(previous.rows.length>1)
        throw new Error("Aynı model numarası birden fazla ürünle eşleşiyor: "+item.sku);
      const old=previous.rows[0];
      let productId:number;
      if(old){
        // Existing unrelated SKU must never be overwritten automatically.
        const existingName=String(old.name||"").toLocaleLowerCase("tr-TR");
        const sameModel=existingName.includes("kurutmalık") &&
          (existingName.includes("lorenzo")||String(old.brand||"").toLocaleLowerCase("tr-TR")==="lorenzo");
        if(old.deleted_at||old.archived_at||!sameModel)
          throw new Error("Bu kod farklı/arşivli üründe kullanılıyor; otomatik değişiklik engellendi: "+item.sku);
        productId=Number(old.id);
        const updatedRow=await client.query(
          "UPDATE dukkan_products SET name=$3,unit=$4,purchase_price=$5,sale_price=$6,"+
          "brand=$7,category=$8,description=$9,units_per_box=$10,min_order_qty=$11 "+
          "WHERE store_id=$1 AND id=$2 RETURNING *",
          [storeId,productId,item.name,LORENZO_DEFAULTS.unit,priceFromKurus(item.purchaseCents),
            priceFromKurus(lorenzoSaleCents(item.purchaseCents)),LORENZO_DEFAULTS.brand,
            LORENZO_DEFAULTS.category,LORENZO_DEFAULTS.description,
            LORENZO_DEFAULTS.unitsPerBox,LORENZO_DEFAULTS.minOrderQty]
        );
        if(!updatedRow.rows[0])throw new Error("Ürün güncellenemedi: "+item.sku);
        updated++;
      }else{
        const added=await client.query(
          "INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,stock,purchase_price,sale_price,"+
          "brand,category,description,images,image_data,units_per_box,min_order_qty,publish_b2b) "+
          "VALUES($1,$2,$3,NULL,$4,0,$5,$6,$7,$8,$9,'[]'::jsonb,NULL,$10,$11,FALSE) RETURNING id",
          [storeId,item.name,item.sku,LORENZO_DEFAULTS.unit,
            priceFromKurus(item.purchaseCents),priceFromKurus(lorenzoSaleCents(item.purchaseCents)),
            LORENZO_DEFAULTS.brand,LORENZO_DEFAULTS.category,LORENZO_DEFAULTS.description,
            LORENZO_DEFAULTS.unitsPerBox,LORENZO_DEFAULTS.minOrderQty],
        );
        productId=Number(added.rows[0].id);
        inserted++;
      }

      const present=await client.query(
        "SELECT stock FROM dukkan_products WHERE store_id=$1 AND id=$2",
        [storeId,productId]);
      const currentStock=Number(present.rows[0].stock);
      const delta=LORENZO_DEFAULTS.stock-currentStock;
      if(delta!==0){
        await createManualStockMovement(client,{
          storeId,productId,delta,
          actor,note:"Lorenzo 10 ürün kataloğu açılış stok mutabakatı · 13.11.2026",
        });
      }
      const final=await client.query("SELECT * FROM dukkan_products WHERE store_id=$1 AND id=$2",
        [storeId,productId]);
      await syncDukkanToB2B(client,final.rows[0]);
    }
    await client.query(
      "INSERT INTO dukkan_requested_product_batches(store_id,batch_key,inserted_count,updated_count) VALUES($1,$2,$3,$4)",
      [storeId,LORENZO_KURUTMALIK_BATCH_KEY,inserted,updated],
    );
    await client.query("COMMIT");
    return {status:"created",storeId,inserted,updated,
      skus:LORENZO_KURUTMALIK_ITEMS.map(v=>v.sku)};
  }catch(error){
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
  }finally{client.release();}
}
