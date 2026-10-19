import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, Heart, LockKeyhole, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CustomerSession={role?:string;isActive?:boolean};
type Props={open:boolean;purpose?:"follow"|"contact";onOpenChange:(open:boolean)=>void;onAuthenticated:()=>Promise<void>};

/** Reuses the existing B2B customer login. The dialog animates in and keeps the buyer on the store page. */
export function MarketplaceFollowLogin({open,purpose="follow",onOpenChange,onAuthenticated}:Props){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [passwordVisible,setPasswordVisible]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  function toggle(next:boolean){
    if(working)return;
    onOpenChange(next);
    if(!next){setError("");setPassword("");}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(working)return;
    setWorking(true);setError("");
    try{
      const reply=await apiRequest("POST","/api/b2b/login",{email:email.trim(),password});
      const info=await reply.json() as {mustChangePassword?:boolean};
      setPassword("");
      if(info.mustChangePassword){
        onOpenChange(false);
        window.location.assign("/uye-girisi");
        return;
      }
      const response=await fetch("/api/auth/me",{credentials:"include",cache:"no-store"});
      if(!response.ok)throw new Error("Oturum doğrulanamadı. Yeniden giriş yapın.");
      const account=await response.json() as CustomerSession;
      queryClient.setQueryData(["/api/auth/me"],account);
      if(account.role!=="b2b_customer"||account.isActive!==true){
        throw new Error("Bu işlem için aktif bir Çalışkan B2B müşteri hesabıyla giriş yapmalısınız.");
      }
      await onAuthenticated();
      onOpenChange(false);
      setEmail("");
    }catch(e){setError(e instanceof Error?e.message:"Giriş yapılamadı. Tekrar deneyin.");}
    finally{setWorking(false);}
  }
  return <Dialog open={open} onOpenChange={toggle}>
    <DialogContent className="!inset-auto !left-1/2 !top-1/2 !right-auto !bottom-auto !w-[calc(100%-2rem)] !max-w-md !min-h-0 !max-h-[90vh] -translate-x-1/2 -translate-y-1/2 !rounded-2xl bg-white p-6 shadow-2xl data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-4">
      <DialogHeader className="pr-6">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFCD00] text-slate-950">{purpose==="contact"?<MessageCircle className="h-5 w-5"/>:<Heart className="h-5 w-5"/>}</div>
        <DialogTitle className="text-xl font-black text-slate-950">{purpose==="contact"?"Satıcıyla İletişime Geçmek İçin Giriş Yapın":"Mağazayı Takip Etmek İçin Giriş Yapın"}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-slate-600">
          {purpose==="contact"?"Müşteri hesabınızla giriş yaptıktan sonra bu mağazanın sohbet sayfasına yönlendirileceksiniz.":"Müşteri hesabınızla giriş yaptığınızda mağaza otomatik olarak takip listenize eklenir."}
        </DialogDescription>
      </DialogHeader>
      <form className="mt-2 space-y-4" onSubmit={event=>void submit(event)}>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">E-posta Adresi</span>
          <span className="relative block"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            <input autoFocus type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none focus:border-amber-400" placeholder="ornek@firma.com"/>
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Şifre</span>
          <span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            <input type={passwordVisible?"text":"password"} autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-950 outline-none focus:border-amber-400" placeholder="Şifreniz"/>
            <button type="button" aria-label={passwordVisible?"Şifreyi gizle":"Şifreyi göster"} onClick={()=>setPasswordVisible(value=>!value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              {passwordVisible?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
            </button>
          </span>
        </label>
        {error?<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>:null}
        <button type="submit" disabled={working} className="h-11 w-full rounded-xl bg-[#FFCD00] font-extrabold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50">
          {working?"Giriş Yapılıyor…":purpose==="contact"?"Giriş Yap ve İletişime Geç":"Giriş Yap ve Takip Et"}
        </button>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-600">Hesabınız yok mu?</span>
          <Link href="/kayit-ol" onClick={()=>toggle(false)} className="font-bold text-amber-800 underline underline-offset-2">Ücretsiz Kayıt Ol</Link>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
