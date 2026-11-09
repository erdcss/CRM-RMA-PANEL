import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { createManualStockMovement, changeManualStockMovement } from "./dukkan-stock-adjustments";
import { dukkanStockHistorySql,dukkanStockTotalsSql } from "./dukkan-stock-ledger";

test("manual stock add, edit, remove, retry and audit stay transactional",async()=>{
  const db=new PGlite();
  try {
    await db.exec([
      "CREATE TABLE dukkan_products(id BIGINT PRIMARY KEY,store_id BIGINT NOT NULL,stock NUMERIC(16,3) NOT NULL CHECK(stock>=0),archived_at TIMESTAMPTZ,deleted_at TIMESTAMPTZ)",
      "CREATE TABLE dukkan_stock_movements("+
        "id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL,product_id BIGINT NOT NULL,"+
        "delta NUMERIC(16,3) NOT NULL CHECK(delta<>0),reason TEXT,invoice_id BIGINT,note TEXT,"+
        "created_by INT,request_key UUID,edited_at TIMESTAMPTZ,edited_by INT,"+
        "voided_at TIMESTAMPTZ,voided_by INT,created_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE UNIQUE INDEX dukkan_stock_request_key_unique ON dukkan_stock_movements(store_id,request_key) WHERE request_key IS NOT NULL",
      "CREATE TABLE dukkan_stock_movement_audit(id BIGSERIAL PRIMARY KEY,store_id BIGINT,movement_id BIGINT,"+
        "action TEXT,previous_delta NUMERIC(16,3),new_delta NUMERIC(16,3),previous_note TEXT,"+
        "new_note TEXT,stock_before NUMERIC(16,3),stock_after NUMERIC(16,3),changed_by INT,"+
        "changed_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE TABLE dukkan_invoices(id BIGINT PRIMARY KEY,store_id BIGINT,party_id BIGINT,kind TEXT,invoice_no TEXT,issued_at DATE)",
      "CREATE TABLE dukkan_invoice_lines(id BIGINT PRIMARY KEY,invoice_id BIGINT,product_id BIGINT,"+
        "quantity NUMERIC(16,3),unit_price NUMERIC(18,2),tax_rate NUMERIC(5,2),line_total NUMERIC(18,2))",
      "CREATE TABLE dukkan_parties(id BIGINT PRIMARY KEY,store_id BIGINT,name TEXT)",
      "INSERT INTO dukkan_products(id,store_id,stock) VALUES(4,1,0),(5,1,0)",
    ].join(";\n")+";");
    const c={
      query:async(sql:string,params?:unknown[])=>{
        if(sql.includes("pg_advisory_xact_lock"))return {rows:[],rowCount:1};
        return db.query(sql,params as any[]);
      },
    } as unknown as PoolClient;
    const inTx=async<T>(fn:()=>Promise<T>):Promise<T>=>{
      await db.exec("BEGIN");
      try{const result=await fn();await db.exec("COMMIT");return result;}
      catch(e){await db.exec("ROLLBACK");throw e;}
    };
    const stock=async(productId:number)=>Number((await db.query<{stock:string}>(
      "SELECT stock::text AS stock FROM dukkan_products WHERE store_id=1 AND id=$1",[productId])).rows[0].stock);

    const key="123e4567-e89b-42d3-a456-426614174000";
    const incoming=await inTx(()=>createManualStockMovement(c,{
      storeId:1,productId:4,delta:10,note:"Sayım ile eklendi",actor:1,requestKey:key,
    }));
    assert.equal(Number(incoming.delta),10);
    assert.equal(await stock(4),10);
    const retry=await inTx(()=>createManualStockMovement(c,{
      storeId:1,productId:4,delta:10,note:"Sayım ile eklendi",actor:1,requestKey:key,
    }));
    assert.equal(retry.replayed,true);
    assert.equal(await stock(4),10);
    const outgoing=await inTx(()=>createManualStockMovement(c,{
      storeId:1,productId:4,delta:-10,note:"Stok çıkışı",actor:1,
    }));
    assert.equal(await stock(4),0,"stock should reach exactly zero without rejection");
    const edited=await inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(outgoing.id),actor:1,action:"edit",delta:-6,note:"Düzeltildi",
    }));
    assert.equal(Number(edited.stock),4);
    assert.equal(await stock(4),4);
    const removed=await inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(outgoing.id),actor:1,action:"delete",
    }));
    assert.ok(removed.voided_at);
    assert.equal(await stock(4),10);
    const stats=await db.query<{total:number;net_delta:string}>(dukkanStockTotalsSql,[1,4]);
    assert.equal(stats.rows[0].total,1);
    assert.equal(Number(stats.rows[0].net_delta),10);
    const history=await db.query<{voided_at:string|null;delta:string}>(dukkanStockHistorySql,[1,4,50,0]);
    assert.equal(history.rows.length,2,"voided records stay visible as audit evidence");
    assert.equal(history.rows.filter(x=>x.voided_at!==null).length,1);
    const audit=await db.query<{action:string;previous_delta:string;new_delta:string}>(
      "SELECT action,previous_delta,new_delta FROM dukkan_stock_movement_audit ORDER BY id");
    assert.deepEqual(audit.rows.map(x=>x.action),["edit","delete"]);
    assert.equal(Number(audit.rows[0].previous_delta),-10);
    assert.equal(Number(audit.rows[0].new_delta),-6);
    await assert.rejects(()=>inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(outgoing.id),actor:1,action:"delete",
    })),/daha önce silinmiş/);
    await inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(incoming.id),actor:1,action:"delete",
    }));
    assert.equal(await stock(4),0);

    const sale=await db.query<{id:number}>(
      "INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,invoice_id,note,created_by) "+
      "VALUES(1,4,-1,'sale',99,NULL,1) RETURNING id");
    await assert.rejects(()=>inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(sale.rows[0].id),actor:1,action:"delete",
    })),/Faturaya bağlı/);

    const second=await inTx(()=>createManualStockMovement(c,{
      storeId:1,productId:5,delta:4,note:"4 ürün eklendi",actor:1,
    }));
    await db.query("UPDATE dukkan_products SET stock=0 WHERE id=5");
    await assert.rejects(()=>inTx(()=>changeManualStockMovement(c,{
      storeId:1,movementId:Number(second.id),actor:1,action:"delete",
    })),/eksiye düşüreceği/);
    assert.equal(await stock(5),0);
    const saved=await db.query<{voided_at:string|null}>(
      "SELECT voided_at FROM dukkan_stock_movements WHERE id=$1",[second.id]);
    assert.equal(saved.rows[0].voided_at,null,"failed reversal must not void original movement");
  } finally {await db.close();}
});
