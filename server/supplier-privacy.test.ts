import test from "node:test";
import assert from "node:assert/strict";
import { redactCustomerPhones, supplierOrderView } from "./supplier-privacy";

test("Tedarikçi sipariş API'si müşteri iletişim bilgilerini asla içermez", () => {
  const order = supplierOrderView({
    id:42,order_id:102,status:"paid",subtotal:"200.00",delivery_mode:"direct",
    created_at:"2026-10-27",currency:"TRY",
    buyer_user_id:38,customer_phone:"0532 123 45 67",customer_email:"buyer@example.com",
    phone:"0532 123 45 67",billing_details:{phone:"+90 532 123 45 67"},
    shipping_address:{recipient:"Alıcı",phone:"0532 123 45 67",addressLine:"Mahalle"},
    items:[{productId:12,sku:"TS12",name:"Ürün",boxes:1,unitsPerBox:2,price:100,total:200,
      customer_phone:"0532 123 45 67",shipping_address:{phone:"0532 123 45 67"}}],
  });
  assert.equal(order.id,42);
  assert.equal(order.items[0].sku,"TS12");
  assert.deepEqual(Object.keys(order).sort(),[
    "created_at","currency","delivery_mode","id","items","order_id","status","subtotal",
  ].sort());
  assert.deepEqual(Object.keys(order.items[0]).sort(),[
    "boxes","name","price","productId","sku","total","unitsPerBox",
  ].sort());
  const json=JSON.stringify(order);
  for(const secret of ["0532 123 45 67","buyer@example.com","buyer_user_id","shipping_address","billing_details","customer_phone"]){
    assert.equal(json.includes(secret),false,secret+" must not reach suppliers");
  }
});

test("Müşterinin telefon bilgisi tedarikçi mesajlarından maskelenir", () => {
  for(const phone of ["+90 532 111 22 33","0532 111 22 33","5321112233","0212 555 44 33","0090 212 555 44 33"]){
    assert.equal(redactCustomerPhones("Telefon: "+phone),"Telefon: [Telefon bilgisi gizlendi]");
  }
  assert.equal(redactCustomerPhones("Barkod: 8691234567890, SKU ABC-2026"),"Barkod: 8691234567890, SKU ABC-2026");
});
