import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, ImagePlus, Package, Save, ShieldCheck, Trash2 } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/compress-image";

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
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

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

  const update=(key:keyof Fields,value:string)=>setFields(old=>({...old,[key]:value}));

  const addImages=async(files:File[])=>{
    setError("");
    try{
      if(images.length+files.length>6)throw new Error("En fazla 6 görsel ekleyebilirsiniz.");
      if(files.some(file=>!["image/png","image/jpeg","image/webp"].includes(file.type)))
        throw new Error("Yalnızca PNG, JPG ve WebP görseller desteklenir.");
      const uploaded=await Promise.all(files.map(fileToCompressedDataUrl));
      setImages(current=>[...current,...uploaded].slice(0,6));
    }catch(e){setError((e as Error).message);}
  };

  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!data||saving)return;
    setSaving(true);setError("");setNotice("");
    try{
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
              {field("salePrice","Satış Fiyatı (TL)","number",true)}
              {field("unitsPerBox","Koli İçi Adet","number",true)}
              {field("minOrderQty","Minimum Sipariş Adedi","number",true)}
              <div>
                <span className={labelStyle}>Güncel Stok</span>
                <div className={fieldStyle+" bg-slate-50 text-slate-500"}>{Number(data.stock||0).toLocaleString("tr-TR")}</div>
                <p className="mt-1 text-[11px] text-slate-500">Stok değişiklikleri Stok Hareketleri ekranından yapılır.</p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className={labelStyle}>Ürün Açıklaması</span>
              <textarea className={fieldStyle+" min-h-32 resize-y"} value={fields.description}
                onChange={e=>update("description",e.target.value)} maxLength={4000}/>
            </label>
          </section>
          <section className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black">Ürün Görselleri</h2>
                <p className="mt-1 text-xs text-slate-500">En fazla 6 fotoğraf. İlk görsel kapak olarak kullanılır.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">
                <ImagePlus size={17}/> Görsel Ekle
                <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp"
                  onChange={e=>{void addImages(Array.from(e.target.files||[]));e.target.value="";}}/>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.length?images.map((url,i)=><div key={i} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={url} alt={"Ürün görseli "+(i+1)} className="h-full w-full object-contain"/>
                <button type="button" onClick={()=>setImages(old=>old.filter((_,n)=>n!==i))}
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
            <button disabled={saving} type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#122a51] px-6 py-3 text-sm font-bold text-white hover:bg-[#1c4b83] disabled:opacity-50">
              {saving?<Save size={18}/>:<Check size={18}/>} {saving?"Kaydediliyor…":"Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      ):<div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Ürün yüklenemedi. Geri dönerek tekrar deneyin.</div>}
    </div>
  </main>;
}
