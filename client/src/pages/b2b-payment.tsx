import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { metaConsent, trackMetaEvent } from "@/lib/meta-pixel";
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
  sellerName?: string;
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
  supplierPaymentEnabled?: boolean;
  supplierPaymentNotice?: string | null;
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
  checkoutVisibility?:{cargo:boolean;freight:boolean;pickup:boolean;card:boolean;bank_transfer:boolean};
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
    const adminItems = getB2BCart().map(item=>({productId:item.productId,quantity:item.quantity}));
    // Both web and iOS use the customer's account-scoped supplier selection.
    const supplierResponse=await fetch("/api/marketplace/cart",{credentials:"include",cache:"no-store"});
    if(!supplierResponse.ok)throw new Error("Sipariş listenizi doğrulayamadık. Yeniden deneyin.");
    const supplierCart=await supplierResponse.json() as {
      items:Array<{product_id:number;boxes:number;valid:boolean}>;
    };
    if(supplierCart.items.some(item=>!item.valid))
      throw new Error("Sipariş listesindeki ürünlerden birinin stok veya koli koşulu değişti.");
    const items=[...adminItems,...supplierCart.items.map(item=>({
      productId:"mp-"+item.product_id,quantity:item.boxes,
    }))];
    if (!items.length) throw new Error("Sipariş listeniz boş");
    const response = await apiRequest("POST", "/api/b2b/checkout/preview", {items});
    return response.json();
  }

  const single = await getJson<{
    product: CheckoutProduct;
    quantity: number;
    totalUnits: number;
    total: number;
    currency: "TRY";
    iyzicoConfigured: boolean;
    supplierPaymentEnabled?: boolean;
    supplierPaymentNotice?: string | null;
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
    supplierPaymentEnabled: single.supplierPaymentEnabled,
    supplierPaymentNotice: single.supplierPaymentNotice,
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
  const checkoutEventSent=useRef(false);
  const [metaConsentRevision,setMetaConsentRevision]=useState(0);
  useEffect(()=>{
    const refresh=()=>setMetaConsentRevision(value=>value+1);
    window.addEventListener("caliskan-meta-consent-change",refresh);
    return ()=>window.removeEventListener("caliskan-meta-consent-change",refresh);
  },[]);

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
  const [checkoutFrameUrl, setCheckoutFrameUrl] = useState("");
  const [checkoutFrameLoading, setCheckoutFrameLoading] = useState(false);
  const [checkoutFrameError, setCheckoutFrameError] = useState("");
  const [checkoutFrameRevision, setCheckoutFrameRevision] = useState(0);
  const [saveCardForNextTime, setSaveCardForNextTime] = useState(false);
  const [selectedSavedCard, setSelectedSavedCard] = useState<number | null>(null);
  const [savedCardBusy, setSavedCardBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [bankReference, setBankReference] = useState<{
    reservationId: string;
    transferCode: string;
    transferDescription: string;
    expiresAt: string;
  } | null>(null);
  const [bankReferenceLoading, setBankReferenceLoading] = useState(false);
  const [bankReferenceError, setBankReferenceError] = useState("");
  const bankReferenceInFlight = useRef(false);
  const [eftOrder, setEftOrder] = useState<{
    orderNumber: string;
    total: number;
    transferDescription: string;
    bankTransfer: PaymentSettings["bankTransfer"];
  } | null>(null);

  const { data: savedCards = [] } = useQuery<Array<{id:number;brand?:string;last4?:string}>>({
    queryKey: ["/api/b2b/payment-methods"],
    queryFn: () => getJson("/api/b2b/payment-methods"),
    enabled: !result,
  });
  const { data: settings } = useQuery<PaymentSettings>({
    queryKey: ["/api/public/payment-settings"],
    queryFn: () => getJson("/api/public/payment-settings"),
    staleTime: 0,
    refetchInterval:5000,
    refetchOnWindowFocus:true,
  });

  const visibility=settings?.checkoutVisibility||{cargo:true,freight:true,pickup:true,card:true,bank_transfer:true};
  useEffect(()=>{
    if(!visibility[shippingMethod]){
      const first=(["cargo","freight","pickup"] as const).find(k=>visibility[k]);
      if(first)setShippingMethod(first);
    }
    if(!visibility[method]){
      const first=(["card","bank_transfer"] as const).find(k=>visibility[k]);
      if(first)setMethod(first);
    }
  },[visibility.cargo,visibility.freight,visibility.pickup,visibility.card,visibility.bank_transfer,shippingMethod,method]);
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

  useEffect(()=>{
    if(result||!preview||checkoutEventSent.current||metaConsent()!=="granted")return;
    const id=trackMetaEvent("InitiateCheckout",{
      content_type:"product",
      content_ids:preview.items.map(item=>String(item.product.sku||item.product.id)),
      contents:preview.items.map(item=>({id:String(item.product.sku||item.product.id),quantity:item.quantity})),
      currency:"TRY",
      value:Number(preview.total)||0,
      num_items:Number(preview.itemCount)||0
    });
    if(id)checkoutEventSent.current=true;
  },[preview,result,metaConsentRevision]);

  useEffect(()=>{
    if(result!=="success"||!resultOrder||metaConsent()!=="granted")return;
    let cancelled=false;
    // URL parameters alone cannot establish a purchase: verify the real
    // authenticated, paid order against the server's order history.
    void (async()=>{
      try{
        const response=await fetch("/api/b2b/my-orders",{credentials:"include",cache:"no-store"});
        if(!response.ok)return;
        const orders=await response.json() as Array<{order_number:string;status:string;total_amount:number|string;item_count:number}>;
        const order=orders.find(item=>item.order_number===resultOrder&&
          (item.status==="paid"||item.status==="paid_stock_review"));
        if(!order||cancelled)return;
        const key="caliskan_meta_purchase_"+order.order_number;
        if(window.localStorage.getItem(key)==="sent")return;
        const amount=Number(order.total_amount);
        if(!Number.isFinite(amount)||amount<=0)return;
        const eventId=trackMetaEvent("Purchase",{
          currency:"TRY",value:amount,num_items:Number(order.item_count)||1,
          order_id:order.order_number
        },"b2b-paid-"+order.order_number);
        if(eventId){
          window.localStorage.setItem(key,"sent");
          // Meta token stays server-side. The endpoint independently confirms
          // this authenticated customer's paid order and deduplicates the event.
          void fetch("/api/b2b/meta/purchase",{
            method:"POST",credentials:"include",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({orderNumber:order.order_number,consent:true})
          }).catch(()=>undefined);
        }
      }catch{/* Optional Meta measurement never blocks completed orders. */}
    })();
    return()=>{cancelled=true;};
  },[result,resultOrder,metaConsentRevision]);

  async function prepareBankReference() {
    if (bankReferenceInFlight.current || eftOrder) return;
    bankReferenceInFlight.current = true;
    setBankReferenceLoading(true);
    setBankReferenceError("");
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/bank-transfer/preview-code");
      const data = await response.json() as {
        reservationId: string; transferCode: string; transferDescription: string; expiresAt: string;
      };
      if (!/^[a-f0-9]{36}$/.test(String(data.reservationId || "")) ||
          !/^CLK[0-9]{6}$/.test(String(data.transferCode || "")) ||
          data.transferCode !== data.transferDescription) {
        throw new Error("Benzersiz EFT kodu doğrulanamadı.");
      }
      setBankReference(data);
    } catch (err) {
      setBankReferenceError(err instanceof Error ? err.message : "EFT kodu alınamadı.");
    } finally {
      bankReferenceInFlight.current = false;
      setBankReferenceLoading(false);
    }
  }

  useEffect(() => {
    if (!result && method === "bank_transfer" && settings?.bankTransfer.enabled &&
        preview && preview.supplierPaymentEnabled !== false &&
        !eftOrder && !bankReference && !bankReferenceLoading && !bankReferenceError) {
      void prepareBankReference();
    }
  }, [result, method, settings?.bankTransfer.enabled, preview, eftOrder,
      bankReference, bankReferenceLoading, bankReferenceError]);

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

  const cardCheckoutReady = Boolean(
    method === "card" &&
      visibility.card && visibility[shippingMethod] &&
      preview &&
      preview.supplierPaymentEnabled !== false &&
      settings?.iyzicoConfigured &&
      billingAccount?.taxNumber &&
      selectedAddressId &&
      (
        shippingMethod === "cargo" ||
        (shippingMethod === "freight" &&
          freightCompany.trim() &&
          freightPhone.replace(/\D/g, "").length >= 7) ||
        (shippingMethod === "pickup" && pickupTime)
      )
  );

  const cardCheckoutContext = JSON.stringify({
    savedCardId: selectedSavedCard,
    saveCard: saveCardForNextTime,
    addressId: selectedAddressId,
    shippingMethod,
    freightCompany: freightCompany.trim(),
    freightPhone: freightPhone.trim(),
    pickupTime,
    cartMode,
    productId,
    qty,
    total: preview?.total || 0,
    revision: checkoutFrameRevision,
  });

  useEffect(() => {
    if (!cardCheckoutReady || selectedSavedCard !== null) {
      setCheckoutFrameUrl("");
      setCheckoutFrameError("");
      setCheckoutFrameLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCheckoutFrameLoading(true);
        setCheckoutFrameError("");
        setCheckoutFrameUrl("");

        try {
          const shipping = shippingPayload();
          if (!shipping) return;

          const response = await apiRequest("POST", "/api/b2b/payments/iyzico/initialize", {
            ...orderPayload(),
            addressId: selectedAddressId,
            shipping,
            saveCard: saveCardForNextTime,
            checkoutContext: {
              source: cartMode ? "Sipariş listesi / sepet" : "Ürün detayı",
              entryPath: window.location.pathname + window.location.search,
              previousPath: document.referrer || "",
              cartMode,
              productId: productId || null,
            },
          });
          const payload = await response.json() as {
            orderNumber?: string;
            paymentPageUrl?: string;
          };

          if (!payload.paymentPageUrl) {
            throw new Error("iyzico ödeme formu oluşturulamadı");
          }

          const paymentUrl = new URL(payload.paymentPageUrl);
          if (
            paymentUrl.protocol !== "https:" ||
            !paymentUrl.hostname.toLowerCase().endsWith(".iyzipay.com")
          ) {
            throw new Error("iyzico ödeme adresi doğrulanamadı");
          }

          // iyzico Checkout Form'un resmi iframe modu.
          paymentUrl.searchParams.set("iframe", "true");

          if (!cancelled) {
            setCheckoutFrameUrl(paymentUrl.toString());
          }
        } catch (err) {
          if (!cancelled) {
            setCheckoutFrameError(
              err instanceof Error ? err.message : "Kart ödeme formu hazırlanamadı",
            );
          }
        } finally {
          if (!cancelled) setCheckoutFrameLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cardCheckoutContext, cardCheckoutReady, selectedSavedCard]);

  async function payWithSavedCard() {
    if (!cardCheckoutReady || selectedSavedCard === null || savedCardBusy) return;
    const shipping = shippingPayload();
    if (!shipping) return;
    setSavedCardBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/iyzico/3ds/initialize", {
        ...orderPayload(), addressId: selectedAddressId, shipping, installment: 1,
        savedCardId: selectedSavedCard,
        checkoutContext: { source: "Kayıtlı kart / web", cartMode, platform: "web" },
      });
      const payment = await response.json() as {threeDSHtmlContent?:string};
      if (!payment.threeDSHtmlContent) throw new Error("3D Secure doğrulaması oluşturulamadı.");
      openThreeDSInTopWindow(payment.threeDSHtmlContent);
    } catch (error) {
      toast({ title: "Kayıtlı kart ödemesi başlatılamadı",
        description: error instanceof Error ? error.message : "Tekrar deneyin", variant: "destructive" });
    } finally { setSavedCardBusy(false); }
  }

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
    if (!value.trim()) {
      toast({ title: "Kopyalanacak bilgi bulunamadı", variant: "destructive" });
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API yok");
      await navigator.clipboard.writeText(value);
      toast({ title: "Kopyalandı", description: label });
    } catch {
      // Older iOS browsers can deny the async clipboard even with HTTPS.
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch {}
      input.remove();
      toast(copied ? { title: "Kopyalandı", description: label }
        : { title: "Kopyalanamadı", description: "Metni seçerek elle kopyalayın.", variant: "destructive" });
    }
  }

  function copyBankTransferSummary() {
    const bank = eftOrder?.bankTransfer || settings?.bankTransfer;
    if (!bank) return;
    const description = eftOrder?.transferDescription || bankReference?.transferDescription;
    const lines = [
      "Çalışkan B2B - Havale / EFT Bilgileri",
      "Banka: " + bank.bankName,
      "Hesap Sahibi: " + bank.accountHolder,
      "IBAN: " + bank.iban.replace(/\s+/g, ""),
      "Tutar: " + formatMoney(eftOrder?.total ?? preview?.total ?? 0),
      ...(description ? ["Açıklama (zorunlu): " + description] : []),
      ...(eftOrder?.orderNumber ? ["Sipariş No: " + eftOrder.orderNumber] : []),
    ];
    void copy(lines.join("\n"), "Tüm banka, tutar ve açıklama bilgileri kopyalandı");
  }

  async function createBankTransferOrder() {
    if (preview?.supplierPaymentEnabled === false) {
      toast({ title: "Ödeme şu anda kullanılamıyor", description: preview.supplierPaymentNotice || "Tedarikçi tahsilatı henüz etkinleştirilmedi", variant: "destructive" });
      return;
    }
    if (!preview || !selectedAddressId) {
      toast({ title: "Teslimat adresi seçin", variant: "destructive" });
      return;
    }
    const shipping = shippingPayload();
    if (!shipping) return;
    if (!bankReference) {
      toast({ title: "EFT kodu henüz hazır değil", description: "Benzersiz kodu oluşturup tekrar deneyin.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/payments/bank-transfer", {
        reservationId: bankReference.reservationId,
        ...orderPayload(),
        addressId: selectedAddressId,
        shipping,
        checkoutContext: {
          source: cartMode ? "Sipariş listesi / sepet" : "Ürün detayı",
          entryPath: window.location.pathname + window.location.search,
          previousPath: document.referrer || "",
          cartMode,
          productId: productId || null,
        },
      });
      const payload = await response.json();
      if (payload.transferCode !== bankReference.transferCode ||
          payload.transferDescription !== bankReference.transferDescription) {
        throw new Error("Sipariş ile EFT referansı eşleşmedi; desteğe başvurun.");
      }
      setEftOrder(payload);
      toast({
        title: "Havale/EFT siparişi oluşturuldu",
        description: "Ödeme açıklamasına ekrandaki benzersiz CLK kodunu yazın.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      if (/süresi doldu|kodu bulunamadı|geçerli havale açıklama kodu/i.test(message)) {
        setBankReference(null);
        setBankReferenceError("EFT kodunuzun süresi dolmuş olabilir. Yeni kod oluşturun.");
      }
      toast({
        title: "Havale/EFT siparişi oluşturulamadı",
        description: message,
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
  const bankDetails = eftOrder?.bankTransfer || settings?.bankTransfer;
  const eftDescription = eftOrder?.transferDescription || bankReference?.transferDescription || "";

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
            {preview.supplierPaymentEnabled === false ? (
              <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 lg:col-span-2">
                {preview.supplierPaymentNotice || "Tedarikçi ürünleri için ödeme henüz etkin değil."}
              </div>
            ) : null}
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
                  {visibility.cargo?<DeliveryChoice
                    active={shippingMethod === "cargo"}
                    icon={<Truck className="h-5 w-5" />}
                    title="Kargo ile gönder"
                    description="PTT Kargo ile gönderilir"
                    onClick={() => setShippingMethod("cargo")}
                  />:null}
                  {visibility.freight?<DeliveryChoice
                    active={shippingMethod === "freight"}
                    icon={<Warehouse className="h-5 w-5" />}
                    title="Ambar ile gönder"
                    description="Ambar firma bilgilerinizi girin"
                    onClick={() => setShippingMethod("freight")}
                  />:null}
                  {visibility.pickup?<DeliveryChoice
                    active={shippingMethod === "pickup"}
                    icon={<Store className="h-5 w-5" />}
                    title="Kendim teslim alacağım"
                    description="İSTOÇ teslim noktası"
                    onClick={() => setShippingMethod("pickup")}
                  />:null}
                </div>

                {!visibility.cargo&&!visibility.freight&&!visibility.pickup?<p className="text-sm text-red-700">Şu anda teslimat yöntemi kullanılamıyor.</p>:null}
                {shippingMethod === "freight" && visibility.freight ? (
                  <div className="mt-3 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Ambar Firma İsmi</Label><Input value={freightCompany} onChange={(e) => setFreightCompany(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Telefon Numarası</Label><Input inputMode="tel" value={freightPhone} onChange={(e) => setFreightPhone(e.target.value)} /></div>
                  </div>
                ) : null}

                {shippingMethod === "pickup" && visibility.pickup ? (
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
                  {visibility.card?<button type="button" onClick={() => setMethod("card")} className={`rounded-xl border p-4 text-left ${method === "card" ? "bg-slate-950 text-white" : ""}`}>
                    <CreditCard className="h-5 w-5" />
                    <div className="mt-2 font-bold">Kredi / Banka Kartı</div>
                  </button>:null}
                  {visibility.bank_transfer?<button type="button" onClick={() => setMethod("bank_transfer")} className={`rounded-xl border p-4 text-left ${method === "bank_transfer" ? "bg-slate-950 text-white" : ""}`}>
                    <Landmark className="h-5 w-5" />
                    <div className="mt-2 font-bold">Havale / EFT</div>
                  </button>:null}
                </div>
              </div>

              {(!visibility[method]||!visibility[shippingMethod]) ? (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Seçilen ödeme veya teslimat yöntemi şu anda kullanılamıyor. Lütfen görünür seçeneklerden birini seçin.</div>
              ) : method === "card" ? (
                <div
                  className="rounded-2xl border bg-white p-5"
                  data-b2b-card-fields="persistent"
                >
                  {/* HARD RULE:
                      Kart alanı hiçbir koşulda buton-only/redirect-only yapıya çevrilmez.
                      Kart girişi ve 3D Secure aynı ödeme kartı içerisinde iyzico Checkout Form ile kalır. */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Kart Bilgileri</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Kart bilgileri, taksit seçimi ve 3D Secure doğrulaması bu alanın içinde iyzico tarafından güvenli şekilde yönetilir.
                        Kart bilgileriniz Çalışkan B2B sunucularında saklanmaz.
                      </p>
                    </div>
                    <div className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                      iyzico
                    </div>
                  </div>

                  {savedCards.length > 0 ? (
                    <div className="mt-4 space-y-2 rounded-xl border p-3">
                      <h4 className="text-sm font-semibold">Kayıtlı Kartlarım</h4>
                      {savedCards.map(card => (
                        <label key={card.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${selectedSavedCard === card.id ? "border-yellow-400 bg-amber-50" : "border-slate-200"}`}>
                          <input type="radio" name="savedCard" checked={selectedSavedCard === card.id}
                            onChange={() => setSelectedSavedCard(card.id)} />
                          <CreditCard className="h-5 w-5" />
                          <span>{card.brand || "Banka / Kredi Kartı"} <b>•••• {card.last4}</b></span>
                        </label>
                      ))}
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
                        <input type="radio" name="savedCard" checked={selectedSavedCard === null}
                          onChange={() => setSelectedSavedCard(null)} />
                        Yeni bir kart kullan
                      </label>
                    </div>
                  ) : null}
                  {selectedSavedCard !== null && cardCheckoutReady ? (
                    <div className="mt-4 space-y-3 rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs text-slate-600">Kayıtlı kart ile tek çekim ödeme ve banka 3D Secure doğrulaması.</p>
                      <Button type="button" disabled={savedCardBusy} onClick={() => void payWithSavedCard()}
                        className="w-full bg-amber-300 font-normal text-slate-900 hover:bg-amber-400">
                        {savedCardBusy ? "Ödeme hazırlanıyor…" : "Ödemeyi Tamamla"}
                      </Button>
                    </div>
                  ) : null}

                  {!cardCheckoutReady ? (
                    <div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-5 text-sm text-slate-600">
                      {!selectedAddressId
                        ? "Kart alanını açmak için teslimat adresi seçin."
                        : !billingAccount?.taxNumber
                          ? "Firma vergi numarası eksik. Firma bilgilerinizi tamamlayın."
                          : shippingMethod === "freight" &&
                              (!freightCompany.trim() || freightPhone.replace(/\D/g, "").length < 7)
                            ? "Kart alanını açmak için ambar firma adı ve telefonunu tamamlayın."
                            : shippingMethod === "pickup" && !pickupTime
                              ? "Kart alanını açmak için teslim alma saatini seçin."
                              : "Kart ödeme formu hazırlanıyor…"}
                    </div>
                  ) : null}

                  {selectedSavedCard === null && checkoutFrameLoading && !checkoutFrameUrl ? (
                    <div className="mt-4 overflow-hidden rounded-xl border bg-white p-4">
                      <div className="animate-pulse space-y-4" aria-label="Kart formu hazırlanıyor">
                        <div className="h-4 w-40 rounded bg-slate-200" />
                        <div className="h-11 rounded-lg bg-slate-100" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="h-11 rounded-lg bg-slate-100" />
                          <div className="h-11 rounded-lg bg-slate-100" />
                        </div>
                        <div className="h-11 rounded-lg bg-slate-100" />
                      </div>
                      <div className="mt-3 text-xs text-slate-500">iyzico güvenli kart alanı hazırlanıyor…</div>
                    </div>
                  ) : null}

                  {selectedSavedCard === null && checkoutFrameError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <div className="font-bold">Kart alanı yüklenemedi</div>
                      <div className="mt-1">{checkoutFrameError}</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setCheckoutFrameRevision((value) => value + 1)}
                      >
                        Tekrar Dene
                      </Button>
                    </div>
                  ) : null}

                  {selectedSavedCard === null && checkoutFrameUrl ? (
                    <div className="mt-4 overflow-hidden rounded-xl border bg-white">
                      <iframe
                        title="iyzico Güvenli Kart Ödemesi"
                        src={checkoutFrameUrl}
                        className="h-[760px] w-full bg-white"
                        allow="payment *"
                        referrerPolicy="strict-origin-when-cross-origin"
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
                            // iyzico/banka içeriği farklı origin üzerindeyken tarayıcı erişimi engeller.
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {selectedSavedCard === null ? (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
                      <input type="checkbox" checked={saveCardForNextTime}
                        onChange={event => setSaveCardForNextTime(event.target.checked)} />
                      <span>Bir sonraki alışverişim için kartımı kaydet</span>
                    </label>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Ödenecek tutar: <b className="text-slate-900">{formatMoney(preview.total)}</b></span>
                    {checkoutFrameUrl ? (
                      <button
                        type="button"
                        className="font-semibold text-blue-700 hover:underline"
                        onClick={() => setCheckoutFrameRevision((value) => value + 1)}
                      >
                        Kart formunu yenile
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-bold">Havale / EFT Bilgileri</h3>
                  {bankDetails?.enabled ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <BankLine label="Banka" value={bankDetails.bankName}
                          onCopy={() => void copy(bankDetails.bankName, "Banka adı kopyalandı")} />
                        <BankLine label="Hesap Sahibi" value={bankDetails.accountHolder}
                          onCopy={() => void copy(bankDetails.accountHolder, "Hesap sahibi kopyalandı")} />
                      </div>
                      <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">IBAN</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <code className="min-w-0 break-all text-sm font-bold">{formatIban(bankDetails.iban)}</code>
                          <Button type="button" variant="outline" size="sm"
                            aria-label="IBAN kopyala" onClick={() => void copy(bankDetails.iban.replace(/\s+/g, ""), "IBAN kopyalandı")}>
                            <Copy className="mr-1.5 h-4 w-4" /> Kopyala
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border bg-white p-4">
                        <div className="text-xs text-slate-500">Ödenecek Tutar</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <strong className="text-base">{formatMoney(eftOrder?.total ?? preview.total)}</strong>
                          <Button type="button" variant="outline" size="sm"
                            aria-label="Ödeme tutarını kopyala"
                            onClick={() => void copy((eftOrder?.total ?? preview.total).toFixed(2), "Ödeme tutarı kopyalandı")}>
                            <Copy className="mr-1.5 h-4 w-4" /> Kopyala
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                        <div className="text-sm font-extrabold text-amber-950">Benzersiz EFT Kodu · Banka Açıklaması</div>
                        {eftDescription ? (
                          <>
                            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
                              <div className="min-w-0">
                                <div className="text-xs text-slate-500">Açıklama (zorunlu)</div>
                                <code className="mt-1 block break-all text-lg font-black tracking-wide text-slate-950">{eftDescription}</code>
                              </div>
                              <Button type="button" size="sm" variant="outline"
                                aria-label="Benzersiz EFT açıklamasını kopyala"
                                onClick={() => void copy(eftDescription, "EFT açıklama kodu kopyalandı")}>
                                <Copy className="mr-1.5 h-4 w-4" /> Kopyala
                              </Button>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-amber-950">
                              Havale/EFT gönderirken bankanızın <b>Açıklama</b> alanına yalnızca bu kodu yazın.
                              Bu kod siparişinizle eşleştirilir.
                            </p>
                            {!eftOrder ? (
                              <p className="mt-2 text-xs font-semibold text-amber-900">
                                Ödeme yapmadan önce aşağıdan siparişi oluşturun. Kod, oluşturulan siparişin kaydına bağlanacaktır.
                              </p>
                            ) : (
                              <p className="mt-2 text-xs font-semibold text-emerald-800">
                                Sipariş kaydedildi · {eftOrder.orderNumber}
                              </p>
                            )}
                          </>
                        ) : bankReferenceLoading ? (
                          <p role="status" className="mt-2 text-sm text-amber-900">Siparişinize özel EFT açıklama kodu hazırlanıyor…</p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <p role="alert" className="text-sm text-amber-950">
                              {bankReferenceError || "Kod henüz hazırlanamadı."}
                            </p>
                            <Button type="button" size="sm" variant="outline" disabled={bankReferenceLoading}
                              onClick={() => { setBankReferenceError(""); void prepareBankReference(); }}>
                              Benzersiz kodu tekrar oluştur
                            </Button>
                          </div>
                        )}
                      </div>

                      <Button type="button" variant="outline"
                        className="mt-3 w-full border-slate-300 bg-white"
                        onClick={copyBankTransferSummary} disabled={!eftDescription}
                        title={!eftDescription ? "Önce benzersiz EFT kodunu oluşturun" : undefined}>
                        <Copy className="mr-2 h-4 w-4" />
                        Tüm EFT Bilgilerini Kopyala
                      </Button>
                      {eftOrder ? (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-sm font-bold text-emerald-950">
                            Siparişiniz oluşturuldu. Ödeme sonrası bildirimi tamamlayın.
                          </p>
                          <Button className="mt-4 w-full" onClick={confirmBankTransfer} disabled={busy}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {busy ? "Sipariş tamamlanıyor…" : "Ödemeyi Tamamladım · Siparişi Tamamla"}
                          </Button>
                        </div>
                      ) : (
                        <Button className="mt-4 w-full bg-[#FFCD00] font-extrabold text-slate-950 hover:bg-amber-300"
                          onClick={createBankTransferOrder}
                          disabled={busy || bankReferenceLoading || !bankReference || !selectedAddressId}>
                          <Landmark className="mr-2 h-4 w-4" />
                          {busy ? "Sipariş oluşturuluyor…" : "Havale/EFT Siparişini Oluştur"}
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
                    {line.product.sellerName ? <div className="mt-1 truncate text-xs font-medium text-slate-500">Satıcı: {line.product.sellerName}</div> : null}
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

function BankLine({label,value,onCopy}:{label:string;value:string;onCopy:()=>void}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="min-w-0 break-words font-semibold">{value}</span>
        <Button type="button" size="sm" variant="outline" aria-label={label+" kopyala"}
          onClick={onCopy} disabled={!value}>
          <Copy className="mr-1.5 h-4 w-4" /> Kopyala
        </Button>
      </div>
    </div>
  );
}
