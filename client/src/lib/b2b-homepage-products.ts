import type { UnifiedB2BProduct } from "./b2b-marketplace-products";
import { isNewArrival, newArrivalExpiry } from "./b2b-new-arrivals";

export type HomepageProductSections = {
  newArrivals: UnifiedB2BProduct[];
  wholesale: UnifiedB2BProduct[];
};

/**
 * Each public product belongs to exactly one homepage section.
 * Product availability is prioritized without changing relative order inside each group.
 */
export function availableProductsFirst(products: readonly UnifiedB2BProduct[]): UnifiedB2BProduct[] {
  return [...products].sort((first, second) =>
    Number(!(Number(first.stock) > 0)) - Number(!(Number(second.stock) > 0)));
}

export function splitHomepageProducts(
  products: readonly UnifiedB2BProduct[],
  now: number = Date.now(),
): HomepageProductSections {
  const newArrivals: UnifiedB2BProduct[] = [];
  const wholesale: UnifiedB2BProduct[] = [];
  for (const product of products) {
    if (isNewArrival(product.created_at, now)) newArrivals.push(product);
    else wholesale.push(product);
  }
  return {
    newArrivals: availableProductsFirst(newArrivals),
    wholesale: availableProductsFirst(wholesale),
  };
}

/** The next instant at which a product moves from the new section to wholesale. */
export function nextHomepageArrivalExpiry(
  products: readonly UnifiedB2BProduct[],
  now: number = Date.now(),
): number | null {
  let closest: number | null = null;
  for (const product of products) {
    if (!isNewArrival(product.created_at, now)) continue;
    const expiry = newArrivalExpiry(product.created_at);
    if (expiry !== null && (closest === null || expiry < closest)) closest = expiry;
  }
  return closest;
}
