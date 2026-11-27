import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {dukkanPartyProductHistorySql} from "./dukkan-party-product-history";

test("customer/product history: correct scope, posted sales, archive dedupe, weighted price and pagination",async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 CREATE TABLE dukkan_products(id bigint,store_id bigint,name text,unit text,deleted_at timestamptz);
 CREATE TABLE dukkan_parties(id bigint,store_id bigint,name text);
 CREATE TABLE dukkan_invoices(id bigint,store_id bigint,party_id bigint,kind text,invoice_no text,issued_at date,status text);
 CREATE TABLE dukkan_invoice_lines(id bigint,invoice_id bigint,product_id bigint,quantity numeric,unit_price numeric,line_total numeric,tax_rate numeric);
 CREATE TABLE dukkan_cari_entries(id bigint,store_id bigint,party_id bigint);
 CREATE TABLE dukkan_cari_import_entries(id bigint,store_id bigint,party_id bigint,entry_id bigint,kind text,document_no text,document_date date,voided_at timestamptz);
 CREATE TABLE dukkan_cari_import_lines(id bigint,import_entry_id bigint,product_id bigint,product_name text,quantity numeric,unit_price numeric,discounted_unit_price numeric,line_total numeric,unit text);
 INSERT INTO dukkan_products VALUES(7,1,'BOLD ÇELİK CEZVE','adet',NULL),(8,1,'Diğer','adet',NULL),(9,2,'BOLD ÇELİK CEZVE','adet',NULL);
 INSERT INTO dukkan_parties VALUES(2,1,'Cari A'),(3,1,'Cari B'),(4,2,'Başka mağaza');
 INSERT INTO dukkan_invoices VALUES(11,1,2,'sale','S1','2026-11-20','posted'),(12,1,3,'sale','S2','2026-11-21','posted'),(13,1,2,'sale_return','R1','2026-11-21','posted'),(14,1,2,'sale','S3','2026-11-21','voided'),(15,2,4,'sale','S4','2026-11-21','posted');
 INSERT INTO dukkan_invoice_lines VALUES(1,11,7,3,100,360,20),(2,12,7,9,1,9,0),(3,13,7,1,100,120,20),(4,14,7,9,1,9,0),(5,15,7,9,1,9,0),(6,11,8,9,1,9,0);
 INSERT INTO dukkan_cari_entries VALUES(21,1,2),(22,1,2),(23,1,2),(24,1,2),(25,1,3),(26,1,2);
 INSERT INTO dukkan_cari_import_entries VALUES(31,1,2,21,'sale','OLD','2026-10-01',NULL),(32,1,2,22,'sale','S1','2026-11-20',NULL),(33,1,2,23,'sale','VOID','2026-10-01',NOW()),(34,1,2,24,'sale','OTHER','2026-10-01',NULL),(35,1,3,25,'sale','S5','2026-10-01',NULL),(36,1,2,26,'sale','WRONG','2026-10-01',NULL);
 INSERT INTO dukkan_cari_import_lines VALUES(41,31,NULL,'bold çelik cezve',2,90,80,160,'adet'),(42,32,7,'x',99,1,NULL,99,'adet'),(43,33,7,'x',99,1,NULL,99,'adet'),(44,34,NULL,'unrelated',99,1,NULL,99,'adet'),(45,35,7,'x',99,1,NULL,99,'adet'),(46,36,8,'BOLD ÇELİK CEZVE',99,1,NULL,99,'adet');
 `);
 const read=async(page=0)=>(await db.query<any>(dukkanPartyProductHistorySql,[1,2,7,1,page])).rows[0];
 const first=await read();assert.equal(first.party.name,"Cari A");assert.equal(first.summary.total_quantity,"5");assert.equal(first.summary.average_price,"92.00");assert.equal(first.summary.line_count,2);assert.equal(first.rows[0].document_no,"S1");assert.equal(first.summary.last_price,"100");
 const second=await read(1);assert.equal(second.rows[0].source,"archive");assert.equal(second.rows[0].unit_price,"80");
 await db.exec("INSERT INTO dukkan_products VALUES(10,1,'BOLD ÇELİK CEZVE','adet',NULL)");
 assert.equal((await read()).summary.line_count,1,"ambiguous unlinked archive must not be counted");
 const missing=(await db.query<any>(dukkanPartyProductHistorySql,[1,4,7,40,0])).rows[0];assert.equal(missing.party,null);assert.equal(missing.summary.line_count,0);
 }finally{await db.close();}
});
