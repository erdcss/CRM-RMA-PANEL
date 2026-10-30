import { Link } from "wouter";
import { BadgeCheck, Package } from "lucide-react";
import { type UnifiedB2BProduct, unifiedProductHref } from "@/lib/b2b-marketplace-products";

export function B2BProductCard({
  product,
  loggedIn,
}: {
  product: UnifiedB2BProduct;
  loggedIn: boolean;
}) {
  const image = product.image_data || product.image_url;
  const visiblePrice = loggedIn && product.price !== null && product.price !== undefined;
  // Company-owned products have no seller_name in the catalog response.
  // Supplier names always come from their verified marketplace listing.
  const sellerName = product.marketplace || product.seller_slug
    ? product.seller_name
    : "ÇALIŞKAN";
  return (
    <Link
      href={unifiedProductHref(product)}
      className="group block h-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/40 sm:rounded-2xl"
    >
      <article className="min-w-0">
        <div className="flex aspect-square items-center justify-center bg-slate-50">
          {image ? (
            <img src={image} alt={product.name || "Ürün"} loading="lazy"
              className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02] sm:p-3" />
          ) : (
            <Package className="h-12 w-12 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 p-2 sm:p-3">
          <div className="truncate text-[10px] text-slate-400 sm:text-[11px]">{product.sku || "STOK"}</div>
          <h3 className="mt-1 min-h-9 line-clamp-2 break-words text-xs font-semibold leading-[18px] sm:min-h-10 sm:text-sm sm:leading-5">{product.name || "Ürün"}</h3>
          {sellerName ? (
            <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-slate-600 sm:text-[11px]" aria-label={"Satıcı: " + sellerName}>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
              <span className="truncate">{sellerName}</span>
            </p>
          ) : null}
          <div className="mt-2 min-w-0 break-words text-xs font-semibold leading-5 text-slate-700 sm:mt-3 sm:text-sm">
            {visiblePrice
              ? Number(product.price).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺"
              : "Fiyat için giriş yapın"}
          </div>
          <div className="mt-2 grid min-w-0 grid-cols-2 gap-1 text-[10px] leading-snug sm:mt-3 sm:gap-2 sm:text-[11px]">
            <div className="min-w-0 break-words rounded-md bg-slate-100 p-1.5 sm:rounded-lg sm:p-2">Koli içi<br /><b>{product.units_per_box || 1} adet</b></div>
            <div className="min-w-0 break-words rounded-md bg-amber-50 p-1.5 sm:rounded-lg sm:p-2">Min. alım<br /><b>{product.min_order_qty || 1} koli</b></div>
          </div>
        </div>
      </article>
    </Link>
  );
}
