import { useState, type FormEvent } from "react";
import { useBranding } from "@/hooks/use-branding";
import { LockKeyhole, LogIn, Store } from "lucide-react";

export default function DukkanLogin(){
  const {data:branding}=useBranding();
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setBusy(true);setError("");
    try {
      const result=await fetch("/api/dukkan/login",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username:username.trim(),password})
      });
      const body=await result.json().catch(()=>({}));
      if(!result.ok)throw new Error(body.error||"Giriş başarısız");
      window.location.replace("/dukkan");
    }catch(e){setError(e instanceof Error?e.message:"Giriş yapılamadı");setBusy(false);}
  };
  return <main className="flex min-h-dvh items-center justify-center bg-[#f3f6fb] px-4 py-8 text-slate-900">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
      <div className="mb-8 flex flex-col items-center text-center">
        {branding?.dukkan_logo?<img src={branding.dukkan_logo} alt="Çalışkan Dükkan logosu" className="mb-5 h-24 w-24 rounded-2xl object-contain"/>:
          <div className="mb-5 rounded-2xl bg-slate-900 p-5 text-white"><Store size={38}/></div>}
        <h1 className="text-2xl font-black">Çalışkan Dükkan</h1>
        <p className="mt-2 text-sm text-slate-500">Mağaza yönetimi ve ön muhasebe</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">Kullanıcı adı / E-posta
          <input autoComplete="username" required maxLength={254} value={username} onChange={e=>setUsername(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-600" placeholder="Yönetici tarafından atanan hesap"/>
        </label>
        <label className="block text-sm font-semibold">Şifre
          <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-600" placeholder="Şifreniz"/>
        </label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50">
          {busy?<LockKeyhole size={18}/>:<LogIn size={18}/>} {busy?"Doğrulanıyor...":"Giriş Yap"}
        </button>
      </form>
      <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">Yalnızca Çalışkan Admin tarafından mağazaya atanmış yetkili kullanıcılar giriş yapabilir.</p>
    </section>
  </main>;
}
