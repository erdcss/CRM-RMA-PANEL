import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Landmark,
  LockKeyhole,
  Package,
  ShieldCheck,
} from "lucide-react";

import { B2BHeader } from "@/components/b2b-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clearB2BCart, getB2BCart } from "@/lib/b2b-cart";

type CheckoutProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minOrderQty: number;
  unitsPerBox: number;
  maxBoxQty: number;
};

type CheckoutLine = {
  product: CheckoutProduct;
  quantity: number;
  totalUnits: number;
  total: number;
};

type CheckoutPreview = {
  items: CheckoutLine[];
  itemCount: number;
  boxCount?: number;
  total: number;
  currency: "TRY";
  iyzicoConfigured: boolean;
};

type Address = {
  id: number;
  title: string;
  recipient: string | null;
  phone: string | null;
  city: string | null;
  district: string | null;
  address_line: string;
  postal_code: string | null;
  is_default: boolean;
};

type PaymentSettings = {
  iyzicoConfigured: boolean;
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    window.location.assign("/uye-girisi");
    throw new Error("Oturum gerekli");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as any)?.error || "Veri alınamadı");
  }
  return payload as T;
}

async function loadCheckoutPreview(
  cartMode: boolean,
  productId: string,
  qty: number,
): Promise<CheckoutPreview> {
  if (cartMode) {
    const cart = getB2BCart();
    if (!cart.length) throw new Error("Sipariş listeniz boş");

    const response = await apiRequest("POST", "/api/b2b/checkout/preview", {
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
    return response.json();
  }

  const single = await getJson<{
    product: CheckoutProduct;
    quantity: number;
    totalUnits: number;
    total: number;
    currency: "TRY";
    iyzicoConfigured: boolean;
  }>(
    `/api/b2b/checkout/preview?productId=${encodeURIComponent(productId)}&qty=${qty}`,
  );

  return {
    items: [
      {
        product: single.product,
        quantity: single.quantity,
        totalUnits: single.totalUnits,
        total: single.total,
      },
    ],
    itemCount: single.totalUnits,
    boxCount: single.quantity,
    total: single.total,
    currency: single.currency,
    iyzicoConfigured: single.iyzicoConfigured,
  };
}

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

function formatIban(value: string) {
  return value.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export default function B2BPaymentPage() {
  const { toast } = useToast();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const productId = params.get("productId") || "";
  const qty = Math.max(1, Number.parseInt(params.get("qty") || "1", 10) || 1);
  const result = params.get("result");
  const resultOrder = params.get("order") || "";
  const cartMode = params.get("cart") === "1";

  const [method, setMethod] = useState<"card" | "bank_transfer">("card");
  const [identityNumber, setIdentityNumber] = useState("");
  const [addressId, setAddressId] = useState("");
  const [busy, setBusy] = useState(false);
  const [eftOrder, setEftOrder] = useState<{
    orderNumber: string;
    total: number;
    transferDescription: string;
    bankTransfer: PaymentSettings["bankTransfer"];
  } | null>(null);

  useEffect(() => {
    if (result === "success" && cartMode) clearB2BCart();
  }, [result, cartMode]);

  const { data: settings } = useQuery<PaymentSettings>({
    queryKey: ["/api/public/payment-settings"],
    queryFn: () => getJson("/api/public/payment-settings"),
    staleTime: 10_000,
  });

  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ["/api/b2b/addresses"],
    queryFn: () => getJson("/api/b2b/addresses"),
    enabled: !result,
  });

  const { data: preview, isLoading, error } = useQuery<CheckoutPreview>({
    queryKey: ["/api/b2b/checkout/preview", cartMode ? "cart" : productId, qty],
    queryFn: () => loadCheckoutPreview(cartMode, productId, qty),
    enabled: !result && (cartMode || Boolean(productId)),
    retry: false,
  });

  const selectedAddressId =
    addressId ||
    String(addresses.find((item) => item.is_default)?.id || addresses[0]?.id || "");

  function orderPayload() {
    if (!preview) return {};
    if (cartMode) {
      return {
        items: preview.items.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      };
    }
    const line = preview.items[0];
    return {
      productId: line.product.id,
      quantity: line.quantity,
    };
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Kopyalandı", description: label });
    } catch {
      toast({ title: "Kopyalanamadı", variant: "destructive" });
    }
  }

  async function startCardPayment() {
    if (!preview) return;
    if (!selectedAddressId) {
      toast({
        title: "Teslimat adresi gerekli",
        description: "Hesabım bölümünden bir teslimat adresi ekleyin.",
        variant: "destructive",
      });
      return;
    }

    const identity = identityNumber.replace(/\D/g, "");
    if (!/^\d{11}$/.test(identity)) {
      toast({
        title: "T.C. kimlik numarası gerekli",
        description: "iyzico ödeme işlemi için 11 haneli T.C. kimlik numarasını girin.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/iyzico/initialize", {
        ...orderPayload(),
        addressId: selectedAddressId,
        identityNumber: identity,
      });
      const payload = await response.json() as { paymentPageUrl?: string };
      if (!payload.paymentPageUrl) throw new Error("iyzico ödeme sayfası oluşturulamadı");
      window.location.assign(payload.paymentPageUrl);
    } catch (error) {
      toast({
        title: "Kartlı ödeme başlatılamadı",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function createBankTransferOrder() {
    if (!preview) return;
    if (!selectedAddressId) {
      toast({
        title: "Teslimat adresi gerekli",
        description: "Hesabım bölümünden bir teslimat adresi ekleyin.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/bank-transfer", {
        ...orderPayload(),
        addressId: selectedAddressId,
      });
      const payload = await response.json();
      setEftOrder(payload);
      if (cartMode) clearB2BCart();
      toast({
        title: "Havale/EFT siparişi oluşturuldu",
        description: "Açıklama alanına sipariş numarasını yazarak transferi tamamlayın.",
      });
    } catch (error) {
      toast({
        title: "Havale/EFT siparişi oluşturulamadı",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const success = result === "success";
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
        <B2BHeader />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
              success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}>
              {success ? <CheckCircle2 className="h-7 w-7" /> : <CreditCard className="h-7 w-7" />}
            </div>
            <h1 className="mt-4 text-2xl font-black">
              {success ? "Ödeme başarıyla tamamlandı" : "Ödeme tamamlanamadı"}
            </h1>
            {resultOrder ? (
              <p className="mt-2 text-sm text-slate-500">Sipariş No: <b>{resultOrder}</b></p>
            ) : null}
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild><Link href="/siparislerim">Siparişler</Link></Button>
              <Button asChild variant="outline"><Link href="/">Mağazaya dön</Link></Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const backHref = cartMode
    ? "/siparislerim"
    : productId
      ? `/urun/${productId}`
      : "/";

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader />

      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-7">
        <Link href={backHref} className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {cartMode ? "Siparişlere dön" : "Ürüne dön"}
        </Link>

        <div className="mb-5">
          <h1 className="text-2xl font-black">Ödeme</h1>
          <p className="mt-1 text-sm text-slate-500">Ödeme yönteminizi seçin ve siparişinizi güvenli şekilde tamamlayın.</p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Ödeme özeti hazırlanıyor…</div>
        ) : error || !preview ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <Package className="mx-auto h-9 w-9 text-slate-300" />
            <div className="mt-3 font-bold">Ödeme özeti hazırlanamadı</div>
            <div className="mt-1 text-sm text-slate-500">{error instanceof Error ? error.message : "Sipariş bilgisi eksik."}</div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-bold">Teslimat adresi</h2>
                {addresses.length ? (
                  <select
                    value={selectedAddressId}
                    onChange={(event) => setAddressId(event.target.value)}
                    className="mt-3 h-11 w-full rounded-md border bg-white px-3 text-sm"
                  >
                    {addresses.map((address) => (
                      <option key={address.id} value={String(address.id)}>
                        {address.title} — {address.city || "Şehir belirtilmemiş"} / {address.address_line}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed p-4 text-sm text-slate-600">
                    Kayıtlı teslimat adresiniz yok. <Link href="/hesabim" className="font-semibold underline">Hesabım</Link> bölümünden adres ekleyin.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-bold">Ödeme yöntemi</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMethod("card")}
                    className={`rounded-xl border p-4 text-left transition ${
                      method === "card" ? "border-slate-950 bg-slate-950 text-white" : "hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    <div className="mt-3 font-bold">Kredi / Banka Kartı</div>
                    <div className={`mt-1 text-xs ${method === "card" ? "text-slate-300" : "text-slate-500"}`}>
                      Güvenli iyzico ödeme sayfası
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("bank_transfer")}
                    className={`rounded-xl border p-4 text-left transition ${
                      method === "bank_transfer" ? "border-slate-950 bg-slate-950 text-white" : "hover:border-slate-400"
                    }`}
                  >
                    <Landmark className="h-5 w-5" />
                    <div className="mt-3 font-bold">Havale / EFT</div>
                    <div className={`mt-1 text-xs ${method === "bank_transfer" ? "text-slate-300" : "text-slate-500"}`}>
                      IBAN ile banka transferi
                    </div>
                  </button>
                </div>
              </div>

              {method === "card" ? (
                <div className="rounded-2xl border bg-white p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="font-bold">iyzico ile güvenli ödeme</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Kart numaranızı Çalışkan B2B sayfasına girmiyorsunuz. Devam ettiğinizde iyzico'nun güvenli ödeme ekranına yönlendirilirsiniz.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 max-w-md space-y-2">
                    <Label>T.C. Kimlik Numarası</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={11}
                      value={identityNumber}
                      onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="11 haneli T.C. kimlik numarası"
                    />
                  </div>

                  {!settings?.iyzicoConfigured ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      iyzico canlı API anahtarları henüz sunucuya eklenmediği için kartla ödeme geçici olarak kapalı.
                    </div>
                  ) : null}

                  <Button
                    className="mt-5"
                    onClick={startCardPayment}
                    disabled={busy || !settings?.iyzicoConfigured || !addresses.length}
                  >
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    {busy ? "iyzico açılıyor…" : `${formatMoney(preview.total)} Kart ile Öde`}
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-bold">Havale / EFT bilgileri</h3>
                  {settings?.bankTransfer.enabled ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <BankLine label="Banka" value={settings.bankTransfer.bankName} />
                        <BankLine label="Hesap Sahibi" value={settings.bankTransfer.accountHolder} />
                      </div>
                      <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">IBAN</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <code className="break-all text-sm font-bold">{formatIban(settings.bankTransfer.iban)}</code>
                          <Button type="button" variant="outline" size="sm" onClick={() => copy(settings.bankTransfer.iban, "IBAN panoya kopyalandı")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {eftOrder ? (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                          <div className="font-bold">Sipariş oluşturuldu</div>
                          <div className="mt-2">Sipariş No: <b>{eftOrder.orderNumber}</b></div>
                          <div className="mt-1">Gönderilecek tutar: <b>{formatMoney(eftOrder.total)}</b></div>
                          <div className="mt-3">Transfer açıklamasına aşağıdaki sipariş numarasını yazın:</div>
                          <div className="mt-2 flex items-center justify-between rounded-lg bg-white p-3">
                            <code className="font-bold">{eftOrder.transferDescription}</code>
                            <Button type="button" variant="outline" size="sm" onClick={() => copy(eftOrder.transferDescription, "Sipariş numarası kopyalandı")}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button asChild className="mt-4"><Link href="/siparislerim">Siparişlerime Git</Link></Button>
                        </div>
                      ) : (
                        <Button className="mt-5" onClick={createBankTransferOrder} disabled={busy || !addresses.length}>
                          <Landmark className="mr-2 h-4 w-4" />
                          {busy ? "Sipariş oluşturuluyor…" : "Havale/EFT Siparişi Oluştur"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Havale/EFT hesap bilgileri henüz yönetici tarafından tanımlanmadı.
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-2xl border bg-white p-5 lg:sticky lg:top-20">
              <h2 className="font-bold">Sipariş Özeti</h2>
              <div className="mt-4 divide-y rounded-xl border">
                {preview.items.map((line) => (
                  <div key={line.product.id} className="p-3">
                    <div className="text-sm font-semibold">{line.product.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {line.quantity} koli × {line.product.unitsPerBox} adet = {line.totalUnits} adet
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Birim fiyat {formatMoney(line.product.price)}
                    </div>
                    <div className="mt-1 text-sm font-bold">{formatMoney(line.total)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="font-semibold">Toplam</span>
                <span className="text-xl font-black">{formatMoney(preview.total)}</span>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Fiyat ve stok bilgileri sunucu tarafında yeniden doğrulanır.
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function BankLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
