import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import { trackSearch } from "@/lib/analytics";
import { Search, Package, Boxes, Truck, ShieldCheck, BadgeCheck, Store, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter, B2BDesktopAppBanners } from "@/components/b2b-footer";
import { B2BProductRail } from "@/components/b2b-product-rail";
import { loadApprovedSupplierProducts, type UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import { loadB2BHomepageCategories, type B2BHomepageCategories } from "@/lib/b2b-categories";
import { B2BCategoryTiles } from "@/components/b2b-category-tiles";
import { availableProductsFirst, splitHomepageProducts, nextHomepageArrivalExpiry } from "@/lib/b2b-homepage-products";
import {B2BRoundCampaignButton} from "@/components/b2b-round-campaign-button";
import { B2BTimedOffer } from "@/components/b2b-timed-offer";

type SessionUser = {
  id?: number;
  role?: string;
  isActive?: boolean;
};

type TimedCampaign = { id: string; title: string; starts_at: string; ends_at: string; product_ids: string[] };
async function loadTimedCampaigns(): Promise<TimedCampaign[]> {
  const response=await fetch("/api/public/timed-campaigns",{credentials:"include",cache:"no-store"});
  if(!response.ok) return [];
  const result: unknown = await response.json();
  return Array.isArray(result) ? result as TimedCampaign[] : [];
}

type VerifiedStore = {id:number;slug:string;company_name:string;followers:number;description?:string;content?:{logoUrl?:string;bannerUrl?:string;tagline?:string}};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

async function loadProducts(): Promise<UnifiedB2BProduct[]> {
  const response = await fetch("/api/b2b/products?compact=1", { credentials: "include" });
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
  const [catalogNow, setCatalogNow] = useState(() => Date.now());
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
    queryKey: ["/api/b2b/products", loggedIn ? session?.id : "guest"],
    queryFn: loadProducts,
    enabled: session !== undefined,
    staleTime: 30_000,
  });
  const { data: supplierProducts = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ["/api/marketplace/products", loggedIn ? "member" : "guest"],
    queryFn: loadApprovedSupplierProducts,
    enabled: session !== undefined,
    staleTime: 30_000,
  });
  const { data: verifiedStores = [] } = useQuery({
    queryKey: ["/api/marketplace/stores"],
    queryFn: loadVerifiedStores,
    staleTime: 30_000,
  });
  const products = useMemo(() => [...supplierProducts, ...ownProducts], [supplierProducts, ownProducts]);
  const { data: timedCampaigns = [] } = useQuery({
    queryKey:["/api/public/timed-campaigns"],
    queryFn:loadTimedCampaigns,
    refetchInterval:30_000,
    staleTime:10_000,
  });
  const isLoading = loadingOwn || loadingSuppliers;
  // Move newly-added products to wholesale exactly after their 24-hour window,
  // even while the homepage remains open.
  useEffect(() => {
    const deadline = nextHomepageArrivalExpiry(products, catalogNow);
    if (deadline === null) return;
    const timer = window.setTimeout(
      () => setCatalogNow(Date.now()),
      Math.max(1, deadline - Date.now() + 1),
    );
    return () => window.clearTimeout(timer);
  }, [products, catalogNow]);
  useEffect(() => {
    const recheck = () => { if (!document.hidden) setCatalogNow(Date.now()); };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, []);

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

  const isSearching = query.trim().length > 0;
  const filtered = useMemo(() => {
    const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);

    return products.filter((product) => {
      const haystack = normalize([product.name, product.sku, product.category, product.collection_name, product.marketplace ? product.seller_name : "ÇALIŞKAN"].filter(Boolean).join(" "));
      return terms.every(term => haystack.includes(term));
    });
  }, [products, query]);

  const { newArrivals } = useMemo(
    () => splitHomepageProducts(filtered, catalogNow),
    [filtered, catalogNow],
  );
  // New arrivals are showcased separately but still belong to the full catalog.
  const catalogProducts = useMemo(() => availableProductsFirst(filtered), [filtered]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <B2BHeader
        middle={
          <div role="search" className="relative flex min-w-0 items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 h-5 w-5 text-slate-600" />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              aria-label="Ürün, stok kodu veya satıcı ara"
              autoComplete="off"
              className="h-11 w-full min-w-0 rounded-xl border border-[#ffcc00] bg-slate-50 pl-10 pr-11 text-base shadow-sm placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-[#ffcc00]/50 md:text-sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="Ürün, stok kodu veya satıcı ara"
            />
            {query ? <button type="button" aria-label="Aramayı temizle" onClick={() => setQuery("")} className="absolute right-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><X className="h-5 w-5" /></button> : null}
          </div>
        }
      />

      {!isSearching && <>
      {homepage.categories.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-3 pt-3 sm:pb-4 sm:pt-4" aria-labelledby="homepage-categories-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="homepage-categories-title" className="text-sm font-black sm:text-base">Kategoriler</h2>
            <Link href="/kategoriler" className="shrink-0 text-xs font-bold text-amber-800 hover:underline">Tüm kategoriler</Link>
          </div>
          <B2BCategoryTiles homepage={homepage} horizontal />
        </section>
      ) : null}

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
      </>}

      <main className={`mx-auto max-w-6xl px-4 ${isSearching ? "py-4 sm:py-6" : "py-8 sm:py-10"}`}>
        {isSearching ? (
          <section aria-labelledby="search-results-title" className="min-w-0">
            <div className="mb-4 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Çalışkan B2B · Ürün arama</p>
                <h1 id="search-results-title" className="mt-1 break-words text-lg font-black text-slate-950 sm:text-xl">Arama Sonuçları</h1>
                <p role="status" className="mt-1 break-words text-xs text-slate-600">{isLoading ? "Ürünler aranıyor…" : `${catalogProducts.length} ürün bulundu`} · “{query.trim()}”</p>
              </div>
              <button type="button" onClick={() => setQuery("")} className="shrink-0 rounded-lg bg-[#ffcc00] px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-950">Temizle</button>
            </div>
            {isLoading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500" role="status">Ürünler yükleniyor…</div> : catalogProducts.length ? (
              <B2BProductRail products={catalogProducts} loggedIn={loggedIn} title="Arama Sonuçları" />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center">
                <Search className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true"/>
                <h2 className="mt-3 font-bold text-slate-950">Aramanızla eşleşen ürün bulunamadı</h2>
                <p className="mt-1 text-sm text-slate-500">Farklı bir ürün adı veya stok kodu deneyin.</p>
                <button type="button" onClick={() => setQuery("")} className="mt-4 rounded-xl bg-[#ffcc00] px-4 py-2 text-sm font-bold text-slate-950">Tüm ürünleri keşfet</button>
              </div>
            )}
          </section>
        ) : <>

        {timedCampaigns.map(campaign=>{
          const end=Date.parse(campaign.ends_at);
          if(!Number.isFinite(end)||end<=catalogNow)return null;
          const ids=new Set(campaign.product_ids.map(String));
          const offers=ownProducts.filter(item=>ids.has(String(item.id))&&item.timed_campaign_id===campaign.id);
          if(!offers.length)return null;
          return <section key={campaign.id} className="mb-9 rounded-2xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-white p-3 shadow-sm sm:p-5" aria-label={campaign.title}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Sadece sınırlı süre</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{campaign.title}</h2>
                <p className="mt-1 text-xs text-slate-500">Süre dolduğunda indirim otomatik biter · Stok koli bazında canlı gösterilir</p>
              </div>
              <B2BTimedOffer endAt={campaign.ends_at} title="Kalan süre" stock={offers.reduce((total,p)=>total+Math.floor(Math.max(0,Number(p.stock)||0)/Math.max(1,Number(p.units_per_box)||1)),0)} unitsPerBox={1}/>
            </div>
            <B2BProductRail products={offers} loggedIn={loggedIn} title={campaign.title}/>
          </section>;
        })}




        <section className="mb-9 scroll-mt-24" id="yeni-gelenler" aria-labelledby="new-arrivals-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"/>
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Son 24 saat</span>
              </div>
              <h2 id="new-arrivals-title" className="text-xl font-bold">Yeni Gelen Ürünler</h2>
              <p className="mt-1 text-sm text-slate-500">Kataloğumuza son 24 saatte eklenen ürünler</p>
            </div>
            {!isLoading && newArrivals.length > 0 ? (
              <span className="text-sm text-slate-500">{newArrivals.length} yeni ürün</span>
            ) : null}
          </div>
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">Yeni gelen ürünler yükleniyor…</div>
          ) : newArrivals.length > 0 ? (
            <B2BProductRail products={newArrivals} loggedIn={loggedIn} title="Yeni Gelen Ürünler" />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
              {query.trim() ? "Aramanızla eşleşen yeni ürün bulunmuyor." : "Son 24 saatte eklenen yeni ürün bulunmuyor."}
            </div>
          )}
        </section>

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
            <p className="mt-1 text-sm text-slate-500">Çalışkan B2B ve onaylı tedarikçilerin tüm ürünleri · Yeni gelenler dahil</p>
          </div>
          {!isLoading && catalogProducts.length > 0 ? (
            <div className="text-sm text-slate-500">{catalogProducts.length} ürün</div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Ürünler yükleniyor…</div>
        ) : catalogProducts.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-semibold">Toptan ürün bulunamadı</h3>
            <p className="mt-1 text-sm text-slate-500">{query.trim() ? "Aramanızla eşleşen ürün bulunmuyor." : "Henüz listelenecek ürün bulunmuyor."}</p>
          </div>
        ) : (
          <div>
            <B2BProductRail products={catalogProducts} loggedIn={loggedIn} title="Toptan Ürünler" autoScroll />
          </div>
        )}
        </>}
      </main>
      {!isSearching && <B2BRoundCampaignButton config={homepage.roundBottomBanner}/>}
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
