import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { dukkanStockHistorySql, dukkanStockTotalsSql } from "./dukkan-stock-ledger";

test("per-product ledger joins actual purchase/sale invoice lines at their exact prices",async()=>{
  const db=new PGlite();
  try{
    await db.exec([
      "CREATE TABLE dukkan_stock_movements(id BIGSERIAL PRIMARY KEY,store_id BIGINT,product_id BIGINT,delta NUMERIC(16,3),reason TEXT,invoice_id BIGINT,note TEXT,edited_at TIMESTAMPTZ,voided_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW())",
      "CREATE TABLE dukkan_invoices(id BIGINT PRIMARY KEY,store_id BIGINT,party_id BIGINT,kind TEXT,invoice_no TEXT,issued_at DATE)",
      "CREATE TABLE dukkan_invoice_lines(id BIGSERIAL PRIMARY KEY,invoice_id BIGINT,product_id BIGINT,quantity NUMERIC(16,3),unit_price NUMERIC(18,2),tax_rate NUMERIC(5,2),line_total NUMERIC(18,2))",
      "CREATE TABLE dukkan_parties(id BIGINT PRIMARY KEY,store_id BIGINT,name TEXT)",
    ].join(";\n")+";");

    await db.query("INSERT INTO dukkan_parties(id,store_id,name) VALUES(1,1,'Tedarikçi A'),(2,1,'Müşteri B'),(3,2,'Başka Mağaza')");
    await db.query("INSERT INTO dukkan_invoices(id,store_id,party_id,kind,invoice_no,issued_at) VALUES (11,1,1,'purchase','ALIS-11','2026-11-01'),(12,1,2,'sale','SATIS-12','2026-11-02'),(13,2,3,'purchase','BASKA-13','2026-11-03')");
    await db.query("INSERT INTO dukkan_invoice_lines(invoice_id,product_id,quantity,unit_price,tax_rate,line_total) VALUES(11,7,5,120,20,720),(11,7,2,140,20,336),(12,7,3,450,20,1620),(13,7,90,1,20,108),(11,8,6,99,20,712.8)");
    await db.query("INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,invoice_id,note) VALUES(1,7,5,'purchase',11,NULL),(1,7,2,'purchase',11,NULL),(1,7,-3,'sale',12,NULL),(1,7,4,'adjustment',NULL,'Sayım düzeltmesi'),(2,7,90,'purchase',13,NULL),(1,8,6,'purchase',11,NULL)");

    const summary=await db.query<{
      total:number; net_delta:string; purchased:string; sold:string; manual_in:string;
    }>(dukkanStockTotalsSql,[1,7]);
    assert.equal(summary.rows[0].total,4);
    assert.equal(Number(summary.rows[0].net_delta),8);
    assert.equal(Number(summary.rows[0].purchased),7);
    assert.equal(Number(summary.rows[0].sold),3);
    assert.equal(Number(summary.rows[0].manual_in),4);

    const history=await db.query<{
      id:number; reason:string; invoice_no:string|null; party_name:string|null;
      unit_price:string|null; line_total:string|null; delta:string; note:string|null;
    }>(dukkanStockHistorySql,[1,7,100,0]);
    assert.equal(history.rows.length,4,"Repeated invoice lines must not duplicate stock movements");
    const bought=history.rows.filter(row=>row.reason==="purchase");
    assert.deepEqual(bought.map(row=>Number(row.unit_price)).sort((a,b)=>a-b),[120,140]);
    assert.deepEqual(bought.map(row=>Number(row.line_total)).sort((a,b)=>a-b),[336,720]);
    assert.equal(bought[0].party_name,"Tedarikçi A");
    assert.equal(bought[0].invoice_no,"ALIS-11");

    const sold=history.rows.find(row=>row.reason==="sale");
    assert.equal(Number(sold?.unit_price),450);
    assert.equal(Number(sold?.line_total),1620);
    assert.equal(sold?.party_name,"Müşteri B");

    const manual=history.rows.find(row=>row.reason==="adjustment");
    assert.equal(manual?.invoice_no,null);
    assert.equal(manual?.unit_price,null);
    assert.equal(manual?.note,"Sayım düzeltmesi");

    const page2=await db.query(dukkanStockHistorySql,[1,7,2,2]);
    assert.equal(page2.rows.length,2);
    const other=await db.query(dukkanStockHistorySql,[2,7,100,0]);
    assert.equal(other.rows.length,1);
    assert.equal(Number(other.rows[0].unit_price),1);
    const unrelated=await db.query(dukkanStockHistorySql,[1,8,100,0]);
    assert.equal(unrelated.rows.length,1);
  }finally{await db.close();}
});
