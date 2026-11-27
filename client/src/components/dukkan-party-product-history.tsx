import {useEffect,useState} from "react";
import {ArrowLeft,ChevronLeft,ChevronRight,RefreshCw} from "lucide-react";

type HistoryData={
  party:{name:string};
  summary:{line_count:number;invoice_count:number;total_quantity:string|null;average_price:string|null;last_price:string|null;first_date:string|null;last_date:string|null};
  rows:{source:string;document_id:string;line_id:string;document_no:string;sale_date:string;quantity:string;unit:string;unit_price:string;line_total:string;tax_rate:string|null}[];
  units:{unit:string;quantity:string}[];
  page:number;totalPages:number;
};
const money=(v:string|null)=>v===null?"—":Number(v).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const quantity=(v:string)=>Number(v).toLocaleString("tr-TR",{maximumFractionDigits:3});
const date=(v:string|null)=>v?v.slice(0,10).split("-").reverse().join("."):"—";

export function DukkanPartyProductHistory({storeId,partyId,product,onBack}:{
  storeId:string;partyId:string;product:Record<string,any>;onBack:()=>void;
}){
  const [data,setData]=useState<HistoryData|null>(null);
  const [page,setPage]=useState(1),[retry,setRetry]=useState(0);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true);
  const productId=String(product.id);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setLoading(true);setError("");setData(null);
    const url="/api/dukkan/stores/"+encodeURIComponent(storeId)+"/parties/"+encodeURIComponent(partyId)+"/products/"+encodeURIComponent(productId)+"/sales-history?page="+page;
    void fetch(url,{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const result=await response.json().catch(()=>null);
        if(!response.ok||!result)throw Error(result?.error||"Ürün hareketleri alınamadı.");
        if(active)setData(result);
      }).catch(e=>{if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Ürün hareketleri alınamadı.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[storeId,partyId,productId,page,retry]);
  const summary=data?.summary;
  return <>
    <div className="shrink-0 border-b bg-slate-50 p-4">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-2 text-sm font-bold text-[#174777]"><ArrowLeft size={16}/>Ürün listesine dön</button>
      <h3 className="text-base font-black">{product.name}</h3>
      <p className="mt-1 text-xs text-slate-600">Stok kodu: {product.sku||"—"}{data?" · Cari: "+data.party.name:""}</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {loading&&<p role="status" className="py-10 text-center text-sm text-slate-500">Satış hareketleri yükleniyor…</p>}
      {error&&<div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}<button type="button" className="mt-2 flex items-center gap-2 font-bold" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={14}/>Tekrar dene</button></div>}
      {summary&&data&&<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Toplam alınan",data.units.length?data.units.map(u=>quantity(u.quantity)+" "+u.unit).join(" · "):"0"],
            ["Son satış fiyatı",money(summary.last_price)],
            ["Ağırlıklı ort. fiyat",money(summary.average_price)],
            ["Satış belgesi",String(summary.invoice_count)]
          ].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block break-words text-sm">{value}</strong></div>)}
        </div>
        <p className="my-3 text-xs text-slate-500">İlk satış: {date(summary.first_date)} · Son satış: {date(summary.last_date)}. İadeler ve iptal edilen belgeler satış toplamına dahil değildir.</p>
        {!data.rows.length?<p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Bu cariye ait doğrulanmış ürün satış hareketi bulunamadı.</p>:
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-slate-100 text-slate-600"><tr>{["Tarih","Evrak No","Miktar","Birim Fiyat","Belge Satır Toplamı"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
            <tbody>{data.rows.map(r=><tr key={r.source+":"+r.document_id+":"+r.line_id} className="border-t">
              <td className="whitespace-nowrap px-3 py-3">{date(r.sale_date)}</td><td className="px-3 py-3">{r.document_no}{r.source==="archive"&&<span className="ml-1 text-slate-500">(Arşiv)</span>}</td>
              <td className="whitespace-nowrap px-3 py-3">{quantity(r.quantity)} {r.unit}</td><td className="whitespace-nowrap px-3 py-3 font-bold">{money(r.unit_price)}</td><td className="whitespace-nowrap px-3 py-3">{money(r.line_total)}</td>
            </tr>)}</tbody>
          </table></div>}
        <p className="mt-3 text-xs text-slate-500">Birim fiyat ve satır toplamı belgede kayıtlı değerlerdir. Arşivde KDV bilgisi eksik olabilir; yalnız eşleşen ürün satırları gösterilir.</p>
      </>}
    </div>
    <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-slate-50 p-3 text-xs">
      <span>{data?data.summary.line_count+" hareket · Sayfa "+page+" / "+data.totalPages:""}</span>
      <div className="flex gap-2">
        <button type="button" aria-label="Önceki hareket sayfası" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft size={16}/></button>
        <button type="button" aria-label="Sonraki hareket sayfası" disabled={loading||!data||page>=data.totalPages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight size={16}/></button>
        <button type="button" onClick={onBack} className="rounded-lg border bg-white px-4 font-semibold">Geri</button>
      </div>
    </div>
  </>;
}
