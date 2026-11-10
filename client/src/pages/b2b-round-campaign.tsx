import {useEffect,useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {ArrowLeft,BadgeCheck,Clock3,Package,ShieldCheck,Sparkles, Umbrella, Zap} from "lucide-react";
import {B2BHeader} from "@/components/b2b-header";
import {B2BFooter} from "@/components/b2b-footer";
import {B2BFlashCampaignCard} from "@/components/b2b-flash-campaign-card";
import {campaignIsVisible} from "@/components/b2b-round-campaign-button";
import {b2bCategoryImage,loadB2BHomepageCategories,type B2BHomepageCategories} from "@/lib/b2b-categories";
import type {UnifiedB2BProduct} from "@/lib/b2b-marketplace-products";

async function loadCatalog():Promise<UnifiedB2BProduct[]>{
  const r=await fetch("/api/b2b/products",{credentials:"include",cache:"no-store"});
  if(!r.ok)throw Error("Ürün kataloğu yüklenemedi");
  const rows=await r.json();return Array.isArray(rows)?rows:[];
}
async function loadSession():Promise<boolean>{
  const r=await fetch("/api/auth/me",{credentials:"include"});
  if(!r.ok)return false;
  const user=await r.json();
  return user?.role==="b2b_customer"&&user?.isActive===true;
}
function remainingDuration(endAt:string,now:number){
  const diff=Math.max(0,new Date(endAt).getTime()-now);
  if(!Number.isFinite(diff))return null;
  return {
    days:Math.floor(diff/86400000),
    hours:Math.floor(diff%86400000/3600000),
    minutes:Math.floor(diff%3600000/60000),
    seconds:Math.floor(diff%60000/1000),
  };
}
function LiveCountdown({endAt,now,accent}:{endAt:string;now:number;accent:string}){
  const time=remainingDuration(endAt,now);
  if(!time)return null;
  const values=[
    ...(time.days>0?[{name:"GÜN",value:time.days}]:[]),
    {name:"SAAT",value:time.hours},
    {name:"DAKİKA",value:time.minutes},
    {name:"SANİYE",value:time.seconds},
  ];
  return <div className="rounded-2xl border border-white/15 bg-[#061021]/70 p-3 shadow-xl backdrop-blur-sm sm:p-4"
    aria-label="Kampanyanın bitmesine kalan süre">
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white sm:text-sm">
      <Clock3 className="h-5 w-5 shrink-0" style={{color:accent}}/>
      Kampanyanın bitmesine kalan süre
    </div>
    <div className="flex items-start justify-center gap-1.5 sm:gap-2">
      {values.map(({name,value})=><div key={name} className="min-w-0 text-center">
        <span className="flex min-w-[42px] justify-center rounded-lg border border-[#ffcc00] bg-[#10192c] px-2 py-2 text-xl font-black tabular-nums text-white shadow-[0_0_15px_rgba(255,205,0,.22)] sm:min-w-[61px] sm:text-3xl">{String(value).padStart(2,"0")}</span>
        <span className="mt-1 block text-[9px] font-bold text-slate-200">{name}</span>
      </div>)}
    </div>
  </div>;
}
export default function B2BRoundCampaign(){
  const {data:homepage,isLoading:loadingHome}=useQuery<B2BHomepageCategories>({
    queryKey:["/api/public/homepage"],queryFn:loadB2BHomepageCategories,staleTime:10000,
    refetchOnWindowFocus:true
  });
  const {data:products=[],isLoading:loadingProducts,isError}=useQuery({
    queryKey:["/api/b2b/products","campaign"],queryFn:loadCatalog,staleTime:15000
  });
  const {data:loggedIn=false}=useQuery({
    queryKey:["/api/auth/me","campaign"],queryFn:loadSession,staleTime:10000
  });
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const config=homepage?.roundBottomBanner;
  const active=campaignIsVisible(config)&&(!config?.endAt||new Date(config.endAt).getTime()>now);
  const assigned=useMemo(()=>{
    const byId=new Map(products.filter(p=>!p.marketplace).map(p=>[String(p.id),p]));
    return (config?.productIds||[]).map(id=>byId.get(String(id))).filter((p):p is UnifiedB2BProduct=>Boolean(p));
  },[products,config?.productIds]);
  const accent=config?.accentColor||"#FFCD00",background=config?.backgroundColor||"#0B1225";
  const text=config?.textColor||"#FFFFFF";
  const image=config?.heroImageId?b2bCategoryImage(config.heroImageId):null;
  const fullHero=Boolean(image&&config?.heroImageMode==="full");
  const liveTimer=Boolean(config?.showCountdown&&config.endAt);
  return <div className="min-h-screen bg-[#081226] text-white">
    <B2BHeader/>
    {loadingHome?<div className="mx-auto max-w-7xl px-5 py-16 text-center text-slate-300">Kampanya yükleniyor…</div>
      :!active?<main className="mx-auto max-w-6xl px-4 py-24 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-amber-400"/>
        <h1 className="mt-5 text-2xl font-black text-white">Bu kampanya şu anda yayında değil</h1>
        <p className="mt-2 text-slate-300">Güncel fırsatları ana sayfadaki ürünlerde bulabilirsiniz.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#ffcd00] px-5 py-3 font-black text-slate-950">
          <ArrowLeft size={17}/>Ana sayfaya dön
        </Link>
      </main>:<>
      <div className="relative overflow-hidden border-b border-[#5a6a83]/50" style={{backgroundColor:background}}>
        {fullHero?<div className="mx-auto max-w-[1800px]">
          <div className="relative">
            <img src={image!} alt={config!.title+" kampanya bannerı"}
              className="block h-auto w-full" fetchPriority="high"/>
            <Link href="/" aria-label="Ana sayfaya dön"
              className="absolute left-2 top-2 inline-flex h-[24%] max-h-16 w-[15%] min-w-14 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300">
              <span className="sr-only">Ana sayfaya dön</span>
            </Link>
          </div>
        </div>:<section className="relative mx-auto max-w-[1800px] overflow-hidden">
          {image&&<img src={image} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/>}
          <div className="absolute inset-0 bg-gradient-to-r from-[#071325]/95 via-[#071325]/78 to-[#071325]/30"/>
          <div className="pointer-events-none absolute -right-20 -top-40 h-[450px] w-[430px] rotate-45 bg-gradient-to-br from-yellow-300/55 via-amber-400/30 to-transparent blur-3xl" aria-hidden="true"/>
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-8 sm:px-6 sm:py-14 lg:min-h-[355px] lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center lg:gap-12">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-[#061021]/70 px-3 py-2 text-xs font-bold text-white hover:border-[#ffcd00]">
                  <ArrowLeft size={15}/> Ana sayfa
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black uppercase"
                  style={{borderColor:accent,color:accent,backgroundColor:"rgba(0,0,0,.36)"}}>
                  <Zap size={14} fill="currentColor"/> {config!.badgeText}
                </span>
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black uppercase italic leading-tight tracking-tight sm:text-4xl lg:text-5xl"
                style={{color:text,textShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{config!.title}</h1>
              <span className="mt-1 block h-1 max-w-[290px] rounded-full bg-gradient-to-r from-[#ffcd00] to-transparent shadow-[0_0_18px_#ffcd00]" aria-hidden="true"/>
              <p className="mt-4 max-w-3xl text-sm font-medium text-slate-200 sm:text-lg">{config!.subtitle}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black shadow-[0_0_18px_rgba(255,205,0,.24)]"
                  style={{borderColor:accent,color:accent,backgroundColor:"rgba(0,0,0,.25)"}}>
                  <Zap size={14} fill="currentColor"/> {config!.badgeText}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-[#071429]/60 px-3 py-2 text-xs font-bold text-white">
                  <Package size={14}/> {assigned.length} kampanya ürünü
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-[#071429]/60 px-3 py-2 text-xs font-bold text-white">
                  <ShieldCheck size={14}/> Çalışkan B2B
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-5 lg:items-end">
              {!image&&<div className="flex items-center gap-3 rounded-2xl border border-[#ffcd00]/80 bg-[#081327] px-5 py-4 shadow-[0_0_30px_rgba(255,205,0,.2)]">
                <Zap size={34} fill="currentColor" style={{color:accent}}/>
                <strong className="text-2xl font-black italic uppercase leading-7" style={{color:accent}}>FLASH<br/>KAMPANYA</strong>
              </div>}
              {liveTimer?<LiveCountdown endAt={config!.endAt} now={now} accent={accent}/>:
                <div className="inline-flex items-center gap-2 rounded-2xl border border-yellow-400/50 bg-[#061021]/50 px-4 py-3 text-sm font-bold text-yellow-300">
                  <Umbrella size={21}/> Özel kampanya ürünleri
                </div>}
            </div>
          </div>
        </section>}
      </div>
      <main className="relative mx-auto max-w-[1480px] px-3 pb-20 pt-9 sm:px-6 sm:pt-11">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#ffcd00]/[.035] to-transparent" aria-hidden="true"/>
        <div className="relative mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
          <div className="min-w-0">
            <h2 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              <span className="h-9 w-1.5 shrink-0 -skew-x-[22deg] bg-[#ffcd00] shadow-[0_0_16px_rgba(255,205,0,.7)]" aria-hidden="true"/>
              Kampanya Ürünleri
            </h2>
            <p className="mt-2 pl-4 text-xs text-slate-300 sm:text-sm">
              Kampanyaya özel seçilen ürünler, belirlenen sırayla görüntülenir.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#ffcd00]/60 bg-[#101d30] px-4 py-3 text-xs font-bold text-white">
            <Umbrella className="h-5 w-5 text-[#ffcd00]"/>
            <span>Çalışkan B2B'ye Özel<br/><strong style={{color:accent}}>{config!.title}</strong></span>
          </div>
        </div>
        {loadingProducts?<div className="rounded-2xl border border-slate-700 bg-[#111e33] p-12 text-center text-slate-300">Ürünler yükleniyor…</div>:
          isError?<div className="rounded-2xl border border-rose-500/50 bg-[#111e33] p-12 text-center text-rose-200">Ürün kataloğuna erişilemiyor. Sayfayı yenileyin.</div>:
          !assigned.length?<div className="rounded-2xl border border-[#56647d] bg-[#142136] p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-yellow-400"/>
            <p className="mt-4 font-bold text-white">Henüz yayında kampanya ürünü bulunmuyor.</p>
          </div>:
          <div className={config!.cardStyle==="compact"
            ?"grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            :"grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4"}>
            {assigned.map(product=><B2BFlashCampaignCard key={String(product.id)}
              product={product} loggedIn={loggedIn} showPrice={config!.showPrices} accent={accent}/>)}
          </div>}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#435268]/65 pt-5 text-xs text-slate-300">
          <div className="inline-flex items-center gap-2"><BadgeCheck size={16} className="text-green-400"/> Çalışkan B2B onaylı ürünler</div>
          <span>{assigned.length} kampanya ürünü</span>
        </div>
      </main>
    </>}
    <B2BFooter/>
  </div>;
}
