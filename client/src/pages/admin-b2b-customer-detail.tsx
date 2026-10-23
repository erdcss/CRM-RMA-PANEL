import {useMemo,useState} from "react";
import {useQuery,useMutation} from "@tanstack/react-query";
import {Link,useLocation} from "wouter";
import {
  ArrowLeft,ArrowUpRight,Building2,CalendarDays,CheckCircle2,ClipboardList,
  CreditCard,FileText,Headphones,Home,Mail,MapPin,Package,ReceiptText,
  RefreshCw,ShieldCheck,UserRound,WalletCards,RotateCcw,Clock3,
  Activity,AlertCircle,ChevronLeft,ChevronRight
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {useToast} from "@/hooks/use-toast";
import {apiRequest,queryClient} from "@/lib/queryClient";

export type B2BProfile={
  id:number;username:string;email?:string|null;companyName?:string|null;
  firstName?:string|null;lastName?:string|null;companyCategory?:string|null;
  taxNumber?:string|null;taxOffice?:string|null;taxVerified:boolean;
  applicationStatus:string;isActive:boolean;mustChangePassword:boolean;
  createdAt?:string|null;approvedAt?:string|null;credentialsSentAt?:string|null;
};
type Item={id:string;order_number?:string;invoice_number?:string;total_amount?:string;
  amount_cents?:string;status?:string;payment_status?:string;payment_method?:string;
  shipping_method?:string;item_count?:number;created_at?:string;
  reason?:string;subject?:string;title?:string;recipient?:string;phone?:string;
  city?:string;district?:string;address_line?:string;postal_code?:string;
  is_default?:boolean;type?:string;description?:string;effective_on?:string;
  voided_at?:string|null;contact_name?:string;};
type Overview={customer:B2BProfile;stats:{
  orderCount:number;orderTotal:number;paidTotal:number;awaitingPayment:number;
  returnCount:number;invoiceCount:number;invoiceTotal:number;supportCount:number;
  openSupport:number;addressCount:number;ledgerEntryCount:number;
};orders:Item[];returns:Item[];invoices:Item[];support:Item[];
  addresses:Item[];ledger:Item[];listLimit?:number};
type Movement={id:string;type:string;title:string;detail:string;amount?:string|null;
  status:string;happened_at:string;};
type Timeline={rows:Movement[];page:number;total:number;hasMore:boolean;};
export const trDate=(value?:string|null)=>value?new Date(value).toLocaleString("tr-TR",{dateStyle:"medium",timeStyle:"short"}):"—";
export const tl=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
export const statusText=(status?:string|null)=>({
  pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",
  SUCCESS:"Ödeme alındı",bank_confirmed:"Havale onaylandı",
  paid:"Ödendi",pending_payment:"Ödeme bekliyor",
  awaiting_bank_confirmation:"Havale kontrolü",customer_reported_paid:"Ödeme bildirildi",
  open:"Açık",issued:"Düzenlendi",voided:"İptal edilmiş",
} as Record<string,string>)[String(status||"")]||status||"Belirtilmemiş";
const get=<T,>(url:string)=>fetch(url,{credentials:"include",cache:"no-store"})
  .then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Veriler alınamadı");return data as T;});
const Field=({label,value}:{label:string;value:unknown})=>
  <div className="min-w-0 rounded-xl border bg-muted/15 p-3">
    <div className="mb-1 text-xs text-muted-foreground">{label}</div>
    <div className="break-words text-sm font-semibold">{value===null||value===undefined||value===""?"—":String(value)}</div>
  </div>;
const Tile=({label,value,icon:Icon,description}:{label:string;value:string|number;icon:any;description?:string})=>
  <div className="rounded-2xl border bg-background p-4 shadow-sm">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{label}</span><Icon className="h-5 w-5"/>
    </div>
    <div className="mt-3 break-all text-2xl font-black tracking-tight">{value}</div>
    {description?<div className="mt-1 text-xs text-muted-foreground">{description}</div>:null}
  </div>;
const Empty=({text="Bu kategoride kayıtlı hareket bulunmuyor."}:{text?:string})=>
  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
function ItemList({items,kind,limit=100}:{items:Item[];kind:string;limit?:number}){
  if(!items.length)return <Empty/>;
  return <div className="overflow-hidden rounded-xl border bg-background">
    <div className="divide-y">{items.map((item)=>(
      <div key={kind+item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {kind==="orders"
              ? <Link className="inline-flex items-center gap-1 text-primary hover:underline"
                  href={`/siparisler/${encodeURIComponent(item.id)}`}>{item.order_number||item.id}<ArrowUpRight className="h-3.5 w-3.5"/></Link>
              :kind==="invoices"?item.invoice_number||item.order_number||item.id
              :kind==="ledger"?item.contact_name||"Defter hareketi"
              :kind==="addresses"?item.title||"Adres"
              :kind==="support"?item.subject||"Destek talebi"
              :item.order_number||"İade talebi"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {kind==="orders"?`${item.item_count||0} ürün · ${item.payment_method||"Ödeme yöntemi belirtilmemiş"} · ${statusText(item.payment_status||item.status)}`
              :kind==="addresses"?[item.recipient,item.phone,item.city,item.district,item.address_line,item.postal_code].filter(Boolean).join(" · ")
              :kind==="ledger"?[statusText(item.type),item.description,item.voided_at?"İptal edilmiş":""].filter(Boolean).join(" · ")
              :kind==="returns"?item.reason||statusText(item.status)
              :kind==="invoices"?item.order_number||"Sipariş bağlantısı belirtilmemiş"
              :statusText(item.status)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{trDate(item.created_at)}</div>
        </div>
        <div className="text-right">
          {["orders","invoices","ledger"].includes(kind)?<div className="font-bold">
            {tl(kind==="ledger"?Number(item.amount_cents||0)/100:item.total_amount)}
          </div>:null}
          {kind==="orders"?<Badge variant="secondary">{statusText(item.status)}</Badge>
            :kind==="addresses"&&item.is_default?<Badge>Varsayılan</Badge>
            :kind!=="ledger"?<Badge variant="outline">{statusText(item.status)}</Badge>:null}
        </div>
      </div>))}</div>
    {items.length>=limit?<div className="border-t bg-muted/20 p-3 text-xs text-muted-foreground">
      İlk {limit} kayıt gösteriliyor. Tam geçmiş için Hareketler sekmesini açın.
    </div>:null}
  </div>;
}
export default function AdminB2BCustomerDetail({id,source="customer"}:{id:string;source?:"application"|"customer"}){
  const [,navigate]=useLocation();
  const {toast}=useToast();
  const [page,setPage]=useState(1);
  const [tab,setTab]=useState("overview");
  const {data, isLoading,isError,error,refetch}=useQuery<Overview>({
    queryKey:["/api/admin/b2b-customer-center",id],
    queryFn:()=>get<Overview>(`/api/admin/b2b-customer-center/${encodeURIComponent(id)}`),
    retry:false,
  });
  const {data:timeline,isLoading:historyLoading,isError:historyError}=useQuery<Timeline>({
    queryKey:["/api/admin/b2b-customer-center",id,"activity",page],
    queryFn:()=>get<Timeline>(`/api/admin/b2b-customer-center/${encodeURIComponent(id)}/activity?page=${page}`),
    enabled:!!data && data.customer.applicationStatus==="approved"&&tab==="activity",
    retry:1,
  });
  const action=useMutation({
    mutationFn:async(type:"approve"|"reject"|"resend-password")=>{
      const r=await apiRequest("POST",`/api/admin/b2b-applications/${id}/${type}`);
      return r.json().catch(()=>({})) as Promise<{message?:string}>;
    },
    onSuccess:async(payload,_type)=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-applications"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-customers"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-customer-center",id]}),
      ]);
      toast({title:"İşlem tamamlandı",description:payload.message||"Firma kaydı güncellendi."});
      void refetch();
    },
    onError:(e:Error)=>toast({title:"İşlem yapılamadı",description:e.message,variant:"destructive"}),
  });
  const customer=data?.customer;
  const stats=data?.stats;
  const fullName=useMemo(()=>[customer?.firstName,customer?.lastName].filter(Boolean).join(" "),[customer]);
  const back=source==="application"?"/basvurular":"/b2b-musteriler";
  if(isLoading)return <div className="p-8 text-muted-foreground">Firma bilgileri yükleniyor…</div>;
  if(isError||!data||!customer)return <div className="p-8"><div className="font-semibold text-destructive">
    {(error as Error)?.message||"Firma bulunamadı"}</div><Link href={back} className="mt-4 inline-block text-primary underline">Listeye dön</Link></div>;
  const approved=customer.applicationStatus==="approved";
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-7">
      <Link href={back} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4"/> {source==="application"?"Başvurulara dön":"B2B Müşterilere dön"}
      </Link>
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="bg-slate-950 p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Building2 className="h-7 w-7"/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{customer.companyName||"Firma"}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${approved?"bg-emerald-500/20 text-emerald-200":customer.applicationStatus==="rejected"?"bg-red-500/20 text-red-200":"bg-amber-500/20 text-amber-100"}`}>
                  {statusText(customer.applicationStatus)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1"><UserRound className="h-4 w-4"/>{fullName||"Yetkili belirtilmemiş"}</span>
                <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4"/>{customer.email||customer.username}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4"/>{trDate(customer.createdAt)}</span>
              </div>
              <p className="mt-3 text-xs text-slate-400">Firma kimliği #{customer.id} · {customer.companyCategory||"Kategori belirtilmemiş"}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={()=>void refetch()}><RefreshCw className="mr-1.5 h-4 w-4"/>Yenile</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className={customer.taxVerified?"h-4 w-4 text-emerald-600":"h-4 w-4 text-amber-600"}/>
            {customer.taxVerified?"Vergi doğrulandı":"Vergi doğrulaması bekleniyor / mevcut değil"}
          </div>
          <div className="flex flex-wrap gap-2">
            {customer.applicationStatus==="pending"?<>
              <Button onClick={()=>{if(window.confirm("Firma başvurusunu onaylayıp e-posta ile tek kullanımlık şifre göndermek istiyor musunuz?"))action.mutate("approve");}}
                disabled={action.isPending}><CheckCircle2 className="mr-2 h-4 w-4"/>Onayla</Button>
              <Button variant="destructive" onClick={()=>{if(window.confirm("Bu başvuruyu reddetmek istediğinizden emin misiniz?"))action.mutate("reject");}}
                disabled={action.isPending}>Reddet</Button>
            </>:null}
            {approved&&customer.mustChangePassword?<Button variant="outline" disabled={action.isPending}
              onClick={()=>{if(window.confirm("Henüz ilk şifresini belirlemeyen kullanıcıya yeni tek kullanımlık şifre gönderilsin mi?"))action.mutate("resend-password");}}>
              <Mail className="mr-2 h-4 w-4"/>Geçici Şifreyi Yenile
            </Button>:null}
            {source==="application"&&approved?<Button variant="outline" onClick={()=>navigate(`/b2b-musteriler/${customer.id}`)}>
              Müşteri Dashboard'u <ArrowUpRight className="ml-2 h-4 w-4"/>
            </Button>:null}
          </div>
        </div>
      </div>

      {approved&&stats?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Package} label="Sipariş sayısı" value={stats.orderCount}/>
        <Tile icon={CreditCard} label="Toplam sipariş tutarı" value={tl(stats.orderTotal)} description="Başarısız ödemeler hariç"/>
        <Tile icon={WalletCards} label="Tahsilatı onaylanan" value={tl(stats.paidTotal)} description="Sipariş ödeme durumlarına göre"/>
        <Tile icon={Clock3} label="Ödeme bekleyen siparişler" value={stats.awaitingPayment}/>
        <Tile icon={ReceiptText} label="Fatura sayısı" value={stats.invoiceCount}/>
        <Tile icon={RotateCcw} label="İade kaydı" value={stats.returnCount}/>
        <Tile icon={Headphones} label="Açık destek talebi" value={stats.openSupport}/>
        <Tile icon={Activity} label="Defter hareketi" value={stats.ledgerEntryCount} description="Müşteri tarafından girilen özel kayıtlar"/>
      </div>:null}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="overview">Firma Bilgileri</TabsTrigger>
          {approved?<>
            <TabsTrigger value="orders">Siparişler</TabsTrigger>
            <TabsTrigger value="invoices">Faturalar</TabsTrigger>
            <TabsTrigger value="returns">İadeler</TabsTrigger>
            <TabsTrigger value="support">Destek</TabsTrigger>
            <TabsTrigger value="addresses">Adresler</TabsTrigger>
            <TabsTrigger value="ledger">Defter</TabsTrigger>
            <TabsTrigger value="activity">Tüm Hareketler</TabsTrigger>
          </>:null}
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-2xl border bg-background p-5">
            <h2 className="mb-4 text-lg font-bold">Firma ve yetkili bilgileri</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Firma adı" value={customer.companyName}/>
              <Field label="Firma yetkilisi" value={fullName}/>
              <Field label="Üyelik e-postası" value={customer.email}/>
              <Field label="Kullanıcı adı" value={customer.username}/>
              <Field label="Firma kategorisi" value={customer.companyCategory}/>
              <Field label="Vergi numarası" value={customer.taxNumber}/>
              <Field label="Vergi dairesi" value={customer.taxOffice}/>
              <Field label="Vergi doğrulaması" value={customer.taxVerified?"Doğrulandı":"Doğrulanmadı"}/>
              <Field label="Başvuru durumu" value={statusText(customer.applicationStatus)}/>
              <Field label="Başvuru tarihi" value={trDate(customer.createdAt)}/>
              <Field label="Onay tarihi" value={trDate(customer.approvedAt)}/>
              <Field label="Son şifre gönderimi" value={trDate(customer.credentialsSentAt)}/>
              <Field label="Hesap erişimi" value={customer.isActive?"Aktif":"Pasif"}/>
              <Field label="İlk şifre durumu" value={customer.mustChangePassword?"Yeni şifre bekleniyor":"Yeni şifre zorunluluğu yok"}/>
            </div>
          </div>
          <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            {approved
              ?"Bu dashboard, müşterinin B2B hesabıyla ilişkilendirilmiş işlemleri gösterir. Mevcut olmayan hareketler sıfır görünür; onaysız tahsilat tutarı ödenmiş kabul edilmez."
              :customer.applicationStatus==="rejected"
                ?"Bu başvuru reddedilmiş. Firma aynı e-posta ve vergi numarasıyla yeniden başvuru yapabilir; yeniden başvuru yönetici onayına düşer."
                :"Başvuru beklemede. Firma onaylandığında müşteri hareketleri ve dashboard bu sayfada açılır."}
          </div>
        </TabsContent>
        <TabsContent value="orders"><ItemList items={data.orders} kind="orders"/></TabsContent>
        <TabsContent value="invoices"><ItemList items={data.invoices} kind="invoices"/></TabsContent>
        <TabsContent value="returns"><ItemList items={data.returns} kind="returns"/></TabsContent>
        <TabsContent value="support"><ItemList items={data.support} kind="support"/></TabsContent>
        <TabsContent value="addresses"><ItemList items={data.addresses} kind="addresses" limit={50}/></TabsContent>
        <TabsContent value="ledger">
          <p className="mb-3 text-xs text-muted-foreground">Müşterinin manuel girdiği defter hareketleridir; resmî muhasebe veya firma alacağı olarak değerlendirilmez.</p>
          <ItemList items={data.ledger} kind="ledger"/>
        </TabsContent>
        <TabsContent value="activity" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-bold">Hareket geçmişi</h2>
              <p className="text-xs text-muted-foreground">Sipariş, fatura, iade, destek, adres ve defter hareketleri · Sayfa {page}</p></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page===1||historyLoading} onClick={()=>setPage(x=>Math.max(1,x-1))}>
                <ChevronLeft className="mr-1 h-4 w-4"/>Önceki</Button>
              <Button variant="outline" size="sm" disabled={!timeline?.hasMore||historyLoading} onClick={()=>setPage(x=>x+1)}>
                Sonraki<ChevronRight className="ml-1 h-4 w-4"/></Button>
            </div>
          </div>
          {historyLoading?<div className="p-6 text-sm text-muted-foreground">Hareketler yükleniyor…</div>
            :historyError?<div className="p-6 text-sm text-destructive">Hareketler alınamadı. Yeniden deneyin.</div>
            :!timeline?.rows.length?<Empty/>
            :<div className="overflow-hidden rounded-xl border bg-background">
              <div className="divide-y">{timeline.rows.map((event)=>(
                <div key={event.type+event.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Activity className="h-4 w-4"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{event.title} <span className="ml-1 text-xs font-normal text-muted-foreground">{statusText(event.status)}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{event.detail||"Kayıt"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{trDate(event.happened_at)}</div>
                  </div>
                  {event.amount!==null&&event.amount!==undefined?<div className="font-semibold">{tl(event.amount)}</div>:null}
                </div>))}</div>
              <div className="border-t bg-muted/20 p-3 text-xs text-muted-foreground">
                Toplam {timeline.total} hareket · {page}. sayfa
              </div>
            </div>}
        </TabsContent>
      </Tabs>
    </div>
  </div>;
}
