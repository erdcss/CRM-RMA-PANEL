import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Film, ImageOff, Package, ShieldCheck, Store, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ReviewKind = "products" | "stores" | "reels";
type Content = {
  name?:string;sku?:string;description?:string;category?:string;brand?:string;barcode?:string;
  imageUrl?:string;price?:number;unitsPerBox?:number;minBoxes?:number;leadDays?:number;
  model?:string;color?:string;material?:string;size?:string;collectionName?:string;tags?:string[];
  title?:string;tagline?:string;accent?:string;bannerUrl?:string|null;logoUrl?:string|null;sections?:string[];
};
type ReviewInfo = {
  id:number;status:string;is_live:boolean;is_latest?:boolean;created_at:string;reviewed_at?:string|null;
  company_name:string;slug:string;supplier_status:string;review_note?:string;
  content?:Content;
  sku?:string;stock?:number;is_enabled?:boolean;product_id?:number|null;title?:string;video_url?:string;
  product_sku?:string;linked_product_content?:Content|null;linked_product_live?:boolean|null;
};
type ReviewDetail = {
  kind:"product"|"store"|"reel";
  review:ReviewInfo;
  liveVersion:null|{id:number;content:Content;created_at:string;status:string;reviewed_at?:string|null};
  history:Array<{id:number;status:string;is_live:boolean;created_at:string;reviewed_at?:string|null}>;
};
const kinds:Record<ReviewKind,string>={products:"Ürün",stores:"Mağaza tasarımı",reels:"Reels"};
const statuses:Record<string,string>={pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi"};
const sections:Record<string,string>={
  banner:"Tanıtım bannerı",categories:"Kategoriler",products:"Ürün koleksiyonu",
  reels:"Reels videoları",about:"Mağaza hakkında",
};
const money=(n:unknown)=> {
  const amount=Number(n);
  return Number.isFinite(amount)?new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(amount):"Belirtilmemiş";
};
const text=(v:unknown)=> v===null||v===undefined||v==="" ? "Belirtilmemiş":String(v);
const media=(url:unknown)=>typeof url==="string"&&/^\/api\/marketplace\/media\/[0-9a-f]{32}$/.test(url)?url:null;
const date=(value?:string|null)=>value?new Date(value).toLocaleString("tr-TR"):"—";

function Info({name,value}:{name:string;value:unknown}){
  return <div className="min-w-0 rounded-xl border bg-background p-3">
    <p className="mb-1 text-xs text-muted-foreground">{name}</p>
    <p className="break-words text-sm font-semibold">{text(value)}</p>
  </div>;
}
function ImagePreview({src,alt}:{src?:string|null;alt:string}) {
  const url=media(src);
  return <div className="flex min-h-60 items-center justify-center overflow-hidden rounded-xl border bg-muted/50 p-4">
    {url?<a href={url} target="_blank" rel="noopener noreferrer" className="block w-full" title="Görseli yeni sekmede aç">
      <img src={url} alt={alt} className="mx-auto max-h-[340px] w-full object-contain"/>
      <span className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5"/> Büyütmek için tıkla
      </span>
    </a>:<div className="flex flex-col items-center gap-2 text-muted-foreground">
      <ImageOff className="h-10 w-10"/><span className="text-sm">Görsel bulunamadı</span>
    </div>}
  </div>;
}
function ProductPreview({review,content,title}:{review:ReviewInfo;content:Content;title:string}){
  const units=Number(content.unitsPerBox||1);
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-base font-extrabold">{title}</h3>
      <span className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">Ürün #{review.product_id||review.id}</span>
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)]">
      <ImagePreview src={content.imageUrl} alt={content.name||"Ürün görseli"}/>
      <div className="space-y-3">
        <h4 className="text-lg font-bold">{text(content.name)}</h4>
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {text(content.description)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Info name="Birim fiyatı" value={money(content.price)}/>
          <Info name="Koli toplamı (hesaplanan)" value={money(Number(content.price||0)*units)}/>
          <Info name="Koli içi" value={units+" adet"}/>
          <Info name="Minimum alım" value={text(content.minBoxes)+" koli"}/>
          <Info name="Stok (adet)" value={review.stock??"—"}/>
          <Info name="Tedarik süresi" value={text(content.leadDays)+" gün"}/>
          <Info name="Stok kodu" value={content.sku||review.sku}/>
          <Info name="Barkod" value={content.barcode}/>
          <Info name="Marka" value={content.brand}/>
          <Info name="Kategori" value={content.category}/>
          <Info name="Model" value={content.model}/>
          <Info name="Renk" value={content.color}/>
          <Info name="Malzeme" value={content.material}/>
          <Info name="Ölçü" value={content.size}/>
          <Info name="Koleksiyon" value={content.collectionName}/>
          <Info name="Ürün etiketleri" value={content.tags?.join(", ")}/>
        </div>
        {review.is_enabled===false?<p className="text-sm font-semibold text-amber-700">Ürün satıcı tarafından pasifleştirilmiş.</p>:null}
      </div>
    </div>
  </section>;
}
function StorePreview({content,title}:{content:Content;title:string}) {
  const accent=typeof content.accent==="string"&&/^#[0-9a-fA-F]{6}$/.test(content.accent)?content.accent:"#FACC15";
  const banner=media(content.bannerUrl),logo=media(content.logoUrl);
  return <section className="space-y-3">
    <h3 className="text-base font-extrabold">{title}</h3>
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="relative min-h-48 p-5 sm:p-7" style={{backgroundColor:accent}}>
        {banner?<img src={banner} alt="Mağaza bannerı" className="absolute inset-0 h-full w-full object-cover"/>:null}
        <div className="relative max-w-xl rounded-xl bg-white/90 p-4 text-slate-950 shadow-sm">
          <div className="flex items-center gap-3">
            {logo?<img src={logo} alt="Mağaza logosu" className="h-12 w-12 rounded-lg bg-white object-contain p-1"/>:
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white"><Store className="h-6 w-6"/></div>}
            <div className="min-w-0">
              <h4 className="break-words text-lg font-black">{text(content.title)}</h4>
              <p className="mt-1 break-words text-sm">{text(content.tagline)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-semibold text-muted-foreground">Mağaza blokları · satıcının belirlediği sırada</p>
        {(content.sections||[]).map((part,i)=>
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold">{i+1}</span>
            <span className="font-medium">{sections[part]||part}</span>
          </div>)}
        {!content.sections?.length?<p className="text-xs text-muted-foreground">Tasarım bloğu bulunamadı.</p>:null}
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      <Info name="Tema rengi" value={accent}/>
      <Info name="Logo" value={logo?"Yüklendi":"Yüklenmedi"}/>
      <Info name="Banner" value={banner?"Yüklendi":"Yüklenmedi"}/>
    </div>
    <p className="text-xs text-muted-foreground">Bu, inceleme için hazırlanan önizlemedir; onaylanmadan müşterilere yayınlanmaz.</p>
  </section>;
}
function ReelPreview({review}:{review:ReviewInfo}){
  const video=media(review.video_url);
  const product=review.linked_product_content;
  return <div className="grid gap-6 md:grid-cols-[minmax(230px,0.75fr)_minmax(0,1.25fr)]">
    <div className="flex items-start justify-center">
      {video?<video key={review.id} controls playsInline preload="metadata" src={video}
        aria-label={review.title||"Reels video önizlemesi"}
        className="aspect-[9/16] max-h-[530px] w-full max-w-72 rounded-2xl bg-black object-contain"/>:
        <div className="flex aspect-[9/16] w-full max-w-72 flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground">
          <Film className="h-10 w-10"/>Video bulunamadı
        </div>}
    </div>
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{text(review.title)}</h3>
      <p className="text-sm text-muted-foreground">Video, satıcının mağazasında ve pazaryeri Reels alanında yayınlanmak üzere gönderildi.</p>
      <div className="grid grid-cols-2 gap-2">
        <Info name="Video kimliği" value={review.id}/>
        <Info name="Yayın durumu" value={review.is_live?"Yayında":"Henüz yayında değil"}/>
        <Info name="Bağlı ürün kodu" value={review.product_sku}/>
        <Info name="Bağlı ürün yayında mı?" value={!review.product_id?"Ürün etiketlenmedi":review.linked_product_live?"Evet":"Hayır"}/>
      </div>
      {product?<div className="rounded-2xl border p-4">
        <h4 className="mb-3 font-bold">Videoda etiketlenen ürün</h4>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <ImagePreview src={product.imageUrl} alt={product.name||"Etiketli ürün"}/>
          <div className="space-y-2">
            <p className="font-semibold">{text(product.name)}</p>
            <p className="text-sm text-muted-foreground">{text(product.brand)} · {text(product.category)}</p>
            <p className="font-bold">{money(product.price)}</p>
          </div>
        </div>
        {!review.linked_product_live?<p className="mt-3 text-sm font-semibold text-amber-700">
          Ürün henüz onaylı değil. Reels onayından önce ürünün yayına alınması gerekir.
        </p>:null}
      </div>:null}
    </div>
  </div>;
}
export function MarketplaceReviewDialog({
  selection,note,onNote,onClose,onDecision,processing,
}:{
  selection:null|{kind:ReviewKind;id:number};
  note:string;onNote:(note:string)=>void;onClose:()=>void;
  onDecision:(value:"approved"|"rejected")=>void;processing:boolean;
}){
  const detail=useQuery<ReviewDetail>({
    queryKey:["/api/admin/marketplace/reviews",selection?.kind,selection?.id],
    queryFn:async()=>{
      const kind=selection!.kind==="products"?"product":selection!.kind==="stores"?"store":"reel";
      const res=await fetch("/api/admin/marketplace/reviews/"+kind+"/"+selection!.id,{credentials:"include"});
      if(!res.ok){const error=await res.json().catch(()=>null);throw new Error(error?.error||"İnceleme yüklenemedi");}
      return res.json();
    },
    enabled:!!selection,staleTime:0,refetchOnMount:"always",
  });
  const data=detail.data;
  const review=data?.review;
  const isPending=review?.status==="pending" && (selection?.kind!=="stores"||review.is_latest!==false);
  return <Dialog open={!!selection} onOpenChange={(open)=>{if(!open&&!processing)onClose();}}>
    <DialogContent className="gap-0 p-0">
      <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 sm:px-8">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5 text-amber-500"/>
          {selection?kinds[selection.kind]:"İnceleme"} · Detaylı İnceleme
        </DialogTitle>
        <DialogDescription>
          {selection?"Başvuru #"+selection.id+" · Ürün, mağaza ve video içeriği yalnızca yönetici onayıyla yayınlanır.":""}
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {detail.isLoading?<div className="py-12 text-center text-muted-foreground">İnceleme ayrıntıları yükleniyor…</div>:null}
          {detail.isError?<div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <AlertCircle className="h-5 w-5 shrink-0"/>
            <div><p className="font-bold">İçerik yüklenemedi</p>
              <p>{detail.error instanceof Error?detail.error.message:"Lütfen tekrar deneyin."}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={()=>void detail.refetch()}>Tekrar Dene</Button>
            </div>
          </div>:null}
          {review?<div className="space-y-6">
            <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-3">
              <Info name="Tedarikçi" value={review.company_name}/>
              <Info name="İnceleme durumu" value={statuses[review.status]||review.status}/>
              <Info name="Gönderim tarihi" value={date(review.created_at)}/>
              <Info name="Tedarikçi hesap durumu" value={statuses[review.supplier_status]||review.supplier_status}/>
              <Info name="Yayında mı?" value={review.is_live?"Evet":"Hayır"}/>
              <Info name="Değerlendirme tarihi" value={date(review.reviewed_at)}/>
            </div>
            {selection?.kind==="stores" && review.is_latest===false?<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Bu başvurudan sonra yeni bir mağaza tasarımı gönderilmiş. Eski sürüm onaylanamaz; lütfen tedarikçinin son gönderdiği tasarımı inceleyin.
            </div>:null}
            {selection?.kind==="products" && review.content ?
              <ProductPreview review={review} content={review.content} title="Onaya gönderilen ürün"/>:null}
            {selection?.kind==="stores" && review.content ?
              <StorePreview content={review.content} title="Onaya gönderilen mağaza tasarımı"/>:null}
            {selection?.kind==="reels" ? <ReelPreview review={review}/>:null}
            {data?.liveVersion && selection?.kind!=="reels" ?
              <div className="space-y-3 border-t pt-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600"/>
                  <h3 className="font-bold">Mevcut yayındaki sürüm · #{data.liveVersion.id}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Onaya gönderilen yeni sürüm ile karşılaştırabilirsiniz. Mevcut sürüm karar verilene kadar yayında kalır.
                </p>
                {selection?.kind==="products" ?
                  <ProductPreview review={review} content={data.liveVersion.content} title="Yayındaki ürün bilgileri"/>:
                  <StorePreview content={data.liveVersion.content} title="Yayındaki mağaza tasarımı"/>}
              </div>:null}
            {data?.history.length && selection?.kind!=="reels"?
              <div className="border-t pt-4">
                <h3 className="mb-3 font-bold">Sürüm geçmişi</h3>
                <div className="flex flex-wrap gap-2">
                  {data.history.map(h=><span key={h.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                    <Clock3 className="h-3.5 w-3.5"/>#{h.id} · {statuses[h.status]||h.status}
                    {h.is_live?" · Yayında":""}{selection?.kind==="stores" && h.id!==data.history[0]?.id && h.status==="pending"?" · Daha yeni başvuru var":""}
                  </span>)}
                </div>
              </div>:null}
            {review.review_note?<div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="mb-1 font-semibold">Önceki yönetici notu</p>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{review.review_note}</p>
            </div>:null}
            {!isPending && !(selection?.kind==="stores" && review.is_latest===false)?<p className="rounded-xl bg-muted p-4 text-sm">
              Bu içerik zaten değerlendirilmiş. Yeni onay işlemi yapılamaz.
            </p>:null}
          </div>:null}
        </div>
      </div>
      {review&&isPending?<div className="shrink-0 border-t bg-background px-5 py-4 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-3">
          <label htmlFor="marketplace-review-note" className="block text-sm font-semibold">Yönetici değerlendirme notu</label>
          <textarea id="marketplace-review-note" maxLength={1000} value={note}
            onChange={e=>onNote(e.target.value)} rows={2}
            placeholder="Ret işleminde gerekçe zorunludur. Onay için isteğe bağlı not yazabilirsiniz."
            className="w-full resize-y rounded-xl border bg-background p-3 text-sm"/>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={processing}>Kapat</Button>
            <Button variant="outline" disabled={processing||!note.trim()} onClick={()=>onDecision("rejected")}>
              Gerekçeli Reddet
            </Button>
            <Button disabled={processing||detail.isFetching} onClick={()=>onDecision("approved")}>
              <ShieldCheck className="mr-2 h-4 w-4"/>{processing?"İşleniyor…":"İnceledim, Onayla"}
            </Button>
          </div>
        </div>
      </div>:null}
    </DialogContent>
  </Dialog>;
}
