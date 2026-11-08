import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Send, Upload, Volume2, RefreshCw, CheckCircle2, SmilePlus, CalendarClock, XCircle, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Customer={id:number;email:string;company_name?:string|null};
type Rule={event_key:string;enabled:boolean;title_template:string;body_template:string};
type Message={id:number;title:string;body:string;source:string;event_key:string|null;email:string;created_at:string};
type Dashboard={customers:Customer[];rules:Rule[];recent:Message[];soundConfigured:boolean};
type ScheduledMessage={
  id:string;title:string;body:string;recipient_ids:number[];recipient_count:number;audience_all:boolean;include_logged_out:boolean;
  scheduled_at:string;status:"pending"|"processing"|"sent"|"failed"|"cancelled";
  saved_count:number;accepted_count:number;token_count:number;last_error:string|null;
  repeat_unit:"day"|"week"|"month"|null;repeat_every:number;repeat_start_at:string|null;repeat_end_at:string|null;
  paused:boolean;sent_count:number;last_sent_at:string|null;
};
type ScheduleEditDraft={
  id:string;title:string;body:string;scheduledDate:string;repeatEnabled:boolean;
  repeatUnit:"day"|"week"|"month";repeatEvery:number;repeatEndDate:string;
  all:boolean;includeLoggedOut:boolean;customSound:boolean;userIds:number[];
};
const scheduledStatus:Record<ScheduledMessage["status"],string>={
  pending:"Planlandı",processing:"Gönderiliyor",sent:"Gönderildi",failed:"Hata",cancelled:"İptal edildi",
};
function repeatDescription(item:{repeat_unit:"day"|"week"|"month"|null;repeat_every:number}) {
  if(!item.repeat_unit)return "";
  const suffix=item.repeat_unit==="day"?"günde":item.repeat_unit==="week"?"haftada":"ayda";
  return item.repeat_every===1
    ? (item.repeat_unit==="day"?"Her gün":item.repeat_unit==="week"?"Her hafta":"Her ay")
    : "Her "+item.repeat_every+" "+suffix;
}
function formatTurkeyDate(date: string) {
  return new Date(date).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function turkeyInput(date:Date) {
  const formatter=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  });
  const parts=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
  return parts.year+"-"+parts.month+"-"+parts.day+"T"+parts.hour+":"+parts.minute;
}
function turkeyNowInput(){return turkeyInput(new Date());}
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
  const {data:scheduled=[],isLoading:loadingSchedules}=useQuery<ScheduledMessage[]>({
    queryKey:["/api/admin/b2b-notifications/scheduled"],
    queryFn:async()=>{
      const response=await fetch("/api/admin/b2b-notifications/scheduled",{credentials:"include",cache:"no-store"});
      if(!response.ok) throw new Error("Planlı bildirimler alınamadı");
      return response.json();
    },
    refetchInterval:30000,
  });
  const [all,setAll]=useState(false);
  const [includeLoggedOut,setIncludeLoggedOut]=useState(false);
  const [selected,setSelected]=useState<number[]>([]);
  const [search,setSearch]=useState("");
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const titleInputRef=useRef<HTMLInputElement>(null);
  const messageInputRef=useRef<HTMLTextAreaElement>(null);
  const [customSound,setCustomSound]=useState(false);
  const [sending,setSending]=useState(false);
  const [deliveryMode,setDeliveryMode]=useState<"now"|"scheduled">("now");
  const [scheduledDate,setScheduledDate]=useState("");
  const [repeatEndDate,setRepeatEndDate]=useState("");
  const [repeatEnabled,setRepeatEnabled]=useState(false);
  const [repeatUnit,setRepeatUnit]=useState<"day"|"week"|"month">("day");
  const [repeatEvery,setRepeatEvery]=useState(1);
  const [togglingRepeat,setTogglingRepeat]=useState<string|null>(null);
  const [cancelling,setCancelling]=useState<string|null>(null);
  const [editingSchedule,setEditingSchedule]=useState<ScheduleEditDraft|null>(null);
  const [savingSchedule,setSavingSchedule]=useState(false);
  const [editingRule,setEditingRule]=useState<string|null>(null);
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
    let scheduledAt: string | undefined;
    if(deliveryMode==="scheduled") {
      if(!scheduledDate) {
        toast({title:"Gönderim tarihi ve saati seçin",variant:"destructive"});
        return;
      }
      // Datetime-local is interpreted as Turkey time regardless of browser locale.
      const value=scheduledDate.trim();
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)){
        toast({title:"Geçerli tarih ve saat seçin",variant:"destructive"});
        return;
      }
      const date=new Date((value.length===16?value+":00":value)+"+03:00");
      if(!Number.isFinite(date.getTime())||date.getTime()<Date.now()+30_000) {
        toast({title:"Gelecekte bir tarih ve saat seçin",variant:"destructive"});
        return;
      }
      scheduledAt=date.toISOString();
      if(repeatEnabled&&repeatEndDate&&repeatEndDate<value.slice(0,10)){
        toast({title:"Bitiş tarihi başlangıçtan önce olamaz",variant:"destructive"});
        return;
      }
    }
    setSending(true);
    try{
      const planning=deliveryMode==="scheduled";
      const r=await apiRequest("POST",planning?"/api/admin/b2b-notifications/scheduled":"/api/admin/b2b-notifications/send",{
        title:title.trim(),body:message.trim(),all,userIds:selected,customSound,includeLoggedOut,
        ...(planning?{scheduledAt}:{}),
        ...(planning&&repeatEnabled?{repeatUnit:repeatEndDate?repeatUnit:"day",repeatEvery:repeatEndDate?repeatEvery:1,repeatEndDate:repeatEndDate||undefined}:{}),
      });
      const result=await r.json();
      if(!r.ok)throw new Error(result.error||(planning?"Bildirim planlanamadı":"Bildirim gönderilemedi"));
      toast(planning
        ? {title:repeatEnabled?"Yinelenen bildirim planlandı":"Bildirim planlandı",
           description:formatTurkeyDate(result.scheduled_at)+" · "+result.recipient_count+" müşteri"+
             (repeatEnabled?" · "+repeatDescription({repeat_unit:result.repeat_unit,repeat_every:result.repeat_every})+(repeatEndDate?" · Bitiş: "+repeatEndDate:" · Süresiz"):"")}
        : {title:"Bildirim kaydedildi",description:`${result.saved} müşteri · ${result.tokens} kayıtlı cihaz · Expo kabul: ${result.accepted}`});
      setTitle("");setMessage("");setScheduledDate("");setRepeatEndDate("");setRepeatEnabled(false);setRepeatUnit("day");setRepeatEvery(1);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications/scheduled"]}),
      ]);
    }catch(e){toast({title:deliveryMode==="scheduled"?"Bildirim planlanamadı":"Bildirim gönderilemedi",description:e instanceof Error?e.message:"Tekrar deneyin",variant:"destructive"});}
    finally{setSending(false);}
  }
  function openScheduleEditor(item:ScheduledMessage){
    setEditingSchedule({
      id:item.id,title:item.title,body:item.body,
      scheduledDate:turkeyInput(new Date(item.scheduled_at)),
      repeatEnabled:!!item.repeat_unit,
      repeatUnit:item.repeat_unit||"day",repeatEvery:item.repeat_every||1,
      repeatEndDate:item.repeat_end_at?turkeyInput(new Date(item.repeat_end_at)).slice(0,10):"",
      all:item.audience_all,includeLoggedOut:item.include_logged_out,
      customSound:item.sound==="custom",userIds:item.recipient_ids||[],
    });
  }
  function changeScheduleDraft(patch:Partial<ScheduleEditDraft>){
    setEditingSchedule(prev=>prev?{...prev,...patch}:null);
  }
  async function saveScheduleEdit(){
    const draft=editingSchedule;
    if(!draft)return;
    if(!draft.title.trim()||!draft.body.trim()){
      toast({title:"Başlık ve mesaj gerekli",variant:"destructive"});return;
    }
    if(!draft.scheduledDate||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(draft.scheduledDate)){
      toast({title:"Geçerli tarih ve saat seçin",variant:"destructive"});return;
    }
    const start=new Date(draft.scheduledDate+":00+03:00");
    if(!Number.isFinite(start.getTime())||start.getTime()<Date.now()+30_000){
      toast({title:"Gelecekte bir gönderim tarihi seçin",variant:"destructive"});return;
    }
    if(draft.repeatEnabled&&draft.repeatEndDate&&draft.repeatEndDate<draft.scheduledDate.slice(0,10)){
      toast({title:"Bitiş tarihi başlangıçtan önce olamaz",variant:"destructive"});return;
    }
    if(!draft.all&&!draft.userIds.length){
      toast({title:"En az bir müşteri seçin",variant:"destructive"});return;
    }
    if(draft.repeatEnabled&&draft.repeatEndDate&&(!Number.isInteger(draft.repeatEvery)||draft.repeatEvery<1||draft.repeatEvery>30)){
      toast({title:"Tekrar aralığı 1–30 olmalı",variant:"destructive"});return;
    }
    setSavingSchedule(true);
    try{
      const response=await apiRequest("PUT","/api/admin/b2b-notifications/scheduled/"+encodeURIComponent(draft.id)+"/details",{
        title:draft.title.trim(),body:draft.body.trim(),scheduledAt:start.toISOString(),
        all:draft.all,userIds:draft.all?[]:draft.userIds,includeLoggedOut:draft.includeLoggedOut,
        customSound:draft.customSound,
        ...(draft.repeatEnabled?{
          repeatUnit:draft.repeatEndDate?draft.repeatUnit:"day",
          repeatEvery:draft.repeatEndDate?draft.repeatEvery:1,
          repeatEndDate:draft.repeatEndDate||undefined,
        }:{repeatEndDate:undefined}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Zamanlı bildirim kaydedilemedi");
      toast({title:"Zamanlı bildirim güncellendi"});
      setEditingSchedule(null);
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications/scheduled"]});
    }catch(error){
      toast({title:"Düzenleme başarısız",description:error instanceof Error?error.message:"Tekrar deneyin",variant:"destructive"});
    }finally{setSavingSchedule(false);}
  }
  async function toggleRepeat(id:string,enabled:boolean){
    setTogglingRepeat(id);
    try{
      const response=await fetch("/api/admin/b2b-notifications/scheduled/"+encodeURIComponent(id),{
        method:"PATCH",credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({enabled}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Tekrarlama ayarı güncellenemedi");
      toast({title:enabled?"Yinelenen bildirim aktifleştirildi":"Yinelenen bildirim pasife alındı",
        description:enabled?"Sonraki planlı gönderimden itibaren devam edecek.":"Yeni bildirimler gönderilmeyecek."});
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications/scheduled"]});
    }catch(error){
      toast({title:"İşlem başarısız",description:error instanceof Error?error.message:"Tekrar deneyin",variant:"destructive"});
    }finally{setTogglingRepeat(null);}
  }
  async function cancelScheduled(id:string){
    if(!window.confirm("Planlanan bildirim iptal edilsin mi?")) return;
    setCancelling(id);
    try{
      const response=await fetch("/api/admin/b2b-notifications/scheduled/"+encodeURIComponent(id),{
        method:"DELETE",credentials:"include",
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Bildirim iptal edilemedi");
      toast({title:"Planlı bildirim iptal edildi"});
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications/scheduled"]});
    }catch(e){
      toast({title:"İptal başarısız",description:e instanceof Error?e.message:"Tekrar deneyin",variant:"destructive"});
    }finally{setCancelling(null);}
  }
  async function saveRule(rule:Rule){
    setSavingRule(rule.event_key);
    try{
      const r=await apiRequest("PUT",`/api/admin/b2b-notifications/rules/${rule.event_key}`,rule);
      if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Kaydedilemedi");}
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]});
      toast({title:"Otomatik bildirim kuralı kaydedildi"});
      setEditingRule(null);
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
          <p className="mt-1 text-sm text-muted-foreground">Müşterilerinize anında veya zamanlayarak bildirim gönderin ve otomatik mesajları yönetin.</p></div>
        <Button variant="outline" onClick={()=>{void queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications"]});void queryClient.invalidateQueries({queryKey:["/api/admin/b2b-notifications/scheduled"]});}}>
          <RefreshCw className="mr-2 h-4 w-4"/> Yenile
        </Button>
      </div>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="text-lg font-bold">Yeni Bildirim</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tek müşteri, birden çok müşteri veya tüm aktif B2B müşterileri.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} /> Tüm aktif B2B müşterileri
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={includeLoggedOut}
                onChange={event=>setIncludeLoggedOut(event.target.checked)}/>
              <span><strong>Oturumu kapalı kayıtlı müşterilere de gönder</strong>
                <span className="mt-1 block text-xs text-muted-foreground">Yalnızca daha önce bu hesaba bağlanmış, bildirim izni açık ve geçerli cihaz kaydı olan müşterilere iletilebilir. Hiç uygulamayı açmamış kişilere push gönderilemez.</span>
              </span>
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
            <div className="rounded-xl border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4"/> Gönderim zamanı</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="notification-delivery" checked={deliveryMode==="now"}
                    onChange={()=>setDeliveryMode("now")}/> Hemen gönder
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="notification-delivery" checked={deliveryMode==="scheduled"}
                    onChange={()=>setDeliveryMode("scheduled")}/> Tarih ve saat seç
                </label>
              </div>
              {deliveryMode==="scheduled" && <div className="space-y-2">
                <label htmlFor="notification-scheduled-date" className="block text-xs font-semibold">
                  {repeatEnabled?"Başlangıç tarihi ve saati (Türkiye saati)":"Gönderim tarihi ve saati (Türkiye saati)"}
                </label>
                <Input id="notification-scheduled-date" type="datetime-local"
                  min={turkeyNowInput()} value={scheduledDate}
                  onChange={event=>setScheduledDate(event.target.value)}/>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={repeatEnabled} onChange={event=>setRepeatEnabled(event.target.checked)}/>
                  <RefreshCw className="h-4 w-4"/> Bildirimi yinele
                </label>
                {repeatEnabled?<div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold" htmlFor="notification-repeat-end">Bitiş tarihi (isteğe bağlı)</label>
                    <Input id="notification-repeat-end" type="date" className="w-full"
                      min={scheduledDate.slice(0,10)||turkeyNowInput().slice(0,10)}
                      value={repeatEndDate} onChange={event=>setRepeatEndDate(event.target.value)}/>
                    <p className="text-xs text-muted-foreground">
                      Bitiş tarihi seçilirse o günün sonuna kadar uygun saatlerde gönderim yapılır.
                      Boş bırakılırsa her gün seçilen saatte süresiz tekrarlanır.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold" htmlFor="notification-repeat-unit">Tekrarlama sıklığı</label>
                  {repeatEndDate?<div className="flex flex-wrap items-center gap-2">
                    <select id="notification-repeat-unit" className="h-10 min-w-32 flex-1 rounded-md border bg-background px-3 text-sm"
                      value={repeatUnit} onChange={event=>setRepeatUnit(event.target.value as "day"|"week"|"month")}>
                      <option value="day">Günlük</option>
                      <option value="week">Haftalık</option>
                      <option value="month">Aylık</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs">
                      Her
                      <Input type="number" className="w-20" min={1} max={30} step={1} value={repeatEvery}
                        onChange={event=>setRepeatEvery(Number(event.target.value))}/>
                      {repeatUnit==="day"?"günde":repeatUnit==="week"?"haftada":"ayda"} bir
                    </label>
                  </div>:<div className="rounded-lg border border-dashed px-3 py-2.5 text-sm">
                    <strong>Günlük, süresiz</strong>
                    <p className="mt-1 text-xs text-muted-foreground">Bitiş tarihi eklenmezse günlük tekrarlama otomatik uygulanır.</p>
                  </div>}
                  <p className="text-xs text-muted-foreground">
                    İlk gönderim başlangıç tarihinde yapılır.{" "}
                    {repeatEndDate?repeatDescription({repeat_unit:repeatUnit,repeat_every:repeatEvery}):"Her gün"} aynı saatte yinelenir.
                    {repeatEndDate&&repeatUnit==="month"?" Ayın seçilen günü yoksa o ayın son günü kullanılır.":""}
                    {" "}{repeatEndDate?"Bitiş tarihi dahilinde devam eder.":"Pasife alınana kadar devam eder."}
                  </p>
                </div>:null}
                <p className="text-xs text-muted-foreground">Türkiye saatine göre otomatik gönderilir. Seçilen mevcut müşteriler planlama sırasında kaydedilir.</p>
              </div>}
            </div>
            <Button disabled={sending || (deliveryMode==="scheduled"&&(!scheduledDate||(repeatEnabled&&repeatEndDate&&(!Number.isInteger(repeatEvery)||repeatEvery<1||repeatEvery>30))||(repeatEnabled&&!!repeatEndDate&&!!scheduledDate&&repeatEndDate<scheduledDate.slice(0,10))))}
              className="w-full" onClick={()=>void send()}>
              {deliveryMode==="scheduled"?<CalendarClock className="mr-2 h-4 w-4"/>:<Send className="mr-2 h-4 w-4"/>}
              {sending?(deliveryMode==="scheduled"?"Planlanıyor…":"Gönderiliyor…"):
                deliveryMode==="scheduled"?"Bildirimi Planla":"Bildirimi Gönder"}
            </Button>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5"/> Zamanlı Bildirimler</h2>
          <span className="text-xs text-muted-foreground">Türkiye saatine göre gösterilir</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Tek seferlik gönderimleri iptal edin; yinelenen bildirimleri dilediğiniz zaman pasife alın veya yeniden aktifleştirin.</p>
        <div className="mt-4 space-y-2">
          {loadingSchedules?<p className="text-sm text-muted-foreground">Planlı bildirimler yükleniyor…</p>:
            scheduled.length===0?<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Henüz planlanmış bir bildirim bulunmuyor.</p>:
            scheduled.map(item=><div key={item.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{item.title}</span>
                    <span className={"rounded-full px-2 py-0.5 text-xs font-semibold "+
                      (item.status==="sent"?"bg-emerald-100 text-emerald-800":
                       item.paused?"bg-amber-100 text-amber-800":
                       item.status==="pending"?"bg-blue-100 text-blue-800":
                       item.status==="failed"?"bg-red-100 text-red-800":
                       "bg-muted text-muted-foreground")}>{item.status==="sent"&&item.repeat_unit?"Tamamlandı":item.paused?"Pasif":scheduledStatus[item.status]}</span>
                    {item.repeat_unit?<span className="rounded-full border px-2 py-0.5 text-xs font-semibold">
                      <RefreshCw className="mr-1 inline h-3 w-3"/>{repeatDescription(item)}
                    </span>:null}
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{item.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.repeat_unit?(item.status==="sent"?"Son planlanan: ":item.paused?"Planlanan saat: ":"Sonraki gönderim: "):"Gönderim: "}
                    {formatTurkeyDate(item.scheduled_at)} · {item.recipient_count} müşteri
                    {item.status==="sent"?" · "+item.accepted_count+" Expo kabul":""}
                  </p>
                  {item.repeat_unit?<p className="text-xs text-muted-foreground">
                    Başlangıç: {formatTurkeyDate(item.repeat_start_at||item.scheduled_at)}
                    {" · "}{item.repeat_end_at?"Bitiş: "+formatTurkeyDate(item.repeat_end_at).split(" ")[0]:"Süresiz"}
                    {" · "}{item.sent_count} kez gönderim yapıldı
                    {item.last_sent_at?" · Son gönderim: "+formatTurkeyDate(item.last_sent_at):""}
                    {" · "}Toplam Expo kabul: {item.accepted_count}
                  </p>:null}
                  {item.last_error?<p className="text-xs text-destructive">{item.last_error}</p>:null}
                </div>
                {item.repeat_unit&&["pending","processing"].includes(item.status)?
                  <Button size="sm" variant="outline" disabled={togglingRepeat===item.id}
                    onClick={()=>void toggleRepeat(item.id,item.paused)}>
                    {item.paused?<RefreshCw className="mr-1 h-4 w-4"/>:<XCircle className="mr-1 h-4 w-4"/>}
                    {togglingRepeat===item.id?"Güncelleniyor…":item.paused?"Aktifleştir":"Pasife al"}
                  </Button>:
                  item.status==="pending"?
                    <Button size="sm" variant="outline" disabled={cancelling===item.id}
                      onClick={()=>void cancelScheduled(item.id)}>
                      <XCircle className="mr-1 h-4 w-4"/> {cancelling===item.id?"İptal ediliyor…":"İptal et"}
                    </Button>:null}
              </div>
            </div>)}
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
            <div className="mt-1 text-xs text-muted-foreground">{item.email} · {item.source==="manual"?"Manuel":item.source==="scheduled"?"Zamanlı":"Otomatik"}</div>
          </div>)}
        </div>
      </section>
    </div>
  </div>;
}
