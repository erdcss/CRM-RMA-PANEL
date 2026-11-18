import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { isNewArrival, newArrivalExpiry } from "@/lib/b2b-new-arrivals";

type Props = {
  createdAt?: string | null;
  size?: "card" | "detail";
};

/** Shared visual badge; disappears automatically when the original 24h window ends. */
export function B2BNewArrivalBadge({ createdAt, size = "card" }: Props) {
  const [visible, setVisible] = useState(() => isNewArrival(createdAt));

  useEffect(() => {
    const expires = newArrivalExpiry(createdAt);
    const now = Date.now();
    const active = isNewArrival(createdAt, now);
    setVisible(active);
    if (!active || expires === null) return;
    // Set a single expiration timer so an open card/detail page updates by itself.
    const timeout = window.setTimeout(() => setVisible(false), Math.max(0, expires - now));
    return () => window.clearTimeout(timeout);
  }, [createdAt]);

  if (!visible) return null;

  const detail = size === "detail";
  return (
    <span
      role="status"
      aria-label="Yeni geldi: Son 24 saat içinde eklenen ürün"
      className={`pointer-events-none absolute left-2 top-2 z-20 inline-flex max-w-[calc(100%-16px)] items-center overflow-hidden rounded-full shadow-sm sm:left-3 sm:top-3 ${detail ? "sm:shadow-md" : ""}`}
    >
      <span className={`whitespace-nowrap bg-[#16a34a] font-extrabold tracking-wide text-white ${detail ? "px-2.5 py-1.5 text-[10px] sm:px-3.5 sm:py-2 sm:text-xs" : "px-2 py-1 text-[9px] sm:px-2.5 sm:py-1.5 sm:text-[10px]"}`}>
        YENİ GELDİ
      </span>
      <span className={`inline-flex items-center gap-1 whitespace-nowrap bg-[#eaf8ef] font-bold text-[#18894c] ${detail ? "px-2 py-1.5 text-[9px] sm:px-3 sm:py-2 sm:text-[11px]" : "px-1.5 py-1 text-[9px] sm:px-2 sm:py-1.5 sm:text-[10px]"}`}>
        <Clock3 aria-hidden="true" className={detail ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2.5} />
        24 SAAT
      </span>
    </span>
  );
}
