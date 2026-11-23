import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import { trackSearch } from "@/lib/analytics";
import { Search, Package, BadgeCheck, Store, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter, B2BDesktopAppBanners } from "@/components/b2b-footer";
import { B2BProductRail } from "@/components/b2b-product-rail";
import { loadApprovedSupplierProducts, type UnifiedB2BProduct } from "@/lib/b2b-marketplace-products";
import { loadB2BHomepageCategories, b2bCategoryImage, type HomeBanner, type B2BHomepageCategories } from "@/lib/b2b-categories";
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

      <HomepageBanners homepage={homepage}/>
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
            <B2BProductRail products={offers} loggedIn={loggedIn} title={campaign.title} autoScroll/>
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
            <B2BProductRail products={newArrivals} loggedIn={loggedIn} title="Yeni Gelen Ürünler" autoScroll />
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

function bannerHref(banner:HomeBanner):string|null {
  if(banner.linkType==="product" && Number.isSafeInteger(Number(banner.productId)) && Number(banner.productId)>0)return "/urun/"+Number(banner.productId);
  if(banner.linkType==="page"){
    const pages:Record<string,string>={"/(tabs)":"/","/(tabs)/products":"/#urunler","/(tabs)/discover":"/kategoriler","/(tabs)/menu":"/hesabim"};
    return pages[banner.pagePath||""]||null;
  }
  if(banner.linkType==="url")try{const url=new URL(banner.externalUrl||"");if(url.protocol==="https:"&&!url.username&&!url.password)return url.href;}catch{}
  return null;
}
function HomepageBanners({homepage}:{homepage:B2BHomepageCategories}){
  const banners=homepage.banners||[];
  const [index,setIndex]=useState(0);
  const rail=useRef<HTMLDivElement>(null);
  const pauseUntil=useRef(0);
  const [playing,setPlaying]=useState(true);
  const go=(next:number)=>{
    const el=rail.current;
    if(!el||!banners.length)return;
    el.scrollTo({left:next*el.clientWidth,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  };
  useEffect(()=>{
    if(!playing||homepage.sliderAutoPlay===false||banners.length<2)return;
    const timer=window.setInterval(()=>{
      if(document.hidden||Date.now()<pauseUntil.current||rail.current?.contains(document.activeElement)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      const el=rail.current;if(!el||!el.clientWidth)return;
      go((Math.round(el.scrollLeft/el.clientWidth)+1)%banners.length);
    },Math.max(2000,homepage.sliderIntervalMs||5000));
    return ()=>window.clearInterval(timer);
  },[banners.length,homepage.sliderAutoPlay,homepage.sliderIntervalMs,playing]);
  if(!banners.length)return null;
  return <section aria-label="Kampanya bannerları" className="mx-auto max-w-6xl px-4 pb-2">
    <div ref={rail} onScroll={()=>{const el=rail.current;if(el?.clientWidth)setIndex(Math.min(banners.length-1,Math.round(el.scrollLeft/el.clientWidth)));}} onPointerDown={()=>{pauseUntil.current=Date.now()+8000;}} onTouchStart={()=>{pauseUntil.current=Date.now()+8000;}} className="flex items-start snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {banners.map((banner,i)=>{
        const href=bannerHref(banner);
        const image=<img src={b2bCategoryImage(banner.imageId)||undefined} alt={banner.title||"Çalışkan B2B kampanya görseli"} width={banner.imageWidth||undefined} height={banner.imageHeight||undefined} className="block h-auto w-full object-contain" loading={i===0?"eager":"lazy"}/>;
        return <div key={banner.id||banner.imageId} className="w-full shrink-0 snap-start overflow-hidden rounded-2xl">{href?<a href={href} className="block">{image}</a>:image}</div>;
      })}
    </div>
    {banners.length>1&&<div className="mt-2 flex flex-wrap items-center justify-center gap-2">{banners.map((b,i)=><button key={b.id||b.imageId} type="button" aria-label={`Banner ${i+1}`} aria-current={index===i} onClick={()=>{pauseUntil.current=Date.now()+8000;go(i);}} className={`h-2.5 rounded-full ${index===i?"w-6 bg-[#ffcc00]":"w-2.5 bg-slate-300"}`}/>)}<button type="button" onClick={()=>setPlaying(v=>!v)} className="ml-2 text-xs text-slate-600">{playing?"Duraklat":"Başlat"}</button></div>}
  </section>;
}
