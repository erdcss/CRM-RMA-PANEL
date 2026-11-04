import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Pool, PoolClient } from "pg";
import { importAllB2BToDukkan } from "./dukkan-b2b-sync";

test("automatically import every B2B product once, preserving colliding SKUs and barcodes",async()=>{
  const db=new PGlite();
  try{
    await db.exec([
      "CREATE TABLE dukkan_stores(id BIGINT PRIMARY KEY,name TEXT NOT NULL)",
      "CREATE TABLE dukkan_products("+
        "id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL,sku TEXT NOT NULL,barcode TEXT,"+
        "b2b_source_sku TEXT,b2b_source_barcode TEXT,name TEXT NOT NULL,unit TEXT NOT NULL,"+
        "stock NUMERIC(16,3) NOT NULL DEFAULT 0,purchase_price NUMERIC(18,2) NOT NULL DEFAULT 0,"+
        "sale_price NUMERIC(18,2) NOT NULL DEFAULT 0,brand TEXT,category TEXT,description TEXT,"+
        "image_data TEXT,images JSONB DEFAULT '[]'::jsonb,units_per_box INTEGER NOT NULL DEFAULT 1,"+
        "min_order_qty INTEGER NOT NULL DEFAULT 1,publish_b2b BOOLEAN NOT NULL DEFAULT FALSE,"+
        "b2b_product_id TEXT,UNIQUE(store_id,sku))",
      "CREATE UNIQUE INDEX dukkan_products_barcode_unique ON dukkan_products(store_id,barcode) WHERE barcode IS NOT NULL",
      "CREATE UNIQUE INDEX dukkan_b2b_product_link_unique ON dukkan_products(b2b_product_id) WHERE b2b_product_id IS NOT NULL",
      "CREATE TABLE b2b_products(id TEXT PRIMARY KEY,sku TEXT NOT NULL UNIQUE,name TEXT NOT NULL,barcode TEXT,"+
        "stock INTEGER,price NUMERIC(18,2),brand TEXT,category TEXT,description TEXT,image_data TEXT,images JSONB,"+
        "units_per_box INTEGER,min_order_qty INTEGER,is_active BOOLEAN,created_at TIMESTAMPTZ DEFAULT NOW())",
    ].join(";\n")+";");
    await db.query("INSERT INTO dukkan_stores(id,name) VALUES(1,'ÇALIŞKAN GROUP'),(2,'SECONDARY')");
    await db.query("INSERT INTO dukkan_products(store_id,sku,barcode,name,unit) VALUES(1,'OVERLAP','EXISTING','Existing','adet')");
    await db.query(
      "INSERT INTO b2b_products(id,sku,name,barcode,stock,price,images,is_active) VALUES"+
      "('aa','OVERLAP','Ürün A','DUPLICATE',24,100,'[]',TRUE),"+
      "('bb','B-002','Ürün B','DUPLICATE',15,200,'[]',FALSE),"+
      "('cc','C-003','Ürün C','EXISTING',10,300,'[]',TRUE)",
    );

    const pool={
      connect:async()=>({
        query:async(sql:string,params?:unknown[])=>{
          if(sql.includes("pg_advisory_xact_lock"))return {rows:[],rowCount:1};
          return db.query(sql,params as any[]);
        },
        release:()=>undefined,
      } as unknown as PoolClient),
    } as unknown as Pool;

    const first=await importAllB2BToDukkan(pool,1);
    assert.equal(first.enabled,true);
    assert.equal(first.total,3);
    assert.equal(first.imported,3);
    assert.equal(first.skipped,0);
    const rows=await db.query<{
      name:string;sku:string;barcode:string|null;b2b_source_sku:string;
      b2b_source_barcode:string|null;stock:string;publish_b2b:boolean;
    }>("SELECT name,sku,barcode,b2b_source_sku,b2b_source_barcode,stock::text AS stock,publish_b2b "+
      "FROM dukkan_products WHERE b2b_product_id IS NOT NULL ORDER BY b2b_product_id");
    assert.equal(rows.rows.length,3);
    assert.equal(rows.rows[0].sku,"B2B-aa");
    assert.equal(rows.rows[0].b2b_source_sku,"OVERLAP");
    assert.equal(rows.rows[0].b2b_source_barcode,"DUPLICATE");
    assert.equal(rows.rows[1].b2b_source_barcode,"DUPLICATE");
    assert.equal(rows.rows.filter(r=>r.barcode==="DUPLICATE").length,1);
    assert.equal(rows.rows[2].barcode,null);
    assert.equal(rows.rows[1].publish_b2b,false);
    assert.equal(Number(rows.rows[0].stock),24);

    const repeat=await importAllB2BToDukkan(pool,1);
    assert.equal(repeat.imported,0);
    const other=await importAllB2BToDukkan(pool,2);
    assert.equal(other.enabled,false);
    const total=await db.query<{count:number}>("SELECT COUNT(*)::int AS count FROM dukkan_products");
    assert.equal(total.rows[0].count,4);
    await db.query("INSERT INTO b2b_products(id,sku,name,stock,price,is_active) VALUES('dd','D-004','Ürün D',4,10,TRUE)");
    const next=await importAllB2BToDukkan(pool,1);
    assert.equal(next.imported,1);
    assert.equal(next.total,4);
  }finally{await db.close();}
});
