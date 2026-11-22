import {useCallback,useEffect,useState} from "react";
import {AlertTriangle,CheckCircle2,Image as ImageIcon,RefreshCw,Search,ShieldCheck,Sparkles,X} from "lucide-react";
type RecordItem={
 product_id:number;sku:string;name:string;brand:string;
 source_width:number;source_height:number;state:string;
 candidate_origin:string|null;candidate_width:number|null;candidate_height:number|null;
 candidate_source_url:string|null;review_note:string|null;
};
type Report={total:number;counts:Record<string,number>;items:RecordItem[]};
export function DukkanImageRecovery({base,onChanged}:{base:string;onChanged:()=>void}){
 const [open,setOpen]=useState(false);
 const [data,setData]=useState<Report|null>(null);
 const [busy,setBusy]=useState("");
 const [query,setQuery]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [filter,setFilter]=useState<"all"|"pending_review"|"critical"|"approved">("all");
 const load=useCallback(async()=>{
  try{
   const response=await fetch(base+"/image-recovery",{credentials:"include",cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Görsellerin kalite raporu okunamadı");
   setData(data);
  }catch(e){setError((e as Error).message);}
 },[base]);
 useEffect(()=>{void load();},[load]);
 const request=async(path:string,label:string,after?:()=>void)=>{
  setBusy(label);setError("");setNotice("");
  try{
   const response=await fetch(base+"/image-recovery"+path,{
    method:"POST",credentials:"include",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:"{}",
   });
   const r=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(r.error||"Görsel işlemi başarısız oldu");
   setNotice(label+" işlemi tamamlandı.");
   await load();after?.();
  }catch(e){setError((e as Error).message);}
  finally{setBusy("");}
 };
 const visible=(data?.items||[]).filter(p=>
  (filter==="all"||p.state===filter)&&
  (!query||[p.sku,p.name,p.brand].join(" ").toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))));
 return <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
  <button type="button" onClick={()=>setOpen(v=>!v)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
   <span className="flex min-w-0 items-center gap-3">
    <Sparkles className="shrink-0 text-[#184b85]" size={23}/>
    <span><strong className="block text-sm text-slate-900">AI Görsel Kurtarma Merkezi</strong>
     <span className="mt-0.5 block text-xs text-slate-600">Musullu PDF · Orijinal fotoğraf korunur · Onaysız görsel değişmez</span></span>
   </span>
   <span className="flex items-center gap-2 text-xs font-semibold text-amber-800">
    {data?(data.counts.critical||0)+(data.counts.low||0)+" düşük kaliteli": "Kalite taranıyor"} · {open?"Kapat":"İncele"}
   </span>
  </button>
  {open&&<div className="space-y-3 border-t p-4">
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {[
     ["Toplam",data?.total||0],
     ["Kritik blur",data?.counts.critical||0],
     ["Onay bekliyor",data?.counts.pending_review||0],
     ["İyileştirildi",data?.counts.approved||0],
    ].map(([name,number])=><div key={name} className="rounded-xl bg-slate-50 p-3"><b className="block text-xl text-[#173f6d]">{number}</b><span className="text-xs text-slate-600">{name}</span></div>)}
   </div>
   <p className="flex gap-2 text-xs leading-5 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0"/>
    PDF görselleri 800 pikselden küçükse kalite uyarısı verilir. Üretici kaynaklı resimler veya AI taslakları önce onaya gönderilir; AI eksik ürün ayrıntılarını yanlış oluşturabilir.</p>
   <div className="flex flex-wrap items-center gap-2">
    <button disabled={!!busy} onClick={()=>void request("/scan","116 ürün kalite taraması")}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">
      <RefreshCw size={14}/> 116 ürünü tara
    </button>
    <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 sm:max-w-xs"><Search size={14}/>
     <input className="w-full min-w-0 bg-transparent text-xs outline-none" placeholder="Ürün kodu veya adı" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <select aria-label="Kalite durumuna göre filtre" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}
     className="max-w-full rounded-lg border bg-white px-3 py-2 text-xs">
     <option value="all">Tüm ürünler</option><option value="critical">Bulanık olanlar</option>
     <option value="pending_review">Onay bekleyenler</option><option value="approved">İyileştirilenler</option>
    </select>
   </div>
   {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-800">{error}</div>}
   {notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
   {busy&&<p role="status" className="text-xs font-semibold text-slate-600">{busy} devam ediyor...</p>}
   <div className="max-h-[620px] space-y-3 overflow-y-auto">
    {visible.map(p=><article key={p.product_id} className="rounded-xl border border-slate-200 p-3">
     <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
      <div className="flex shrink-0 gap-2">
       <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <img src={base.replace(/\/$/,"")+"/products/"+p.product_id+"/image"} alt={p.name+" PDF fotoğrafı"} className="max-h-full max-w-full object-contain"/>
       </div>
       {p.state==="pending_review"&&<div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <img src={base+"/image-recovery/"+p.product_id+"/candidate"} alt={p.name+" yeni görsel adayı"} className="max-h-full max-w-full object-contain"/>
       </div>}
      </div>
      <div className="min-w-0 flex-1">
       <strong className="block break-words text-sm text-slate-900">{p.name}</strong>
       <div className="mt-1 text-xs text-slate-600">{p.sku} · Orijinal {p.source_width}×{p.source_height} px</div>
       <div className="mt-1 flex items-center gap-1 text-xs">
        {p.state==="approved"?<><CheckCircle2 size={14} className="text-emerald-700"/> İyileştirme onaylandı</>:
        p.state==="pending_review"?<><ShieldCheck size={14} className="text-blue-700"/> Aday görsel onay bekliyor</>:
        <><ImageIcon size={14} className="text-amber-700"/> Kritik düşük çözünürlük</>}
       </div>
       {p.review_note&&<p className="mt-1 text-xs text-slate-500">{p.review_note}</p>}
       {p.candidate_source_url&&<a className="mt-1 inline-block break-all text-xs text-blue-700 underline"
         href={p.candidate_source_url} target="_blank" rel="noopener noreferrer">Görselin resmî kaynağı</a>}
      </div>
     </div>
     <div className="mt-3 flex flex-wrap gap-2">
      {p.state!=="pending_review"&&p.state!=="approved"&&
       <button type="button" disabled={!!busy} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40"
        onClick={()=>{
         if(window.confirm("Bu ürünün birebir fotoğrafı tedarikçinin resmî sitesinde aranacak. Gerekirse ücretli AI web araması kullanılabilir. Devam edilsin mi?"))
           void request("/"+p.product_id+"/official",p.sku+" resmî görsel arama");
        }}>Resmî fotoğrafı ara</button>}
      {p.state!=="pending_review"&&p.state!=="approved"&&
       <button type="button" disabled={!!busy} className="rounded-lg bg-[#173f6d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        onClick={()=>{
         if(window.confirm("AI görsel işlemi ücretli API kullanabilir. Ürün ayrıntıları değişebilir ve onay gereklidir. Devam edilsin mi?"))
          void request("/"+p.product_id+"/ai",p.sku+" AI görsel taslağı");
        }}>AI ile iyileştir</button>}
      {p.state==="pending_review"&&<>
       <button type="button" disabled={!!busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        onClick={()=>{
         if(window.confirm(p.sku+" için yeni fotoğraf ana görsel yapılsın mı? Orijinali galeride korunacak."))
          void request("/"+p.product_id+"/approve",p.sku+" görsel onayı",onChanged);
        }}>Görseli onayla</button>
       <button type="button" disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
        onClick={()=>void request("/"+p.product_id+"/reject",p.sku+" görsel reddi")}><X size={13}/> Reddet</button>
      </>}
     </div>
    </article>)}
    {!visible.length&&<p className="py-6 text-center text-xs text-slate-500">Bu filtreye uygun ürün bulunamadı.</p>}
   </div>
  </div>}
 </section>;
}