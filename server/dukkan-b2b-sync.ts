import type { Pool, PoolClient } from "pg";

/** One store-owned record controls one B2B product; never match ownership by SKU/barcode. */
export type DukkanCatalogRecord = {
  id: string | number; store_id: string | number; sku: string; name: string;
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
    "ALTER TABLE dukkan_products ADD COLUMN IF NOT EXISTS b2b_product_id BIGINT",
    "CREATE UNIQUE INDEX IF NOT EXISTS dukkan_b2b_product_link_unique ON dukkan_products(b2b_product_id) WHERE b2b_product_id IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS dukkan_products_store_b2b_idx ON dukkan_products(store_id, b2b_product_id)",
    "CREATE OR REPLACE FUNCTION sync_b2b_stock_to_dukkan() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF pg_trigger_depth() > 1 OR NEW.stock IS NOT DISTINCT FROM OLD.stock THEN RETURN NEW; END IF; UPDATE dukkan_products SET stock=NEW.stock WHERE b2b_product_id=NEW.id AND stock IS DISTINCT FROM NEW.stock; RETURN NEW; END $fn$",
    "DROP TRIGGER IF EXISTS b2b_dukkan_stock_bridge ON b2b_products",
    "CREATE TRIGGER b2b_dukkan_stock_bridge AFTER UPDATE OF stock ON b2b_products FOR EACH ROW EXECUTE FUNCTION sync_b2b_stock_to_dukkan()",
    "CREATE OR REPLACE FUNCTION sync_dukkan_stock_to_b2b() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF pg_trigger_depth() > 1 OR NEW.b2b_product_id IS NULL OR NEW.stock IS NOT DISTINCT FROM OLD.stock THEN RETURN NEW; END IF; UPDATE b2b_products SET stock=FLOOR(NEW.stock)::integer, updated_at=NOW() WHERE id=NEW.b2b_product_id AND stock IS DISTINCT FROM FLOOR(NEW.stock)::integer; RETURN NEW; END $fn$",
    "DROP TRIGGER IF EXISTS dukkan_b2b_stock_bridge ON dukkan_products",
    "CREATE TRIGGER dukkan_b2b_stock_bridge AFTER UPDATE OF stock ON dukkan_products FOR EACH ROW EXECUTE FUNCTION sync_dukkan_stock_to_b2b()",
  ];
  await pool.query(statements.join(";\n") + ";");
}

export async function syncDukkanToB2B(c: PoolClient, row: DukkanCatalogRecord): Promise<DukkanCatalogRecord> {
  if (!b2bPublicationAllowed(row)) {
    throw Object.assign(new Error("B2B yayını için en az bir ürün görseli ekleyin"), {status:400});
  }
  const images = Array.isArray(row.images) ? row.images : [];
  const photo = images[0] || row.image_data || null;
  const price = Number(row.sale_price);
  const stock = stockForB2B(row.stock);
  const boxSize = Math.max(1, Number(row.units_per_box) || 1);
  const minQty = Math.max(1, Number(row.min_order_qty) || 1);

  if (row.b2b_product_id) {
    const result = await c.query(
      "UPDATE b2b_products SET name=$2,brand=$3,category=$4,description=$5,price=$6,stock=$7," +
      "min_order_qty=$8,units_per_box=$9,image_data=$10,images=$11::jsonb,barcode=$12," +
      "is_active=$13,updated_at=NOW() WHERE id=$1 RETURNING id",
      [row.b2b_product_id,row.name,row.brand||null,row.category||"Genel",row.description||null,
       price,stock,minQty,boxSize,photo,JSON.stringify(images),row.barcode||null,row.publish_b2b],
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
