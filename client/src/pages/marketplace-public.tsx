
import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
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
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={()=>void follow()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FFCD00] px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
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
/** Legacy supplier product links use the standard B2B product page and order list. */
export function MarketplaceProduct({slug: _slug,productId}:{slug:string;productId:string}){
  return <Redirect to={"/urun/mp-"+encodeURIComponent(productId)} />;
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
        {reel.seller_slug&&reel.seller_name?<Link href={"/magaza/"+encodeURIComponent(reel.seller_slug)} className="flex items-center gap-2 py-1.5 transition-opacity hover:opacity-75">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-amber-100">
            {reel.seller_logo_url ? <img src={reel.seller_logo_url} alt={reel.seller_name+" logosu"} className="h-full w-full rounded-full object-cover"/> : <Store className="h-4 w-4 text-slate-700" />}
          </span>
          <span className="min-w-0"><span className="block truncate text-xs font-normal text-slate-700">{reel.seller_name}</span><span className="block text-xs font-normal text-amber-800">Mağazayı Gör →</span></span>
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
  const [message,setMessage]=useState("");
  const {data:conversations=[]}=useQuery<Array<{id:number;company_name:string;slug:string;latest_message:string}>>({queryKey:["/api/marketplace/conversations"],retry:false,staleTime:0,refetchInterval:5000});
  const {data:closedChats=[]}=useQuery<Array<{id:number;closed_at:string;company_name:string;slug:string}>>({
    queryKey:["/api/marketplace/conversations/closed"],retry:false,staleTime:0,refetchInterval:5000
  });
  const latestClosed=closedChats.find(c=>c.slug===storeSlug)||closedChats[0];
  const {data:selectedStore}=useQuery<Shop>({queryKey:["/api/marketplace/stores/"+storeSlug],enabled:!!storeSlug,retry:false,staleTime:30000});
  useEffect(()=>{
    if(!storeSlug)return;
    if(selected&&!conversations.some(c=>c.id===selected)){setSelected(null);return;}
    if(selected)return;
    const current=conversations.find(c=>c.slug===storeSlug);
    if(current)setSelected(Number(current.id));
  },[selected,storeSlug,conversations]);
  const {data:messages=[]}=useQuery<Array<{id:number;text:string;created_at:string}>>({
    queryKey:["/api/marketplace/conversations/"+selected+"/messages"],enabled:!!selected,staleTime:0});
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
  return <main className="min-h-screen bg-[#f6f7f9] p-4 text-slate-900"><div className="mx-auto max-w-5xl space-y-4">
    <Link href="/magazalar" className="text-sm"><ArrowLeft className="mr-1 inline h-4 w-4"/>Mağazalar</Link>
    <h1 className="text-2xl font-black">Mesajlarım</h1>
    <div role="alert" className="sticky top-0 z-10 overflow-x-auto whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950">Çalışkan B2B uygulaması dışında gerçekleştirilen her türlü işlem sizin sorumluluğunuzdadır.</div>
    {message?<p className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p>:null}
    {latestClosed&&!conversations.some(c=>c.slug===latestClosed.slug)?<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      <b>{latestClosed.company_name}: Sohbet satıcı tarafından kapatıldı.</b>
      <div className="mt-2 flex gap-2">
        <button type="button" className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white" onClick={()=>{window.location.href="/mesajlarim?store="+encodeURIComponent(latestClosed.slug);}}>Yeni sohbet başlat</button>
        <Link href={"/magaza/"+encodeURIComponent(latestClosed.slug)} className="rounded-lg border px-3 py-2 font-semibold">Mağazaya dön</Link>
      </div>
    </div>:null}

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
        </>}
      </div>
    </div>
  </div></main>;
}
