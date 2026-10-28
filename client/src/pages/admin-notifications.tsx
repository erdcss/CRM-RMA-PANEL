import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Send, Upload, Volume2, RefreshCw, CheckCircle2, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Customer={id:number;email:string;company_name?:string|null};
type Rule={event_key:string;enabled:boolean;title_template:string;body_template:string};
type Message={id:number;title:string;body:string;source:string;event_key:string|null;email:string;created_at:string};
type Dashboard={customers:Customer[];rules:Rule[];recent:Message[];soundConfigured:boolean};
const titles:Record<string,string>={
  membership_approved:"Üyelik onayı",
  order_created:"Sipariş oluşturuldu",
  return_approved:"İade onaylandı",
  invoice_issued:"Fatura kesildi",
};
async function fetchDashboard():Promise<Dashboard>{
  const r=await fetch("/api/admin/b2b-notifications",{credentials:"include"});
  if(!r.ok)throw new Error("Bildirim ayarları alınamadı");
  return r.json();
}

const EMOJI_GROUPS = [
  { title: "Duyurular", emojis: [
    ["📣", "Duyuru"], ["🔔", "Bildirim"], ["🎉", "Kutlama"],
    ["✨", "Yeni"], ["🚀", "Lansman"], ["⭐", "Yıldız"],
    ["✅", "Onay"], ["📢", "Anons"], ["🎁", "Hediye"],
  ] },
  { title: "Kampanya ve mevsim", emojis: [
    ["❄️", "Kış"], ["☃️", "Kardan adam"], ["🔥", "Fırsat"],
    ["🛍️", "Alışveriş"], ["💥", "Süper fiyat"], ["🏷️", "Etiket"],
    ["⚡", "Hızlı"], ["💯", "Yüz"], ["🌟", "Parlayan yıldız"],
  ] },
  { title: "Sipariş ve teslimat", emojis: [
    ["📦", "Paket"], ["🚚", "Kargo"], ["🛒", "Sepet"],
    ["📋", "Sipariş"], ["📍", "Konum"], ["📬", "Teslimat"],
    ["🕒", "Saat"], ["🆕", "Yeni ürün"], ["🏬", "Mağaza"],
  ] },
  { title: "Finans ve iletişim", emojis: [
    ["💰", "Para"], ["💳", "Kart"], ["💸", "Ödeme"],
    ["📈", "Yükseliş"], ["📊", "Rapor"], ["🤝", "Anlaşma"],
    ["👏", "Tebrik"], ["😊", "Gülümseme"], ["🙏", "Teşekkür"],
  ] },
] as const;

function NotificationEmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const groups = EMOJI_GROUPS.map(group => ({
    ...group,
    emojis: group.emojis.filter(([emoji, name]) =>
      !query.trim() || name.toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR")) || emoji.includes(query.trim())
    ),
  })).filter(group => group.emojis.length > 0);

  return (
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" aria-label="Emoji seçiciyi aç">
          <SmilePlus className="h-4 w-4" /> Emoji ekle
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-3" align="end" sideOffset={6} onCloseAutoFocus={event => event.preventDefault()}>
        <p className="mb-2 text-sm font-semibold">Bildirim emojileri</p>
        <Input className="h-9" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Emoji ara (kış, kargo, fırsat...)" aria-label="Emoji ara" />
        <div className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
          {groups.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Emoji bulunamadı</p> :
            groups.map(group => (
              <div key={group.title}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{group.title}</p>
                <div className="grid grid-cols-6 gap-1">
                  {group.emojis.map(([emoji, name]) => (
                    <button key={name} type="button" title={name} aria-label={name}
                      className="flex h-10 items-center justify-center rounded-md text-2xl hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      onClick={() => { onPick(emoji); setOpen(false); }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Emoji seçtiğiniz alanda imlecin olduğu yere eklenir.</p>
      </PopoverContent>
    </Popover>
  );
}

export default function AdminNotifications(){
  const {toast}=useToast();
  const {data,isLoading}=useQuery({queryKey:["/api/admin/b2b-notifications"],queryFn:fetchDashboard});
  const [all,setAll]=useState(false);
  const [selected,setSelected]=useState<number[]>([]);
  const [search,setSearch]=useState("");
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const titleInputRef=useRef<HTMLInputElement>(null);
  const messageInputRef=useRef<HTMLTextAreaElement>(null);
  const [customSound,setCustomSound]=useState(false);
  const [sending,setSending]=useState(false);
  const [uploadingSound,setUploadingSound]=useState(false);
  const [rules,setRules]=useState<Rule[]>([]);
  const [savingRule,setSavingRule]=useState<string|null>(null);
  useEffect(()=>{if(data?.rules)setRules(data.rules)},[data?.rules]);
  const customers=(data?.customers||[]).filter(x=>
    (x.company_name||"").toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")) ||
    x.email.toLowerCase().includes(search.toLowerCase()));

  function insertEmoji(field: "title" | "message", emoji: string) {
    const element = field === "title" ? titleInputRef.current : messageInputRef.current;
    const value = field === "title" ? title : message;
    const maxLength = field === "title" ? 180 : 800;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    const updated = value.slice(0, start) + emoji + value.slice(end);
    if (updated.length > maxLength) {
      toast({ title: "Karakter sınırına ulaşıldı", description: field === "title" ? "Başlık en fazla 180 karakter olabilir." : "Mesaj en fazla 800 karakter olabilir.", variant: "destructive" });
      return;
    }
    if (field === "title") setTitle(updated);
    else setMessage(updated);
    requestAnimationFrame(() => {
      const input = field === "title" ? titleInputRef.current : messageInputRef.current;
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
  async function send(){
    if(!title.trim()||!message.trim()){toast({title:"Başlık ve mesaj gerekli",variant:"destructive"});return;}
    if(!all&&!selected.length){toast({title:"En az bir müşteri seçin",variant:"destructive"});return;}
    setSending(true);
    try{
      const r=await apiRequest("POST","/api/admin/b2b-notifications/send",{
        title:title.trim(),body:message.trim(),all,userIds:selected,customSound,
      });
      const result=await r.json();
      if(!r.ok)throw new Error(result.error||"Bildirim gönderilemedi");
      toast({title:"Bildirim kaydedildi",description:`${result.saved} müşteri · ${result.tokens} kayıtlı cihaz · Expo kabul: ${result.accepted}`});
      setTitle("");setMessage("");
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]});
    }catch(e){toast({title:"Bildirim gönderilemedi",description:e instanceof Error?e.message:"Tekrar deneyin",variant:"destructive"});}
    finally{setSending(false);}
  }
  async function saveRule(rule:Rule){
    setSavingRule(rule.event_key);
    try{
      const r=await apiRequest("PUT",`/api/admin/b2b-notifications/rules/${rule.event_key}`,rule);
      if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Kaydedilemedi");}
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]});
      toast({title:"Otomatik bildirim kuralı kaydedildi"});
    }catch(e){toast({title:"Kural kaydedilemedi",description:e instanceof Error?e.message:"Tekrar deneyin",variant:"destructive"});}
    finally{setSavingRule(null);}
  }
  async function uploadSound(file?:File){
    if(!file)return;
    if(file.size>512*1024){toast({title:"Ses en fazla 512 KB olabilir",variant:"destructive"});return;}
    setUploadingSound(true);
    try{
      const url=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=()=>reject(new Error("Ses okunamadı"));reader.readAsDataURL(file);
      });
      const r=await apiRequest("POST","/api/admin/b2b-notifications/sound",{dataUrl:url});
      if(!r.ok){const d=await r.json();throw new Error(d.error||"Yüklenemedi");}
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]});
      toast({title:"Ses yüklendi",description:"Özel sesin telefonda çalınabilmesi için yeni iOS/Android native build gerekir."});
    }catch(e){toast({title:"Ses yüklenemedi",description:e instanceof Error?e.message:"Geçerli WAV yükleyin",variant:"destructive"});}
    finally{setUploadingSound(false);}
  }
  return <div className="h-full overflow-y-auto bg-muted/20 p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-black"><Bell className="h-6 w-6"/> Bildirimler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Müşterilerinize anlık bildirim gönderin ve otomatik olay mesajlarını yönetin.</p></div>
        <Button variant="outline" onClick={()=>void queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]})}>
          <RefreshCw className="mr-2 h-4 w-4"/> Yenile
        </Button>
      </div>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="text-lg font-bold">Manuel Bildirimler</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tek müşteri, birden çok müşteri veya tüm aktif B2B müşterileri.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} /> Tüm aktif B2B müşterileri
            </label>
            {!all?<div className="rounded-xl border p-3">
              <Input placeholder="Firma veya e-posta ara" value={search} onChange={e=>setSearch(e.target.value)}/>
              <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {isLoading?<p>Yükleniyor…</p>:customers.map(customer=>
                  <label key={customer.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                    <input type="checkbox" checked={selected.includes(customer.id)}
                      onChange={e=>setSelected(prev=>e.target.checked?[...prev,customer.id]:prev.filter(id=>id!==customer.id))} />
                    <span className="min-w-0"><strong>{customer.company_name||"B2B Müşterisi"}</strong>
                      <span className="block truncate text-xs text-muted-foreground">{customer.email}</span></span>
                  </label>)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{selected.length} müşteri seçildi</p>
            </div>:null}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="manual-notification-title" className="block text-sm font-semibold">Bildirim başlığı</label>
                <NotificationEmojiPicker onPick={emoji => insertEmoji("title", emoji)} />
              </div>
              <Input id="manual-notification-title" ref={titleInputRef} value={title} maxLength={180}
                onChange={e=>setTitle(e.target.value)} placeholder="Örneğin: Yeni kampanyamız başladı"/>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="manual-notification-message" className="block text-sm font-semibold">Bildirim mesajı</label>
                <NotificationEmojiPicker onPick={emoji => insertEmoji("message", emoji)} />
              </div>
              <textarea id="manual-notification-message" ref={messageInputRef}
                className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm"
                value={message} maxLength={800} onChange={e=>setMessage(e.target.value)}
                placeholder="Kullanıcının telefonunda ve uygulama bildirim kutusunda görünecek mesaj"/>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2 font-semibold"><Volume2 className="h-4 w-4"/> Bildirim sesi</div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={customSound} onChange={e=>setCustomSound(e.target.checked)}/> Özel ses kullan
              </label>
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border bg-background px-3 py-2 text-xs font-bold">
                <Upload className="mr-2 h-4 w-4"/>{uploadingSound?"Yükleniyor…":"WAV Ses Dosyası Yükle"}
                <input type="file" accept=".wav,audio/wav,audio/x-wav" className="hidden" disabled={uploadingSound}
                  onChange={e=>{void uploadSound(e.target.files?.[0]);e.target.value="";}} />
              </label>
              {data?.soundConfigured?<div className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4"/> Özel ses kayıtlı
                <audio className="h-7 w-40" controls preload="none" src="/api/public/b2b-notification-sound"/>
              </div>:null}
              <p className="mt-2 text-xs text-amber-700">Özel sesin iOS ve Android'de çalması için ses dosyası yeni native build içine paketlenmelidir. Önceki build'lerde standart ses kullanılır.</p>
            </div>
            <Button disabled={sending} className="w-full" onClick={()=>void send()}><Send className="mr-2 h-4 w-4"/>{sending?"Gönderiliyor…":"Bildirimi Gönder"}</Button>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="text-lg font-bold">Otomatik Bildirimler</h2>
        <p className="mt-1 text-sm text-muted-foreground">Bildirimler ilgili işlem gerçekleştiğinde otomatik hazırlanır. Şablonlar özelleştirilebilir.</p>
        <div className="mt-4 space-y-3">{rules.map(rule=><div key={rule.event_key} className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">{titles[rule.event_key]||rule.event_key}</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.enabled} onChange={e=>setRules(prev=>prev.map(x=>x.event_key===rule.event_key?{...x,enabled:e.target.checked}:x))}/> Aktif</label>
          </div>
          <Input className="mt-3" maxLength={180} value={rule.title_template}
            onChange={e=>setRules(prev=>prev.map(x=>x.event_key===rule.event_key?{...x,title_template:e.target.value}:x))}/>
          <textarea className="mt-2 w-full rounded-lg border bg-background p-3 text-sm" maxLength={800} rows={2}
            value={rule.body_template}
            onChange={e=>setRules(prev=>prev.map(x=>x.event_key===rule.event_key?{...x,body_template:e.target.value}:x))}/>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Değişkenler: {"{orderNumber}"} · {"{date}"} · {"{amount}"}</span>
            <Button size="sm" variant="outline" disabled={savingRule===rule.event_key} onClick={()=>void saveRule(rule)}>
              {savingRule===rule.event_key?"Kaydediliyor…":"Kuralı Kaydet"}
            </Button>
          </div>
        </div>)}</div>
      </section>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="text-lg font-bold">Bildirim Geçmişi</h2>
        <p className="text-xs text-muted-foreground">Kayıtlı bildirimler; Expo'nun cihazda teslimat garantisi anlamına gelmez.</p>
        <div className="mt-3 divide-y">
          {(data?.recent||[]).map(item=><div key={item.id} className="py-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
              <span>{item.title}</span><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")}</span>
            </div>
            <div className="text-sm text-muted-foreground">{item.body}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.email} · {item.source==="manual"?"Manuel":"Otomatik"}</div>
          </div>)}
        </div>
      </section>
    </div>
  </div>;
}
