import type { B2BProduct, HomeCategoryCard, HomeSubcategory } from './api';

/** Match the web storefront's Turkish case/whitespace-normalized category rules. */
export function normalizeCategoryText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

/**
 * Admin-managed subcategories match product title phrases OR exact product tags.
 * The product's main category is intentionally not enough for a subcategory.
 */
export function productMatchesSubcategory(product: B2BProduct, item: HomeSubcategory) {
  const title = normalizeCategoryText(product.name);
  if (title && (item.titleKeywords || []).some(keyword => {
    const phrase = normalizeCategoryText(keyword);
    return phrase.length > 0 && title.includes(phrase);
  })) return true;

  const tags = new Set((item.tags || []).map(normalizeCategoryText).filter(Boolean));
  return tags.size > 0 && (product.tags || []).some(tag => tags.has(normalizeCategoryText(tag)));
}

/** A parent includes direct category/collection matches, its tags, and any child title/tag match. */
export function productMatchesCollection(
  product: B2BProduct,
  category: string,
  settings?: HomeCategoryCard,
) {
  const target = normalizeCategoryText(category);
  if (!target) return true;
  if (normalizeCategoryText(product.category) === target ||
      normalizeCategoryText(product.collection_name) === target) return true;

  if ((settings?.subcategories || []).some(child => productMatchesSubcategory(product, child))) return true;

  const allowedTags = new Set((settings?.tags || []).map(normalizeCategoryText).filter(Boolean));
  return allowedTags.size > 0 && (product.tags || []).some(tag => allowedTags.has(normalizeCategoryText(tag)));
}
