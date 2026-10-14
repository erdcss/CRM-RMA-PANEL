import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileDown,
  MapPin,
  PackageSearch,
  Route,
  ShoppingCart,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/hooks/use-branding";

type Order = {
  id: string | number;
  order_number?: string | null;
  customer_email?: string | null;
  status?: string | null;
  item_count?: number | null;
  total_amount?: string | number | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  card_last4?: string | null;
  card_association?: string | null;
  cancel_requested_at?: string | null;
  created_at?: string | null;
};

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Veri alınamadı");
  return response.json();
}

function money(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

function statusLabel(value?: string | null) {
  switch (value) {
    case "paid":
      return "Ödendi";
    case "paid_stock_review":
      return "Ödendi · stok kontrolü";
    case "payment_pending":
      return "Ödeme bekliyor";
    case "awaiting_bank_transfer":
      return "Havale bekleniyor";
    case "awaiting_bank_confirmation":
      return "Havale kontrol ediliyor";
    case "cancel_requested":
      return "İptal talebi";
    default:
      return value || "Bekliyor";
  }
}

function addressText(value: any) {
  if (!value || typeof value !== "object") return "—";
  return [
    value.addressLine,
    value.district,
    value.city,
    value.postalCode,
  ].filter(Boolean).join(", ") || "—";
}

export default function AdminOrders() {
  const { data = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: () => loadJson("/api/admin/orders"),
  });
  const { data: branding } = useBranding();
  const [selectedId, setSelectedId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  // Never retain invoice number/file when switching to another customer order.
  useEffect(() => {
    setInvoiceNumber("");
    setInvoiceFile(null);
  }, [selectedId]);
  const { toast } = useToast();

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/admin/orders/detail", selectedId],
    queryFn: () => loadJson(`/api/admin/orders/${encodeURIComponent(selectedId)}`),
    enabled: Boolean(selectedId),
  });

  const { data: invoice } = useQuery<{
    id:number; invoice_number:string; order_number:string; total_amount:number; file_name:string;
  } | null>({
    queryKey: ["/api/admin/orders/invoice", selectedId],
    queryFn: () => loadJson(`/api/admin/orders/${encodeURIComponent(selectedId)}/invoice`),
    enabled: Boolean(selectedId),
  });

  async function uploadInvoice(orderId: string) {
    if (!invoiceFile) { toast({title:"PDF fatura dosyası seçin",variant:"destructive"});return; }
    const reference = invoiceNumber.trim();
    if (!reference) { toast({title:"Fatura numarası gerekli",variant:"destructive"});return; }
    if (invoiceFile.type !== "application/pdf" && !/\.pdf$/i.test(invoiceFile.name)) {
      toast({title:"Yalnızca PDF dosyası yükleyin",variant:"destructive"});return;
    }
    if (invoiceFile.size > 5*1024*1024) {
      toast({title:"PDF en fazla 5 MB olabilir",variant:"destructive"});return;
    }
    setInvoiceUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=()=>reject(new Error("PDF okunamadı"));
        reader.readAsDataURL(invoiceFile);
      });
      const response=await apiRequest("POST", `/api/admin/orders/${encodeURIComponent(orderId)}/invoice`,
        {invoiceNumber:reference,dataUrl});
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||"PDF yüklenemedi");
      await queryClient.invalidateQueries({queryKey:["/api/admin/orders/invoice",orderId]});
      setInvoiceFile(null);
      toast({title:"Fatura eklendi",description:"Müşterinin Faturalarım bölümüne kaydedildi ve bildirim oluşturuldu."});
    }catch(error) {
      toast({title:"Fatura eklenemedi",description:error instanceof Error?error.message:"Tekrar deneyin",variant:"destructive"});
    }finally{setInvoiceUploading(false);}
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Siparişler</h1>
            <p className="text-sm text-muted-foreground">
              Başarılı ve işlem bekleyen B2B siparişlerini içerikleriyle birlikte yönetin.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Siparişler yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Görüntülenecek sipariş bulunmuyor.
            </div>
          ) : (
            <div className="divide-y">
              {data.map((order) => {
                const opened = selectedId === String(order.id);
                const current = opened ? detail : null;

                return (
                  <div key={order.id}>
                    <button
                      type="button"
                      className="grid w-full gap-2 px-4 py-4 text-left hover:bg-muted/30 sm:grid-cols-[170px_1fr_150px_140px_120px_32px] sm:items-center"
                      onClick={() =>
                        setSelectedId((value) =>
                          value === String(order.id) ? "" : String(order.id),
                        )
                      }
                    >
                      <div className="font-semibold">{order.order_number || `#${order.id}`}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {order.customer_email || "—"}
                      </div>
                      <div className="text-sm font-medium">{statusLabel(order.status)}</div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {order.payment_method === "bank_transfer"
                            ? "Havale / EFT"
                            : order.payment_method === "card"
                              ? `Kart / iyzico${order.card_last4 ? ` · •••• ${order.card_last4}` : ""}`
                              : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.payment_status || "—"}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">
                        {money(Number(order.total_amount || 0))}
                      </div>
                      <div className="flex justify-end text-muted-foreground">
                        {opened ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {opened ? (
                      <div className="border-t bg-muted/10 p-4 sm:p-5">
                        {detailLoading || !current ? (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            Sipariş detayı yükleniyor…
                          </div>
                        ) : (
                          <div className="space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">
                                  SİPARİŞ DETAYI
                                </div>
                                <h2 className="mt-1 text-xl font-black">
                                  {current.order_number}
                                </h2>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {current.customer_email || "—"} ·{" "}
                                  {current.created_at
                                    ? new Date(current.created_at).toLocaleString("tr-TR")
                                    : "—"}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => printA5Order(current, branding?.b2b_logo || "")}
                              >
                                <FileDown className="mr-2 h-4 w-4" />
                                A5 Yazdır / PDF
                              </Button>
                            </div>

                            <div className="rounded-xl border bg-background p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <h3 className="font-bold">Sipariş Faturası · PDF</h3>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Fatura PDF'si müşterinin Hesabım → Faturalarım alanına kaydedilir.
                                    Müşteriye tarih ve toplam tutar içeren bildirim oluşturulur.
                                  </p>
                                </div>
                                {invoice ? <a className="rounded-lg border px-3 py-2 text-sm font-semibold"
                                  href={`/api/admin/orders/${encodeURIComponent(selectedId)}/invoice/file`} target="_blank" rel="noreferrer">
                                  <FileDown className="mr-1 inline h-4 w-4" /> Mevcut faturayı aç
                                </a> : null}
                              </div>
                              {invoice ? <div className="mt-2 text-sm text-emerald-700">
                                Kayıtlı fatura: {invoice.invoice_number} · {money(Number(invoice.total_amount||0))}
                              </div> : null}
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <Input className="max-w-xs" placeholder="Fatura numarası"
                                  value={invoiceNumber || invoice?.invoice_number || ""}
                                  onChange={(e) => setInvoiceNumber(e.target.value)}
                                  maxLength={100} />
                                <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">
                                  <input type="file" accept="application/pdf,.pdf" className="hidden"
                                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
                                  {invoiceFile ? invoiceFile.name : "PDF Dosyası Seç"}
                                </label>
                                <Button disabled={invoiceUploading || !invoiceFile}
                                  onClick={() => void uploadInvoice(String(order.id))}>
                                  {invoiceUploading ? "Fatura yükleniyor…" : invoice ? "Faturayı Güncelle" : "Fatura PDF Yükle"}
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <InfoCard
                                icon={<CreditCard className="h-4 w-4" />}
                                label="Ödeme"
                                value={money(Number(current.total_amount || 0))}
                                detail={
                                  current.payment_method === "card"
                                    ? `${current.card_association || "Kart"}${current.card_last4 ? ` · •••• ${current.card_last4}` : ""}`
                                    : "Havale / EFT"
                                }
                              />
                              <InfoCard
                                icon={<PackageSearch className="h-4 w-4" />}
                                label="Toplam ürün"
                                value={`${Number(current.item_count || 0)} adet`}
                                detail={`${Array.isArray(current.items) ? current.items.length : 0} ürün çeşidi`}
                              />
                              <InfoCard
                                icon={<MapPin className="h-4 w-4" />}
                                label="Teslimat"
                                value={current.shipping_address?.city || "—"}
                                detail={current.shipping_address?.district || current.shipping_method || "—"}
                              />
                              <InfoCard
                                icon={<Route className="h-4 w-4" />}
                                label="Durum"
                                value={statusLabel(current.status)}
                                detail={current.payment_status || "—"}
                              />
                            </div>

                            <div className="overflow-hidden rounded-xl border bg-background">
                              <div className="border-b px-4 py-3 font-bold">Sipariş İçeriği</div>
                              <div className="divide-y">
                                {(Array.isArray(current.items) ? current.items : []).map(
                                  (item: any, index: number) => (
                                    <div
                                      key={item.productId || index}
                                      className="grid gap-3 p-4 sm:grid-cols-[76px_minmax(0,1fr)_160px] sm:items-center"
                                    >
                                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-white">
                                        {item.image ? (
                                          <img
                                            src={item.image}
                                            alt={item.name || "Ürün"}
                                            className="h-full w-full object-contain p-1"
                                          />
                                        ) : (
                                          <PackageSearch className="h-7 w-7 text-muted-foreground/40" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-bold">{item.name || "Ürün"}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          SKU: {item.sku || "—"}
                                        </div>
                                        <div className="mt-2 text-sm">
                                          <b>{Number(item.quantity || 0)} koli</b>
                                          <span className="text-muted-foreground">
                                            {" "}· Koli içi {Number(item.unitsPerBox || 0)} adet · Toplam{" "}
                                            {Number(item.totalUnits || 0)} adet
                                          </span>
                                        </div>
                                      </div>
                                      <div className="sm:text-right">
                                        <div className="text-xs text-muted-foreground">Toplam</div>
                                        <div className="font-bold">{money(Number(item.total || 0))}</div>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <AddressCard title="Fatura Adresi" value={current.billing_details} billing />
                              <AddressCard title="Teslimat Adresi" value={current.shipping_address} />
                            </div>

                            <div className="rounded-xl border bg-background p-4">
                              <div className="flex items-center gap-2 font-bold">
                                <Route className="h-4 w-4" />
                                Ödeme Sayfasına Geliş Akışı
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {(Array.isArray(current.checkout_trace?.stages)
                                  ? current.checkout_trace.stages
                                  : ["B2B mağaza", "Ödeme sayfası", "iyzico"]
                                ).map((stage: string, index: number, list: string[]) => (
                                  <div key={`${stage}-${index}`} className="flex items-center gap-2">
                                    <span className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-semibold">
                                      {stage}
                                    </span>
                                    {index < list.length - 1 ? (
                                      <span className="text-muted-foreground">→</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                                {current.checkout_trace?.previousPath ? (
                                  <div>Önceki sayfa: {current.checkout_trace.previousPath}</div>
                                ) : null}
                                {current.checkout_trace?.entryPath ? (
                                  <div>Ödeme yolu: {current.checkout_trace.entryPath}</div>
                                ) : null}
                                <div>
                                  Kaynak: {current.checkout_trace?.cartMode ? "Sipariş listesi / sepet" : "Ürün detayı"}
                                  {current.checkout_trace?.productId ? ` · Ürün ID: ${current.checkout_trace.productId}` : ""}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function AddressCard({
  title,
  value,
  billing = false,
}: {
  title: string;
  value: any;
  billing?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="font-bold">{title}</div>
      {billing ? (
        <div className="mt-2 text-sm font-semibold">{value?.companyName || "—"}</div>
      ) : (
        <div className="mt-2 text-sm font-semibold">{value?.recipient || "—"}</div>
      )}
      <div className="mt-1 text-xs leading-5 text-muted-foreground">
        {billing ? (
          <>
            VKN: {value?.taxNumber || "—"} · {value?.taxOffice || "Vergi dairesi yok"}
            <br />
          </>
        ) : null}
        {addressText(value)}
        {value?.phone ? (
          <>
            <br />
            {value.phone}
          </>
        ) : null}
      </div>
    </div>
  );
}

function printA5Order(order: any, logo: string) {
  const popup = window.open("", "_blank", "width=900,height=1100");
  if (!popup) return;

  const items = Array.isArray(order.items) ? order.items : [];
  const billing = order.billing_details || {};
  const shipping = order.shipping_address || {};
  const itemRows = items
    .map(
      (item: any) => `
        <tr>
          <td>
            <strong>${escapeHtml(String(item.name || "Ürün"))}</strong>
            <div class="muted">${escapeHtml(String(item.sku || ""))}</div>
          </td>
          <td>${Number(item.quantity || 0)} koli</td>
          <td>${Number(item.unitsPerBox || 0)} adet</td>
          <td>${Number(item.totalUnits || 0)} adet</td>
        </tr>`,
    )
    .join("");

  popup.document.write(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(String(order.order_number || "Sipariş"))}</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10.5pt; }
  header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:12px; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; object-position:left; }
  h1 { margin:0; font-size:16pt; }
  .muted { color:#667085; font-size:8.5pt; margin-top:2px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
  .box { border:1px solid #d0d5dd; border-radius:6px; padding:7px; }
  .box b { display:block; margin-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th, td { border-bottom:1px solid #d0d5dd; padding:6px 4px; text-align:left; vertical-align:top; }
  th { font-size:8pt; color:#667085; }
  .total { text-align:right; font-size:13pt; font-weight:700; margin-top:10px; }
  .footer { margin-top:14px; border-top:1px solid #d0d5dd; padding-top:6px; color:#667085; font-size:8pt; }
</style>
</head>
<body>
<header>
  <div>
    ${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Çalışkan B2B" />` : `<strong>ÇALIŞKAN B2B</strong>`}
  </div>
  <div style="text-align:right">
    <h1>Sipariş</h1>
    <div>${escapeHtml(String(order.order_number || "—"))}</div>
    <div class="muted">${order.created_at ? new Date(order.created_at).toLocaleString("tr-TR") : ""}</div>
  </div>
</header>

<div class="grid">
  <div class="box">
    <b>Fatura Adresi</b>
    <strong>${escapeHtml(String(billing.companyName || "—"))}</strong>
    <div>VKN: ${escapeHtml(String(billing.taxNumber || "—"))}</div>
    <div>${escapeHtml(addressText(billing))}</div>
  </div>
  <div class="box">
    <b>Teslimat Adresi</b>
    <strong>${escapeHtml(String(shipping.recipient || "—"))}</strong>
    <div>${escapeHtml(addressText(shipping))}</div>
    <div>${escapeHtml(String(shipping.phone || ""))}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Ürün</th>
      <th>Koli</th>
      <th>Koli içi</th>
      <th>Toplam adet</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="total">Toplam: ${escapeHtml(money(Number(order.total_amount || 0)))}</div>
<div class="footer">Kargo hazırlık çıktısı · Çalışkan B2B</div>
<script>window.onload=()=>setTimeout(()=>window.print(),250);</script>
</body>
</html>`);
  popup.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] || char));
}
