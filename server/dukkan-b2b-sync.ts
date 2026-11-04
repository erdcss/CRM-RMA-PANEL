import type { Pool, PoolClient } from "pg";

/** One store-owned record controls one B2B product; never match ownership by SKU/barcode. */
export type DukkanCatalogRecord = {
  id: string | number; store_id: string | number; sku: string; name: string;
  b2b_source_sku?: string | null; b2b_source_barcode?: string | null;
  barcode?: string | null; brand?: string | null; category?: string | null;
  description?: string | null; stock: string | number; sale_price: string | number;
  image_data?: string | null; images?: string[] | null;
  publish_b2b: boolean; b2b_product_id?: string | number | null;
  units_per_box?: number | null; min_order_qty?: number | null;
};

export function stockForB2B(value: string | number): number {
  const stock = Number(value);
  if (!Number.isFinite(stock) || stock < 0 || stock > 2147483647) {
    throw Object.assign(new Error("Stok B2B sınırları dışında"), {status:400});
  }
  return Math.floor(stock);
}
export function b2bPublicationAllowed(row: Pick<DukkanCatalogRecord,"publish_b2b"|"images"|"image_data">) {
  return !row.publish_b2b || Boolean(row.image_data || (row.images || []).length);
}
export function imageArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((image): image is string => typeof image === "string" && (
    /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(image) ||
    /^https:\/\//i.test(image) ||
    /^\/uploads\/[a-z0-9._-]+$/i.test(image)
  )).slice(0, 6);
}
export function validateDukkanImages(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 6) {
    throw Object.assign(new Error("En fazla 6 ürün görseli seçebilirsiniz"), {status:400});
  }
  const images = imageArray(value);
  if (images.length !== value.length || images.some(image => image.length > 3_000_000)) {
    throw Object.assign(new Error("Görseller JPG, PNG, WebP veya HTTPS olmalı; her görsel en fazla 3 MB olmalı"), {status:400});
  }
  return images;
}

/** Run after core Dükkan and B2B product tables exist. Repeat-safe on startup. */
export async function ensureDukkanB2BBridge(pool: Pool): Promise<void> {
  const statements = [
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS image_data TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS brand TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS category TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS units_per_box INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS min_order_qty INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS publish_b2b BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS b2b_product_id TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS b2b_source_sku TEXT",
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS b2b_source_barcode TEXT",
    // Legacy install created BIGINT mapping while the production catalog has TEXT IDs.
    "ALTER TABLE dukkan_products ALTER COLUMN b2b_product_id TYPE TEXT USING b2b_product_id::text",
    "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_b2b_product_link_unique ON dukkan_products(b2b_product_id) WHERE b2b_product_id IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS dukkan_products_store_b2b_idx ON dukkan_products(store_id, b2b_product_id)",
    "CREATE OR REPLACE FUNCTION sync_b2b_stock_to_dukkan() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF pg_trigger_depth() > 1 OR current_setting('app.dukkan_sync_origin',true)='dukkan' OR NEW.stock IS NOT DISTINCT FROM OLD.stock THEN RETURN NEW; END IF; UPDATE dukkan_products SET stock=GREATEST(0,stock+(NEW.stock-OLD.stock)) WHERE b2b_product_id=NEW.id::text; RETURN NEW; END $fn$",
    "DROP TRIGGER IF EXISTS b2b_dukkan_stock_bridge ON b2b_products",
    "CREATE TRIGGER b2b_dukkan_stock_bridge AFTER UPDATE OF stock ON b2b_products FOR EACH ROW EXECUTE FUNCTION sync_b2b_stock_to_dukkan()",
    "CREATE OR REPLACE FUNCTION sync_dukkan_stock_to_b2b() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF pg_trigger_depth() > 1 OR NEW.b2b_product_id IS NULL OR NEW.stock IS NOT DISTINCT FROM OLD.stock THEN RETURN NEW; END IF; UPDATE b2b_products SET stock=FLOOR(NEW.stock)::integer, updated_at=NOW() WHERE id::text=NEW.b2b_product_id AND stock IS DISTINCT FROM FLOOR(NEW.stock)::integer; RETURN NEW; END $fn$",
    "DROP TRIGGER IF EXISTS dukkan_b2b_stock_bridge ON dukkan_products",
    "CREATE TRIGGER dukkan_b2b_stock_bridge AFTER UPDATE OF stock ON dukkan_products FOR EACH ROW EXECUTE FUNCTION sync_dukkan_stock_to_b2b()",
  ];
  await pool.query(statements.join(";\n") + ";");
}

export async function syncDukkanToB2B(c: PoolClient, row: DukkanCatalogRecord): Promise<DukkanCatalogRecord> {
  if (!b2bPublicationAllowed(row)) {
    throw Object.assign(new Error("B2B yayını için en az bir ürün görseli ekleyin"), {status:400});
  }
  // Distinguish a product-card update from a B2B sale; never round away fractional
  // Dükkan inventory when writing B2B's integer stock snapshot.
  await c.query("SELECT set_config('app.dukkan_sync_origin','dukkan',true)");
  const images = Array.isArray(row.images) ? row.images : [];
  const photo = images[0] || row.image_data || null;
  const price = Number(row.sale_price);
  const stock = stockForB2B(row.stock);
  const boxSize = Math.max(1, Number(row.units_per_box) || 1);
  const minQty = Math.max(1, Number(row.min_order_qty) || 1);

  if (row.b2b_product_id) {
    const desiredSku=row.b2b_source_sku || row.sku;
    const desiredBarcode=row.b2b_source_barcode || row.barcode || null;
    const conflict=await c.query("SELECT id FROM b2b_products WHERE sku=$1 AND id::text<>$2 LIMIT 1",
      [desiredSku,row.b2b_product_id]);
    const b2bSku=conflict.rowCount?"DUK-"+row.store_id+"-"+row.id:desiredSku;
    const result = await c.query(
      "UPDATE b2b_products SET sku=$2,name=$3,brand=$4,category=$5,description=$6,price=$7,stock=$8," +
      "min_order_qty=$9,units_per_box=$10,image_data=$11,images=$12::jsonb,barcode=$13," +
      "is_active=$14,updated_at=NOW() WHERE id::text=$1 RETURNING id",
      [row.b2b_product_id,b2bSku,row.name,row.brand||null,row.category||"Genel",row.description||null,
       price,stock,minQty,boxSize,photo,JSON.stringify(images),desiredBarcode,row.publish_b2b],
    );
    if (!result.rowCount) throw Object.assign(new Error("Bağlı B2B ürünü bulunamadı; işlem geri alındı"),{status:409});
    return row;
  }

  const existing = await c.query("SELECT id FROM b2b_products WHERE sku=$1 LIMIT 1",[row.sku]);
  const sku = existing.rowCount ? "DUK-"+row.store_id+"-"+row.id : row.sku;
  const created = await c.query(
    "INSERT INTO b2b_products(sku,name,brand,category,description,price,stock,min_order_qty," +
    "units_per_box,image_data,images,barcode,is_active,updated_at) " +
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,NOW()) RETURNING id",
    [sku,row.name,row.brand||null,row.category||"Genel",row.description||null,price,stock,
     minQty,boxSize,photo,JSON.stringify(images),row.barcode||null,row.publish_b2b],
  );
  const linkedId = created.rows[0].id;
  await c.query("UPDATE dukkan_products SET b2b_product_id=$3 WHERE store_id=$1 AND id=$2",
    [row.store_id,row.id,linkedId]);
  return {...row,b2b_product_id:linkedId};
}


/** Bulk-import the B2B catalog into ÇALIŞKAN GROUP; repeat-safe by B2B ID.
 * Duplicate catalog barcodes are kept as source fields, without creating
 * ambiguous store scanner barcodes or overwriting other store products.
 */
export async function importAllB2BToDukkan(pool: Pool, storeId: number): Promise<{
  imported: number; total: number; assignedElsewhere: number; skipped: number; enabled: boolean;
}> {
  const c=await pool.connect();
  try{
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('caliskan_primary_dukkan_b2b_import_v1'))");
    const owner=await c.query(
      "SELECT id FROM dukkan_stores WHERE id=$1 AND LOWER(TRIM(name))=LOWER('ÇALIŞKAN GROUP') LIMIT 1",
      [storeId],
    );
    if(!owner.rows[0]){
      await c.query("COMMIT");
      return {imported:0,total:0,assignedElsewhere:0,skipped:0,enabled:false};
    }
    const count=await c.query("SELECT COUNT(*)::int AS total FROM b2b_products");
    const linked=await c.query(
      "SELECT COUNT(*)::int AS total FROM dukkan_products WHERE b2b_product_id IS NOT NULL AND store_id<>$1",[storeId],
    );
    const query=[
      "INSERT INTO dukkan_products (",
      "store_id,sku,b2b_source_sku,barcode,b2b_source_barcode,name,unit,stock,",
      "purchase_price,sale_price,brand,category,description,image_data,images,",
      "units_per_box,min_order_qty,publish_b2b,b2b_product_id)",
      "SELECT $1,",
      "CASE WHEN EXISTS (SELECT 1 FROM dukkan_products d WHERE d.store_id=$1 AND d.sku=p.sku)",
      "THEN 'B2B-' || p.id::text ELSE p.sku END,",
      "p.sku,",
      "CASE WHEN NULLIF(TRIM(p.barcode),'') IS NOT NULL",
      "AND ranked.barcode_rank=1",
      "AND NOT EXISTS (SELECT 1 FROM dukkan_products d WHERE d.store_id=$1 AND d.barcode=p.barcode)",
      "THEN p.barcode ELSE NULL END,",
      "NULLIF(TRIM(p.barcode),''),",
      "p.name,'adet',GREATEST(0,COALESCE(p.stock,0)),0,COALESCE(p.price,0),",
      "p.brand,p.category,p.description,p.image_data,COALESCE(p.images,'[]'::jsonb),",
      "GREATEST(1,COALESCE(p.units_per_box,1)),GREATEST(1,COALESCE(p.min_order_qty,1)),",
      "COALESCE(p.is_active,TRUE),p.id::text",
      "FROM b2b_products p",
      "JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY NULLIF(TRIM(barcode),'')",
      "ORDER BY created_at,id) AS barcode_rank FROM b2b_products) ranked ON ranked.id=p.id",
      "WHERE NOT EXISTS (SELECT 1 FROM dukkan_products used WHERE used.b2b_product_id=p.id::text)",
      "ON CONFLICT DO NOTHING RETURNING id",
    ].join(" ");
    const created=await c.query(query,[storeId]);
    const missing=await c.query(
      "SELECT COUNT(*)::int AS missing FROM b2b_products b WHERE NOT EXISTS ("+
      "SELECT 1 FROM dukkan_products d WHERE d.b2b_product_id=b.id::text)",
    );
    await c.query("COMMIT");
    return {
      imported:created.rows.length,
      total:Number(count.rows[0]?.total||0),
      assignedElsewhere:Number(linked.rows[0]?.total||0),
      skipped:Number(missing.rows[0]?.missing||0),
      enabled:true,
    };
  }catch(error){
    await c.query("ROLLBACK").catch(()=>undefined);
    throw error;
  }finally{ c.release(); }
}


/** One-time safe import of existing Dükkan inventory as hidden B2B drafts.
 * Existing store products must not become public before their manager opts in.
 * Savepoints isolate an invalid legacy record without hiding the rest of the store.
 */
export async function backfillExistingDukkanProducts(pool: Pool): Promise<void> {
  const c=await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('dukkan_b2b_backfill_v1'))");
    const rows=await c.query(
      "SELECT * FROM dukkan_products WHERE b2b_product_id IS NULL ORDER BY id LIMIT 500 FOR UPDATE",
    );
    for(const row of rows.rows){
      await c.query("SAVEPOINT dukkan_backfill_row");
      try {
        await syncDukkanToB2B(c,row);
        await c.query("RELEASE SAVEPOINT dukkan_backfill_row");
      } catch(error) {
        await c.query("ROLLBACK TO SAVEPOINT dukkan_backfill_row");
        console.warn("Dukkan legacy B2B draft was skipped:",row.store_id,row.id,
          error instanceof Error ? error.message : error);
      }
    }
    await c.query("COMMIT");
  } catch(error) {
    await c.query("ROLLBACK").catch(()=>undefined);
    throw error;
  } finally {
    c.release();
  }
}
