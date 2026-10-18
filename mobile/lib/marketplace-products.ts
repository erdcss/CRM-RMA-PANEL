import type { B2BProduct, MarketplaceProduct } from './api';

/** IDs are namespaced because mp_products and b2b_products have independent sequences. */
export function asCatalogProduct(item: MarketplaceProduct): B2BProduct {
  return {
    id: 'mp-' + String(item.id),
    sku: item.sku,
    name: item.content.name,
    description: item.content.description || null,
    price: item.content.price,
    stock: Number(item.stock),
    image_data: item.content.imageUrl || null,
    image_url: item.content.imageUrl || null,
    images: item.content.imageUrl ? [item.content.imageUrl] : [],
    barcode: item.content.barcode || null,
    category: item.content.category || null,
    brand: item.content.brand || null,
    units_per_box: Math.max(1, Number(item.content.unitsPerBox) || 1),
    min_order_qty: Math.max(1, Number(item.content.minBoxes) || 1),
    marketplace: true,
    marketplace_product_id: String(item.id),
    seller_slug: item.seller_slug,
    seller_name: item.seller_name,
    seller_logo_url: item.seller_logo_url || null,
  };
}

export function isMarketplaceProduct(item: B2BProduct): boolean {
  return item.marketplace === true && Boolean(item.seller_slug && item.marketplace_product_id);
}

export function productParams(item: B2BProduct) {
  return { id: String(item.id), ...(item.seller_slug ? { slug: item.seller_slug } : {}) };
}
