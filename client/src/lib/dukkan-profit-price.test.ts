import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkupPercent,parsePriceInput,productProfitPreview,suggestedSaleFromMarkup } from "./dukkan-profit-price";

test("quick markup 10/20/30 percent derives sale from purchase, not from current sale",()=>{
  assert.equal(suggestedSaleFromMarkup("100",10),110);
  assert.equal(suggestedSaleFromMarkup("100",20),120);
  assert.equal(suggestedSaleFromMarkup("100",30),130);
  assert.equal(suggestedSaleFromMarkup("199.90",20),239.88);
});
test("manual markup supports Turkish decimal and produces 2-decimal prices",()=>{
  assert.equal(parseMarkupPercent("17,5"),17.5);
  assert.equal(suggestedSaleFromMarkup("100","17,5"),117.5);
  assert.equal(suggestedSaleFromMarkup("33.33","12.5"),37.5);
  assert.equal(suggestedSaleFromMarkup("199.99",10),219.99);
});
test("live sale edit shows actual markup and profit without applying a preset",()=>{
  const preview=productProfitPreview("100","120");
  assert.ok(preview);
  assert.equal(preview.profit,20);
  assert.equal(preview.markupPercent,20);
  assert.ok(Math.abs(preview.marginPercent-16.6666667)<0.00001);
});
test("negative profit is visible when existing sale is below purchase",()=>{
  const preview=productProfitPreview("150","120");
  assert.ok(preview);
  assert.equal(preview.profit,-30);
  assert.equal(preview.markupPercent,-20);
  assert.equal(preview.marginPercent,-25);
});
test("invalid purchase or custom percentage never changes sale price",()=>{
  assert.equal(suggestedSaleFromMarkup("0",20),null);
  assert.equal(suggestedSaleFromMarkup("",20),null);
  assert.equal(suggestedSaleFromMarkup("100",""),null);
  assert.equal(suggestedSaleFromMarkup("100","-10"),null);
  assert.equal(suggestedSaleFromMarkup("100","no"),null);
  assert.equal(suggestedSaleFromMarkup("100","1001"),null);
  assert.equal(parsePriceInput(""),null);
  assert.equal(productProfitPreview("0","150"),null);
  assert.equal(productProfitPreview("invalid","150"),null);
});
test("loss and zero sales are clear and never divide by zero",()=>{
  const preview=productProfitPreview("100","0");
  assert.ok(preview);
  assert.equal(preview.profit,-100);
  assert.equal(preview.markupPercent,-100);
  assert.equal(preview.marginPercent,0);
});
