import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import {
  b2bPublicationAllowed,
  ensureDukkanB2BBridge,
  stockForB2B,
  syncDukkanToB2B,
  validateDukkanImages,
} from "./dukkan-b2b-sync";

const example = {
  id: 4, store_id: 2, sku:"KETIL-01", name:"Çelik Ketıl",
  stock:"150.500",sale_price:"399.99", images:[],publish_b2b:false,
};

test("unpublished products may be mirrored as hidden drafts with no image",()=>{
  assert.equal(b2bPublicationAllowed(example),true);
  assert.equal(b2bPublicationAllowed({...example,publish_b2b:true}),false);
  assert.equal(b2bPublicationAllowed({...example,publish_b2b:true,images:["https://example.test/a.png"]}),true);
});

test("integer B2B inventory floors partial unit stock without mutating Dukkan quantity",()=>{
  assert.equal(stockForB2B("150.900"),150);
  assert.equal(stockForB2B("0"),0);
  assert.throws(()=>stockForB2B(-1));
  assert.throws(()=>stockForB2B(Infinity));
});

test("image validation only accepts supported formats and refuses oversized inputs",()=>{
  assert.deepEqual(validateDukkanImages(undefined),[]);
  assert.deepEqual(validateDukkanImages(["https://cdn.example.org/one.png"]),["https://cdn.example.org/one.png"]);
  assert.throws(()=>validateDukkanImages(["javascript:alert(1)"]));
  assert.throws(()=>validateDukkanImages(Array(7).fill("https://example.test/test.png")));
  assert.throws(()=>validateDukkanImages(["data:image/jpeg;base64,"+"A".repeat(3_000_001)]));
});

test("migration creates both scoped stock sync triggers and unique ownership",async()=>{
  let ddl="";
  await ensureDukkanB2BBridge({query:async(value:string)=>{ddl=value;return {rows:[]};}} as unknown as Pool);
  assert.match(ddl,/CREATE UNIQUE INDEX IF NOT EXISTS dukkan_b2b_product_link_unique/);
  assert.match(ddl,/AFTER UPDATE OF stock ON b2b_products/);
  assert.match(ddl,/AFTER UPDATE OF stock ON dukkan_products/);
  assert.match(ddl,/app.dukkan_sync_origin/);
});

test("new store product creates a non-public B2B draft linked by ID instead of SKU ownership",async()=>{
  const sql:string[]=[];
  const mock = {query:async(query:string,args?:unknown[])=>{
    sql.push(query);
    if(query.startsWith("SELECT set_config"))return {rowCount:1,rows:[]};
    if(query.includes("SELECT id FROM b2b_products WHERE sku"))return {rowCount:0,rows:[]};
    if(query.startsWith("INSERT INTO b2b_products")) {
      assert.equal(args?.[0],"KETIL-01"); // Original SKU when available.
      assert.equal(args?.[12],false); // Hidden by default.
      return {rowCount:1,rows:[{id:"42"}]};
    }
    if(query.startsWith("UPDATE dukkan_products SET b2b_product_id"))return {rowCount:1,rows:[]};
    throw Error("Unexpected query "+query);
  }} as unknown as PoolClient;
  const result=await syncDukkanToB2B(mock,example);
  assert.equal(result.b2b_product_id,"42");
  assert.ok(sql.some(line=>line.includes("INSERT INTO b2b_products")));
  assert.ok(sql.some(line=>line.includes("UPDATE dukkan_products SET b2b_product_id")));
});

test("published update without pictures rejects before any B2B modification",async()=>{
  const calls:string[]=[];
  const mock={query:async(query:string)=>{calls.push(query);return {rowCount:1,rows:[]};}} as unknown as PoolClient;
  await assert.rejects(()=>syncDukkanToB2B(mock,{...example,b2b_product_id:42,publish_b2b:true}));
  assert.equal(calls.length,0);
});
