import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

type AddressForm = {
  title: string;
  recipient: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
  postalCode: string;
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

type BillingAccount = {
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
};

type InstallmentOption = {
  installmentNumber: number;
  installmentPrice: number;
  totalPrice: number;
  commissionRate: number;
};

type InstallmentLookup = {
  binNumber: string;
  price: number;
  bankName: string;
  bankCode: number | null;
  cardType: string;
  cardAssociation: string;
  cardFamilyName: string;
  commercial: number;
  force3ds: number;
  options: InstallmentOption[];
};

const EMPTY_ADDRESS: AddressForm = {
  title: "Teslimat Adresi",
  recipient: "",
  phone: "",
  city: "",
  district: "",
  addressLine: "",
  postalCode: "",
};


async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    window.location.assign("/uye-girisi");
    throw new Error("Oturum gerekli");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as any)?.error || "Veri alınamadı");
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
    items: [{
      product: single.product,
      quantity: single.quantity,
      totalUnits: single.totalUnits,
      total: single.total,
    }],
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

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.match(/.{1,4}/g)?.join(" ") || "";
}

function isValidCardNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 15 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function decodeBase64Html(value: string) {
  try {
    const binary = window.atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function openThreeDSInTopWindow(value: string) {
  const html = decodeBase64Html(value);
  if (!html.trim()) {
    throw new Error("3D Secure doğrulama içeriği çözümlenemedi");
  }

  // 3DS banka doğrulaması iframe içinde bazı bankalarda başarısız olabiliyor.
  // iyzico'nun döndürdüğü HTML'i ana tarayıcı penceresinde çalıştırarak
  // banka/ACS sayfasının top-level context'te açılmasını sağlıyoruz.
  document.open();
  document.write(html);
  document.close();
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
  const [addressId, setAddressId] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);

  const [shippingMethod, setShippingMethod] = useState<"cargo" | "freight" | "pickup">("cargo");
  const [freightCompany, setFreightCompany] = useState("");
  const [freightPhone, setFreightPhone] = useState("");
  const [pickupTime, setPickupTime] = useState<"" | "09:00" | "15:00" | "17:00">("");

  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expireMonth, setExpireMonth] = useState("");
  const [expireYear, setExpireYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [installment, setInstallment] = useState<number>(1);
  const [threeDSHtml, setThreeDSHtml] = useState("");

  const [busy, setBusy] = useState(false);
  const [eftOrder, setEftOrder] = useState<{
    orderNumber: string;
    total: number;
    transferDescription: string;
    bankTransfer: PaymentSettings["bankTransfer"];
  } | null>(null);

  const { data: settings } = useQuery<PaymentSettings>({
    queryKey: ["/api/public/payment-settings"],
    queryFn: () => getJson("/api/public/payment-settings"),
    staleTime: 10_000,
  });

  const { data: billingAccount } = useQuery<BillingAccount>({
    queryKey: ["/api/b2b/account"],
    queryFn: () => getJson("/api/b2b/account"),
    enabled: !result,
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

  const cleanCardNumber = cardNumber.replace(/\D/g, "");
  const cardBin = cleanCardNumber.slice(0, 8);

  const {
    data: installmentData,
    isFetching: installmentsLoading,
    error: installmentError,
  } = useQuery<InstallmentLookup>({
    queryKey: [
      "/api/b2b/payments/iyzico/installments",
      cardBin,
      cartMode ? "cart" : productId,
      qty,
      preview?.total,
    ],
    queryFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/b2b/payments/iyzico/installments",
        {
          ...orderPayload(),
          binNumber: cardBin,
        },
      );
      return response.json();
    },
    enabled: Boolean(
      preview &&
        settings?.iyzicoConfigured &&
        method === "card" &&
        cardBin.length === 8,
    ),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (cardBin.length !== 8) {
      if (installment !== 1) setInstallment(1);
      return;
    }

    const options = installmentData?.options || [];
    if (
      options.length > 0 &&
      !options.some((option) => option.installmentNumber === installment)
    ) {
      setInstallment(options[0].installmentNumber);
    }
  }, [cardBin, installment, installmentData]);

  const selectedInstallment = installmentData?.options?.find(
    (option) => option.installmentNumber === installment,
  );
  const payableTotal = selectedInstallment?.totalPrice ?? preview?.total ?? 0;

  useEffect(() => {
    const completeFromUrl = (rawUrl: string) => {
      try {
        const url = new URL(rawUrl, window.location.origin);
        if (url.origin !== window.location.origin || url.pathname !== "/odeme") return;
        const paymentResult = url.searchParams.get("result");
        if (paymentResult !== "success" && paymentResult !== "failed") return;

        if (paymentResult === "success" && url.searchParams.get("cart") === "1") {
          clearB2BCart();
        }
        window.location.replace(url.toString());
      } catch {
        // Ignore malformed/cross-origin callback payloads.
      }
    };

    const onPaymentMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as { type?: string; url?: string } | null;
      if (
        !payload ||
        payload.type !== "caliskan-b2b-payment-result" ||
        typeof payload.url !== "string"
      ) {
        return;
      }
      completeFromUrl(payload.url);
    };

    window.addEventListener("message", onPaymentMessage);
    return () => window.removeEventListener("message", onPaymentMessage);
  }, []);

  useEffect(() => {
    if (result === "success" && cartMode) {
      clearB2BCart();
    }
  }, [cartMode, result]);

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
    return { productId: line.product.id, quantity: line.quantity };
  }

  function shippingPayload() {
    if (shippingMethod === "freight") {
      if (!freightCompany.trim() || freightPhone.replace(/\D/g, "").length < 7) {
        toast({
          title: "Ambar bilgileri eksik",
          description: "Ambar firma adı ve telefon numarasını girin.",
          variant: "destructive",
        });
        return null;
      }
      return {
        method: "freight",
        companyName: freightCompany.trim(),
        phone: freightPhone.trim(),
      };
    }

    if (shippingMethod === "pickup") {
      if (!pickupTime) {
        toast({
          title: "Teslim saati seçin",
          description: "09:00, 15:00 veya 17:00 saatlerinden birini seçin.",
          variant: "destructive",
        });
        return null;
      }
      return { method: "pickup", pickupTime };
    }

    return { method: "cargo" };
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const url = editingAddressId
        ? `/api/b2b/addresses/${editingAddressId}`
        : "/api/b2b/addresses";
      const response = await apiRequest(
        editingAddressId ? "PATCH" : "POST",
        url,
        addressForm,
      );
      const saved = await response.json() as Address;
      await queryClient.invalidateQueries({ queryKey: ["/api/b2b/addresses"] });
      setAddressId(String(saved.id));
      setAddressOpen(false);
      setEditingAddressId(null);
      setAddressForm(EMPTY_ADDRESS);
      toast({ title: editingAddressId ? "Adres güncellendi" : "Adres kaydedildi" });
    } catch (err) {
      toast({
        title: "Adres kaydedilemedi",
        description: err instanceof Error ? err.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function editAddress(address: Address) {
    setEditingAddressId(address.id);
    setAddressForm({
      title: address.title || "Teslimat Adresi",
      recipient: address.recipient || "",
      phone: address.phone || "",
      city: address.city || "",
      district: address.district || "",
      addressLine: address.address_line || "",
      postalCode: address.postal_code || "",
    });
    setAddressOpen(true);
  }

  async function deleteAddress(address: Address) {
    if (!window.confirm(`"${address.title}" adresi silinsin mi?`)) return;
    try {
      await apiRequest("DELETE", `/api/b2b/addresses/${address.id}`);
      if (String(address.id) === selectedAddressId) setAddressId("");
      await queryClient.invalidateQueries({ queryKey: ["/api/b2b/addresses"] });
      toast({ title: "Adres silindi" });
    } catch (err) {
      toast({
        title: "Adres silinemedi",
        description: err instanceof Error ? err.message : "Bir hata oluştu",
        variant: "destructive",
      });
    }
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
    if (!preview || !selectedAddressId) {
      toast({ title: "Teslimat adresi seçin", variant: "destructive" });
      return;
    }
    const shipping = shippingPayload();
    if (!shipping) return;

    const cleanCard = cardNumber.replace(/\D/g, "");
    if (cardHolderName.trim().length < 2) {
      toast({ title: "Kart üzerindeki isim soyismi kontrol edin", variant: "destructive" });
      return;
    }
    if (!isValidCardNumber(cleanCard)) {
      toast({
        title: "Kart numarasını kontrol edin",
        description: "Kart numarası eksik veya geçersiz görünüyor.",
        variant: "destructive",
      });
      return;
    }
    if (!/^(0[1-9]|1[0-2])$/.test(expireMonth) || !/^\d{2,4}$/.test(expireYear)) {
      toast({ title: "Son kullanım tarihini kontrol edin", variant: "destructive" });
      return;
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      toast({ title: "CVV bilgisini kontrol edin", variant: "destructive" });
      return;
    }
    if (!selectedInstallment) {
      toast({
        title: "Taksit seçeneği doğrulanamadı",
        description: "Kartınıza ait güncel iyzico taksit seçeneklerinin yüklenmesini bekleyin.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/iyzico/3ds/initialize", {
        ...orderPayload(),
        addressId: selectedAddressId,
        shipping,
        installment,
        card: {
          cardHolderName: cardHolderName.trim(),
          cardNumber: cleanCard,
          expireMonth,
          expireYear,
          cvc,
        },
      });
      const payload = await response.json() as { threeDSHtmlContent?: string };
      if (!payload.threeDSHtmlContent) throw new Error("3D Secure ekranı oluşturulamadı");

      setCardNumber("");
      setCvc("");
      openThreeDSInTopWindow(payload.threeDSHtmlContent);
      return;
    } catch (err) {
      toast({
        title: "Kartlı ödeme başlatılamadı",
        description: err instanceof Error ? err.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function createBankTransferOrder() {
    if (!preview || !selectedAddressId) {
      toast({ title: "Teslimat adresi seçin", variant: "destructive" });
      return;
    }
    const shipping = shippingPayload();
    if (!shipping) return;

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/bank-transfer", {
        ...orderPayload(),
        addressId: selectedAddressId,
        shipping,
      });
      const payload = await response.json();
      setEftOrder(payload);
      toast({
        title: "Havale/EFT sipariş kodu oluşturuldu",
        description: "CLK kodunu banka transferi açıklamasına ekleyin.",
      });
    } catch (err) {
      toast({
        title: "Havale/EFT siparişi oluşturulamadı",
        description: err instanceof Error ? err.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmBankTransfer() {
    if (!eftOrder) return;
    setBusy(true);
    try {
      await apiRequest(
        "POST",
        `/api/b2b/payments/bank-transfer/${encodeURIComponent(eftOrder.orderNumber)}/confirm`,
      );
      if (cartMode) clearB2BCart();
      toast({
        title: "Sipariş tamamlandı",
        description: "Ödeme bildiriminiz kontrol için alındı.",
      });
      window.location.assign("/siparislerim");
    } catch (err) {
      toast({
        title: "Sipariş tamamlanamadı",
        description: err instanceof Error ? err.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const success = result === "success";
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-4 py-12 text-slate-950">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}>
            {success ? <CheckCircle2 className="h-7 w-7" /> : <CreditCard className="h-7 w-7" />}
          </div>
          <h1 className="mt-4 text-2xl font-black">
            {success ? "Ödeme başarıyla tamamlandı" : "Ödeme tamamlanamadı"}
          </h1>
          {resultOrder ? <p className="mt-2 text-sm text-slate-500">Sipariş No: <b>{resultOrder}</b></p> : null}
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild><Link href="/siparislerim">Siparişler</Link></Button>
            <Button asChild variant="outline"><Link href="/">Mağazaya dön</Link></Button>
          </div>
        </div>
      </main>
    );
  }

  const backHref = cartMode ? "/siparislerim" : productId ? `/urun/${productId}` : "/";

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-slate-950 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <Link href={backHref} className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {cartMode ? "Siparişlere dön" : "Ürüne dön"}
        </Link>

        <div className="mb-5">
          <h1 className="text-2xl font-black">Ödeme</h1>
          <p className="mt-1 text-sm text-slate-500">Adres, teslimat ve ödeme bilgilerinizi tamamlayın.</p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Ödeme özeti hazırlanıyor…</div>
        ) : error || !preview ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            {error instanceof Error ? error.message : "Sipariş bilgisi eksik."}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <div className="rounded-2xl border bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Fatura / Teslimat Adresi</h2>
                    <p className="mt-1 text-sm text-slate-500">Bu ekrandan yeni adres ekleyebilir, düzenleyebilir veya silebilirsiniz.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAddressId(null);
                      setAddressForm(EMPTY_ADDRESS);
                      setAddressOpen((value) => !value);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Adres
                  </Button>
                </div>

                {addressOpen ? (
                  <form onSubmit={saveAddress} className="mt-4 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                    <Input placeholder="Adres başlığı" value={addressForm.title} onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })} required />
                    <Input placeholder="Teslim alacak kişi" value={addressForm.recipient} onChange={(e) => setAddressForm({ ...addressForm, recipient: e.target.value })} />
                    <Input placeholder="Telefon" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
                    <Input placeholder="İl" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required />
                    <Input placeholder="İlçe" value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} />
                    <Input placeholder="Posta kodu" value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} required />
                    <div className="sm:col-span-2">
                      <Input placeholder="Açık adres" value={addressForm.addressLine} onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })} required />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setAddressOpen(false)}>Vazgeç</Button>
                      <Button type="submit" disabled={busy}>{editingAddressId ? "Adresi Güncelle" : "Adresi Kaydet"}</Button>
                    </div>
                  </form>
                ) : null}

                <div className="mt-4 space-y-2">
                  {addresses.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Henüz kayıtlı adresiniz yok.</div>
                  ) : addresses.map((address) => {
                    const selected = String(address.id) === selectedAddressId;
                    return (
                      <div key={address.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selected ? "border-slate-950 bg-slate-50" : ""}`}>
                        <button type="button" onClick={() => setAddressId(String(address.id))} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block font-semibold">{address.title}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">{address.address_line} · {[address.district, address.city, address.postal_code].filter(Boolean).join(" / ")}</span>
                          </span>
                        </button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => editAddress(address)}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => deleteAddress(address)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Fatura Bilgileri</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Vergi bilgileri Firma Bilgilerim alanından otomatik gelir ve ödeme ekranında değiştirilemez.
                    </p>
                  </div>
                  <div className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Kilitli
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Firma Ünvanı</Label>
                    <Input value={billingAccount?.companyName || ""} readOnly className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vergi Numarası</Label>
                    <Input value={billingAccount?.taxNumber || ""} readOnly className="bg-slate-50 font-semibold" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vergi Dairesi</Label>
                    <Input value={billingAccount?.taxOffice || ""} readOnly className="bg-slate-50" />
                  </div>
                </div>
                {!billingAccount?.taxNumber ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Firma hesabınızda vergi numarası bulunamadı. Kartlı ödeme için firma vergi numarası zorunludur.
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-bold">Teslimat Seçeneği</h2>
                <div className="mt-4 space-y-2">
                  <DeliveryChoice
                    active={shippingMethod === "cargo"}
                    icon={<Truck className="h-5 w-5" />}
                    title="Kargo ile gönder"
                    description="PTT Kargo ile gönderilir"
                    onClick={() => setShippingMethod("cargo")}
                  />
                  <DeliveryChoice
                    active={shippingMethod === "freight"}
                    icon={<Warehouse className="h-5 w-5" />}
                    title="Ambar ile gönder"
                    description="Ambar firma bilgilerinizi girin"
                    onClick={() => setShippingMethod("freight")}
                  />
                  <DeliveryChoice
                    active={shippingMethod === "pickup"}
                    icon={<Store className="h-5 w-5" />}
                    title="Kendim teslim alacağım"
                    description="İSTOÇ teslim noktası"
                    onClick={() => setShippingMethod("pickup")}
                  />
                </div>

                {shippingMethod === "freight" ? (
                  <div className="mt-3 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Ambar Firma İsmi</Label><Input value={freightCompany} onChange={(e) => setFreightCompany(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Telefon Numarası</Label><Input inputMode="tel" value={freightPhone} onChange={(e) => setFreightPhone(e.target.value)} /></div>
                  </div>
                ) : null}

                {shippingMethod === "pickup" ? (
                  <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold">İSTOÇ Toptan Ticaret Merkezi Mahmutbey Mh. 19 Ada 23 Numara Bağcılar/İstanbul</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["09:00", "15:00", "17:00"] as const).map((time) => (
                        <button key={time} type="button" onClick={() => setPickupTime(time)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${pickupTime === time ? "bg-slate-950 text-white" : "bg-white"}`}>{time}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-bold">Ödeme Yöntemi</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setMethod("card")} className={`rounded-xl border p-4 text-left ${method === "card" ? "bg-slate-950 text-white" : ""}`}>
                    <CreditCard className="h-5 w-5" />
                    <div className="mt-2 font-bold">Kredi / Banka Kartı</div>
                  </button>
                  <button type="button" onClick={() => setMethod("bank_transfer")} className={`rounded-xl border p-4 text-left ${method === "bank_transfer" ? "bg-slate-950 text-white" : ""}`}>
                    <Landmark className="h-5 w-5" />
                    <div className="mt-2 font-bold">Havale / EFT</div>
                  </button>
                </div>
              </div>

              {method === "card" ? (
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-bold">Kart Bilgileri</h3>
                  <p className="mt-1 text-xs text-slate-500">Kart bilgileri sipariş kaydına yazılmaz; ödeme doğrulaması iyzico 3D Secure ile tamamlanır.</p>

                  {threeDSHtml ? (
                    <div className="mt-4 overflow-hidden rounded-xl border">
                      <iframe
                        title="3D Secure Doğrulama"
                        srcDoc={threeDSHtml}
                        className="h-[520px] w-full bg-white"
                        onLoad={(event) => {
                          try {
                            const href = event.currentTarget.contentWindow?.location.href || "";
                            const url = new URL(href);
                            const paymentResult = url.searchParams.get("result");
                            if (
                              url.origin === window.location.origin &&
                              url.pathname === "/odeme" &&
                              (paymentResult === "success" || paymentResult === "failed")
                            ) {
                              window.location.replace(url.toString());
                            }
                          } catch {
                            // Expected while the iframe is on iyzico/bank cross-origin pages.
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-4">
                        <div className="space-y-2">
                          <Label>Kart Üzerindeki İsim Soyisim</Label>
                          <Input autoComplete="cc-name" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} placeholder="AD SOYAD" />
                        </div>
                        <div className="space-y-2">
                          <Label>Kart Numarası</Label>
                          <Input
                            autoComplete="cc-number"
                            inputMode="numeric"
                            value={cardNumber}
                            maxLength={23}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="0000 0000 0000 0000"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-2"><Label>Ay</Label><Input autoComplete="cc-exp-month" inputMode="numeric" maxLength={2} value={expireMonth} onChange={(e) => setExpireMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="AA" /></div>
                          <div className="space-y-2"><Label>Yıl</Label><Input autoComplete="cc-exp-year" inputMode="numeric" maxLength={4} value={expireYear} onChange={(e) => setExpireYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="YY" /></div>
                          <div className="space-y-2"><Label>CVV</Label><Input autoComplete="cc-csc" type="password" inputMode="numeric" maxLength={4} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="***" /></div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <Label>Taksit Seçenekleri</Label>
                            {installmentData?.bankName ? (
                              <div className="mt-1 text-xs text-slate-500">
                                {installmentData.bankName}
                                {installmentData.cardFamilyName ? ` · ${installmentData.cardFamilyName}` : ""}
                                {installmentData.cardType ? ` · ${installmentData.cardType.replace(/_/g, " ")}` : ""}
                              </div>
                            ) : null}
                          </div>
                          {cardBin.length === 8 && installmentsLoading ? (
                            <span className="text-xs text-slate-500">iyzico oranları alınıyor…</span>
                          ) : null}
                        </div>

                        {cardBin.length < 8 ? (
                          <div className="mt-2 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
                            Kartınızın ilk 8 hanesini girdiğinizde bankanıza özel güncel iyzico taksit oranları otomatik gösterilir.
                          </div>
                        ) : installmentError ? (
                          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {installmentError instanceof Error
                              ? installmentError.message
                              : "Taksit seçenekleri alınamadı."}
                          </div>
                        ) : installmentsLoading && !installmentData ? (
                          <div className="mt-2 rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                            Kart ve banka bilgileri iyzico üzerinden doğrulanıyor…
                          </div>
                        ) : (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {(installmentData?.options || []).map((option) => {
                              const count = option.installmentNumber;
                              const active = installment === count;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => setInstallment(count)}
                                  className={`rounded-xl border p-3 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "bg-white hover:border-slate-400"}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold">
                                      {count === 1 ? "Tek Çekim" : `${count} Taksit`}
                                    </span>
                                    {count > 1 ? (
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/15" : "bg-slate-100 text-slate-600"}`}>
                                        %{option.commissionRate.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className={`mt-2 text-sm font-semibold ${active ? "text-white" : "text-slate-800"}`}>
                                    {count === 1
                                      ? formatMoney(option.totalPrice)
                                      : `${formatMoney(option.installmentPrice)} × ${count}`}
                                  </div>
                                  <div className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                                    Toplam {formatMoney(option.totalPrice)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          Yalnızca iyzico'nun bu kart için döndürdüğü taksitler gösterilir; oran ve toplam tutar kart değiştiğinde yeniden hesaplanır.
                        </p>
                      </div>

                      {!settings?.iyzicoConfigured ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Kartla ödeme henüz canlı iyzico bilgileriyle etkinleştirilmedi.</div>
                      ) : null}

                      <Button
                        className="mt-5"
                        onClick={startCardPayment}
                        disabled={
                          busy ||
                          !settings?.iyzicoConfigured ||
                          !selectedAddressId ||
                          !billingAccount?.taxNumber ||
                          cardBin.length !== 8 ||
                          installmentsLoading ||
                          !selectedInstallment
                        }
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {busy ? "3D Secure hazırlanıyor…" : `${formatMoney(payableTotal)} Kart ile Öde`}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-bold">Havale / EFT Bilgileri</h3>
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
                          <Button type="button" variant="outline" size="sm" onClick={() => copy(settings.bankTransfer.iban, "IBAN kopyalandı")}><Copy className="h-4 w-4" /></Button>
                        </div>
                      </div>

                      {eftOrder ? (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="text-sm font-bold text-emerald-950">Siparişe özel ödeme kodunuz</div>
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white p-3">
                            <code className="text-base font-black">{eftOrder.transferDescription}</code>
                            <Button type="button" variant="outline" size="sm" onClick={() => copy(eftOrder.transferDescription, "CLK sipariş kodu kopyalandı")}><Copy className="h-4 w-4" /></Button>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-emerald-900">Banka transferi açıklamasına bu CLK kodunu eksiksiz yazın.</p>
                          <Button className="mt-4 w-full" onClick={confirmBankTransfer} disabled={busy}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {busy ? "Sipariş tamamlanıyor…" : "Ödemeyi Tamamladım · Siparişi Tamamla"}
                          </Button>
                        </div>
                      ) : (
                        <Button className="mt-5" onClick={createBankTransferOrder} disabled={busy || !selectedAddressId}>
                          <Landmark className="mr-2 h-4 w-4" />
                          {busy ? "Kod oluşturuluyor…" : "Havale/EFT Sipariş Kodunu Oluştur"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Havale/EFT hesap bilgileri henüz tanımlanmadı.</div>
                  )}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-2xl border bg-white p-5 lg:sticky lg:top-5">
              <h2 className="font-bold">Sipariş Özeti</h2>
              <div className="mt-4 divide-y rounded-xl border">
                {preview.items.map((line) => (
                  <div key={line.product.id} className="p-3">
                    <div className="text-sm font-semibold">{line.product.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{line.quantity} koli × {line.product.unitsPerBox} adet = {line.totalUnits} adet</div>
                    <div className="mt-1 text-xs text-slate-500">Birim fiyat {formatMoney(line.product.price)}</div>
                    <div className="mt-1 text-sm font-bold">{formatMoney(line.total)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="font-semibold">Toplam</span>
                <span className="text-xl font-black">{formatMoney(preview.total)}</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function DeliveryChoice({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "bg-white hover:border-slate-400"}`}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className={`mt-0.5 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{description}</span>
      </span>
    </button>
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
