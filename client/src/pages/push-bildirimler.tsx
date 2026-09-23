import { useEffect, useState } from "react";
import { Bell, Send, Smartphone, Save } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Auto={id:string;app:"b2b"|"business";event_key:string;name:string;title:string;body:string;enabled:boolean};
export default function PushBildirimler(){
 const {toast}=useToast(); const[data,setData]=useState<{automations:Auto[];deviceCounts:any[];history:any[]}>({automations:[],deviceCounts:[],history:[]});
 const[app,setApp]=useState<"b2b"|"business">("b2b");const[title,setTitle]=useState("");const[body,setBody]=useState("");
 const headers=async()=>({...await getAuthHeaders(),"Content-Type":"application/json"});
 const load=async()=>{const r=await fetch("/api/admin/push",{headers:await getAuthHeaders()});if(r.ok)setData(await r.json());};
 useEffect(()=>{load();},[]);
 const send=async(test=false)=>{const r=await fetch("/api/admin/push/send",{method:"POST",headers:await headers(),body:JSON.stringify({app,title,body,test})});const j=await r.json();if(!r.ok)return toast({title:"Gönderilemedi",description:j.error,variant:"destructive"});toast({title:test?"Test bildirimi gönderildi":"Bildirim gönderildi",description:`${j.sent} cihaza gönderildi.`});load();};
 const save=async(a:Auto)=>{const r=await fetch(`/api/admin/push/automations/${a.id}`,{method:"PATCH",headers:await headers(),body:JSON.stringify({title:a.title,body:a.body,enabled:a.enabled})});if(r.ok){toast({title:"Otomasyon güncellendi"});load();}};
 const count=(x:string)=>data.deviceCounts.find((d:any)=>d.app===x)?.count||0;
 return <div className="h-full overflow-auto p-6 space-y-6">
  <div><h1 className="text-2xl font-semibold">Push Bildirim Yönetimi</h1><p className="text-muted-foreground">Çalışkan B2B ve Çalışkan Business bildirimlerini ayrı yönetin.</p></div>
  <div className="grid gap-4 md:grid-cols-2">
   <Card><CardHeader><CardTitle>Çalışkan B2B</CardTitle><CardDescription>Müşteri mobil uygulaması</CardDescription></CardHeader><CardContent className="flex items-center gap-2"><Smartphone className="h-5 w-5"/><b>{count("b2b")}</b> kayıtlı cihaz</CardContent></Card>
   <Card><CardHeader><CardTitle>Çalışkan Business</CardTitle><CardDescription>Yönetici/personel mobil uygulaması</CardDescription></CardHeader><CardContent className="flex items-center gap-2"><Smartphone className="h-5 w-5"/><b>{count("business")}</b> kayıtlı cihaz</CardContent></Card>
  </div>
  <Card><CardHeader><CardTitle className="flex gap-2"><Bell className="h-5 w-5"/>Bildirim Gönder</CardTitle><CardDescription>Hedef uygulamayı seçerek manuel veya test bildirimi gönderin.</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="flex gap-2"><Button variant={app==="b2b"?"default":"outline"} onClick={()=>setApp("b2b")}>Çalışkan B2B</Button><Button variant={app==="business"?"default":"outline"} onClick={()=>setApp("business")}>Çalışkan Business</Button></div>
   <div><Label>Başlık</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Bildirim başlığı"/></div>
   <div><Label>İçerik</Label><Input value={body} onChange={e=>setBody(e.target.value)} placeholder="Bildirim mesajı"/></div>
   <div className="flex gap-2"><Button variant="outline" onClick={()=>send(true)}>Test Bildirimi Gönder</Button><Button onClick={()=>send(false)}><Send className="h-4 w-4 mr-2"/>Tümüne Gönder</Button></div>
  </CardContent></Card>
  <Card><CardHeader><CardTitle>Bildirim Otomasyonları</CardTitle><CardDescription>Otomatik bildirim metinlerini düzenleyin ve açıp kapatın.</CardDescription></CardHeader><CardContent className="space-y-4">
   {data.automations.map((a,i)=><div key={a.id} className="rounded-lg border p-4 space-y-3">
    <div className="flex justify-between gap-3"><div><b>{a.name}</b><div className="text-xs text-muted-foreground">{a.app==="b2b"?"Çalışkan B2B":"Çalışkan Business"} · {a.event_key}</div></div><Button size="sm" variant={a.enabled?"default":"outline"} onClick={()=>setData(d=>({...d,automations:d.automations.map(x=>x.id===a.id?{...x,enabled:!x.enabled}:x)}))}>{a.enabled?"Aktif":"Kapalı"}</Button></div>
    <Input value={a.title} onChange={e=>setData(d=>({...d,automations:d.automations.map((x,j)=>j===i?{...x,title:e.target.value}:x)}))}/>
    <Input value={a.body} onChange={e=>setData(d=>({...d,automations:d.automations.map((x,j)=>j===i?{...x,body:e.target.value}:x)}))}/>
    <Button size="sm" variant="outline" onClick={()=>save(a)}><Save className="h-4 w-4 mr-2"/>Kaydet</Button>
   </div>)}
  </CardContent></Card>
 </div>;
}
