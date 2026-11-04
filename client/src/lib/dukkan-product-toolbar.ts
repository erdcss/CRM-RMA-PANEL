/** Shared deterministic filtering/sorting for the Çalışkan Dükkân product bar. */
export type ProductSourceFilter = "all" | "b2b" | "local";
export type ProductStockFilter = "all" | "available" | "low" | "empty";
export type ProductPublicationFilter = "all" | "published" | "draft";
export type ProductSort = "newest" | "name" | "stock-desc" | "stock-asc" | "price-asc" | "price-desc";

export type ProductToolbarState = {
  search: string;
  source: ProductSourceFilter;
  stock: ProductStockFilter;
  publication: ProductPublicationFilter;
  sort: ProductSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_PRODUCT_TOOLBAR: ProductToolbarState = {
  search: "",
  source: "all",
  stock: "all",
  publication: "all",
  sort: "newest",
  page: 1,
  pageSize: 50,
};

export type DukkanProductRow = {
  id?: number | string;
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  stock?: number | string | null;
  sale_price?: number | string | null;
  b2b_product_id?: string | null;
  b2b_source_sku?: string | null;
  publish_b2b?: boolean | null;
};

export function normalizeProductSearch(value: unknown) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i")
    .trim().replace(/\s+/g, " ");
}

const numeric = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export function selectDukkanProducts<T extends DukkanProductRow>(
  products: T[],
  state: Pick<ProductToolbarState, "search" | "source" | "stock" | "publication" | "sort">,
): T[] {
  const search = normalizeProductSearch(state.search);
  const tokens = search ? search.split(" ") : [];
  const filtered = products.filter(product => {
    const hasB2B = Boolean(product.b2b_product_id);
    if (state.source === "b2b" && !hasB2B) return false;
    if (state.source === "local" && hasB2B) return false;

    const count = numeric(product.stock);
    if (state.stock === "available" && count <= 0) return false;
    if (state.stock === "empty" && count > 0) return false;
    if (state.stock === "low" && (count <= 0 || count > 10)) return false;

    if (state.publication === "published" && !product.publish_b2b) return false;
    if (state.publication === "draft" && Boolean(product.publish_b2b)) return false;

    if (!tokens.length) return true;
    const fields = [product.name, product.sku, product.barcode, product.brand, product.category, product.b2b_source_sku]
      .map(normalizeProductSearch);
    // Every word must appear in at least one searchable field.
    return tokens.every(word => fields.some(field => field.includes(word)));
  });

  const collator = new Intl.Collator("tr-TR", { sensitivity: "base", numeric: true });
  return filtered.sort((left, right) => {
    switch (state.sort) {
      case "name": return collator.compare(String(left.name || ""), String(right.name || ""));
      case "stock-desc": return numeric(right.stock) - numeric(left.stock);
      case "stock-asc": return numeric(left.stock) - numeric(right.stock);
      case "price-asc": return numeric(left.sale_price) - numeric(right.sale_price);
      case "price-desc": return numeric(right.sale_price) - numeric(left.sale_price);
      default: return numeric(right.id) - numeric(left.id);
    }
  });
}

export function paginateDukkanProducts<T>(products: T[], page: number, pageSize: number) {
  const size = [25, 50, 100].includes(pageSize) ? pageSize : 50;
  const totalPages = Math.max(1, Math.ceil(products.length / size));
  const safePage = Math.min(totalPages, Math.max(1, Math.trunc(Number(page) || 1)));
  const startIndex = (safePage - 1) * size;
  return {
    rows: products.slice(startIndex, startIndex + size),
    page: safePage,
    pageSize: size,
    totalPages,
    first: products.length ? startIndex + 1 : 0,
    last: Math.min(products.length, startIndex + size),
    total: products.length,
  };
}

export function restoreProductToolbar(raw: string | null): ProductToolbarState {
  if (!raw) return { ...DEFAULT_PRODUCT_TOOLBAR };
  try {
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object") return { ...DEFAULT_PRODUCT_TOOLBAR };
    return {
      search: typeof input.search === "string" ? input.search.slice(0, 150) : "",
      source: ["all","b2b","local"].includes(input.source) ? input.source : "all",
      stock: ["all","available","low","empty"].includes(input.stock) ? input.stock : "all",
      publication: ["all","published","draft"].includes(input.publication) ? input.publication : "all",
      sort: ["newest","name","stock-desc","stock-asc","price-asc","price-desc"].includes(input.sort) ? input.sort : "newest",
      page: Number.isSafeInteger(input.page) && input.page > 0 ? input.page : 1,
      pageSize: [25,50,100].includes(input.pageSize) ? input.pageSize : 50,
    };
  } catch { return { ...DEFAULT_PRODUCT_TOOLBAR }; }
}
