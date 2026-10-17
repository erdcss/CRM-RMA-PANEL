
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, FileText, Film, Heart, MessageCircle, Package, Store, Truck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { B2BProductCard } from "@/components/b2b-product-card";
import { toUnifiedProduct } from "@/lib/b2b-marketplace-products";
type Shop={id:number;slug:string;company_name:string;description:string;followers:number;content:{
  title:string;tagline:string;accent:string;bannerUrl?:string;logoUrl?:string;sections:string[]}};
type ShopProduct={id:number;sku:string;stock:number;content:{name:string;description:string;category:string;
  brand:string;barcode:string;imageUrl:string;price:number|null;unitsPerBox:number;minBoxes:number}};
type Reel={id:number;title:string;video_url:string;product_id:number|null;seller_slug?:string;seller_name?:string;seller_logo_url?:string};
type ShopProductDetail=ShopProduct & {seller_slug:string;seller_name:string;seller_logo_url?:string};
function ShopAvatar({logo,name,size="md"}:{logo?:string|null;name:string;size?:"sm"|"md"|"lg"}){
  const dimensions=size==="lg"?"h-20 w-20 sm:h-24 sm:w-24":size==="sm"?"h-9 w-9":"h-12 w-12";
  return <span aria-label={name} className={"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white text-amber-700 shadow-sm "+dimensions}>
    {logo?<img src={logo} alt={name+" logosu"} className="h-full w-full object-contain"/>:<Store aria-label="Varsayılan dükkan logosu" className={size==="lg"?"h-11 w-11":"h-6 w-6"}/>}
  </span>;
}
const box="rounded-2xl border border-slate-200 bg-white p-4";
const money=(v:number)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(v);
export function MarketplaceDirectory(){
  const {data=[],isLoading}=useQuery<Shop[]>({queryKey:["/api/marketplace/stores"],staleTime:30000});
  return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-6xl"><Link href="/magazalar" className="text-sm text-slate-600"><ArrowLeft className="mr-1 inline h-4 w-4"/>Mağazalar</Link>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black">Toptancı Mağazaları</h1><p className="mt-1 text-sm text-slate-500">Çalışkan B2B tarafından onaylanmış tedarikçiler</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/reels" className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"><Film className="h-4 w-4"/>Satıcı Reels</Link>
          <a href="https://pazaryeri.ecalisgan.com" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Tedarikçi Başvurusu / Girişi</a></div>
      </div>
      {isLoading?<p>Mağazalar yükleniyor...</p>:data.length===0?<div className={box+" py-16 text-center text-sm text-slate-500"}>Henüz yayında tedarikçi mağazası bulunmuyor.</div>:null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map(shop=><Link key={shop.id} href={"/magaza/"+shop.slug} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg">
        <div className="relative aspect-[3/1] bg-[#FACC15]">
          {shop.content?.bannerUrl?<img src={shop.content.bannerUrl} alt="Mağaza kapak görseli" className="h-full w-full object-cover"/>:null}
          <div className="absolute -bottom-5 left-4"><ShopAvatar logo={shop.content?.logoUrl} name={shop.company_name}/></div>
        </div>
        <div className="space-y-2 px-4 pb-4 pt-8"><p className="flex items-center gap-2 font-bold">{shop.company_name}<BadgeCheck className="h-4 w-4 text-green-600"/></p>
          <p className="line-clamp-2 text-xs text-slate-500">{shop.content?.tagline||shop.description}</p>
          <span className="text-xs text-slate-600">{shop.followers} takipçi</span></div>
      </Link>)}</div>
    </div>
  </main>;
}
export function MarketplaceShop({slug}:{slug:string}){
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const {data:shop,isLoading}=useQuery<Shop>({queryKey:["/api/marketplace/stores/"+slug],staleTime:30000});
  const {data:products=[]}=useQuery<ShopProduct[]>({queryKey:["/api/marketplace/stores/"+slug+"/products"],staleTime:30000});
  const {data:reels=[]}=useQuery<Reel[]>({queryKey:["/api/marketplace/stores/"+slug+"/reels"],staleTime:30000});
  const {data:follows=[]}=useQuery<Array<{slug:string}>>({queryKey:["/api/marketplace/follows"],retry:false,staleTime:0});
  const {data:session}=useQuery<{role:string;isActive:boolean}|null>({queryKey:["/api/auth/me"],retry:false,staleTime:15000});
  const isFollowing=follows.some(f=>f.slug===slug);
  const loggedIn=session?.role==="b2b_customer" && session?.isActive===true;
  async function follow(){
    if(busy)return;
    setBusy(true);setMessage("");
    try {
      await apiRequest(isFollowing?"DELETE":"POST","/api/marketplace/stores/"+encodeURIComponent(slug)+"/follow");
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/marketplace/follows"]}),
        queryClient.invalidateQueries({queryKey:["/api/marketplace/stores/"+slug]})
      ]);
    }catch(e){setMessage(e instanceof Error?e.message:"Mağaza takip edilemedi. İşletme hesabıyla giriş yapın.");}
    finally{setBusy(false);}
  }
  if(isLoading)return <main className="min-h-screen bg-[#f6f7f9] p-8 text-slate-600">Mağaza yükleniyor...</main>;
  if(!shop)return <main className="min-h-screen bg-[#f6f7f9] p-8">Mağaza bulunamadı. <Link href="/magazalar" className="font-bold text-amber-800">Tüm mağazalar</Link></main>;
  const storeProducts=products.map(p=>toUnifiedProduct({...p,seller_slug:slug,seller_name:shop.company_name,seller_logo_url:shop.content?.logoUrl}));
  return <main className="min-h-screen bg-[#f6f7f9] pb-12 text-slate-900">
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <Link href="/magazalar" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4"/>Tüm mağazalar</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
        <div className="relative aspect-[3/1] w-full bg-[#FFCD00]">
          {shop.content?.bannerUrl?<img src={shop.content.bannerUrl} alt={shop.company_name+" mağaza kapağı"} className="absolute inset-0 h-full w-full object-cover"/>:null}
        </div>
        <div className="relative px-5 pb-5 pt-14 sm:px-8">
          <div className="absolute -top-10 left-5 sm:left-8"><ShopAvatar logo={shop.content?.logoUrl} name={shop.company_name} size="lg"/></div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black sm:text-2xl">{shop.company_name}</h1>
            <BadgeCheck aria-label="Onaylı tedarikçi" className="h-5 w-5 text-green-600"/>
            <span className="text-xs font-semibold text-slate-500">{shop.followers||0} takipçi</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{shop.content?.tagline||shop.description||"Onaylı Çalışkan B2B tedarikçisi"}</p>
          <Link href={"/mesajlarim?store="+encodeURIComponent(slug)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-200">
            <MessageCircle className="h-4 w-4"/>İletişime Geç
          </Link>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link href={"/mesajlarim?store="+encodeURIComponent(slug)+"&quote=1"} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-[#FFCD00] px-2 py-2 text-center text-xs font-bold text-slate-950 hover:bg-amber-300 sm:flex-row sm:text-sm">
              <FileText className="h-4 w-4"/>Teklif İste
            </Link>
            <Link href="/pazaryeri-sepetim" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-[#FFCD00] px-2 py-2 text-center text-xs font-bold text-slate-950 hover:bg-amber-300 sm:flex-row sm:text-sm">
              <Store className="h-4 w-4"/>Sepetim
            </Link>
            <button type="button" disabled={busy} onClick={()=>void follow()} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-[#FFCD00] px-2 py-2 text-center text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 sm:flex-row sm:text-sm">
              <Heart className="h-4 w-4"/>{isFollowing?"Takip Ediliyor":"Mağazayı Takip Et"}
            </button>
          </div>
          {message?<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{message}</p>:null}
        </div>
      </div>
      <h2 className="mb-4 mt-8 text-xl font-black">Ürünler</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {storeProducts.map(product=><B2BProductCard key={String(product.id)} product={product} loggedIn={loggedIn}/>)}
        {!storeProducts.length?<p className="col-span-full rounded-xl border bg-white p-8 text-sm text-slate-500">Onaylanmış ürün bulunmuyor.</p>:null}
      </div>
      <div className="mt-9 flex items-center justify-between gap-2"><h2 className="text-xl font-black">Mağaza Reels</h2><Link href="/reels" className="text-sm font-semibold text-amber-800 hover:underline">Tüm Reels →</Link></div>
      <div className="mt-4 flex gap-4 overflow-x-auto">{reels.map(r=><div key={r.id} className="w-48 shrink-0 overflow-hidden rounded-xl border bg-white">
        <video controls preload="metadata" playsInline src={r.video_url} className="aspect-[9/16] w-full bg-slate-950 object-contain"/>
        <div className="space-y-2 p-3"><p className="text-sm font-semibold">{r.title}</p>
          <Link href={"/magaza/"+encodeURIComponent(slug)} className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:underline">
            <ShopAvatar logo={r.seller_logo_url||shop.content?.logoUrl} name={shop.company_name} size="sm"/>
            <span className="min-w-0"><span className="block truncate">{shop.company_name}</span><span className="block text-amber-700">Mağazayı görüntüle</span></span>
          </Link>
        </div>
      </div>)}</div>
      {!reels.length?<p className="mt-3 text-sm text-slate-500">Henüz onaylanmış video yok.</p>:null}
    </div>
  </main>;
}
export function MarketplaceProduct({slug,productId}:{slug:string;productId:string}){
  const key="/api/marketplace/stores/"+encodeURIComponent(slug)+"/products/"+encodeURIComponent(productId);
  const {data:product,isLoading,isError}=useQuery<ShopProductDetail>({queryKey:[key],retry:false,staleTime:15000});
  const {data:shop}=useQuery<Shop>({queryKey:["/api/marketplace/stores/"+slug],staleTime:30000});
  const [boxes,setBoxes]=useState(1);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const seller=product?.seller_name||shop?.company_name||"";
  const logo=product?.seller_logo_url||shop?.content?.logoUrl;
  const storeUrl="/magaza/"+encodeURIComponent(slug);
  if(isLoading)return <main className="p-8 text-center text-slate-500">Ürün yükleniyor...</main>;
  if(isError||!product)return <main className="p-8 text-center"><p>Ürün bulunamadı veya yayından kaldırıldı.</p><Link href={storeUrl} className="text-amber-700 underline">Mağazaya dön</Link></main>;
  const minimum=Math.max(1,Number(product.content.minBoxes)||1);
  const pack=Math.max(1,Number(product.content.unitsPerBox)||1);
  const maximum=Math.floor(Number(product.stock||0)/pack);
  const requested=Math.min(maximum,Math.max(minimum,boxes));
  return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <Link href={storeUrl} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4"/>Mağazaya dön</Link>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-2xl border bg-white p-6">
          {product.content.imageUrl?<img src={product.content.imageUrl} alt={product.content.name} className="max-h-full w-full object-contain"/>:<Package className="h-24 w-24 text-slate-200"/>}
        </div>
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
          <h1 className="mt-2 text-xl font-black leading-snug sm:text-2xl">{product.content.name}</h1>
          <Link href={storeUrl} className="mt-5 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 transition hover:border-amber-300">
            <ShopAvatar logo={logo} name={seller}/>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-1 text-sm font-bold"><span className="truncate">{seller}</span><BadgeCheck className="h-4 w-4 shrink-0 text-green-600"/></span>
              <span className="mt-1 block text-xs font-semibold text-amber-800">Mağazayı görüntüle →</span></span>
          </Link>
          <div className="mt-5 border-y py-4"><p className="text-xs text-slate-500">B2B birim fiyatı</p>
            <p className="mt-1 text-2xl font-black">{product.content.price==null?"Fiyat için giriş yapın":money(Number(product.content.price))}</p>
            <p className="mt-1 text-xs text-slate-500">Koli içi {pack} adet · Minimum {minimum} koli · Stok {product.stock} adet</p>
          </div>
          {product.content.description?<p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{product.content.description}</p>:null}
          {status?<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{status}</p>:null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium" htmlFor="product-boxes">Koli adedi</label>
            <input id="product-boxes" type="number" min={minimum} max={maximum} disabled={maximum<minimum} value={boxes} onChange={e=>setBoxes(Number(e.target.value)||minimum)} className="w-24 rounded-lg border px-3 py-2 text-sm"/>
            <button disabled={busy||maximum<minimum} onClick={async()=>{
              setBusy(true);setStatus("");
              try{await apiRequest("POST","/api/marketplace/cart",{productId:Number(product.id),boxes:requested,deliveryMode:"direct"});setStatus("Ürün sepete eklendi.");}
              catch(e){setStatus(e instanceof Error?e.message:"Sepete eklenemedi. İşletme hesabıyla giriş yapın.");}
              finally{setBusy(false);}
            }} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Sepete ekle</button>
          </div>
          {maximum<minimum?<p className="mt-2 text-xs text-red-700">Minimum sipariş için yeterli stok yok.</p>:null}
          <Link href={storeUrl} className="mt-5 inline-flex text-sm font-semibold text-amber-800 hover:underline">Satıcının diğer ürünlerini görüntüle →</Link>
        </section>
      </div>
    </div>
  </main>;
}

export function MarketplaceReels(){
  const {data:reels=[],isLoading}=useQuery<Reel[]>({queryKey:["/api/marketplace/reels"],staleTime:15000});
  return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-900"><div className="mx-auto max-w-5xl">
    <Link href="/magazalar" className="text-sm text-slate-600"><ArrowLeft className="mr-1 inline h-4 w-4"/>Mağazalar</Link>
    <h1 className="my-5 text-2xl font-black">Satıcı Reels</h1>
    {isLoading?<p className="text-sm text-slate-500">Videolar yükleniyor...</p>:null}
    <div className="grid grid-cols-2 gap-3 sm:gap-5">{reels.map(reel=><article key={reel.id} className="min-w-0 overflow-hidden rounded-2xl border bg-white">
      <video controls preload="metadata" playsInline src={reel.video_url} className="aspect-[9/16] w-full bg-slate-950 object-contain"/>
      <div className="space-y-3 p-3"><h2 className="line-clamp-2 text-sm font-semibold">{reel.title}</h2>
        {reel.seller_slug&&reel.seller_name?<Link href={"/magaza/"+encodeURIComponent(reel.seller_slug)} className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 hover:bg-amber-100">
          <ShopAvatar logo={reel.seller_logo_url} name={reel.seller_name} size="sm"/>
          <span className="min-w-0"><span className="block truncate text-xs font-bold">{reel.seller_name}</span><span className="text-xs text-amber-800">Mağazayı görüntüle</span></span>
        </Link>:null}
        {reel.product_id&&reel.seller_slug?<Link href={"/magaza/"+encodeURIComponent(reel.seller_slug)+"/urun/"+reel.product_id} className="block text-xs font-semibold text-slate-700 underline">Ürünü görüntüle</Link>:null}
      </div>
    </article>)}</div>
    {!isLoading&&!reels.length?<p className="rounded-xl border bg-white p-8 text-sm text-slate-500">Henüz onaylanmış satıcı videosu bulunmuyor.</p>:null}
  </div></main>;
}
export function MarketplaceBuyerInbox(){
  const [selected,setSelected]=useState<number|null>(()=>{
    const v=new URLSearchParams(window.location.search).get("conversation");
    return v&&Number.isSafeInteger(Number(v))?Number(v):null;
  });
  const [storeSlug]=useState(()=>new URLSearchParams(window.location.search).get("store")||"");
  const [text,setText]=useState("");
  const [boxes,setBoxes]=useState("1");
  const [quoteMessage,setQuoteMessage]=useState("");
  const [message,setMessage]=useState("");
  const {data:conversations=[]}=useQuery<Array<{id:number;company_name:string;slug:string;latest_message:string}>>({queryKey:["/api/marketplace/conversations"],retry:false,staleTime:0});
  const {data:selectedStore}=useQuery<Shop>({queryKey:["/api/marketplace/stores/"+storeSlug],enabled:!!storeSlug,retry:false,staleTime:30000});
  useEffect(()=>{
    if(selected||!storeSlug)return;
    const current=conversations.find(c=>c.slug===storeSlug);
    if(current)setSelected(Number(current.id));
  },[selected,storeSlug,conversations]);
  const {data:messages=[]}=useQuery<Array<{id:number;text:string;created_at:string}>>({
    queryKey:["/api/marketplace/conversations/"+selected+"/messages"],enabled:!!selected,staleTime:0});
  const {data:quotes=[]}=useQuery<Array<{id:number;conversation_id:number;status:string;boxes:number;latest_offer?:{amount_per_box:string;expires_at:string}}>>({
    queryKey:["/api/marketplace/quotes"],staleTime:0});
  async function sendMessage(){
    const clean=text.trim();if(!clean)return;
    setMessage("");
    try{
      if(selected){await apiRequest("POST","/api/marketplace/conversations/"+selected+"/messages",{text:clean});}
      else if(storeSlug){
        const response=await apiRequest("POST","/api/marketplace/conversations",{slug:storeSlug,text:clean});
        const conversation=await response.json() as {id:number};
        setSelected(conversation.id);
      }else return;
      setText("");
      await queryClient.invalidateQueries({queryKey:["/api/marketplace/conversations"]});
      if(selected)await queryClient.invalidateQueries({queryKey:["/api/marketplace/conversations/"+selected+"/messages"]});
    }catch(e){setMessage(e instanceof Error?e.message:"Mesaj gönderilemedi. İşletme hesabıyla giriş yapın.");}
  }
  async function doAction(path:string,body:object,refresh:string[]){
    setMessage("");
    try{await apiRequest("POST",path,body);await Promise.all(refresh.map(k=>queryClient.invalidateQueries({queryKey:[k]})));setText("");setQuoteMessage("");}
    catch(e){setMessage(e instanceof Error?e.message:"İşlem başarısız");}
  }
  return <main className="min-h-screen bg-[#f6f7f9] p-4 text-slate-900"><div className="mx-auto max-w-5xl space-y-4">
    <Link href="/magazalar" className="text-sm"><ArrowLeft className="mr-1 inline h-4 w-4"/>Mağazalar</Link>
    <h1 className="text-2xl font-black">Mesajlarım ve Tekliflerim</h1>
    {message?<p className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p>:null}
    <div className="grid gap-4 md:grid-cols-3">
      <div className={box+" space-y-2"}><h2 className="font-bold">Görüşmeler</h2>{conversations.map(c=><button key={c.id}
        onClick={()=>setSelected(Number(c.id))} className={"block w-full rounded-lg p-3 text-left text-sm "+(selected===c.id?"bg-amber-100":"bg-slate-50")}>
        <b>{c.company_name}</b><p className="truncate text-xs text-slate-500">{c.latest_message}</p></button>)}
        {!conversations.length?<p className="text-xs text-slate-500">Görüşme başlatmak için bir mağazaya gidin.</p>:null}
      </div>
      <div className={box+" space-y-4 md:col-span-2"}>{!selected&&!storeSlug?<p className="text-sm text-slate-500">Bir sohbet seçin.</p>:<>
        {!selected&&storeSlug?<p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold">Yeni sohbet: {selectedStore?.company_name||storeSlug}. Mesaj yazarak görüşmeyi başlatın.</p>:null}
        <div className="max-h-72 space-y-2 overflow-y-auto">{messages.map(m=><div key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
          <p>{m.text}</p><span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString("tr-TR")}</span></div>)}</div>
        <form onSubmit={e=>{e.preventDefault();void sendMessage();}} className="flex gap-2">
          <input value={text} onChange={e=>setText(e.target.value)} required className="min-w-0 flex-1 rounded-lg border p-3 text-sm" placeholder="Mesaj yaz"/>
          <button className="rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">Gönder</button>
        </form>
        <div className="space-y-2 border-t pt-4"><h3 className="font-semibold">Toptan teklif talebi oluştur</h3>
          {!selected?<p className="text-xs text-amber-800">Teklif isteyebilmek için önce mağazaya bir mesaj gönderin.</p>:null}
          <p className="text-xs text-slate-500">Satıcı bu görüşmeden koli bazlı resmi fiyat teklifi gönderebilir.</p>
          <div className="flex gap-2"><input className="w-24 rounded-lg border p-2 text-sm" type="number" min="1" value={boxes} onChange={e=>setBoxes(e.target.value)}/>
          <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="Ürün ve teslimat bilgisi" value={quoteMessage} onChange={e=>setQuoteMessage(e.target.value)}/></div>
          <button disabled={!selected} onClick={()=>void doAction("/api/marketplace/quotes",{conversationId:selected,boxes:Number(boxes),details:quoteMessage},
            ["/api/marketplace/quotes"])} className="rounded-lg border px-4 py-2 text-sm font-bold"><FileText className="mr-2 inline h-4 w-4"/>Teklif İste</button>
        </div></>}
      </div>
    </div>
    <div className={box+" space-y-3"}><h2 className="font-bold">Tekliflerim</h2>
      {quotes.map(q=><div key={q.id} className="rounded-lg border p-3 text-sm">
        <p><b>#{q.id}</b> · {q.boxes} koli · {q.status}</p>
        {q.latest_offer?<><p className="text-xs">Koli fiyatı: {money(Number(q.latest_offer.amount_per_box))} · Son geçerlilik: {new Date(q.latest_offer.expires_at).toLocaleString("tr-TR")}</p>
          {q.status==="offered"?<div className="mt-2 flex gap-2">
            <button onClick={()=>void doAction("/api/marketplace/quotes/"+q.id+"/decision",{decision:"accepted"},["/api/marketplace/quotes"])} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Teklifi Kabul Et</button>
            <button onClick={()=>void doAction("/api/marketplace/quotes/"+q.id+"/decision",{decision:"rejected"},["/api/marketplace/quotes"])} className="rounded-lg border px-3 py-2 text-xs">Reddet</button>
          </div>:null}</>:null}
      </div>)}
      {!quotes.length?<p className="text-sm text-slate-500">Henüz teklif yok.</p>:null}
      <p className="text-xs text-amber-800">Teklif kabulü ödeme oluşturmaz. Canlı çok satıcılı ödeme entegrasyonu tamamlanana kadar sipariş tahsilatı kapalıdır.</p>
    </div>
  </div></main>;
}
