
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Store, ClipboardCheck, Package, Film, ShieldCheck, RefreshCw, MessageSquare, CreditCard, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MarketplaceReviewDialog, type ReviewKind } from "@/components/marketplace-review-detail";
import { Eye, ImageOff } from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "suspended";
type Review = {id:number;status:Status;created_at:string;review_note?:string;company_name?:string;contact_name?:string;
  tax_number?:string;tax_office?:string;contact_phone?:string;contact_email?:string;company_type?:string;iban?:string;has_tax_document?:boolean;description?:string;content?:Record<string,unknown>;title?:string;video_url?:string;is_live?:boolean;product_id?:number};
type Queue = {suppliers:Review[];products:Review[];stores:Review[];reels:Review[]};
type Metric = {status:string;total:number};
type Overview = {suppliers:Metric[];products:Metric[];stores:Metric[];reels:Metric[];
  conversations:number;quotes:number;commissionPercent:number;warehouseControlExtraPercent:number;liveSupplierCheckout:boolean};
const tabs=[
  {key:"overview",label:"Genel Bakış",icon:Store},{key:"suppliers",label:"Tedarikçiler",icon:ShieldCheck},
  {key:"products",label:"Ürün Onayları",icon:Package},{key:"stores",label:"Mağaza Tasarımları",icon:ClipboardCheck},
  {key:"reels",label:"Reels Onayları",icon:Film}
] as const;
type Tab = typeof tabs[number]["key"];
const statusNames:Record<string,string>={pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",suspended:"Askıda"};
const label=(r:Review,tab:Tab)=>tab==="suppliers"?(r.company_name||"Tedarikçi"):
  tab==="stores"?(r.company_name||"Mağaza"):
  tab==="products"?(String(r.content?.name||"Ürün") + (r.company_name?" · "+r.company_name:"")):
  r.title||"Reels";
const count=(arr:Metric[],s="pending")=>arr.find(x=>x.status===s)?.total||0;

export default function AdminMarketplace(){
  const [tab,setTab]=useState<Tab>("overview");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [processing,setProcessing]=useState<string|null>(null);
  const [selectedReview,setSelectedReview]=useState<{kind:ReviewKind;id:number}|null>(null);
  const {toast}=useToast();
  const overview=useQuery<Overview>({queryKey:["/api/admin/marketplace/overview"],staleTime:0,refetchInterval:30000});
  const queue=useQuery<Queue>({queryKey:["/api/admin/marketplace/review-queue"],staleTime:0,refetchInterval:30000});
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
  const groups={suppliers:queue.data?.suppliers||[],products:queue.data?.products||[],
    stores:queue.data?.stores||[],reels:queue.data?.reels||[]};
  const stats=overview.data;
  return <main className="h-full overflow-y-auto bg-background px-4 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/" className="text-xs text-muted-foreground hover:underline">← Ana yönetim paneline dön</Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Pazaryeri Yönetim Merkezi</h1>
          <p className="text-sm text-muted-foreground">Tedarikçi, ürün, mağaza ve video onayları · Çalışkan B2B</p></div>
        <Button variant="outline" disabled={overview.isFetching||queue.isFetching} onClick={()=>{void overview.refetch();void queue.refetch();}}>
          <RefreshCw className="mr-2 h-4 w-4"/>Yenile
        </Button>
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
        <section className="rounded-2xl border p-5"><h2 className="mb-4 font-bold">İletişim ve işlem hacmi</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-4"><MessageSquare className="mb-3 h-5 w-5"/><div className="text-3xl font-black">{stats?.conversations??0}</div><p className="text-xs text-muted-foreground">Müşteri sohbeti</p></div>
            <div className="rounded-xl bg-muted p-4"><CreditCard className="mb-3 h-5 w-5"/><div className="text-3xl font-black">{stats?.quotes??0}</div><p className="text-xs text-muted-foreground">Teklif talebi</p></div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4"/>Standart ve depo kontrollü teslimat, finans mutabakatına bağlanacak.</div>
        </section>
      </div>:<section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{tabs.find(t=>t.key===tab)?.label}</h2>
          <span className="text-xs text-muted-foreground">Son 100 kayıt · Bekleyenler ve geçmiş</span></div>
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
                  <div className="mt-3 flex items-center gap-4 rounded-xl border bg-muted/20 p-3">
                    <div className="h-14 w-14 shrink-0 rounded-xl border" style={{backgroundColor:typeof r.content?.accent==="string"&&/^#[a-fA-F0-9]{6}$/.test(r.content.accent)?r.content.accent:"#FACC15"}}/>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{String(r.content?.title||r.company_name||"Mağaza")}</p>
                      <p className="text-muted-foreground">{String(r.content?.tagline||"Slogan eklenmemiş")}</p>
                      <p className="text-xs text-muted-foreground">Logo, banner, renk paleti ve blok yerleşimini inceleyin</p>
                    </div>
                  </div>:null}
                {tab==="reels"?
                  <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                    <Film className="h-8 w-8 shrink-0 text-amber-600"/>
                    <span>Video oynatıcı, ürün etiketi ve yayın durumu detaylı incelemede görüntülenebilir.</span>
                  </div>:null}
              </div>
              <span className={"rounded-full px-3 py-1 text-xs font-semibold "+(r.status==="pending"?"bg-amber-100 text-amber-800":r.status==="approved"?"bg-green-100 text-green-800":"bg-slate-100 text-slate-700")}>{statusNames[r.status]||r.status}</span>
            </div>
            {r.review_note?<p className="mt-3 text-xs text-muted-foreground">Son yönetici notu: {r.review_note}</p>:null}
            {tab==="suppliers" && r.status==="pending" ? <div className="mt-4 space-y-3 border-t pt-4">
              <textarea aria-label="Onay veya ret gerekçesi" value={notes[key]||""} onChange={e=>setNotes(v=>({...v,[key]:e.target.value}))}
                placeholder="Yönetici notu / ret gerekçesi" maxLength={1000} rows={2} className="w-full rounded-lg border bg-background p-3 text-sm"/>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!processing} onClick={()=>void decision(tab,r,"approved")}><ShieldCheck className="mr-2 h-4 w-4"/>Onayla</Button>
                <Button disabled={!!processing} variant="outline" onClick={()=>void decision(tab,r,"rejected")}>Gerekçeli Reddet</Button>
              </div>
            </div>:null}
            {tab!=="suppliers" && tab!=="overview" ?
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
