import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Bell,CheckCircle2,Clock3,PackageSearch,RefreshCw,Search,ShoppingBasket} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

type CartLine={productId:string;sku:string;name:string;source:"web"|"mobile"|"marketplace";
  quantity:number;unitsPerBox:number;price:number;total:number;seller?:string;};
type PendingCart={userId:number;companyName:string;email:string;phone?:string;
  lastActivityAt:string;remindAt:string;remindedAt:string|null;reminderStatus:string;
  itemCount:number;boxCount:number;estimatedTotal:number;items:CartLine[];};
type Response={carts:PendingCart[];customerCount:number;totalItems:number;pendingReminders:number};
const sourceLabel:Record<string,string>={web:"Web",mobile:"Mobil",marketplace:"Tedarikçi"};
const statusLabel:Record<string,string>={
  pending:"4 saatlik süre bekleniyor",
  recorded:"Uygulama içi bildirim kaydedildi",
  push_accepted:"Bildirim gönderim servisine iletildi",
  inbox_only:"Uygulama içi bildirim kaydedildi · cihaz bildirimi yok",
  duplicate:"Tekrarlanan bildirim engellendi",
  disabled:"Bildirim kuralı kapalı",
  order_placed:"Müşteri sipariş oluşturdu"
};
const fmt=(v:number)=>Number(v||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺";
const time=(v:string)=>new Date(v).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"});
async function fetchPending():Promise<Response>{
  const response=await fetch("/api/admin/b2b-pending-carts",{credentials:"include",cache:"no-store"});
  if(!response.ok)throw Error("Bekleyen sepet bilgileri alınamadı");
  return response.json();
}
export default function AdminPendingCarts(){
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState<number[]>([]);
  const {data,isLoading,isError,refetch}=useQuery({
    queryKey:["/api/admin/b2b-pending-carts"],
    queryFn:fetchPending,refetchInterval:30_000,
  });
  const carts=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("tr-TR");
    return (data?.carts||[]).filter(c=>!q||
      [c.companyName,c.email,c.phone,String(c.userId)]
        .some(part=>String(part||"").toLocaleLowerCase("tr-TR").includes(q)));
  },[data,search]);
  return <section className="space-y-4" aria-label="Sepette bekleyen ürünler">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black"><ShoppingBasket className="h-5 w-5"/>Sepette Bekleyen Ürünler</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Firmaların henüz siparişe dönüştürmediği sepetler ve 4 saat sonra tek seferlik hatırlatma durumu.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={()=>void refetch()}><RefreshCw className="mr-1.5 h-4 w-4"/>Yenile</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Sepeti bekleyen firma",data?.customerCount??0],
        ["Sepetteki ürün satırı",data?.totalItems??0],
        ["Hatırlatması bekleyen",data?.pendingReminders??0],
      ].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-background p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      </div>)}
    </div>
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
      <Input className="pl-9" value={search} onChange={event=>setSearch(event.target.value)}
        placeholder="Firma adı, e-posta veya müşteri numarasıyla ara"/>
    </div>
    {isLoading?<div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">Sepetler yükleniyor…</div>
      :isError?<div className="rounded-xl border border-red-200 bg-background p-6 text-sm text-destructive">Sepet bilgileri yüklenemedi. Yenile butonunu deneyin.</div>
      :!carts.length?<div className="rounded-xl border bg-background p-10 text-center">
        <PackageSearch className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/>
        <p className="font-semibold">{search?"Aramanızla eşleşen sepet bulunamadı":"Sepette bekleyen ürün bulunmuyor"}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Web, mobil ve tedarikçi sepetlerindeki yeni değişiklikler sunucuyla eşitlendikçe burada görünür.
        </p>
      </div>
      :<div className="space-y-3">
        {carts.map(cart=>{
          const open=expanded.includes(cart.userId);
          const minutesLeft=Math.max(0,Math.ceil((new Date(cart.remindAt).getTime()-Date.now())/60_000));
          return <article key={cart.userId} className="overflow-hidden rounded-xl border bg-background">
            <div className="flex flex-wrap gap-3 p-4 sm:p-5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">{cart.companyName}</strong>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">#{cart.userId}</span>
                </div>
                <p className="break-all text-xs text-muted-foreground">{cart.email}{cart.phone?" · "+cart.phone:""}</p>
                <p className="text-xs text-muted-foreground">Son sepet değişikliği: {time(cart.lastActivityAt)}</p>
              </div>
              <div className="text-right">
                <div className="text-base font-black">{fmt(cart.estimatedTotal)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{cart.itemCount} ürün · {cart.boxCount} koli</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-xs">
                {cart.remindedAt?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<Clock3 className="h-4 w-4 text-amber-600"/>}
                <span>{cart.remindedAt
                  ?(statusLabel[cart.reminderStatus]||"Hatırlatma işlendi")+" · "+time(cart.remindedAt)
                  :"Hatırlatma zamanı: "+time(cart.remindAt)+" ("+(minutesLeft>0?minutesLeft+" dk kaldı":"Gönderim sırası bekleniyor")+")"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={()=>setExpanded(prev=>open?prev.filter(id=>id!==cart.userId):[...prev,cart.userId])}>
                {open?"Ürünleri gizle":"Sepet içeriğini göster"}
              </Button>
            </div>
            {open?<div className="divide-y border-t">
              {cart.items.map((item,index)=><div key={item.source+"-"+item.productId+"-"+index} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_130px] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sku||item.productId} · {sourceLabel[item.source]||item.source}{item.seller?" · "+item.seller:""}</p>
                </div>
                <div className="text-xs text-muted-foreground">{item.quantity} koli · Koli içi {item.unitsPerBox} adet</div>
                <div className="text-sm font-bold sm:text-right">{fmt(item.total)}</div>
              </div>)}
            </div>:null}
          </article>;
        })}
      </div>}
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
      Bildirim müşterinin uygulama içi bildirim kutusuna bir defa kaydedilir; etkin cihaz bildirimi varsa ayrıca push gönderilir.
      Tutarlar sepetin son kaydedilen tahmini toplamıdır, kesin sipariş veya tahsilat değildir.
    </p>
  </section>;
}
