import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Order = {
  id: string | number;
  order_number?: string | null;
  customer_email?: string | null;
  status?: string | null;
  item_count?: number | null;
  total_amount?: string | number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_method?: string | null;
  card_last4?: string | null;
  created_at?: string | null;
};
async function loadOrders(): Promise<Order[]> {
  const response = await fetch("/api/admin/orders", { credentials: "include" });
  if (!response.ok) throw new Error("Siparişler alınamadı");
  return response.json();
}
function money(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}
function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    paid: "Ödendi", paid_stock_review: "Ödendi · stok kontrolü", payment_pending: "Ödeme bekliyor",
    awaiting_bank_transfer: "Havale bekleniyor", awaiting_bank_confirmation: "Havale kontrol ediliyor",
    cancel_requested: "İptal talebi", completed: "Tamamlandı", cancelled: "İptal edildi",
  };
  return labels[String(value || "")] || value || "İşlemde";
}
function paymentStatusLabel(value?: string | null) {
  const labels: Record<string,string> = {
    pending:"Havale bekleniyor",
    customer_reported_paid:"Müşteri ödemeyi bildirdi · kontrol bekliyor",
    bank_confirmed:"Ödeme onaylandı",
    SUCCESS:"Ödeme alındı",
    FAILURE:"Ödeme başarısız",
  };
  return labels[String(value || "")] || "Kontrol bekliyor";
}
function deliveryLabel(method?: string | null) {
  switch (method) {
    case "cargo": return "PTT Kargo";
    case "freight": return "Ambar / Nakliye";
    case "pickup": return "Mağazadan Teslim";
    default: return "Teslimat belirtilmemiş";
  }
}
export default function AdminOrders() {
  const { data = [], isLoading, isError, refetch } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: loadOrders,
  });
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="mb-6 flex items-start gap-3">
        <ShoppingCart className="mt-1 h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Siparişler</h1>
          <p className="text-sm text-muted-foreground">
            Siparişe tıklayarak teslimat, ödeme, ürünler, fatura ve adresleri ayrı detay sayfasında yönetin.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>Yenile</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Siparişler yükleniyor…</div>
        : isError ? <div className="p-8 text-sm text-destructive">Siparişler yüklenemedi. Yeniden deneyin.</div>
        : data.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Görüntülenecek sipariş bulunmuyor.</div>
        : <div className="divide-y">
            {data.map(order => (
              <Link key={String(order.id)} href={`/siparisler/${encodeURIComponent(String(order.id))}`}
                className="block px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{order.order_number || `#${order.id}`}</span>
                      <Badge variant="secondary">{statusLabel(order.status)}</Badge>
                      {order.payment_method === "bank_transfer" &&
                        order.status === "awaiting_bank_confirmation" &&
                        order.payment_status === "customer_reported_paid" ? (
                          <Badge variant="destructive">Banka kontrolü bekliyor</Badge>
                        ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{order.customer_email || "Müşteri"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {deliveryLabel(order.shipping_method)} · {Number(order.item_count || 0)} adet ·{" "}
                      {order.created_at ? new Date(order.created_at).toLocaleString("tr-TR") : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.payment_method === "card" ? "Kart" : order.payment_method === "bank_transfer" ? "Havale / EFT" : "Ödeme yöntemi belirtilmemiş"}
                      {order.payment_status ? ` · ${paymentStatusLabel(order.payment_status)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black">{money(Number(order.total_amount || 0))}</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">Detaylar <ChevronRight className="h-4 w-4" /></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>}
      </div>
    </div>
  </div>;
}
