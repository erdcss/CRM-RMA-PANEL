import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getBusinessReviewFixture } from "./review-fixtures";

test("reviewer sees the same dashboard sample shape as real Business UI", () => {
  const summary = getBusinessReviewFixture("/api/admin/dashboard-overview") as Record<string, unknown>;
  assert.equal(summary.orderCount, 2);
  assert.ok(Array.isArray(summary.recentOrders));
});
test("reviewer can explore production orders and product screens using non-live records", () => {
  const orders = getBusinessReviewFixture("/api/admin/orders") as Array<{id:string}>;
  const products = getBusinessReviewFixture("/api/admin/b2b-products") as Array<{id:string}>;
  assert.ok(orders.length>0);
  assert.ok(products.length>0);
  assert.equal((getBusinessReviewFixture("/api/admin/orders/"+orders[0].id) as {id:string}).id,orders[0].id);
  assert.equal((getBusinessReviewFixture("/api/admin/b2b-products/"+products[0].id) as {id:string}).id,products[0].id);
  assert.match(JSON.stringify(orders),/DEMO-/);
});
test("fixture gateway rejects unknown and real data endpoints", () => {
  assert.throws(()=>getBusinessReviewFixture("/api/admin/orders/123"),/Örnek sipariş/);
  assert.throws(()=>getBusinessReviewFixture("/api/admin/secret"),/gerçek işletme/);
  assert.throws(()=>getBusinessReviewFixture("/api/marketplace/me"),/gerçek işletme/);
});
test("review account is routed into the actual Business shell, not an alternate mock screen", () => {
  const app=readFileSync("business-mobile/App.tsx","utf8");
  const api=readFileSync("business-mobile/lib/api.ts","utf8");
  assert.ok(!app.includes("<BusinessReviewScreen"));
  assert.ok(app.includes("<DashboardScreen"));
  assert.ok(app.includes("<OrdersScreen"));
  assert.ok(app.includes("<ProductsScreen"));
  assert.ok(app.includes("<CustomersScreen"));
  assert.ok(app.includes("<GlassTabBar"));
  assert.match(api,/session\.user\.role === "business_reviewer"/);
  assert.match(api,/method !== "GET"/);
});
