import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgeCheck, Boxes, Building2, CheckCircle2, LockKeyhole, Package, ShieldCheck, Store, Truck } from "lucide-react";

export function SellerAccess({onAuthenticated}:{onAuthenticated:()=>Promise<unknown>}) {
  const [mode,setMode]=useState<"login"|"register">("register");
  const [form,setForm]=useState({firstName:"",lastName:"",companyName:"",email:"",password:""});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try {
      const url=mode==="register"?"/api/seller/register":"/api/seller/login";
      const response=await fetch(url,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="register"?form:{email:form.email,password:form.password})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error || "İşlem gerçekleştirilemedi");
      await onAuthenticated();
    } catch(e) { setError(e instanceof Error?e.message:"Lütfen tekrar deneyin"); }
    finally {setBusy(false);}
  }
  return <div className="min-h-screen bg-[#f8f8f6] text-[#111]">
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-black tracking-tighter">ÇALIŞKAN <span className="rounded bg-[#ffcc00] px-1.5 py-0.5 text-sm">B2B</span></Link>
        <nav className="flex gap-2">
          <button type="button" onClick={()=>setMode("login")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode==="login"?"bg-black text-white":"border border-black/15 hover:bg-slate-100"}`}>Giriş Yap</button>
          <button type="button" onClick={()=>setMode("register")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode==="register"?"bg-[#ffcc00]":"border border-black/15 hover:bg-slate-100"}`}>Satıcı Ol</button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-12">
      <div className="grid overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-2xl shadow-black/5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
          <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-600"><ShieldCheck className="h-5 w-5"/> SATICI İŞ ORTAKLIĞI</div>
          <h1 className="max-w-lg text-3xl font-black leading-tight tracking-tight sm:text-4xl">{mode==="login"?"Satıcı Panelinize Giriş Yapın":"Büyümeye Hazır Mısınız?"}</h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">Çalışkan B2B ile toptancı ve işletmelere ulaşın. Ürünlerinizi, mağazanızı ve iş birliklerinizi tek panelden yönetin.</p>
          <form onSubmit={e=>void submit(e)} className="mt-7 space-y-4">
            {mode==="register"?<div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">Ad<input required minLength={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-amber-500" value={form.firstName} onChange={e=>setForm(v=>({...v,firstName:e.target.value}))}/></label>
              <label className="text-sm font-bold">Soyad<input required minLength={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-amber-500" value={form.lastName} onChange={e=>setForm(v=>({...v,lastName:e.target.value}))}/></label>
            </div>:null}
            {mode==="register"?<label className="block text-sm font-bold">Şirket / Ticari Unvan<input required minLength={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-amber-500" value={form.companyName} onChange={e=>setForm(v=>({...v,companyName:e.target.value}))}/></label>:null}
            <label className="block text-sm font-bold">E-posta Adresi<input required type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-amber-500" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
            <label className="block text-sm font-bold">Şifre<input required type="password" minLength={mode==="register"?10:1} autoComplete={mode==="register"?"new-password":"current-password"} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-amber-500" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></label>
            {mode==="register"?<p className="text-xs text-slate-500">En az 10 karakterli bir şifre belirleyin. Satıcı hesabınız müşteri hesabından bağımsızdır.</p>:null}
            {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
            <button disabled={busy} type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#ffcc00] px-5 py-3 font-black transition hover:bg-[#f4be00] disabled:opacity-50">{busy?"İşleniyor…":mode==="register"?"Satıcı Hesabı Oluştur":"Satıcı Paneline Giriş Yap"}<ArrowRight className="h-5 w-5"/></button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">{mode==="register"?"Zaten satıcı hesabınız var mı?":"Satıcı hesabınız yok mu?"} <button className="font-extrabold text-black underline underline-offset-4" type="button" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="register"?"Giriş Yap":"Satıcı Ol"}</button></p>
        </section>
        <section className="relative flex min-h-[450px] flex-col justify-between overflow-hidden bg-[#0c0c0c] p-8 text-white sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-[#ffcc00]/30 blur-[90px]"/>
          <div className="pointer-events-none absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-[#ffcc00]/20 blur-[100px]"/>
          <div className="relative">
            <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-xs font-black tracking-widest text-[#ffcc00]">ÇALIŞKAN B2B SATICI EKOSİSTEMİ</span>
            <h2 className="mt-10 max-w-lg text-4xl font-black leading-tight sm:text-5xl">Tedarikin Yeni Gücü, <span className="text-[#ffcc00]">Birlikte Büyümek.</span></h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/65">Ürünlerinizi keşfedilir hale getirin, iş ortaklarıyla iletişim kurun ve toptan ticareti dijitalleştirin.</p>
          </div>
          <div className="relative mt-12 grid gap-3 sm:grid-cols-2">
            {[[Store,"Mağazanızı Yönetin"],[Boxes,"Ürünlerinizi Listeleyin"],[Truck,"Toptan Satış"],[BadgeCheck,"Güvenli İş Ortaklığı"]].map(([Icon,title])=>{const ItemIcon=Icon as typeof Store;return <div key={String(title)} className="rounded-2xl border border-white/15 bg-white/[.06] p-5 backdrop-blur"><ItemIcon className="mb-4 h-7 w-7 text-[#ffcc00]"/><span className="text-sm font-bold">{String(title)}</span></div>})}
          </div>
        </section>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[[Building2,"Hızlı Katılım","Hesabınızı oluşturup satıcı panelinizi hemen kullanmaya başlayın."],[CheckCircle2,"Şirket Doğrulaması","Vergi levhanızı ve IBAN'ınızı sunarak satış yetkisi için başvurun."],[Package,"Tek Panel","Mağaza, katalog ve operasyonlarınızı merkezi ekrandan takip edin."]].map(([Icon,title,desc])=>{const ItemIcon=Icon as typeof Building2;return <div key={String(title)} className="rounded-2xl border border-black/10 bg-white p-6"><ItemIcon className="h-7 w-7 text-amber-600"/><h3 className="mt-4 font-black">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{String(desc)}</p></div>})}
      </div>
    </main>
  </div>;
}
