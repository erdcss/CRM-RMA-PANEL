
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, FileText, Film, Heart, MessageCircle, Package, Store, Truck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
type Shop={id:number;slug:string;company_name:string;description:string;followers:number;content:{
  title:string;tagline:string;accent:string;bannerUrl?:string;logoUrl?:string;sections:string[]}};
type ShopProduct={id:number;sku:string;stock:number;content:{name:string;description:string;category:string;
  brand:string;barcode:string;imageUrl:string;price:number|null;unitsPerBox:number;minBoxes:number}};
type Reel={id:number;title:string;video_url:string;product_id:number|null};
const box="rounded-2xl border border-slate-200 bg-white p-4";
const money=(v:number)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(v);
export function MarketplaceDirectory(){
  const {data=[],isLoading}=useQuery<Shop[]>({queryKey:["/api/marketplace/stores"],staleTime:30000});
  return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-6xl"><Link href="/" className="text-sm text-slate-600"><ArrowLeft className="mr-1 inline h-4 w-4"/>Ürün kataloğuna dön</Link>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black">Toptancı Mağazaları</h1><p className="mt-1 text-sm text-slate-500">Çalışkan B2B tarafından onaylanmış tedarikçiler</p></div>
        <Link href="/satici" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Çalışkan B2B'de Satıcı Ol</Link>
      </div>
      {isLoading?<p>Mağazalar yükleniyor...</p>:data.length===0?<div className={box+" py-16 text-center text-sm text-slate-500"}>Henüz yayında tedarikçi mağazası bulunmuyor.</div>:null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map(shop=><Link key={shop.id} href={"/magaza/"+shop.slug} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg">
        <div className="flex h-32 items-center justify-center" style={{backgroundColor:shop.content?.accent||"#FACC15"}}>
          {shop.content?.logoUrl?<img alt="" src={shop.content.logoUrl} className="h-20 max-w-[75%] object-contain"/>:<Store className="h-12 w-12"/>}</div>
        <div className="space-y-2 p-4"><p className="flex items-center gap-2 font-bold">{shop.company_name}<BadgeCheck className="h-4 w-4 text-green-600"/></p>
          <p className="line-clamp-2 text-xs text-slate-500">{shop.content?.tagline||shop.description}</p>
          <span className="text-xs text-slate-600">{shop.followers} takipçi</span></div>
      </Link>)}</div>
    </div>
  </main>;
}
export function MarketplaceShop({slug}:{slug:string}){
  const [message,setMessage]=useState("");
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [following,setFollowing]=useState(false);
  const {data:shop,isLoading}=useQuery<Shop>({queryKey:["/api/marketplace/stores/"+slug],staleTime:0});
  const {data:products=[]}=useQuery<ShopProduct[]>({queryKey:["/api/marketplace/stores/"+slug+"/products"],staleTime:0});
  const {data:reels=[]}=useQuery<Reel[]>({queryKey:["/api/marketplace/stores/"+slug+"/reels"],staleTime:0});
  async function follow() {
    setBusy(true);setMessage("");
    try{
      await apiRequest(following?"DELETE":"POST","/api/marketplace/stores/"+slug+"/follow");
      setFollowing(!following);
      await queryClient.invalidateQueries({queryKey:["/api/marketplace/stores/"+slug]});
    }catch(e){setMessage(e instanceof Error?e.message:"Takip edilemedi. Giriş yapmanız gerekebilir.");}
    finally{setBusy(false);}
  }
  async function contact() {
    if(!text.trim())return;
    setBusy(true);setMessage("");
    try{
      const response=await apiRequest("POST","/api/marketplace/conversations",{slug,text});
      const c=await response.json() as {id:number};
      window.location.assign("/mesajlarim?conversation="+c.id);
    }catch(e){setMessage(e instanceof Error?e.message:"Sohbet açılamadı. Önce giriş yapın.");}
    finally{setBusy(false);}
  }
  if(isLoading)return <div className="p-8">Mağaza yükleniyor...</div>;
  if(!shop)return <div className="p-8">Mağaza bulunamadı. <Link href="/magazalar">Tüm mağazalar</Link></div>;
  return <main className="min-h-screen bg-[#f6f7f9] pb-12 text-slate-900">
    <div className="mx-auto max-w-6xl px-4 pt-6"><Link href="/magazalar" className="text-sm text-slate-600"><ArrowLeft className="mr-1 inline h-4 w-4"/>Tüm mağazalar</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
        <div className="relative min-h-52 p-6 sm:p-10" style={{backgroundColor:shop.content.accent||"#FACC15"}}>
          {shop.content.bannerUrl?<img src={shop.content.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover"/>:null}
          <div className="relative rounded-xl bg-white/85 p-4 backdrop-blur-sm sm:max-w-xl">
            <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-green-700"/><span className="text-xs font-semibold">Onaylı Çalışkan B2B tedarikçisi</span></div>
            <h1 className="mt-2 text-2xl font-black">{shop.content.title||shop.company_name}</h1>
            <p className="mt-1 text-sm text-slate-700">{shop.content.tagline||shop.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t p-4">
          <span className="mr-auto text-xs text-slate-500">{shop.followers} takipçi</span>
          <button disabled={busy} onClick={()=>void follow()} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">
            <Heart className="h-4 w-4"/>{following?"Takip ediliyor":"Mağazayı Takip Et"}
          </button>
          <a href="#iletisim" className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4"/>Mesaj / Teklif İste</a>
        </div>
      </div>
      {message?<p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>:null}
      <h2 className="mt-8 text-xl font-black">Toptan ürünler</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map(p=><div key={p.id} className={box+" space-y-2"}>
          <img src={p.content.imageUrl} alt={p.content.name} loading="lazy" className="h-36 w-full object-contain"/>
          <h3 className="line-clamp-2 text-sm font-bold">{p.content.name}</h3>
          <p className="text-xs text-slate-500">{p.content.unitsPerBox} adet / koli · Min. {p.content.minBoxes} koli</p>
          <p className="text-sm font-bold">{p.content.price==null?"Fiyat için giriş yapın":money(Number(p.content.price))}</p>
          <p className="text-xs text-slate-500">Stok: {p.stock}</p>
          <button onClick={()=>{setText("Merhaba, "+p.content.name+" (SKU "+p.sku+") için toptan fiyat ve sevkiyat bilgisi alabilir miyim?");document.getElementById("iletisim")?.scrollIntoView({behavior:"smooth"});}}
            className="w-full rounded-lg border px-3 py-2 text-xs font-semibold">Ürün için teklif iste</button>
        </div>)}
        {!products.length?<p className="col-span-full rounded-xl border bg-white p-8 text-sm text-slate-500">Onaylanmış ürün bulunmuyor.</p>:null}
      </div>
      <h2 className="mt-9 text-xl font-black">Mağaza Reels</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto">{reels.map(r=><div key={r.id} className="w-48 shrink-0 overflow-hidden rounded-xl border bg-white">
        <video controls preload="none" src={r.video_url} className="aspect-[9/16] w-full bg-slate-950 object-contain"/>
        <p className="p-3 text-sm font-semibold">{r.title}</p>
      </div>)}{!reels.length?<p className="text-sm text-slate-500">Henüz onaylanmış video yok.</p>:null}</div>
      <section id="iletisim" className={box+" mt-9 max-w-2xl space-y-4"}>
        <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5"/><h2 className="text-lg font-bold">Satıcıyla iletişime geç</h2></div>
        <p className="text-sm text-slate-600">Görüşmeyi yalnızca müşteri başlatabilir. Mesajlaşma ve resmi teklif süreci Çalışkan B2B içerisindedir.</p>
        <textarea rows={4} maxLength={4000} value={text} onChange={e=>setText(e.target.value)}
          placeholder="Toptan ürün, koli adedi ve teslimat koşullarını sorun..." className="w-full rounded-xl border p-3 text-sm"/>
        <button disabled={busy||!text.trim()} onClick={()=>void contact()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          <MessageCircle className="mr-2 inline h-4 w-4"/>Görüşme Başlat</button>
      </section>
    </div>
  </main>;
}
export function MarketplaceBuyerInbox(){
  const [selected,setSelected]=useState<number|null>(()=>{
    const v=new URLSearchParams(window.location.search).get("conversation");
    return v&&Number.isSafeInteger(Number(v))?Number(v):null;
  });
  const [text,setText]=useState("");
  const [boxes,setBoxes]=useState("1");
  const [quoteMessage,setQuoteMessage]=useState("");
  const [message,setMessage]=useState("");
  const {data:conversations=[]}=useQuery<Array<{id:number;company_name:string;latest_message:string}>>({queryKey:["/api/marketplace/conversations"],staleTime:0});
  const {data:messages=[]}=useQuery<Array<{id:number;text:string;created_at:string}>>({
    queryKey:["/api/marketplace/conversations/"+selected+"/messages"],enabled:!!selected,staleTime:0});
  const {data:quotes=[]}=useQuery<Array<{id:number;conversation_id:number;status:string;boxes:number;latest_offer?:{amount_per_box:string;expires_at:string}}>>({
    queryKey:["/api/marketplace/quotes"],staleTime:0});
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
        onClick={()=>setSelected(c.id)} className={"block w-full rounded-lg p-3 text-left text-sm "+(selected===c.id?"bg-amber-100":"bg-slate-50")}>
        <b>{c.company_name}</b><p className="truncate text-xs text-slate-500">{c.latest_message}</p></button>)}
        {!conversations.length?<p className="text-xs text-slate-500">Görüşme başlatmak için bir mağazaya gidin.</p>:null}
      </div>
      <div className={box+" space-y-4 md:col-span-2"}>{!selected?<p className="text-sm text-slate-500">Bir sohbet seçin.</p>:<>
        <div className="max-h-72 space-y-2 overflow-y-auto">{messages.map(m=><div key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
          <p>{m.text}</p><span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString("tr-TR")}</span></div>)}</div>
        <form onSubmit={e=>{e.preventDefault();void doAction("/api/marketplace/conversations/"+selected+"/messages",{text},
          ["/api/marketplace/conversations/"+selected+"/messages","/api/marketplace/conversations"]);}} className="flex gap-2">
          <input value={text} onChange={e=>setText(e.target.value)} required className="min-w-0 flex-1 rounded-lg border p-3 text-sm" placeholder="Mesaj yaz"/>
          <button className="rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">Gönder</button>
        </form>
        <div className="space-y-2 border-t pt-4"><h3 className="font-semibold">Toptan teklif talebi oluştur</h3>
          <p className="text-xs text-slate-500">Satıcı bu görüşmeden koli bazlı resmi fiyat teklifi gönderebilir.</p>
          <div className="flex gap-2"><input className="w-24 rounded-lg border p-2 text-sm" type="number" min="1" value={boxes} onChange={e=>setBoxes(e.target.value)}/>
          <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="Ürün ve teslimat bilgisi" value={quoteMessage} onChange={e=>setQuoteMessage(e.target.value)}/></div>
          <button onClick={()=>void doAction("/api/marketplace/quotes",{conversationId:selected,boxes:Number(boxes),details:quoteMessage},
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
