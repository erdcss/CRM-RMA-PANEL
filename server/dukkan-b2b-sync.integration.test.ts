import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { ensureDukkanB2BBridge } from "./dukkan-b2b-sync";

test("PostgreSQL stock bridge updates both directions without a recursive trigger loop",async()=>{
  const db=new PGlite();
  try{
    await db.exec(
      "CREATE TABLE b2b_products(id TEXT PRIMARY KEY,stock INTEGER NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"+
      "CREATE TABLE dukkan_products(id BIGINT PRIMARY KEY,store_id BIGINT NOT NULL,sku TEXT,name TEXT,stock NUMERIC(16,3) NOT NULL,b2b_product_id BIGINT);",
    );
    const proxy={query:async (sql:string)=>{await db.exec(sql);return {rows:[]};}} as unknown as Pool;
    await ensureDukkanB2BBridge(proxy);
    await db.query("INSERT INTO b2b_products(id,stock) VALUES($1,10)",["eac6e227a95bb5347f51965f62e6b014"]);
    await db.query("INSERT INTO dukkan_products(id,store_id,sku,name,stock,b2b_product_id) VALUES(1,2,'AA','AA','10.750',NULL)");
    await db.query("UPDATE dukkan_products SET b2b_product_id=$1 WHERE id=1",["eac6e227a95bb5347f51965f62e6b014"]);
    const idType=await db.query<{type:string}>("SELECT data_type AS type FROM information_schema.columns WHERE table_name='dukkan_products' AND column_name='b2b_product_id'");
    assert.equal(idType.rows[0].type,"text");
    await db.query("UPDATE dukkan_products SET stock='9.750' WHERE id=1");
    const afterDukkan=await db.query<{stock:number}>("SELECT stock FROM b2b_products WHERE id='eac6e227a95bb5347f51965f62e6b014'");
    assert.equal(afterDukkan.rows[0].stock,9);
    const storeUnrounded=await db.query<{stock:string}>("SELECT stock::text AS stock FROM dukkan_products WHERE id=1");
    assert.equal(Number(storeUnrounded.rows[0].stock),9.75);

    await db.query("UPDATE b2b_products SET stock=4 WHERE id=$1",["eac6e227a95bb5347f51965f62e6b014"]);
    const afterB2B=await db.query<{stock:string}>("SELECT stock::text AS stock FROM dukkan_products WHERE id=1");
    // The B2B delta must not discard the store's fractional unit remainder.
    assert.equal(Number(afterB2B.rows[0].stock),4.75);
  }finally{
    await db.close();
  }
});
