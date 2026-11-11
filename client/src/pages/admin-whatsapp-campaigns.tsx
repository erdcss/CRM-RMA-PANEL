import {useEffect,useState} from "react";
import {AlertCircle,CheckCircle2,ClipboardCopy,Loader2,Megaphone,RefreshCw,Send,XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

type Campaign={
  id:number;title:string;template_name:string;language:string;segment:string;
  status:string;created_at:string;recipients:number;accepted:number;delivered:number;read:number;failed:number;
};
type Overview={
  connected:boolean;readyForWelcome:boolean;missing:string[];
  audience:{total:number;pending:number;approved:number};
  welcome:Array<{status:string;count:number}>;campaigns:Campaign[];
};
const API="/api/admin/b2b-whatsapp-marketing";
async function request<T>(path:string,method="GET",body?:unknown):Promise<T>{
  const response=await fetch(API+path,{
    method,credentials:"include",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:{},
    body:body?JSON.stringify(body):undefined
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"İşlem gerçekleştirilemedi");
  return data as T;
}
const names:Record<string,string>={
  draft:"Taslak",running:"Gönderiliyor",completed:"Tamamlandı",cancelled:"İptal",
  pending:"Sırada",accepted:"API kabul etti",sent:"Gönderildi",
  delivered:"Teslim edildi",read:"Okundu",failed:"Hata",expired:"Süresi doldu",skipped:"Atlandı"
};
const segments:Record<string,string>={all:"Tüm izinli firmalar",pending:"Başvurusu bekleyenler",approved:"Onaylanan firmalar"};

export default function AdminWhatsAppCampaigns(){
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [title,setTitle]=useState("");
  const [templateName,setTemplateName]=useState("");
  const [language,setLanguage]=useState("tr");
  const [segment,setSegment]=useState("all");
  async function reload(){
    try{setData(await request<Overview>("/overview"));setError("");}
    catch(e){setError(e instanceof Error?e.message:"Bağlantı hatası");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();const interval=window.setInterval(()=>{void reload();},30000);return ()=>window.clearInterval(interval);},[]);
  async function create(){
    if(busy)return;
    setBusy(true);setError("");setSuccess("");
    try{
      await request("/campaigns","POST",{title,templateName,language,segment});
      setSuccess("Kampanya taslağı kaydedildi. Meta onaylı şablon kullanılmalı.");
      setTitle("");setTemplateName("");
      await reload();
    }catch(e){setError(e instanceof Error?e.message:"Kayıt hatası");}
    finally{setBusy(false);}
  }
  async function action(id:number,type:"launch"|"cancel"){
    if(busy)return;
    if(type==="launch"&&!window.confirm("Bu kampanya Meta üzerinden izinli firmalara gerçek ücretli WhatsApp şablon mesajları gönderebilir. Gönderimi başlatmak istiyor musunuz?"))return;
    setBusy(true);setError("");setSuccess("");
    try{
      const r=await request<{ok:boolean;queued?:number}>("/campaigns/"+id+"/"+type,"POST",{});
      setSuccess(type==="launch"?"Kampanya başlatıldı: "+(r.queued||0)+" izinli alıcı sıraya alındı.":"Kampanya durduruldu; daha önce gönderilen mesajlar geri alınamaz.");
      await reload();
    }catch(e){setError(e instanceof Error?e.message:"İşlem hatası");}
    finally{setBusy(false);}
  }
  const audience=data?.audience||{total:0,pending:0,approved:0};
  const welcome=data?.welcome||[];
  const welcomeCount=(statuses:string[])=>welcome.filter(x=>statuses.includes(x.status)).reduce((n,x)=>n+x.count,0);
  const example="Çalışkan B2B'ye hoş geldiniz! Başvurunuzu aldık. Toptan ürünler, fırsatlar ve kampanyalar için b2b.ecalisgan.com adresini ziyaret edebilirsiniz. Mesajları durdurmak için DUR yazın.";
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black"><Megaphone className="h-7 w-7"/> WhatsApp Kampanya Yönetimi</h1>
          <p className="mt-2 text-sm text-muted-foreground">Başvuru sonrası tanıtım ve Meta onaylı şablonlarla toplu kampanya bildirimi.</p>
        </div>
        <Button variant="outline" onClick={()=>void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Yenile</Button>
      </div>
      <div className={"rounded-xl border p-4 "+(data?.readyForWelcome?"bg-emerald-50/50 border-emerald-200":"bg-amber-50/40 border-amber-200")}>
        <div className="flex items-center gap-2 font-bold">
          {data?.readyForWelcome?<CheckCircle2 className="h-5 w-5 text-emerald-700"/>:<AlertCircle className="h-5 w-5 text-amber-700"/>}
          {data?.readyForWelcome?"WhatsApp tanıtım yapılandırması hazır":"WhatsApp Cloud API bağlantısı bekleniyor"}
        </div>
        <p className="mt-2 text-sm">Meta'daki gerçek gönderici numara, kalıcı erişim anahtarı, webhook ve onaylı Marketing şablonu olmadan mesaj gönderilmez. Mevcut WhatsApp Business numarası otomatik olarak taşınmaz.</p>
        {data?.missing?.length?<p className="mt-2 break-all text-xs text-muted-foreground">Eksik sunucu ayarları: {data.missing.join(", ")}</p>:null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["İzinli firmalar",audience.total],
          ["Bekleyen başvurular",audience.pending],
          ["Onaylı firmalar",audience.approved],
          ["Tanıtım mesajı gönderimi",welcomeCount(["accepted","sent","delivered","read"])]
        ].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-background p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-3xl">{value}</strong>
        </div>)}
      </div>
      <section className="rounded-xl border bg-background p-5 space-y-3">
        <h2 className="font-bold text-lg">Başvuru sonrası otomatik tanıtım</h2>
        <p className="text-sm text-muted-foreground">Yeni kayıt sırasında ayrıca WhatsApp pazarlama izni veren firmalar için, yönetici onayını beklemeden, bir defaya mahsus mesaj kuyruğu oluşturulur. Gönderim yalnızca Meta bağlantısı ve onaylı tanıtım şablonu hazırsa gerçekleşir. 72 saati geçen bekleyen tanıtımlar otomatik düşer.</p>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border p-3">Sırada: <strong>{welcomeCount(["pending","sending"])}</strong></div>
          <div className="rounded-lg border p-3">Teslim: <strong>{welcomeCount(["delivered","read"])}</strong></div>
          <div className="rounded-lg border p-3">Hata: <strong>{welcomeCount(["failed"])}</strong></div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold mb-2">Meta'da Marketing kategorisinde onaylatılacak örnek tanıtım metni</p>
          <p className="text-sm whitespace-pre-wrap">{example}</p>
          <Button size="sm" className="mt-3" variant="outline" onClick={()=>{void navigator.clipboard.writeText(example);}}>
            <ClipboardCopy className="mr-2 h-4 w-4"/>Metni kopyala
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Onaylanan şablon adını sunucuda WHATSAPP_MARKETING_WELCOME_TEMPLATE olarak tanımlayın. Ekrandaki metin kendiliğinden API'ye gönderilmez.</p>
        </div>
      </section>
      <section className="rounded-xl border bg-background p-5 space-y-4">
        <div>
          <h2 className="font-bold text-lg">Yeni WhatsApp kampanyası</h2>
          <p className="text-sm text-muted-foreground">Kampanya içeriği önce Meta WhatsApp Manager'da Marketing şablonu olarak onaylatılmalıdır. Burada onaylı şablonun teknik adını girin.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm"><span className="font-semibold">Kampanya adı</span>
            <Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="Kasım ayı yeni ürün fırsatları"/></label>
          <label className="space-y-1.5 text-sm"><span className="font-semibold">Meta şablon adı</span>
            <Input value={templateName} onChange={e=>setTemplateName(e.target.value.toLowerCase())} maxLength={128} placeholder="kasim_kampanya_2026"/></label>
          <label className="space-y-1.5 text-sm"><span className="font-semibold">Şablon dili</span>
            <Input value={language} onChange={e=>setLanguage(e.target.value)} placeholder="tr"/></label>
          <label className="space-y-1.5 text-sm"><span className="font-semibold">Hedef kitle</span>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={segment} onChange={e=>setSegment(e.target.value)}>
              <option value="all">Tüm izinli firmalar</option>
              <option value="pending">Başvurusu bekleyen izinli firmalar</option>
              <option value="approved">Onaylı izinli firmalar</option>
            </select>
          </label>
        </div>
        <Button disabled={busy||title.trim().length<3||!templateName.trim()} onClick={()=>void create()}>
          {busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Megaphone className="mr-2 h-4 w-4"/>}Kampanya taslağı oluştur
        </Button>
      </section>
      {error?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
      {success?<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>:null}
      <section className="rounded-xl border bg-background p-5 space-y-3">
        <h2 className="font-bold text-lg">Kampanya geçmişi</h2>
        {loading?<p className="text-sm text-muted-foreground">Yükleniyor…</p>:null}
        {data?.campaigns?.length===0?<p className="text-sm text-muted-foreground">Henüz bir kampanya oluşturulmadı.</p>:null}
        <div className="space-y-3">
          {(data?.campaigns||[]).map(c=><div key={c.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">{c.title}</div>
                <p className="text-xs text-muted-foreground">#{c.id} · {c.template_name} · {segments[c.segment]||c.segment} · {new Date(c.created_at).toLocaleString("tr-TR")}</p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs font-bold">{names[c.status]||c.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <div>Hedef: <b>{c.recipients}</b></div><div>API kabul: <b>{c.accepted}</b></div>
              <div>Teslim: <b>{c.delivered}</b></div><div>Okundu: <b>{c.read}</b></div><div>Hata: <b>{c.failed}</b></div>
            </div>
            {["draft","running"].includes(c.status)?<div className="mt-3 flex flex-wrap gap-2">
              {c.status==="draft"?<Button size="sm" disabled={busy||!data?.connected} onClick={()=>void action(c.id,"launch")}>
                <Send className="mr-2 h-4 w-4"/> Gönderimi başlat
              </Button>:null}
              <Button size="sm" variant="outline" disabled={busy} onClick={()=>void action(c.id,"cancel")}>
                <XCircle className="mr-2 h-4 w-4"/> İptal et
              </Button>
            </div>:null}
          </div>)}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Mesajlar yalnızca açık WhatsApp pazarlama onayı bulunan kayıtlı firmalara gönderilir. WhatsApp Business Platform şablon mesajları için Meta ücretleri uygulanabilir; API kabulü teslimat garantisi değildir.</p>
    </div>
  </div>;
}