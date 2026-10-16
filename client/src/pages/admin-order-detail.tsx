import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, CreditCard, FileDown, MapPin, PackageSearch, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/hooks/use-branding";

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 404 ? "Sipariş bulunamadı" : "Sipariş detayı alınamadı");
  return response.json();
}
function money(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}
function statusLabel(value?: string | null) {
  const labels: Record<string,string> = { paid:"Ödendi",paid_stock_review:"Ödendi · stok kontrolü",
    payment_pending:"Ödeme bekliyor",awaiting_bank_transfer:"Havale bekleniyor",
    awaiting_bank_confirmation:"Havale kontrol ediliyor",cancel_requested:"İptal talebi",
    completed:"Tamamlandı",cancelled:"İptal edildi" };
  return labels[String(value || "")] || value || "Bekliyor";
}
function paymentStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pending: "Havale bekleniyor",
    customer_reported_paid: "Müşteri ödemeyi bildirdi · kontrol bekliyor",
    bank_confirmed: "Ödeme onaylandı",
    SUCCESS: "Ödeme alındı",
    FAILURE: "Ödeme başarısız",
  };
  return labels[String(value || "")] || "Kontrol bekleniyor";
}
function addressText(value: any) {
  if (!value || typeof value !== "object") return "—";
  return [value.addressLine, value.district, value.city, value.postalCode].filter(Boolean).join(", ") || "—";
}
type DeliveryOrder = { shipping_method?: string | null; shipping_details?: Record<string, unknown> | null; shipping_address?: Record<string, unknown> | null };
const readText = (value: unknown) => typeof value === "string" ? value.trim() : "";
function deliveryName(method?: string | null) {
  switch (method) {
    case "cargo": return "PTT Kargo / Kargo";
    case "freight": return "Ambar / Nakliye";
    case "pickup": return "Mağazadan Teslim";
    default: return "Teslimat türü belirtilmemiş";
  }
}
function deliverySummary(order: DeliveryOrder) {
  const details = order.shipping_details || {};
  const address = order.shipping_address || {};
  switch (order.shipping_method) {
    case "cargo": return readText(details.carrier) || readText(address.carrier) || "PTT Kargo";
    case "freight": return readText(details.companyName) || readText(address.freightCompany) || "Ambar bilgisi belirtilmemiş";
    case "pickup": return readText(details.pickupTime) || readText(address.pickupTime) || "Teslim alma saati belirtilmemiş";
    default: return "Siparişte teslimat türü kaydedilmemiş";
  }
}
function DeliveryDetails({ order }: { order: DeliveryOrder }) {
  const details = order.shipping_details || {};
  const address = order.shipping_address || {};
  const rows: Array<[string, string]> = [];
  if (order.shipping_method === "cargo") {
    rows.push(["Taşıyıcı", deliverySummary(order)]);
  } else if (order.shipping_method === "freight") {
    rows.push(["Ambar firması", readText(details.companyName) || readText(address.freightCompany) || "Belirtilmemiş"]);
    rows.push(["Ambar telefonu", readText(details.phone) || readText(address.freightPhone) || "Belirtilmemiş"]);
  } else if (order.shipping_method === "pickup") {
    rows.push(["Teslim alma saati", deliverySummary(order)]);
    rows.push(["Teslim alma noktası", readText(details.address) || readText(address.addressLine) || "Belirtilmemiş"]);
  }
  return <div className="rounded-xl border bg-background p-4">
    <div className="mb-3 flex items-center gap-2 font-bold"><Route className="h-4 w-4" /> Teslimat Bilgileri</div>
    <div className="mb-3 text-base font-bold">{deliveryName(order.shipping_method)}</div>
    {rows.length ? <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label,value]) => <div key={label} className="rounded-lg bg-muted/30 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Teslimat türü bilinmiyor. Yanlış bir tür gösterilmedi.</p>}
  </div>;
}

export default function AdminOrderDetail() {
  const [, params] = useRoute("/siparisler/:id");
  const selectedId = params?.id || "";
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [bankStatementChecked, setBankStatementChecked] = useState(false);
  const [bankApprovalBusy, setBankApprovalBusy] = useState(false);
  const { toast } = useToast();
  const { data: branding } = useBranding();
  const { data: current, isLoading: detailLoading, isError, error, refetch } = useQuery<any>({
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
  useEffect(() => { setInvoiceNumber(""); setInvoiceFile(null); }, [selectedId]);
  useEffect(() => { setBankStatementChecked(false); }, [selectedId]);
  async function approveBankPayment() {
    if (!current || !bankStatementChecked || bankApprovalBusy) return;
    setBankApprovalBusy(true);
    try {
      const response = await apiRequest(
        "POST", `/api/admin/orders/${encodeURIComponent(selectedId)}/approve-bank-payment`,
        { bankStatementChecked: true },
      );
      const result = await response.json();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/detail", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] }),
      ]);
      setBankStatementChecked(false);
      toast({
        title: "Havale ödemesi onaylandı",
        description: result.notificationRecorded
          ? "Müşteriye otomatik bildirim kaydedildi ve mobil gönderim denendi."
          : "Ödeme onaylandı. Bildirim daha önce kaydedilmiş olabilir veya gönderim kontrolü gerekebilir.",
      });
    } catch (error) {
      toast({
        title: "Ödeme onayı başarısız",
        description: error instanceof Error ? error.message : "İşlem tamamlanamadı",
        variant: "destructive",
      });
    } finally {
      setBankApprovalBusy(false);
    }
  }

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

  const order = { id: selectedId };
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-6xl space-y-5 p-5 sm:p-8">
      <Link href="/siparisler" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4"/> Siparişlere dön
      </Link>
      {detailLoading ? <div className="rounded-xl border bg-background p-8 text-sm">Sipariş detayı yükleniyor…</div>
      : isError || !current ? <div className="rounded-xl border bg-background p-8">
        <p className="font-semibold">{error instanceof Error ? error.message : "Sipariş bulunamadı"}</p>
        <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Tekrar dene</Button>
      </div>
      : <div className="space-y-5">
        {current.payment_method === "bank_transfer" ? (
          <section className="rounded-2xl border bg-background p-5">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <h3 className="text-lg font-bold">Havale / EFT Ödeme Kontrolü</h3>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground">Ödenecek tutar</p>
                <p className="font-bold">{money(Number(current.total_amount || 0))}</p></div>
              <div><p className="text-muted-foreground">Banka açıklama kodu</p>
                <p className="font-bold">{current.transfer_code || "Belirtilmemiş"}</p></div>
              <div><p className="text-muted-foreground">Ödeme durumu</p>
                <p className="font-bold">{paymentStatusLabel(current.payment_status)}</p></div>
            </div>
            {current.status === "awaiting_bank_confirmation" && current.payment_status === "customer_reported_paid" ? (
              <div className="mt-4 space-y-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Müşteri havale yaptığını bildirdi. Banka hareketlerinde tutarı ve
                  CLK açıklama kodunu doğruladıktan sonra ödeme onayı verin.
                </p>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4"
                    checked={bankStatementChecked}
                    onChange={e => setBankStatementChecked(e.target.checked)} />
                  <span>Banka hesabına gelen tutarı ve açıklama kodunu kontrol ettim; tahsilatı doğruluyorum.</span>
                </label>
                <Button onClick={() => void approveBankPayment()}
                  disabled={!bankStatementChecked || bankApprovalBusy}>
                  {bankApprovalBusy ? "Onaylanıyor…" : "Ödeme Onaylandı"}
                </Button>
              </div>
            ) : current.status === "paid" && current.payment_status === "bank_confirmed" ? (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm font-semibold">
                Ödeme yönetici tarafından onaylandı. Müşterinin bildirim merkezine otomatik bildirim gönderildi veya gönderim denendi.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Ödeme onayı için müşterinin havale bildirimi bekleniyor.
              </p>
            )}
          </section>
        ) : null}
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
                                label="Teslimat türü"
                                value={deliveryName(current.shipping_method)}
                                detail={deliverySummary(current)}
                              />
                              <InfoCard
                                icon={<Route className="h-4 w-4" />}
                                label="Durum"
                                value={statusLabel(current.status)}
                                detail={paymentStatusLabel(current.payment_status)}
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

                            <DeliveryDetails order={current} />
                            <div className="grid gap-4 lg:grid-cols-2">
                              <AddressCard title="Fatura Adresi" value={current.billing_details} billing />
                              <AddressCard title={current.shipping_method === "pickup" ? "Mağazadan Teslim Alınacak Yer" : "Teslimat Adresi"} value={current.shipping_address} />
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
      </div>}
    </div>
  </div>;
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
  const delivery = deliveryName(order.shipping_method);
  const deliveryInfo = deliverySummary(order);
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
    <b>Teslimat: ${escapeHtml(delivery)}</b>
    <div>${escapeHtml(deliveryInfo)}</div>
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
<div class="footer">Sipariş hazırlık çıktısı · Çalışkan B2B</div>
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

