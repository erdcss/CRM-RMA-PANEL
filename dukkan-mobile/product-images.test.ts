import test from "node:test";
import assert from "node:assert/strict";
import {productImageSource} from "./product-images";

const store=7,token="private-test-token";
test("private product image uses only the assigned shop URL and bearer",()=>{
  const src=productImageSource({id:42,image_url:"/api/dukkan/stores/7/products/42/image"},store,token);
  assert.deepEqual(src,{
    uri:"https://admin.ecalisgan.com/api/dukkan/stores/7/products/42/image",
    headers:{Authorization:"Bearer "+token},
  });
});
test("multi-image product selects the first protected image",()=>{
  const src=productImageSource({id:42,image_count:3},store,token);
  assert.equal(src?.uri,"https://admin.ecalisgan.com/api/dukkan/stores/7/products/42/image?index=0");
});
test("external product photos cannot receive the private bearer",()=>{
  const src=productImageSource({id:42,image_count:3,image_external_url:"https://cdn.example.org/cover.jpg"},store,token);
  assert.deepEqual(src,{uri:"https://cdn.example.org/cover.jpg"});
});
test("invalid product URLs cannot be rendered",()=>{
  assert.equal(productImageSource({id:42,image_url:"javascript:alert(1)"},store,token),null);
  assert.equal(productImageSource({id:0,image_url:"https://cdn.example.org/a.jpg"},store,token),null);
  assert.equal(productImageSource({id:42,image_url:"/api/dukkan/stores/8/products/42/image"},store,token),null);
});
