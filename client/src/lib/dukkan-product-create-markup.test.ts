import test from "node:test";
import assert from "node:assert/strict";
import {applyDukkanNewProductMarkup,updateDukkanNewProductPrice} from "./dukkan-product-create-markup";
import {productProfitPreview} from "./dukkan-profit-price";

test("new-product form preset buttons set the sale price using purchase cost",()=>{
  const base={name:"16 TEL BASTONLU ŞEMSİYE",purchasePrice:"1250",salePrice:"1550"};
  assert.equal(applyDukkanNewProductMarkup(base,"10","").salePrice,"1375.00");
  assert.equal(applyDukkanNewProductMarkup(base,"20","").salePrice,"1500.00");
  assert.equal(applyDukkanNewProductMarkup(base,"30","").salePrice,"1625.00");
  assert.equal(base.salePrice,"1550");
});
test("manual Turkish percentage and edited purchase price recalculate while preset active",()=>{
  const original={purchasePrice:"1250",salePrice:"1550"};
  assert.equal(applyDukkanNewProductMarkup(original,"custom","17,5").salePrice,"1468.75");
  assert.equal(updateDukkanNewProductPrice(original,"purchasePrice","1500","20","").salePrice,"1800.00");
  assert.equal(updateDukkanNewProductPrice(original,"purchasePrice","1500","custom","17,5").salePrice,"1762.50");
});
test("manual sale price changes remain manual; invalid input never alters existing sale",()=>{
  const original={purchasePrice:"1250",salePrice:"1550"};
  assert.equal(updateDukkanNewProductPrice(original,"salePrice","1650",null,"").salePrice,"1650");
  assert.equal(updateDukkanNewProductPrice(original,"purchasePrice","1500",null,"").salePrice,"1550");
  assert.strictEqual(applyDukkanNewProductMarkup(original,"custom","not-a-rate"),original);
  assert.strictEqual(applyDukkanNewProductMarkup(original,"20",""),applyDukkanNewProductMarkup(original,"20","")===original?original:original);
});
test("new product preview shows unit profit, cost mark-up, and sale margin separately",()=>{
  const result=productProfitPreview("1250","1550");
  assert.ok(result);
  assert.equal(result.profit,300);
  assert.equal(result.markupPercent,24);
  assert.ok(Math.abs(result.marginPercent-19.3548387096774)<0.000001);
});
