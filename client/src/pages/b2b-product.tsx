import { useEffect, type ReactNode } from "react";
import { trackProductView } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Boxes, Package, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { useBranding } from "@/hooks/use-branding";

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

async function loadProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/b2b/products/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!response.ok) throw new Error(response.status === 404 ? "Ürün bulunamadı" : "Ürün yüklenemedi");
  return response.json();
}

export default function B2BProductPage() {
  const { data: branding } = useBranding();
  const [, params] = useRoute("/urun/:id");
  const id = params?.id || "";
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["/api/b2b/products", id],
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

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center">
            <img
              src={branding?.b2b_logo || BRAND.logoLarge}
              alt="Çalışkan B2B"
              className="h-12 w-auto max-w-[180px] object-contain object-left sm:h-14 sm:max-w-[220px]"
            />
          </Link>
          <Button asChild variant="outline" className="ml-auto">
            <Link href="/uye-girisi">Giriş Yap</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
        <Link href="/" className="mb-5 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
        </Link>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:gap-8">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex aspect-square items-center justify-center bg-white">
              {image ? (
                <img src={image} alt={product.name || "Ürün"} className="h-full w-full object-contain p-5" />
              ) : (
                <Package className="h-24 w-24 text-slate-200" />
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 sm:p-7">
            <div className="text-xs text-slate-500">Stok Kodu: <b className="text-slate-700">{product.sku || "—"}</b></div>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{product.name || "Ürün"}</h1>
            {product.collection_name ? <div className="mt-2 text-sm text-slate-500">{product.collection_name}</div> : null}
            {product.description ? <p className="mt-5 leading-7 text-slate-600">{product.description}</p> : null}

            <div className="mt-6 rounded-xl bg-slate-950 p-5 text-white">
              <div className="text-sm text-slate-300">B2B fiyatı</div>
              <div className="mt-1 text-2xl font-black">Fiyat için giriş yapın</div>
              <Button asChild className="mt-4 bg-white text-slate-950 hover:bg-slate-100">
                <Link href="/uye-girisi">İşletme hesabıyla giriş yap</Link>
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <Info icon={<Boxes className="h-5 w-5" />} label="Koli içi" value={`${pack} adet`} />
              <Info icon={<Warehouse className="h-5 w-5" />} label="Stok" value={`${Math.max(0, Number(product.stock || 0))} adet`} />
              <Info icon={<ShieldCheck className="h-5 w-5" />} label="Minimum" value={`${min} adet`} />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
              <Truck className="h-5 w-5 text-slate-700" />
              Sipariş ve sevkiyat seçenekleri giriş yaptıktan sonra aktif olur.
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
