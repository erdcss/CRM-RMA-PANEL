import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, ImagePlus, Loader2, Package, Plus, Save, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/compress-image";
import { parseMarkupPercent, parsePriceInput, productProfitPreview, suggestedSaleFromMarkup } from "@/lib/dukkan-profit-price";

type Product = {
  id: string | number; name: string; sku: string; barcode?: string | null;
  brand?: string | null; category?: string | null; description?: string | null;
  unit?: string | null; stock: number | string; purchase_price?: string | number | null;
  sale_price?: string | number | null; units_per_box?: number; min_order_qty?: number;
  images?: string[] | null; image_data?: string | null; publish_b2b: boolean;
  b2b_product_id?: string | null;
};
type Fields = {
  name: string; sku: string; barcode: string; brand: string; category: string;
  description: string; unit: string; purchasePrice: string; salePrice: string;
  unitsPerBox: string; minOrderQty: string;
};
const EMPTY: Fields = {
  name:"",sku:"",barcode:"",brand:"",category:"",description:"",
  unit:"adet",purchasePrice:"0",salePrice:"0",unitsPerBox:"1",minOrderQty:"1",
};
const fieldStyle="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#172945] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const labelStyle="block text-xs font-bold text-slate-600 mb-1.5";
type MarkupSelection="10"|"20"|"30"|"custom";
const formatTRY=(value:number)=>new Intl.NumberFormat("tr-TR",{
  style:"currency",currency:"TRY",minimumFractionDigits:2,maximumFractionDigits:2,
}).format(value);
const formatRate=(value:number)=>"%"+value.toLocaleString("tr-TR",{maximumFractionDigits:2});

async function request(path:string, options?:RequestInit){
  const response=await fetch(path,{
    credentials:"include",cache:"no-store",...options,
    headers:{"Content-Type":"application/json",...(options?.headers||{})},
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||"İşlem tamamlanamadı");
  return json;
}

/** A dedicated, deep-linkable Dükkan editor that returns to the previous product list. */
export default function DukkanProductEdit({id}:{id:string}){
  const [,navigate]=useLocation();
  const query=new URLSearchParams(window.location.search);
  const storeId=query.get("storeId")||"";
  const [data,setData]=useState<Product|null>(null);
  const [fields,setFields]=useState<Fields>(EMPTY);
  const [images,setImages]=useState<string[]>([]);
  const [selectedMarkup,setSelectedMarkup]=useState<MarkupSelection|null>(null);
  const [customMarkup,setCustomMarkup]=useState("");
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [stockToAdd,setStockToAdd]=useState("");
  const [stockNote,setStockNote]=useState("Ürün kartından stok girişi");
  const [addingStock,setAddingStock]=useState(false);
  const stockInFlight=useRef(false);
  const stockRequestKey=useRef<string|null>(null);
  const [draggingImages,setDraggingImages]=useState(false);
  const [processingImages,setProcessingImages]=useState(false);
  const imageInFlight=useRef(false);
  const dragDepth=useRef(0);
  const imageFileInput=useRef<HTMLInputElement|null>(null);

  const back=()=>{
    let previous="";
    try{
      const stored=JSON.parse(sessionStorage.getItem("dukkan:last-product-list")||"null");
      if(stored?.storeId===storeId && typeof stored?.route==="string" &&
         /^\/dukkan(?:\?[^#]*)?$/.test(stored.route)){
        previous=stored.route;
      }
    }catch{ /* use a safe fallback */ }
    try{
      sessionStorage.setItem("dukkan:return-to-products",storeId);
      if(previous)sessionStorage.setItem("dukkan:restore-scroll","1");
    }catch{ /* storage can be disabled */ }
    navigate(previous||"/dukkan?tab=products&storeId="+encodeURIComponent(storeId));
  };

  useEffect(()=>{
    let live=true;
    if(!storeId||!Number.isSafeInteger(Number(id))||Number(id)<1){
      setError("Ürün veya mağaza kimliği geçersiz.");setLoading(false);return;
    }
    setLoading(true);setError("");
    void request("/api/dukkan/stores/"+encodeURIComponent(storeId)+"/products/"+encodeURIComponent(id))
      .then((product:Product)=>{
        if(!live)return;
        setData(product);
        setSelectedMarkup(null);
        setCustomMarkup("");
        setFields({
          name:String(product.name||""),sku:String(product.sku||""),
          barcode:String(product.barcode||""),brand:String(product.brand||""),
          category:String(product.category||""),description:String(product.description||""),
          unit:String(product.unit||"adet"),
          purchasePrice:String(product.purchase_price??0),
          salePrice:String(product.sale_price??0),
          unitsPerBox:String(product.units_per_box??1),
          minOrderQty:String(product.min_order_qty??1),
        });
        setImages(Array.isArray(product.images)&&product.images.length
          ? product.images:product.image_data?[product.image_data]:[]);
        setPublished(Boolean(product.publish_b2b));
      })
      .catch(e=>{if(live)setError((e as Error).message);})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[id,storeId]);

  // Selecting a markup rate calculates a proposed sale price. Manual edits
  // to sale price exit preset mode while continuing to show actual profit.
  // A purchase-price change recalculates the proposal only while a preset
  // remains selected.
  const update=(key:keyof Fields,value:string)=>{
    if(key==="salePrice")setSelectedMarkup(null);
    setFields(old=>{
      const next={...old,[key]:value};
      if(key==="purchasePrice"&&selectedMarkup!==null){
        const rate=selectedMarkup==="custom"?customMarkup:selectedMarkup;
        const proposed=suggestedSaleFromMarkup(value,rate);
        if(proposed!==null)next.salePrice=proposed.toFixed(2);
      }
      return next;
    });
  };
  const chooseMarkup=(selection:MarkupSelection,manualValue=customMarkup)=>{
    setSelectedMarkup(selection);
    const rate=selection==="custom"?manualValue:selection;
    setFields(old=>{
      const proposed=suggestedSaleFromMarkup(old.purchasePrice,rate);
      return proposed===null?old:{...old,salePrice:proposed.toFixed(2)};
    });
  };
  const profitPreview=productProfitPreview(fields.purchasePrice,fields.salePrice);
  const canApplyMarkup=(parsePriceInput(fields.purchasePrice)||0)>0;
  const invalidCustomMarkup=selectedMarkup==="custom"&&customMarkup.trim()!==""&&parseMarkupPercent(customMarkup)===null;

  const addImages=async(files:File[])=>{
    if(!files.length||imageInFlight.current)return;
    imageInFlight.current=true;
    setProcessingImages(true);
    setError("");
    try{
      if(files.length+images.length>6)
        throw new Error("Toplam en fazla 6 görsel ekleyebilirsiniz. Önce mevcut görsellerden bazılarını kaldırın.");
      if(files.some(file=>!["image/png","image/jpeg","image/webp"].includes(file.type)))
        throw new Error("Yalnızca PNG, JPG ve WebP görseller desteklenir.");
      const uploaded:string[]=[];
      for(const file of files)uploaded.push(await fileToCompressedDataUrl(file));
      setImages(current=>[...current,...uploaded].slice(0,6));
      setNotice(files.length+" görsel eklendi. Kalıcı olması için Değişiklikleri Kaydet'e basın.");
    }catch(e){setError((e as Error).message);}
    finally{imageInFlight.current=false;setProcessingImages(false);}
  };

  const imagesDragEnter=(event:DragEvent<HTMLDivElement>)=>{
    if(!event.dataTransfer.types.includes("Files"))return;
    event.preventDefault();
    dragDepth.current+=1;
    setDraggingImages(true);
  };
  const imagesDragOver=(event:DragEvent<HTMLDivElement>)=>{
    if(!event.dataTransfer.types.includes("Files"))return;
    event.preventDefault();
    event.dataTransfer.dropEffect=processingImages||saving||images.length>=6?"none":"copy";
  };
  const imagesDragLeave=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();
    dragDepth.current=Math.max(0,dragDepth.current-1);
    if(dragDepth.current===0)setDraggingImages(false);
  };
  const imagesDrop=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();
    dragDepth.current=0;
    setDraggingImages(false);
    if(!processingImages&&!saving)void addImages(Array.from(event.dataTransfer.files));
  };

  // A stock addition is its own auditable, idempotent transaction; it doesn't
  // overwrite product.stock in the product detail PATCH request.
  const addStock=async()=>{
    if(!data||addingStock||stockInFlight.current)return;
    const quantity=Number(stockToAdd);
    if(!Number.isFinite(quantity)||quantity<=0||quantity>999999999||
       Math.abs(quantity*1000-Math.round(quantity*1000))>0.00001){
      setError("Eklenecek stok 0'dan büyük ve en fazla 3 ondalıklı olmalıdır.");
      return;
    }
    const note=stockNote.trim();
    if(note.length<3||note.length>500){
      setError("Stok giriş açıklaması 3–500 karakter olmalıdır.");
      return;
    }
    if(!window.confirm(quantity.toLocaleString("tr-TR")+" "+(data.unit||"adet")+
       " stok, "+data.name+" ürününe eklensin mi?"))return;
    stockInFlight.current=true;
    setAddingStock(true);
    setError("");setNotice("");
    try{
      if(!stockRequestKey.current)stockRequestKey.current=crypto.randomUUID();
      const saved=await request(
        "/api/dukkan/stores/"+encodeURIComponent(storeId)+"/stock-movements",{
          method:"POST",
          body:JSON.stringify({
            productId:Number(id),delta:quantity,note,
            requestKey:stockRequestKey.current
          }),
        }
      );
      setData(current=>current?{...current,stock:saved.stock}:current);
      setStockToAdd("");
      stockRequestKey.current=null;
      setNotice(saved.replayed
        ?"Stok girişi daha önce kaydedilmiş; tekrar eklenmedi. Güncel stok yenilendi."
        :"Stok başarıyla eklendi ve Stok Hareketleri'ne kaydedildi.");
    }catch(e){setError((e as Error).message);}
    finally{stockInFlight.current=false;setAddingStock(false);}
  };

  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!data||saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      if(processingImages||imageInFlight.current)throw new Error("Görseller yüklenirken ürün kaydedilemez.");
      if(published&&!images.length)throw new Error("B2B yayını için önce bir görsel ekleyin.");
      if(Number(fields.unitsPerBox)<1||Number(fields.minOrderQty)<1)
        throw new Error("Koli içeriği ve minimum adet en az 1 olmalıdır.");
      await request("/api/dukkan/stores/"+encodeURIComponent(storeId)+"/products/"+encodeURIComponent(id),{
        method:"PATCH",
        body:JSON.stringify({
          ...fields,
          purchasePrice:Number(fields.purchasePrice),
          salePrice:Number(fields.salePrice),
          unitsPerBox:Number(fields.unitsPerBox),
          minOrderQty:Number(fields.minOrderQty),
          publishB2B:published,images,
        }),
      });
      setNotice("Ürün kaydedildi. Çalışkan B2B bağlantısı güncellendi.");
      // Return to the same listing rather than showing the editor inline.
      back();
    }catch(e){setError((e as Error).message);}
    finally{setSaving(false);}
  };

  const field=(name:keyof Fields,label:string,type:"text"|"number"="text",required=false)=>
    <label key={name} className="block min-w-0">
      <span className={labelStyle}>{label}</span>
      <input className={fieldStyle} type={type} step={type==="number"?(name==="purchasePrice"||name==="salePrice"?"0.01":"1"):undefined}
        min={type==="number"?(name==="unitsPerBox"||name==="minOrderQty"?"1":"0"):undefined}
        required={required} value={fields[name]} onChange={e=>update(name,e.target.value)}/>
    </label>;

  return <main className="h-full min-h-0 overflow-y-auto bg-[#f3f7fc] text-[#142b4e]">
    <div className="mx-auto max-w-[1220px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#17385f] shadow-sm hover:bg-slate-50">
          <ArrowLeft size={19}/> Geri Dön
        </button>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ShieldCheck size={17}/> Çalışkan Dükkân · Ürün Yönetimi
        </span>
      </div>
      <div className="mb-5 rounded-[24px] border border-[#dce6f3] bg-white px-5 py-6 shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4ff] text-[#215b92]"><Package size={24}/></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Ürün Düzenleme</p>
            <h1 className="truncate text-xl font-black sm:text-2xl">{data?.name||"Ürün bilgileri"}</h1>
            <p className="mt-1 text-xs text-slate-500">Stok kodu: {data?.sku||"—"} · Mağaza stok kartı #{id}</p>
          </div>
        </div>
      </div>
      {error?<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>:null}
      {notice?<div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>:null}
      {loading?<div className="rounded-2xl bg-white p-10 text-center text-slate-500">Ürün bilgileri yükleniyor…</div>:data?(
        <form onSubmit={submit} className="space-y-5">
          <section className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mb-5 text-base font-black">Ürün Bilgileri</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {field("name","Ürün Adı","text",true)}
              {field("sku","Stok Kodu","text",true)}
              {field("barcode","Barkod")}
              {field("brand","Marka")}
              {field("category","Kategori")}
              {field("unit","Birim","text",true)}
              {field("purchasePrice","Alış Fiyatı (TL)","number",true)}
              <div className="min-w-0">
                {field("salePrice","Satış Fiyatı (TL)","number",true)}
                <div className="mt-2 rounded-xl border border-[#d9e6f6] bg-[#f7faff] p-3"
                  aria-label="Ürün kâr oranı ve kâr hesabı">
                  <p className="mb-2 text-xs font-bold text-[#17385f]">Alış fiyatına göre kâr ekle</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["10","20","30"] as const).map(rate=>
                      <button type="button" key={rate} onClick={()=>chooseMarkup(rate)}
                        aria-pressed={selectedMarkup===rate}
                        disabled={!canApplyMarkup||saving}
                        className={"min-h-9 rounded-lg border px-1 text-xs font-bold transition-colors disabled:opacity-40 "+
                          (selectedMarkup===rate?"border-sky-700 bg-[#17385f] text-white":
                          "border-slate-200 bg-white text-[#17385f] hover:border-sky-400")}>
                        %{rate}
                      </button>
                    )}
                    <button type="button" onClick={()=>chooseMarkup("custom")}
                      aria-pressed={selectedMarkup==="custom"}
                      disabled={!canApplyMarkup||saving}
                      className={"min-h-9 rounded-lg border px-1 text-xs font-bold transition-colors disabled:opacity-40 "+
                        (selectedMarkup==="custom"?"border-sky-700 bg-[#17385f] text-white":
                        "border-slate-200 bg-white text-[#17385f] hover:border-sky-400")}>
                      Manuel
                    </button>
                  </div>
                  {selectedMarkup==="custom"?<label className="mt-3 block">
                    <span className={labelStyle}>Manuel kâr oranı (%)</span>
                    <input type="text" inputMode="decimal" value={customMarkup}
                      aria-label="Manuel kâr oranı"
                      placeholder="Örn. 17,5" disabled={saving}
                      onChange={event=>{
                        const value=event.target.value;
                        setCustomMarkup(value);
                        chooseMarkup("custom",value);
                      }}
                      className={fieldStyle+" py-2.5"}/>
                    {invalidCustomMarkup?<p role="alert" className="mt-1 text-xs text-red-600">
                      0 ile 1000 arasında geçerli bir oran girin.
                    </p>:null}
                  </label>:null}
                  {!canApplyMarkup?<p className="mt-2 text-xs text-amber-700">
                    Oran uygulamak için önce alış fiyatını 0'dan büyük girin.
                  </p>:null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-[11px] text-slate-500">Alışa göre kâr oranı</p>
                      <strong className={"mt-1 block text-sm tabular-nums "+
                        (profitPreview?.profit!=null&&profitPreview.profit<0?"text-red-700":"text-emerald-700")}>
                        {profitPreview?formatRate(profitPreview.markupPercent):"—"}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-[11px] text-slate-500">Birim kâr tutarı</p>
                      <strong className={"mt-1 block text-sm tabular-nums "+
                        (profitPreview?.profit!=null&&profitPreview.profit<0?"text-red-700":"text-emerald-700")}>
                        {profitPreview?formatTRY(profitPreview.profit):"—"}
                      </strong>
                    </div>
                  </div>
                  {profitPreview?<p className="mt-2 text-xs text-slate-600">
                    Satış fiyatındaki kâr marjı: <strong>{formatRate(profitPreview.marginPercent)}</strong>
                  </p>:null}
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">
                    Hesap alış ve satış fiyatı farkıdır. KDV, komisyon, kargo ve diğer
                    giderler düşülmediğinden muhasebesel net kâr değildir.
                  </p>
                </div>
              </div>
              {field("unitsPerBox","Koli İçi Adet","number",true)}
              {field("minOrderQty","Minimum Sipariş Adedi","number",true)}
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-[#d9e6f6] bg-[#f7faff] p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(210px,2fr)_auto] sm:items-end">
                  <div>
                    <span className={labelStyle}>Güncel Stok</span>
                    <div className={fieldStyle+" bg-white font-extrabold tabular-nums"}>
                      {Number(data.stock||0).toLocaleString("tr-TR",{maximumFractionDigits:3})} {data.unit||"adet"}
                    </div>
                  </div>
                  <label className="block min-w-0">
                    <span className={labelStyle}>Eklenecek Stok</span>
                    <input className={fieldStyle} type="number" inputMode="decimal"
                      min="0.001" max="999999999" step="0.001" placeholder="Örn: 12"
                      value={stockToAdd} disabled={addingStock}
                      onChange={e=>{setStockToAdd(e.target.value);stockRequestKey.current=null;}}/>
                  </label>
                  <label className="block min-w-0">
                    <span className={labelStyle}>Stok Giriş Açıklaması</span>
                    <input className={fieldStyle} type="text" maxLength={500}
                      value={stockNote} disabled={addingStock}
                      onChange={e=>{setStockNote(e.target.value);stockRequestKey.current=null;}}/>
                  </label>
                  <button type="button" disabled={addingStock||!stockToAdd}
                    onClick={()=>void addStock()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#122a51] px-5 py-3 text-sm font-bold text-white hover:bg-[#1c4b83] disabled:opacity-50">
                    {addingStock?<Loader2 size={17} className="animate-spin"/>:<Plus size={18}/>}
                    {addingStock?"Ekleniyor…":"Stok Ekle"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Stok Ekle işlemi anında kaydedilir ve Stok Hareketleri'nde görünür.
                  Diğer ürün bilgilerini kaydetmek için Değişiklikleri Kaydet'i kullanın.
                </p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className={labelStyle}>Ürün Açıklaması</span>
              <textarea className={fieldStyle+" min-h-32 resize-y"} value={fields.description}
                onChange={e=>update("description",e.target.value)} maxLength={4000}/>
            </label>
          </section>
          <section className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4">
              <h2 className="text-base font-black">Ürün Görselleri</h2>
              <p className="mt-1 text-xs text-slate-500">En fazla 6 fotoğraf · PNG, JPG, WebP · Dosya başına en fazla 15 MB. İlk görsel kapaktır.</p>
            </div>
            <div
              onDragEnter={imagesDragEnter} onDragOver={imagesDragOver}
              onDragLeave={imagesDragLeave} onDrop={imagesDrop}
              className={"mb-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors duration-200 "+
                (draggingImages?"border-sky-500 bg-sky-100 ring-2 ring-sky-200":
                "border-[#c6d9ef] bg-[#f7faff] hover:border-sky-400 hover:bg-sky-50")}>
              <input ref={imageFileInput} type="file" multiple accept="image/jpeg,image/png,image/webp"
                className="sr-only" aria-label="Ürün görsellerini seç"
                onChange={e=>{void addImages(Array.from(e.target.files||[]));e.target.value="";}}/>
              {processingImages?<Loader2 size={30} className="mx-auto animate-spin text-[#205a93]"/>:
                <UploadCloud size={30} className="mx-auto text-[#205a93]"/>}
              <p className="mt-2 text-sm font-bold text-[#17385f]">
                {processingImages?"Görseller hazırlanıyor…":
                 draggingImages?"Görselleri buraya bırakın":
                 "Görselleri sürükleyip buraya bırakın"}
              </p>
              <p className="mt-1 text-xs text-slate-500">veya bilgisayarınızdan bir ya da birden fazla görsel seçin</p>
              <button type="button" onClick={()=>imageFileInput.current?.click()}
                disabled={processingImages||saving||images.length>=6}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#122a51] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1c4b83] disabled:opacity-40">
                <ImagePlus size={17}/> {images.length>=6?"Görsel sınırına ulaşıldı":"Görsel Seç"}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">{images.length} / 6 görsel eklendi</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.length?images.map((url,i)=><div key={i} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={url} alt={"Ürün görseli "+(i+1)} className="h-full w-full object-contain"/>
                <button type="button" disabled={processingImages} onClick={()=>setImages(old=>old.filter((_,n)=>n!==i))}
                  className="absolute right-1 top-1 rounded-lg bg-white p-1.5 text-red-600 shadow" aria-label={"Görseli sil "+(i+1)}>
                  <Trash2 size={15}/></button>
                {i===0?<span className="absolute bottom-1 left-1 rounded bg-[#122a51] px-2 py-1 text-[10px] font-bold text-white">Kapak</span>:null}
              </div>):<p className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">Görsel eklenmemiş</p>}
            </div>
          </section>
          <section className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-black">Çalışkan B2B'de Yayınla</span>
                <span className="mt-1 block text-xs text-slate-500">{published?"Ürün B2B kataloğunda yayında.":"Ürün Dükkân stoklarında kalır ancak B2B'de görünmez."}</span>
              </span>
              <input type="checkbox" role="switch" checked={published} onChange={e=>setPublished(e.target.checked)}
                aria-label="Çalışkan B2B yayın durumu" className="h-6 w-6 accent-emerald-600"/>
            </label>
          </section>
          <div className="flex flex-wrap justify-end gap-3 pb-12">
            <button type="button" onClick={back} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold">Vazgeç</button>
            <button disabled={saving||processingImages||addingStock} type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#122a51] px-6 py-3 text-sm font-bold text-white hover:bg-[#1c4b83] disabled:opacity-50">
              {saving?<Save size={18}/>:<Check size={18}/>} {saving?"Kaydediliyor…":"Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      ):<div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Ürün yüklenemedi. Geri dönerek tekrar deneyin.</div>}
    </div>
  </main>;
}
