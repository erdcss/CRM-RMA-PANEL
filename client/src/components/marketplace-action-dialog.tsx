import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

type MarketplaceActionDialogProps={
  open:boolean;
  title:string;
  description:string;
  confirmLabel:string;
  destructive?:boolean;
  onOpenChange:(open:boolean)=>void;
  onConfirm:()=>Promise<void>;
};

/** Native confirm() dialogs are not used in the supplier panel. */
export function MarketplaceActionDialog({
  open,title,description,confirmLabel,destructive=false,onOpenChange,onConfirm
}:MarketplaceActionDialogProps){
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{if(open)setError("");},[open]);

  async function accept(){
    if(submitting)return;
    setSubmitting(true);
    setError("");
    try{
      await onConfirm();
      onOpenChange(false);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"İşlem tamamlanamadı. Lütfen tekrar deneyin.");
    }finally{
      setSubmitting(false);
    }
  }
  return <AlertDialog open={open} onOpenChange={next=>{if(!submitting)onOpenChange(next);}}>
    <AlertDialogContent className="!left-1/2 !right-auto !w-[calc(100%-2rem)] !max-w-md -translate-x-1/2 rounded-2xl border-slate-200 bg-white p-5 text-slate-950 shadow-2xl sm:p-6 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
      <AlertDialogHeader>
        <div className={"mb-1 flex h-11 w-11 items-center justify-center rounded-xl "+(destructive?"bg-red-50 text-red-700":"bg-amber-100 text-amber-900")}>
          <AlertTriangle className="h-5 w-5"/>
        </div>
        <AlertDialogTitle className="text-lg font-extrabold">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-sm leading-6 text-slate-600">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>:null}
      <AlertDialogFooter className="mt-3 flex-row justify-end gap-2">
        <AlertDialogCancel disabled={submitting} className="mt-0 rounded-xl border-slate-200 text-slate-700">Vazgeç</AlertDialogCancel>
        <button type="button" onClick={()=>void accept()} disabled={submitting}
          className={"inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 "+(destructive?"bg-red-700 hover:bg-red-800":"bg-slate-950 hover:bg-slate-800")}>
          {submitting?<Loader2 className="h-4 w-4 animate-spin"/>:null}
          {submitting?"İşleniyor…":confirmLabel}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
