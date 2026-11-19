import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewArrival, nextHomepageArrivalExpiry, splitHomepageProducts } from './home-arrivals';
import { asCatalogProduct } from './marketplace-products';
import type { B2BProduct, MarketplaceProduct } from './api';

const now = Date.parse('2026-11-20T08:00:00.000Z');
function product(id: string, ageMs: number, stock: number): B2BProduct {
  return { id, name: id, created_at: new Date(now - ageMs).toISOString(), stock };
}

test('new arrivals on mobile use the same 24-hour creation window as web', () => {
  const fresh = product('new', 23 * 3_600_000, 10);
  const cutoff = product('cutoff', 24 * 3_600_000, 10);
  const legacy = { id: 'legacy', name: 'Legacy', stock: 2 } satisfies B2BProduct;
  assert.equal(isNewArrival(fresh.created_at, now), true);
  assert.equal(isNewArrival(cutoff.created_at, now), false);
  assert.equal(isNewArrival(null, now), false);
  assert.equal(isNewArrival(new Date(now + 1000).toISOString(), now), false);
  assert.deepEqual(splitHomepageProducts([fresh, cutoff, legacy], now).newArrivals.map(x => x.id), ['new']);
  assert.deepEqual(splitHomepageProducts([fresh, cutoff, legacy], now).wholesale.map(x => x.id), ['cutoff', 'legacy']);
  assert.equal(nextHomepageArrivalExpiry([fresh, cutoff], now), now + 3_600_000);
  assert.equal(nextHomepageArrivalExpiry([fresh, cutoff], now + 3_600_000), null);
});

test('mobile prioritizes available products without mutating the original array', () => {
  const rows = [
    product('empty', 1000, 0),
    product('available', 2000, 8),
    product('low', 3000, 1),
    product('old', 40 * 3_600_000, 4),
  ];
  assert.deepEqual(splitHomepageProducts(rows, now).newArrivals.map(x => x.id), [
    'available', 'low', 'empty',
  ]);
  assert.deepEqual(rows.map(x => x.id), ['empty', 'available', 'low', 'old']);
});

test('approved suppliers retain their real creation timestamp and a namespaced id', () => {
  const supplier: MarketplaceProduct = {
    id: 82, created_at: new Date(now - 10_000).toISOString(), sku: 'K-82',
    stock: 12, seller_slug: 'approved-store', seller_name: 'Onaylı Tedarikçi',
    content: { name: 'Koli Ürün', price: 49, imageUrl: 'https://example.com/p.jpg' },
  };
  const mapped = asCatalogProduct(supplier);
  assert.equal(mapped.id, 'mp-82');
  assert.equal(mapped.created_at, supplier.created_at);
  assert.equal(mapped.seller_slug, 'approved-store');
  assert.deepEqual(splitHomepageProducts([mapped], now).newArrivals.map(x => x.id), ['mp-82']);
});
