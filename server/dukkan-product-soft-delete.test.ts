import assert from "node:assert/strict";
import test from "node:test";
import type {PoolClient} from "pg";
import {softDeleteDukkanProducts} from "./dukkan-product-soft-delete";

test("deletes products with stock and history by hiding only, preserving historic rows",async()=>{
  const queries:Array<{sql:string;params:unknown[]|undefined}>=[];
  const client={query:async(sql:string,params?:unknown[])=>{
    queries.push({sql,params});
    if(sql.startsWith("UPDATE dukkan_products"))return {rows:[
      {id:"11",stock:"24",b2b_product_id:"991"},
      {id:"12",stock:"0",b2b_product_id:"992"}
    ]};
    if(sql.startsWith("UPDATE b2b_products"))return {rowCount:2,rows:[]};
    throw new Error("Unexpected SQL: "+sql);
  }} as unknown as PoolClient;
  const result=await softDeleteDukkanProducts(client,3,[11,12]);
  assert.deepEqual(result,{affected:2,withStock:1,preservedHistory:true});
  assert.equal(queries.length,2);
  assert.match(queries[0].sql,/WHERE store_id=\$1 AND id=ANY\(\$2::bigint\[\]\)/);
  assert.match(queries[0].sql,/deleted_at=NOW\(\)/);
  assert.match(queries[0].sql,/publish_b2b=FALSE/);
  assert.deepEqual(queries[0].params,[3,[11,12]]);
  assert.match(queries[1].sql,/is_active=FALSE/);
  assert.deepEqual(queries[1].params,[["991","992"]]);
  assert.ok(queries.every(v=>!/^\s*DELETE\b/.test(v.sql)));
  assert.ok(queries.every(v=>!/\bSET stock\s*=/.test(v.sql)));
});

test("local-only products do not touch global B2B catalog",async()=>{
  const calls:string[]=[];
  const client={query:async(sql:string)=>{
    calls.push(sql);return {rows:[{id:"5",stock:"2",b2b_product_id:null}]};
  }} as unknown as PoolClient;
  const result=await softDeleteDukkanProducts(client,1,[5]);
  assert.equal(result.affected,1);
  assert.equal(calls.length,1);
});

test("all selected store products must be updated atomically",async()=>{
  const client={query:async()=>({rows:[{id:"9",stock:0,b2b_product_id:null}]})} as unknown as PoolClient;
  await assert.rejects(()=>softDeleteDukkanProducts(client,1,[9,10]),/listeyi yenileyin/);
});

test("invalid or repeated IDs cannot enter the delete query",async()=>{
  let calls=0;
  const client={query:async()=>{calls++;return {rows:[]};}} as unknown as PoolClient;
  await assert.rejects(()=>softDeleteDukkanProducts(client,2,[5,5]),/Geçersiz/);
  await assert.rejects(()=>softDeleteDukkanProducts(client,2,[]),/Geçersiz/);
  await assert.rejects(()=>softDeleteDukkanProducts(client,2,[0]),/Geçersiz/);
  await assert.rejects(()=>softDeleteDukkanProducts(client,2,Array.from({length:101},(_,i)=>i+1)),/Geçersiz/);
  assert.equal(calls,0);
});
