import {Type,RotateCcw} from "lucide-react";
import {DUKKAN_TEXT_SCALES,useDukkanTextScale} from "@/lib/dukkan-text-scale";

const names={90:"Küçük",100:"Normal",110:"Orta",120:"Büyük",125:"Çok büyük"} as const;
export function DukkanTextSizeSettings(){
  const [scale,setScale]=useDukkanTextScale();
  return <section aria-labelledby="dukkan-text-size-title" className="mb-5 rounded-[24px] border border-[#e6edf6] bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-xl bg-sky-50 p-3 text-[#145595]"><Type size={22}/></span>
        <div><h2 id="dukkan-text-size-title" className="text-lg font-black text-[#173758]">Yazı Boyutu</h2>
        <p className="mt-1 text-xs text-slate-500">Çalışkan Dükkan ekranlarının yazı büyüklüğünü kişiselleştirin.</p></div>
      </div>
      <button type="button" onClick={()=>setScale(100)} disabled={scale===100} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"><RotateCcw size={16}/>Varsayılana dön</button>
    </div>
    <div role="group" aria-label="Yazı boyutu" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {DUKKAN_TEXT_SCALES.map(value=><button key={value} type="button" aria-pressed={scale===value} onClick={()=>setScale(value)}
        className={"flex min-w-0 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition "+(scale===value?"border-[#123d70] bg-[#123d70] text-white":"border-slate-200 bg-white text-[#173758] hover:bg-sky-50")}>
        <span aria-hidden="true" className="font-bold" style={{fontSize:(value/100)*18+"px"}}>Aa</span>
        <span className="text-sm font-bold">{names[value]}</span><span className="text-xs">%{value}</span>
      </button>)}
    </div>
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">Önizleme</span><span aria-live="polite" className="text-xs text-slate-600">Seçili: %{scale}</span></div>
      <p className="mt-2 text-sm">Cari Hesaplar · Örnek firma</p><p className="mt-1 text-xl font-black tabular-nums">₺43.000,00</p>
    </div>
    <p className="mt-3 text-xs text-slate-500">Ayar bu cihazda otomatik saklanır. Yazdırılan belge ve PDF şablonları değişmez.</p>
  </section>;
}
