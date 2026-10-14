import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";

type ReturnItem = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  receipt_number?: string | null;
  created_at?: string | null;
};

type B2BReturn = { id:number; order_number?:string; status:string; reason?:string; created_at:string; email:string; company_name?:string };
async function loadB2BReturns():Promise<B2BReturn[]>{
  const r=await fetch("/api/admin/b2b-returns",{credentials:"include"});
  if(!r.ok)throw new Error("B2B iadeleri yüklenemedi");
  return r.json();
}

export default function AdminReturns() {
  const { data = [], isLoading } = useQuery<ReturnItem[]>({ queryKey: ["/api/admin/returns"] });
  const { data:b2bReturns = [], isLoading:b2bLoading } = useQuery<B2BReturn[]>({
    queryKey: ["/api/admin/b2b-returns"], queryFn: loadB2BReturns,
  });
  const [approving,setApproving]=useState<number|null>(null);
  const {toast}=useToast();
  async function approveReturn(id:number){
    if(!window.confirm("Bu B2B iade talebini onaylamak istiyor musunuz?"))return;
    setApproving(id);
    try{
      const r=await apiRequest("POST",`/api/admin/b2b-returns/${id}/approve`,{});
      if(!r.ok){const d=await r.json();throw new Error(d.error||"İade onaylanamadı");}
      await queryClient.invalidateQueries({queryKey:["/api/admin/b2b-returns"]});
      toast({title:"İade onaylandı",description:"Müşteri bildirim kutusuna otomatik mesaj gönderildi."});
    }catch(error){toast({title:"İade onaylanamadı",description:error instanceof Error?error.message:"Tekrar deneyin",variant:"destructive"});}
    finally{setApproving(null);}
  }


  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <RotateCcw className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">İade İşlemleri</h1>
            <p className="text-sm text-muted-foreground">RMA iade kayıtlarının operasyon görünümü.</p>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-2xl border bg-background">
          <div className="border-b px-4 py-4">
            <h2 className="font-bold">Çalışkan B2B İade Talepleri</h2>
            <p className="mt-1 text-xs text-muted-foreground">Onaylanan iadelerde müşteriye otomatik bildirim oluşturulur.</p>
          </div>
          {b2bLoading?<p className="p-5 text-sm">Yükleniyor…</p>:!b2bReturns.length?
            <p className="p-5 text-sm text-muted-foreground">Henüz B2B iade talebi bulunmuyor.</p>:
            <div className="divide-y">{b2bReturns.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><strong>{item.order_number||`İade #${item.id}`}</strong>
                <div className="text-sm text-muted-foreground">{item.company_name||item.email}</div>
                {item.reason?<div className="mt-1 text-xs text-muted-foreground">{item.reason}</div>:null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">{item.status}</span>
                {item.status!=="approved" && item.status!=="rejected" && item.status!=="cancelled"?
                <Button size="sm" disabled={approving===item.id} onClick={()=>void approveReturn(item.id)}>
                  {approving===item.id?"Onaylanıyor…":"İadeyi Onayla"}
                </Button>:null}
              </div>
            </div>)}</div>}
        </section>

        <div className="overflow-hidden rounded-2xl border bg-background">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">İadeler yükleniyor…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Henüz iade kaydı yok.</div>
          ) : data.map((item) => (
            <div key={item.id} className="grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[140px_1fr_160px_140px] sm:items-center">
              <div className="font-semibold">{item.receipt_number || `RMA-${item.id}`}</div>
              <div>
                <div className="font-medium">{item.name || "Ürün"}</div>
                <div className="text-xs text-muted-foreground">{item.brand || "—"}</div>
              </div>
              <div className="text-sm">
                <div>{item.customer_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{item.customer_phone || ""}</div>
              </div>
              <div className="text-sm font-medium">{item.status || "beklemede"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
