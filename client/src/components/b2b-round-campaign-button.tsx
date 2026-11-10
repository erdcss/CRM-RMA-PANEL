import {Link} from "wouter";
import {Sparkles} from "lucide-react";
import {b2bCategoryImage,type RoundBottomBanner} from "@/lib/b2b-categories";

export function campaignIsVisible(config?:RoundBottomBanner):boolean{
  return Boolean(config?.enabled&&config.imageId&&Array.isArray(config.productIds)&&config.productIds.length&&
    (!config.endAt||new Date(config.endAt).getTime()>Date.now()));
}

/** One fixed, tappable circular asset in the lower-right corner. */
export function B2BRoundCampaignButton({config}:{config?:RoundBottomBanner}){
  if(!campaignIsVisible(config)||!config)return null;
  const image=b2bCategoryImage(config.imageId);
  const diameter=Math.max(56,Math.min(128,Number(config.circleSize)||84));
  return <Link href="/kampanyalar" aria-label={config.buttonText||config.title||"Kampanyalar"}
    title={config.buttonText||config.title}
    className="group fixed right-4 z-[65] flex items-center justify-center rounded-full border-[3px] shadow-[0_10px_32px_rgba(0,0,0,.35)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-400 sm:right-6 md:bottom-7"
    style={{width:diameter,height:diameter,bottom:Math.max(90,Math.min(240,Number(config.bottomOffset)||112)),borderColor:config.accentColor,backgroundColor:config.backgroundColor}}>
    <span className="absolute -inset-1 rounded-full border border-amber-400/40 motion-safe:animate-pulse" aria-hidden="true"/>
    {image?<img src={image} alt="" className="h-full w-full rounded-full object-cover" loading="eager" />:
      <Sparkles className="h-7 w-7" style={{color:config.accentColor}}/>}
    <span className="sr-only">{config.buttonText||"Flash ürünleri keşfet"}</span>
  </Link>;
}
