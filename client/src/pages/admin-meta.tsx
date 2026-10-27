import {useEffect,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {AlertCircle,CheckCircle2,Clock3,ExternalLink,Link2,RefreshCw,Save,Settings2,ShoppingBag,UploadCloud,Database,PackageCheck,ShieldCheck} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";

type SyncResult={status:string;count:number;message:string};
type CatalogStatus={
  enabled:boolean;catalogId:string;tokenConfigured:boolean;canSync:boolean;syncIntervalSeconds:number;
  source:{sourceCount:number;eligible:number;skipped:number};confirmedCount:number;
  batches:{state:string;n:number}[];
  history:{id:string;state:string;error:string|null;created_at:string;checked_at:string|null;items:number}[];
  feedUrl:string;
};
type Pixel={enabled:boolean;pixelId:string;capiConfigured:boolean};
const jsonFetch=async<T,>(url:string,options?:RequestInit):Promise<T>=>{
  const response=await fetch(url,{credentials:"include",cache:"no-store",...options});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||payload.message||"İşlem tamamlanamadı");
  return payload as T;
};
const Panel=({children,className=""}:{children:React.ReactNode;className?:string})=>
  <section className={"rounded-2xl border border-slate-200 bg-white p-5 shadow-sm "+className}>{children}</section>;
const chip=(ready:boolean)=><span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold "+(ready?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>{ready?<CheckCircle2 className="h-3.5 w-3.5"/>:<Clock3 className="h-3.5 w-3.5"/>}{ready?"Hazır":"Kurulum gerekli"}</span>;

export default function AdminMeta(){
  const client=useQueryClient();
  const {data,error,isLoading}=useQuery<CatalogStatus>({queryKey:["/api/admin/meta/catalog-status"],queryFn:()=>jsonFetch("/api/admin/meta/catalog-status"),refetchInterval:15000});
  const {data:pixel}=useQuery<Pixel>({queryKey:["/api/admin/meta-tracking"],queryFn:()=>jsonFetch("/api/admin/meta-tracking")});
  const [catalogId,setCatalogId]=useState("");
  const [enabled,setEnabled]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);
  useEffect(()=>{if(data&&!dirty){setCatalogId(data.catalogId||"");setEnabled(Boolean(data.enabled));}},[data?.catalogId,data?.enabled,dirty]);
  async function action(type:"save"|"sync"|"check"){
    setBusy(type);setMessage(null);
    try{
      if(type==="save"){
        await jsonFetch("/api/admin/meta/catalog-config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({catalogId:catalogId.trim(),enabled})});
        setDirty(false);setMessage({ok:true,text:"Katalog ayarları kaydedildi. Meta yetkisi tanımlıysa otomatik eşitleme başlayacaktır."});
      }else if(type==="sync"){
        const result=await jsonFetch<SyncResult>("/api/admin/meta/sync-now",{method:"POST"});
        setMessage({ok:result.status!=="error",text:result.message+(result.count?" · "+result.count+" ürün":"")});
      }else{
        const result=await jsonFetch<{name:string;product_count?:number}>("/api/admin/meta/check-connection");
        setMessage({ok:true,text:"Meta katalog bağlantısı doğrulandı: "+(result.name||catalogId)+(result.product_count!=null?" · "+result.product_count+" ürün":"")});
      }
      await client.invalidateQueries({queryKey:["/api/admin/meta/catalog-status"]});
    }catch(e){setMessage({ok:false,text:e instanceof Error?e.message:"İstek başarısız"});}
    finally{setBusy("");}
  }
  const summary=data?.batches||[];
  const pending=summary.find(s=>s.state==="pending")?.n||0;
  const failed=summary.find(s=>s.state==="failed")?.n||0;
  return <main className="h-full overflow-y-auto bg-slate-50 p-4 md:p-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">Çalışkan B2B · Yönetim Merkezi</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Meta Yönetimi</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Meta Pixel, ürün kataloğu, bağlantı durumu ve ürün senkronizasyonunu tek ekrandan izle.</p>
        </div>
        <a href="https://business.facebook.com/commerce/" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"><ExternalLink className="h-4 w-4"/>Commerce Manager</a>
      </div>

      {error&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error instanceof Error?error.message:"Meta durum bilgileri alınamadı"}</div>}
      {message&&<div role="status" className={"rounded-lg border p-3 text-sm "+(message.ok?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-rose-200 bg-rose-50 text-rose-800")}>{message.text}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {name:"Toplam kaynak ürün",number:data?.source.sourceCount,Icon:Database},
          {name:"Meta'ya uygun ürün",number:data?.source.eligible,Icon:ShoppingBag},
          {name:"Meta tarafından onaylanan",number:data?.confirmedCount,Icon:PackageCheck},
          {name:"Aktarılmayan / eksik veri",number:data?.source.skipped,Icon:AlertCircle}
        ].map(x=><Panel key={x.name}><div className="flex items-center justify-between"><x.Icon className="h-5 w-5 text-amber-700"/><span className="text-2xl font-black text-slate-900">{x.number??(isLoading?"…":0)}</span></div><p className="mt-3 text-xs font-medium text-slate-500">{x.name}</p></Panel>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-black">Meta Pixel</h2>{chip(Boolean(pixel?.enabled))}</div>
          <p className="mt-2 text-sm text-slate-600">Web sitesi olayları ve reklam dönüşüm ölçümü.</p>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-2 border-b pb-2"><span>Pixel / veri seti ID</span><strong className="font-mono">{pixel?.pixelId||"—"}</strong></div>
            <div className="flex justify-between gap-2 border-b pb-2"><span>Tarayıcı Pixel</span><strong>{pixel?.enabled?"Etkin · ziyaretçi iznine bağlı":"Devre dışı"}</strong></div>
            <div className="flex justify-between gap-2"><span>Conversions API</span><strong>{pixel?.capiConfigured?"Sunucu anahtarı mevcut":"Sunucu anahtarı eksik"}</strong></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className="text-sm font-bold text-blue-700 underline underline-offset-4" href="/ayarlar?tab=meta">Pixel ayarlarını düzenle</a>
            <a className="text-sm font-bold text-blue-700 underline underline-offset-4" href="https://business.facebook.com/events_manager2/" target="_blank" rel="noopener noreferrer">Olay Yöneticisi</a>
          </div>
          <p className="mt-3 text-xs text-slate-500">Gerçek zamanlı Pixel olay sayıları için Meta Olay Yöneticisi'ni kullan. Bu ekran Meta'dan alınmamış sayıları tahmin etmez.</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-black">Katalog bağlantısı</h2>{chip(Boolean(data?.canSync))}</div>
          <p className="mt-2 text-sm text-slate-600">Ürünler ve stok değişiklikleri Graph API üzerinden takip edilir.</p>
          <label className="mt-4 block space-y-1.5"><span className="text-sm font-semibold">Meta katalog ID</span>
            <Input placeholder="Meta Commerce Manager'daki katalog kimliği" inputMode="numeric" value={catalogId}
              onChange={e=>{setCatalogId(e.target.value.replace(/\D/g,""));setDirty(true);}}/>
          </label>
          <div className="mt-4 flex items-center gap-3"><Switch checked={enabled} onCheckedChange={v=>{setEnabled(v);setDirty(true);}} aria-label="Otomatik Meta senkronizasyonu"/><div><p className="text-sm font-bold">Otomatik senkronizasyon</p><p className="text-xs text-slate-500">Yeni ürün, fiyat ve stok değişikliklerini yaklaşık 15 saniyede tarar.</p></div></div>
          <div className="mt-4 flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-slate-500"/>Erişim anahtarı: <strong>{data?.tokenConfigured?"Railway'de tanımlı":"Railway'de henüz tanımlı değil"}</strong></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={()=>void action("save")} disabled={!!busy}><Save className="mr-2 h-4 w-4"/>{busy==="save"?"Kaydediliyor…":"Kaydet"}</Button>
            <Button variant="outline" onClick={()=>void action("check")} disabled={!!busy||!data?.canSync}><Link2 className="mr-2 h-4 w-4"/>Bağlantıyı test et</Button>
            <Button variant="outline" onClick={()=>void action("sync")} disabled={!!busy||!data?.canSync}><RefreshCw className="mr-2 h-4 w-4"/>Şimdi senkronize et</Button>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Ürün senkronizasyonu ve hata kayıtları</h2>
          <p className="mt-1 text-sm text-slate-600">Gönderim sonrası Meta'nın işleme onayı beklenir. Gönderilen ürünler hemen başarılı sayılmaz.</p></div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{pending} bekleyen parti</span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">{failed} hata kaydı</span></div></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Tarih</th><th className="p-3">İşlem</th><th className="p-3">Ürün</th><th className="p-3">Mesaj</th></tr></thead><tbody>
            {data?.history?.length ? data.history.map(h=><tr key={h.id} className="border-b align-top"><td className="p-3 text-xs">{new Date(h.created_at).toLocaleString("tr-TR")}</td><td className="p-3 font-bold">{h.state==="ok"?"Meta onayladı":h.state==="pending"?"İşleniyor":"Hata"}</td><td className="p-3">{h.items}</td><td className="max-w-lg p-3 break-words text-xs text-slate-600">{h.error||"—"}</td></tr>)
              :<tr><td colSpan={4} className="p-7 text-center text-slate-500">Henüz Meta API gönderim kaydı yok.</td></tr>}
          </tbody></table>
        </div>
      </Panel>
      <Panel>
        <h2 className="flex items-center gap-2 text-lg font-black"><Settings2 className="h-5 w-5"/>Meta kurulum adımları</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>Meta Commerce Manager'da Çalışkan B2B adına bir e-ticaret kataloğu oluştur veya sahibi olduğun mevcut kataloğu seç. “Kataloğa erişim iste” yalnızca başka bir işletmenin kataloğu içindir.</li>
          <li>Katalog ID'yi yukarıya yaz. Meta sistem kullanıcısına katalog yönetim izni ver ve erişim anahtarını Railway üzerindeki B2B web servisine <code className="rounded bg-slate-100 px-1 font-mono">META_CATALOG_ACCESS_TOKEN</code> adıyla güvenli değişken olarak ekle.</li>
          <li>Bağlantıyı test et, otomatik senkronizasyonu aç ve bir ürünle sonucu kontrol et. Ürünler Meta incelemesinde bekleyebilir.</li>
          <li>Aynı kataloğa paralel tam-yerine-koyma CSV akışı bağlama; API ve farklı veri kaynakları aynı ürün ID'leri üzerinde çakışabilir.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a href="https://business.facebook.com/settings/catalogs" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline underline-offset-4">Katalogları yönet</a>
          <a href="https://business.facebook.com/commerce/" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline underline-offset-4">Commerce Manager'ı aç</a>
          <a href="https://business.facebook.com/events_manager2/" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline underline-offset-4">Pixel olayları</a>
        </div>
        <p className="mt-3 text-xs text-slate-500">Yedek CSV aktarım adresi: {data?.feedUrl||"https://b2b.ecalisgan.com/api/meta/catalog.csv"} (erişim korumalı).</p>
      </Panel>
    </div>
  </main>;
}
