import type {HomeBanner} from './api';

export const BANNER_PAGES=[
  '/(tabs)','/(tabs)/products','/(tabs)/discover','/(tabs)/menu',
  '/ledger','/notifications',
] as const;

export type BannerDestination=
  | {kind:'product';id:string}
  | {kind:'page';path:string}
  | {kind:'url';url:string}
  | null;

/** A visible banner is interactive only with a validated target. */
export function bannerDestination(banner:HomeBanner):BannerDestination {
  if(banner.linkType==='product'){
    const id=Number(banner.productId);
    return Number.isSafeInteger(id)&&id>0?{kind:'product',id:String(id)}:null;
  }
  if(banner.linkType==='page'&&
    (BANNER_PAGES as readonly string[]).includes(banner.pagePath||'')){
    return {kind:'page',path:banner.pagePath!};
  }
  if(banner.linkType==='url'){
    try{
      const url=new URL(banner.externalUrl||'');
      if(url.protocol==='https:'&&!url.username&&!url.password&&
         url.hostname&&!/^localhost$/i.test(url.hostname)&&
         !/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)){
        return {kind:'url',url:url.toString()};
      }
    }catch{/* not a URL */}
  }
  return null;
}

// Slightly taller 3.6:1 hero frame; keeps responsive sizing and stable slide heights.
export function bannerDisplayHeight(width:number):number{
  if(!Number.isFinite(width)||width<=0)return 0;
  return Math.max(1,Math.round(width/3.6));
}
