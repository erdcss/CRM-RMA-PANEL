import {useEffect,useState} from "react";
import {FileUp,Loader2,ScanText,X} from "lucide-react";

export type DocumentSection="products"|"stock"|"instruments"|"parties"|"sales"|"purchases";
export type AiDocumentDraft={
 section:DocumentSection;
 fields:Record<string,string>;
 lines:Array<{productId:string;productName:string;sku:string;quantity:string;unitPrice:string;taxRate:string}>;
 products:Array<{name:string;sku:string;barcode:string;unit:string;purchasePrice:string;salePrice:string}>;
 warnings:string[];
};
const label:Record<string,string>={
 name:"Ad / Ürün adı",sku:"Stok kodu",barcode:"Barkod",unit:"Birim",purchasePrice:"Alış fiyatı",
 salePrice:"Satış fiyatı",partyName:"Cari adı",partyTaxNumber:"Vergi no",partyId:"Cari ID",
 productId:"Ürün ID",date:"Tarih",kind:"Tür",delta:"Stok değişimi",direction:"Yön",
 number:"Belge no",amount:"Tutar",dueDate:"Vade",note:"Açıklama"
};
const allowed=["application/pdf","image/png","image/jpeg","image/webp"];
function asBase64(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Dosya okunamadı"));
  reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
  reader.readAsDataURL(file);
 });
}
export function DukkanAiDocumentImport({section,base,onApply,onImported}:{
 section:DocumentSection;base:string;onApply:(draft:AiDocumentDraft)=>void;onImported:()=>void;
}){
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState(""),[result,setResult]=useState<AiDocumentDraft|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!file){setPreview("");return;}
  const url=URL.createObjectURL(file);setPreview(url);return ()=>URL.revokeObjectURL(url);
 },[file]);
 const close=()=>{if(busy)return;setOpen(false);setFile(null);setResult(null);setError("");};
 const run=async()=>{
  if(!file)return;
  if(file.size>8_000_000 || file.size<64){setError("Dosya en fazla 8 MB olabilir.");return;}
  if(!allowed.includes(file.type)){setError("PDF, JPG, PNG veya WEBP yükleyin.");return;}
  setBusy(true);setError("");
  try{
   const response=await fetch(base+"/ai-documents/extract",{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({section,filename:file.name,mimeType:file.type,base64:await asBase64(file)})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Belge analizi başarısız");
   setResult(data as AiDocumentDraft);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const bulk=async()=>{
  if(!result?.products.length)return;
  if(result.products.some(p=>!p.name.trim()||!p.sku.trim())){setError("Her üründe ad ve stok kodu olmalı.");return;}
  setBusy(true);setError("");
  try{
   const response=await fetch(base+"/ai-documents/import-products",{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({products:result.products})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Toplu aktarım yapılamadı");
   closeAfterImport();onImported();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const closeAfterImport=()=>{setOpen(false);setFile(null);setResult(null);setError("");};
 return <>
  <button type="button" onClick={()=>setOpen(true)}
   className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 hover:bg-sky-100">
   <ScanText size={17}/> AI ile Belge İçe Aktar
  </button>
  {open&&<div role="dialog" aria-modal="true" aria-label="AI belge analizi" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3">
   <section className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
    <header className="flex items-center justify-between border-b px-5 py-4">
     <div><h3 className="font-black">AI Belge İçe Aktarma</h3><p className="text-xs text-slate-500">Belge okunur, taslak hazırlanır; onay olmadan muhasebe kaydı yapılmaz.</p></div>
     <button type="button" disabled={busy} onClick={close} aria-label="Kapat"><X size={22}/></button>
    </header>
    <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 md:grid-cols-2">
     <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 p-4 text-sm font-semibold">
       <FileUp size={20}/><span>{file?.name||"PDF veya görsel seçin (en fazla 8 MB)"}</span>
       <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={e=>{setFile(e.target.files?.[0]||null);setResult(null);setError("");}}/>
      </label>
      {preview&&(file?.type==="application/pdf"?<iframe title="Belge ön izlemesi" src={preview} className="h-[380px] w-full rounded-xl border"/>:
       <img src={preview} alt="İçe aktarılacak belge" className="max-h-[400px] w-full rounded-xl border object-contain"/>)}
      <button type="button" disabled={!file||busy} onClick={()=>void run()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#123e78] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
       {busy?<Loader2 size={16} className="animate-spin"/>:<ScanText size={16}/>} {busy?"İşleniyor...":"Belgeyi Analiz Et"}
      </button>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     </div>
     <div className="space-y-3">
      <h4 className="font-bold">Çıkarılan bilgiler — kontrol edip onaylayın</h4>
      {!result?<p className="text-sm text-slate-500">Belge seçip analiz edin. Eksik alanları kayıt formunda düzeltebilirsiniz.</p>:<>
       {result.warnings?.length>0&&<div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
       <div className="grid grid-cols-2 gap-2">
        {Object.entries(result.fields).filter(([,v])=>Boolean(v)).map(([key,v])=><div key={key} className="min-w-0 rounded-lg border p-2 text-xs">
         <div className="font-bold text-slate-500">{label[key]||key}</div><div className="break-words">{v}</div>
        </div>)}
       </div>
       {result.lines.length>0&&<div className="rounded-xl border p-3"><h5 className="mb-2 font-semibold">Fatura kalemleri ({result.lines.length})</h5>
        {result.lines.map((line,i)=><p key={i} className="border-t py-1 text-xs">{line.productName||line.sku||"Eşleşmeyen ürün"} · {line.quantity} × {line.unitPrice} TL {line.productId?"":"(Ürün seçimi gerekli)"}</p>)}
       </div>}
       {result.products.length>0&&<div className="space-y-2 rounded-xl border p-3"><h5 className="font-semibold">Ürün listesi ({result.products.length})</h5>
        {result.products.map((p,i)=><div key={i} className="grid grid-cols-2 gap-1 rounded-lg border p-2">
          {(["name","sku","barcode","unit","purchasePrice","salePrice"] as const).map(key=><label key={key} className="text-xs">{label[key]||key}
           <input className="mt-1 w-full rounded border px-2 py-1" value={p[key]} onChange={e=>setResult(old=>old?{...old,products:old.products.map((x,n)=>n===i?{...x,[key]:e.target.value}:x)}:old)}/>
          </label>)}
         </div>)}
       </div>}
       <p className="text-xs text-slate-500">Belge yorumlanması hata içerebilir. Cari/ürün eşleşmesini ve tutarları doğrulayın.</p>
       {section==="products"&&result.products.length>0?
        <button type="button" disabled={busy} onClick={()=>void bulk()} className="w-full rounded-xl bg-[#123e78] p-3 text-sm font-bold text-white disabled:opacity-40">Kontrol Ettim: {result.products.length} Ürünü Kaydet</button>:
        <button type="button" disabled={busy} onClick={()=>{onApply(result);closeAfterImport();}} className="w-full rounded-xl bg-[#123e78] p-3 text-sm font-bold text-white">Taslağı Forma Aktar ve Düzenle</button>}
      </>}
     </div>
    </div>
   </section>
  </div>}
 </>;
}
