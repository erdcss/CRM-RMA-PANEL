import assert from "node:assert/strict";
import test from "node:test";
import { availableProductsFirst, splitHomepageProducts, nextHomepageArrivalExpiry } from "./b2b-homepage-products";
import type { UnifiedB2BProduct } from "./b2b-marketplace-products";

const at = Date.parse("2026-11-18T12:00:00.000Z");
const product = (id: string, ageMs: number, stock: number): UnifiedB2BProduct => ({
  id, name: id, created_at: new Date(at - ageMs).toISOString(), stock,
});

test("new products are excluded from wholesale and out of stock items go to the bottom", () => {
  const input = [
    product("new-empty", 2000, 0),
    product("old-empty", 30 * 3600_000, 0),
    product("new-in-stock", 1000, 12),
    product("old-in-stock", 72 * 3600_000, 5),
    product("new-low-stock", 1000, 1),
    product("old-other-empty", 50 * 3600_000, 0),
  ];
  const sections = splitHomepageProducts(input, at);
  assert.deepEqual(sections.newArrivals.map(p => p.id), [
    "new-in-stock", "new-low-stock", "new-empty",
  ]);
  assert.deepEqual(sections.wholesale.map(p => p.id), [
    "old-in-stock", "old-empty", "old-other-empty",
  ]);
  assert.deepEqual([...sections.newArrivals, ...sections.wholesale].map(p => p.id).sort(),
    input.map(p => p.id).sort());
  assert.deepEqual(input.map(p => p.id), [
    "new-empty", "old-empty", "new-in-stock", "old-in-stock", "new-low-stock", "old-other-empty",
  ]);
});

test("24 hour boundary switches sections and expiry reschedules only when needed", () => {
  const fresh = product("fresh", 23 * 3600_000, 4);
  const expired = product("expired", 24 * 3600_000, 2);
  const missing: UnifiedB2BProduct = { id: "legacy", stock: 1, created_at: null };
  assert.deepEqual(splitHomepageProducts([fresh, expired, missing], at).newArrivals.map(p=>p.id), ["fresh"]);
  assert.deepEqual(splitHomepageProducts([fresh, expired, missing], at).wholesale.map(p=>p.id), ["expired", "legacy"]);
  const expiry = nextHomepageArrivalExpiry([fresh, expired, missing], at);
  assert.equal(expiry, at + 3600_000);
  assert.equal(nextHomepageArrivalExpiry([fresh, expired], at + 3600_000), null);
  assert.deepEqual(splitHomepageProducts([fresh], at + 3600_000).wholesale.map(p=>p.id), ["fresh"]);
});

test("future timestamps are not new; null/unknown stock is sorted as unavailable", () => {
  const future = product("future", -1000, 20);
  const legacy: UnifiedB2BProduct = { id:"legacy", created_at:null, stock:null };
  const inStock = product("in-stock", 48*3600_000, 1);
  const sections = splitHomepageProducts([future, legacy, inStock], at);
  assert.equal(sections.newArrivals.length, 0);
  assert.deepEqual(sections.wholesale.map(p => p.id), ["future", "in-stock", "legacy"]);
});

test("full two-column catalog keeps new arrivals and older products together once each", () => {
  const input = [
    product("new-in-stock", 1000, 12),
    product("old-empty", 48 * 3600_000, 0),
    product("old-in-stock", 48 * 3600_000, 8),
    product("new-empty", 500, 0),
  ];
  const fullCatalog = availableProductsFirst(input);
  assert.deepEqual(fullCatalog.map(p => p.id), [
    "new-in-stock", "old-in-stock", "old-empty", "new-empty",
  ]);
  assert.equal(new Set(fullCatalog.map(p => p.id)).size, input.length);
  const featuredNew = splitHomepageProducts(input, at).newArrivals;
  assert.ok(featuredNew.every(p => fullCatalog.some(item => item.id === p.id)));
});
