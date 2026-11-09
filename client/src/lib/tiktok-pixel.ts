/** TikTok Pixel for Çalışkan B2B public storefront.
 * Uses the visitor's own TikTok consent, separately from any previously granted Meta consent.
 * No TikTok SDK is requested until explicit opt-in.
 */
export const B2B_TIKTOK_PIXEL_ID="DBOP5BRC77UASCMHAQ7G";
const CONSENT_KEY="caliskan_b2b_tiktok_consent_v1";
const SDK_URL="https://analytics.tiktok.com/i18n/pixel/events.js";
const METHODS=[
  "page","track","identify","instances","debug","on","off","once","ready",
  "alias","group","enableCookie","disableCookie","holdConsent",
  "revokeConsent","grantConsent",
] as const;
type Method=typeof METHODS[number];
type PixelQueue=Array<unknown[]> & Partial<Record<Method,(...args:unknown[])=>void>> & {
  load?:(pixelId:string,options?:Record<string,unknown>)=>void;
  instance?:(pixelId:string)=>PixelQueue;
  _i?:Record<string,PixelQueue>;
  _t?:Record<string,number>;
  _o?:Record<string,Record<string,unknown>>;
  _u?:string;
};
type TikTokWindow=Window & {ttq?:PixelQueue;TiktokAnalyticsObject?:string};
let activePixelId="";
let lastPageKey="";
let lastPageAt=0;
let scriptAdded=false;

export function tiktokConsent():"granted"|"denied"|null{
  try{
    const value=window.localStorage.getItem(CONSENT_KEY);
    return value==="granted"||value==="denied"?value:null;
  }catch{return null;}
}
export function setTiktokConsent(approved:boolean){
  try{window.localStorage.setItem(CONSENT_KEY,approved?"granted":"denied");}catch{}
  const queue=(window as TikTokWindow).ttq;
  if(queue){
    if(approved)queue.grantConsent?.();
    else queue.revokeConsent?.();
  }
  window.dispatchEvent(new Event("caliskan-tiktok-consent-change"));
}
function bindQueue(queue:PixelQueue){
  for(const method of METHODS) {
    if(!queue[method]) queue[method]=(...args:unknown[])=>{queue.push([method,...args]);};
  }
}
export function initTiktokPixel(pixelId:string=B2B_TIKTOK_PIXEL_ID):boolean{
  if(tiktokConsent()!=="granted"||!/^[A-Z0-9]{12,40}$/.test(pixelId))return false;
  if(activePixelId&&activePixelId!==pixelId)return false;
  const w=window as TikTokWindow;
  if(!w.ttq){
    const q=[] as unknown as PixelQueue;
    bindQueue(q);
    q._i={};
    q._t={};
    q._o={};
    q.instance=(id:string)=>q._i?.[id]||q;
    q.load=(id:string,options:Record<string,unknown>={})=>{
      const instance=[] as unknown as PixelQueue;
      bindQueue(instance);
      instance._u=SDK_URL;
      q._i![id]=instance;
      q._t![id]=Date.now();
      q._o![id]=options;
      if(scriptAdded)return;
      scriptAdded=true;
      const script=document.createElement("script");
      script.type="text/javascript";
      script.async=true;
      script.src=SDK_URL+"?sdkid="+encodeURIComponent(id)+"&lib=ttq";
      script.onerror=()=>{scriptAdded=false;};
      document.head.appendChild(script);
    };
    w.TiktokAnalyticsObject="ttq";
    w.ttq=q;
  }
  const queue=w.ttq;
  queue.grantConsent?.();
  if(!activePixelId) {
    activePixelId=pixelId;
    queue.load?.(pixelId);
  }
  return true;
}
export function trackTiktokPageView(){
  if(tiktokConsent()!=="granted"||!activePixelId)return;
  const key=window.location.pathname+window.location.search;
  const now=Date.now();
  if(key===lastPageKey&&now-lastPageAt<1500)return;
  lastPageKey=key;
  lastPageAt=now;
  (window as TikTokWindow).ttq?.page?.();
}
