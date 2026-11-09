import { test } from "node:test";
import assert from "node:assert/strict";
import { META_FEED_COLUMNS,metaCatalogCsv,metaContentIdsCsv,type MetaFeedEntry } from "./meta-catalog-export";

const base:MetaFeedEntry={
  id:"145",title:'Çay Makinesi "Deluxe"',description:"Elektrikli çay makinesi, koli içi 6.",
  availability:"in stock",condition:"new",price:"1299.90 TRY",
  link:"https://b2b.ecalisgan.com/urun/145",
  image_link:"https://b2b.ecalisgan.com/api/b2b/product-image/145",
  brand:"Microstar",mpn:"MC-0373",gtin:"",inventory:"24",product_type:"Elektrikli ev aletleri",
};
test("full Meta feed contains strict English headers and correct values",()=>{
  const csv=metaCatalogCsv([base]);
  const rows=csv.trim().split("\r\n");
  assert.equal(rows.length,2);
  assert.equal(rows[0],META_FEED_COLUMNS.join(","));
  assert.ok(rows[1].includes('"1299.90 TRY"'));
  assert.ok(rows[1].includes('"https://b2b.ecalisgan.com/urun/145"'));
  assert.ok(rows[1].includes('"Çay Makinesi ""Deluxe"""'));
  assert.ok(csv.endsWith("\r\n"));
});
test("content IDs file is headerless, deduped and includes supplier IDs",()=>{
  assert.equal(metaContentIdsCsv([{id:"145"},{id:"145"},{id:"mp-12"},{id:"id"},{id:"=cmd"},{id:"231"}]),
    '"145"\r\n"mp-12"\r\n"231"\r\n');
});
test("empty exports keep their format",()=>{
  assert.equal(metaContentIdsCsv([]),"\r\n");
  assert.equal(metaCatalogCsv([]),META_FEED_COLUMNS.join(",")+"\r\n");
});
