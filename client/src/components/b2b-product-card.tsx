import { Link } from "wouter";
import { BadgeCheck, Ban, Package, PackageX } from "lucide-react";
import { type UnifiedB2BProduct, unifiedProductHref } from "@/lib/b2b-marketplace-products";

export function B2BProductCard({
  product,
  loggedIn,
  showPrice = true,
}: {
  product: UnifiedB2BProduct;
  loggedIn: boolean;
  showPrice?: boolean;
}) {
  const image = product.image_data || product.image_url || (Array.isArray(product.images) ? product.images[0] : null);
  const visiblePrice = showPrice && loggedIn && product.price !== null && product.price !== undefined;
  const pack = Math.max(1, Number(product.units_per_box) || 1);
  const minBoxes = Math.max(1, Number(product.min_order_qty) || 1);
  const stock = Math.max(0, Number(product.stock) || 0);
  const soldOut = stock === 0;
  const cannotOrder = stock < pack * minBoxes;
  // Company-owned products have no seller_name in the catalog response.
  // Supplier names always come from their verified marketplace listing.
  const sellerName = product.marketplace || product.seller_slug
    ? product.seller_name
    : "ÇALIŞKAN";

  return (
    <Link
      href={unifiedProductHref(product)}
      aria-label={`${product.name || "Ürün"}${cannotOrder ? soldOut ? " - Stoklar tükenmiştir" : " - Sipariş için yeterli stok yok" : ""}`}
      className={`group block h-full min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/40 sm:rounded-2xl ${
        cannotOrder ? "border-slate-200 hover:border-rose-200" : "border-slate-200 hover:border-amber-300 hover:shadow-md"
      }`}
    >
      <article className="flex h-full min-w-0 flex-col">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-50">
          <div className={`flex h-full w-full items-center justify-center ${
            cannotOrder ? "opacity-50 grayscale-[40%]" : ""
          }`}>
            {image ? (
              <img src={image} alt={product.name || "Ürün"} loading="lazy"
                className={`h-full w-full object-contain p-2 transition-transform duration-200 sm:p-3 ${!cannotOrder ? "group-hover:scale-[1.02]" : ""}`} />
            ) : (
              <Package className="h-12 w-12 text-slate-300" />
            )}
          </div>
          {cannotOrder ? (
            <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 rounded-full border border-white/90 bg-gradient-to-r from-red-600 to-red-700 px-2 py-2.5 text-center text-[11px] font-extrabold tracking-wide text-white shadow-md sm:inset-x-3 sm:gap-2.5 sm:py-3 sm:text-sm"
              role="status">
              <Ban className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true"/>
              <span>{soldOut ? "STOKTA YOK" : "STOK YETERSİZ"}</span>
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
          <div className="truncate text-[10px] text-slate-400 sm:text-[11px]">{product.sku || "STOK"}</div>
          <h3 className="mt-1 min-h-9 line-clamp-2 break-words text-xs font-semibold leading-[18px] sm:min-h-10 sm:text-sm sm:leading-5">{product.name || "Ürün"}</h3>
          {sellerName ? (
            <p className={`mt-1 flex min-w-0 items-center gap-1 text-[10px] sm:text-[11px] ${cannotOrder ? "text-slate-400" : "text-slate-600"}`} aria-label={"Satıcı: " + sellerName}>
              <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${cannotOrder ? "text-slate-400" : "text-green-600"}`} />
              <span className="truncate">{sellerName}</span>
            </p>
          ) : null}
          <div className={`mt-2 min-w-0 break-words text-xs font-semibold leading-5 sm:mt-3 sm:text-sm ${cannotOrder ? "text-slate-400" : "text-slate-700"}`}>
            {visiblePrice
              ? Number(product.price).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺"
              : showPrice ? "Fiyat için giriş yapın" : "Fiyat bilgisi gizli"}
          </div>
          {cannotOrder ? (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-2 text-[10px] font-semibold text-red-800 sm:mt-3 sm:text-xs">
              <PackageX className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true"/>
              <span>{soldOut ? "Stoklar tükenmiştir." : "Sipariş için yeterli stok yok."}</span>
            </div>
          ) : null}
          <div className="mt-auto grid min-w-0 grid-cols-2 gap-1 pt-2 text-[10px] leading-snug sm:gap-2 sm:pt-3 sm:text-[11px]">
            <div className={`min-w-0 break-words rounded-md p-1.5 sm:rounded-lg sm:p-2 ${cannotOrder ? "bg-slate-100 text-slate-400" : "bg-slate-100"}`}>Koli içi<br /><b>{pack} adet</b></div>
            <div className={`min-w-0 break-words rounded-md p-1.5 sm:rounded-lg sm:p-2 ${cannotOrder ? "bg-slate-100 text-slate-400" : "bg-amber-50"}`}>Min. alım<br /><b>{minBoxes} koli</b></div>
          </div>
        </div>
      </article>
    </Link>
  );
}
