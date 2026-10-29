export type UnifiedB2BProduct = {
  id: number | string;
  created_at?: string | null;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  collection_name?: string | null;
  tags?: string[] | null;
  price?: number | string | null;
  stock?: number | null;
  min_order_qty?: number | null;
  units_per_box?: number | null;
  image_data?: string | null;
  image_url?: string | null;
  seller_slug?: string;
  seller_name?: string;
  seller_logo_url?: string | null;
  marketplace_product_id?: number;
  marketplace?: boolean;
};

export type ApprovedSupplierProduct = {
  id: number;
  created_at?: string | null;
  sku: string;
  stock: number;
  seller_slug: string;
  seller_name: string;
  seller_logo_url?: string | null;
  content: {
    name: string;
    description?: string;
    imageUrl?: string;
    category?: string;
    tags?: string[];
    brand?: string;
    price?: number | string | null;
    unitsPerBox?: number;
    minBoxes?: number;
  };
};

/** Numeric marketplace IDs are separate from admin product IDs. */
export function toUnifiedProduct(row: ApprovedSupplierProduct): UnifiedB2BProduct {
  return {
    id: "mp-" + row.id,
    created_at: row.created_at ?? null,
    marketplace: true,
    marketplace_product_id: Number(row.id),
    seller_slug: row.seller_slug,
    seller_name: row.seller_name,
    seller_logo_url: row.seller_logo_url,
    sku: row.sku,
    stock: Number(row.stock),
    name: row.content.name,
    description: row.content.description || null,
    brand: row.content.brand || null,
    category: row.content.category || null,
    tags: Array.isArray(row.content.tags) ? row.content.tags : [],
    image_url: row.content.imageUrl || null,
    price: row.content.price ?? null,
    units_per_box: Math.max(1, Number(row.content.unitsPerBox) || 1),
    min_order_qty: Math.max(1, Number(row.content.minBoxes) || 1),
  };
}

export async function loadApprovedSupplierProducts(): Promise<UnifiedB2BProduct[]> {
  const response = await fetch("/api/marketplace/products", { credentials: "include" });
  if (!response.ok) throw new Error("Tedarikçi ürünleri yüklenemedi");
  const rows: ApprovedSupplierProduct[] = await response.json();
  return Array.isArray(rows) ? rows.map(toUnifiedProduct) : [];
}

export async function loadApprovedSupplierProduct(id: string): Promise<UnifiedB2BProduct> {
  const productId = Number(id.replace(/^mp-/, ""));
  if (!Number.isSafeInteger(productId) || productId < 1) throw new Error("Ürün bulunamadı");
  const response = await fetch("/api/marketplace/products/" + productId, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 404 ? "Onaylı ürün bulunamadı" : "Ürün yüklenemedi");
  return toUnifiedProduct(await response.json() as ApprovedSupplierProduct);
}

export function unifiedProductHref(item: UnifiedB2BProduct): string {
  return "/urun/" + encodeURIComponent(String(item.id));
}
