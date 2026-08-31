import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRmaStatusLabel } from "@shared/rma-constants";
import { getSupplierResultLabel } from "@shared/supplier-result-constants";

const MOVEMENT_LABELS: Record<string, string> = {
  tedarikciye_sevk: "Tedarikciye sevk edildi",
  tedarikciden_geri_dondu: "Firmaya geri geldi",
  tedarikci_sonucu: "Tedarikci sonucu kaydedildi",
  satilabilir_stoga_alindi: "Satilabilir stoga alindi",
  hurdaya_ayrildi: "Hurdaya ayrildi",
  musteriye_teslim: "Musteriye teslim edildi",
};

function eventLabel(type: string, label: string) {
  if (type === "movement") return MOVEMENT_LABELS[label] || label;
  if (type === "supplier_result") return getSupplierResultLabel(label);
  return getRmaStatusLabel(label);
}

export function ProductTimeline({ productId }: { productId: number }) {
  const { data, isLoading } = useQuery<
    Array<{ at: string; type: string; label: string; performedByUserId?: string | null; notes?: string | null }>
  >({
    queryKey: [`/api/rma/products/${productId}/timeline`],
    enabled: Boolean(productId),
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return null;

  return (
    <div className="border-t pt-2.5">
      <h4 className="text-xs font-medium mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />Zaman Cizelgesi
      </h4>
      <div className="space-y-1.5">
        {data.map((ev, idx) => (
          <div key={`${ev.at}-${idx}`} className="flex gap-1.5 text-xs">
            <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{eventLabel(ev.type, ev.label)}</p>
              <p className="text-muted-foreground">
                {new Date(ev.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {ev.performedByUserId ? ` · ${ev.performedByUserId.slice(0, 8)}...` : ""}
              </p>
              {ev.notes && <p className="text-muted-foreground">{ev.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
