import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCampaignProduct,campaignProductId,campaignProductImage,campaignProductPrice,findCampaignProducts,
  type CampaignProductOption,
} from "./campaign-product-picker";

const products:CampaignProductOption[]=[
  {id:14,name:"RUBENIS BASTON OTOMATİK ŞEMSİYE",sku:"CV-15L",brand:"RUBENIS",category:"Şemsiye",price:225,stock:10,images:["https://cdn.example.test/umbrella.webp"]},
  {id:15,name:"RUBENIS KATLANIR ŞEMSİYE",sku:"CV-10",brand:"RUBENIS",stock:3,image_data:"data:image/png;base64,AAAA"},
  {id:16,name:"Elektrikli Ocak",sku:"OC-20",stock:0,images:["/uploads/ocak.png"]},
  {id:17,name:"RUBENIS Eski Ürün",sku:"OLD",is_active:false},
];

test("searches by Turkish product name, sku, brand and category",()=>{
  assert.deepEqual(findCampaignProducts(products,"RUBENIS",[]).map(p=>p.id),[14,15]);
  assert.deepEqual(findCampaignProducts(products,"cv-15l",[]).map(p=>p.id),[14]);
  assert.deepEqual(findCampaignProducts(products,"Şemsiye",[]).map(p=>p.id),[14,15]);
  assert.deepEqual(findCampaignProducts(products,"  RUBENIS  BASTON ",[]).map(p=>p.id),[14]);
});
test("keeps assigned products out of results, ignores inactive products and doesn't list all items for a one-letter search",()=>{
  assert.deepEqual(findCampaignProducts(products,"RUBENIS",['14']).map(p=>p.id),[15]);
  assert.deepEqual(findCampaignProducts(products,"ru",[]).map(p=>p.id),[14,15]);
  assert.deepEqual(findCampaignProducts(products,"r",[]),[]);
});
test("individual additions preserve order, never duplicate and stop at 60",()=>{
  const first=appendCampaignProduct([],14);
  const second=appendCampaignProduct(first,15);
  assert.deepEqual(second,['14','15']);
  assert.strictEqual(appendCampaignProduct(second,14),second);
  assert.strictEqual(appendCampaignProduct(second,-5),second);
  const full=Array.from({length:60},(_,i)=>String(i+1));
  assert.strictEqual(appendCampaignProduct(full,77),full);
});
test("catalog photos support image gallery, data URI and a safe local path",()=>{
  assert.equal(campaignProductImage(products[0]),"https://cdn.example.test/umbrella.webp");
  assert.equal(campaignProductImage(products[1]),"data:image/png;base64,AAAA");
  assert.equal(campaignProductImage(products[2]),"/uploads/ocak.png");
  assert.equal(campaignProductImage({id:3,name:"X",images:["javascript:alert(1)"],image_data:"file:///etc/passwd"}),null);
});
test("handles price formatting without falsely displaying missing prices",()=>{
  assert.equal(campaignProductPrice(null),"Fiyat belirtilmedi");
  assert.equal(campaignProductPrice("n/a"),"Fiyat belirtilmedi");
  assert.match(campaignProductPrice(225),/225,00/);
});

test("UUID and text-primary-key products are searchable, selectable and deduplicated",()=>{
  const uuid="aecb8367-d1d7-48df-9baa-4f60786b1123";
  const catalog=[{id:uuid,name:"RUBENIS BASTON OTOMATİK ŞEMSİYE",sku:"CV-15L",is_active:true},
    {id:"f54a07b6d2c4e618",name:"RUBENIS KATLANIR ŞEMSİYE",sku:"CV-10"}];
  assert.deepEqual(findCampaignProducts(catalog,"RU",[]).map(p=>p.id),[uuid,"f54a07b6d2c4e618"]);
  const assigned=appendCampaignProduct([],uuid);
  assert.deepEqual(assigned,[uuid]);
  assert.deepEqual(findCampaignProducts(catalog,"RU",assigned).map(p=>p.id),["f54a07b6d2c4e618"]);
  assert.strictEqual(appendCampaignProduct(assigned,uuid),assigned);
  assert.deepEqual(appendCampaignProduct(assigned,"f54a07b6d2c4e618"),[uuid,"f54a07b6d2c4e618"]);
  assert.equal(campaignProductId(" bad key "),"");
  assert.equal(campaignProductId("../x"),"");
  assert.equal(campaignProductId(uuid),uuid);
});
