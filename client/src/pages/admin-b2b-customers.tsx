import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "wouter";
import {Building2,CheckCircle2,ChevronRight,Mail,Search,ShieldCheck,Users,RefreshCw,Clock3,PackageSearch} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import type {B2BProfile} from "./admin-b2b-customer-detail";
import {trDate} from "./admin-b2b-customer-detail";

export default function AdminB2BCustomers(){
  const [query,setQuery]=useState("");
  const {data=[],isLoading,isError,refetch}=useQuery<B2BProfile[]>({
    queryKey:["/api/admin/b2b-customers"],
    queryFn:async()=>{
      const res=await fetch("/api/admin/b2b-customers",{credentials:"include",cache:"no-store"});
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(result.error||"Müşteriler yüklenemedi");
      return result as B2BProfile[];
    },
  });
  const list=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("tr-TR");
    return q?data.filter(u=>[
      u.companyName,u.firstName,u.lastName,u.email,u.taxNumber,u.companyCategory
    ].some(x=>String(x||"").toLocaleLowerCase("tr-TR").includes(q))):data;
  },[data,query]);
  const verified=data.filter(u=>u.taxVerified).length;
  const pendingPassword=data.filter(u=>u.mustChangePassword).length;
  return <div className="h-full overflow-y-auto bg-muted/20">
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">B2B Müşteriler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Onaylanmış B2B firmaları, hesap bilgileri ve her müşterinin ticari hareket dashboard'u.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/basvurular"><Button variant="outline"><PackageSearch className="mr-2 h-4 w-4"/>Başvurular</Button></Link>
          <Button variant="outline" onClick={()=>void refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Yenile</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-muted-foreground">Aktif B2B müşterisi <Users className="h-5 w-5"/></div>
          <div className="mt-3 text-3xl font-black">{data.length}</div>
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-muted-foreground">Vergi doğrulanan <ShieldCheck className="h-5 w-5"/></div>
          <div className="mt-3 text-3xl font-black">{verified}</div>
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-muted-foreground">İlk şifresini belirlemeyen <Clock3 className="h-5 w-5"/></div>
          <div className="mt-3 text-3xl font-black">{pendingPassword}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
          <div><h2 className="font-bold">Firma rehberi</h2>
            <p className="text-xs text-muted-foreground">{list.length} müşteri listeleniyor · Detay için firmaya tıklayın</p></div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input value={query} onChange={e=>setQuery(e.target.value)}
              className="pl-10" placeholder="Firma, yetkili, e-posta veya VKN ara…" aria-label="Müşteri ara"/>
          </div>
        </div>
        {isLoading?<div className="p-8 text-sm text-muted-foreground">Müşteriler yükleniyor…</div>
          :isError?<div className="p-8 text-sm text-destructive">Müşteriler yüklenemedi. Yenile ile yeniden deneyin.</div>
          :list.length===0?<div className="p-10 text-center">
            <Building2 className="mx-auto h-9 w-9 text-muted-foreground"/>
            <h3 className="mt-3 font-bold">{query?"Aramanıza uygun müşteri yok":"Henüz onaylanmış B2B müşteri yok"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Başvuru onaylandığında firma otomatik olarak burada görünür.</p>
          </div>
          :<div className="divide-y">
            {list.map(item=><Link key={item.id} href={`/b2b-musteriler/${item.id}`}
              className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Building2 className="h-6 w-6"/></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{item.companyName||"Firma"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3"/> Onaylandı</span>
                  {item.taxVerified?<span className="text-xs text-emerald-700">Vergi doğrulandı</span>:null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>{[item.firstName,item.lastName].filter(Boolean).join(" ")||"Yetkili bilinmiyor"}</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5"/>{item.email}</span>
                  <span>VKN: {item.taxNumber||"—"}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Onay: {trDate(item.approvedAt)} · {item.companyCategory||"Kategori yok"}</div>
              </div>
              <div className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                Dashboard <ChevronRight className="h-4 w-4"/>
              </div>
            </Link>)}
          </div>}
      </div>
    </div>
  </div>;
}
