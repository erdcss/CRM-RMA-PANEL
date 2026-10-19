
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Store, ClipboardCheck, Package, Film, ShieldCheck, RefreshCw, MessageSquare, CreditCard, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MarketplaceReviewDialog, type ReviewKind } from "@/components/marketplace-review-detail";
import { Eye, ImageOff, UserPlus } from "lucide-react";
import { MarketplaceCreateSupplierDialog } from "@/components/marketplace-create-supplier-dialog";
import { MarketplaceActionDialog } from "@/components/marketplace-action-dialog";

type Status = "pending" | "approved" | "rejected" | "suspended";
type Review = {id:number;status:Status;created_at:string;review_note?:string;admin_created?:boolean;admin_verified?:boolean;admin_verified_at?:string|null;is_admin_paused?:boolean;admin_paused_at?:string|null;company_name?:string;contact_name?:string;
  tax_number?:string;tax_office?:string;contact_phone?:string;contact_email?:string;company_type?:string;iban?:string;has_tax_document?:boolean;description?:string;content?:Record<string,unknown>;title?:string;video_url?:string;is_live?:boolean;product_id?:number};
type Queue = {suppliers:Review[];products:Review[];stores:Review[];reels:Review[]};
type ArchivedConversation = {
  id:number;supplier_name:string;supplier_contact?:string|null;customer_name:string;
  customer_company?:string|null;customer_email?:string|null;customer_phone?:string|null;
  buyer_user_id:number;closed_at:string;message_count:number;
};
type ArchivedMessage={id:number;text:string;created_at:string;sender_role:"customer"|"supplier"};
type Metric = {status:string;total:number};
type Overview = {suppliers:Metric[];products:Metric[];stores:Metric[];reels:Metric[];
  conversations:number;quotes:number;commissionPercent:number;warehouseControlExtraPercent:number;liveSupplierCheckout:boolean};
const tabs=[
  {key:"overview",label:"Genel Bakış",icon:Store},{key:"suppliers",label:"Tedarikçiler",icon:ShieldCheck},
  {key:"products",label:"Ürün Onayları",icon:Package},{key:"stores",label:"Mağaza Tasarımları",icon:ClipboardCheck},
  {key:"reels",label:"Reels Onayları",icon:Film},{key:"archives",label:"Mesaj Arşivleri",icon:MessageSquare}
] as const;
type Tab = typeof tabs[number]["key"];
const statusNames:Record<string,string>={pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",suspended:"Askıda"};
const label=(r:Review,tab:Tab)=>tab==="suppliers"?(r.company_name||"Tedarikçi"):
  tab==="stores"?(r.company_name||"Mağaza"):
  tab==="products"?(String(r.content?.name||"Ürün") + (r.company_name?" · "+r.company_name:"")):
  r.title||"Reels";
const count=(arr:Metric[],s="pending")=>arr.find(x=>x.status===s)?.total||0;
const storeMedia=(value:unknown)=>typeof value==="string"&&/^\/api\/marketplace\/media\/[a-f0-9]{32}$/.test(value)?value:null;

export default function AdminMarketplace(){
  const [tab,setTab]=useState<Tab>("overview");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [processing,setProcessing]=useState<string|null>(null);
  const [selectedArchive,setSelectedArchive]=useState<number|null>(null);
  const [createSupplierOpen,setCreateSupplierOpen]=useState(false);
  const [verifyTarget,setVerifyTarget]=useState<{supplier:Review;verified:boolean}|null>(null);
  const [selectedReview,setSelectedReview]=useState<{kind:ReviewKind;id:number}|null>(null);
  const {toast}=useToast();
  const overview=useQuery<Overview>({queryKey:["/api/admin/marketplace/overview"],staleTime:0,refetchInterval:30000});
  const archives=useQuery<ArchivedConversation[]>({
    queryKey:["/api/admin/marketplace/message-archives"],enabled:tab==="archives",staleTime:0,refetchOnMount:"always"
  });
  const archivedMessages=useQuery<ArchivedMessage[]>({
    queryKey:["/api/admin/marketplace/message-archives/"+selectedArchive],enabled:tab==="archives"&&selectedArchive!==null,staleTime:0
  });
  const queue=useQuery<Queue>({queryKey:["/api/admin/marketplace/review-queue"],staleTime:0,refetchInterval:30000});
  const selectedArchiveInfo=archives.data?.find(chat=>chat.id===selectedArchive);
  async function decision(kind:Tab,r:Review,value:"approved"|"rejected"){
    const key=kind+":"+r.id;
    const note=(notes[key]||"").trim();
    if(value==="rejected" && !note){toast({title:"Ret gerekçesi gerekli",variant:"destructive"});return;}
    setProcessing(key);
    try{
      const path=kind==="suppliers"
        ? "/api/admin/marketplace/suppliers/"+r.id+"/decision"
        : "/api/admin/marketplace/reviews/"+(kind==="products"?"product":kind==="stores"?"store":"reel")+"/"+r.id+"/decision";
      await apiRequest("POST",path,{decision:value,note});
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/review-queue"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/overview"]})
      ]);
      toast({title:value==="approved"?"İçerik onaylandı":"İçerik reddedildi"});
      if(kind!=="suppliers")setSelectedReview(null);
    }catch(e){toast({title:"İşlem yapılamadı",description:e instanceof Error?e.message:"Hata",variant:"destructive"});}
    finally{setProcessing(null);}
  }
  async function updateSupplierVerification(){
    if(!verifyTarget) return;
    const {supplier,verified}=verifyTarget;
    await apiRequest("PATCH","/api/admin/marketplace/suppliers/"+supplier.id+"/verification",{verified});
    await Promise.all([
      queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/review-queue"]}),
      queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/overview"]}),
      queryClient.invalidateQueries({queryKey:["/api/marketplace/stores"]}),
      queryClient.invalidateQueries({queryKey:["/api/marketplace/products"]})
    ]);
    toast({title:verified?"Tedarikçi doğrulandı":"Doğrulama kaldırıldı",
      description:verified?"Mağaza ve onaylı ürünler satışa açıldı.":"Firma belge onayı tamamlanana kadar satışlar kapatıldı."});
  }
  async function updateSupplierPause(supplier:Review,paused:boolean){
    if(processing)return;
    if(!window.confirm(paused
      ?supplier.company_name+" mağazasını ve bütün ürünlerini satışa kapatmak istiyor musunuz? Mevcut ürünler silinmez."
      :supplier.company_name+" mağazasını ve onaylı ürünlerini yeniden satışa açmak istiyor musunuz? Tatil modu ayrıca geçerli olabilir."))return;
    const key="pause:"+supplier.id;
    setProcessing(key);
    try{
      await apiRequest("PATCH","/api/admin/marketplace/suppliers/"+supplier.id+"/pause",{paused});
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/review-queue"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/overview"]}),
        queryClient.invalidateQueries({queryKey:["/api/marketplace/stores"]}),
        queryClient.invalidateQueries({queryKey:["/api/marketplace/products"]})
      ]);
      toast({title:paused?"Mağaza pasife alındı":"Mağaza yeniden aktif edildi",
        description:paused?"Tedarikçinin mağazası ve ürünleri satıştan kaldırıldı.":"Onaylı mağaza ve ürünlerin erişimi geri açıldı; tatil modu varsa devam eder."});
    }catch(error){
      toast({title:"Tedarikçi durumu değiştirilemedi",description:error instanceof Error?error.message:"Hata",variant:"destructive"});
    }finally{setProcessing(null);}
  }
  const groups={suppliers:queue.data?.suppliers||[],products:queue.data?.products||[],
    stores:queue.data?.stores||[],reels:queue.data?.reels||[],archives:[] as Review[]};
  const stats=overview.data;
  return <main className="h-full overflow-y-auto bg-background px-4 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/" className="text-xs text-muted-foreground hover:underline">← Ana yönetim paneline dön</Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Pazaryeri Yönetim Merkezi</h1>
          <p className="text-sm text-muted-foreground">Tedarikçi, ürün, mağaza ve video onayları · Çalışkan B2B</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={()=>setCreateSupplierOpen(true)}
            className="gap-2 bg-[#FFCD00] font-extrabold text-slate-950 hover:bg-amber-400">
            <UserPlus className="h-4 w-4"/>Yeni Tedarikçi Ekle
          </Button>
          <Button type="button" onClick={()=>{setTab("archives");setSelectedArchive(null);void archives.refetch();}}
            className="gap-2 bg-slate-950 font-bold text-white hover:bg-slate-800">
            <MessageSquare className="h-4 w-4"/>Mesaj Arşivlerini Gör
          </Button>
          <Button variant="outline" disabled={overview.isFetching||queue.isFetching||archives.isFetching}
            onClick={()=>{void overview.refetch();void queue.refetch();if(tab==="archives")void archives.refetch();if(selectedArchive!==null)void archivedMessages.refetch();}}>
            <RefreshCw className="mr-2 h-4 w-4"/>Yenile
          </Button>
        </div>
      </div>
      {overview.isError||queue.isError ? <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Pazaryeri verileri yüklenemedi. Sunucu veya veritabanı bağlantısını kontrol edin.</div>:null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {title:"Tedarikçi başvurusu",n:count(stats?.suppliers||[]),icon:ShieldCheck},
          {title:"Ürün onayı",n:count(stats?.products||[]),icon:Package},
          {title:"Mağaza tasarımı",n:count(stats?.stores||[]),icon:Store},
          {title:"Reels onayı",n:count(stats?.reels||[]),icon:Film}
        ].map(item=><div key={item.title} className="rounded-2xl border bg-card p-4">
          <item.icon className="mb-3 h-5 w-5 text-muted-foreground"/>
          <div className="text-3xl font-black tabular-nums">{item.n}</div>
          <p className="mt-1 text-xs text-muted-foreground">{item.title} bekliyor</p>
        </div>)}
      </div>
      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {tabs.map(t=><button key={t.key} type="button" onClick={()=>setTab(t.key)}
          className={"flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition "+(tab===t.key?"bg-slate-950 text-white dark:bg-white dark:text-slate-950":"bg-muted text-muted-foreground hover:text-foreground")}>
          <t.icon className="h-4 w-4"/>{t.label}</button>)}
      </div>
      {tab==="archives"?<div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-extrabold">Tedarikçi - Müşteri Mesaj Arşivleri</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sonlandırılmış görüşmeler, tedarikçi ve müşteri isimleriyle saklanır.</p>
          </div>
          <Button type="button" variant="outline" onClick={()=>void archives.refetch()} disabled={archives.isFetching}>
            <RefreshCw className="mr-2 h-4 w-4"/>Arşivi Yenile
          </Button>
        </div>
        {archives.isError?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Görüşme arşivi yüklenemedi. Yetkilerinizi veya sunucu bağlantısını kontrol edin.</p>:null}
        <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-bold">Kapatılmış Sohbetler {archives.data?("("+archives.data.length+")"):""}</h2>
          {archives.isLoading?<p className="text-xs text-muted-foreground">Görüşmeler yükleniyor...</p>:null}
          {archives.data?.map(chat=><button key={chat.id} type="button" onClick={()=>setSelectedArchive(chat.id)}
            aria-pressed={selectedArchive===chat.id}
            className={"mb-2 block w-full space-y-1 rounded-lg p-3 text-left text-sm "+(selectedArchive===chat.id?"bg-amber-100 text-slate-950":"bg-muted")}>
            <b className="block">{chat.supplier_name} · {chat.customer_name||"Bilinmeyen Müşteri"}</b>
            <p className="text-xs">Müşteri: {chat.customer_name||"Bilinmiyor"}</p>
            <p className="break-all text-xs">E-posta: {chat.customer_email||"Yok"}</p>
            <p className="text-xs">Telefon: {chat.customer_phone||"Yok"}</p>
            <p className="text-xs">Müşteri ID: #{chat.buyer_user_id}</p>
            <p className="pt-1 text-xs">{new Date(chat.closed_at).toLocaleString("tr-TR")} · {chat.message_count} mesaj</p>
          </button>)}
          {!archives.isLoading&&!archives.isError&&!archives.data?.length?<p className="text-sm text-muted-foreground">Henüz arşivlenmiş sohbet yok.</p>:null}
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-4 lg:col-span-2"><h2 className="font-bold">Arşivlenmiş Mesajlar</h2>
          {selectedArchiveInfo?<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
            <h3 className="mb-3 text-sm font-extrabold">Görüşme Tarafları</h3>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">Tedarikçi</p>
                <p className="font-semibold">{selectedArchiveInfo.supplier_name}</p>
                {selectedArchiveInfo.supplier_contact?<p className="text-xs text-slate-600">Yetkili: {selectedArchiveInfo.supplier_contact}</p>:null}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">Müşteri</p>
                <p className="font-semibold">{selectedArchiveInfo.customer_name||"Bilinmiyor"}</p>
                {selectedArchiveInfo.customer_company&&selectedArchiveInfo.customer_company!==selectedArchiveInfo.customer_name?
                  <p className="text-xs text-slate-600">Firma: {selectedArchiveInfo.customer_company}</p>:null}
                <p className="break-all text-xs text-slate-600">E-posta: {selectedArchiveInfo.customer_email||"Yok"}</p>
                <p className="text-xs text-slate-600">Telefon: {selectedArchiveInfo.customer_phone||"Yok"}</p>
                <p className="text-xs text-slate-600">Kullanıcı ID: #{selectedArchiveInfo.buyer_user_id}</p>
              </div>
            </div>
          </div>:null}
          {archivedMessages.data?.map(m=><div key={m.id} className="rounded-lg bg-muted p-3 text-sm">
            <b className="text-xs">{m.sender_role==="supplier"
              ?"Tedarikçi · "+(selectedArchiveInfo?.supplier_name||"Bilinmiyor")
              :"Müşteri · "+(selectedArchiveInfo?.customer_name||"Bilinmiyor")}</b>
            <p className="mt-1 whitespace-pre-wrap">{m.text}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("tr-TR")}</p>
          </div>)}
          {!selectedArchive?<p className="text-sm text-muted-foreground">Mesajları görmek için soldaki listeden bir görüşme seçin.</p>:null}
          {selectedArchive!==null&&archivedMessages.isLoading?<p className="text-sm text-muted-foreground">Mesajlar yükleniyor...</p>:null}
          {selectedArchive!==null&&archivedMessages.isError?<p role="alert" className="text-sm text-red-700">Görüşme mesajları yüklenemedi.</p>:null}
        </section>
        </div>
      </div>:null}
      {tab==="overview"?<div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border p-5"><h2 className="mb-4 font-bold">Pazaryeri işletme kuralları</h2>
          <div className="space-y-3 text-sm">
            <p className="flex justify-between"><span>Standart satıcı hizmet bedeli</span><b>%{stats?.commissionPercent??3}</b></p>
            <p className="flex justify-between"><span>Depo kontrollü sevkiyat ek bedeli</span><b>+%{stats?.warehouseControlExtraPercent??3}</b></p>
            <p className="flex justify-between"><span>Canlı çok satıcılı ödeme</span><b className="text-amber-600">Henüz kapalı</b></p>
          </div>
          <p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Tedarikçi ürünleri onaydan önce yayımlanmaz. Ödeme ve mali belge mutabakatı tamamlanmadan satıcı siparişleri ödeme ekranına gönderilmez.
          </p>
        </section>
        <section className="rounded-2xl border p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">İletişim ve işlem hacmi</h2>
          <button type="button" onClick={()=>{setTab("archives");setSelectedArchive(null);void archives.refetch();}}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800">
            <MessageSquare className="h-4 w-4"/>Görüşme Arşivleri
          </button>
        </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-4"><MessageSquare className="mb-3 h-5 w-5"/><div className="text-3xl font-black">{stats?.conversations??0}</div><p className="text-xs text-muted-foreground">Müşteri sohbeti</p></div>
            <div className="rounded-xl bg-muted p-4"><CreditCard className="mb-3 h-5 w-5"/><div className="text-3xl font-black">{stats?.quotes??0}</div><p className="text-xs text-muted-foreground">Teklif talebi</p></div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4"/>Standart ve depo kontrollü teslimat, finans mutabakatına bağlanacak.</div>
        </section>
      </div>:tab==="archives"?null:<section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{tabs.find(t=>t.key===tab)?.label}</h2>
          <span className="text-xs text-muted-foreground">{tab==="stores"?"Tedarikçi başına son gönderilen tasarım · Son 100 mağaza":"Son 100 kayıt · Bekleyenler ve geçmiş"}</span></div>
        {groups[tab].length===0?<div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Henüz kayıt bulunmuyor.</div>:null}
        {groups[tab].map(r=>{
          const key=tab+":"+r.id;
          return <article key={key} className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-base font-bold">{label(r,tab)}</p>
                <p className="mt-1 text-xs text-muted-foreground">#{r.id} · {new Date(r.created_at).toLocaleString("tr-TR")}</p>
                {tab==="suppliers"?<div className="mt-3 space-y-1 text-xs text-muted-foreground">
  <p>VKN/TCKN: {r.tax_number} · Vergi Dairesi: {r.tax_office || "Belirtilmedi"}</p>
  <p>Yetkili: {r.contact_name} · Telefon: {r.contact_phone}</p>
  <p>E-posta: {r.contact_email || "Belirtilmedi"} · Şirket Türü: {({sahis:"Şahıs",limited:"Limited",anonim:"Anonim",kooperatif:"Kooperatif",diger:"Diğer"} as Record<string,string>)[r.company_type || ""] || "Henüz seçilmedi"}</p>
  <p>IBAN: {r.iban || "Henüz belirtilmedi"} · Vergi Levhası: {r.has_tax_document ? "Yüklendi" : "Eksik"}</p>
  {r.description?<p>Faaliyet Alanı: {r.description}</p>:null}
  {r.has_tax_document?<a className="inline-flex rounded-lg border px-3 py-2 font-semibold text-foreground underline" href={"/api/admin/marketplace/suppliers/"+r.id+"/tax-document"} target="_blank" rel="noopener noreferrer">Vergi Levhasını Görüntüle</a>:null}
</div>:null}
                {tab==="products"?
                  <div className="mt-3 flex flex-wrap items-start gap-4">
                    {typeof r.content?.imageUrl==="string" && /^\/api\/marketplace\/media\/[a-f0-9]{32}$/.test(r.content.imageUrl)?
                      <img src={r.content.imageUrl} alt="Ürün önizlemesi" className="h-28 w-28 rounded-xl border bg-background object-contain p-2"/>:
                      <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-muted"><ImageOff className="h-8 w-8 text-muted-foreground"/></div>}
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p className="font-semibold">{String(r.content?.name||"Ürün")}</p>
                      <p className="text-muted-foreground">{String(r.content?.description||"Açıklama bulunmuyor").slice(0,180)}</p>
                      <p className="font-semibold">Birim fiyatı: {Number(r.content?.price||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"})}</p>
                      <p className="text-muted-foreground">Marka: {String(r.content?.brand||"—")} · Koli içi: {String(r.content?.unitsPerBox||"—")}</p>
                    </div>
                  </div>:null}
                {tab==="stores"?
                  <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 p-3">
                    <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-xl border" style={{backgroundColor:typeof r.content?.accent==="string"&&/^#[a-fA-F0-9]{6}$/.test(r.content.accent)?r.content.accent:"#FACC15"}}>
                      {storeMedia(r.content?.bannerUrl)?<img src={storeMedia(r.content?.bannerUrl)!} alt="Son gönderilen mağaza bannerı" className="h-full w-full object-cover"/>:null}
                      <div className="absolute bottom-1 left-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-white shadow-sm">
                        {storeMedia(r.content?.logoUrl)?<img src={storeMedia(r.content?.logoUrl)!} alt="Son gönderilen mağaza logosu" className="h-full w-full object-contain"/>:<Store className="h-5 w-5 text-slate-500"/>}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">{String(r.content?.title||r.company_name||"Mağaza")}</p>
                      <p className="text-muted-foreground">{String(r.content?.tagline||"Slogan eklenmemiş")}</p>
                      <p className="text-xs text-muted-foreground">En son gönderilen sürüm · Logo, banner ve renk paleti önizlemesi</p>
                    </div>
                  </div>:null}
                {tab==="reels"?
                  <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                    <Film className="h-8 w-8 shrink-0 text-amber-600"/>
                    <span>Video oynatıcı, ürün etiketi ve yayın durumu detaylı incelemede görüntülenebilir.</span>
                  </div>:null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                 {tab==="suppliers"&&r.admin_created?
                    <span className={"rounded-full px-3 py-1 text-xs font-bold "+(r.admin_verified?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800")}>
                      {r.admin_verified?"Doğrulanmış":"Doğrulanmamış"}
                    </span>:null}
                 {tab==="suppliers"&&r.is_admin_paused?<span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">Satışa Kapalı</span>:null}
                 <span className={"rounded-full px-3 py-1 text-xs font-semibold "+(r.status==="pending"?"bg-amber-100 text-amber-800":r.status==="approved"?"bg-green-100 text-green-800":"bg-slate-100 text-slate-700")}>{statusNames[r.status]||r.status}</span>
               </div>
            </div>
            {r.review_note?<p className="mt-3 text-xs text-muted-foreground">Son yönetici notu: {r.review_note}</p>:null}
            {tab==="suppliers"&&r.admin_created&&["pending","approved"].includes(r.status)?
               <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                 <p className="text-xs font-medium text-slate-600">
                   {r.admin_verified?"Yönetici tarafından doğrulandı. Satışa açık.":"Doğrulanmamış hesap. Evrak onayı bekleniyor."}
                 </p>
                 <Button type="button" variant="outline" disabled={!!processing}
                   className={r.admin_verified?"border-amber-300 text-amber-800":"border-emerald-300 text-emerald-800"}
                   onClick={()=>setVerifyTarget({supplier:r,verified:!r.admin_verified})}>
                   {r.admin_verified?"Doğrulanmamış Yap":"Doğrulanmış Yap"}
                 </Button>
               </div>:null}
             {tab==="suppliers" && r.status==="pending" ? <div className="mt-4 space-y-3 border-t pt-4">
              <textarea aria-label="Onay veya ret gerekçesi" value={notes[key]||""} onChange={e=>setNotes(v=>({...v,[key]:e.target.value}))}
                placeholder="Yönetici notu / ret gerekçesi" maxLength={1000} rows={2} className="w-full rounded-lg border bg-background p-3 text-sm"/>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!processing} onClick={()=>void decision(tab,r,"approved")}><ShieldCheck className="mr-2 h-4 w-4"/>Onayla</Button>
                <Button disabled={!!processing} variant="outline" onClick={()=>void decision(tab,r,"rejected")}>Gerekçeli Reddet</Button>
              </div>
            </div>:null}
            {tab==="suppliers" && r.status==="approved" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
               <div className="text-xs text-muted-foreground">
                 {r.is_admin_paused
                   ?"Mağaza ve tüm onaylı ürünler satıştan kaldırıldı; veriler korunuyor."
                   :"Mağaza ve onaylı ürünler müşterilere açık (tatil modu hariç)."}
               </div>
               <Button type="button" disabled={!!processing}
                 variant={r.is_admin_paused?"default":"outline"}
                 className={r.is_admin_paused?"bg-emerald-700 font-bold text-white hover:bg-emerald-800":"border-red-300 font-bold text-red-700 hover:bg-red-50"}
                 onClick={()=>void updateSupplierPause(r,!r.is_admin_paused)}>
                 {processing==="pause:"+r.id?"İşleniyor…":r.is_admin_paused?"Yeniden Aktif Et":"Hesabı Pasife Al"}
               </Button>
             </div>:null}
            {tab!=="suppliers" ?
              <div className="mt-4 border-t pt-4">
                <Button variant={r.status==="pending"?"default":"outline"}
                  onClick={()=>setSelectedReview({kind:tab,id:r.id})}>
                  <Eye className="mr-2 h-4 w-4"/>Detaylı İncele
                </Button>
                {r.status==="pending"?<span className="ml-3 text-xs text-muted-foreground">Onay ve ret işlemleri inceleme ekranında</span>:null}
              </div>:null}
          </article>;
        })}
      </section>}
      <MarketplaceActionDialog
        open={verifyTarget!==null}
        onOpenChange={open=>{if(!open)setVerifyTarget(null);}}
        title={verifyTarget?.verified?"Tedarikçiyi doğrulamak istiyor musunuz?":"Tedarikçi doğrulamasını kaldırmak istiyor musunuz?"}
        description={verifyTarget?.verified
          ?"Yönetici doğrulamasıyla bu mağaza ve onaylı ürünleri doğrudan satışa açılacak; daha sonra eklenen yeni ürün ve mağaza tasarımları da otomatik yayınlanacak."
          :"Mağaza ve ürünler müşterilerden gizlenecek. Satıcıdan doğrulama belgeleri ve yeniden yönetici onayı istenecek."}
        confirmLabel={verifyTarget?.verified?"Doğrula ve Satışa Aç":"Doğrulamayı Kaldır"}
        destructive={!verifyTarget?.verified}
        onConfirm={updateSupplierVerification}
      />
            <MarketplaceCreateSupplierDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        onCreated={()=>{
          setTab("suppliers");
          void Promise.all([
            queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/review-queue"]}),
            queryClient.invalidateQueries({queryKey:["/api/admin/marketplace/overview"]})
          ]);
          toast({title:"Tedarikçi hesabı oluşturuldu",description:"Hesap onay bekliyor. Giriş bilgilerini yeni açılan karttan kopyalayın."});
        }}
      />
      <MarketplaceReviewDialog
        selection={selectedReview}
        note={selectedReview?notes[selectedReview.kind+":"+selectedReview.id]||"":""}
        onNote={(value)=>{
          if(selectedReview)setNotes(prev=>({...prev,[selectedReview.kind+":"+selectedReview.id]:value}));
        }}
        onClose={()=>setSelectedReview(null)}
        processing={!!processing}
        onDecision={(value)=>{
          if(!selectedReview)return;
          const review=groups[selectedReview.kind].find(item=>Number(item.id)===Number(selectedReview.id));
          if(review)void decision(selectedReview.kind,review,value);
        }}
      />
    </div>
  </main>;
}
