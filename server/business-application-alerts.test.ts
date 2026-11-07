import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBusinessApplicationAlert } from "./business-application-alerts";
test("new customer application", () => {
 const item=makeBusinessApplicationAlert({kind:"b2b_customer",id:42,companyName:"Örnek Firma"});
 assert.equal(item.title,"Yeni firma başvurusu");
 assert.equal(item.body,"Örnek Firma · Üyelik onayı bekliyor.");
 assert.deepEqual(item.data,{type:"b2b_application",applicationId:"42"});
});
test("reapplications have their own message", () => {
 assert.equal(makeBusinessApplicationAlert({kind:"b2b_customer",id:3,reapplied:true}).title,"Firma yeniden başvurusu");
});
test("supplier notification routes to marketplace", () => {
 assert.deepEqual(makeBusinessApplicationAlert({kind:"supplier",id:77}).data,{type:"supplier_application",supplierId:"77"});
});
test("never allow invalid id or very long company names", () => {
 assert.throws(()=>makeBusinessApplicationAlert({kind:"supplier",id:0}));
 assert.ok(makeBusinessApplicationAlert({kind:"supplier",id:1,companyName:"X".repeat(300)}).body.length<140);
});
