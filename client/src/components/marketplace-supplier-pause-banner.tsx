import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SupplierStatus={
  id:number;
  status:string;
  is_admin_paused?:boolean;
  is_holiday?:boolean;
  holiday_reactivate_at?:string|null;
};

/** Persistent, server-backed sales-pause warning for every supplier screen. */
export function MarketplaceSupplierPauseBanner(){
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const {data:account,refetch,isFetching}=useQuery<SupplierStatus|null>({
    queryKey:["/api/marketplace/me"],staleTime:0,
    refetchInterval:15_000,refetchOnMount:"always",refetchOnWindowFocus:true
  });
  if(!account?.is_admin_paused)return null;
  async function resumeSales(){
    if(busy)return;
    if(!window.confirm("Mağazanızı ve onaylı ürünlerinizi yeniden satışa açmak istiyor musunuz? Tatil modu açıksa 24 saatlik bekleme kuralı geçerlidir."))return;
    setBusy(true);setNotice("");
    try{
      const newest=await refetch();
      if(newest.isError)throw new Error("Mağaza durumu doğrulanamadı.");
      if(!newest.data?.is_admin_paused){setNotice("Mağazanız zaten aktif.");return;}
      const response=await apiRequest("PATCH","/api/marketplace/seller/pause",{paused:false});
      const result=await response.json() as {paused:boolean;message:string;holidayMode:boolean;holidayReactivationAt?:string|null};
      queryClient.setQueryData<SupplierStatus|null>(["/api/marketplace/me"],previous=>previous?{
        ...previous,is_admin_paused:result.paused,
        is_holiday:result.holidayMode,holiday_reactivate_at:result.holidayReactivationAt||null
      }:previous);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/marketplace/me"]}),
        queryClient.invalidateQueries({queryKey:["/api/marketplace/seller/dashboard"]}),
        queryClient.invalidateQueries({queryKey:["/api/marketplace/stores"]})
      ]);
      setNotice(result.message||"Mağazanız yeniden aktif edildi.");
    }catch(error){
      setNotice(error instanceof Error?error.message:"İşlem başarısız oldu.");
      await refetch();
    }finally{setBusy(false);}
  }
  return <section role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-950 shadow-sm sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700"/>
        <div>
          <h2 className="text-sm font-extrabold sm:text-base">Mağazanız pasife alındı</h2>
          <p className="mt-1 text-xs leading-5 text-red-800 sm:text-sm">
            Mağazanız ve ürünleriniz satışa kapatıldı. Ürün, mağaza tasarımı ve video kayıtlarınız korunuyor.
            Tekrardan satışa açıldığında onaylı içerikleriniz geri gelir.
          </p>
          {account.is_holiday?<p className="mt-1 text-xs font-bold text-red-800">
            Tatil modu da açık. Tatil modu kapanış ve 24 saatlik yeniden açılış kuralları ayrıca uygulanır.
          </p>:null}
          {notice?<p role="status" className="mt-2 text-xs font-bold">{notice}</p>:null}
        </div>
      </div>
      <button type="button" disabled={busy||isFetching} onClick={()=>void resumeSales()}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-extrabold text-[#FFCD00] hover:bg-slate-800 disabled:opacity-50 sm:text-sm">
        <RotateCcw className="h-4 w-4"/>{busy?"İşleniyor…":"Tekrardan Satışa Aç"}
      </button>
    </div>
  </section>;
}
