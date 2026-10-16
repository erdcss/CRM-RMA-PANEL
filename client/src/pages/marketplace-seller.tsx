
import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Store, Package, Film, MessageCircle, FileText, ShieldCheck, ArrowLeft, RefreshCw, Building2, CheckCircle2, LogOut, LayoutDashboard, RotateCcw, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SellerAccess } from "@/components/seller-access";

type Supplier={id:number;slug:string;company_name:string;status:string;review_note?:string;has_tax_document?:boolean;company_type?:string};
type Product={id:number;sku:string;stock:number;latest?:{id:number;status:string;content:{name:string;imageUrl?:string;brand?:string;category?:string;description?:string;unitsPerBox?:number;price?:number;leadDays?:number};review_note?:string};live?:{name:string}};
type Conversation={id:number;company_name:string;slug:string;latest_message:string;buyer_user_id:number};
type Quote={id:number;status:string;boxes:number;details:string;sku?:string;company_name?:string;latest_offer?:{amount_per_box:string;expires_at:string}};
type Dashboard={supplier:Supplier;productCount:number;followers:number;conversations:number;openQuotes:number;
  storeVersions:Array<{id:number;status:string;is_live:boolean;review_note:string}>;
  reels:Array<{id:number;title:string;status:string;review_note:string}>};
type Tab="dashboard"|"store"|"products"|"reels"|"messages"|"quotes"|"returns"|"payments"|"verification";
async function send(method:string,path:string,data?:unknown){const r=await apiRequest(method,path,data);return r.json();}
const inputStyle="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900";
const boxStyle="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6";
const statusTR:Record<string,string>={approved:"Onaylandı",pending:"Onay bekliyor",rejected:"Reddedildi",requested:"Talep edildi",offered:"Teklif verildi",accepted:"Kabul edildi",expired:"Süresi doldu"};
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</label>;}
function Notice({text}:{text:string}){return <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{text}</div>;}
export default function MarketplaceSeller(){
  const [tab,setTab]=useState<Tab>("dashboard");
  const [verification,setVerification]=useState({companyType:"",iban:"",taxDocument:"",taxNumber:"",taxOffice:"",contactPhone:"",contactEmail:""});
  const [form,setForm]=useState({companyName:"",taxNumber:"",taxOffice:"",contactName:"",contactPhone:"",contactEmail:"",description:""});
  const [store,setStore]=useState({title:"",tagline:"",accent:"#FACC15",bannerUrl:"",logoUrl:"",sections:["banner","categories","products","reels","about"]});
  const [product,setProduct]=useState({sku:"",stock:"0",name:"",description:"",category:"",brand:"",barcode:"",imageUrl:"",price:"",unitsPerBox:"1",minBoxes:"1",leadDays:"1"});
  const [productFormOpen,setProductFormOpen]=useState(false);
  const [productFilter,setProductFilter]=useState<"all"|"approved"|"pending"|"rejected">("all");
  const [aiRows,setAiRows]=useState<Array<Record<string,string|number>>>([]);
  const [aiLoading,setAiLoading]=useState(false);
  const [reel,setReel]=useState({title:"",videoUrl:"",productId:""});
  const [reply,setReply]=useState("");
  const [selectedChat,setSelectedChat]=useState<number|null>(null);
  const [offer,setOffer]=useState({quoteId:"",amountPerBox:"",deliveryTerms:"",validHours:"72"});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  async function upload(file:File, target:"logoUrl"|"bannerUrl"|"imageUrl"|"videoUrl"){
    setUploading(true);setMessage("");
    try{
      const dataUrl=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=()=>reject(new Error("Dosya okunamadı"));
        reader.readAsDataURL(file);
      });
      const result=await send("POST","/api/marketplace/seller/media",{dataUrl}) as {url:string};
      if(target==="logoUrl"||target==="bannerUrl")setStore(v=>({...v,[target]:result.url}));
      else if(target==="imageUrl")setProduct(v=>({...v,imageUrl:result.url}));
      else setReel(v=>({...v,videoUrl:result.url}));
      setMessage("Medya güvenli biçimde yüklendi.");
    }catch(e){setMessage(e instanceof Error?e.message:"Medya yüklenemedi");}
    finally{setUploading(false);}
  }
  const me=useQuery<Supplier|null>({queryKey:["/api/marketplace/me"],retry:false,staleTime:0});
  useEffect(()=>{
    if (!me.isSuccess || me.data !== null) return;
    let cancelled=false;
    void fetch("/api/marketplace/seller/bootstrap",{method:"POST",credentials:"include"})
      .then(async response=>{if(!response.ok)throw new Error("Panel oluşturulamadı");if(!cancelled)await queryClient.invalidateQueries({queryKey:["/api/marketplace/me"]});})
      .catch(()=>{if(!cancelled)setMessage("Çalışma alanı oluşturulamadı. Yenile ile tekrar deneyin.");});
    return ()=>{cancelled=true};
  },[me.isSuccess,me.data]);
  const approved=me.data?.status==="approved";
  const verificationSubmitted=Boolean(me.data?.has_tax_document && me.data?.company_type);
  const [verificationHiding,setVerificationHiding]=useState(false);
  async function submitVerification(){setBusy(true);setMessage("");try {await send("POST","/api/marketplace/seller/verification",verification);setVerificationHiding(true);await queryClient.invalidateQueries({queryKey:["/api/marketplace/me"]});setTab("dashboard");setMessage("Doğrulama bilgileriniz incelemeye gönderildi.");}catch(e){setMessage(e instanceof Error?e.message:"Bilgiler gönderilemedi");}finally{setBusy(false);}}
  const dash=useQuery<Dashboard>({queryKey:["/api/marketplace/seller/dashboard"],enabled:!!me.data,staleTime:0});
  const products=useQuery<Product[]>({queryKey:["/api/marketplace/seller/products"],enabled:approved,staleTime:0});
  const conversations=useQuery<Conversation[]>({queryKey:["/api/marketplace/conversations"],enabled:approved,staleTime:0});
  const messages=useQuery<Array<{id:number;text:string;author_user_id:number;created_at:string}>>({
    queryKey:["/api/marketplace/conversations/"+selectedChat+"/messages"],enabled:approved&&!!selectedChat,staleTime:0});
  const quotes=useQuery<Quote[]>({queryKey:["/api/marketplace/quotes"],enabled:approved,staleTime:0});
  async function run(action:()=>Promise<unknown>,refresh:string[]=[]) {
    setBusy(true);setMessage("");
    try{await action();setMessage("İşlem başarıyla kaydedildi.");await Promise.all(refresh.map(key=>queryClient.invalidateQueries({queryKey:[key]})));}
    catch(e){setMessage(e instanceof Error?e.message:"İşlem tamamlanamadı.");}
    finally{setBusy(false);}
  }
  if (!me.isLoading && me.isError) return <SellerAccess onAuthenticated={async()=>{ await me.refetch(); await queryClient.invalidateQueries({queryKey:["/api/auth/me"]}); }}/>;
  return <main className="min-h-screen bg-[#f5f6f8] px-4 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4"/>Çalışkan B2B'ye dön</Link>
          <h1 className="text-2xl font-black tracking-tight">Tedarikçi Yönetim Paneli</h1>
          <p className="text-sm text-slate-500">Web ve telefondan aynı hesap, aynı yetkiler ve aynı veriler</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={()=>{void me.refetch();void dash.refetch();void products.refetch();}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className="mr-2 inline h-4 w-4"/>Yenile</button><button type="button" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"include"});await queryClient.invalidateQueries({queryKey:["/api/marketplace/me"]});await queryClient.invalidateQueries({queryKey:["/api/auth/me"]});}} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700"><LogOut className="mr-2 inline h-4 w-4"/>Güvenli Çıkış</button></div>
      </div>
      {message?<Notice text={message}/>:null}
      {me.data ? <nav aria-label="Tedarikçi araçları" className="sticky top-0 z-20 -mx-2 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur">
        {([{key:"dashboard",label:"Genel Bakış",icon:LayoutDashboard},{key:"store",label:"Mağazam",icon:Store},{key:"products",label:"Ürünlerim",icon:Package},{key:"returns",label:"İadeler",icon:RotateCcw},{key:"payments",label:"Ödemeler",icon:Wallet},{key:"messages",label:"Müşteri Mesajları",icon:MessageCircle},{key:"quotes",label:"Teklifler",icon:FileText},{key:"reels",label:"Reels",icon:Film}] as const).map(item=><button key={item.key} type="button" onClick={()=>setTab(item.key)} aria-current={tab===item.key?"page":undefined} className={"flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition sm:text-sm "+(tab===item.key?"bg-[#0d0d0d] text-[#ffcc00] shadow-sm":"text-slate-600 hover:bg-amber-50 hover:text-black")}><item.icon className="h-4 w-4"/>{item.label}</button>)}
      </nav> : null}

      {me.isLoading?<Notice text="Hesap bilgileri kontrol ediliyor..."/>:
        me.isError?null:
        !me.data?<Notice text="Tedarikçi paneliniz hazırlanıyor…"/>:
        <div className="space-y-5">
          {!approved?<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 transition-all duration-500">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 shrink-0"/><div className="flex-1"><h2 className="text-lg font-black">{verificationSubmitted?"Bilgileriniz doğrulanıyor":"Satışa başlamak için hesabınızı doğrulayın"}</h2><p className="mt-1 text-sm">{verificationSubmitted?"Mağaza ve ürünlerinizi hazırlamaya başlayabilirsiniz. Yayına alınmaları yönetici onayından sonra gerçekleşir.":"Şirket bilgilerinizi tamamlayın; bu sırada tedarikçi panelinizi kullanabilirsiniz."}</p>{!verificationSubmitted?<button type="button" onClick={()=>setTab("verification")} className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-bold text-[#ffcc00]">Hesabınızı Onaylayın</button>:null}</div></div>
          </div>:null}
          {!approved && verificationSubmitted && (products.data?.length||0)<5?<div className="rounded-2xl border border-[#ffcc00] bg-[#fff9de] p-5"><h2 className="font-black">Ürün eklemeye başlayabilirsiniz</h2><p className="mt-1 text-sm text-slate-700">İlk 5 ürününüzden {products.data?.length||0} tanesi kaydedildi. Ürünler onaydan sonra yayımlanacak.</p><button type="button" onClick={()=>setTab("products")} className="mt-3 rounded-xl bg-[#111] px-4 py-2 text-sm font-bold text-[#ffcc00]">Ürün Ekle</button></div>:null}
          <div className={verificationHiding?"overflow-hidden opacity-0 max-h-0 transition-all duration-500":"transition-all duration-500"}>{!approved && tab==="verification" && !verificationSubmitted?<form id="seller-verification" className={boxStyle+" space-y-4"} onSubmit={e=>{e.preventDefault();void submitVerification();}}>
            <div className="flex items-center gap-3"><Building2 className="h-6 w-6"/><div><h3 className="text-lg font-black">Şirket Doğrulaması</h3><p className="text-sm text-slate-500">Bilgileriniz sadece yetkili inceleme ekibi tarafından değerlendirilir.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([["taxNumber","Vergi Numarası / TCKN"],["taxOffice","Vergi Dairesi"],["contactPhone","Telefon"],["contactEmail","E-posta Adresi"]] as const).map(([key,title])=><Field key={key} label={title}><input type={key==="contactEmail"?"email":"text"} required={key!=="taxOffice"} className={inputStyle} value={verification[key]} onChange={e=>setVerification(v=>({...v,[key]:e.target.value}))}/></Field>)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Şirket türü"><select required className={inputStyle} value={verification.companyType} onChange={e=>setVerification(v=>({...v,companyType:e.target.value}))}><option value="">Şirket türünüzü seçin</option><option value="sahis">Şahıs Şirketi</option><option value="limited">Limited Şirket</option><option value="anonim">Anonim Şirket</option><option value="kooperatif">Kooperatif</option><option value="diger">Diğer</option></select></Field>

            </div>
            <Field label="Vergi Levhası (PDF, en fazla 5 MB)"><input type="file" required accept="application/pdf" className={inputStyle} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5_000_000){setMessage("Vergi levhası en fazla 5 MB olmalı.");return;}const reader=new FileReader();reader.onload=()=>setVerification(v=>({...v,taxDocument:String(reader.result||"")}));reader.readAsDataURL(file);}}/></Field>
              <Field label="IBAN"><input required className={inputStyle} placeholder="TR ile başlayan 26 haneli IBAN" value={verification.iban} onChange={e=>setVerification(v=>({...v,iban:e.target.value.toUpperCase().replace(/\s/g,"")}))}/></Field>
            <button type="submit" disabled={busy||!verification.taxDocument} className="rounded-xl bg-black px-5 py-3 text-sm font-extrabold text-[#ffcc00] disabled:opacity-50">Doğrulama Bilgilerini Gönder</button>
          </form>:null}</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Ürünler",dash.data?.productCount],["Takipçiler",dash.data?.followers],
              ["Görüşmeler",dash.data?.conversations],["Açık teklifler",dash.data?.openQuotes]
            ].map(([name,n])=><div key={String(name)} className={boxStyle}><div className="text-2xl font-black">{n??"—"}</div><p className="text-xs text-slate-500">{name}</p></div>)}
          </div>
          {tab==="dashboard"?<div className={boxStyle+" space-y-4"}><h2 className="text-xl font-black">Tedarikçi Kontrol Merkezi</h2><p className="text-sm text-slate-600">Mağazanız, ürünleriniz, müşteri görüşmeleri ve teklifleriniz tek panelde.</p><div className="grid gap-3 sm:grid-cols-3">{[["Ürün",dash.data?.productCount],["Müşteri Görüşmesi",dash.data?.conversations],["Açık Teklif",dash.data?.openQuotes]].map(([label,count])=><div key={String(label)} className="rounded-xl bg-slate-100 p-4"><div className="text-2xl font-black">{count??0}</div><div className="text-xs text-slate-600">{label}</div></div>)}</div></div>:null}
          {tab==="returns"?<div className={boxStyle}><h2 className="text-lg font-black">İade Takibi</h2><p className="mt-2 text-sm text-slate-600">İade talepleri entegrasyonu hazırlanıyor. Şu anda bu bölümde gerçek iade kaydı gösterilmiyor.</p></div>:null}
          {tab==="payments"?<div className={boxStyle}><h2 className="text-lg font-black">Ödeme Takibi</h2><p className="mt-2 text-sm text-slate-600">Satıcı hakediş ve ödeme hareketlerinin entegrasyonu hazırlanıyor. Burada henüz doğrulanmış ödeme verisi bulunmuyor.</p></div>:null}
          {tab==="store"?<div className="grid gap-5 lg:grid-cols-2">
            <form className={boxStyle+" space-y-4"} onSubmit={e=>{e.preventDefault();void run(()=>send("POST","/api/marketplace/seller/store",
              {...store,bannerUrl:store.bannerUrl||null,logoUrl:store.logoUrl||null}),["/api/marketplace/seller/dashboard"]);}}>
              <h2 className="text-lg font-bold">Mağaza tasarım stüdyosu</h2>
              <Field label="Mağaza başlığı"><input required maxLength={120} className={inputStyle} value={store.title} onChange={e=>setStore(v=>({...v,title:e.target.value}))}/></Field>
              <Field label="Tanıtım metni"><input className={inputStyle} value={store.tagline} onChange={e=>setStore(v=>({...v,tagline:e.target.value}))}/></Field>
              <Field label="Tema rengi"><input type="color" className="h-11 w-20 rounded-lg border" value={store.accent} onChange={e=>setStore(v=>({...v,accent:e.target.value}))}/></Field>
              <Field label="Mağaza logosu (JPEG, PNG, WebP)"><input type="file" accept="image/png,image/jpeg,image/webp" className={inputStyle} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],"logoUrl");}}/><p className="text-xs text-slate-500">{store.logoUrl?"Yüklendi":"En fazla 4 MB"}</p></Field>
              <Field label="Mağaza bannerı"><input type="file" accept="image/png,image/jpeg,image/webp" className={inputStyle} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],"bannerUrl");}}/><p className="text-xs text-slate-500">{store.bannerUrl?"Yüklendi":"En fazla 4 MB"}</p></Field>
              <p className="text-xs text-slate-500">Yeni tasarım yönetici onayından geçene dek mevcut yayındaki mağaza aynı kalır.</p>
              <button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Tasarımı Onaya Gönder</button>
            </form>
            <div className={boxStyle+" space-y-4"}><h2 className="text-lg font-bold">Canlı önizleme</h2>
              <div className="overflow-hidden rounded-xl border">
                <div style={{backgroundColor:store.accent}} className="px-5 py-8">
                  <h3 className="text-xl font-black text-slate-950">{store.title||me.data.company_name}</h3>
                  <p className="mt-2 text-sm text-slate-900">{store.tagline||"Toptan satış mağazanız"}</p>
                </div>
                <div className="p-5 text-sm text-slate-500">Ürünler · Kategoriler · Reels · Hakkımızda</div>
              </div>
              <h3 className="font-semibold">Tasarım geçmişi</h3>
              {dash.data?.storeVersions.map(v=><div key={v.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <span>#{v.id} · {statusTR[v.status]||v.status}{v.is_live?" · Yayında":""}</span><span className="text-xs text-slate-500">{v.review_note}</span></div>)}
              {dash.data?.storeVersions.some(v=>v.is_live)?<Link className="inline-block text-sm font-bold underline" href={"/magaza/"+me.data.slug}>Yayındaki mağazayı gör ↗</Link>:null}
            </div>
          </div>:null}
          {tab==="products"?<div className={boxStyle+" space-y-5"}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Ürünlerim</h2><p className="text-sm text-slate-500">Ürünlerinizi yönetin, yeni ürünleri onaya gönderin.</p></div><button type="button" onClick={()=>setProductFormOpen(v=>!v)} className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-[#ffcc00]">{productFormOpen?"Listeye Dön":"＋ Ürün Ekle"}</button></div>
            <div className="flex gap-2 overflow-x-auto border-b pb-3">{([{key:"all",label:"Tüm Ürünler"},{key:"approved",label:"Aktif Ürünler"},{key:"pending",label:"Onay Bekleyen Ürünler"},{key:"rejected",label:"Reddedilen Ürünler"}] as const).map(item=><button type="button" key={item.key} onClick={()=>{setProductFilter(item.key);setProductFormOpen(false);}} className={"shrink-0 rounded-lg px-4 py-2 text-sm font-bold "+(productFilter===item.key?"bg-black text-[#ffcc00]":"bg-slate-100 text-slate-600")}>{item.label}</button>)}</div>
            {productFormOpen?<div className="space-y-5">
              <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4"><h3 className="font-bold">AI ile Toplu Ürün Aktarımı</h3><p className="my-2 text-xs text-slate-600">PDF veya PNG/JPEG ürün listesi yükleyin. AI alanları ayırır; onaya göndermeden önce eksikleri düzeltin. Görselsiz ürün gönderilemez.</p><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" disabled={aiLoading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setAiLoading(true);setMessage("");try{const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Dosya okunamadı"));reader.readAsDataURL(file)});const data=await send("POST","/api/marketplace/seller/products/analyze",{dataUrl});setAiRows(data.products||[]);}catch(error){setMessage(error instanceof Error?error.message:"AI analizi başarısız");}finally{setAiLoading(false)}}}/>{aiLoading?<p className="mt-2 text-sm">Dosya analiz ediliyor…</p>:null}</div>
              {aiRows.length?<div className="space-y-2"><h3 className="font-bold">AI Ön İzleme ({aiRows.length} ürün)</h3>{aiRows.map((item,i)=><div key={i} className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-4">{(["name","sku","brand","category","description","unitsPerBox","stock","price","leadDays"] as const).map(key=><label key={key} className="text-xs">{key}<input className={inputStyle} type={["unitsPerBox","stock","price","leadDays"].includes(key)?"number":"text"} value={String(item[key]??"")} onChange={e=>setAiRows(rows=>rows.map((r,index)=>index===i?{...r,[key]:e.target.value}:r))}/></label>)}<button type="button" className="col-span-2 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white sm:col-span-4" onClick={()=>{setProduct(v=>({...v,...Object.fromEntries(Object.entries(item).map(([k,val])=>[k,String(val)]))}));setAiRows(rows=>rows.filter((_,index)=>index!==i));}}>Bu Ürünü Düzenle ve Görsel Ekle</button></div>)}</div>:null}
              <form className="space-y-3 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void run(async()=>{await send("POST","/api/marketplace/seller/products",{sku:product.sku,stock:Number(product.stock),product:{name:product.name,description:product.description,category:product.category,brand:product.brand,barcode:product.barcode,imageUrl:product.imageUrl,price:Number(product.price),unitsPerBox:Number(product.unitsPerBox),minBoxes:Number(product.minBoxes),leadDays:Number(product.leadDays)}});setProductFormOpen(false);setProductFilter("pending");},["/api/marketplace/seller/products","/api/marketplace/seller/dashboard"]);}}>
                <h3 className="font-black">Ürünü Düzenle ve Onaya Gönder</h3><div className="grid gap-3 sm:grid-cols-3">{(["sku","name","brand","category","description","barcode","price","stock","unitsPerBox","minBoxes"] as const).map(key=><Field key={key} label={({sku:"Stok Kodu",name:"Ürün Başlığı",brand:"Marka",category:"Kategori",description:"Ürün Özellikleri",barcode:"Barkod",price:"Ürün Fiyatı (₺)",stock:"Stok",unitsPerBox:"Koli İçi Adet",minBoxes:"Minimum Koli"} as Record<string,string>)[key]}><input className={inputStyle} required={["sku","name","category","price","stock","unitsPerBox"].includes(key)} type={["price","stock","unitsPerBox","minBoxes"].includes(key)?"number":"text"} min={["price","unitsPerBox","minBoxes"].includes(key)?"1":undefined} value={product[key]} onChange={e=>setProduct(v=>({...v,[key]:e.target.value}))}/></Field>)}<Field label="Termin Süresi"><select className={inputStyle} value={product.leadDays} onChange={e=>setProduct(v=>({...v,leadDays:e.target.value}))}>{Array.from({length:14},(_,i)=><option key={i} value={i+1}>{i+1} gün</option>)}</select></Field></div>
                <Field label="Ürün Görseli (zorunlu)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],"imageUrl");}}/>{product.imageUrl?<img className="mt-2 h-20 w-20 rounded-lg object-contain" src={product.imageUrl} alt="Ürün önizleme"/>:null}</Field>
                <button disabled={busy||uploading||!product.imageUrl} className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-[#ffcc00]">Ürünü Onaya Gönder</button>
              </form></div>:null}
            <div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-xs"><thead className="bg-slate-100"><tr>{["Görsel","Ürün Başlığı","Marka","Kategori","Özellikler","Koli Adedi","Stok","Fiyat","Termin","Durum"].map(x=><th key={x} className="px-3 py-3 font-bold">{x}</th>)}</tr></thead><tbody>{(products.data||[]).filter(p=>productFilter==="all"||((Boolean(p.live)&&productFilter==="approved")||p.latest?.status===productFilter)).map(p=><tr key={p.id} className="border-b"><td className="p-3">{p.latest?.content?.imageUrl?<img src={p.latest.content.imageUrl} className="h-12 w-12 rounded object-contain" alt=""/>:null}</td><td className="p-3 font-semibold">{p.latest?.content?.name||p.sku}</td><td className="p-3">{p.latest?.content?.brand||"—"}</td><td className="p-3">{p.latest?.content?.category||"—"}</td><td className="max-w-48 truncate p-3">{p.latest?.content?.description||"—"}</td><td className="p-3">{p.latest?.content?.unitsPerBox||1}</td><td className="p-3">{p.stock}</td><td className="p-3">{p.latest?.content?.price??"—"} ₺</td><td className="p-3">{p.latest?.content?.leadDays||1} gün</td><td className="p-3">{statusTR[p.latest?.status||""]||"—"}{p.latest?.review_note?<p className="text-amber-700">{p.latest.review_note}</p>:null}</td></tr>)}</tbody></table>{!products.data?.length?<p className="py-10 text-center text-sm text-slate-500">Henüz ürün yok. Sağ üstteki Ürün Ekle butonuyla başlayın.</p>:(products.data||[]).filter(p=>productFilter==="all"||(productFilter==="approved"?Boolean(p.live):p.latest?.status===productFilter)).length===0?<p className="py-10 text-center text-sm text-slate-500">Bu durumda ürün bulunmuyor.</p>:null}</div>
          </div>:null}
          {tab==="reels"?<div className="grid gap-5 lg:grid-cols-2">
            <form className={boxStyle+" space-y-4"} onSubmit={e=>{e.preventDefault();void run(()=>send("POST","/api/marketplace/seller/reels",
              {title:reel.title,videoUrl:reel.videoUrl,productId:reel.productId?Number(reel.productId):null}),["/api/marketplace/seller/dashboard"]);}}>
              <h2 className="text-lg font-bold">Reels Stüdyosu</h2>
              <Field label="Video başlığı"><input className={inputStyle} required value={reel.title} onChange={e=>setReel(v=>({...v,title:e.target.value}))}/></Field>
              <Field label="Reels videosu (MP4)"><input type="file" accept="video/mp4" className={inputStyle} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],"videoUrl");}}/><p className="text-xs text-slate-500">{reel.videoUrl?"Video yüklendi":"En fazla 9 MB, MP4 formatı"}</p></Field>
              <Field label="Ürün seç"><select className={inputStyle} value={reel.productId} onChange={e=>setReel(v=>({...v,productId:e.target.value}))}>
                <option value="">Ürün seçilmedi</option>{products.data?.map(p=><option key={p.id} value={p.id}>{p.latest?.content?.name||p.sku}</option>)}
              </select></Field>
              <button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Videoyu Onaya Gönder</button>
            </form>
            <div className={boxStyle+" space-y-3"}><h2 className="text-lg font-bold">Video geçmişi</h2>
              {dash.data?.reels.map(r=><div key={r.id} className="rounded-xl border p-3 text-sm"><b>{r.title}</b>
                <p className="text-xs text-slate-500">{statusTR[r.status]||r.status}</p>{r.review_note?<p className="text-xs text-amber-700">{r.review_note}</p>:null}</div>)}
            </div>
          </div>:null}
          {tab==="messages"?<div className="grid gap-4 lg:grid-cols-3">
            <div className={boxStyle+" space-y-2"}><h2 className="font-bold">Görüşmeler</h2>
              {conversations.data?.map(c=><button key={c.id} onClick={()=>setSelectedChat(c.id)} className={"w-full rounded-lg p-3 text-left text-sm "+(selectedChat===c.id?"bg-amber-100":"bg-slate-50")}>
                <b>#{c.id} · Müşteri</b><p className="truncate text-xs text-slate-600">{c.latest_message}</p></button>)}
              {!conversations.data?.length?<p className="text-xs text-slate-500">İlk mesajı yalnızca müşteriler başlatabilir.</p>:null}
            </div>
            <div className={boxStyle+" space-y-3 lg:col-span-2"}><h2 className="font-bold">Sohbet</h2>
              {selectedChat?<><div className="max-h-96 space-y-2 overflow-y-auto">
                {messages.data?.map(m=><div key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p>{m.text}</p><span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString("tr-TR")}</span>
                </div>)}</div>
                <form onSubmit={e=>{e.preventDefault();void run(()=>send("POST","/api/marketplace/conversations/"+selectedChat+"/messages",{text:reply}),
                  ["/api/marketplace/conversations/"+selectedChat+"/messages","/api/marketplace/conversations"]);setReply("");}} className="flex gap-2">
                  <input className={inputStyle} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Müşteriye yanıt yazın" required/>
                  <button disabled={busy} className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Gönder</button>
                </form></>:<p className="text-sm text-slate-500">Konuşma seçin.</p>}
            </div>
          </div>:null}
          {tab==="quotes"?<div className={boxStyle+" space-y-4"}>
            <h2 className="text-lg font-bold">Teklif Talepleri</h2>
            {quotes.data?.map(q=><div key={q.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><b>#{q.id} · {q.sku||"Genel talep"} · {q.boxes} koli</b>
                <span className="text-xs text-slate-500">{statusTR[q.status]||q.status}</span></div>
              <p className="my-2 text-slate-600">{q.details}</p>
              {q.latest_offer?<p className="text-xs text-green-700">Son teklif: {q.latest_offer.amount_per_box} ₺ / koli</p>:null}
              {["requested","offered"].includes(q.status)?<button className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold"
                onClick={()=>{setOffer(v=>({...v,quoteId:String(q.id)}));}}>Teklif Hazırla</button>:null}
            </div>)}
            {!quotes.data?.length?<p className="text-sm text-slate-500">Henüz teklif talebi yok.</p>:null}
            {offer.quoteId?<form className="space-y-3 rounded-xl bg-slate-50 p-4" onSubmit={e=>{e.preventDefault();void run(()=>send("POST","/api/marketplace/quotes/"+offer.quoteId+"/offer",
              {amountPerBox:Number(offer.amountPerBox),deliveryTerms:offer.deliveryTerms,validHours:Number(offer.validHours)}),["/api/marketplace/quotes"]);}}>
              <h3 className="font-bold">Teklif #{offer.quoteId}</h3>
              <Field label="Koli başına fiyat (₺)"><input required type="number" step="0.01" min="0.01" className={inputStyle} value={offer.amountPerBox} onChange={e=>setOffer(v=>({...v,amountPerBox:e.target.value}))}/></Field>
              <Field label="Teslimat ve ödeme koşulları"><input className={inputStyle} value={offer.deliveryTerms} onChange={e=>setOffer(v=>({...v,deliveryTerms:e.target.value}))}/></Field>
              <Field label="Teklif geçerlilik süresi (saat)"><input required type="number" min="1" max="720" className={inputStyle} value={offer.validHours} onChange={e=>setOffer(v=>({...v,validHours:e.target.value}))}/></Field>
              <button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Teklifi Gönder</button>
            </form>:null}
          </div>:null}
        </div>}
    </div>
  </main>;
}
