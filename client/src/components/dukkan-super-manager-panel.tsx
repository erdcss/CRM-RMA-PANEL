import {useState,type FormEvent} from "react";
import {Eye,EyeOff,LockKeyhole,ShieldCheck,UserPlus,AlertTriangle} from "lucide-react";

export function DukkanSuperManagerPanel({storeId,onCreated,onError}:{storeId:string;onCreated:(username:string)=>void;onError:(error:string)=>void}){
 const [expanded,setExpanded]=useState(false);
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [visible,setVisible]=useState(false);
 const [saving,setSaving]=useState(false);
 const strong=password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/[0-9]/.test(password)&&/[^A-Za-z0-9]/.test(password);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(saving||!strong)return;
  setSaving(true);
  try{
   const res=await fetch("/api/dukkan/admin/super-managers",{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({storeId:Number(storeId),username:username.trim(),password})
   });
   const result=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(result.error||"Yetkili hesap oluşturulamadı");
   const assignedName=String(result.username||username);
   setUsername("");setPassword("");setVisible(false);setExpanded(false);
   onCreated(assignedName);
  }catch(error){onError(error instanceof Error?error.message:"Süper yönetici oluşturulamadı");}
  finally{setSaving(false);}
 };
 return <section className="mb-5 overflow-hidden rounded-[24px] border border-[#bcd4fa] bg-gradient-to-br from-[#edf6ff] via-white to-[#f5f5ff] p-5 shadow-sm sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div className="flex items-center gap-3">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#123f7b] text-white"><ShieldCheck size={23}/></span>
    <div><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">YÜKSEK YETKİLİ HESAP</span>
     <h3 className="text-base font-extrabold text-[#13294e]">Süper Yönetici Oluştur</h3>
     <p className="mt-0.5 text-xs text-slate-500">Yeni kullanıcı, mağaza sahibi ve Çalışkan Admin süper yöneticisi olur.</p>
    </div>
   </div>
   <button type="button" onClick={()=>setExpanded(value=>!value)} className="rounded-xl bg-[#123f7b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#235ca7]">
    {expanded?"Formu Kapat":"Yeni Süper Yönetici"}
   </button>
  </div>
  {expanded&&<form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
   <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
    <AlertTriangle className="mt-0.5 shrink-0" size={16}/>
    Bu kullanıcı tüm Çalışkan Admin işlemlerine erişebilir. Kimlik bilgilerini yalnız yetkilendirmek istediğiniz kişi için oluşturun.
   </p>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-bold text-[#283c5b]">Kullanıcı adı
     <input value={username} onChange={e=>setUsername(e.target.value)} required minLength={4} maxLength={64}
      autoComplete="off" pattern="[A-Za-z0-9._@-]+" title="4-64 karakter; harf, rakam, nokta, alt çizgi, @ veya tire"
      placeholder="Örn: yonetici.2" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"/>
    </label>
    <label className="text-xs font-bold text-[#283c5b]">Giriş şifresi
     <span className="relative mt-2 block">
      <input value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={128} type={visible?"text":"password"}
       autoComplete="new-password" placeholder="En az 12 karakter" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-400"/>
      <button type="button" aria-label={visible?"Şifreyi gizle":"Şifreyi göster"} onClick={()=>setVisible(v=>!v)}
       className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
     </span>
    </label>
   </div>
   <p className={"text-xs "+(strong?"font-semibold text-emerald-700":"text-slate-500")}>
    {strong?"Güçlü şifre koşulları sağlandı.":"Şifre: en az 12 karakter, büyük/küçük harf, rakam ve özel karakter içermelidir."}
   </p>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
    <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={15}/> Şifre sunucuda güvenli özet olarak saklanır.</p>
    <button type="submit" disabled={!strong||saving||username.trim().length<4} className="inline-flex items-center gap-2 rounded-xl bg-[#123f7b] px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
     <UserPlus size={16}/>{saving?"Hesap oluşturuluyor...":"Süper Yönetici Hesabını Oluştur"}
    </button>
   </div>
  </form>}
 </section>;
}
