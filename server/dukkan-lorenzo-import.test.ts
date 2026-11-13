import test from "node:test";
import assert from "node:assert/strict";
import {
  LORENZO_KURUTMALIK_ITEMS,LORENZO_DEFAULTS,
  LORENZO_KURUTMALIK_BATCH_KEY,lorenzoSaleCents,priceFromKurus,
} from "./dukkan-lorenzo-import";
import {prependDukkanProductCover} from "./dukkan-thumbnail-images";

const img=(id:number)=>"data:image/png;base64,"+Buffer.from("sample-image-"+id).toString("base64");

test("all 10 exact Lorenzo models and purchase prices are included",()=>{
  assert.equal(LORENZO_KURUTMALIK_ITEMS.length,10);
  assert.equal(new Set(LORENZO_KURUTMALIK_ITEMS.map(x=>x.sku)).size,10);
  const expected=[
    ["GKY 1070",68940,82728],["GKY 1071",74940,89928],
    ["GKY 1140",76140,91368],["GKY 1130",83940,100728],
    ["GKY 1040",83940,100728],["GKY 1125",88140,105768],
    ["GKY 1075",92940,111528],["GKY 1095",101940,122328],
    ["GKY 1050",137940,165528],["GKY 1110",137940,165528],
  ];
  expected.forEach(([sku,purchase,sale],index)=>{
    const item=LORENZO_KURUTMALIK_ITEMS[index];
    assert.equal(item.sku,sku);
    assert.equal(item.purchaseCents,purchase);
    assert.equal(lorenzoSaleCents(item.purchaseCents),sale);
    assert.equal(priceFromKurus(Number(sale)),(Number(sale)/100).toFixed(2));
  });
});
test("stock, packaging, category, brand and publication defaults",()=>{
  assert.equal(LORENZO_KURUTMALIK_BATCH_KEY,"lorenzo-kurutmalik-10-2026-11-13-v1");
  assert.deepEqual(LORENZO_DEFAULTS,{
    brand:"Lorenzo",category:"Kurutmalık",unit:"adet",
    unitsPerBox:6,minOrderQty:1,stock:18,description:"",
    publishB2B:false,
  });
  assert.equal(LORENZO_KURUTMALIK_ITEMS.length*LORENZO_DEFAULTS.stock,180);
  assert.equal(LORENZO_KURUTMALIK_ITEMS.length*LORENZO_DEFAULTS.stock/LORENZO_DEFAULTS.unitsPerBox,30);
});
test("thumbnail drop makes new cover first, retains older gallery photos",()=>{
  const next=prependDukkanProductCover(img(9),[img(1),img(2)],img(1));
  assert.deepEqual(next,[img(9),img(1),img(2)]);
  assert.equal(prependDukkanProductCover(img(1),[img(1),img(2)],img(1)).length,2);
});
test("thumbnail cover maintains six-image cap and rejects unsafe URLs",()=>{
  const originals=Array.from({length:6},(_,i)=>img(i+1));
  const next=prependDukkanProductCover(img(99),originals,null);
  assert.equal(next.length,6);
  assert.equal(next[0],img(99));
  assert.equal(next.at(-1),img(5));
  assert.throws(()=>prependDukkanProductCover("javascript:alert(1)",[],null));
  assert.throws(()=>prependDukkanProductCover("data:image/svg+xml;base64,AAAA",[],null));
});
