import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import { trackSearch } from "@/lib/analytics";
import { Search, Package, Boxes, Truck, ShieldCheck, BadgeCheck, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter, B2BDesktopAppBanners } from "@/components/b2b-footer";
import { B2BProductCard } from "@/components/b2b-product-card";
import { loadApprovedSupplierProducts, type UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import { loadB2BHomepageCategories, type B2BHomepageCategories } from "@/lib/b2b-categories";
import { B2BCategoryTiles } from "@/components/b2b-category-tiles";

type SessionUser = {
  role?: string;
  isActive?: boolean;
};

type VerifiedStore = {id:number;slug:string;company_name:string;followers:number;description?:string;content?:{logoUrl?:string;bannerUrl?:string;tagline?:string}};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

async function loadProducts(): Promise<UnifiedB2BProduct[]> {
  const response = await fetch("/api/b2b/products", { credentials: "include" });
  if (!response.ok) return [];
  return response.json();
}

async function loadVerifiedStores(): Promise<VerifiedStore[]> {
  const response = await fetch("/api/marketplace/stores", { credentials: "include" });
  if (!response.ok) throw new Error("Mağazalar yüklenemedi");
  const result: VerifiedStore[] = await response.json();
  return Array.isArray(result) ? result : [];
}

export default function B2BStorefront() {
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

  const { data: ownProducts = [], isLoading: loadingOwn } = useQuery({
    queryKey: ["/api/b2b/products", loggedIn ? "member" : "guest"],
    queryFn: loadProducts,
    staleTime: 30_000,
  });
  const { data: supplierProducts = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ["/api/marketplace/products", loggedIn ? "member" : "guest"],
    queryFn: loadApprovedSupplierProducts,
    staleTime: 30_000,
  });
  const { data: verifiedStores = [] } = useQuery({
    queryKey: ["/api/marketplace/stores"],
    queryFn: loadVerifiedStores,
    staleTime: 30_000,
  });
  const products = useMemo(() => [...supplierProducts, ...ownProducts], [supplierProducts, ownProducts]);
  const isLoading = loadingOwn || loadingSuppliers;

  const { data: homepage = { categories: [] } } = useQuery<B2BHomepageCategories>({
    queryKey: ["/api/public/homepage"],
    queryFn: loadB2BHomepageCategories,
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

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        [product.name, product.sku, product.category, product.collection_name, product.marketplace ? product.seller_name : "ÇALIŞKAN"]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term));

      return matchesSearch;
    });
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
              placeholder="Ürün, stok kodu veya satıcı ara"
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
              <Link href="/magazalar" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-amber-300 hover:bg-white/10">
                Mağazaları Keşfet
              </Link>
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
          <section className="mb-8" aria-labelledby="homepage-categories-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="homepage-categories-title" className="text-lg font-black">Kategoriler</h2>
                <p className="mt-1 text-xs text-slate-500">Ürün grubuna dokunarak kategori sayfasını açın.</p>
              </div>
              <Link href="/kategoriler" className="shrink-0 text-xs font-bold text-amber-800 hover:underline">Tüm kategoriler</Link>
            </div>
            <B2BCategoryTiles homepage={homepage} />
          </section>
        ) : null}

                <div className="mb-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 bg-white pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün, stok kodu veya satıcı ara"
            />
          </div>
        </div>

        {verifiedStores.length > 0 ? (
          <section className="mb-9" aria-label="Onaylı tedarikçi mağazaları">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-bold">Onaylı Tedarikçi Mağazaları</h2><p className="mt-1 text-sm text-slate-500">Tüm mağazaları Çalışkan B2B üzerinden görüntüleyin.</p></div>
              <Link href="/magazalar" className="text-sm font-bold text-amber-800 hover:underline">Tüm mağazalar →</Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {verifiedStores.slice(0, 4).map(shop => (
                <Link key={shop.id} href={"/magaza/" + encodeURIComponent(shop.slug)} className="group min-w-0 overflow-hidden rounded-2xl border bg-white transition hover:border-amber-300 hover:shadow-md">
                  <div className="relative aspect-[3/1] bg-[#FFCD00]">
                    {shop.content?.bannerUrl ? <img src={shop.content.bannerUrl} alt="" className="h-full w-full object-cover"/> : null}
                    <span className="absolute -bottom-5 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white text-amber-700 shadow">
                      {shop.content?.logoUrl ? <img src={shop.content.logoUrl} alt={shop.company_name + " logosu"} className="h-full w-full object-contain"/> : <Store className="h-6 w-6"/>}
                    </span>
                  </div>
                  <div className="px-3 pb-4 pt-8">
                    <p className="flex items-center gap-1 truncate text-sm font-extrabold">{shop.company_name}<BadgeCheck className="h-4 w-4 shrink-0 text-green-600"/></p>
                    <p className="mt-1 text-xs text-slate-500">{shop.followers || 0} takipçi</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div id="urunler" className="mb-5 flex scroll-mt-24 items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Toptan Ürünler</h2>
            <p className="mt-1 text-sm text-slate-500">Çalışkan B2B ve onaylı tedarikçi ürünleri</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => (
              <B2BProductCard key={String(product.id)} product={product} loggedIn={loggedIn}/>
            ))}

          </div>
        )}
      </main>
      <B2BDesktopAppBanners />
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
