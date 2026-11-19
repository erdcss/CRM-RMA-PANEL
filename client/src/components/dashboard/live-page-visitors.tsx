import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Activity,Eye,RefreshCw,Users} from "lucide-react";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";

type LivePage={key:string;label:string;count:number};
type LivePageResponse={total:number;windowMinutes:number;pages:LivePage[]};

async function getLivePages():Promise<LivePageResponse>{
  const response=await fetch("/api/admin/b2b-live-pages",{credentials:"include",cache:"no-store"});
  if(!response.ok)throw new Error("Sayfa ziyaretçi sayıları alınamadı");
  return response.json() as Promise<LivePageResponse>;
}

export default function LivePageVisitors(){
  const [showAll,setShowAll]=useState(false);
  const {data,isLoading,isError,isFetching,refetch}=useQuery<LivePageResponse>({
    queryKey:["/api/admin/b2b-live-pages"],
    queryFn:getLivePages,
    refetchInterval:15_000,
    refetchOnWindowFocus:true,
    staleTime:5_000,
    retry:1,
  });
  const activePages=(data?.pages||[]).filter(page=>page.count>0);
  const displayPages=showAll?(data?.pages||[]):activePages.slice(0,8);
  const peak=Math.max(1,...(data?.pages||[]).map(page=>page.count));
  return <Card className="overflow-hidden">
    <CardHeader className="border-b bg-background/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5"/>Sayfalardaki Canlı Ziyaretçiler
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Canlı güncelleniyor"/>
          </CardTitle>
          <CardDescription className="mt-1">
            Son {data?.windowMinutes||5} dakikada aktif web oturumları · Üyeler ve misafirler dahil
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5"/> {data?.total??0} aktif
          </Badge>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={()=>void refetch()}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching?"animate-spin":""}`}/>Yenile
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-4 sm:p-5">
      {isLoading?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({length:6},(_,index)=><Skeleton key={index} className="h-20 w-full rounded-xl"/>)}
      </div>:isError?<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Sayfa bazlı canlı ziyaret verileri alınamadı. Yenile butonuyla tekrar deneyin.
      </div>:activePages.length===0&&!showAll?
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-9 text-center">
          <Activity className="h-8 w-8 text-muted-foreground"/>
          <p className="font-semibold">Şu anda aktif web ziyaretçisi görünmüyor</p>
          <p className="text-xs text-muted-foreground">Yeni ziyaretler otomatik olarak burada listelenecek.</p>
        </div>:
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {displayPages.map(page=><div key={page.key} className="min-w-0 rounded-xl border bg-background p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold" title={page.label}>{page.label}</div>
              <div className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-lg font-black tabular-nums">{page.count}</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{width:`${Math.max(0,Math.min(100,(page.count/peak)*100))}%`}}/>
            </div>
          </div>)}
        </div>}
      {!isLoading&&!isError&&data?.pages.length?<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Bir ziyaretçi yalnızca son görüldüğü sayfada sayılır. Her 15 saniyede yenilenir.
        </p>
        <Button size="sm" variant="ghost" onClick={()=>setShowAll(previous=>!previous)}>
          {showAll?"Yalnızca aktif sayfaları göster":"Tüm sayfaları göster"}
        </Button>
      </div>:null}
    </CardContent>
  </Card>;
}
