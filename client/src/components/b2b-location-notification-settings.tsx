import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {BellRing,CheckCircle2,Clock3,MapPin,RefreshCw,Save,ShieldCheck,Users} from 'lucide-react';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {useToast} from '@/hooks/use-toast';

type Settings={
 enabled:boolean;coordinates_verified:boolean;latitude:number;longitude:number;radius_m:number;
 start_hour:number;end_hour:number;title:string;message:string;store_address:string;updated_at:string;
};
type Member={user_id:number;company_name:string|null;email:string;devices:number;
 background_permission:boolean;notifications_permission:boolean;admin_paused:boolean;last_seen_at:string};
type Event={user_id:number;company_name:string|null;local_date:string;status:string;claimed_at:string;reported_at:string|null};
type Dashboard={settings:Settings;users:Member[];events:Event[];
 today:{scheduled:number;pending:number;failed:number}};
const formatDate=(value:string)=>new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export default function LocationNotificationSettings(){
 const {toast}=useToast(),client=useQueryClient();
 const {data,isLoading,isError}=useQuery<Dashboard>({queryKey:['/api/admin/b2b/location'],
  queryFn:async()=>{
   const res=await fetch('/api/admin/b2b/location',{credentials:'include',cache:'no-store'});
   if(!res.ok)throw Error('Konum yönetimi yüklenemedi');
   return res.json();
  },refetchInterval:30000});
 const [draft,setDraft]=useState<Settings|null>(null),[saving,setSaving]=useState(false);
 const [mutatingUser,setMutatingUser]=useState<number|null>(null);
 useEffect(()=>{if(data?.settings&&!draft)setDraft(data.settings)},[data?.settings,draft]);
 const current=draft||data?.settings;
 const update=<K extends keyof Settings>(key:K,value:Settings[K])=>
   setDraft(previous=>{
    if(!previous)return null;
    if((key==='latitude'||key==='longitude')&&previous[key]!==value){
      return {...previous,[key]:value,coordinates_verified:false,enabled:false};
    }
    return {...previous,[key]:value};
   });
 const pauseUser=async(user:Member)=>{
  setMutatingUser(user.user_id);
  try{
   const response=await fetch('/api/admin/b2b/location/users/'+user.user_id+'/pause',{
    method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({paused:!user.admin_paused})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'İşlem başarısız');
   await client.invalidateQueries({queryKey:['/api/admin/b2b/location']});
   toast({title:!user.admin_paused?'Bu müşteriye yakınlık bildirimi durduruldu':'Bu müşteriye yakınlık bildirimi tekrar açıldı'});
  }catch(error){toast({title:'İşlem başarısız',description:error instanceof Error?error.message:'Tekrar deneyin',variant:'destructive'});}
  finally{setMutatingUser(null);}
 };
 const save=async()=>{
   if(!current)return;
   setSaving(true);
   try{
    const res=await fetch('/api/admin/b2b/location',{
      method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(current)});
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(result.error||'Kaydedilemedi');
    setDraft(null);
    await client.invalidateQueries({queryKey:['/api/admin/b2b/location']});
    toast({title:'Konum bildirim ayarları kaydedildi',
      description:'Mobil cihazlar ayarları uygulama açılışında yeniler.'});
   }catch(e){toast({title:'Konum ayarları kaydedilemedi',
      description:e instanceof Error?e.message:'Bir hata oluştu',variant:'destructive'});}
   finally{setSaving(false);}
 };
 return <div className="space-y-5">
 <div className="grid gap-3 sm:grid-cols-3">
  {[
    {label:'Konum izni açık müşteriler',value:data?.users?.length||0,icon:Users},
    {label:'Bugün planlanan yerel uyarılar',value:data?.today?.scheduled||0,icon:BellRing},
    {label:'Bekleyen / başarısız',value:(data?.today?.pending||0)+(data?.today?.failed||0),icon:Clock3},
   ].map(item=><Card key={item.label}><CardContent className="flex items-center justify-between p-5">
    <div><p className="text-xs text-muted-foreground">{item.label}</p>
      <div className="mt-1 text-3xl font-black">{item.value}</div></div>
    <item.icon className="h-6 w-6 text-amber-500"/></CardContent></Card>)}
 </div>
 <Card>
  <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5"/>
   Mağaza konumu ve hatırlatmalar</CardTitle>
   <CardDescription>Çalışkan B2B müşterilerinin açık onayla kullandığı mağaza yakınlık servisi.
     Konum geçmişi veya müşterilerin anlık koordinatları bu panele aktarılmaz.</CardDescription>
  </CardHeader>
  <CardContent className="space-y-5">
   {isLoading?<p>Konum ayarları yükleniyor…</p>:isError?<p className="text-red-600">Konum servisine ulaşılamıyor.</p>:current&&<>
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
    <div><p className="font-bold">Konuma bağlı bildirimler</p>
     <p className="text-xs text-muted-foreground">Yeni mesajlar yalnızca servis açık, koordinatlar doğrulanmış ve kullanıcı izni geçerliyse gösterilir.</p></div>
    <Switch aria-label="Konum bildirimleri" checked={current.enabled}
     onCheckedChange={enabled=>update('enabled',enabled)}/>
   </div>
   <label className="block space-y-2 rounded-xl border p-4">
    <span className="text-sm font-semibold">Çalışkan firma / mağaza adresi</span>
    <textarea className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={current.store_address||''} maxLength={400} rows={2}
      placeholder="Mahalle, cadde/sokak, bina numarası, ilçe ve il"
      onChange={event=>{
       const address=event.target.value;
       setDraft(previous=>previous?{...previous,store_address:address,coordinates_verified:false,enabled:false}:null);
      }}/>
    <p className="text-xs text-muted-foreground">Adres bilgilendirme içindir; koordinatları otomatik değiştirmez. Adres düzenlendiğinde kesin konumun yeniden doğrulanması gerekir.</p>
   </label>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {([
      ['latitude','Mağaza enlemi',-90,90,0.00001],
      ['longitude','Mağaza boylamı',-180,180,0.00001],
      ['radius_m','Etki yarıçapı (metre)',100,10000,100],
      ['start_hour','Başlangıç saati (0–23)',0,23,1],
      ['end_hour','Bitiş saati (1–24)',1,24,1],
    ] as const).map(([key,label,min,max,step])=><label key={key} className="space-y-1">
     <span className="text-sm font-semibold">{label}</span>
     <Input type="number" min={min} max={max} step={step} value={current[key]}
      onChange={e=>update(key,Number(e.target.value))}/></label>)}
   </div>
   <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <input type="checkbox" className="mt-1" checked={current.coordinates_verified}
     onChange={event=>update('coordinates_verified',event.target.checked)}/>
    <span><strong>Mağazanın kesin konumunu doğruladım.</strong>
     <span className="mt-1 block">Başlangıç koordinatları tahminidir. Mağazanın gerçek harita koordinatlarını kontrol etmeden otomatik bildirimleri açmayın.</span></span>
   </label>
   <div className="grid gap-4 md:grid-cols-2">
    <label className="space-y-1"><span className="text-sm font-semibold">Bildirim başlığı</span>
      <Input maxLength={100} value={current.title} onChange={e=>update('title',e.target.value)}/></label>
    <label className="space-y-1"><span className="text-sm font-semibold">Bildirim mesajı</span>
      <Input maxLength={240} value={current.message} onChange={e=>update('message',e.target.value)}/></label>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-muted-foreground">Müşteri başına İstanbul takvim gününde en fazla 1 bildirim · Saat sınırı: {current.start_hour}:00–{current.end_hour}:00</p>
    <Button disabled={saving||current.enabled&&!current.coordinates_verified} onClick={()=>void save()}>
     <Save className="mr-2 h-4 w-4"/>{saving?'Kaydediliyor…':'Konum Ayarlarını Kaydet'}</Button>
   </div></>}
  </CardContent>
 </Card>
 <Card>
  <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/> Konum servisi açık müşteriler</CardTitle>
   <CardDescription>Yalnızca açıkça onay vermiş hesaplar. Son eşitleme zamanı, gerçek zamanlı takip anlamına gelmez.
     Kullanıcı izinlerini iPhone/Android ayarlarından geri çekebilir.</CardDescription></CardHeader>
  <CardContent className="space-y-3">
   <Button variant="outline" size="sm" onClick={()=>void client.invalidateQueries({queryKey:['/api/admin/b2b/location']})}>
    <RefreshCw className="mr-2 h-4 w-4"/> Yenile</Button>
   {!data?.users?.length?<p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Henüz bu servise izin veren kayıtlı cihaz görünmüyor.</p>:
    <div className="max-h-80 overflow-auto rounded-xl border"><table className="w-full text-sm">
     <thead className="sticky top-0 bg-muted"><tr>{['Müşteri','Cihaz','Konum izni','Bildirim izni','Son eşitleme','Yönetim'].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead>
     <tbody>{data.users.map(u=><tr key={u.user_id} className="border-t">
      <td className="p-3 font-semibold">{u.company_name||'B2B Müşterisi'}<p className="text-xs font-normal text-muted-foreground">{u.email}</p></td>
      <td className="p-3">{u.devices}</td>
      <td className="p-3">{u.background_permission?'İzinli':'Kontrol gerekli'}</td>
      <td className="p-3">{u.notifications_permission?'İzinli':'Kontrol gerekli'}</td>
      <td className="p-3">{formatDate(u.last_seen_at)}</td>
      <td className="p-3"><Button size="sm" variant={u.admin_paused?'outline':'destructive'}
       disabled={mutatingUser===u.user_id} onClick={()=>void pauseUser(u)}>
       {mutatingUser===u.user_id?'Kaydediliyor…':u.admin_paused?'Yeniden Aç':'Durdur'}
      </Button></td>
     </tr>)}</tbody></table></div>}
  </CardContent>
 </Card>
 <Card>
  <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5"/> Konum bildirim geçmişi</CardTitle>
   <CardDescription>Telefonun raporladığı yerel bildirim planlama sonuçları; kullanıcıya gösterildiğinin kesin teslim kanıtı değildir.</CardDescription></CardHeader>
  <CardContent>
   {!data?.events?.length?<p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Henüz konum bildirimi kaydı bulunmuyor.</p>:
   <div className="max-h-80 space-y-2 overflow-auto">{data.events.map((e,i)=><div key={e.user_id+'-'+i}
    className="flex items-center justify-between gap-4 rounded-lg border p-3">
    <div><p className="font-semibold">{e.company_name||'B2B Müşterisi'} · {e.local_date.slice(0,10)}</p>
    <p className="text-xs text-muted-foreground">{formatDate(e.claimed_at)}</p></div>
    <span className="text-xs font-semibold">{e.status==='scheduled'?'Telefonda planlandı':e.status==='claimed'?'İşlem başladı':'Hata'}</span>
   </div>)}</div>}
  </CardContent>
 </Card>
 </div>;
}
