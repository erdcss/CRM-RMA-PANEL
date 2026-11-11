import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {MessageCircle,RefreshCw,Send} from "lucide-react";
import {Button} from "@/components/ui/button";

type Message={direction:"inbound"|"outbound";body:string|null;received_at:string};
type CustomerWhatsApp={
  consent:{opted_in:boolean;status:string|null;error_code:string|null;updated_at:string|null}|null;
  messages:Message[];
};
type WhatsAppSetup={configured:boolean;webhookConfigured:boolean};

async function api<T>(url:string):Promise<T>{
  const response=await fetch(url,{credentials:"include",cache:"no-store"});
  if(!response.ok)throw new Error("WhatsApp bilgileri alınamadı");
  return response.json();
}

export function AdminB2BWhatsAppSupport({customerId}:{customerId:number}){
  const [draft,setDraft]=useState("");
  const [sending,setSending]=useState(false);
  const [sendError,setSendError]=useState("");
  const [sendSuccess,setSendSuccess]=useState("");
  const path="/api/admin/b2b-whatsapp/customer/"+customerId;
  const setup=useQuery<WhatsAppSetup>({queryKey:["/api/admin/b2b-whatsapp/status"],queryFn:()=>api("/api/admin/b2b-whatsapp/status"),retry:false,staleTime:20000});
  const inbox=useQuery<CustomerWhatsApp>({queryKey:[path],queryFn:()=>api(path),retry:false,refetchInterval:30000});
  const consent=inbox.data?.consent;
  const messages=[...(inbox.data?.messages||[])].reverse();
  const lastInbound=Math.max(0,...messages.filter(m=>m.direction==="inbound").map(m=>Date.parse(m.received_at)||0));
  const canReply=Boolean(setup.data?.configured&&setup.data?.webhookConfigured&&lastInbound&&Date.now()-lastInbound<24*60*60*1000);
  const statusLabel:Record<string,string>={
    pending:"Gönderim kuyruğunda",sending:"Gönderiliyor",accepted:"Meta tarafından kabul edildi",
    sent:"Gönderildi",delivered:"Teslim edildi",read:"Okundu",failed:"Gönderim başarısız",
    expired:"Gönderim süresi doldu"
  };

  async function reply(){
    if(!canReply||sending||!draft.trim())return;
    setSending(true);setSendError("");setSendSuccess("");
    try{
      const response=await fetch(path+"/reply",{
        method:"POST",credentials:"include",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({text:draft.trim()})
      });
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(result.error||"WhatsApp mesajı iletilemedi");
      setDraft("");setSendSuccess("Mesaj WhatsApp'a iletildi. Teslim durumu ayrıca doğrulanabilir.");
      await inbox.refetch();
    }catch(error){setSendError(error instanceof Error?error.message:"Mesaj gönderilemedi");}
    finally{setSending(false);}
  }

  return <section className="rounded-2xl border bg-background p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-bold"><MessageCircle className="h-5 w-5"/>WhatsApp müşteri desteği</h2>
      <Button size="sm" variant="outline" onClick={()=>{void setup.refetch();void inbox.refetch();}}>
        <RefreshCw className="mr-2 h-4 w-4"/>Yenile
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Üyelik onayında gönderilen karşılama mesajları ve müşterinin bu WhatsApp numarasına verdiği yanıtlar.
      İlk mesaj yalnızca başvuruda WhatsApp izni veren firmalara gönderilir.
    </p>
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="rounded-lg border p-3">
        <div className="text-xs text-muted-foreground">Bağlantı</div>
        <strong>{setup.data?.configured&&setup.data?.webhookConfigured?"Yapılandırıldı":"Meta WhatsApp bağlantısı bekleniyor"}</strong>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-xs text-muted-foreground">İzin / karşılama</div>
        <strong>{consent?.opted_in?"İzinli":"WhatsApp izni yok"}</strong>
        <div className="mt-1 text-xs text-muted-foreground">{statusLabel[consent?.status||""]||"Henüz mesaj gönderilmedi"}</div>
      </div>
    </div>
    {inbox.isError?<p className="text-sm text-destructive">Mesaj geçmişi alınamadı.</p>:null}
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3">
      {!messages.length?<p className="text-sm text-muted-foreground">Henüz WhatsApp destek mesajı yok.</p>:
        messages.map((m,i)=><div key={i} className={"max-w-[90%] rounded-xl border px-3 py-2 text-sm "+(m.direction==="outbound"?"ml-auto bg-primary/5":"mr-auto bg-background")}>
          <div className="text-xs font-semibold text-muted-foreground">{m.direction==="inbound"?"Müşteri":"Çalışkan B2B"} · {new Date(m.received_at).toLocaleString("tr-TR")}</div>
          <p className="mt-1 whitespace-pre-wrap break-words">{m.body||"Medya mesajı"}</p>
        </div>)}
    </div>
    <textarea rows={2} maxLength={1800} value={draft} onChange={e=>setDraft(e.target.value)}
      disabled={!canReply||sending} aria-label="WhatsApp destek yanıtı" placeholder={canReply?"Müşteriye WhatsApp yanıtı yazın…":"Müşteri mesaj attıktan sonraki 24 saat içinde yanıt yazılabilir."}
      className="w-full resize-y rounded-xl border bg-background p-3 text-sm disabled:opacity-60"/>
    {sendError?<p className="text-xs text-destructive">{sendError}</p>:null}
    {sendSuccess?<p className="text-xs text-emerald-700">{sendSuccess}</p>:null}
    <div className="flex justify-end">
      <Button disabled={!canReply||!draft.trim()||sending} onClick={()=>void reply()}>
        <Send className="mr-2 h-4 w-4"/>{sending?"İletiliyor…":"WhatsApp Yanıtı Gönder"}
      </Button>
    </div>
  </section>;
}
