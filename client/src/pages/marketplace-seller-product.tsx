
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, ImagePlus, Package, Save, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MarketplaceHolidayBanner } from "@/components/marketplace-holiday-banner";

type Fields={
  name:string;sku:string;description:string;brand:string;category:string;barcode:string;
  imageUrl:string;unitsPerBox:string;minBoxes:string;leadDays:string;
};
type RecordItem={id:number;sku:string;stock:number;current_price:number|string|null;is_enabled:boolean;
  latest?:{id:number;status:string;review_note:string;content:Record<string,unknown>};
  live?:Record<string,unknown>};
const input="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200";
const label="mb-1.5 block text-xs font-bold text-slate-600";
const section="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const names:Record<string,string>={approved:"Onaylandı",pending:"Onay bekliyor",rejected:"Reddedildi"};
const money=(v:unknown)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(Number(v||0));
function toFields(p:RecordItem):Fields{
  const info=p.latest?.status==="pending"?p.latest?.content:p.live||p.latest?.content||{};
  return {
    sku:String(info?.sku||p.sku),name:String(info?.name||""),
    description:String(info?.description||""),brand:String(info?.brand||""),
    category:String(info?.category||""),barcode:String(info?.barcode||""),
    imageUrl:String(info?.imageUrl||""),unitsPerBox:String(info?.unitsPerBox||1),
    minBoxes:String(info?.minBoxes||1),leadDays:String(info?.leadDays||1),
  };
}
export default function MarketplaceSellerProduct({id}:{id:string}){
  const {data:items=[],isLoading,error}=useQuery<RecordItem[]>({
    queryKey:["/api/marketplace/seller/products"],staleTime:0,
  });
  const p=items.find(item=>String(item.id)===id);
  const [stock,setStock]=useState("");
  const [price,setPrice]=useState("");
  const [form,setForm]=useState<Fields|null>(null);
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [notice,setNotice]=useState(""),[failure,setFailure]=useState("");
  useEffect(()=>{
    if(!p)return;
    setStock(String(p.stock));
    setPrice(String(p.current_price??p.live?.price??p.latest?.content?.price??""));
    setForm(toFields(p));
  },[p?.id,p?.stock,p?.current_price,p?.latest?.id]);

  const update=(field:keyof Fields,value:string)=>setForm(prev=>prev?{...prev,[field]:value}:prev);
  async function refresh(){
    await queryClient.invalidateQueries({queryKey:["/api/marketplace/seller/products"]});
    await queryClient.invalidateQueries({queryKey:["/api/marketplace/seller/dashboard"]});
  }
  async function quickUpdate(){
    if(!p||busy)return;
    setBusy(true);setFailure("");setNotice("");
    try{
      const numeric=Number(price),count=Number(stock);
      if(!Number.isFinite(numeric)||numeric<=0||!Number.isSafeInteger(count)||count<0)
        throw new Error("Fiyat sıfırdan büyük, stok ise sıfır veya pozitif tam sayı olmalıdır.");
      await apiRequest("PATCH","/api/marketplace/seller/products/"+p.id+"/quick",{price:numeric,stock:count});
      setNotice("Fiyat ve stok hemen güncellendi. Yönetici onayı gerekmiyor.");
      await refresh();
    }catch(e){setFailure(e instanceof Error?e.message:"Fiyat veya stok güncellenemedi");}
    finally{setBusy(false);}
  }
  async function upload(file:File){
    setUploading(true);setFailure("");setNotice("");
    try {
      if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("JPEG, PNG veya WebP görsel yükleyin.");
      const dataUrl=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Dosya okunamadı"));
        reader.readAsDataURL(file);
      });
      const res=await apiRequest("POST","/api/marketplace/seller/media",{dataUrl});
      const result=await res.json() as {url:string};
      update("imageUrl",result.url);
      setNotice("Görsel yüklendi. Yayınlanması için değişiklikleri onaya göndermelisiniz.");
    }catch(e){setFailure(e instanceof Error?e.message:"Görsel yüklenemedi");}
    finally{setUploading(false);}
  }
  async function submitRevision(e:FormEvent){
    e.preventDefault();
    if(!p||!form||busy)return;
    setBusy(true);setFailure("");setNotice("");
    try{
      if(p.latest?.status==="pending")throw new Error("Mevcut değişiklikler henüz yönetici onayında.");
      if(!form.imageUrl)throw new Error("Ürün görseli zorunludur.");
      const c=p.live||p.latest?.content||{};
      await apiRequest("POST","/api/marketplace/seller/products/"+p.id+"/revisions",{
        sku:form.sku,
        product:{
          name:form.name,description:form.description,brand:form.brand,
          category:form.category,barcode:form.barcode,imageUrl:form.imageUrl,
          price:Number(p.current_price??c.price??1),unitsPerBox:Number(form.unitsPerBox),
          minBoxes:Number(form.minBoxes),leadDays:Number(form.leadDays),
        },
      });
      setNotice("Ürün bilgilerindeki değişiklikler yönetici onayına gönderildi. Yayındaki sürüm değişmedi.");
      await refresh();
    }catch(e){setFailure(e instanceof Error?e.message:"Değişiklik gönderilemedi");}
    finally{setBusy(false);}
  }
  const pending=p?.latest?.status==="pending";
  return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-950">
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/satici" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-black">
        <ArrowLeft className="h-4 w-4"/>Ürünlerime dön
      </Link>
      <div className="sticky top-0 z-30"><MarketplaceHolidayBanner/></div>
      {isLoading?<div className={section}>Ürün yükleniyor…</div>:
      error?<div role="alert" className={section}>Ürün bilgileri alınamadı. Tedarikçi hesabınızla giriş yapın veya yeniden deneyin.</div>:
      !p?<div className={section}>Ürün bulunamadı veya bu hesaba ait değil.</div>:
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold text-amber-600">ÇALIŞKAN B2B · TEDARİKÇİ ÜRÜN YÖNETİMİ</p>
            <h1 className="mt-1 text-2xl font-black">{String((p.live||p.latest?.content)?.name||p.sku)}</h1>
            <p className="mt-1 text-sm text-slate-500">Ürün #{p.id} · {p.sku}</p></div>
          <span className={"rounded-full px-4 py-2 text-xs font-bold "+(pending?"bg-amber-100 text-amber-900":"bg-green-100 text-green-800")}>
            {p.live?"Yayında":names[p.latest?.status||""]||"İncelemede"}{pending?" · Değişiklik onay bekliyor":""}
          </span>
        </div>
        {failure?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{failure}</div>:null}
        {notice?<div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>:null}
        <section className={section}>
          <div className="mb-4 flex items-center gap-2"><Save className="h-5 w-5 text-green-600"/>
            <div><h2 className="text-lg font-extrabold">Fiyat ve Stok · Hemen Güncelle</h2>
              <p className="text-sm text-slate-500">Bu iki alan değiştirildiğinde yönetici onayı beklenmez.</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><label htmlFor="livePrice" className={label}>Birim satış fiyatı (₺)</label>
              <input id="livePrice" className={input} type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></div>
            <div><label htmlFor="liveStock" className={label}>Stok (adet)</label>
              <input id="liveStock" className={input} type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></div>
            <button type="button" onClick={()=>void quickUpdate()} disabled={busy} className="min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Kaydet</button>
          </div>
        </section>
        {form?<form onSubmit={e=>void submitRevision(e)} className={section+" space-y-5"}>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 text-amber-600"/>
            <div><h2 className="text-lg font-black">Ürün Bilgilerini Düzenle</h2>
              <p className="mt-1 text-sm text-slate-600">Başlık, stok kodu, barkod, görsel, marka, kategori, koli ve termin değişiklikleri yönetici onayına gönderilir. Onaydan önce müşteriye eski onaylı bilgiler gösterilmeye devam eder.</p></div>
          </div>
          {pending?<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0"/>
            <span>Bu ürünün değişiklikleri şu anda yönetici onayında. Fiyat ve stok yine güncellenebilir.</span>
          </div>:null}
          {p.latest?.status==="rejected"&&p.latest.review_note?<div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Yönetici ret gerekçesi: {p.latest.review_note}
          </div>:null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ["sku","Stok Kodu"],["name","Ürün Başlığı"],["brand","Marka"],
              ["category","Kategori"],["barcode","Barkod"],
              ["unitsPerBox","Koli İçi Adet"],["minBoxes","Minimum Alım (Koli)"],
              ["leadDays","Termin Süresi (Gün)"],
            ] as const).map(([key,title])=><div key={key}>
              <label className={label} htmlFor={"edit-"+key}>{title}</label>
              <input id={"edit-"+key} disabled={pending||busy||uploading}
                required={["sku","name","category","unitsPerBox","minBoxes","leadDays"].includes(key)}
                className={input} type={["unitsPerBox","minBoxes","leadDays"].includes(key)?"number":"text"}
                min={["unitsPerBox","minBoxes","leadDays"].includes(key)?1:undefined}
                max={key==="leadDays"?14:undefined} step={["unitsPerBox","minBoxes","leadDays"].includes(key)?1:undefined}
                value={form[key]} onChange={e=>update(key,e.target.value)}/>
            </div>)}
          </div>
          <div><label htmlFor="description" className={label}>Ürün Açıklaması ve Özellikleri</label>
            <textarea id="description" className={input} rows={5} maxLength={4000}
              disabled={pending||busy||uploading} value={form.description} onChange={e=>update("description",e.target.value)}/>
          </div>
          <div>
            <p className={label}>Ürün Görseli</p>
            <div className="flex flex-wrap items-start gap-4">
              {form.imageUrl?<img src={form.imageUrl} className="h-36 w-36 rounded-xl border bg-white object-contain p-2" alt="Ürün görseli"/>:
                <div className="flex h-36 w-36 items-center justify-center rounded-xl border bg-slate-100"><ImagePlus className="h-10 w-10 text-slate-400"/></div>}
              <label className="max-w-sm text-sm text-slate-600">
                JPEG, PNG veya WebP görsel yükleyin. Yeni görsel yalnızca onaydan sonra yayımlanır.
                <input disabled={pending||busy||uploading} type="file" accept="image/jpeg,image/png,image/webp"
                  className="mt-3 block w-full text-sm"
                  onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
              </label>
            </div>
          </div>
          <button disabled={busy||uploading||pending} type="submit"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            <Package className="h-4 w-4"/>Değişiklikleri Yönetici Onayına Gönder
          </button>
        </form>:null}
      </div>}
    </div>
  </main>;
}
