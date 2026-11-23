import { useEffect, useRef, useState } from "react";
import { B2BProductCard } from "@/components/b2b-product-card";
import type { UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import {
  interpolateProductRowScroll,
  nextProductRowOffset,
  PRODUCT_ROW_HOLD_MS,
  PRODUCT_ROW_SLIDE_MS,
  PRODUCT_ROW_END_HOLD_MS,
} from "@/lib/b2b-product-auto-scroll";

const PAGE_SIZE = 60;
const AUTO_SCROLL_PAGE_SIZE = 24;
const MANUAL_SCROLL_PAUSE_MS = 8000;

/**
 * Keep the entire catalog accessible in a two-column grid on phones.
 * The wholesale homepage can also autoplay the vertical grid inside its own
 * viewport (never scroll the whole document). Other rails remain unchanged.
 */
function B2BProductGrid({
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
  const [visibleRowHeight, setVisibleRowHeight] = useState(0);
  const productGridRef = useRef<HTMLDivElement>(null);
  const rescheduleRef = useRef<((delay: number) => void) | null>(null);
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

  const measureRowHeight = (rowIndex: number) => {
    const grid = productGridRef.current;
    if (!grid) return;
    const first = grid.children.item(rowIndex * 2) as HTMLElement | null;
    const second = grid.children.item(rowIndex * 2 + 1) as HTMLElement | null;
    const height = Math.ceil(Math.max(first?.offsetHeight || 0, second?.offsetHeight || 0));
    if (height > 0) setVisibleRowHeight(current => current === height ? current : height);
  };

  // Show exactly one side-by-side pair on phones. A different-sized row can
  // expand the viewport instead of cutting off the price / campaign / box info.
  useEffect(() => {
    if (!canAutoScroll || !isMobile) return;
    const grid = productGridRef.current;
    const viewport = scrollViewportRef.current;
    if (!grid || !viewport) return;
    const refresh = () => {
      const children = Array.from(grid.children) as HTMLElement[];
      let activeRow = 0;
      for (let index = 0; index < children.length; index += 2) {
        if (children[index].offsetTop <= viewport.scrollTop + 3) activeRow = index / 2;
        else break;
      }
      measureRowHeight(activeRow);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
    observer?.observe(grid);
    for (const child of Array.from(grid.children)) observer?.observe(child);
    window.addEventListener("resize", refresh);
    refresh();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, [canAutoScroll, isMobile, visibleCount, products]);

  // Each tick moves a *whole row* (two products) from the bottom upward using
  // a cancelable eased animation. No constant-speed drifting or half-card stops.
  useEffect(() => {
    if (!canAutoScroll || !isMobile || !inViewport || !autoplay || reducedMotion) return;
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    let timer = 0;
    let frameId = 0;
    let disposed = false;

    const cancel = () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frameId);
    };
    const schedule = (delay: number) => {
      cancel();
      if (!disposed) timer = window.setTimeout(advance, delay);
    };
    const animateRow = (target: number) => {
      const from = viewport.scrollTop;
      let startedAt: number | null = null;
      const frame = (now: number) => {
        if (disposed) return;
        if (startedAt === null) startedAt = now;
        const elapsed = now - startedAt;
        viewport.scrollTop = interpolateProductRowScroll(from, target, elapsed, PRODUCT_ROW_SLIDE_MS);
        if (elapsed >= PRODUCT_ROW_SLIDE_MS) {
          schedule(PRODUCT_ROW_HOLD_MS);
        } else {
          frameId = window.requestAnimationFrame(frame);
        }
      };
      frameId = window.requestAnimationFrame(frame);
    };
    const advance = () => {
      if (disposed) return;
      const activeElement = document.activeElement;
      if (document.hidden || Date.now() < pausedUntilRef.current ||
          (activeElement !== null && viewport.contains(activeElement))) {
        schedule(500);
        return;
      }
      const grid = productGridRef.current;
      if (!grid) {
        schedule(PRODUCT_ROW_HOLD_MS);
        return;
      }
      const children = Array.from(grid.children) as HTMLElement[];
      const offsets = children.filter((_, index) => index % 2 === 0).map(child => child.offsetTop);
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (maxScrollTop <= 1) {
        if (hasMore) setVisibleCount(count => Math.min(count + pageSize, products.length));
        schedule(PRODUCT_ROW_HOLD_MS);
        return;
      }

      // When we reach the final visible row, bring in more catalog products
      // first. Only reset to the first pair after the actual final row.
      if (viewport.scrollTop >= maxScrollTop - 2) {
        if (hasMore) {
          setVisibleCount(count => Math.min(count + pageSize, products.length));
        } else {
          viewport.scrollTop = 0;
          measureRowHeight(0);
        }
        schedule(PRODUCT_ROW_END_HOLD_MS);
        return;
      }
      const nextOffset = nextProductRowOffset(offsets, viewport.scrollTop);
      if (nextOffset === null) {
        if (hasMore) setVisibleCount(count => Math.min(count + pageSize, products.length));
        else {
          viewport.scrollTop = 0;
          measureRowHeight(0);
        }
        schedule(PRODUCT_ROW_END_HOLD_MS);
        return;
      }

      const nextIndex = offsets.indexOf(nextOffset);
      measureRowHeight(nextIndex);
      // Run on the next frame so React can fit the viewport to the new pair.
      frameId = window.requestAnimationFrame(() => {
        const availableScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const target = Math.min(nextOffset, availableScroll);
        if (target <= viewport.scrollTop + 1) {
          schedule(PRODUCT_ROW_HOLD_MS);
          return;
        }
        animateRow(target);
      });
    };
    rescheduleRef.current = schedule;
    schedule(PRODUCT_ROW_HOLD_MS);
    return () => {
      disposed = true;
      cancel();
      rescheduleRef.current = null;
    };
  }, [canAutoScroll, isMobile, inViewport, autoplay, reducedMotion, hasMore, visibleCount, products.length, pageSize]);

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
    rescheduleRef.current?.(MANUAL_SCROLL_PAUSE_MS);
  };

  return (
    <>
      {canAutoScroll ? (
        <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
          <span className="text-[11px] font-medium text-slate-500">2 ürün bir sırada · Yukarı kayarak geçer</span>
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
        style={canAutoScroll && isMobile && visibleRowHeight > 0 ? { height: visibleRowHeight } : undefined}
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
          ref={productGridRef}
          className="relative grid w-full min-w-0 grid-cols-2 gap-2 pb-4 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5"
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

export function B2BProductRail(props: {products: UnifiedB2BProduct[]; loggedIn:boolean; title?:string; autoScroll?:boolean}) {
  return props.autoScroll ? <HorizontalProducts {...props}/> : <B2BProductGrid {...props}/>;
}
function HorizontalProducts({products,loggedIn,title}: {products:UnifiedB2BProduct[];loggedIn:boolean;title?:string}) {
  const rail = useRef<HTMLDivElement>(null);
  const pauseUntil = useRef(0);
  const [playing,setPlaying] = useState(true);
  const [visible,setVisible] = useState(false);
  useEffect(() => {
    const el=rail.current;
    if(!el)return;
    if(typeof IntersectionObserver==="undefined"){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{threshold:0.1});
    observer.observe(el);return ()=>observer.disconnect();
  },[]);
  const move=(direction:number, smooth=true)=>{
    const el=rail.current;
    if(!el)return;
    const first=el.children[0] as HTMLElement|undefined;
    const second=el.children[1] as HTMLElement|undefined;
    if(!first||!second)return;
    const step=second.offsetLeft-first.offsetLeft;
    const max=Math.max(0,el.scrollWidth-el.clientWidth);
    if(max<2)return;
    const target=direction>0?(el.scrollLeft>=max-2?0:Math.min(max,el.scrollLeft+step)):(el.scrollLeft<=2?max:Math.max(0,el.scrollLeft-step));
    el.scrollTo({left:target,behavior:smooth?"smooth":"auto"});
  };
  useEffect(()=>{
    if(!playing||!visible||products.length<2)return;
    const timer=window.setInterval(()=>{
      if(document.hidden||Date.now()<pauseUntil.current||rail.current?.contains(document.activeElement)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      move(1);
    },3000);
    return ()=>window.clearInterval(timer);
  },[playing,visible,products.length]);
  const pause=()=>{pauseUntil.current=Date.now()+8000;};
  return <div className="min-w-0">
    <div className="mb-2 flex items-center justify-end gap-2">
      <button type="button" aria-label="Önceki ürün" onClick={()=>{pause();move(-1);}} className="rounded-lg border bg-white px-3 py-2 text-sm">‹</button>
      <button type="button" onClick={()=>setPlaying(v=>!v)} aria-pressed={!playing} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">{playing?"Duraklat":"Başlat"}</button>
      <button type="button" aria-label="Sonraki ürün" onClick={()=>{pause();move(1);}} className="rounded-lg border bg-white px-3 py-2 text-sm">›</button>
    </div>
    <div ref={rail} role="region" aria-label={title||"Ürün sliderı"} onTouchStart={pause} onPointerDown={pause} onWheel={pause} className="relative flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {products.map((product,index)=><div key={String(product.id)+"-"+index} className="w-[calc((100%-8px)/2)] min-w-0 shrink-0 snap-start sm:w-[calc((100%-16px)/3)] lg:w-[calc((100%-24px)/4)] xl:w-[calc((100%-32px)/5)]"><B2BProductCard product={product} loggedIn={loggedIn}/></div>)}
    </div>
  </div>;
}
