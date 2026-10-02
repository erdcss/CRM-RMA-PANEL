import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";

import { B2BHeader } from "@/components/b2b-header";

async function loadOrders() {
  const response = await fetch("/api/b2b/my-orders", { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    window.location.assign("/uye-girisi");
    return [];
  }
  if (!response.ok) throw new Error("Siparişler alınamadı");
  return response.json();
}

export default function B2BOrders() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/b2b/my-orders"],
    queryFn: loadOrders,
  });

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader />
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black">Siparişlerim</h1>
          <p className="mt-1 text-sm text-slate-500">B2B siparişlerinizi ve durumlarını takip edin.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {isLoading ? (
            <div className="p-10 text-center text-slate-500">Siparişler yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center">
              <PackageSearch className="mx-auto h-10 w-10 text-slate-300" />
              <div className="mt-3 font-semibold">Henüz siparişiniz yok</div>
              <div className="mt-1 text-sm text-slate-500">Oluşturduğunuz siparişler burada listelenecek.</div>
            </div>
          ) : (
            <div className="divide-y">
              {data.map((order) => (
                <div key={order.id} className="grid gap-3 p-4 sm:grid-cols-6 sm:items-center">
                  <div>
                    <div className="text-xs text-slate-500">Sipariş</div>
                    <div className="font-bold">#{order.order_number || order.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Durum</div>
                    <div className="font-medium">{order.status || "pending"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Ödeme</div>
                    <div className="font-medium">
                      {order.payment_method === "bank_transfer" ? "Havale / EFT" : order.payment_method === "card" ? "Kart / iyzico" : "—"}
                    </div>
                    <div className="text-xs text-slate-500">{order.payment_status || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Ürün</div>
                    <div className="font-medium">{order.item_count || 0} adet</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Toplam</div>
                    <div className="font-bold">{Number(order.total_amount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
                  </div>
                  <div className="text-sm text-slate-500 sm:text-right">{new Date(order.created_at).toLocaleDateString("tr-TR")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
