import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {Building2,CheckCircle2,Clock3,Mail,RefreshCw,Search,ShieldCheck,
  ClipboardList,ChevronRight,XCircle,Users,ArrowUpRight} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import type {B2BProfile} from "./admin-b2b-customer-detail";
import {trDate,statusText} from "./admin-b2b-customer-detail";

type Filter="pending"|"rejected"|"all";
const ProfileCount=({title,count,icon:Icon}:{title:string;count:number;icon:any})=>
  <div className="rounded-2xl border bg-background p-4 shadow-sm">
    <div className="flex items-center justify-between text-sm text-muted-foreground">{title}<Icon className="h-5 w-5"/></div>
    <div className="mt-3 text-3xl font-black">{count}</div>
  </div>;
export default function AdminApplications(){
  const [filter,setFilter]=useState<Filter>("pending");
  const [search,setSearch]=useState("");
  const {data=[],isLoading,isError,refetch}=useQuery<B2BProfile[]>({
    queryKey:["/api/admin/b2b-applications"],
    queryFn:async()=>{
      const response=await fetch("/api/admin/b2b-applications",{credentials:"include",cache:"no-store"});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||"Başvurular yüklenemedi");
      return result as B2BProfile[];
    },
  });
  const pending=data.filter(x=>x.applicationStatus==="pending").length;
  const approved=data.filter(x=>x.applicationStatus==="approved").length;
  const rejected=data.filter(x=>x.applicationStatus==="rejected").length;
  const list=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("tr-TR");
    return data.filter(item=>{
      if(filter!=="all"&&item.applicationStatus!==filter)return false;
      return !q||[item.companyName,item.firstName,item.lastName,item.email,
        item.taxNumber,item.companyCategory,item.taxOffice]
          .some(value=>String(value||"").toLocaleLowerCase("tr-TR").includes(q));
    });
  },[data,filter,search]);
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Firma Başvuruları</h1>
          <p className="mt-1 text-sm text-muted-foreground">Başvuruları inceleyin; firma detayları, vergi bilgileri ve onay süreçleri ayrı detay ekranında yönetilir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/b2b-musteriler"><Button><Users className="mr-2 h-4 w-4"/>B2B Müşteriler</Button></Link>
          <Button variant="outline" onClick={()=>void refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Yenile</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileCount title="Bekleyen" count={pending} icon={Clock3}/>
        <ProfileCount title="Onaylanan" count={approved} icon={CheckCircle2}/>
        <ProfileCount title="Reddedilen" count={rejected} icon={XCircle}/>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <Tabs value={filter} onValueChange={v=>setFilter(v as Filter)}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="pending">Onay Bekleyenler ({pending})</TabsTrigger>
              <TabsTrigger value="rejected">Reddedilenler ({rejected})</TabsTrigger>
              <TabsTrigger value="all">Tüm Başvurular</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input value={search} onChange={e=>setSearch(e.target.value)}
              className="pl-10" placeholder="Firma, e-posta, VKN ara…" aria-label="Başvuru ara"/>
          </div>
        </div>
        {isLoading?<div className="p-8 text-sm text-muted-foreground">Başvurular yükleniyor…</div>
          :isError?<div className="p-8 text-sm text-destructive">Başvurular alınamadı. Yenile ile tekrar deneyin.</div>
          :list.length===0?<div className="p-10 text-center">
            <ClipboardList className="mx-auto h-9 w-9 text-muted-foreground"/>
            <h2 className="mt-3 font-bold">Bu bölümde başvuru bulunmuyor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Yeni başvurular ve yeniden başvurular otomatik olarak burada görünecek.</p>
          </div>
          :<div className="divide-y">{list.map(item=>{
            const name=[item.firstName,item.lastName].filter(Boolean).join(" ");
            const accepted=item.applicationStatus==="approved";
            return <Link key={item.id} href={accepted
                ?`/b2b-musteriler/${item.id}`:`/basvurular/${item.id}`}
              className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Building2 className="h-6 w-6"/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold">{item.companyName||"Firma"}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${accepted
                    ?"bg-emerald-50 text-emerald-700":item.applicationStatus==="rejected"
                    ?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>
                    {statusText(item.applicationStatus)}
                  </span>
                  {item.taxVerified?<span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5"/>Vergi doğrulandı</span>:null}
                </div>
                <div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                  <span>{name||"Yetkili belirtilmemiş"}</span>
                  <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3.5 w-3.5 shrink-0"/>
                    <span className="truncate">{item.email||item.username}</span></span>
                  <span>Vergi no: {item.taxNumber||"—"}</span>
                  <span>{item.companyCategory||"Kategori belirtilmemiş"}</span>
                  <span>Başvuru: {trDate(item.createdAt)}</span>
                  {accepted?<span>Onay: {trDate(item.approvedAt)}</span>:null}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                {accepted?"Müşteri Dashboard":"Detayları İncele"}
                {accepted?<ArrowUpRight className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}
              </div>
            </Link>;
          })}</div>}
      </div>
      <div className="rounded-xl border bg-background p-4 text-xs leading-6 text-muted-foreground">
        Onaylanan firmalar B2B Müşteriler bölümünde listelenir. Reddedilen firma aynı e-posta ve vergi numarasıyla yeniden başvurduğunda mevcut başvuru kaydı güncellenerek yeniden bekleyenler listesine alınır.
      </div>
    </div>
  </div>;
}
