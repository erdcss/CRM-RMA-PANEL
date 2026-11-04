import { Search, X, SlidersHorizontal } from "lucide-react";
import type { ProductToolbarState } from "@/lib/dukkan-product-toolbar";
import { DEFAULT_PRODUCT_TOOLBAR } from "@/lib/dukkan-product-toolbar";

type Pagination = {
  page: number; pageSize: number; totalPages: number;
  first: number; last: number; total: number;
};

type Props = {
  value: ProductToolbarState;
  onChange: (changes: Partial<ProductToolbarState>) => void;
  onClear: () => void;
  page: Pagination;
  totalProducts: number;
};

const selectClass =
  "h-11 w-full min-w-0 rounded-xl border border-[#dbe5f0] bg-white px-3 text-xs font-semibold text-[#173a63] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export function DukkanProductToolbar({value, onChange, onClear, page, totalProducts}: Props) {
  const hasFilters = Boolean(value.search.trim()) ||
    value.source !== "all" || value.stock !== "all" ||
    value.publication !== "all" || value.sort !== "newest";

  return (
    <section aria-label="Ürün Yönetim Barı" className="mb-4 rounded-[20px] border border-[#d9e6f4] bg-[#f8fbff] p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2 text-[#15385e]">
          <SlidersHorizontal size={18} aria-hidden="true"/>
          <h3 className="text-sm font-extrabold">Ürün Yönetim Barı</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="text-xs font-semibold text-[#44617e]">
            {page.total.toLocaleString("tr-TR")} sonuç · {totalProducts.toLocaleString("tr-TR")} toplam ürün
          </span>
          {hasFilters && (
            <button type="button" onClick={onClear}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#264f7b] hover:bg-slate-50">
              <X size={14} aria-hidden="true"/> Filtreleri Temizle
            </button>
          )}
        </div>
      </div>
      <div role="search" aria-label="Ürün arama ve filtreleme"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(145px,1fr))]">
        <label className="relative block min-w-0">
          <span className="sr-only">Ürün adı, stok kodu veya barkod ara</span>
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="search" autoComplete="off" maxLength={150}
            value={value.search} onChange={event => onChange({search:event.target.value})}
            placeholder="Ürün adı, stok kodu, barkod ara..."
            className="h-11 w-full min-w-0 rounded-xl border border-[#dbe5f0] bg-white pl-10 pr-3 text-[13px] text-[#142b4e] outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"/>
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Ürün kaynağı</span>
          <select value={value.source} aria-label="Ürün kaynağı"
            onChange={event => onChange({source:event.target.value as ProductToolbarState["source"]})}
            className={selectClass}>
            <option value="all">Tüm Kaynaklar</option>
            <option value="b2b">B2B Bağlantılı</option>
            <option value="local">Yalnız Dükkân</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="sr-only">B2B yayın durumu</span>
          <select value={value.publication} aria-label="B2B yayın durumu"
            onChange={event => onChange({publication:event.target.value as ProductToolbarState["publication"]})}
            className={selectClass}>
            <option value="all">Tüm Yayın Durumları</option>
            <option value="published">Yayında</option>
            <option value="draft">Yayında Değil</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Stok durumu</span>
          <select value={value.stock} aria-label="Stok durumu"
            onChange={event => onChange({stock:event.target.value as ProductToolbarState["stock"]})}
            className={selectClass}>
            <option value="all">Tüm Stoklar</option>
            <option value="available">Stokta Var</option>
            <option value="low">Az Stok (1–10)</option>
            <option value="empty">Stoğu Tükenen</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Ürün sıralaması</span>
          <select value={value.sort} aria-label="Ürün sıralaması"
            onChange={event => onChange({sort:event.target.value as ProductToolbarState["sort"]})}
            className={selectClass}>
            <option value="newest">En Yeni Ürünler</option>
            <option value="name">Ürün Adı (A–Z)</option>
            <option value="stock-desc">Stok (Çoktan Aza)</option>
            <option value="stock-asc">Stok (Azdan Çoğa)</option>
            <option value="price-desc">Fiyat (Yüksekten Düşüğe)</option>
            <option value="price-asc">Fiyat (Düşükten Yükseğe)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3edf8] pt-3">
        <span className="text-xs text-slate-500" aria-live="polite">
          {page.first.toLocaleString("tr-TR")}–{page.last.toLocaleString("tr-TR")} / {page.total.toLocaleString("tr-TR")} ürün gösteriliyor
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Sayfa başına
            <select value={value.pageSize} aria-label="Sayfa başına ürün"
              onChange={event => onChange({pageSize:Number(event.target.value)})}
              className="h-9 rounded-lg border border-[#dbe5f0] bg-white px-2 text-xs font-semibold text-[#173a63]">
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
          </label>
          <button type="button" aria-label="Önceki sayfa" disabled={page.page <= 1}
            onClick={() => onChange({page:page.page-1})}
            className="h-9 rounded-lg border border-[#dbe5f0] bg-white px-3 text-xs font-semibold text-[#173a63] disabled:cursor-not-allowed disabled:opacity-40">
            Önceki
          </button>
          <span className="min-w-[70px] text-center text-xs font-semibold text-[#173a63]">{page.page} / {page.totalPages}</span>
          <button type="button" aria-label="Sonraki sayfa" disabled={page.page >= page.totalPages}
            onClick={() => onChange({page:page.page+1})}
            className="h-9 rounded-lg border border-[#dbe5f0] bg-white px-3 text-xs font-semibold text-[#173a63] disabled:cursor-not-allowed disabled:opacity-40">
            Sonraki
          </button>
        </div>
      </div>
    </section>
  );
}
