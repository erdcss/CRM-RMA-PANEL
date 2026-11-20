import { useEffect, useRef, useState } from "react";
import { Clock3, PackageCheck, Zap } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export function formatTimedOfferRemaining(endAt: string, now: number): string {
  const rest = Math.max(0, Date.parse(endAt) - now);
  if (!Number.isFinite(rest) || rest <= 0) return "Süre doldu";
  const seconds = Math.floor(rest / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days ? `${days}g ${pad(hours)}:${pad(minutes)}:${pad(secs)}` :
    `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function B2BTimedOffer({
  endAt, title, stock, unitsPerBox, compact = false,
}: {
  endAt?: string | null; title?: string | null;
  stock?: number | null; unitsPerBox?: number | null; compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const invalidated = useRef(false);
  useEffect(() => {
    invalidated.current = false;
    if (!endAt || !Number.isFinite(Date.parse(endAt))) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);
  const end = endAt ? Date.parse(endAt) : 0;
  const expired = Number.isFinite(end) && end > 0 && now >= end;
  useEffect(() => {
    if (!expired || invalidated.current) return;
    invalidated.current = true;
    // Never keep a timed price in stale catalog or product-detail query caches.
    void queryClient.invalidateQueries({ queryKey: ["/api/b2b/products"] });
  }, [expired]);
  if (!endAt || !Number.isFinite(end) || expired) return null;
  const boxes = Math.floor(Math.max(0, Number(stock)||0) / Math.max(1, Number(unitsPerBox)||1));
  return <div role="status" aria-label="Süreli kampanya" className={compact
    ? "mt-2 rounded-lg border border-amber-400/25 bg-slate-950 px-2 py-2 text-[#FFCD00]"
    : "mt-3 rounded-xl border border-amber-400/30 bg-slate-950 p-3 text-[#FFCD00]"}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-black">
      <span className="inline-flex items-center gap-1"><Zap size={13} fill="currentColor"/> {title || "SÜRELİ FIRSAT"}</span>
      <span className="inline-flex items-center gap-1 font-mono tabular-nums"><Clock3 size={13}/> {formatTimedOfferRemaining(endAt,now)}</span>
    </div>
    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-white">
      <PackageCheck size={13}/>{boxes} koli stokta kaldı
    </div>
  </div>;
}
