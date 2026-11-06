import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeArchiveProductName,resolveArchiveStockCodes} from "./dukkan-archive-stock-codes";

test("normalize case, Turkish characters and catalog punctuation",()=>{
  assert.equal(normalizeArchiveProductName(" MİNİSAN ÇUBUK / Rezistans "), "minisancubukrezistans");
  assert.equal(normalizeArchiveProductName("minisan cubuk rezistans"), "minisancubukrezistans");
});
test("archive invoice print resolves verified stock code including B2B source SKU",()=>{
  const products=[
    {id:1,name:"MİNİSAN ÇUBUK REZİSTANS",sku:"DUK-1",b2b_source_sku:"MIN-402"},
    {id:2,name:"KUMTEL FANLI ISITICI",sku:"KMT-111",b2b_source_sku:null}
  ];
  const lines=[
    {id:44,product_name:"Minisan Cubuk Rezistans",product_id:null,sku:""},
    {id:45,product_name:"Kumtel Fanli Isitici",product_id:null,sku:""},
  ];
  const result=resolveArchiveStockCodes(lines,products);
  assert.deepEqual(result.map(x=>x.sku),["MIN-402","KMT-111"]);
  assert.deepEqual(result.map(x=>x.stock_code_match),["exact","exact"]);
  assert.equal(result[0].product_id,1);
});
test("ambiguous or missing names never invent a product code",()=>{
  const catalog=[
    {id:1,name:"Aynı Ürün",sku:"STK-1"},
    {id:2,name:"AYNI URUN",sku:"STK-2"},
  ];
  const result=resolveArchiveStockCodes([
    {id:5,product_id:null,product_name:"Aynı Ürün"},
    {id:6,product_id:null,product_name:"Bilinmeyen Ürün"}
  ],catalog);
  assert.equal(result[0].sku,"");
  assert.equal(result[0].stock_code_match,"unmatched");
  assert.equal(result[1].sku,"");
});
test("explicit store-verified product mapping takes precedence over source name",()=>{
  const result=resolveArchiveStockCodes([
    {id:6,product_id:2,product_name:"Kaynak Adı"}
  ],[
    {id:1,name:"Kaynak Adı",sku:"NAME-MATCH"},
    {id:2,name:"Gerçek Katalog Ürünü",sku:"LINKED-CODE"}
  ]);
  assert.equal(result[0].sku,"LINKED-CODE");
  assert.equal(result[0].stock_code_match,"linked");
});
