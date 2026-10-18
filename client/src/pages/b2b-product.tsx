import { useEffect, useState, type ReactNode } from "react";
import { trackProductView } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, BadgeCheck, Boxes, CreditCard, Minus, Package, Plus, ShieldCheck, ShoppingBag, Store, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { B2BHeader } from "@/components/b2b-header";
import { useBranding } from "@/hooks/use-branding";
import { addB2BCartItem, refreshB2BCart } from "@/lib/b2b-cart";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadApprovedSupplierProduct, type UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";

type SessionUser = {
  role?: string;
  isActive?: boolean;
};


async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

async function loadProduct(id: string): Promise<UnifiedB2BProduct> {
  if (id.startsWith("mp-")) return loadApprovedSupplierProduct(id);
  const response = await fetch(`/api/b2b/products/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 404 ? "Ürün bulunamadı" : "Ürün yüklenemedi");
  return response.json();
}

export default function B2BProductPage() {
  const { toast } = useToast();
  const { data: branding } = useBranding();
  const [, params] = useRoute("/urun/:id");
  const id = params?.id || "";
  const { data: session } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: loadSession,
    retry: false,
    staleTime: 15_000,
  });
  const loggedIn =
    session?.role === "b2b_customer" &&
    session?.isActive === true;
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added,setAdded] = useState(false);
  useEffect(()=>{if(!added)return;const t=window.setTimeout(()=>setAdded(false),2400);return ()=>window.clearTimeout(t);},[added]);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["/api/b2b/products", id, loggedIn ? "member" : "guest"],
    queryFn: () => loadProduct(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (product?.id) void trackProductView(product.id, product.name);
  }, [product?.id, product?.name]);

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-[#f6f7f9] text-slate-500">Ürün yükleniyor…</div>;
  }

  if (!product || error) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f6f7f9] p-6">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-xl font-bold">Ürün bulunamadı</h1>
          <Button asChild className="mt-5"><Link href="/">Ürünlere dön</Link></Button>
        </div>
      </div>
    );
  }

  const image = product.image_data || product.image_url;
  const isSupplier = product.marketplace === true && Boolean(product.marketplace_product_id && product.seller_slug);
  const pack = Math.max(1, Number(product.units_per_box || 1));
  const min = Math.max(1, Number(product.min_order_qty || 1));
  const stock = Math.max(0, Number(product.stock || 0));
  const maxBoxes = Math.max(0, Math.floor(stock / pack));
  const effectiveQuantity = Math.min(
    maxBoxes || min,
    Math.max(min, quantity < min ? min : quantity),
  );
  const boxTotal = Number(product.price || 0) * pack * effectiveQuantity;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader />

      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <Link href="/" className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
        </Link>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-6">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex aspect-square items-center justify-center bg-white">
              {image ? (
                <img src={image} alt={product.name || "Ürün"} className="h-full w-full object-contain p-5" />
              ) : (
                <Package className="h-24 w-24 text-slate-200" />
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 sm:p-5">
            <div className="text-xs text-slate-500">Stok Kodu: <b className="text-slate-700">{product.sku || "—"}</b></div>
            <h1 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{product.name || "Ürün"}</h1>
            <Link
               href={isSupplier ? "/magaza/" + encodeURIComponent(product.seller_slug!) : "/"}
               className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-300 hover:bg-amber-50"
               aria-label={isSupplier ? "Satıcı mağazasını görüntüle" : "Çalışkan B2B mağazasını görüntüle"}
             >
               <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-amber-900">
                 {(isSupplier ? product.seller_logo_url : (branding?.b2b_logo || branding?.b2b_mobile_logo)) ? (
                   <img
                     src={(isSupplier ? product.seller_logo_url : (branding?.b2b_logo || branding?.b2b_mobile_logo)) || ""}
                     alt={(isSupplier ? product.seller_name || "Tedarikçi" : "Çalışkan B2B") + " logosu"}
                     className="h-full w-full object-contain p-1"
                   />
                 ) : <Store className="h-6 w-6"/>}
               </span>
               <span className="min-w-0 flex-1">
                 <span className="flex items-center gap-1 text-sm font-semibold">
                   <span className="truncate">{isSupplier ? product.seller_name || "Onaylı tedarikçi" : "Çalışkan B2B"}</span>
                   <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="Doğrulanmış satıcı"/>
                 </span>
                 <span className="mt-1 block text-xs font-medium text-amber-800">
                   {isSupplier ? "Mağazayı görüntüle →" : "Çalışkan mağazasını gör →"}
                 </span>
               </span>
             </Link>
             {product.description ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                {product.description}
              </p>
            ) : null}
            {product.collection_name ? <div className="mt-2 text-sm text-slate-500">{product.collection_name}</div> : null}

            <div className="mt-5 border-y py-4">
              <div className="text-sm text-slate-500">B2B fiyatı</div>
              <div className="mt-1 text-2xl font-black text-slate-950">
                {loggedIn && product.price !== null && product.price !== undefined
                  ? `${Number(product.price).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ₺`
                  : "Fiyat için giriş yapın"}
              </div>
              {loggedIn ? (
                <div className="mt-1 text-xs text-slate-500">
                  Birim fiyat · Koli içi {pack} adet
                </div>
              ) : (
                <Button asChild className="mt-4 bg-slate-950 text-white hover:bg-slate-800">
                  <Link href="/uye-girisi">İşletme hesabıyla giriş yap</Link>
                </Button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              <Info icon={<Boxes className="h-5 w-5" />} label="Koli içi" value={`${pack} adet`} />
              <Info icon={<Warehouse className="h-5 w-5" />} label="Stok" value={`${stock} adet · ${maxBoxes} koli`} />
              <Info icon={<ShieldCheck className="h-5 w-5" />} label="Minimum" value={`${min} koli`} />
            </div>

            {loggedIn ? (
              <div className="mt-5 rounded-xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Sipariş edilen koli adedi</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Minimum {min} koli · En fazla {maxBoxes} koli · {pack} adet/koli
                    </div>
                    <div className="mt-3 inline-flex items-center rounded-lg border bg-white">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                        disabled={effectiveQuantity <= min}
                        onClick={() => setQuantity(Math.max(min, effectiveQuantity - 1))}
                        aria-label="Adedi azalt"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={min}
                        max={maxBoxes}
                        value={effectiveQuantity}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value || String(min), 10);
                          setQuantity(Math.min(maxBoxes || min, Math.max(min, next || min)));
                        }}
                        className="h-10 w-20 border-x text-center text-sm font-bold outline-none"
                      />
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                        disabled={effectiveQuantity >= maxBoxes}
                        onClick={() => setQuantity(Math.min(maxBoxes, effectiveQuantity + 1))}
                        aria-label="Adedi artır"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-52">
                    <Button
                      type="button"
                      disabled={maxBoxes < min || busy}
                      className={added?"bg-green-500 text-white hover:bg-green-600 transition-colors":"transition-colors"}
                      onClick={async () => {
                        if (isSupplier) {
                          if (busy) return;
                          setBusy(true);
                          try {
                            await apiRequest("POST", "/api/marketplace/cart", { productId: product.marketplace_product_id, boxes: effectiveQuantity, deliveryMode: "direct" });
                            refreshB2BCart();
                            await queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
                            setAdded(true);
                            toast({title:"Siparişlere eklendi",description:product.name + " · " + effectiveQuantity + " koli"});
                          } catch (error) {
                            toast({title:"Siparişlere eklenemedi",description:error instanceof Error ? error.message : "Lütfen tekrar deneyin.",variant:"destructive"});
                          } finally { setBusy(false); }
                          return;
                        }
                        addB2BCartItem({
                          productId: String(product.id),
                          sku: String(product.sku || ""),
                          name: String(product.name || "Ürün"),
                          image: image || null,
                          price: Number(product.price || 0),
                          quantity: effectiveQuantity,
                          minOrderQty: min,
                          unitsPerBox: pack,
                          stock,
                        });
                        setAdded(true);
                        toast({
                          title: "Siparişlere eklendi",
                          description: `${product.name || "Ürün"} · ${effectiveQuantity} koli · ${effectiveQuantity * pack} adet`,
                        });
                      }}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      {added ? "Siparişlere Eklendi" : "Siparişlere Ekle"}
                    </Button>
                    <Button asChild disabled={maxBoxes < min} variant="outline">
                      <Link href={isSupplier ? "/siparislerim" : `/odeme?productId=${encodeURIComponent(String(product.id))}&qty=${effectiveQuantity}`}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isSupplier ? "Siparişlerim" : "Hemen Öde"}
                      </Link>
                    </Button>
                  </div>
                </div>
                {maxBoxes < min ? (
                  <div className="mt-3 text-xs font-medium text-rose-600">
                    Tam koli siparişi için yeterli stok bulunmuyor.
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">
                    Seçili sipariş: {effectiveQuantity} koli × {pack} adet = {effectiveQuantity * pack} adet ·
                    Toplam {boxTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-2 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
              <Truck className="h-5 w-5 text-slate-700" />
              {isSupplier
                ? "Tedarikçi siparişiniz satıcı onayı beklemek üzere oluşturulur. Online ödeme henüz aktif değildir."
                : loggedIn
                ? "Siparişinizi kart veya Havale/EFT ile tamamlayabilirsiniz."
                : "Sipariş ve sevkiyat seçenekleri giriş yaptıktan sonra aktif olur."}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-slate-500">{icon}</div>
      <div className="mt-3 text-[11px] text-slate-500">{label}</div>
      <b className="mt-1 block text-sm">{value}</b>
    </div>
  );
}
