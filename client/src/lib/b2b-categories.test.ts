import assert from "node:assert/strict";
import test from "node:test";
import { matchesB2BSubcategory, matchesB2BCategory } from "./b2b-categories";

const steel = { id: 1, name: "Paslanmaz ÇELİK   CEZVE 500 ML", category: "elektronik", tags: [] };
const tea = { id: 2, name: "Elektrikli ÇAY MAKİNESİ Cam Demlik", category: "mutfak", tags: [] };
const other = { id: 3, name: "Çelik Tencere", category: "elektronik", tags: [] };

test("steel pot title phrase auto-matches regardless of case or repeated whitespace", () => {
  const item = { id: "a", name: "ÇELİK CEZVE", tags: [], titleKeywords: ["çelik cezve"] };
  assert.equal(matchesB2BSubcategory(steel, item), true);
  assert.equal(matchesB2BSubcategory(tea, item), false);
  assert.equal(matchesB2BSubcategory(other, item), false);
});

test("tea maker title matches even when product tags are missing", () => {
  const item = { id: "b", name: "ÇAY MAKİNESİ", tags: [], titleKeywords: ["çay makinesi"] };
  assert.equal(matchesB2BSubcategory(tea, item), true);
  assert.equal(matchesB2BSubcategory(steel, item), false);
});

test("older subcategories still match existing product tags", () => {
  const item = { id: "c", name: "Uydu Alıcıları", tags: ["uydu"], titleKeywords: [] };
  assert.equal(matchesB2BSubcategory({id:4,name:"Cihaz",tags:["uydu"]},item),true);
});

test("parent electronics category includes title matches from its subcategories", () => {
  const card = { category:"elektronik", tags:[], subcategories:[
    { id:"b", name:"ÇAY MAKİNESİ", tags:[], titleKeywords:["çay makinesi"] },
  ] };
  assert.equal(matchesB2BCategory(tea, "elektronik", card),true);
});
