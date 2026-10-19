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
      className="group block min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/40"
    >
      <article>
        <div className="flex aspect-square items-center justify-center bg-slate-50">
          {image ? (
            <img src={image} alt={product.name || "Ürün"} loading="lazy"
              className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02]" />
          ) : (
            <Package className="h-12 w-12 text-slate-300" />
          )}
        </div>
        <div className="p-3">
          <div className="text-[11px] text-slate-400">{product.sku || "STOK"}</div>
          <h3 className="mt-1 min-h-10 line-clamp-2 font-semibold">{product.name || "Ürün"}</h3>
          {sellerName ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-600" aria-label={"Satıcı: " + sellerName}>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
              <span className="truncate">{sellerName}</span>
            </p>
          ) : null}
          <div className="mt-3 text-sm font-semibold text-slate-700">
            {visiblePrice
              ? Number(product.price).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺"
              : "Fiyat için giriş yapın"}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-100 p-2">Koli içi<br /><b>{product.units_per_box || 1} adet</b></div>
            <div className="rounded-lg bg-amber-50 p-2">Min. alım<br /><b>{product.min_order_qty || 1} koli</b></div>
          </div>
        </div>
      </article>
    </Link>
  );
}
