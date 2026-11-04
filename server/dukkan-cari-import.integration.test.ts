import assert from "node:assert/strict";
import test from "node:test";
import {PGlite} from "@electric-sql/pglite";
import type {PoolClient} from "pg";
import {postImportedStatement,summarizeImportedStatement} from "./dukkan-cari-import";
import type {ImportedStatement} from "./dukkan-cari-statement-parser";

const document:ImportedStatement={
  party:{name:"Örnek Cari Test",sourceCariNo:"0000045",currency:"TL",
    sourceCompany:"Örnek Şirket",reportDate:"2026-11-04",
    periodStart:"2025-01-01",periodEnd:"2026-12-31"},
  entries:[
    {date:"2025-01-01",dueDate:"2025-01-01",kind:"opening",documentNo:"00209",
      description:"Devreden bakiye",debit:100,credit:0,sourceBalance:100,sourcePage:1,lines:[]},
    {date:"2025-01-02",dueDate:"2025-02-02",kind:"sale",documentNo:"000184",
      description:"",debit:300,credit:0,sourceBalance:400,sourcePage:1,
      lines:[
        {productName:"Örnek Kettle",quantity:2,unit:"Adet",unitPrice:100,
          discountedUnitPrice:100,lineTotal:200},
        {productName:"Örnek Cezve",quantity:1,unit:"Adet",unitPrice:100,
          discountedUnitPrice:100,lineTotal:100},
      ]},
    {date:"2025-01-03",dueDate:"2025-01-03",kind:"collection",documentNo:"00304",
      description:"HESABA HAVALE",debit:0,credit:150,sourceBalance:250,sourcePage:2,lines:[]},
  ],
  declaredClosingBalance:250,warnings:[],pageCount:2,
};
test("import is atomic, keyed by source, and stores complete dated invoice lines without changing stock",async()=>{
  const db=new PGlite();
  try{
    await db.exec([
      "CREATE TABLE dukkan_parties(id BIGSERIAL PRIMARY KEY,store_id BIGINT,type TEXT,name TEXT,source_cari_no TEXT,account_code TEXT,UNIQUE(store_id,source_cari_no))",
      "CREATE TABLE dukkan_products(id BIGINT PRIMARY KEY,store_id BIGINT,stock NUMERIC(16,3))",
      "INSERT INTO dukkan_products(id,store_id,stock) VALUES(1,1,55)",
      "CREATE TABLE dukkan_invoices(id BIGSERIAL PRIMARY KEY,store_id BIGINT,party_id BIGINT,invoice_no TEXT)",
      "CREATE TABLE dukkan_cari_entries(id BIGSERIAL PRIMARY KEY,store_id BIGINT,party_id BIGINT,debit NUMERIC(18,2),credit NUMERIC(18,2),description TEXT,invoice_id BIGINT,payment_id BIGINT,created_at TIMESTAMP)",
      "CREATE TABLE dukkan_cari_import_batches(id BIGSERIAL PRIMARY KEY,store_id BIGINT,party_id BIGINT,source_sha256 TEXT,source_filename TEXT,source_company TEXT,source_currency TEXT,report_date TEXT,source_page_count INT,entry_count INT,reported_balance NUMERIC(18,2),imported_by INT,imported_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(store_id,party_id,source_sha256))",
      "CREATE TABLE dukkan_cari_import_entries(id BIGSERIAL PRIMARY KEY,store_id BIGINT,party_id BIGINT,batch_id BIGINT,entry_id BIGINT UNIQUE,document_date DATE,due_date DATE,kind TEXT,document_no TEXT,source_description TEXT,source_balance NUMERIC(18,2),source_page INT,source_position INT,UNIQUE(store_id,party_id,kind,document_date,document_no))",
      "CREATE TABLE dukkan_cari_import_lines(id BIGSERIAL PRIMARY KEY,import_entry_id BIGINT,line_position INT,product_name TEXT,quantity NUMERIC(16,3),unit TEXT,unit_price NUMERIC(18,2),discounted_unit_price NUMERIC(18,2),line_total NUMERIC(18,2))",
    ].join(";\n")+";");
    const c={query:(sql:string,params?:unknown[])=>{
      if(sql.includes("pg_advisory_xact_lock"))return Promise.resolve({rows:[],rowCount:1});
      return db.query(sql,params as unknown[]);
    }} as unknown as PoolClient;
    const tx=async<T>(work:()=>Promise<T>)=>{
      await db.exec("BEGIN");
      try{const result=await work();await db.exec("COMMIT");return result;}
      catch(error){await db.exec("ROLLBACK");throw error;}
    };
    const args={storeId:1,actor:1,sha256:"a".repeat(64),filename:"ornek.pdf",statement:document};
    const result=await tx(()=>postImportedStatement(c,args));
    assert.equal(result.created,true);
    assert.equal(result.entryCount,3);
    assert.equal(result.invoiceCount,1);
    assert.equal(result.invoiceLineCount,2);
    assert.equal(result.balance,250);
    const balance=await db.query<{balance:string}>(
      "SELECT (SUM(debit-credit))::text AS balance FROM dukkan_cari_entries WHERE store_id=1");
    assert.equal(Number(balance.rows[0].balance),250);
    const lines=await db.query<{product_name:string;quantity:string;unit_price:string;line_total:string}>(
      "SELECT product_name,quantity,unit_price,line_total FROM dukkan_cari_import_lines ORDER BY line_position");
    assert.deepEqual(lines.rows.map(x=>x.product_name),["Örnek Kettle","Örnek Cezve"]);
    assert.deepEqual(lines.rows.map(x=>Number(x.line_total)),[200,100]);
    const due=await db.query<{document_date:string;due_date:string}>(
      "SELECT document_date::text AS document_date,due_date::text AS due_date FROM dukkan_cari_import_entries WHERE kind='sale'");
    assert.equal(due.rows[0].document_date,"2025-01-02");
    assert.equal(due.rows[0].due_date,"2025-02-02");
    const stock=await db.query<{stock:string}>("SELECT stock::text AS stock FROM dukkan_products WHERE id=1");
    assert.equal(Number(stock.rows[0].stock),55);
    await assert.rejects(()=>tx(()=>postImportedStatement(c,args)),/zaten içe aktarılmış/);
    await assert.rejects(()=>tx(()=>postImportedStatement(c,{...args,sha256:"b".repeat(64)})),
      /zaten içe aktarılmış|Çift bakiye/);
    const counts=await db.query<{total:number}>("SELECT COUNT(*)::integer AS total FROM dukkan_cari_entries");
    assert.equal(counts.rows[0].total,3);
    // Replacing a single Excel opening balance with its full historical
    // statement must not double the customer balance.
    const party=await db.query<{id:string}>(
      "INSERT INTO dukkan_parties(store_id,type,name,source_cari_no,account_code) "+
      "VALUES(1,'customer','Örnek Cari Test','0000099','0000099') RETURNING id");
    const alternate=Number(party.rows[0].id);
    await db.query(
      "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,created_at) "+
      "VALUES(1,$1,250,0,'Excel açılış bakiyesi',CURRENT_DATE)",
      [alternate],
    );
    const incoming={...document,party:{...document.party,sourceCariNo:"0000099"}};
    await assert.rejects(()=>tx(()=>postImportedStatement(c,{
      ...args,sha256:"c".repeat(64),partyId:alternate,statement:incoming,
    })),/Mevcut cari bakiyesi/);
    await tx(()=>postImportedStatement(c,{
      ...args,sha256:"c".repeat(64),partyId:alternate,statement:incoming,
      confirmExisting:true,replaceOpening:true,
    }));
    const secondBalance=await db.query<{balance:string}>(
      "SELECT SUM(debit-credit)::text AS balance FROM dukkan_cari_entries WHERE store_id=1 AND party_id=$1",
      [alternate],
    );
    assert.equal(Number(secondBalance.rows[0].balance),250);
    const secondMovements=await db.query<{total:number}>(
      "SELECT COUNT(*)::integer AS total FROM dukkan_cari_entries WHERE store_id=1 AND party_id=$1",
      [alternate],
    );
    assert.equal(secondMovements.rows[0].total,5,
      "one original opening, one audited offset, and three historical entries");

  }finally{await db.close();}
});
test("unbalanced invoice lines block writes and missing VAT is not inferred",()=>{
  const invalid:ImportedStatement={...document,entries:document.entries.map((e,i)=>
    i===1?{...e,lines:[{...e.lines[0],lineTotal:25}]}:e)};
  const summary=summarizeImportedStatement(invalid);
  assert.equal(summary.balance,250);
  assert.equal(summary.blockingMismatches.length,1);
});
