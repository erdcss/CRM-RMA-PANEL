import {useEffect,useMemo,useState,type FormEvent} from "react";
import {CheckCircle2,Circle,Eye,EyeOff,LockKeyhole,ShieldCheck,UserPlus,AlertTriangle,Info} from "lucide-react";

type UsernameState="idle"|"checking"|"available"|"taken"|"unavailable";
const validUsername=(value:string)=>/^[A-Za-z0-9._@-]{4,64}$/.test(value.trim());

export function DukkanSuperManagerPanel({storeId,onCreated,onError}:{storeId:string;onCreated:(username:string)=>void;onError:(error:string)=>void}){
 const [expanded,setExpanded]=useState(false);
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [visible,setVisible]=useState(false);
 const [saving,setSaving]=useState(false);
 const [usernameState,setUsernameState]=useState<UsernameState>("idle");
 const [formError,setFormError]=useState("");

 const cleanUsername=username.trim();
 const usernameValid=validUsername(cleanUsername);
 const checks=useMemo(()=>[
  {name:"En az 12 karakter",ok:password.length>=12&&password.length<=128},
  {name:"Bir küçük harf",ok:/[a-z]/.test(password)},
  {name:"Bir büyük harf",ok:/[A-Z]/.test(password)},
  {name:"Bir rakam",ok:/[0-9]/.test(password)},
  {name:"Bir özel karakter (örn. ! @ #)",ok:/[^A-Za-z0-9]/.test(password)}
 ],[password]);
 const strong=checks.every(item=>item.ok);

 useEffect(()=>{
  if(!expanded||!usernameValid){setUsernameState("idle");return;}
  setUsernameState("checking");
  const controller=new AbortController();
  const timer=setTimeout(()=>{
    void (async()=>{
     try{
      const res=await fetch("/api/dukkan/admin/super-managers/username-status?username="+encodeURIComponent(cleanUsername),{
       credentials:"include",signal:controller.signal,headers:{Accept:"application/json"}
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(result.error||"Kullanıcı adı kontrol edilemedi");
      if(!controller.signal.aborted)setUsernameState(result.available===true?"available":"taken");
     }catch(err){
      if(!controller.signal.aborted)setUsernameState("unavailable");
     }
    })();
  },380);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[cleanUsername,expanded,usernameValid]);

 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(saving)return;
  setFormError("");
  if(!storeId||!Number.isSafeInteger(Number(storeId))){setFormError("Lütfen önce geçerli bir mağaza seçin.");return;}
  if(!usernameValid){setFormError("Kullanıcı adı 4–64 karakter olmalı; yalnızca harf, rakam, nokta, @, tire ve alt çizgi içerebilir.");return;}
  if(usernameState==="taken"){setFormError("Bu kullanıcı adı veya e-posta sistemde kayıtlı. Farklı bir kullanıcı adı seçin.");return;}
  if(!strong){setFormError("Şifre için eksik olan güvenlik koşullarını aşağıdaki listeden tamamlayın.");return;}
  setSaving(true);
  try{
   const res=await fetch("/api/dukkan/admin/super-managers",{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({storeId:Number(storeId),username:cleanUsername,password})
   });
   const result=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(result.error||"Yetkili hesap oluşturulamadı");
   const assignedName=String(result.username||cleanUsername);
   setUsername("");setPassword("");setVisible(false);setExpanded(false);setUsernameState("idle");setFormError("");
   onCreated(assignedName);
  }catch(error){
   const message=error instanceof Error?error.message:"Süper yönetici oluşturulamadı";
   setFormError(message);
   onError(message);
  }finally{setSaving(false);}
 };

 return <section className="mb-5 overflow-hidden rounded-[24px] border border-[#bcd4fa] bg-gradient-to-br from-[#edf6ff] via-white to-[#f5f5ff] p-5 shadow-sm sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div className="flex items-center gap-3">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#123f7b] text-white"><ShieldCheck size={23}/></span>
    <div><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">YÜKSEK YETKİLİ HESAP</span>
     <h3 className="text-base font-extrabold text-[#13294e]">Süper Yönetici Oluştur</h3>
     <p className="mt-0.5 text-xs text-slate-500">Yeni kullanıcı, atanan mağazanın sahibi ve Çalışkan Admin süper yöneticisi olur.</p>
    </div>
   </div>
   <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);setFormError("");}}
    className="rounded-xl bg-[#123f7b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#235ca7]">
    {expanded?"Formu Kapat":"Yeni Süper Yönetici"}
   </button>
  </div>
  {expanded&&<form noValidate onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
   <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
    <AlertTriangle className="mt-0.5 shrink-0" size={16}/>
    Bu kullanıcı tüm Çalışkan Admin işlemlerine erişebilir. Kimlik bilgilerini yalnız yetkilendirmek istediğiniz kişi için oluşturun.
   </p>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-bold text-[#283c5b]">Kullanıcı adı
     <input value={username} onChange={e=>{setUsername(e.target.value);setFormError("");}} minLength={4} maxLength={64}
      autoComplete="off" autoCapitalize="none" spellCheck={false} title="4-64 karakter; harf, rakam, nokta, alt çizgi, @ veya tire"
      placeholder="Örn: yonetici.2" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"/>
     <span className={"mt-2 block min-h-5 text-[11px] font-semibold "+(usernameState==="taken"?"text-red-700":usernameState==="available"?"text-emerald-700":"text-slate-500")} aria-live="polite">
      {username.length===0?"Yeni bir kullanıcı adı belirleyin.":!usernameValid?"4–64 karakter; Türkçe karakter ve boşluk kullanılmaz.":usernameState==="checking"?"Kullanıcı adı kontrol ediliyor...":usernameState==="taken"?"Bu kullanıcı adı zaten kullanımda. Farklı bir ad seçin.":usernameState==="available"?"Kullanıcı adı kullanılabilir.":usernameState==="unavailable"?"Ön kontrol yapılamadı; kaydettiğinizde sunucu kontrol edecek.":""}
     </span>
    </label>
    <div>
     <label className="text-xs font-bold text-[#283c5b]" htmlFor="dukkan-manager-password">Giriş şifresi</label>
     <span className="relative mt-2 block">
      <input id="dukkan-manager-password" value={password} onChange={e=>{setPassword(e.target.value);setFormError("");}} maxLength={128} type={visible?"text":"password"}
       autoComplete="new-password" placeholder="Güçlü bir şifre belirleyin" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-400"/>
      <button type="button" aria-label={visible?"Şifreyi gizle":"Şifreyi göster"} onClick={()=>setVisible(v=>!v)}
       className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
     </span>
     <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-live="polite">
      {checks.map(check=><span key={check.name} className={"flex items-center gap-1.5 text-[11px] "+(check.ok?"font-semibold text-emerald-700":"text-slate-500")}>
       {check.ok?<CheckCircle2 size={14}/>:<Circle size={14}/>} {check.name}
      </span>)}
     </div>
    </div>
   </div>
   {formError&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
    <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={15}/> Şifre sunucuda güvenli özet olarak saklanır.</p>
    <button type="submit" disabled={saving}
     className="inline-flex items-center gap-2 rounded-xl bg-[#123f7b] px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
     <UserPlus size={16}/>{saving?"Hesap oluşturuluyor...":"Süper Yönetici Hesabını Oluştur"}
    </button>
   </div>
   <p className="flex items-center gap-2 text-[11px] text-slate-500"><Info size={14}/> Eksik bilgi varsa butona bastığınızda hangi alanı düzeltmeniz gerektiği gösterilir.</p>
  </form>}
 </section>;
}
