import {useEffect,useState} from "react";
export const DUKKAN_TEXT_SCALE_KEY="dukkan:text-scale:v1";
export const DUKKAN_TEXT_SCALES=[50,75,90,100,110,120,125] as const;
export type DukkanTextScale=typeof DUKKAN_TEXT_SCALES[number];
const EVENT="dukkan:text-scale-change";
let volatileScale:DukkanTextScale|undefined;
export function normalizeDukkanTextScale(value:unknown):DukkanTextScale {
  const n=typeof value==="number"||typeof value==="string"?Number(value):100;
  return DUKKAN_TEXT_SCALES.includes(n as DukkanTextScale)?n as DukkanTextScale:100;
}
export function readDukkanTextScale():DukkanTextScale{
  if(typeof window==="undefined")return 100;
  try{return volatileScale??normalizeDukkanTextScale(window.localStorage.getItem(DUKKAN_TEXT_SCALE_KEY));}
  catch{return volatileScale??100;}
}
export function saveDukkanTextScale(value:DukkanTextScale){
  const scale=normalizeDukkanTextScale(value);
  try{window.localStorage.setItem(DUKKAN_TEXT_SCALE_KEY,String(scale));volatileScale=undefined;}
  catch{volatileScale=scale;}
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(onChange:()=>void){
  const storage=(e:StorageEvent)=>{if(e.key===DUKKAN_TEXT_SCALE_KEY||e.key===null){volatileScale=undefined;onChange();}};
  window.addEventListener(EVENT,onChange);
  window.addEventListener("storage",storage);
  return ()=>{window.removeEventListener(EVENT,onChange);window.removeEventListener("storage",storage);};
}
export function useDukkanTextScale(){
  const [scale,setScale]=useState(readDukkanTextScale);
  useEffect(()=>subscribe(()=>setScale(readDukkanTextScale())),[]);
  return [scale,saveDukkanTextScale] as const;
}
export function useDukkanTextScaleRuntime(active:boolean){
  const [scale]=useDukkanTextScale();
  useEffect(()=>{
    const root=document.documentElement;
    if(!active)return;
    root.dataset.dukkanTextScale=String(scale);
    root.style.setProperty("--dukkan-text-scale",String(scale/100));
    return ()=>{delete root.dataset.dukkanTextScale;root.style.removeProperty("--dukkan-text-scale");};
  },[active,scale]);
}
