import {useEffect,useState} from "react";
import {useLocation} from "wouter";
import {useQuery} from "@tanstack/react-query";
import {initMetaPixel,metaConsent,setMetaConsent,trackMetaPageView} from "@/lib/meta-pixel";
type TrackingConfig={enabled:boolean;pixelId:string};

async function getTrackingConfig():Promise<TrackingConfig>{
  const response=await fetch("/api/public/meta-tracking",{credentials:"omit",cache:"no-store"});
  if(!response.ok)return {enabled:false,pixelId:""};
  const data=await response.json();
  return {enabled:data.enabled===true,pixelId:typeof data.pixelId==="string"?data.pixelId:""};
}

export function B2BMetaPixelConsent(){
  const [location]=useLocation();
  const {data:config}=useQuery({queryKey:["/api/public/meta-tracking"],queryFn:getTrackingConfig,staleTime:60_000});
  const [consent,setConsent]=useState<"granted"|"denied"|null>(()=>metaConsent());
  const [editing,setEditing]=useState(false);
  useEffect(()=>{
    const sync=()=>setConsent(metaConsent());
    const open=()=>setEditing(true);
    window.addEventListener("caliskan-meta-consent-change",sync);
    window.addEventListener("caliskan-meta-open-consent",open);
    return ()=>{
      window.removeEventListener("caliskan-meta-consent-change",sync);
      window.removeEventListener("caliskan-meta-open-consent",open);
    };
  },[]);
  useEffect(()=>{
    if(config?.enabled&&consent==="granted"&&initMetaPixel(config.pixelId)){
      trackMetaPageView();
    }
  },[location,config?.enabled,config?.pixelId,consent]);

  if(!config?.enabled||(!editing&&consent!==null))return null;
  return <section role="dialog" aria-label="Reklam ve ölçüm çerezleri tercihi"
    className="fixed bottom-4 left-4 right-4 z-[150] mx-auto max-w-[570px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
    <h2 className="text-base font-extrabold text-slate-950">Reklam ve ölçüm tercihiniz</h2>
    <p className="mt-2 text-xs leading-5 text-slate-600">
      Çalışkan B2B'de ürün görüntüleme, arama ve alışveriş işlemlerini reklam performansını ölçmek için
      Meta Pixel ile paylaşmamıza izin verir misiniz? Reddederseniz Meta Pixel yüklenmez.
      Tercihinizi daha sonra alt menüden değiştirebilirsiniz.
    </p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={()=>{setMetaConsent(false);setEditing(false);setConsent("denied");}}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">
        Reddet
      </button>
      <button type="button" onClick={()=>{setMetaConsent(true);setEditing(false);setConsent("granted");}}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
        İzin ver
      </button>
    </div>
  </section>;
}
