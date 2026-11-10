import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowDown,ArrowUp,Check,ImageOff,Package,Plus,Search,Trash2,X} from "lucide-react";
import {
  appendCampaignProduct,campaignProductId,campaignProductImage,campaignProductPrice,findCampaignProducts,
  type CampaignProductOption,
} from "@/lib/campaign-product-picker";

function Thumbnail({product,large=false}:{product?:CampaignProductOption;large?:boolean}){
  const url=campaignProductImage(product);
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[url]);
  return <div className={large
    ?"relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 sm:h-28 sm:w-28"
    :"relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-[72px] sm:w-[72px]"}>
    {url&&!failed?
      <img src={url} alt={product?.name||"Ürün"} loading="lazy" onError={()=>setFailed(true)}
        className="h-full w-full object-contain p-1.5"/>:
      <ImageOff aria-label="Görsel yok" className="h-6 w-6 text-slate-300"/>}
  </div>;
}
type Props={
  products:CampaignProductOption[];
  assignedIds:string[];
  onChange:(ids:string[])=>void;
  loading?:boolean;
  loadError?:string;
  onRetry?:()=>void;
};
export function AdminCampaignProductPicker({products,assignedIds,onChange,loading=false,loadError,onRetry}:Props){
  const [search,setSearch]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const candidates=useMemo(()=>findCampaignProducts(products,search,assignedIds,18),
    [products,search,assignedIds]);
  const byId=useMemo(()=>new Map(products.map(p=>[campaignProductId(p.id),p])),[products]);
  const canAdd=assignedIds.length<60;
  const add=(id:string)=>{
    const next=appendCampaignProduct(assignedIds,id);
    if(next!==assignedIds)onChange(next);
    input.current?.focus();
  };
  const move=(index:number,direction:-1|1)=>{
    const other=index+direction;
    if(other<0||other>=assignedIds.length)return;
    const next=[...assignedIds];
    [next[index],next[other]]=[next[other],next[index]];
    onChange(next);
  };
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Kampanyaya ürün ata">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-4 text-white sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
          <Package className="h-5 w-5"/>
        </div>
        <div>
          <h3 className="text-base font-black">Kampanya Ürünleri <span className="text-amber-300">({assignedIds.length}/60)</span></h3>
          <p className="mt-0.5 text-xs text-slate-300">Arayın, görseli inceleyin ve ürünleri tek tek ekleyin.</p>
        </div>
      </div>
      {assignedIds.length>0&&<button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
        onClick={()=>{if(window.confirm("Kampanyaya atanan tüm ürünleri kaldırmak istiyor musunuz?"))onChange([]);}}>
        <Trash2 className="mr-1 inline h-3.5 w-3.5"/> Tümünü Kaldır
      </button>}
    </header>

    <div className="space-y-4 px-4 py-5 sm:px-5">
      <div>
        <label htmlFor="campaign-product-search" className="mb-2 block text-xs font-bold text-slate-700">
          Ürün adı, stok kodu, marka veya kategori ile ara
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/>
          <input id="campaign-product-search" ref={input} type="search" value={search}
            onChange={event=>setSearch(event.target.value)}
            placeholder="Örn: RUBENIS şemsiye veya CV-15L"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm font-semibold text-slate-950 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/35"/>
          {search&&<button type="button" aria-label="Aramayı temizle" onClick={()=>{setSearch("");input.current?.focus();}}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-200"><X size={17}/></button>}
        </div>
        {loadError&&<div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <span>Ürün kataloğu alınamadı: {loadError}</span>
          {onRetry&&<button type="button" onClick={onRetry} className="rounded-md bg-rose-700 px-3 py-1.5 font-bold text-white">Tekrar Dene</button>}
        </div>}
        <p className="mt-2 text-xs text-slate-500">
          {loading?"Ürün kataloğu yükleniyor…":
            search.trim().length<2?"Aramak için en az 2 karakter yazın.":
            loadError?"Ürün kataloğu yüklenemedi: "+loadError:
            candidates.length?candidates.length+" sonuç gösteriliyor · Atanan ürünler sonuçlardan çıkarılır":
              "Eşleşen veya eklenebilir ürün bulunamadı."}
        </p>
      </div>

      {search.trim().length>=2&&<div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80" aria-label="Ürün arama sonuçları">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-4">
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">Arama sonuçları</h4>
          {!canAdd&&<span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">60 ürün sınırı</span>}
        </div>
        {!candidates.length?<div className="px-4 py-8 text-center text-sm text-slate-500">
          {loading?"Ürünler yükleniyor…":loadError?"Ürünler getirilemedi. Katalog bağlantısını kontrol edin.":"Başka bir ürün adı veya stok kodu deneyin."}
        </div>:
        <div className="max-h-[425px] divide-y divide-slate-100 overflow-y-auto">
          {candidates.map(product=>{
            const id=campaignProductId(product.id);
            return <div key={String(product.id)} className="group flex items-center gap-3 bg-white p-3 transition-colors hover:bg-amber-50/60 sm:gap-4 sm:p-4">
              <Thumbnail product={product}/>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-2 break-words text-xs font-extrabold leading-5 text-slate-900 sm:text-sm">{product.name}</p>
                <p className="truncate text-[11px] text-slate-500">
                  <span className="font-bold text-slate-600">{product.sku||"Stok kodu yok"}</span>
                  {product.brand?" · "+product.brand:""}{product.category?" · "+product.category:""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-800">{campaignProductPrice(product.price)}</span>
                  {product.stock!==null&&product.stock!==undefined&&
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Stok: {Number(product.stock)||0}</span>}
                </div>
              </div>
              <button type="button" disabled={!canAdd} onClick={()=>add(id)}
                aria-label={product.name+" ürününü kampanyaya ekle"}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white transition-colors hover:bg-amber-400 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4">
                <Plus className="h-4 w-4"/> Ekle
              </button>
            </div>;
          })}
        </div>}
      </div>}

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-black text-slate-950">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950"><Check className="h-3.5 w-3.5"/></span>
            Kampanyaya Eklenen Ürünler
          </h4>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-950">{assignedIds.length} ürün seçildi</span>
        </div>
        {!assignedIds.length?
          <div className="flex flex-col items-center rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-8 text-center">
            <Package className="h-8 w-8 text-amber-500"/>
            <p className="mt-2 text-sm font-bold text-slate-700">Henüz ürün eklenmedi</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">Yukarıdaki arama alanından ürün bulun, görsellerini inceleyin ve Ekle butonuna basın.</p>
          </div>:
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Kampanya ürün sıralaması">
            {assignedIds.map((id,index)=>{
              const item=byId.get(id);
              return <article key={id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-amber-300">
                <div className="flex items-start gap-3 p-3">
                  <Thumbnail product={item} large/>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1 text-[10px] font-black text-amber-300">
                      <Check className="h-3 w-3"/> {index+1}. ÜRÜN
                    </span>
                    <h5 className="mt-2 line-clamp-2 break-words text-xs font-black leading-5 text-slate-900 sm:text-sm">
                      {item?.name||"Ürün katalogda bulunamadı"}
                    </h5>
                    <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{item?.sku||"ID: "+id}</p>
                    {item&&<p className="mt-2 text-sm font-black text-slate-950">{campaignProductPrice(item.price)}</p>}
                    {item?.is_active===false&&<p className="mt-1 text-[10px] font-bold text-rose-600">Ürün yayında değil</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="truncate text-[11px] font-semibold text-slate-500">{item?.category||item?.brand||"Çalışkan B2B"}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label={id+" ürününü yukarı taşı"} disabled={!index}
                      onClick={()=>move(index,-1)}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:border-amber-300 hover:text-slate-950 disabled:opacity-30"><ArrowUp size={15}/></button>
                    <button type="button" aria-label={id+" ürününü aşağı taşı"} disabled={index>=assignedIds.length-1}
                      onClick={()=>move(index,1)}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:border-amber-300 hover:text-slate-950 disabled:opacity-30"><ArrowDown size={15}/></button>
                    <button type="button" aria-label={id+" ürününü kampanyadan çıkar"}
                      onClick={()=>onChange(assignedIds.filter(v=>v!==id))}
                      className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"><Trash2 size={15}/></button>
                  </div>
                </div>
              </article>;
            })}
          </div>
        }
        <p className="mt-3 text-[11px] leading-5 text-slate-500">Kartların sırası web ve mobil kampanya sayfasında korunur. Değişiklikler için üstteki <b>Değişiklikleri Kaydet</b> butonuna basın.</p>
      </div>
    </div>
  </section>;
}
