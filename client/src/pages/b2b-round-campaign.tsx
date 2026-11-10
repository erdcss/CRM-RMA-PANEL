import {useEffect,useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {ArrowLeft,Clock3,Package,ShieldCheck,Sparkles} from "lucide-react";
import {B2BHeader} from "@/components/b2b-header";
import {B2BFooter} from "@/components/b2b-footer";
import {B2BProductCard} from "@/components/b2b-product-card";
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
function timeLeft(endAt:string,now:number){
  const diff=Math.max(0,new Date(endAt).getTime()-now);
  if(!Number.isFinite(diff)||diff<=0)return "Kampanya sona erdi";
  const days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000);
  const mins=Math.floor(diff%3600000/60000),secs=Math.floor(diff%60000/1000);
  return (days?days+"g ":"")+[hours,mins,secs].map(v=>String(v).padStart(2,"0")).join(":");
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
  return <div className="min-h-screen bg-[#f6f7fb]">
    <B2BHeader/>
    {loadingHome?<div className="mx-auto max-w-6xl p-12 text-center text-slate-500">Kampanya yükleniyor…</div>
      :!active?<main className="mx-auto max-w-6xl px-4 py-20 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-amber-500"/>
        <h1 className="mt-5 text-2xl font-black">Bu kampanya şu anda yayında değil</h1>
        <p className="mt-2 text-slate-500">Güncel fırsatları ana sayfadaki ürünlerde bulabilirsiniz.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"><ArrowLeft size={17}/>Ana sayfaya dön</Link>
      </main>:<>
      <section className="relative overflow-hidden" style={{background,color:text}}>
        {image&&<div className="absolute inset-0 opacity-30"><img src={image} alt="" className="h-full w-full object-cover"/></div>}
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-9 sm:pb-20 sm:pt-12">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft size={17}/>Ana sayfa</Link>
          <div className="mt-9 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black tracking-wide" style={{color:accent,borderColor:accent,backgroundColor:'rgba(0,0,0,.22)'}}>
            <Sparkles size={15}/>{config!.badgeText}
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{config!.title}</h1>
          <p className="mt-4 max-w-2xl text-base opacity-85 sm:text-lg">{config!.subtitle}</p>
          {config!.showCountdown&&config!.endAt&&<div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-black/30 px-4 py-3 font-bold tabular-nums">
            <Clock3 size={18} style={{color:accent}}/>Kalan süre: {timeLeft(config!.endAt,now)}
          </div>}
          <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
            <span className="rounded-full border border-white/25 px-3 py-2">{assigned.length} kampanya ürünü</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-2"><ShieldCheck size={16}/>Çalışkan B2B</span>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="mb-7 flex items-end justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-950 sm:text-2xl">Kampanya Ürünleri</h2>
          <p className="mt-1 text-sm text-slate-500">Admin tarafından seçilen ürünler, belirlenen sırayla görüntülenir.</p></div>
          <span className="text-sm font-semibold text-slate-500">{assigned.length} ürün</span>
        </div>
        {loadingProducts?<div className="rounded-2xl bg-white p-12 text-center text-slate-500">Ürünler yükleniyor…</div>:
          isError?<div className="rounded-2xl bg-white p-12 text-center text-rose-600">Ürün kataloğuna erişilemiyor. Sayfayı yenileyin.</div>:
          !assigned.length?<div className="rounded-2xl border bg-white p-12 text-center"><Package className="mx-auto h-12 w-12 text-slate-300"/>
            <p className="mt-4 font-bold">Henüz yayında kampanya ürünü bulunmuyor.</p>
          </div>:
          <div className={config!.cardStyle==="compact"
            ?"grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5"
            :"grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
            {assigned.map(product=><B2BProductCard key={String(product.id)} product={product} loggedIn={loggedIn} showPrice={config!.showPrices}/>)}
          </div>}
      </main>
    </>}
    <B2BFooter/>
  </div>;
}
