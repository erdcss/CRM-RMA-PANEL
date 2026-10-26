import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "../server/db";
import { registerDukkanRoutes } from "../server/dukkan";

if (!pool || !String(process.env.DATABASE_URL||"").includes("localhost")) {
  throw new Error("Integration test only runs against a local, disposable PostgreSQL instance");
}

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

  activeUser=outsider;
  await call("GET",base+"/data/products",undefined,403);
  await call("POST",base+"/parties",{name:"Cross tenant attempt",type:"customer"},403);
  await call("PATCH",base+"/products/"+product.id,{name:"Unauthorized",sku:"TEST-001",unit:"adet",purchasePrice:0,salePrice:0},403);
  console.log("PASS: stock rollback, idempotency, return, cari, bank, instruments, tenant isolation");
} finally {
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
}
