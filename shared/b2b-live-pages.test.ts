import {test} from "node:test";
import {strict as assert} from "node:assert";
import {B2B_LIVE_PAGE_LABELS,classifyB2BLivePage} from "./b2b-live-pages";
test("B2B page presence includes anonymous pages, not just member routes",()=>{
  assert.equal(classifyB2BLivePage("/"),"home");
  assert.equal(classifyB2BLivePage("/kayit-ol"),"register");
  assert.equal(classifyB2BLivePage("/uye-girisi"),"login");
  assert.equal(classifyB2BLivePage("/urun/1234"),"products");
  assert.equal(classifyB2BLivePage("/kategori/Elektrik/alt/Kablolar"),"categories");
  assert.equal(classifyB2BLivePage("/odeme?cart=1"),"payment");
  assert.equal(classifyB2BLivePage("/magaza/example/urun/abc"),"store");
});
test("B2B page presence does not retain full product URLs, search or PII",()=>{
  assert.equal(classifyB2BLivePage("/urun/0123?email=secret@example.com"),"products");
  assert.equal(classifyB2BLivePage("https://example.org/urun/x"),null);
  assert.equal(classifyB2BLivePage(null),null);
  assert.equal(classifyB2BLivePage("/".repeat(1025)),null);
  assert.equal(B2B_LIVE_PAGE_LABELS.products,"Ürün Detayları");
});
