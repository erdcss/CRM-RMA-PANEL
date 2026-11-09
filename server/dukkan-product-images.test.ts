import test from "node:test";
import assert from "node:assert/strict";
import {dukkanPhotoAt,dukkanPhotos,isSupportedDukkanPhoto} from "./dukkan-product-images";

const png = "data:image/png;base64,aGVsbG8=";

test("local gallery takes precedence over explicitly linked B2B image", () => {
  assert.equal(dukkanPhotoAt({images:["https://cdn.example.com/local.jpg"],b2b_images:[png]}),"https://cdn.example.com/local.jpg");
});
test("linked catalog image fills in missing local image", () => {
  assert.equal(dukkanPhotoAt({images:[],image_data:null,b2b_images:[png]}),png);
});
test("legacy image and additional gallery frames remain accessible", () => {
  const photo={images:["https://cdn.example.com/one.jpg","https://cdn.example.com/two.jpg"],image_data:png};
  assert.deepEqual(dukkanPhotos(photo),[photo.images[0],photo.images[1],png]);
});
test("unsafe and absent image values never become image URLs", () => {
  assert.equal(isSupportedDukkanPhoto("javascript:alert(1)"),false);
  assert.equal(dukkanPhotoAt({images:["javascript:alert(1)"],b2b_image_data:png}),png);
  assert.equal(dukkanPhotoAt({images:[],image_data:null}),null);
});
