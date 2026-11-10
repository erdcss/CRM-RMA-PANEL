import {parseMarkupPercent,parsePriceInput,productProfitPreview} from "@/lib/dukkan-profit-price";
import type {DukkanMarkupChoice} from "@/lib/dukkan-product-create-markup";

const money=(value:number)=>value.toLocaleString("tr-TR",{style:"currency",currency:"TRY",minimumFractionDigits:2,maximumFractionDigits:2});
const rate=(value:number)=>"%"+value.toLocaleString("tr-TR",{maximumFractionDigits:2});
const label="block text-xs font-semibold text-[#17385f]";
export function DukkanNewProductProfitPanel({
  purchasePrice,salePrice,selection,customMarkup,disabled=false,onSelect,onManualRateChange,
}:{
  purchasePrice:string;salePrice:string;selection:DukkanMarkupChoice;customMarkup:string;
  disabled?:boolean;onSelect:(rate:Exclude<DukkanMarkupChoice,null>)=>void;
  onManualRateChange:(value:string)=>void;
}){
  const preview=productProfitPreview(purchasePrice,salePrice);
  const canApply=(parsePriceInput(purchasePrice)||0)>0;
  const invalidCustom=selection==="custom"&&customMarkup.trim()!==""&&parseMarkupPercent(customMarkup)===null;
  return <div className="mt-2 rounded-xl border border-[#d9e6f6] bg-[#f7faff] p-3" aria-label="Alış fiyatına göre kâr oranı hesaplama">
    <p className="mb-2 text-xs font-bold text-[#17385f]">Alış fiyatına göre kâr ekle</p>
    <div className="grid grid-cols-4 gap-1.5">
      {(["10","20","30"] as const).map(choice=>
        <button type="button" key={choice} disabled={!canApply||disabled}
          onClick={()=>onSelect(choice)} aria-pressed={selection===choice}
          className={"min-h-9 rounded-lg border px-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 "+
            (selection===choice?"border-sky-700 bg-[#17385f] text-white":"border-slate-200 bg-white text-[#17385f] hover:border-sky-400")}>
          %{choice}
        </button>
      )}
      <button type="button" onClick={()=>onSelect("custom")} disabled={!canApply||disabled}
        aria-pressed={selection==="custom"}
        className={"min-h-9 rounded-lg border px-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 "+
          (selection==="custom"?"border-sky-700 bg-[#17385f] text-white":"border-slate-200 bg-white text-[#17385f] hover:border-sky-400")}>
        Manuel
      </button>
    </div>
    {selection==="custom"?<label className="mt-3 block">
      <span className={label}>Manuel kâr oranı (%)</span>
      <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500"
        type="text" inputMode="decimal" aria-label="Manuel kâr oranı" placeholder="Örn. 17,5"
        value={customMarkup} disabled={disabled} onChange={e=>onManualRateChange(e.target.value)}/>
      {invalidCustom?<p role="alert" className="mt-1 text-xs text-red-600">
        0 ile 1000 arasında geçerli bir oran girin.
      </p>:null}
    </label>:null}
    {!canApply?<p className="mt-2 text-xs text-amber-700">
      Oran uygulamak için önce alış fiyatını sıfırdan büyük girin.
    </p>:null}
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <p className="text-[11px] text-slate-500">Alışa göre kâr oranı</p>
        <strong className={"mt-1 block text-sm tabular-nums "+(preview&&preview.profit<0?"text-red-700":"text-emerald-700")}>
          {preview?rate(preview.markupPercent):"—"}
        </strong>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <p className="text-[11px] text-slate-500">Birim kâr tutarı</p>
        <strong className={"mt-1 block text-sm tabular-nums "+(preview&&preview.profit<0?"text-red-700":"text-emerald-700")}>
          {preview?money(preview.profit):"—"}
        </strong>
      </div>
    </div>
    {preview?<p className="mt-2 text-xs text-slate-600">
      Satış fiyatındaki kâr marjı: <strong>{rate(preview.marginPercent)}</strong>
    </p>:null}
    <p className="mt-2 text-[11px] leading-4 text-slate-500">
      Hesap alış ve satış fiyatı farkıdır. KDV, komisyon, kargo ve diğer giderler
      düşülmediğinden muhasebesel net kâr değildir.
    </p>
  </div>;
}
