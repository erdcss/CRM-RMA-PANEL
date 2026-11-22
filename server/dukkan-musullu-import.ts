import type { PoolClient } from "pg";
import { z } from "zod";
import { syncDukkanToB2B, validateDukkanImages } from "./dukkan-b2b-sync";

// The source file is generated from the supplier PDF, then uploaded by a store manager.
// Never use supplier availability as local on-hand inventory.
const productSchema = z.object({
  sku: z.string().trim().min(1).max(140),
  sourceSku: z.string().trim().max(140).optional().default(""),
  name: z.string().trim().min(1).max(300),
  brand: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(180),
  purchasePrice: z.number().finite().nonnegative().max(100000000),
  salePrice: z.number().finite().nonnegative().max(100000000),
  unitsPerBox: z.number().int().positive().max(100000),
  minOrderQty: z.number().int().positive().max(100000).default(1),
  barcode: z.string().trim().max(120).optional().default(""),
  images: z.array(z.string()).min(1).max(6),
  sourcePage: z.number().int().min(1).max(9),
  sourceRow: z.number().int().min(1),
  sourceImageQuality: z.string().optional(),
});
const fileSchema = z.object({
  format: z.literal("caliskan-dukkan-musullu-v1"),
  source: z.literal("Musullu Toptan(98).pdf"),
  products: z.array(productSchema).min(1).max(200),
});

export type MusulluImportOutcome = {
  inputCount: number;
  inserted: number;
  skipped: number;
  b2bPublished: false;
  stock: 0;
  duplicates: Array<{sku:string;reason:string}>;
};

export async function importMusulluDukkanCatalog(
  c: PoolClient,
  storeId: number,
  input: unknown,
): Promise<MusulluImportOutcome> {
  const file = fileSchema.parse(input);
  const normalized = new Set<string>();
  const result: MusulluImportOutcome = {
    inputCount:file.products.length,inserted:0,skipped:0,b2bPublished:false,stock:0,duplicates:[],
  };
  // Validate the entire source before any store mutation.
  const prepared = file.products.map((p)=>{
    const key = p.sku.toLocaleLowerCase("tr-TR");
    if(normalized.has(key)) throw Object.assign(new Error("Dosyada tekrarlanan stok kodu: "+p.sku),{status:400});
    normalized.add(key);
    const cents = Math.round(p.purchasePrice*100);
    if(!Number.isSafeInteger(cents) || Math.abs(cents/100-p.purchasePrice)>0.00001)
      throw Object.assign(new Error("Geçersiz alış fiyatı: "+p.sku),{status:400});
    const saleCents = Math.round(cents*110/100);
    if(Math.abs(saleCents/100-p.salePrice)>0.011)
      throw Object.assign(new Error("Yüzde 10 satış fiyatı uyuşmuyor: "+p.sku),{status:400});
    const images = validateDukkanImages(p.images);
    const note = [
      "Kaynak: Musullu Kasım 2026 tedarikçi PDF, sayfa "+p.sourcePage+" satır "+p.sourceRow+".",
      p.sourceSku && p.sourceSku!==p.sku ? "Katalogdaki model kodu: "+p.sourceSku+"." : "",
      "Görsel: Orijinal PDF'den; düşük çözünürlüklü, kalite kontrolü gerekli.",
      "Tedarikçi stok bilgisi Çalışkan Dükkan stok miktarına işlenmedi.",
    ].filter(Boolean).join(" ");
    return {...p, images, cents, saleCents, note};
  });
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",["musullu_dukkan_import_"+storeId]);
  for(const p of prepared){
    const added = await c.query(
      "INSERT INTO dukkan_products(store_id,name,sku,barcode,unit,stock,purchase_price,sale_price,"+
      "brand,category,description,images,image_data,units_per_box,min_order_qty,publish_b2b) "+
      "VALUES($1,$2,$3,$4,'adet',0,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,FALSE) "+
      "ON CONFLICT DO NOTHING RETURNING *",
      [storeId,p.name,p.sku,p.barcode||null,(p.cents/100).toFixed(2),
       (p.saleCents/100).toFixed(2),p.brand,p.category,p.note,
       JSON.stringify(p.images),p.images[0],p.unitsPerBox,p.minOrderQty],
    );
    if(!added.rows[0]){
      const existing = await c.query(
        "SELECT sku,barcode FROM dukkan_products WHERE store_id=$1 AND (sku=$2 OR (barcode IS NOT NULL AND barcode=$3)) LIMIT 1",
        [storeId,p.sku,p.barcode||""],
      );
      result.skipped++;
      result.duplicates.push({
        sku:p.sku,
        reason:existing.rows[0]?.sku===p.sku?"Stok kodu mevcut, değiştirilmedi":
          "Barkod başka ürüne kayıtlı, işlem atlandı",
      });
      continue;
    }
    // Dükkan's normal bridge creates a HIDDEN B2B row; it never publishes it.
    await syncDukkanToB2B(c,added.rows[0]);
    result.inserted++;
  }
  return result;
}
