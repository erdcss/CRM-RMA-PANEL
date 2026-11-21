import { useEffect, useRef, useState } from "react";
import { B2BProductCard } from "@/components/b2b-product-card";
import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";

const PAGE_SIZE = 60;

/**
 * Keep initial render small even when the wholesale catalog has thousands of
 * items. Fetching all lightweight product metadata preserves full-text search,
 * stock priority and category counts; render the next cards near the viewport.
 */
export function B2BProductRail({
  products, loggedIn, title,
}: {
  products: UnifiedB2BProduct[];
  loggedIn: boolean;
  title?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products]);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current || typeof IntersectionObserver === "undefined") return;
    const scroller = document.querySelector<HTMLElement>(".b2b-site");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        setVisibleCount(current => Math.min(current + PAGE_SIZE, products.length));
      },
      { root: scroller, rootMargin: "700px 0px", threshold: 0 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, products.length]);

  return (
    <>
      <div role="region"
        aria-label={title || "Ürün kataloğu"}
        className="grid w-full min-w-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, visibleCount).map(product => (
          <div key={String(product.id)} className="min-w-0 w-full">
            <B2BProductCard product={product} loggedIn={loggedIn} />
          </div>
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pb-6">
          <p className="text-xs text-slate-500">
            {Math.min(visibleCount, products.length)} / {products.length} ürün gösteriliyor
          </p>
          <button type="button"
            onClick={() => setVisibleCount(current => Math.min(current + PAGE_SIZE, products.length))}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:border-amber-400 hover:bg-amber-50">
            Daha fazla ürün göster
          </button>
        </div>
      ) : null}
    </>
  );
}
