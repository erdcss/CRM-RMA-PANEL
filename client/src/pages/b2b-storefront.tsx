import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import { trackSearch } from "@/lib/analytics";
import { Search, Package, Boxes, Truck, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter } from "@/components/b2b-footer";

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
  category?: string | null;
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

async function loadHomepage(): Promise<{ categories: string[] }> {
  const response = await fetch("/api/public/homepage", { credentials: "include" });
  if (!response.ok) return { categories: [] };
  return response.json();
}

export default function B2BStorefront() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
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

  const { data: homepage = { categories: [] } } = useQuery({
    queryKey: ["/api/public/homepage"],
    queryFn: loadHomepage,
    staleTime: 15_000,
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
    const category = selectedCategory.trim().toLocaleLowerCase("tr-TR");

    return products.filter((product) => {
      const matchesCategory =
        !category ||
        String(product.category || "").toLocaleLowerCase("tr-TR") === category;

      const matchesSearch =
        !term ||
        [product.name, product.sku, product.category, product.collection_name]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term));

      return matchesCategory && matchesSearch;
    });
  }, [products, query, selectedCategory]);

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

      <section
        className="relative overflow-hidden bg-slate-950 text-white"
        style={{ background: "radial-gradient(ellipse at 95% 0%, #162139 0%, #020617 60%)" }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:py-20">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              ÇALIŞKAN B2B · TOPTAN TİCARET
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-[1.15] tracking-tight sm:text-4xl lg:text-[42px]">
              Toptan alışverişinizi <span className="text-amber-300">tek merkezden</span> yönetin.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Ürünleri inceleyin, koli ve minimum alım bilgilerini karşılaştırın. İşletme hesabınızla size özel fiyatlara ve sipariş işlemlerine erişin.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#urunler"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Ürünleri İncele
              </a>
              <a
                href="https://pazaryeri.ecalisgan.com"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-amber-300 hover:bg-white/10"
              >
                Tedarikçi Ol
              </a>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-2.5" aria-label="Alışveriş avantajları">
            <Feature icon={<Boxes className="h-6 w-6" />} title="Koli Bazlı" text="Toptan alıma uygun miktarlar" />
            <Feature icon={<Truck className="h-6 w-6" />} title="Sevkiyat" text="Sipariş ve teslimat takibi" />
            <Feature icon={<ShieldCheck className="h-6 w-6" />} title="İşletme" text="Onaylı işletme hesabı" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {homepage.categories.length > 0 ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Kategoriler</h2>
                <p className="mt-0.5 text-xs text-slate-500">Ürün grubunu seçerek kataloğu filtreleyin.</p>
              </div>
              {selectedCategory ? (
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className="text-xs font-medium text-slate-500 hover:text-slate-950"
                >
                  Filtreyi temizle
                </button>
              ) : null}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              <button
                type="button"
                onClick={() => setSelectedCategory("")}
                className={`flex h-10 min-w-[130px] shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors ${
                  selectedCategory
                    ? "bg-white text-slate-700 hover:border-slate-400"
                    : "border-slate-950 bg-slate-950 text-white"
                }`}
              >
                Tümü
              </button>

              {homepage.categories.map((category) => {
                const active =
                  selectedCategory.toLocaleLowerCase("tr-TR") ===
                  category.toLocaleLowerCase("tr-TR");

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`flex h-10 min-w-[145px] shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

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

        <div id="urunler" className="mb-5 flex scroll-mt-24 items-end justify-between gap-4">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => {
              const image = product.image_data || product.image_url;
              return (
                <Link
                  key={product.id}
                  href={`/urun/${product.id}`}
                  className="group block min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/40"
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
      <B2BFooter />
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-row items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-sm sm:min-h-[170px] sm:flex-col sm:items-start sm:justify-between lg:min-h-[180px]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
        {icon}
      </div>
      <div className="min-w-0">
        <b className="block text-sm font-bold leading-snug text-white sm:text-base">{title}</b>
        <span className="mt-1 block text-xs leading-relaxed text-slate-300">{text}</span>
      </div>
    </div>
  );
}
