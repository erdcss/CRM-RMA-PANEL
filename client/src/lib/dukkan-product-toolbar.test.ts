import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PRODUCT_TOOLBAR, paginateDukkanProducts, restoreProductToolbar, selectDukkanProducts } from "./dukkan-product-toolbar";

const products=[
  {id:1,name:"ÇELİK KETIL",sku:"KK-00",barcode:"04254252523",stock:"150.000",sale_price:400,publish_b2b:false,b2b_product_id:null},
  {id:2,name:"Sencrom Mini Uydu Alıcısı",sku:"SM-5000",barcode:"0987654321",stock:24,sale_price:1170,publish_b2b:true,b2b_product_id:"b2b-2"},
  {id:3,name:"Boş Stok",sku:"EMPTY",barcode:"000",stock:0,sale_price:999,publish_b2b:false,b2b_product_id:"b2b-3"},
  {id:4,name:"Az Stok Ürünü",sku:"LOW",barcode:"001",stock:5,sale_price:150,publish_b2b:false,b2b_product_id:null},
];
const ids=(state:Partial<typeof DEFAULT_PRODUCT_TOOLBAR>)=>selectDukkanProducts(products,{...DEFAULT_PRODUCT_TOOLBAR,...state}).map(p=>p.id);

test("Turkish product name, SKU and barcode search",()=>{
  assert.deepEqual(ids({search:"çelik ketil"}),[1]);
  assert.deepEqual(ids({search:"SM-5000"}),[2]);
  assert.deepEqual(ids({search:"098765"}),[2]);
  assert.deepEqual(ids({search:"mini uydu"}),[2]);
});

test("combined source, publication and stock filters",()=>{
  assert.deepEqual(ids({source:"b2b",publication:"published"}),[2]);
  assert.deepEqual(ids({source:"local",publication:"draft"}),[4,1]);
  assert.deepEqual(ids({stock:"empty"}),[3]);
  assert.deepEqual(ids({stock:"low"}),[4]);
  assert.deepEqual(ids({stock:"available"}),[4,2,1]);
  assert.deepEqual(ids({sort:"price-desc"}),[2,3,1,4]);
});

test("2455 products are divided into bounded pages",()=>{
  const all=Array.from({length:2455},(_,i)=>({id:i+1,name:"Ürün "+i,stock:1}));
  const ordered=selectDukkanProducts(all,DEFAULT_PRODUCT_TOOLBAR);
  const first=paginateDukkanProducts(ordered,1,50);
  const last=paginateDukkanProducts(ordered,50,50);
  assert.equal(first.rows.length,50);
  assert.equal(last.rows.length,5);
  assert.equal(last.totalPages,50);
  assert.equal(last.first,2451);
  assert.equal(last.last,2455);
  assert.equal(paginateDukkanProducts(ordered,9999,50).page,50);
});

test("restores search and current page after editor navigation",()=>{
  const stored={...DEFAULT_PRODUCT_TOOLBAR,search:"ketil",source:"b2b" as const,page:3,pageSize:25};
  assert.deepEqual(restoreProductToolbar(JSON.stringify(stored)),stored);
  assert.deepEqual(restoreProductToolbar("{bad"),DEFAULT_PRODUCT_TOOLBAR);
  assert.equal(restoreProductToolbar(JSON.stringify({source:"bogus"})).source,"all");
});
