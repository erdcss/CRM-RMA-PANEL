import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const REFRESH_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 96;

/**
 * The B2B site scrolls inside .b2b-site while the document is overflow:hidden,
 * so browser-native pull-to-refresh cannot reach the window. Handle only a
 * downward, predominantly vertical gesture initiated at the scroller's top.
 * Ordinary scrolling, carousels and form controls remain native.
 */
export function B2BMobilePullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distanceRef = useRef(0);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".b2b-site");
    if (!scroller) return;

    const media = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let frame = 0;
    let queuedDistance = 0;

    const reset = () => {
      distanceRef.current = 0;
      queuedDistance = 0;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      setDistance(0);
    };
    const paintDistance = (next: number) => {
      distanceRef.current = next;
      queuedDistance = next;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setDistance(queuedDistance);
      });
    };
    const onTouchStart = (event: TouchEvent) => {
      tracking = false;
      if (!media.matches || event.touches.length !== 1 || scroller.scrollTop > 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable], [role='dialog'], [data-pull-refresh-ignore]")) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (event.touches.length !== 1 || scroller.scrollTop > 1) {
        tracking = false;
        reset();
        return;
      }
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 9) {
        tracking = false;
        reset();
        return;
      }
      if (deltaY <= 0) {
        reset();
        return;
      }
      if (deltaY < 9 || deltaY < Math.abs(deltaX) * 1.2) return;
      if (event.cancelable) event.preventDefault();
      paintDistance(Math.min(MAX_PULL_DISTANCE, Math.round((deltaY - 8) * 0.48)));
    };
    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (distanceRef.current >= REFRESH_THRESHOLD) {
        setRefreshing(true);
        paintDistance(REFRESH_THRESHOLD);
        window.location.reload();
      } else {
        reset();
      }
    };
    const onTouchCancel = () => {
      tracking = false;
      reset();
    };
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchCancel);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const shown = distance > 0 || refreshing;
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[68px] z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg transition-opacity duration-150 md:hidden"
      style={{
        opacity: shown ? 1 : 0,
        transform: `translate3d(-50%, ${shown ? Math.min(20, distance / 3) : -32}px, 0)`,
      }}
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
        style={{ transform: !refreshing ? `rotate(${Math.round(distance * 2.5)}deg)` : undefined }} />
      {refreshing ? "Sayfa yenileniyor…" : distance >= REFRESH_THRESHOLD ? "Yenilemek için bırakın" : "Yenilemek için aşağı çekin"}
    </div>
  );
}
