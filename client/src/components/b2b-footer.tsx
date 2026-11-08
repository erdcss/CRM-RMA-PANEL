import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Instagram, Facebook, Youtube, Music2, ExternalLink, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";

export type StoreLinks = Record<
  "instagram" | "facebook" | "youtube" | "tiktok" |
  "appStoreUrl" | "googlePlayUrl" | "appStoreImage" | "googlePlayImage" |
  "appStoreBannerTitle" | "appStoreBannerText" | "appStoreBannerImage" | "appStoreBannerButton" |
  "googlePlayBannerTitle" | "googlePlayBannerText" | "googlePlayBannerImage" | "googlePlayBannerButton" |
  "downloadHeaderTitle" | "downloadHeaderText" | "latestIosVersion" | "latestAndroidVersion", string>;
export const emptyStoreLinks: StoreLinks = {
  instagram:"",facebook:"",youtube:"",tiktok:"",
  appStoreUrl:"",googlePlayUrl:"",appStoreImage:"",googlePlayImage:"",
  appStoreBannerTitle:"",appStoreBannerText:"",appStoreBannerImage:"",appStoreBannerButton:"",
  googlePlayBannerTitle:"",googlePlayBannerText:"",googlePlayBannerImage:"",googlePlayBannerButton:"",
  downloadHeaderTitle:"",downloadHeaderText:"",latestIosVersion:"",latestAndroidVersion:"",
};
export function useStoreLinks() {
  return useQuery<StoreLinks>({ queryKey:["/api/public/b2b-footer"], queryFn:async () => {
    const r = await fetch("/api/public/b2b-footer"); if (!r.ok) return emptyStoreLinks;
    return { ...emptyStoreLinks, ...await r.json() };
  }, staleTime: 60000 });
}
export const footerGroups = [
  { title:"Çalışkan", links:[["Biz Kimiz", "/hakkimizda"],["İletişim", "/iletisim"]] },
  { title:"Kampanyalar ve İndirimler", links:[["Kampanyalar", "/kampanyalar"],["Avantajlı Alışveriş", "/?firsatlar=1"]] },
  { title:"Satıcı", links:[["Onaylı Tedarikçi Mağazaları", "/magazalar"],["Tedarikçi Paneli / Başvuru", "https://pazaryeri.ecalisgan.com"],["Çalışkan Akademi", "/akademi"]] },
  { title:"Yardım", links:[["Sık Sorulan Sorular", "/destek#faq-heading"],["Destek Talebi", "/hesabim?tab=support"],["Gizlilik Politikası ve KVKK", "/privacy"],["Kullanım Koşulları", "/kullanim-kosullari"],["Nasıl İade Ederim?", "/destek#iade"]] },
] as const;
export function B2BSocialAndStores({ compact = false }: { compact?:boolean }) {
  const { data } = useStoreLinks(); const urls = data || emptyStoreLinks;
  const social = [
    { key:"instagram", Icon:Instagram, title:"Instagram" },
    { key:"facebook", Icon:Facebook, title:"Facebook" },
    { key:"youtube", Icon:Youtube, title:"YouTube" },
    { key:"tiktok", Icon:Music2, title:"TikTok" },
  ] as const;
  const stores = [{ title:"App Store", href:urls.appStoreUrl, image:urls.appStoreImage },{ title:"Google Play", href:urls.googlePlayUrl, image:urls.googlePlayImage }];
  return <div className={compact ? "space-y-4" : "bg-[#0b0b0b] text-white"}>
    <div className={compact ? "space-y-4" : "mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 md:flex-row md:items-center md:justify-between"}>
      <div className="flex flex-wrap items-center gap-3">
        {social.map(({key,Icon,title}) => urls[key] ? <a key={key} href={urls[key]} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-[#ffcc00] transition hover:border-[#ffcc00] hover:bg-white/10"><Icon className="h-5 w-5"/></a>:null)}
      </div>
      <div className="flex flex-wrap gap-3">
        {stores.map(store => store.href ? <a key={store.title} href={store.href} target="_blank" rel="noopener noreferrer" aria-label={store.title} className="flex min-h-12 min-w-32 items-center justify-center rounded-xl border border-white/25 bg-[#181818] px-3 py-2 text-sm font-bold text-white transition hover:border-[#ffcc00]">{store.image ? <img src={store.image} alt={store.title} className="h-10 max-w-40 object-contain"/> : <><ExternalLink className="mr-2 h-4 w-4 text-[#ffcc00]"/>{store.title}</>}</a> : null)}
      </div>
    </div>
  </div>;
}
export function B2BFooter() {
  const [open,setOpen]=useState<string | null>(null);
  return <footer className="mt-12 border-t border-[#e6e2d6] bg-[#f8f8f6] text-[#171717]">
    <div className="mx-auto grid max-w-6xl grid-cols-1 px-4 py-9 md:grid-cols-4 md:gap-8 md:py-14">
      {footerGroups.map(group => <section key={group.title} className="border-b border-black/10 py-2 md:border-0 md:py-0">
        <button type="button" className="flex min-h-12 w-full items-center justify-between text-left text-base font-extrabold md:pointer-events-none" aria-expanded={open===group.title} onClick={()=>setOpen(open===group.title?null:group.title)}>
          {group.title}<ChevronDown className={`h-5 w-5 text-[#c99f00] transition-transform md:hidden ${open===group.title?"rotate-180":""}`}/>
        </button>
        <div className={`${open===group.title?"block":"hidden"} pb-3 md:block md:pb-0`}>
          {group.links.map(([title,path])=>path.startsWith("https://")?
            <a key={title} href={path} className="block py-2 text-sm text-[#505050] transition-colors hover:text-[#c89b00]">{title}</a>:
            <Link key={title} href={path} className="block py-2 text-sm text-[#505050] transition-colors hover:text-[#c89b00]">{title}</Link>)}
        </div>
      </section>)}
    </div>
    <B2BSocialAndStores/>
    <div className="bg-[#080808] px-4 pb-5 text-center text-xs text-white/50">© {new Date().getFullYear()} Çalışkan B2B · Tüm hakları saklıdır. <button type="button" className="ml-3 underline underline-offset-2 hover:text-white" onClick={()=>window.dispatchEvent(new Event("caliskan-meta-open-consent"))}>Reklam ve çerez tercihleri</button></div>
  </footer>;
}

/** The mobile web smart banner uses only the official app icon and store URLs saved in Admin.
 * The platform is detected on the device; never send an Android user to the App Store
 * (or an iOS user to Google Play) when that platform's link is missing.
 */
export function B2BMobileDownloadHeader() {
  const { data: links } = useStoreLinks();
  const { data: branding } = useBranding();
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.sessionStorage.getItem("b2b-mobile-install-banner-dismissed") === "1"; }
    catch { return false; }
  });

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    setPlatform(isIOS ? "ios" : /Android/i.test(ua) ? "android" : null);
  }, []);

  const storeUrl = platform === "ios" ? links?.appStoreUrl :
    platform === "android" ? links?.googlePlayUrl : null;
  if (dismissed || !storeUrl) return null;

  const appIcon = branding?.b2b_mobile_android_icon ||
    branding?.b2b_mobile_logo || branding?.b2b_favicon;
  const closeBanner = () => {
    setDismissed(true);
    try { window.sessionStorage.setItem("b2b-mobile-install-banner-dismissed", "1"); }
    catch { /* Private browsing may block storage; in-page dismissal still works. */ }
  };

  return (
    <aside
      aria-label="Çalışkan B2B mobil uygulamasını indir"
      className="flex min-h-[88px] w-full items-center gap-2 border-b border-[#e8e8e8] bg-white px-2.5 py-2 text-[#171717] shadow-sm md:hidden"
    >
      <button
        type="button"
        onClick={closeBanner}
        aria-label="Uygulama indirme bannerını kapat"
        className="flex h-10 w-6 shrink-0 items-center justify-center rounded-md text-[#333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcc00]"
      >
        <X className="h-5 w-5" />
      </button>
      {appIcon ? (
        <img
          src={appIcon}
          alt="Çalışkan B2B uygulama logosu"
          className="h-14 w-14 shrink-0 rounded-[14px] bg-[#ffcc00] object-contain shadow-sm"
        />
      ) : (
        <span aria-label="Çalışkan B2B" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#ffcc00] text-center text-[13px] font-black leading-4 text-[#111]">Çalışkan<br/>B2B</span>
      )}
      <div className="min-w-0 flex-1 pl-0.5">
        <p className="truncate text-[13px] font-extrabold leading-5 text-[#171717]">
          {links?.downloadHeaderTitle || "Hızlı. Kolay. Avantajlı."}
        </p>
        <p className="line-clamp-2 text-[11px] leading-[15px] text-[#444]">
          {links?.downloadHeaderText || "Çalışkan B2B ile toptan alışveriş cebinde."}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#6d6d6d]">
          {platform === "ios" ? "iPhone için App Store" : "Android için Google Play"}
        </p>
      </div>
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={platform === "ios" ? "Çalışkan B2B uygulamasını App Store'dan indir" : "Çalışkan B2B uygulamasını Google Play'den indir"}
        className="flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[#ffcc00] px-3.5 text-[13px] font-black text-[#111] shadow-sm transition hover:bg-[#f3bf00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111]"
      >
        İndir
      </a>
    </aside>
  );
}

/** Narrow, fixed right-hand promotions, designed for wide desktop viewports. */
export function B2BDesktopAppBanners() {
  const {data:links} = useStoreLinks();
  if(!links)return null;
  const items=[
    {id:"ios",name:"App Store",url:links.appStoreUrl,title:links.appStoreBannerTitle || "iPhone'da B2B",text:links.appStoreBannerText || "Mobil uygulamamızı keşfedin",image:links.appStoreBannerImage || links.appStoreImage,button:links.appStoreBannerButton || "İndir"},
    {id:"android",name:"Google Play",url:links.googlePlayUrl,title:links.googlePlayBannerTitle || "Android'de B2B",text:links.googlePlayBannerText || "Her yerden alışveriş",image:links.googlePlayBannerImage || links.googlePlayImage,button:links.googlePlayBannerButton || "İndir"},
  ].filter(item=>Boolean(item.url));
  if(!items.length)return null;
  return <aside aria-label="Mobil uygulama indirme bannerları" className="pointer-events-none fixed right-1 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 xl:flex 2xl:right-3">
    {items.map(item=><a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
      className="pointer-events-auto flex min-h-[195px] w-[86px] 2xl:min-h-[212px] 2xl:w-[116px] flex-col items-center justify-between overflow-hidden rounded-[21px] border border-[#ffcd00]/40 bg-[#111827] px-2 py-3 text-center text-white shadow-2xl transition hover:scale-[1.03] hover:border-[#ffcd00]">
      <span className="text-[10px] font-black text-[#ffcd00]">{item.name}</span>
      {item.image ? <img src={item.image} alt={item.name+" görseli"} className="h-[65px] w-[70px] rounded-xl object-contain 2xl:h-[84px] 2xl:w-[94px]"/> : <span className="flex h-[65px] w-[70px] items-center justify-center 2xl:h-[84px] 2xl:w-[94px] rounded-xl border border-white/20 text-4xl">↧</span>}
      <div className="w-full"><div className="text-xs font-black leading-4">{item.title}</div><div className="mt-1 text-[10px] leading-3 text-slate-300">{item.text}</div></div>
      <span className="mt-2 w-full rounded-lg bg-[#ffcd00] px-2 py-1.5 text-[11px] font-black text-slate-950">{item.button}</span>
    </a>)}
  </aside>;
}
