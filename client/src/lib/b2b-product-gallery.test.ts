import { test } from "node:test";
import assert from "node:assert/strict";
import { collectB2BProductImages, galleryIndexAfterMove } from "./b2b-product-gallery";

test("returns gallery images from product detail before legacy cover",()=>{
  const gallery=collectB2BProductImages({
    images:["https://cdn.example.com/front.jpg","https://cdn.example.com/box.jpg"],
    image_data:"https://cdn.example.com/front.jpg",
    image_url:"https://cdn.example.com/alternate.jpg",
  });
  assert.deepEqual(gallery,[
    "https://cdn.example.com/front.jpg",
    "https://cdn.example.com/box.jpg",
    "https://cdn.example.com/alternate.jpg",
  ]);
});
test("falls back to legacy cover and supports empty gallery",()=>{
  assert.deepEqual(collectB2BProductImages({images:[],image_data:"data:image/png;base64,abcd"}),["data:image/png;base64,abcd"]);
  assert.deepEqual(collectB2BProductImages({images:null,image_url:"/uploads/item.webp"}),["/uploads/item.webp"]);
  assert.deepEqual(collectB2BProductImages(null),[]);
});
test("skips duplicate or non-image schemes",()=>{
  assert.deepEqual(collectB2BProductImages({images:["",null,42,"  /one.jpg ","/one.jpg","javascript:alert(1)","data:text/html,hi"]}),["/one.jpg"]);
});
test("gallery index wraps at both ends and handles no images",()=>{
  assert.equal(galleryIndexAfterMove(0,3,1),1);
  assert.equal(galleryIndexAfterMove(2,3,1),0);
  assert.equal(galleryIndexAfterMove(0,3,-1),2);
  assert.equal(galleryIndexAfterMove(10,3,-1),1);
  assert.equal(galleryIndexAfterMove(0,0,1),0);
});
