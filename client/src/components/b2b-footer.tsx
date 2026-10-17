import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Instagram, Facebook, Youtube, Music2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export type StoreLinks = Record<"instagram" | "facebook" | "youtube" | "tiktok" | "appStoreUrl" | "googlePlayUrl" | "appStoreImage" | "googlePlayImage", string>;
export const emptyStoreLinks: StoreLinks = { instagram:"", facebook:"", youtube:"", tiktok:"", appStoreUrl:"", googlePlayUrl:"", appStoreImage:"", googlePlayImage:"" };
export function useStoreLinks() {
  return useQuery<StoreLinks>({ queryKey:["/api/public/b2b-footer"], queryFn:async () => {
    const r = await fetch("/api/public/b2b-footer"); if (!r.ok) return emptyStoreLinks;
    return { ...emptyStoreLinks, ...await r.json() };
  }, staleTime: 60000 });
}
export const footerGroups = [
  { title:"Çalışkan", links:[["Biz Kimiz", "/hakkimizda"],["İletişim", "/iletisim"]] },
  { title:"Kampanyalar ve İndirimler", links:[["Kampanyalar", "/kampanyalar"],["Avantajlı Alışveriş", "/?firsatlar=1"]] },
  { title:"Satıcı", links:[["Tedarikçi Paneli / Başvuru", "https://pazaryeri.ecalisgan.com"],["Çalışkan Akademi", "/akademi"]] },
  { title:"Yardım", links:[["Sık Sorulan Sorular", "/destek#faq-heading"],["Destek Talebi", "/hesabim?tab=support"],["Nasıl İade Ederim?", "/destek#iade"]] },
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
    <div className="bg-[#080808] px-4 pb-5 text-center text-xs text-white/50">© {new Date().getFullYear()} Çalışkan B2B · Tüm hakları saklıdır.</div>
  </footer>;
}
