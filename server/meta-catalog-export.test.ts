import { test } from "node:test";
import assert from "node:assert/strict";
import { META_FEED_COLUMNS,metaCatalogCsv,metaContentIdsCsv,metaContentIdsText,type MetaFeedEntry } from "./meta-catalog-export";

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
    '145\nmp-12\n231\n');
  assert.equal(metaContentIdsText([{id:"145"},{id:"mp-12"}]),'145\nmp-12\n');
  assert.equal(metaContentIdsText([{id:" 145 "},{id:"145"}]),'145\n');
  assert.equal(metaContentIdsText([{id:"=1+1"},{id:"x,y"},{id:"10\n11"}]),'');
});
test("real legacy B2B TEXT and UUID IDs export without being silently removed",()=>{
  const md5="8a7be2fc0d98f04ea417d6bf013ca629";
  const uuid="4c73039f-80bb-4f5a-9c91-12ab3cd456ef";
  const mixed="MC-0373_xA.12";
  const list=[
    {id:md5},{id:uuid},{id:mixed},{id:"mp-38"},{id:"178"},
    {id:md5},{id:"../../path"},{id:"=HYPERLINK(1)"},{id:"-1"},
    {id:"leading whitespace"},{id:"abc,def"},{id:"abc\\ndef"},
    {id:"X".repeat(101)},
  ];
  const contents=metaContentIdsText(list);
  assert.equal(contents,[md5,uuid,mixed,"mp-38","178"].join("\\n")+"\\n");
  const actualLines=contents.trim().split("\\n");
  assert.equal(actualLines.length,5);
  assert.ok(actualLines.every(id=>!id.includes('"')));
  assert.equal(contents.charCodeAt(0),md5.charCodeAt(0));
});
test("empty exports keep their format",()=>{
  assert.equal(metaContentIdsCsv([]),"");
  assert.equal(metaCatalogCsv([]),META_FEED_COLUMNS.join(",")+"\r\n");
});
