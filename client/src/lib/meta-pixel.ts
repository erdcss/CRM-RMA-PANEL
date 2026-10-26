/** Consent-first Meta Pixel for the public B2B storefront only.
 * No SDK requests, page views or ad cookies are created until explicit consent.
 * Admin and seller panels deliberately do not import this module.
 */
type PixelFn=(...args:unknown[])=>void;
type PixelWindow=Window & {fbq?:PixelFn;_fbq?:PixelFn};
const CONSENT_KEY="caliskan_b2b_meta_consent_v1";
let activePixelId="";
let scriptAdded=false;
const allowedEvents=new Set(["PageView","ViewContent","Search","AddToCart","InitiateCheckout","Purchase","CompleteRegistration"]);

export function metaConsent(): "granted"|"denied"|null {
  try {
    const stored=window.localStorage.getItem(CONSENT_KEY);
    return stored==="granted"||stored==="denied"?stored:null;
  } catch{return null;}
}
export function setMetaConsent(approved:boolean){
  try{window.localStorage.setItem(CONSENT_KEY,approved?"granted":"denied");}catch{}
  const fbq=(window as PixelWindow).fbq;
  // Revoke permission even if the script was already loaded earlier in the tab.
  if(!approved&&fbq)fbq("consent","revoke");
  if(approved&&fbq&&activePixelId)fbq("consent","grant");
  window.dispatchEvent(new Event("caliskan-meta-consent-change"));
}
export function initMetaPixel(pixelId:string) {
  if(metaConsent()!=="granted"||!/^[0-9]{10,20}$/.test(pixelId))return false;
  if(activePixelId===pixelId)return true;
  // Do not mix multiple Pixel IDs on the same loaded document.
  if(activePixelId&&activePixelId!==pixelId)return false;
  const w=window as PixelWindow;
  if(!w.fbq){
    const stub=((...args:unknown[])=>{
      if((stub as PixelFn & {callMethod?:PixelFn}).callMethod){
        (stub as PixelFn & {callMethod?:PixelFn}).callMethod!(...args);
      }else (stub as PixelFn & {queue?:unknown[][]}).queue!.push(args);
    }) as PixelFn & {queue:unknown[][];loaded:boolean;version:string;push:PixelFn};
    stub.queue=[];stub.loaded=true;stub.version="2.0";stub.push=stub;
    w.fbq=stub;w._fbq=stub;
  }
  w.fbq("consent","grant");
  w.fbq("init",pixelId);
  activePixelId=pixelId;
  if(!scriptAdded){
    scriptAdded=true;
    const script=document.createElement("script");
    script.async=true;
    script.src="https://connect.facebook.net/en_US/fbevents.js";
    script.onerror=()=>{scriptAdded=false;};
    document.head.appendChild(script);
  }
  return true;
}
export function trackMetaEvent(name:string,data:Record<string,unknown>={},eventId?:string){
  if(metaConsent()!=="granted"||!activePixelId||!allowedEvents.has(name))return;
  const fbq=(window as PixelWindow).fbq;
  if(!fbq)return;
  const clean=Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined&&v!==null));
  const id=eventId|| (typeof crypto!=="undefined"&&"randomUUID"in crypto?crypto.randomUUID():`evt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fbq("trackSingle",activePixelId,name,clean,{eventID:id});
  return id;
}
export function trackMetaPageView(){return trackMetaEvent("PageView");}
