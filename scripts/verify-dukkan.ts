import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "../server/db";
import { registerDukkanRoutes } from "../server/dukkan";

if (!pool || !String(process.env.DATABASE_URL||"").includes("localhost")) {
  throw new Error("Integration test only runs against a local, disposable PostgreSQL instance");
}

// Disposable integration DB must expose the same B2B catalog dependency
// that production already has. Never create this fixture outside localhost.
await pool.query(`CREATE TABLE IF NOT EXISTS b2b_products (
  id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  brand TEXT,category TEXT,description TEXT,
  price NUMERIC(18,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_order_qty INTEGER NOT NULL DEFAULT 1,
  units_per_box INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  image_data TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

const users=await pool.query(
  "INSERT INTO users(username,password,role,app_access,is_active) VALUES($1,$2,'admin','business',1),($3,$2,'admin','business',1) RETURNING id",
  ["dukkan-integration-admin","integration-not-for-login","dukkan-integration-outsider"]
);
let activeUser=Number(users.rows[0].id);
const outsider=Number(users.rows[1].id);
const app=express();
app.use(express.json());
registerDukkanRoutes(app,()=>activeUser);
const server=app.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address();
if(!address||typeof address==="string")throw new Error("Listening failed");
const url="http://127.0.0.1:"+address.port;
async function call(method:string,path:string,body?:unknown,expected=200){
  const response=await fetch(url+path,{method,headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  assert.equal(response.status,expected,method+" "+path+" "+JSON.stringify(data));
  return data;
}
try {
  const store=await call("POST","/api/dukkan/stores",{name:"Entegrasyon Mağazası"},201);
  const base="/api/dukkan/stores/"+store.id;
  const buyer=await call("POST",base+"/parties",{name:"Test Müşteri",type:"customer"},201);
  const supplier=await call("POST",base+"/parties",{name:"Test Tedarikçi",type:"supplier"},201);
  const product=await call("POST",base+"/products",{name:"Test Ürünü",sku:"TEST-001",purchasePrice:50,salePrice:100},201);
  const purchase={partyId:supplier.id,kind:"purchase",number:"A-001",requestKey:randomUUID(),lines:[{productId:product.id,quantity:2,unitPrice:50,taxRate:20}]};
  const purchased=await call("POST",base+"/invoices",purchase,201);
  assert.match(purchased.invoice_no,/^[0-9]{14}$/,"Invoice number must be generated from 14 digits");
  assert.notEqual(purchased.invoice_no,"A-001","Caller-supplied number must never override generated number");
  const edited=await call("PATCH",base+"/products/"+product.id,{name:"Test Ürünü Düzenlendi",sku:"TEST-001",unit:"adet",purchasePrice:55,salePrice:105});
  assert.equal(edited.name,"Test Ürünü Düzenlendi");
  const productsAfterPurchase=await call("GET",base+"/data/products");
  assert.equal(Number(productsAfterPurchase[0].stock),2);

  const invalidSale={partyId:buyer.id,kind:"sale",number:"S-INVALID",requestKey:randomUUID(),lines:[{productId:product.id,quantity:3,unitPrice:100,taxRate:20}]};
  await call("POST",base+"/invoices",invalidSale,409);
  const invoiceListAfterFailure=await call("GET",base+"/data/invoices");
  assert.equal(invoiceListAfterFailure.length,1,"Failed stock check must rollback the whole invoice");
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),2);

  const sale={...invalidSale,number:"S-001",requestKey:randomUUID(),lines:[{productId:product.id,quantity:1,unitPrice:100,taxRate:20}]};
  const first=await call("POST",base+"/invoices",sale,201);
  assert.match(first.invoice_no,/^[0-9]{14}$/);
  assert.notEqual(first.invoice_no,purchased.invoice_no,"Invoice numbers must be globally unique");
  const exportable=await call("GET",base+"/invoices/"+first.id+"/pdf-data");
  assert.equal(exportable.invoice.invoice_no,first.invoice_no,"Sales PDF must contain the posted invoice number");
  assert.equal(exportable.invoice.party_name,"Test Müşteri");
  assert.equal(exportable.lines.length,1,"Sales PDF must contain all posted product lines");
  assert.equal(exportable.officialInvoice,false,"Dahili PDF must never masquerade as an official GİB invoice");
  assert.match(exportable.disclaimer,/GİB/,"Sales PDF must carry a fiscal disclaimer");
  const purchasePdf=await call("GET",base+"/invoices/"+purchased.id+"/pdf-data");
  assert.equal(purchasePdf.invoice.kind,"purchase");
  assert.equal(purchasePdf.officialInvoice,false);
  assert.match(purchasePdf.disclaimer,/GİB/);

  const repeat=await call("POST",base+"/invoices",sale,201);
  assert.equal(first.id,repeat.id,"Request UUID must be idempotent");
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),1);

  const customerBefore=(await call("GET",base+"/data/parties")).find((x:any)=>x.id===buyer.id);
  assert.equal(Number(customerBefore.balance),120,"Customer must owe tax-inclusive sale amount");
  const saleReturn={partyId:buyer.id,kind:"sale_return",number:"SI-001",requestKey:randomUUID(),lines:[{productId:product.id,quantity:1,unitPrice:100,taxRate:20}]};
  await call("POST",base+"/invoices",saleReturn,201);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),2);
  const customerAfter=(await call("GET",base+"/data/parties")).find((x:any)=>x.id===buyer.id);
  assert.equal(Number(customerAfter.balance),0);

  const bank=await call("POST",base+"/banks",{name:"Test Bankası"},201);
  await call("POST",base+"/payments",{partyId:buyer.id,direction:"collection",method:"bank",bankId:bank.id,amount:30},201);
  const bankAfter=(await call("GET",base+"/data/banks"))[0];
  assert.equal(Number(bankAfter.balance),30);
  const partyAfterPayment=(await call("GET",base+"/data/parties")).find((x:any)=>x.id===buyer.id);
  assert.equal(Number(partyAfterPayment.balance),-30);

  const instrument=await call("POST",base+"/instruments",{partyId:buyer.id,kind:"cheque",direction:"received",number:"CEK-001",amount:80,dueDate:"2026-12-15"},201);
  await call("PATCH",base+"/instruments/"+instrument.id,{status:"settled"});
  assert.equal((await call("GET",base+"/data/payments")).length,1,"Cheque settlement must not create a second payment");

  const history=await call("GET",base+"/parties/"+buyer.id+
    "/statement?mode=detailed&sort=latest");
  assert.equal(history.sort,"latest");
  assert.equal(history.party.name,"Test Müşteri");
  assert.equal(history.entries.length,3,"Sale, return and payment must be visible on the cari card");
  assert.equal(Number(history.entries[0].running_balance),-30);
  assert.ok(history.entries.some((entry:any)=>entry.invoice_lines?.length===1),
    "Invoice product lines must be available on the native cari detail");
  const chronological=await call("GET",base+"/parties/"+buyer.id+"/statement");
  assert.equal(chronological.sort,"chronological","Existing web statement order must not change");
  assert.equal(Number(chronological.entries[chronological.entries.length-1].running_balance),-30);

  // Existing posted sales documents can be edited/voided without leaving
  // phantom stock or double-posting cari entries; copies get their own number.
  assert.equal(exportable.invoice.revision,0);
  assert.equal(Number(exportable.lines[0].product_id),Number(product.id));
  assert.equal(exportable.lines[0].sku,"TEST-001");
  const editedSale=await call("PATCH",base+"/invoices/"+first.id,{
    partyId:buyer.id,kind:"sale",expectedRevision:0,
    lines:[{productId:product.id,quantity:2,unitPrice:100,taxRate:20}]
  });
  assert.equal(editedSale.invoice_no,first.invoice_no,"Editing must preserve invoice number");
  assert.equal(editedSale.revision,1);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),1);
  assert.equal(Number((await call("GET",base+"/data/parties")).find((p:any)=>p.id===buyer.id).balance),90);
  await call("PATCH",base+"/invoices/"+first.id,{
    partyId:buyer.id,kind:"sale",expectedRevision:0,
    lines:[{productId:product.id,quantity:1,unitPrice:100,taxRate:20}]
  },409);
  await call("PATCH",base+"/invoices/"+first.id,{
    partyId:buyer.id,kind:"sale",expectedRevision:1,
    lines:[{productId:product.id,quantity:100,unitPrice:100,taxRate:20}]
  },409);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),1,
    "Rejected edits must not change stock");
  const voided=await call("DELETE",base+"/invoices/"+first.id,{expectedRevision:1});
  assert.equal(voided.status,"voided");
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),3,
    "Voiding returns sold inventory");
  assert.equal(Number((await call("GET",base+"/data/parties")).find((p:any)=>p.id===buyer.id).balance),-150,
    "Voiding reverses only the invoice, not a separate collection");
  await call("GET",base+"/invoices/"+first.id+"/pdf-data",undefined,404);
  const visibleInvoices=await call("GET",base+"/data/invoices");
  assert.ok(!visibleInvoices.some((v:any)=>v.id===first.id),"Voided documents must not appear as active");
  await call("DELETE",base+"/invoices/"+first.id,{expectedRevision:2},409);
  const copied=await call("POST",base+"/invoices",{
    partyId:buyer.id,kind:"sale",requestKey:randomUUID(),
    lines:[{productId:product.id,quantity:1,unitPrice:80,taxRate:20}]
  },201);
  assert.notEqual(copied.invoice_no,first.invoice_no);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),2);
  assert.equal(Number((await call("GET",base+"/report")).sales),-24,
    "Sales reports exclude voided documents and include copied ones");
  const audit=await pool.query(
    "SELECT action FROM dukkan_invoice_audit WHERE store_id=$1 AND invoice_id=$2 ORDER BY id",
    [store.id,first.id]
  );
  assert.deepEqual(audit.rows.map((x:any)=>x.action),["edit","delete"]);
  // A legacy source-statement invoice is not a posted stock invoice.
  // Editing or soft-voiding must rebalance the linked cari entry without
  // moving stock, and must record immutable before/after evidence.
  const archivedBatch=await pool.query(
    "INSERT INTO dukkan_cari_import_batches(store_id,party_id,source_sha256,source_filename,entry_count,imported_by) "+
    "VALUES($1,$2,$3,$4,1,$5) RETURNING id",
    [store.id,buyer.id,"verify-dukkan-archive-"+randomUUID(),"sample-archive.pdf",activeUser]
  );
  const archiveLedger=await pool.query(
    "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description) "+
    "VALUES($1,$2,125,0,'Arşiv satış · 000793') RETURNING id",[store.id,buyer.id]
  );
  const archive=await pool.query(
    "INSERT INTO dukkan_cari_import_entries(store_id,party_id,batch_id,entry_id,document_date,kind,document_no,source_page,source_position) "+
    "VALUES($1,$2,$3,$4,'2026-10-22','sale','000793',1,0) RETURNING id",
    [store.id,buyer.id,archivedBatch.rows[0].id,archiveLedger.rows[0].id]
  );
  const archiveId=archive.rows[0].id;
  await pool.query(
    "INSERT INTO dukkan_cari_import_lines(import_entry_id,line_position,product_name,quantity,unit,unit_price,line_total) "+
    "VALUES($1,0,'Test Ürünü Düzenlendi',1,'adet',125,125)",[archiveId]
  );
  const archPdf=await call("GET",base+"/invoices/archived/"+archiveId+"/pdf-data");
  assert.equal(archPdf.invoice.revision,0);
  assert.equal(archPdf.invoice.invoice_no,"000793");
  assert.equal(archPdf.lines.length,1);
  const stockBeforeArchive=Number((await call("GET",base+"/data/products"))[0].stock);
  const patchedArchive=await call("PATCH",base+"/invoices/archived/"+archiveId,{
    expectedRevision:0,date:"2026-10-23",amount:150,description:"Düzeltilmiş kaynak belge",
    lines:[{productName:"Test Ürünü Düzenlendi",quantity:1,unit:"adet",unitPrice:150,lineTotal:150}]
  });
  assert.equal(patchedArchive.revision,1);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),stockBeforeArchive);
  const changedArchive=await call("GET",base+"/invoices/archived/"+archiveId+"/pdf-data");
  assert.equal(Number(changedArchive.invoice.grand_total),150);
  assert.equal(String(changedArchive.invoice.issued_at).slice(0,10),"2026-10-23");
  assert.equal(Number(changedArchive.lines[0].line_total),150);
  await call("PATCH",base+"/invoices/archived/"+archiveId,{
    expectedRevision:0,date:"2026-10-23",amount:200,description:"Geçersiz",lines:[]
  },409);
  const archivedDeleted=await call("DELETE",base+"/invoices/archived/"+archiveId,{expectedRevision:1});
  assert.equal(archivedDeleted.status,"voided");
  await call("GET",base+"/invoices/archived/"+archiveId+"/pdf-data",undefined,404);
  assert.ok(!(await call("GET",base+"/data/invoices")).some((x:any)=>String(x.id)==="archive-"+archiveId));
  const voidedEntry=await pool.query("SELECT debit,credit FROM dukkan_cari_entries WHERE id=$1",[archiveLedger.rows[0].id]);
  assert.equal(Number(voidedEntry.rows[0].debit)-Number(voidedEntry.rows[0].credit),0);
  assert.equal(Number((await call("GET",base+"/data/products"))[0].stock),stockBeforeArchive);
  const auditRows=await pool.query("SELECT action FROM dukkan_archive_invoice_audit WHERE import_entry_id=$1 ORDER BY id",[archiveId]);
  assert.deepEqual(auditRows.rows.map((x:any)=>x.action),["edit","delete"]);
  activeUser=outsider;
  await call("GET",base+"/parties/"+buyer.id+"/statement?sort=latest",undefined,403);
  await call("GET",base+"/data/products",undefined,403);
  await call("GET",base+"/invoices/"+first.id+"/pdf-data",undefined,403);
  await call("POST",base+"/parties",{name:"Cross tenant attempt",type:"customer"},403);
  await call("PATCH",base+"/products/"+product.id,{name:"Unauthorized",sku:"TEST-001",unit:"adet",purchasePrice:0,salePrice:0},403);
  console.log("PASS: stock rollback, idempotency, invoice PDF data and disclaimer, return, cari, bank, instruments, tenant isolation");
} finally {
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
}
