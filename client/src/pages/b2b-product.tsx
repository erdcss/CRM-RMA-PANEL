import { useEffect, useState, type ReactNode } from "react";
import { trackProductView } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Boxes, CreditCard, Minus, Package, Plus, ShieldCheck, ShoppingBag, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { B2BHeader } from "@/components/b2b-header";
import { addB2BCartItem } from "@/lib/b2b-cart";
import { useToast } from "@/hooks/use-toast";

type SessionUser = {
  role?: string;
  isActive?: boolean;
};

type Product = {
  id: string | number;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: number | string | null;
  stock?: number | null;
  min_order_qty?: number | null;
  units_per_box?: number | null;
  image_data?: string | null;
  image_url?: string | null;
  collection_name?: string | null;
  features?: string[] | null;
  variants?: Array<Record<string, string>> | null;
};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

async function loadProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/b2b/products/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 404 ? "Ürün bulunamadı" : "Ürün yüklenemedi");
  return response.json();
}

export default function B2BProductPage() {
  const { toast } = useToast();
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
  const pack = Math.max(1, Number(product.units_per_box || 1));
  const min = Math.max(1, Number(product.min_order_qty || 1));
  const stock = Math.max(0, Number(product.stock || 0));
  const effectiveQuantity = Math.min(
    stock || min,
    Math.max(min, quantity < min ? min : quantity),
  );

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
            {product.collection_name ? <div className="mt-2 text-sm text-slate-500">{product.collection_name}</div> : null}
            {product.description ? <p className="mt-4 text-sm leading-6 text-slate-600">{product.description}</p> : null}

            <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white">
              <div className="text-sm text-slate-300">B2B fiyatı</div>
              <div className="mt-1 text-xl font-black">
                {loggedIn && product.price !== null && product.price !== undefined
                  ? `${Number(product.price).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ₺`
                  : "Fiyat için giriş yapın"}
              </div>
              {!loggedIn ? (
                <Button asChild className="mt-4 bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/uye-girisi">İşletme hesabıyla giriş yap</Link>
                </Button>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              <Info icon={<Boxes className="h-5 w-5" />} label="Koli içi" value={`${pack} adet`} />
              <Info icon={<Warehouse className="h-5 w-5" />} label="Stok" value={`${Math.max(0, Number(product.stock || 0))} adet`} />
              <Info icon={<ShieldCheck className="h-5 w-5" />} label="Minimum" value={`${min} adet`} />
            </div>

            {loggedIn ? (
              <div className="mt-5 rounded-xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Sipariş adedi</div>
                    <div className="mt-1 text-xs text-slate-500">Minimum {min} adet · Stok {stock} adet</div>
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
                        max={stock}
                        value={effectiveQuantity}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value || String(min), 10);
                          setQuantity(Math.min(stock || min, Math.max(min, next || min)));
                        }}
                        className="h-10 w-20 border-x text-center text-sm font-bold outline-none"
                      />
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                        disabled={effectiveQuantity >= stock}
                        onClick={() => setQuantity(Math.min(stock, effectiveQuantity + 1))}
                        aria-label="Adedi artır"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-52">
                    <Button
                      type="button"
                      disabled={stock < min}
                      onClick={() => {
                        addB2BCartItem({
                          productId: String(product.id),
                          sku: String(product.sku || ""),
                          name: String(product.name || "Ürün"),
                          image: image || null,
                          price: Number(product.price || 0),
                          quantity: effectiveQuantity,
                          minOrderQty: min,
                          stock,
                        });
                        toast({
                          title: "Siparişlere eklendi",
                          description: `${product.name || "Ürün"} · ${effectiveQuantity} adet`,
                        });
                      }}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Siparişlere Ekle
                    </Button>
                    <Button asChild disabled={stock < min} variant="outline">
                      <Link href={`/odeme?productId=${encodeURIComponent(String(product.id))}&qty=${effectiveQuantity}`}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Hemen Öde
                      </Link>
                    </Button>
                  </div>
                </div>
                {stock < min ? (
                  <div className="mt-3 text-xs font-medium text-rose-600">Bu ürün için yeterli stok bulunmuyor.</div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-2 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
              <Truck className="h-5 w-5 text-slate-700" />
              {loggedIn
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
