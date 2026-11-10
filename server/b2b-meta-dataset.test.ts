import test from "node:test";
import assert from "node:assert/strict";
import type {Pool} from "pg";
import {activateCaliskanMetaDataset,CALISKAN_META_PIXEL_ID,DATASET_ACTIVATION_MARKER,requestedMetaTrackingConfig} from "./b2b-meta-dataset";

test("migrated dataset matches provided Meta Pixel without silently turning tracking back on",()=>{
  assert.deepEqual(requestedMetaTrackingConfig('{"enabled":false,"pixelId":"949840147857568"}'),
    {enabled:false,pixelId:CALISKAN_META_PIXEL_ID});
  assert.deepEqual(requestedMetaTrackingConfig('{"enabled":true,"pixelId":"949840147857568"}'),
    {enabled:true,pixelId:CALISKAN_META_PIXEL_ID});
  assert.deepEqual(requestedMetaTrackingConfig("malformed"),{enabled:true,pixelId:CALISKAN_META_PIXEL_ID});
  assert.equal(CALISKAN_META_PIXEL_ID,"1496993098956595");
});

function mockDb(initial:unknown,applied=false){
  const store=new Map<string,string>();
  if(initial!==undefined)store.set("b2b_meta_tracking",typeof initial==="string"?initial:JSON.stringify(initial));
  if(applied)store.set(DATASET_ACTIVATION_MARKER,"applied");
  let rollbacks=0,commits=0,released=0;
  const query=async(sql:string,params:unknown[]=[]):Promise<{rows:Array<Record<string,unknown>>}>=>{
    if(sql==="BEGIN"||sql==="SELECT pg_advisory_xact_lock($1::bigint)")return {rows:[]};
    if(sql==="COMMIT"){commits++;return {rows:[]};}
    if(sql==="ROLLBACK"){rollbacks++;return {rows:[]};}
    if(sql.includes("SELECT 1 FROM platform_settings"))return {rows:store.has(DATASET_ACTIVATION_MARKER)?[{exists:true}]:[]};
    if(sql.includes("SELECT value FROM platform_settings"))return {rows:store.has("b2b_meta_tracking")?[{value:store.get("b2b_meta_tracking")}]:[]};
    if(sql.includes("INSERT INTO platform_settings")&&sql.includes("'b2b_meta_tracking'")){
      store.set("b2b_meta_tracking",String(params[0]));return {rows:[]};
    }
    if(sql.includes("INSERT INTO platform_settings")&&sql.includes("'applied'")){
      store.set(String(params[0]),"applied");return {rows:[]};
    }
    throw Error("Unexpected query "+sql);
  };
  return {
    store,
    stats:()=>({commits,rollbacks,released}),
    pool:{connect:async()=>({query,release:()=>{released++;}})} as unknown as Pick<Pool,"connect">,
  };
}

test("existing disabled Pixel is swapped once and remains disabled",async()=>{
  const db=mockDb({enabled:false,pixelId:"949840147857568"});
  assert.equal(await activateCaliskanMetaDataset(db.pool),true);
  assert.deepEqual(JSON.parse(db.store.get("b2b_meta_tracking")||"{}"),{enabled:false,pixelId:CALISKAN_META_PIXEL_ID});
  assert.equal(db.store.get(DATASET_ACTIVATION_MARKER),"applied");
  db.store.set("b2b_meta_tracking",JSON.stringify({enabled:true,pixelId:"manual-owner-override"}));
  assert.equal(await activateCaliskanMetaDataset(db.pool),false);
  assert.equal(JSON.parse(db.store.get("b2b_meta_tracking")||"{}").pixelId,"manual-owner-override");
  assert.deepEqual(db.stats(),{commits:2,rollbacks:0,released:2});
});

test("a new installation starts with the requested ID and correct activation marker",async()=>{
  const db=mockDb(undefined);
  assert.equal(await activateCaliskanMetaDataset(db.pool),true);
  assert.deepEqual(JSON.parse(db.store.get("b2b_meta_tracking")||"{}"),{enabled:true,pixelId:CALISKAN_META_PIXEL_ID});
});
