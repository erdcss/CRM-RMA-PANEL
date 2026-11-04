import assert from "node:assert/strict";
import test from "node:test";
import { defaultInvoiceForm, invoiceFormSchema, resolveInvoiceForm } from "./dukkan-invoice-forms";

test("sales and purchase forms use independent titles and defaults",()=>{
  const sale=defaultInvoiceForm("sale"),purchase=defaultInvoiceForm("purchase");
  assert.equal(sale.documentTitle,"SATIŞ BELGESİ");
  assert.equal(purchase.documentTitle,"ALIŞ BELGESİ");
  assert.equal(sale.paperSize,"a4");
  assert.equal(purchase.showTaxRate,true);
  assert.notEqual(sale.documentTitle,purchase.documentTitle);
});

test("document appearance updates do not permit invoice monetary data edits",()=>{
  const changed={...defaultInvoiceForm("purchase"),companyName:"ÇALIŞKAN GROUP",
    color:"emerald" as const,footerNote:"Mal teslimi sırasında kontrol ediniz.",
    paperSize:"a5" as const,showProductCode:true};
  assert.equal(invoiceFormSchema.parse(changed).companyName,"ÇALIŞKAN GROUP");
  assert.equal(resolveInvoiceForm("purchase",changed).showProductCode,true);
  assert.equal(invoiceFormSchema.safeParse({...changed,grand_total:0}).success,false);
  assert.equal(invoiceFormSchema.safeParse({...changed,unit_price:0}).success,false);
  assert.equal(invoiceFormSchema.safeParse({...changed,documentTitle:""}).success,false);
  assert.equal(invoiceFormSchema.safeParse({...changed,headerNote:"x".repeat(5000)}).success,false);
});

test("bad stored templates fail closed and keep printable defaults",()=>{
  const defaultPurchase=defaultInvoiceForm("purchase");
  assert.deepEqual(resolveInvoiceForm("purchase",null),defaultPurchase);
  assert.deepEqual(resolveInvoiceForm("purchase",{color:"url(javascript:alert(1))"}),defaultPurchase);
  assert.deepEqual(resolveInvoiceForm("sale",{documentTitle:"SADECE SATIŞ"}),{
    ...defaultInvoiceForm("sale"),documentTitle:"SADECE SATIŞ",
  });
});
