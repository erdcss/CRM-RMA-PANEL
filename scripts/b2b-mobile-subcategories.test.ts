import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCategoryText,
  productMatchesSubcategory,
  productMatchesCollection,
} from "../mobile/lib/category-collections";

const steel = { id: "1", name: "Paslanmaz ÇELİK   CEZVE 500 ML", category: "elektronik", tags: [] };
const tea = { id: "2", name: "Elektrikli ÇAY MAKİNESİ Cam Demlik", category: "mutfak", tags: [] };
const tagged = { id: "3", name: "Mini Uydu", category: "elektronik", tags: ["Uydu Alıcısı"] };
const other = { id: "4", name: "Düz Tencere", category: "elektronik", tags: ["tencere"] };

test("mobile category normalization follows web Turkish case and whitespace handling", () => {
  assert.equal(normalizeCategoryText("  ÇELİK   CEZVE   "), "çelik cezve");
});

test("mobile subcategory matches title phrase regardless of case and repeated whitespace", () => {
  const child = { id: "steel", name: "Çelik Cezveler", tags: [], titleKeywords: ["çelik cezve"] };
  assert.equal(productMatchesSubcategory(steel, child), true);
  assert.equal(productMatchesSubcategory(tea, child), false);
  assert.equal(productMatchesSubcategory(other, child), false);
});

test("subcategory matches exact admin-linked product tags but not arbitrary parent products", () => {
  const child = { id: "sat", name: "Uydu Alıcıları", tags: ["uydu alıcısı"], titleKeywords: [] };
  assert.equal(productMatchesSubcategory(tagged, child), true);
  assert.equal(productMatchesSubcategory(other, child), false);
});

test("parent collection includes any child title match from a different primary category", () => {
  const card = { category: "elektronik", tags: [],
    subcategories: [{ id: "tea", name: "Çay Makinesi", tags: [], titleKeywords: ["çay makinesi"] }] };
  assert.equal(productMatchesCollection(tea, "elektronik", card), true);
});

test("parent category keeps legacy category, collection and tag assignments", () => {
  const card = { category: "elektronik", tags: ["fırsat"], subcategories: [] };
  assert.equal(productMatchesCollection(steel, "elektronik", card), true);
  assert.equal(productMatchesCollection({ id: "5", name: "B", category: "a", collection_name: "Elektronik" }, "elektronik", card), true);
  assert.equal(productMatchesCollection({ id: "6", name: "C", category: "a", tags: ["FIRSAT"] }, "elektronik", card), true);
  assert.equal(productMatchesCollection({ id: "7", name: "D", category: "a", tags: ["x"] }, "elektronik", card), false);
});
