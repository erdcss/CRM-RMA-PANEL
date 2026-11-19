import type { B2BProduct } from './api';

// Exactly the same 24-hour window as the B2B website. Use the original
// product creation timestamp (not stock/price edits or updated_at).
export const NEW_ARRIVAL_DURATION_MS = 24 * 60 * 60 * 1000;

export function newArrivalExpiry(createdAt: string | null | undefined): number | null {
  if (!createdAt || typeof createdAt !== 'string') return null;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;
  const expires = created + NEW_ARRIVAL_DURATION_MS;
  return Number.isFinite(expires) ? expires : null;
}

export function isNewArrival(createdAt: string | null | undefined, now = Date.now()): boolean {
  const expires = newArrivalExpiry(createdAt);
  if (expires === null || !Number.isFinite(now)) return false;
  const created = expires - NEW_ARRIVAL_DURATION_MS;
  return now >= created && now < expires;
}

export function splitHomepageProducts(
  products: readonly B2BProduct[],
  now: number = Date.now(),
): { newArrivals: B2BProduct[]; wholesale: B2BProduct[] } {
  const newArrivals: B2BProduct[] = [];
  const wholesale: B2BProduct[] = [];
  for (const product of products) {
    if (isNewArrival(product.created_at, now)) newArrivals.push(product);
    else wholesale.push(product);
  }
  const availableFirst = (rows: B2BProduct[]) => rows.sort(
    (first, second) =>
      Number(!(Number(first.stock) > 0)) - Number(!(Number(second.stock) > 0)),
  );
  return { newArrivals: availableFirst(newArrivals), wholesale: availableFirst(wholesale) };
}

export function nextHomepageArrivalExpiry(
  products: readonly B2BProduct[],
  now: number = Date.now(),
): number | null {
  let closest: number | null = null;
  for (const product of products) {
    if (!isNewArrival(product.created_at, now)) continue;
    const expires = newArrivalExpiry(product.created_at);
    if (expires !== null && (closest === null || expires < closest)) closest = expires;
  }
  return closest;
}
