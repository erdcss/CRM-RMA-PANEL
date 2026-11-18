const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("B2B Meta Pixel supports opt-in Lead events", () => {
  const pixel = read("client/src/lib/meta-pixel.ts");
  assert.match(pixel, /"Purchase","Lead","CompleteRegistration"/);
  assert.match(pixel, /metaConsent\(\)!=="granted"/);
});

test("Pending dealer application is Lead, not a completed registration", () => {
  const registration = read("client/src/components/b2b-registration-form.tsx");
  assert.match(registration, /if\(result\.reapplied!==true\)trackMetaEvent\("Lead"/);
  assert.doesNotMatch(registration, /trackMetaEvent\("CompleteRegistration"/);
});

test("Checkout items use catalog IDs rather than SKUs", () => {
  const payment = read("client/src/pages/b2b-payment.tsx");
  assert.match(payment, /content_ids:preview\.items\.map\(item=>String\(item\.product\.id\)\)/);
  assert.match(payment, /contents:preview\.items\.map\(item=>\(\{id:String\(item\.product\.id\)/);
  assert.doesNotMatch(payment, /content_ids:preview\.items\.map\(item=>String\(item\.product\.sku/);
  const feed = read("server/meta-catalog.ts");
  assert.match(feed, /SITE \+ "\/urun\/" \+ encodeURIComponent\(id\)/);
});

test("Product views and AddToCart use the same product ID", () => {
  const product = read("client/src/pages/b2b-product.tsx");
  assert.match(product, /trackMetaProductView\(product\.id/);
  assert.match(product, /trackMetaEvent\("AddToCart"/);
  assert.match(product, /content_ids:\[String\(product\.id\)\]/);
});
