import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

type ReturnItem = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  receipt_number?: string | null;
  created_at?: string | null;
};

export default function AdminReturns() {
  const { data = [], isLoading } = useQuery<ReturnItem[]>({ queryKey: ["/api/admin/returns"] });

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <RotateCcw className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">İade İşlemleri</h1>
            <p className="text-sm text-muted-foreground">RMA iade kayıtlarının operasyon görünümü.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">İadeler yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Henüz iade kaydı yok.</div>
          ) : data.map((item) => (
            <div key={item.id} className="grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[140px_1fr_160px_140px] sm:items-center">
              <div className="font-semibold">{item.receipt_number || `RMA-${item.id}`}</div>
              <div>
                <div className="font-medium">{item.name || "Ürün"}</div>
                <div className="text-xs text-muted-foreground">{item.brand || "—"}</div>
              </div>
              <div className="text-sm">
                <div>{item.customer_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{item.customer_phone || ""}</div>
              </div>
              <div className="text-sm font-medium">{item.status || "beklemede"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
