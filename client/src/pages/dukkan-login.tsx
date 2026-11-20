import { useState, type FormEvent } from "react";
import { useBranding } from "@/hooks/use-branding";
import { LockKeyhole, LogIn, Store } from "lucide-react";

const inputClass="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-600";

export default function DukkanLogin(){
  const {data:branding}=useBranding();
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [passwordSetup,setPasswordSetup]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const post=async(url:string,body:unknown)=>{
    const response=await fetch(url,{method:"POST",credentials:"include",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"İşlem tamamlanamadı.");
    return data;
  };
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setBusy(true);setError("");
    try{
      if(passwordSetup){
        if(newPassword!==confirmPassword)throw new Error("Şifreler eşleşmiyor.");
        await post("/api/dukkan/complete-password-reset",{
          username:username.trim(),temporaryPassword:password,newPassword,confirmPassword
        });
        // Authenticate with the newly chosen password; never keep the emailed
        // temporary credential in browser storage.
        const result=await post("/api/dukkan/login",{username:username.trim(),password:newPassword});
        if(result.mustChangePassword)throw new Error("Yeni şifre etkinleştirilemedi. Tekrar deneyin.");
        setPassword("");setNewPassword("");setConfirmPassword("");
        window.location.replace("/dukkan");
      }else{
        const result=await post("/api/dukkan/login",{username:username.trim(),password});
        if(result.mustChangePassword){
          setPasswordSetup(true);
          return;
        }
        window.location.replace("/dukkan");
      }
    }catch(cause){setError(cause instanceof Error?cause.message:"İşlem başarısız.");}
    finally{setBusy(false);}
  };
  return <main className="flex min-h-dvh items-center justify-center bg-[#f3f6fb] px-4 py-8 text-slate-900">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
      <div className="mb-8 flex flex-col items-center text-center">
        {branding?.dukkan_logo?<img src={branding.dukkan_logo} alt="Çalışkan Dükkan logosu" className="mb-5 h-24 w-24 rounded-2xl object-contain"/>:
          <div className="mb-5 rounded-2xl bg-slate-900 p-5 text-white"><Store size={38}/></div>}
        <h1 className="text-2xl font-black">Çalışkan Dükkan</h1>
        <p className="mt-2 text-sm text-slate-500">
          {passwordSetup?"İlk giriş · Yeni kalıcı şifre belirleyin":"Mağaza yönetimi ve ön muhasebe"}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {passwordSetup?<>
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            Geçici şifreniz doğrulandı. Hesabınıza devam etmek için kalıcı bir şifre oluşturun.
          </p>
          <label className="block text-sm font-semibold">Yeni şifre
            <input type="password" autoComplete="new-password" minLength={12} maxLength={128}
              required value={newPassword} onChange={e=>setNewPassword(e.target.value)} className={inputClass}
              placeholder="En az 12 karakter"/>
          </label>
          <label className="block text-sm font-semibold">Yeni şifre (tekrar)
            <input type="password" autoComplete="new-password" minLength={12} maxLength={128}
              required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className={inputClass}
              placeholder="Yeni şifrenizi doğrulayın"/>
          </label>
          <p className="text-xs text-slate-500">
            En az 12 karakter, büyük harf, küçük harf, rakam ve özel karakter kullanın.
          </p>
        </>:<>
          <label className="block text-sm font-semibold">Kullanıcı adı / E-posta
            <input autoComplete="username" required maxLength={254} value={username} onChange={e=>setUsername(e.target.value)}
              className={inputClass} placeholder="Yönetici tarafından atanan hesap"/>
          </label>
          <label className="block text-sm font-semibold">Şifre
            <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}
              className={inputClass} placeholder="Şifreniz"/>
          </label>
        </>}
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50">
          {busy?<LockKeyhole size={18}/>:<LogIn size={18}/>}
          {busy?"İşleniyor...":passwordSetup?"Yeni Şifreyi Kaydet ve Giriş Yap":"Giriş Yap"}
        </button>
      </form>
      {passwordSetup?<button type="button" className="mt-3 w-full text-sm font-medium text-slate-600 underline"
        onClick={()=>{setPasswordSetup(false);setPassword("");setNewPassword("");setConfirmPassword("");setError("");}}>
        Giriş ekranına dön
      </button>:<p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
        Yalnızca Çalışkan Admin tarafından mağazaya atanmış yetkili kullanıcılar giriş yapabilir.
      </p>}
    </section>
  </main>;
}
