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
  "downloadHeaderTitle" | "downloadHeaderText" | "latestIosVersion" | "latestAndroidVersion" |
  "footerBannerUrl", string>;
export const emptyStoreLinks: StoreLinks = {
  instagram:"",facebook:"",youtube:"",tiktok:"",
  appStoreUrl:"",googlePlayUrl:"",appStoreImage:"",googlePlayImage:"",
  appStoreBannerTitle:"",appStoreBannerText:"",appStoreBannerImage:"",appStoreBannerButton:"",
  googlePlayBannerTitle:"",googlePlayBannerText:"",googlePlayBannerImage:"",googlePlayBannerButton:"",
  downloadHeaderTitle:"",downloadHeaderText:"",latestIosVersion:"",latestAndroidVersion:"",
  footerBannerUrl:"",
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
export function B2BSocialAndStores({
  compact = false,
  bannerImage,
  bannerUrl,
}: {
  compact?: boolean;
  bannerImage?: string | null;
  bannerUrl?: string | null;
}) {
  const { data } = useStoreLinks();
  const urls = data || emptyStoreLinks;
  const social = [
    { key: "instagram", Icon: Instagram, title: "Instagram" },
    { key: "facebook", Icon: Facebook, title: "Facebook" },
    { key: "youtube", Icon: Youtube, title: "YouTube" },
    { key: "tiktok", Icon: Music2, title: "TikTok" },
  ] as const;
  const stores = [
    { title: "App Store", href: urls.appStoreUrl, image: urls.appStoreImage },
    { title: "Google Play", href: urls.googlePlayUrl, image: urls.googlePlayImage },
  ].filter(store => Boolean(store.href));

  const storeBadges = stores.length ? (
    <div className={compact ? "flex flex-wrap gap-3" : "flex flex-wrap items-center justify-end gap-3"}>
      {stores.map(store => (
        <a key={store.title} href={store.href} target="_blank" rel="noopener noreferrer"
          aria-label={store.title}
          className="flex min-h-12 min-w-32 items-center justify-center rounded-xl border border-white/25 bg-[#181818] px-3 py-2 text-sm font-bold text-white transition hover:border-[#ffcc00]">
          {store.image
            ? <img src={store.image} alt={store.title} className="h-10 max-w-40 object-contain"/>
            : <><ExternalLink className="mr-2 h-4 w-4 text-[#ffcc00]"/>{store.title}</>}
        </a>
      ))}
    </div>
  ) : null;

  const banner = !compact && bannerImage ? (
    bannerUrl ? (
      <a href={bannerUrl} target="_blank" rel="noopener noreferrer"
        aria-label="Çalışkan B2B WhatsApp destek bannerını aç"
        className="relative block aspect-[6/1] w-full min-w-0 max-w-[410px] flex-1 overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcc00]">
        <img src={bannerImage} alt="Çalışkan B2B WhatsApp destek hattı"
          loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"/>
      </a>
    ) : (
      <div className="relative aspect-[6/1] w-full min-w-0 max-w-[410px] flex-1 overflow-hidden rounded-md">
        <img src={bannerImage} alt="Çalışkan B2B WhatsApp destek hattı"
          loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"/>
      </div>
    )
  ) : null;

  return (
    <div className={compact ? "space-y-4" : "bg-[#0b0b0b] text-white"}>
      <div className={compact
        ? "space-y-4"
        : "mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 md:py-4"}>
        <div className={compact
          ? "flex flex-wrap items-center gap-3"
          : "flex w-full min-w-0 items-center justify-between gap-2 sm:gap-4"}>
          <div className={compact
            ? "flex flex-wrap items-center gap-3"
            : "flex shrink-0 items-center gap-1.5 sm:gap-3"}>
            {social.map(({ key, Icon, title }) => urls[key] ? (
              <a key={key} href={urls[key]} target="_blank" rel="noopener noreferrer"
                title={title} aria-label={title}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 text-[#ffcc00] transition hover:border-[#ffcc00] hover:bg-white/10 sm:h-11 sm:w-11 sm:rounded-xl">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5"/>
              </a>
            ) : null)}
          </div>
          {banner || (!compact && storeBadges)}
        </div>
        {compact ? storeBadges : banner ? storeBadges : null}
      </div>
    </div>
  );
}
export function B2BFooter() {
  const [open,setOpen]=useState<string | null>(null);
  const {data:branding}=useBranding();
  const {data:footerLinks}=useStoreLinks();
  const bannerImage=branding?.b2b_footer_banner;
  const bannerUrl=footerLinks?.footerBannerUrl?.trim();
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
    <B2BSocialAndStores bannerImage={bannerImage} bannerUrl={bannerUrl}/>
    <div className="bg-[#080808] px-4 pb-5 text-center text-xs text-white/50">© {new Date().getFullYear()} Çalışkan B2B · Tüm hakları saklıdır. <button type="button" className="ml-3 underline underline-offset-2 hover:text-white" onClick={()=>window.dispatchEvent(new Event("caliskan-meta-open-consent"))}>Çerez izni</button></div>
  </footer>;
}

/** Compact, reload-safe mobile install banner.
 * Always fetch the real app icon from the admin-managed branding asset endpoint,
 * without briefly showing a generated text logo while the branding query loads.
 */
function detectMobileStore(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

const B2B_APP_ICON_SOURCES = [
  "/api/public/branding-asset/b2b_mobile_logo",
  "/api/public/branding-asset/b2b_mobile_android_icon",
  "/api/public/branding-asset/b2b_favicon",
  "/api/public/branding-asset/b2b_logo",
] as const;

export function B2BMobileDownloadHeader() {
  const { data: links, isLoading } = useStoreLinks();
  const [platform, setPlatform] = useState<"ios" | "android" | null>(detectMobileStore);
  const [dismissed, setDismissed] = useState(false);
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => { setPlatform(detectMobileStore()); }, []);

  const officialIosStore = "https://apps.apple.com/tr/app/%C3%A7al%C4%B1%C5%9Fkan-b2b/id6802286663";
  const iosUrl = links?.appStoreUrl || officialIosStore;
  const androidUrl = links?.googlePlayUrl || "";
  const storeUrl = platform === "ios" ? iosUrl : platform === "android" ? androidUrl : "";
  const storeName = platform === "ios" ? "App Store" :
    platform === "android" ? "Google Play" : "uygulama mağazası";

  if (dismissed) return null;

  return (
    <aside
      aria-label="Çalışkan B2B uygulamasını indir"
      className="grid w-full min-w-0 max-w-full grid-cols-[24px_48px_minmax(0,1fr)_64px] items-center gap-2 overflow-hidden border-b border-[#e7e7e7] bg-white px-2 py-2 text-[#171717] shadow-sm md:hidden"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Uygulama indirme bannerını kapat"
        className="flex h-10 w-6 items-center justify-center rounded-md text-[#333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcc00]"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#ffcc00] shadow-sm">
        {iconIndex < B2B_APP_ICON_SOURCES.length ? (
          <img
            key={iconIndex}
            src={B2B_APP_ICON_SOURCES[iconIndex]}
            onError={() => setIconIndex(index => Math.min(index + 1, B2B_APP_ICON_SOURCES.length))}
            alt="Çalışkan B2B uygulama logosu"
            loading="eager"
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-label="Çalışkan B2B" className="flex h-full w-full items-center justify-center text-xl font-black text-[#111]">Ç</span>
        )}
      </div>
      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-[12px] font-extrabold leading-[17px] text-[#171717]">
          {links?.downloadHeaderTitle || "Hızlı. Kolay. Avantajlı."}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-[10px] leading-[14px] text-[#444]">
          {links?.downloadHeaderText || "Çalışkan B2B uygulamasını indir, toptan alışverişi kolaylaştır."}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#666]">
          {platform === null ? "iPhone ve Android" : storeName}
        </p>
      </div>
      {storeUrl ? (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Çalışkan B2B uygulamasını ${storeName} üzerinden indir`}
          className="flex h-9 w-16 items-center justify-center rounded-full bg-[#ffcc00] text-[12px] font-black text-[#111] shadow-sm transition hover:bg-[#f3bf00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111]"
        >İndir</a>
      ) : platform === null ? (
        <div className="flex w-16 flex-col gap-1 text-[9px] font-bold">
          {links?.appStoreUrl && <a className="rounded-lg bg-[#ffcc00] px-1 py-1 text-center text-[#111]" href={links.appStoreUrl} target="_blank" rel="noopener noreferrer">App Store</a>}
          {links?.googlePlayUrl && <a className="rounded-lg bg-[#ffcc00] px-1 py-1 text-center text-[#111]" href={links.googlePlayUrl} target="_blank" rel="noopener noreferrer">Google Play</a>}
          {!links?.appStoreUrl && !links?.googlePlayUrl && <span className="text-center text-[#777]">Mağaza seç</span>}
        </div>
      ) : (
        <span aria-live="polite" className="w-16 text-center text-[9px] font-semibold leading-3 text-[#777]">
          {isLoading ? "Yükleniyor" : "Bağlantı bekleniyor"}
        </span>
      )}
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
