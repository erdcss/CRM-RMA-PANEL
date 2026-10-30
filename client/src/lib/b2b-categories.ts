import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";

export type B2BSubcategory = { id: string; name: string; imageId?: string; tags: string[]; titleKeywords?: string[] };
export type B2BCategoryCard = {
  category: string;
  label?: string;
  imageId?: string;
  tags?: string[];
  subcategories?: B2BSubcategory[];
};
export type B2BHomepageCategories = {
  categories: string[];
  categoryCards?: B2BCategoryCard[];
};

// Case-insensitive Turkish phrase matching with normalized whitespace.
const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

export async function loadB2BHomepageCategories(): Promise<B2BHomepageCategories> {
  const response = await fetch("/api/public/homepage", { credentials: "include" });
  if (!response.ok) throw new Error("Kategoriler yüklenemedi");
  const data = await response.json();
  return {
    categories: Array.isArray(data?.categories)
      ? data.categories.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim()))
      : [],
    categoryCards: Array.isArray(data?.categoryCards) ? data.categoryCards : [],
  };
}

export function findB2BCategoryCard(homepage: B2BHomepageCategories | undefined, name: string) {
  return (homepage?.categoryCards || []).find(item => normalize(item.category) === normalize(name));
}

export function b2bCategoryImage(imageId?: string) {
  return imageId && /^[a-f0-9]{32}$/i.test(imageId)
    ? `https://admin.ecalisgan.com/api/public/homepage/media/${imageId}`
    : null;
}

export function b2bSubcategoryHref(category: string, id: string) {
  return "/kategori/" + encodeURIComponent(category) + "/alt/" + encodeURIComponent(id);
}

export function matchesB2BSubcategory(product: UnifiedB2BProduct, item: B2BSubcategory) {
  const productTitle = normalize(product.name);
  const keywords = (item.titleKeywords || []).map(normalize).filter(Boolean);
  if (productTitle && keywords.some(keyword => productTitle.includes(keyword))) return true;

  const allowedTags = new Set((item.tags || []).map(normalize).filter(Boolean));
  return allowedTags.size > 0 && (product.tags || []).some(tag => allowedTags.has(normalize(tag)));
}

export function b2bCategoryHref(category: string) {
  return "/kategori/" + encodeURIComponent(category);
}

// Keep web filtering in sync with the native collection screen: category,
// collection assignment, plus all tags linked to this category in Admin.
export function matchesB2BCategory(product: UnifiedB2BProduct, name: string, card?: B2BCategoryCard) {
  const expected = normalize(name);
  if (!expected) return true;
  if (normalize(product.category) === expected || normalize(product.collection_name) === expected) return true;
  // A category also includes products matched by any title-based subcategory.
  if ((card?.subcategories || []).some(item => matchesB2BSubcategory(product, item))) return true;
  const allowed = new Set((card?.tags || []).map(normalize).filter(Boolean));
  if (!allowed.size) return false;
  return (product.tags || []).some(tag => allowed.has(normalize(tag)));
}
