import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type HolidayStatus={
  id:number;
  is_holiday?:boolean;
  holiday_reactivate_at?:string|null;
};

// Shared across the supplier dashboard tabs and individual product editing pages.
// The persisted server status (not local button state) controls the banner.
export function MarketplaceHolidayBanner(){
  const [working,setWorking]=useState(false);
  const [notice,setNotice]=useState("");
  const {data:account,refetch,isFetching}=useQuery<HolidayStatus|null>({
    queryKey:["/api/marketplace/me"],
    staleTime:0,
    refetchInterval:30_000,
    refetchOnMount:"always",
    refetchOnWindowFocus:true
  });
  if(!account?.is_holiday)return null;

  const reopenAt=account.holiday_reactivate_at||null;
  const pending=Boolean(reopenAt);
  const formattedDate=reopenAt?new Date(reopenAt).toLocaleString("tr-TR",{
    day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"
  }):"";

  async function requestReactivation(){
    if(working||pending)return;
    setWorking(true);
    setNotice("");
    try {
      // Recheck first so stale tabs cannot submit the same transition twice.
      const fresh=await refetch();
      if(fresh.isError)throw new Error("Mağaza durumu doğrulanamadı. Lütfen yeniden deneyin.");
      if(!fresh.data?.is_holiday){
        setNotice("Mağazanız zaten aktif.");
        return;
      }
      if(fresh.data.holiday_reactivate_at){
        setNotice("Yeniden açılma talebiniz daha önce alınmış.");
        return;
      }
      const response=await apiRequest("PATCH","/api/marketplace/seller/settings",{holidayMode:false});
      const result=await response.json() as {holidayMode:boolean;reactivateAt?:string|null;message?:string};
      queryClient.setQueryData<HolidayStatus|null>(["/api/marketplace/me"],old=>old?{
        ...old,is_holiday:result.holidayMode,holiday_reactivate_at:result.reactivateAt||null
      }:old);
      setNotice(result.message||"Mağazanız 24 saat içerisinde yeniden görünür olacaktır.");
      await queryClient.invalidateQueries({queryKey:["/api/marketplace/me"]});
    } catch(error) {
      setNotice(error instanceof Error?error.message:"Yeniden açılma talebi gönderilemedi.");
      await refetch();
    } finally {
      setWorking(false);
    }
  }

  return <section role="status" aria-live="polite"
    className="rounded-xl border border-amber-300 bg-[#fff8dc] px-4 py-3 text-amber-950 shadow-sm sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {pending?<Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/>:
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/>}
        <div>
          <h2 className="text-sm font-extrabold sm:text-base">
            {pending?"Mağazanızın yeniden açılması planlandı":"Mağazanız tatil modundadır"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-amber-900 sm:text-sm">
            {pending
              ?`Mağazanız ${formattedDate} tarihinde otomatik olarak satışa açılacak. Bu süre dolana kadar ürünleriniz satışa kapalı kalır.`
              :"Mağazanız ve ürünleriniz satışa kapalıdır. Yeniden açılış talebinden 24 saat sonra satışlar otomatik başlar."}
          </p>
          {notice?<p className="mt-1 text-xs font-bold text-amber-950">{notice}</p>:null}
        </div>
      </div>
      {pending?
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900">
          <ShieldCheck className="h-4 w-4"/> Açılış Bekleniyor
        </div>:
        <button type="button" disabled={working||isFetching} onClick={()=>void requestReactivation()}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-extrabold text-[#FFCD00] disabled:opacity-50 sm:text-sm">
          <RotateCcw className="h-4 w-4"/>{working?"İşleniyor…":"Tekrardan Satışa Aç"}
        </button>
      }
    </div>
  </section>;
}
