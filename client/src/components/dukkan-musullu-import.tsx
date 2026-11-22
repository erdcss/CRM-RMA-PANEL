import { useRef, useState } from "react";
import { FileJson, Loader2, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";

type ImportOutcome = {
  inputCount:number;
  inserted:number;
  skipped:number;
  b2bPublished:boolean;
  stock:number;
  duplicates:Array<{sku:string;reason:string}>;
};
export function DukkanMusulluImport({base,onImported}:{base:string;onImported:()=>void}) {
  const fileInput = useRef<HTMLInputElement|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [outcome,setOutcome] = useState<ImportOutcome|null>(null);
  const upload = async (file?: File) => {
    if(!file) return;
    setBusy(true);setError("");setOutcome(null);
    try{
      if(file.size > 12_000_000)throw new Error("Dosya en fazla 12 MB olabilir.");
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if(parsed?.format !== "caliskan-dukkan-musullu-v1" ||
         parsed?.source !== "Musullu Toptan(98).pdf" ||
         !Array.isArray(parsed.products) || !parsed.products.length)
        throw new Error("Lütfen Çalışkan Dükkan için hazırlanmış Musullu ürün JSON dosyasını seçin.");
      if(!window.confirm(parsed.products.length+" Musullu ürününü mağazaya ekle? Mevcut ürünler değişmeyecek, stok 0 ve B2B yayını kapalı olacak."))return;
      const response=await fetch(base+"/products/import/musullu",{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(parsed),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Musullu ürünleri eklenemedi.");
      setOutcome(data as ImportOutcome);
      onImported();
    }catch(e){
      setError(e instanceof Error ? e.message : "Aktarım sırasında beklenmeyen hata oluştu.");
    }finally{
      setBusy(false);
      if(fileInput.current)fileInput.current.value="";
    }
  };
  return (
    <section aria-label="Musullu PDF ürün aktarımı" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileJson size={18}/> Musullu PDF ürün aktarımı</h3>
          <p className="mt-1 text-xs leading-5 text-slate-700">
            Hazırlanan Musullu JSON dosyasını seçin. Toptan alış fiyatı korunur; satış fiyatı alışa %10 eklenerek hesaplanır.
            Yeni ürünler stok 0 ve B2B yayını kapalı olarak eklenir. Aynı stok kodu veya barkod varsa mevcut ürün değiştirilmez.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-800">iPhone: Sohbetteki Musullu_Caliskan_Dukkan_Urun_Aktarim.json dosyasını indirip Dosyalara Kaydet → iPhone'umda / İndirilenler. Ardından buradan JSON dosyasını seç. Orijinal PDF gri görünür; bu ekran PDF değil, hazırlanmış JSON aktarımını kabul eder.</p>
          <p className="mt-1 flex items-start gap-1 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
            PDF görselleri düşük çözünürlüklü: yayınlamadan önce ürün ve renk eşleşmelerini kontrol edin.
          </p>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden"
          aria-label="Musullu ürün aktarım JSON dosyası" onChange={e=>void upload(e.target.files?.[0])}/>
        <button type="button" disabled={busy} onClick={()=>fileInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#122a51] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#234776] disabled:opacity-50">
          {busy?<Loader2 className="animate-spin" size={17}/>:<UploadCloud size={17}/>}
          {busy?"Ürünler aktarılıyor":"Musullu JSON dosyasını seç"}
        </button>
      </div>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {outcome&&<div role="status" className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700">
        <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16}/>
          {outcome.inserted} yeni ürün eklendi, {outcome.skipped} ürün çakışma nedeniyle atlandı.
        </p>
        <p className="mt-1">B2B yayını: Kapalı · Mağaza stoku: 0 · Mevcut ürünler değiştirilmedi.</p>
        {outcome.duplicates?.length>0&&
          <p className="mt-2">Atlananlar: {outcome.duplicates.slice(0,15).map(x=>x.sku+" ("+x.reason+")").join(", ")}
            {outcome.duplicates.length>15?" ve "+(outcome.duplicates.length-15)+" diğer ürün":""}
          </p>}
      </div>}
    </section>
  );
}
