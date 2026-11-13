import {useEffect,useState} from "react";
import {FileSpreadsheet,FileUp,Loader2,ScanText,X} from "lucide-react";
import {DukkanCariStatementImport} from "./dukkan-cari-statement-import";

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
const XLSX="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const allowed=["application/pdf","image/png","image/jpeg","image/webp",XLSX];
type ExcelCariCandidate={id:string;name:string;sourceCariNo:string;accountCode:string;taxNumber:string};
type ExcelPreviewRow={row:number;name:string;sourceCariNo:string;accountCode:string;cents:number;oldCents:number;afterCents:number;partyId:string|null;match:"existing"|"new"|"conflict"|"skipped";issue:string|null;candidates:ExcelCariCandidate[];resolution:string;skipped:boolean};
type ExcelPreview={sha256:string;duplicate:boolean;rows:ExcelPreviewRow[];existing:number;created:number;skipped:number;conflicts:number};
const lira=(cents:number)=>(cents/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const isExcel=(f:File|null)=>Boolean(f&&/\.xlsx$/i.test(f.name));
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
 const [cariMode,setCariMode]=useState<"profile"|"movements">("profile");
 const [excelPreview,setExcelPreview]=useState<ExcelPreview|null>(null);
 const [excelConfirmed,setExcelConfirmed]=useState(false);
 const [excelDecisions,setExcelDecisions]=useState<Record<string,string>>({});
 const [excelNeedsReview,setExcelNeedsReview]=useState(false);
 const [showExcelConflictsOnly,setShowExcelConflictsOnly]=useState(false);
 useEffect(()=>{
  if(!file||isExcel(file)){setPreview("");return;}
  const url=URL.createObjectURL(file);setPreview(url);return ()=>URL.revokeObjectURL(url);
 },[file]);
 const close=()=>{if(busy)return;setOpen(false);setFile(null);setResult(null);setExcelPreview(null);setExcelConfirmed(false);setExcelDecisions({});setExcelNeedsReview(false);setShowExcelConflictsOnly(false);setError("");};
 const run=async()=>{
  if(!file)return;
  if(file.size>8_000_000 || file.size<64){setError("Dosya en fazla 8 MB olabilir.");return;}
  if(!allowed.includes(file.type)&&!isExcel(file)){setError("PDF, JPG, PNG, WEBP veya Excel (.xlsx) yükleyin. Eski .xls dosyalarını Excel ile .xlsx olarak kaydedin.");return;}
  setBusy(true);setError("");
  try{
   const spreadsheet=isExcel(file);
   const previewExcel=section==="parties"&&cariMode==="profile"&&spreadsheet;
   const response=await fetch(base+(previewExcel?"/ai-documents/preview-cari-excel":"/ai-documents/extract"),{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      ...(previewExcel?{}:{section}),
      filename:file.name,mimeType:spreadsheet?XLSX:file.type,
      base64:await asBase64(file)
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Belge analizi başarısız");
   if(previewExcel){
    const report=data as ExcelPreview;
    setExcelPreview(report);setResult(null);setExcelConfirmed(false);
    setExcelDecisions({});setExcelNeedsReview(false);
    setShowExcelConflictsOnly(report.conflicts>0);
   }
   else{setResult(data as AiDocumentDraft);setExcelPreview(null);}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const validateExcelMatches=async()=>{
  if(!file||!excelPreview)return;
  setBusy(true);setError("");setExcelConfirmed(false);
  try{
   const response=await fetch(base+"/ai-documents/preview-cari-excel",{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({filename:file.name,mimeType:XLSX,base64:await asBase64(file),resolutions:excelDecisions})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Excel eşleşmeleri doğrulanamadı");
   const preview=data as ExcelPreview;
   setExcelPreview(preview);setExcelNeedsReview(false);setShowExcelConflictsOnly(preview.conflicts>0);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const importExcel=async()=>{
  if(!file||!excelPreview||!excelConfirmed||excelNeedsReview||excelPreview.duplicate||excelPreview.conflicts||excelPreview.rows.length===excelPreview.skipped)return;
  setBusy(true);setError("");
  try{
   const response=await fetch(base+"/ai-documents/import-cari-excel",{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({
      filename:file.name,mimeType:XLSX,base64:await asBase64(file),sha256:excelPreview.sha256,confirmed:true,resolutions:excelDecisions
    })});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Cari bakiyeleri kaydedilemedi");
   closeAfterImport();onImported();
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
 const closeAfterImport=()=>{setOpen(false);setFile(null);setResult(null);setExcelPreview(null);setExcelConfirmed(false);setExcelDecisions({});setExcelNeedsReview(false);setShowExcelConflictsOnly(false);setError("");};
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
    {section==="parties"&&<nav aria-label="Cari belge aktarım türü" className="grid grid-cols-2 gap-2 border-b border-[#e4ebf4] px-5 py-3">
      <button type="button" aria-pressed={cariMode==="profile"} onClick={()=>{setCariMode("profile");setExcelPreview(null);setResult(null);setExcelConfirmed(false);setExcelDecisions({});setExcelNeedsReview(false);setError("");}}
        className={"rounded-xl px-4 py-3 text-xs font-bold "+(cariMode==="profile"?"bg-[#143e6d] text-white":"bg-slate-100 text-slate-600")}>
        Cari Kartı Bilgilerini İçe Aktar
      </button>
      <button type="button" aria-pressed={cariMode==="movements"} onClick={()=>{setCariMode("movements");setExcelPreview(null);setResult(null);setExcelConfirmed(false);setExcelDecisions({});setExcelNeedsReview(false);setError("");}}
        className={"rounded-xl px-4 py-3 text-xs font-bold "+(cariMode==="movements"?"bg-[#143e6d] text-white":"bg-slate-100 text-slate-600")}>
        Cari Hesaba Ait Hareketleri İçe Aktar
      </button>
    </nav>}
    {section==="parties"&&cariMode==="movements"?
      <DukkanCariStatementImport base={base}
        onImported={()=>{closeAfterImport();onImported();}}/>:
    <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 md:grid-cols-2">
     <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 p-4 text-sm font-semibold">
       {isExcel(file)?<FileSpreadsheet size={20}/>:<FileUp size={20}/>}<span className="min-w-0 break-all">{file?.name||"PDF, görsel veya Excel (.xlsx) seçin (en fazla 8 MB)"}</span>
       <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx" className="sr-only" onChange={e=>{setFile(e.target.files?.[0]||null);setResult(null);setExcelPreview(null);setExcelConfirmed(false);setExcelDecisions({});setExcelNeedsReview(false);setError("");}}/>
      </label>
      {isExcel(file)&&<div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900"><FileSpreadsheet size={24} className="mb-2"/>Excel dosyası seçildi. Cari adı ve bakiye sütunları tabloda analiz edilir, onaydan önce hiçbir muhasebe kaydı oluşturulmaz.</div>}
      {preview&&(file?.type==="application/pdf"?<iframe title="Belge ön izlemesi" src={preview} className="h-[380px] w-full rounded-xl border"/>:
       <img src={preview} alt="İçe aktarılacak belge" className="max-h-[400px] w-full rounded-xl border object-contain"/>)}
      <button type="button" disabled={!file||busy} onClick={()=>void run()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#123e78] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
       {busy?<Loader2 size={16} className="animate-spin"/>:<ScanText size={16}/>} {busy?"İşleniyor...":"Belgeyi Analiz Et"}
      </button>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     </div>
     <div className="space-y-3">
      <h4 className="font-bold">Çıkarılan bilgiler — kontrol edip onaylayın</h4>
      {excelPreview?<>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          <strong>Excel cari eşleştirmesi · {excelPreview.rows.length} kayıt</strong>
          <div className="mt-1 text-xs text-sky-900">{excelPreview.existing} mevcut cari, {excelPreview.created} yeni cari, {excelPreview.skipped} atlanan satır, {excelPreview.conflicts} kontrol gerektiren satır.</div>
          <p className="mt-2 text-xs text-slate-700">Bakiye hesabı: Mevcut bakiye + Belgeden eklenen tutar = Yeni bakiye. Borç pozitif, alacak negatiftir.</p>
        </div>
        {excelPreview.duplicate&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">Bu Excel dosyası daha önce içe aktarılmıştır. Aynı tutarlar tekrar işlenmeyecek.</div>}
        {excelPreview.conflicts>0&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>{excelPreview.conflicts} satırın cari eşleşmesi kontrol edilmeli.</strong>
          <p className="mt-1">Sorunlu satırda doğru mevcut cariyi seçin veya mükerrer satırı atlayın. Excel dosyasını silmeniz ya da yeniden oluşturmanız gerekmez.</p>
        </div>}
        {excelPreview.conflicts>0&&<label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={showExcelConflictsOnly} onChange={e=>setShowExcelConflictsOnly(e.target.checked)}/>
          Yalnızca kontrol gereken {excelPreview.conflicts} satırı göster
        </label>}
        <div className="max-h-80 overflow-auto rounded-xl border">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr><th className="p-2">Satır / Cari</th><th className="min-w-[240px] p-2">Eşleşme ve düzeltme</th><th className="p-2 text-right">Eski bakiye</th><th className="p-2 text-right">Excel tutarı</th><th className="p-2 text-right">Yeni bakiye</th></tr></thead>
            <tbody>{excelPreview.rows.filter(row=>!showExcelConflictsOnly||Boolean(row.issue)).map(row=><tr key={row.row} className="border-t align-top">
              <td className="p-2">{row.row}. <strong>{row.name}</strong>{row.sourceCariNo&&<span className="block text-slate-500">Cari no: {row.sourceCariNo}</span>}{row.issue&&<p className="mt-1 text-[11px] font-semibold text-red-700">{row.issue}</p>}</td>
              <td className="p-2">
                {row.issue?<span className="font-bold text-red-700">Eşleşme doğrulanmalı</span>:
                  row.match==="skipped"?<span className="font-bold text-slate-600">Bu satır atlanacak</span>:
                  row.match==="existing"?<span className="font-bold text-sky-700">Mevcut cari #{row.partyId}</span>:
                  <span className="font-bold text-emerald-700">Yeni cari</span>}
                {(row.issue||row.resolution)&&<label className="mt-2 block text-[11px] font-semibold text-slate-700">
                  Bu satır için karar
                  <select aria-label={row.row+". satır cari eşleştirmesi"} value={excelDecisions[String(row.row)]||""}
                    onChange={e=>{
                      setExcelDecisions(prev=>({...prev,[String(row.row)]:e.target.value}));
                      setExcelNeedsReview(true);setExcelConfirmed(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs text-slate-900">
                    <option value="">Seçim yapın</option>
                    <option value="skip">Bu satırı atla (bakiye ekleme)</option>
                    {row.candidates.map(option=><option key={option.id} value={"party:"+option.id}>
                      {option.name} · #{option.id}{option.sourceCariNo?" · No "+option.sourceCariNo:""}
                    </option>)}
                  </select>
                </label>}
              </td>
              <td className="p-2 text-right tabular-nums">{lira(row.oldCents)}</td>
              <td className="p-2 text-right font-semibold tabular-nums">{lira(row.cents)}</td>
              <td className="p-2 text-right font-bold tabular-nums">{row.skipped?"—":lira(row.afterCents)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {excelNeedsReview&&<div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-xs font-semibold text-sky-900">Kararları yeniden doğrulayın. Henüz hiçbir muhasebe kaydı oluşturulmadı.</p>
          <button type="button" disabled={busy} onClick={()=>void validateExcelMatches()}
            className="w-full rounded-lg bg-[#143e6d] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy?"Kontrol ediliyor...":"Eşleştirmeleri Yeniden Kontrol Et"}
          </button>
        </div>}
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs">
          <input type="checkbox" className="mt-0.5" checked={excelConfirmed} disabled={busy||excelNeedsReview||excelPreview.conflicts>0||excelPreview.duplicate} onChange={e=>setExcelConfirmed(e.target.checked)}/>
          <span>Cari eşleşmelerini ve tutarları kontrol ettim. Excel tutarlarının mevcut carilere ayrı bakiye hareketi olarak eklenmesini onaylıyorum.</span>
        </label>
        <button type="button" onClick={()=>void importExcel()} disabled={busy||!excelConfirmed||excelNeedsReview||excelPreview.duplicate||excelPreview.conflicts>0||excelPreview.rows.length===excelPreview.skipped}
          className="w-full rounded-xl bg-[#123e78] p-3 text-sm font-bold text-white disabled:opacity-40">
          {busy?"Kaydediliyor...":(excelPreview.rows.length-excelPreview.skipped)+" Cari Kaydını Onayla ve İşle"}
        </button>
      </>:!result?<p className="text-sm text-slate-500">Belge seçip analiz edin. Eksik alanları kayıt formunda düzeltebilirsiniz.</p>:<>
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
    </div>}
   </section>
  </div>}
 </>;
}
