import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, PackageSearch, ReceiptText, ShoppingBag } from "lucide-react";
import { B2BHeader } from "@/components/b2b-header";

type CustomerSession = {role?: string; isActive?: boolean} | null;
type OrderSummary = {
  id: string | number;
  order_number?: string | null;
  status?: string | null;
  payment_status?: string | null;
  item_count?: number | null;
  total_amount?: number | string | null;
  created_at?: string | null;
};

async function loadSession(): Promise<CustomerSession> {
  const response = await fetch("/api/auth/me", {credentials: "include"});
  if (!response.ok) return null;
  return response.json();
}
async function loadOrders(): Promise<OrderSummary[]> {
  const response = await fetch("/api/b2b/my-orders", {credentials: "include", cache: "no-store"});
  if (!response.ok) throw new Error("Sipariş geçmişi alınamadı.");
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload as OrderSummary[] : [];
}
const money = (value: unknown) => Number(value || 0).toLocaleString("tr-TR", {style:"currency",currency:"TRY"});
const orderStatusLabels: Record<string,string> = {
  pending: "Beklemede", paid: "Ödendi", completed: "Tamamlandı",
  cancelled: "İptal", shipped: "Kargoda", delivered: "Teslim Edildi",
  processing: "Hazırlanıyor", paid_stock_review: "Stok kontrolünde"
};
const statusLabel = (value: string | null | undefined) => orderStatusLabels[String(value || "").toLowerCase()] || value || "Durum bekleniyor";

export default function B2BOrderHistory() {
  const {data:session,isLoading:sessionLoading} = useQuery({
    queryKey:["/api/auth/me"],queryFn:loadSession,staleTime:15_000,retry:false
  });
  const isCustomer=session?.role==="b2b_customer" && session?.isActive===true;
  const {data:orders=[],isLoading,isError,refetch} = useQuery({
    queryKey:["/api/b2b/my-orders"],queryFn:loadOrders,enabled:isCustomer,retry:1
  });
  return <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
    <B2BHeader/>
    <main className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">Çalışkan B2B · Bayi Paneli</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Siparişlerim</h1>
          <p className="mt-1 text-sm text-slate-600">Oluşturduğunuz siparişlerin durumunu ve tutarlarını takip edin.</p>
        </div>
        <Link href="/siparislerim" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ffcc00] px-4 text-sm font-bold text-[#0b192d] hover:bg-amber-400">
          <ShoppingBag className="h-4 w-4"/> Sepete Git
        </Link>
      </div>
      {sessionLoading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">Hesap kontrol ediliyor…</div>
      : !isCustomer ? <div className="rounded-2xl border bg-white p-8 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-slate-400"/>
          <h2 className="mt-3 text-lg font-black">Sipariş geçmişiniz için bayi girişi yapın</h2>
          <Link href="/uye-girisi?from=siparis-gecmisi" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0b192d] px-5 font-bold text-white">Bayi Girişi <ArrowRight className="h-4 w-4"/></Link>
        </div>
      : isLoading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">Siparişler yükleniyor…</div>
      : isError ? <div role="alert" className="rounded-2xl border bg-white p-8 text-sm text-slate-700">Sipariş geçmişi yüklenemedi. <button type="button" onClick={()=>void refetch()} className="ml-2 font-bold text-amber-800 underline">Tekrar dene</button></div>
      : orders.length===0 ? <div className="rounded-2xl border bg-white p-10 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-slate-300"/>
          <h2 className="mt-3 text-lg font-bold">Henüz siparişiniz bulunmuyor</h2>
          <p className="mt-1 text-sm text-slate-500">Toptan ürünleri inceleyerek ilk siparişinizi oluşturabilirsiniz.</p>
          <Link href="/" className="mt-5 inline-flex rounded-xl bg-[#ffcc00] px-5 py-3 text-sm font-bold">Ürünleri Keşfet</Link>
        </div>
      : <div className="grid gap-3">
          {orders.map(order=><article key={String(order.id)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-extrabold">Sipariş {order.order_number || "#"+order.id}</p>
                <p className="mt-1 text-xs text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleDateString("tr-TR") : "Tarih belirtilmemiş"} · {order.item_count || 0} ürün</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{statusLabel(order.status)}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div><p className="text-xs text-slate-500">Sipariş toplamı</p><p className="text-lg font-black">{money(order.total_amount)}</p></div>
              <Link href="/hesabim?tab=invoices" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b192d] hover:underline"><ReceiptText className="h-4 w-4"/> Faturalarım <ArrowRight className="h-4 w-4"/></Link>
            </div>
          </article>)}
        </div>}
    </main>
  </div>;
}
