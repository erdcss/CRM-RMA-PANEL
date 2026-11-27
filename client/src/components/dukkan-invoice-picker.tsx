import {useMemo,useRef,useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Search,ChevronDown,Check,Package,Users,X,ImageOff,ChevronLeft,ChevronRight,History} from "lucide-react";

import {DukkanPartyProductHistory} from "./dukkan-party-product-history";

type Entry=Record<string,any>;
type Props={kind:"product"|"party";items:Entry[];value:string;onChange:(value:string)=>void;disabled?:boolean;className?:string;priceKind?:"sale"|"purchase";storeId?:string;partyId?:string};
const PAGE_SIZE=40;
const tr=(v:unknown)=>String(v??"").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}/gu,"").replace(/ı/g,"i");
const txt=(v:unknown)=>String(v??"");
const money=(v:unknown)=>Number(v||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const matches=(item:Entry,words:string[],kind:Props["kind"])=>{
  const fields=kind==="product"?[item.name,item.sku,item.barcode,item.brand,item.category]:[item.name,item.account_code,item.source_cari_no,item.phone,item.city];
  const hay=tr(fields.join(" "));
  return words.every(word=>hay.includes(word));
};

function Thumbnail({item,storeId}:{item:Entry;storeId?:string}){
  const fallback=storeId&&/^\d+$/.test(txt(item.id))?"/api/dukkan/stores/"+encodeURIComponent(storeId)+"/products/"+encodeURIComponent(txt(item.id))+"/image":"";
  const primary=typeof item.image_url==="string"?item.image_url:"";
  const [attempt,setAttempt]=useState(0);
  const sources=[...new Set([primary,fallback].filter(Boolean))];
  const src=sources[attempt]||"";
  return <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
    {src?<img src={src} alt={txt(item.name)} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={()=>setAttempt(n=>n+1)}/>:<ImageOff size={22} className="text-slate-300" aria-label="Görsel yok"/>}
  </div>;
}

export function DukkanInvoicePicker({kind,items,value,onChange,disabled,className="",priceKind,storeId,partyId}:Props){
  const product=kind==="product",title=product?"Ürün Seç":"Cari Hesap Seç";
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[page,setPage]=useState(0);
  const [history,setHistory]=useState<Entry|null>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const showHistory=product&&priceKind==="sale"&&Boolean(storeId);
  const selected=items.find(item=>txt(item.id)===value);
  const filtered=useMemo(()=>{
    const words=tr(query).trim().split(/\s+/).filter(Boolean);
    return items.filter(item=>matches(item,words,kind)).sort((a,b)=>txt(a.name).localeCompare(txt(b.name),"tr"));
  },[items,query,kind]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),activePage=Math.min(page,pages-1);
  const visible=filtered.slice(activePage*PAGE_SIZE,(activePage+1)*PAGE_SIZE);
  const changeOpen=(next:boolean)=>{setHistory(null);if(next){setQuery("");setPage(0);}setOpen(next);};
  const choose=(item:Entry)=>{onChange(txt(item.id));setOpen(false);};
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button type="button" disabled={disabled} aria-label={title} className={"flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[#dbe5f0] bg-white px-3.5 py-3 text-left text-sm text-[#142b4e] outline-none transition hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-50 "+className}>
      <span className="min-w-0 flex-1 truncate">{selected?txt(selected.name)+(product&&selected.sku?" · "+selected.sku:""):value?"Seçili kayıt #"+value:title}</span><ChevronDown size={16} className="shrink-0 text-slate-500"/>
    </button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#081b32]/55 backdrop-blur-sm"/>
      <Dialog.Content onOpenAutoFocus={e=>{e.preventDefault();searchRef.current?.focus();}} onKeyDown={e=>{if(e.key==="Enter"&&e.target===searchRef.current){e.preventDefault();e.stopPropagation();if(filtered.length===1)choose(filtered[0]);}}}
        className="fixed left-1/2 top-1/2 z-[101] flex max-h-[88dvh] w-[calc(100%_-_1.5rem)] max-w-[950px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] border border-[#dce7f4] bg-white text-[#142b4e] shadow-2xl outline-none">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#122a51] px-4 py-4 text-white sm:px-6">
          <div className="flex min-w-0 items-center gap-3">{product?<Package size={23}/>:<Users size={23}/>}<div><Dialog.Title className="text-lg font-black">{history?"Ürün Hareketleri":title}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-slate-200">{product?"Stok listesinden fatura kalemi seçin.":"Mevcut cari hesaplardan seçim yapın."}</Dialog.Description></div></div>
          <Dialog.Close asChild><button type="button" aria-label="Pencereyi kapat" className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><X size={20}/></button></Dialog.Close>
        </div>
        {history&&storeId&&partyId?<DukkanPartyProductHistory key={storeId+":"+partyId+":"+txt(history.id)} storeId={storeId} partyId={partyId} product={history} onBack={()=>setHistory(null)}/>:<>
        <div className="shrink-0 border-b border-slate-200 bg-[#f3f8ff] p-4">
          <div className="relative"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input ref={searchRef} type="search" autoComplete="off" aria-label={product?"Ürün ara":"Cari hesap ara"} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder={product?"Ürün adı, stok kodu, barkod, marka...":"Firma adı, hesap kodu, cari no, telefon..."} className="w-full rounded-xl border border-[#dbe5f0] bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"/>
          </div>
          <p aria-live="polite" className="mt-2 text-xs text-slate-500">{filtered.length.toLocaleString("tr-TR")} kayıt bulundu</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {visible.length? <div className="space-y-2">{visible.map(item=>{
            const active=txt(item.id)===value;
            return <div key={txt(item.id)} className={"flex flex-wrap items-center gap-2 rounded-xl border p-3 transition sm:flex-nowrap "+(active?"border-sky-400 bg-sky-50":"border-slate-200 bg-white hover:border-sky-300")}>
              <button type="button" onClick={()=>choose(item)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-sky-500">
              {product?<Thumbnail key={txt(storeId)+":"+txt(item.id)+":"+txt(item.image_url)} item={item} storeId={storeId}/>:<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9f3ff] text-[#145595]"><Users size={20}/></span>}
              <span className="min-w-0 flex-1"><strong className="block break-words text-sm">{item.name||"İsimsiz kayıt"}</strong><span className="mt-1 block break-words text-xs text-slate-500">{(product?[item.sku&&"Stok kodu: "+item.sku,item.barcode&&"Barkod: "+item.barcode,item.brand]:[item.account_code&&"Hesap kodu: "+item.account_code,item.source_cari_no&&"Cari no: "+item.source_cari_no,item.city,item.phone]).filter(Boolean).join(" · ")}</span>
                {product&&<span className="mt-1 block text-xs text-slate-600">Stok: {Number(item.stock||0).toLocaleString("tr-TR")} {item.unit||"adet"}{priceKind&&<span className="ml-3 font-semibold">{priceKind==="purchase"?"Alış":"Satış"}: {money(priceKind==="purchase"?item.purchase_price:item.sale_price)}</span>}</span>}
              </span>
              <span className={"flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold "+(active?"bg-[#123d70] text-white":"bg-slate-100 text-[#174777]")}>{active?<><Check size={14}/>Seçili</>:"Seç"}</span>
              </button>
              {showHistory&&<button type="button" onClick={()=>setHistory(item)} disabled={!partyId} title={partyId?"Bu cariye ait geçmiş satışları göster":"Önce cari hesap seçin"} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs font-bold text-[#174777] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"><History size={15}/>Ürün Hareketleri</button>}
            </div>;
          })}</div>:<p className="py-14 text-center text-sm text-slate-500">Eşleşen {product?"ürün":"cari hesap"} bulunamadı.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
          <span>Sayfa {activePage+1} / {pages}</span><div className="flex items-center gap-2">
            <button type="button" aria-label="Önceki sayfa" disabled={activePage===0} onClick={()=>setPage(activePage-1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft size={17}/></button>
            <button type="button" aria-label="Sonraki sayfa" disabled={activePage+1>=pages} onClick={()=>setPage(activePage+1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight size={17}/></button>
            <Dialog.Close asChild><button type="button" className="rounded-lg border bg-white px-4 py-2 font-semibold">Vazgeç</button></Dialog.Close>
          </div>
        </div>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
