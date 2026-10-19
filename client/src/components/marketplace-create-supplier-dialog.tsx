import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type SupplierForm={
  companyName:string;firstName:string;lastName:string;email:string;phone:string;
  taxNumber:string;taxOffice:string;companyType:""|"sahis"|"limited"|"anonim"|"kooperatif"|"diger";
  iban:string;description:string;
};
type CreatedSupplier={supplierId:number;userId:number;slug:string;status:"pending";email:string;temporaryPassword:string;message:string};
const blank:SupplierForm={
  companyName:"",firstName:"",lastName:"",email:"",phone:"",
  taxNumber:"",taxOffice:"",companyType:"",iban:"",description:""
};
type Props={open:boolean;onOpenChange:(open:boolean)=>void;onCreated:()=>void};

export function MarketplaceCreateSupplierDialog({open,onOpenChange,onCreated}:Props){
  const [form,setForm]=useState<SupplierForm>(blank);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<CreatedSupplier|null>(null);
  const [copied,setCopied]=useState(false);

  function change<K extends keyof SupplierForm>(key:K,value:SupplierForm[K]){
    setForm(previous=>({...previous,[key]:value}));
  }
  function toggle(next:boolean){
    if(working)return;
    onOpenChange(next);
    if(!next){setForm(blank);setCreated(null);setCopied(false);setError("");}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(working||created)return;
    setError("");
    setWorking(true);
    try{
      const response=await apiRequest("POST","/api/admin/marketplace/suppliers",form);
      const result=await response.json() as CreatedSupplier;
      setCreated(result);
      onCreated();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Tedarikçi oluşturulamadı.");
    }finally{setWorking(false);}
  }
  async function copyCredentials(){
    if(!created)return;
    const value=[
      "Çalışkan B2B - Tedarikçi Giriş Bilgileri",
      "Kullanıcı adı: "+created.email,
      "Başlangıç şifresi: "+created.temporaryPassword,
      "Firma: "+form.companyName,
      "Hesap durumu: Yönetici onayı ve firma doğrulaması bekleniyor"
    ].join("\n");
    try{await navigator.clipboard.writeText(value);setCopied(true);}
    catch{setError("Otomatik kopyalama engellendi. Giriş bilgilerini bu pencereden elle kopyalayın.");}
  }

  const inputClass="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  return <Dialog open={open} onOpenChange={toggle}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border-slate-200 p-5 sm:p-6">
      <DialogHeader>
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-950">
          {created?<CheckCircle2 className="h-6 w-6"/>:<UserPlus className="h-6 w-6"/>}
        </div>
        <DialogTitle className="text-xl font-extrabold">
          {created?"Tedarikçi hesabı oluşturuldu":"Yeni Tedarikçi Ekle"}
        </DialogTitle>
        <DialogDescription>
          {created?"Başlangıç şifresi yalnızca bu pencerede gösterilir. Kapatmadan önce güvenli biçimde paylaşın.":
            "Tedarikçinin giriş hesabını ve pazaryeri mağaza kaydını birlikte oluşturun. Satışlar firma belgeleri onaylandıktan sonra açılır."}
        </DialogDescription>
      </DialogHeader>
      {created?<div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-900">
          <div className="flex items-center gap-2 font-extrabold text-emerald-900"><CheckCircle2 className="h-4 w-4"/>Kayıt başarılı · Onay bekliyor</div>
          <p><b>Firma:</b> {form.companyName}</p>
          <p><b>Yetkili:</b> {form.firstName} {form.lastName}</p>
          <p><b>Tedarikçi ID:</b> #{created.supplierId}</p>
          <p><b>Giriş e-postası:</b> <span className="break-all">{created.email}</span></p>
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-2 flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4"/>Başlangıç şifresi</div>
            <code className="block select-all break-all text-sm">{created.temporaryPassword}</code>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-600">Bu şifre tekrar görüntülenemez. E-posta veya şifre paylaşımı otomatik yapılmadı. Giriş bilgilerini yalnızca yetkili kişiyle güvenli bir kanaldan paylaşın. Eksik vergi levhası ve diğer doğrulama belgelerini tedarikçi panelinden tamamlayabilir.</p>
        {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>:null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={()=>toggle(false)}>Kapat</Button>
          <Button type="button" onClick={()=>void copyCredentials()} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
            <Copy className="h-4 w-4"/>{copied?"Kopyalandı":"Giriş Bilgilerini Kopyala"}
          </Button>
        </div>
      </div>:<form className="space-y-4" onSubmit={event=>void submit(event)}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-extrabold"><Building2 className="h-4 w-4"/>Firma Bilgileri</div>
          <label className="block space-y-1 text-xs font-bold text-slate-700">Firma adı *
            <input autoFocus required minLength={2} maxLength={180} className={inputClass}
              placeholder="Firma unvanı" value={form.companyName} onChange={e=>change("companyName",e.target.value)}/>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs font-bold text-slate-700">Vergi / T.C. kimlik no
              <input inputMode="numeric" pattern="([0-9]{10}|[0-9]{11})?" maxLength={11} className={inputClass}
                placeholder="10 veya 11 hane (isteğe bağlı)" value={form.taxNumber} onChange={e=>change("taxNumber",e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">Vergi dairesi
              <input maxLength={140} className={inputClass} value={form.taxOffice} onChange={e=>change("taxOffice",e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">Şirket türü
              <select value={form.companyType} className={inputClass} onChange={e=>change("companyType",e.target.value as SupplierForm["companyType"])}>
                <option value="">Daha sonra belirlenecek</option>
                <option value="sahis">Şahıs</option><option value="limited">Limited</option>
                <option value="anonim">Anonim</option><option value="kooperatif">Kooperatif</option><option value="diger">Diğer</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">IBAN
              <input maxLength={26} className={inputClass} placeholder="TR ile başlayan 26 karakter" value={form.iban} onChange={e=>change("iban",e.target.value.toUpperCase().replace(/\s/g,""))}/>
            </label>
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-extrabold"><UserPlus className="h-4 w-4"/>Yetkili ve Giriş Bilgileri</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs font-bold text-slate-700">Adı *
              <input required minLength={2} maxLength={80} className={inputClass} autoComplete="given-name" value={form.firstName} onChange={e=>change("firstName",e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">Soyadı *
              <input required minLength={2} maxLength={80} className={inputClass} autoComplete="family-name" value={form.lastName} onChange={e=>change("lastName",e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">Giriş e-postası *
              <input required type="email" maxLength={254} className={inputClass} autoComplete="off" value={form.email} onChange={e=>change("email",e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700">Telefon *
              <input required type="tel" minLength={10} maxLength={25} className={inputClass} autoComplete="off" value={form.phone} onChange={e=>change("phone",e.target.value)}/>
            </label>
          </div>
          <label className="block space-y-1 text-xs font-bold text-slate-700">Faaliyet alanı / açıklama
            <textarea rows={2} maxLength={600} className={inputClass+" h-auto min-h-16 py-2"} value={form.description} onChange={e=>change("description",e.target.value)}/>
          </label>
        </div>
        {error?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>:null}
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Satıcıya güçlü bir başlangıç şifresi üretilecek. Hesap, satış onayı tamamlanana kadar <b>Onay Bekliyor</b> durumunda kalacak.
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={working} onClick={()=>toggle(false)}>Vazgeç</Button>
          <Button type="submit" disabled={working} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
            {working?<Loader2 className="h-4 w-4 animate-spin"/>:<UserPlus className="h-4 w-4"/>}
            {working?"Oluşturuluyor…":"Tedarikçi Hesabı Oluştur"}
          </Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>;
}
