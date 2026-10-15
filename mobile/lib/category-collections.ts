import type { B2BProduct, HomeCategoryCard } from './api';

function normal(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

// A category keeps legacy category/collection assignments and gains
// multi-tag matching. This prevents existing catalog products from disappearing.
export function productMatchesCollection(
  product: B2BProduct,
  category: string,
  settings?: HomeCategoryCard,
) {
  const target = normal(category);
  if (!target) return true;
  if (normal(product.category) === target || normal(product.collection_name) === target) return true;
  const allowedTags = new Set((settings?.tags || []).map(normal).filter(Boolean));
  if (!allowedTags.size) return false;
  return (product.tags || []).some(tag => allowedTags.has(normal(tag)));
}
