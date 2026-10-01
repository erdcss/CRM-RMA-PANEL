import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import { trackSearch, trackSession } from "@/lib/analytics";
import { Search, Package, Boxes, Truck, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";

type SessionUser = {
  role?: string;
  isActive?: boolean;
};

type B2BProduct = {
  id: string | number;
  sku?: string | null;
  name?: string | null;
  price?: number | string | null;
  stock?: number | null;
  min_order_qty?: number | null;
  units_per_box?: number | null;
  image_data?: string | null;
  image_url?: string | null;
  collection_name?: string | null;
};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

async function loadProducts(): Promise<B2BProduct[]> {
  const response = await fetch("/api/b2b/products", { credentials: "include" });
  if (!response.ok) return [];
  return response.json();
}

export default function B2BStorefront() {
  useEffect(() => {
    void trackSession();
  }, []);
  const [query, setQuery] = useState("");
  const { data: session } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: loadSession,
    retry: false,
    staleTime: 15_000,
  });
  const loggedIn =
    session?.role === "b2b_customer" &&
    session?.isActive === true;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/b2b/products", loggedIn ? "member" : "guest"],
    queryFn: loadProducts,
    staleTime: 30_000,
  });

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) return;
    const timer = window.setTimeout(() => {
      void trackSearch(clean);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.collection_name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term)),
    );
  }, [products, query]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader
        middle={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 bg-slate-50 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün veya stok kodu ara"
            />
          </div>
        }
      />

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 md:grid-cols-2 md:items-center md:py-9">
          <div>
            <div className="text-sm font-bold tracking-wide text-amber-400">ÇALIŞKAN B2B</div>
            <h1 className="mt-2 max-w-xl text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
              Toptan alışverişinizi tek merkezden yönetin.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
              Ürünleri inceleyin, koli ve minimum alım bilgilerini görün. B2B fiyatları ve sipariş işlemleri işletme hesabı ile kullanılabilir.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Feature icon={<Boxes className="h-5 w-5" />} title="Koli Bazlı" text="Toptan sipariş" />
            <Feature icon={<Truck className="h-5 w-5" />} title="Sevkiyat" text="Hızlı operasyon" />
            <Feature icon={<ShieldCheck className="h-5 w-5" />} title="İşletme" text="Onaylı hesap" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 bg-white pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün veya stok kodu ara"
            />
          </div>
        </div>

        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Toptan Ürünler</h2>
            <p className="mt-1 text-sm text-slate-500">Çalışkan B2B ürün kataloğu</p>
          </div>
          {!isLoading && products.length > 0 ? (
            <div className="text-sm text-slate-500">{filtered.length} ürün</div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Ürünler yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-semibold">Ürün kataloğu hazırlanıyor</h3>
            <p className="mt-1 text-sm text-slate-500">Yeni ürünler eklendiğinde burada görüntülenecek.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((product) => {
              const image = product.image_data || product.image_url;
              return (
                <Link
                  key={product.id}
                  href={`/urun/${product.id}`}
                  className="group block overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <article>
                    <div className="flex aspect-square items-center justify-center bg-slate-50">
                      {image ? (
                        <img src={image} alt={product.name || "Ürün"} className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02]" />
                      ) : (
                        <Package className="h-12 w-12 text-slate-300" />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[11px] text-slate-400">{product.sku || "STOK"}</div>
                      <h3 className="mt-1 min-h-10 line-clamp-2 font-semibold">{product.name || "Ürün"}</h3>
                      <div className="mt-3 text-sm font-semibold text-slate-700">
                        {loggedIn && product.price !== null && product.price !== undefined
                          ? `${Number(product.price).toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} ₺`
                          : "Fiyat için giriş yapın"}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-slate-100 p-2">
                          Koli içi<br /><b>{product.units_per_box || 1} adet</b>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-2">
                          Min. alım<br /><b>{product.min_order_qty || 1} adet</b>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      {icon}
      <b className="mt-4 block text-sm sm:text-base">{title}</b>
      <span className="mt-1 block text-[11px] text-slate-300 sm:text-xs">{text}</span>
    </div>
  );
}
