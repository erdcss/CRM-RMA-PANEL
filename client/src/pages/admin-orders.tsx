import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";

type Order = {
  id: string | number;
  order_number?: string | null;
  customer_email?: string | null;
  status?: string | null;
  item_count?: number | null;
  total_amount?: string | number | null;
  created_at?: string | null;
};

export default function AdminOrders() {
  const { data = [], isLoading } = useQuery<Order[]>({ queryKey: ["/api/admin/orders"] });

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Siparişler</h1>
            <p className="text-sm text-muted-foreground">B2B sipariş hareketlerini tek ekrandan takip edin.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Siparişler yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Henüz sipariş bulunmuyor.</div>
          ) : data.map((order) => (
            <div key={order.id} className="grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_120px_120px_150px] sm:items-center">
              <div className="font-semibold">{order.order_number || `#${order.id}`}</div>
              <div className="truncate text-sm text-muted-foreground">{order.customer_email || "—"}</div>
              <div className="text-sm">{order.status || "pending"}</div>
              <div className="text-sm">{Number(order.item_count || 0)} ürün</div>
              <div className="text-sm font-semibold">{Number(order.total_amount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
