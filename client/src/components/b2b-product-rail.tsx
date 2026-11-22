import { useEffect, useRef, useState } from "react";
import { B2BProductCard } from "@/components/b2b-product-card";
import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import { nextProductScrollTop } from "@/lib/b2b-product-auto-scroll";

const PAGE_SIZE = 60;
const AUTO_SCROLL_PAGE_SIZE = 24;
const MANUAL_SCROLL_PAUSE_MS = 8000;

/**
 * Keep the entire catalog accessible in a two-column grid on phones.
 * The wholesale homepage can also autoplay the vertical grid inside its own
 * viewport (never scroll the whole document). Other rails remain unchanged.
 */
export function B2BProductRail({
  products, loggedIn, title, autoScroll = false,
}: {
  products: UnifiedB2BProduct[];
  loggedIn: boolean;
  title?: string;
  autoScroll?: boolean;
}) {
  const canAutoScroll = autoScroll && products.length > 2;
  const pageSize = canAutoScroll ? AUTO_SCROLL_PAGE_SIZE : PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [autoplay, setAutoplay] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pausedUntilRef = useRef(0);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    setVisibleCount(pageSize);
    if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = 0;
  }, [products, pageSize]);

  useEffect(() => {
    if (!canAutoScroll || typeof window.matchMedia !== "function") return;
    const mobile = window.matchMedia("(max-width: 639px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setIsMobile(mobile.matches);
      setReducedMotion(reduced.matches);
    };
    update();
    mobile.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, [canAutoScroll]);

  // No offscreen work: autoplay only when at least part of the product list
  // is actually visible in the browser's scroll viewport.
  useEffect(() => {
    if (!canAutoScroll || !isMobile) return;
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    if (typeof IntersectionObserver === "undefined") {
      setInViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => setInViewport(entries.some(entry => entry.isIntersecting)),
      { threshold: 0.1 },
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [canAutoScroll, isMobile]);

  useEffect(() => {
    if (!canAutoScroll || !isMobile || !inViewport || !autoplay || reducedMotion) return;
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    let frameId = 0;
    let previousFrame = 0;
    let bottomSince: number | null = null;

    const frame = (now: number) => {
      const deltaMs = previousFrame > 0 ? now - previousFrame : 0;
      previousFrame = now;
      const focusedInside = document.activeElement !== null && viewport.contains(document.activeElement);
      if (!document.hidden && Date.now() >= pausedUntilRef.current && !focusedInside) {
        const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const atEnd = maxScrollTop > 0 && viewport.scrollTop >= maxScrollTop - 1;
        if (atEnd && bottomSince === null) bottomSince = now;
        if (!atEnd) bottomSince = null;
        viewport.scrollTop = nextProductScrollTop(
          viewport.scrollTop,
          maxScrollTop,
          deltaMs,
          atEnd && bottomSince !== null ? now - bottomSince : 0,
        );
      }
      frameId = window.requestAnimationFrame(frame);
    };
    frameId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(frameId);
  }, [canAutoScroll, isMobile, inViewport, autoplay, reducedMotion]);

  // Load more cards *inside* the mobile scrolling area as it approaches the
  // bottom. Keep a manual fallback for older browsers without observers.
  useEffect(() => {
    if (!hasMore || !sentinelRef.current || typeof IntersectionObserver === "undefined") return;
    const root = canAutoScroll && isMobile
      ? scrollViewportRef.current
      : document.querySelector<HTMLElement>(".b2b-site");
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        setVisibleCount(count => Math.min(count + pageSize, products.length));
      },
      { root, rootMargin: "700px 0px", threshold: 0 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, products.length, pageSize, canAutoScroll, isMobile]);

  const pauseForManualInteraction = () => {
    pausedUntilRef.current = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  };

  return (
    <>
      {canAutoScroll ? (
        <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
          <span className="text-[11px] font-medium text-slate-500">2 sütun · Tüm ürünler aşağı kayar</span>
          {reducedMotion ? (
            <span className="text-[11px] text-slate-500">Elle kaydırma</span>
          ) : (
            <button
              type="button"
              onClick={() => setAutoplay(enabled => !enabled)}
              aria-pressed={!autoplay}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {autoplay ? "Kaydırmayı durdur" : "Kaydırmayı başlat"}
            </button>
          )}
        </div>
      ) : null}
      <div
        ref={scrollViewportRef}
        role={canAutoScroll ? "region" : undefined}
        aria-label={canAutoScroll ? `${title || "Ürün kataloğu"} · dikey kaydırmalı iki sütunlu ürün listesi` : undefined}
        tabIndex={canAutoScroll ? 0 : undefined}
        onTouchStart={canAutoScroll ? pauseForManualInteraction : undefined}
        onTouchMove={canAutoScroll ? pauseForManualInteraction : undefined}
        onWheel={canAutoScroll ? pauseForManualInteraction : undefined}
        onPointerDown={canAutoScroll ? pauseForManualInteraction : undefined}
        onKeyDown={canAutoScroll ? pauseForManualInteraction : undefined}
        className={canAutoScroll
          ? "min-w-0 max-h-[76svh] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/80 sm:max-h-none sm:overflow-visible sm:rounded-none sm:border-0"
          : "min-w-0"}
      >
        <div
          role={canAutoScroll ? undefined : "region"}
          aria-label={canAutoScroll ? undefined : title || "Ürün kataloğu"}
          className="grid w-full min-w-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5"
        >
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
            <button
              type="button"
              onClick={() => setVisibleCount(count => Math.min(count + pageSize, products.length))}
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:border-amber-400 hover:bg-amber-50"
            >
              Daha fazla ürün göster
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
