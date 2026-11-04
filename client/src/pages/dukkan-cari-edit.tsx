import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, CheckCircle2, ClipboardList, CreditCard, Save, ShieldCheck, Truck, Users } from "lucide-react";

type CariType = "customer" | "supplier" | "both";
type Cari = {
  id: string | number;
  name: string;
  type: CariType;
  source_cari_no: string | null;
  account_code: string | null;
  city: string | null;
  tax_number: string | null;
  phone: string | null;
  email: string | null;
  special_code: string | null;
  account_kind?: "buyer" | "seller" | "both" | null;
  contact_primary?: string | null;
  contact_secondary?: string | null;
  phone_secondary?: string | null;
  fax_number?: string | null;
  mobile_number?: string | null;
  address?: string | null;
  district?: string | null;
  tax_office?: string | null;
  special_code_2?: string | null;
  special_code_3?: string | null;
  notes?: string | null;
  balance: string | number;
  last_transaction_at?: string | null;
  recent_movements?: Array<{
    id: string | number;
    debit: string | number;
    credit: string | number;
    description: string | null;
    created_at: string;
  }>;
};
type CariForm = {
  name: string; type: CariType; sourceCariNo: string;
  accountCode: string; city: string; taxNumber: string;
  phone: string; email: string; specialCode: string;
  accountKind: "buyer" | "seller" | "both" | "";
  contactPrimary: string; contactSecondary: string;
  phoneSecondary: string; faxNumber: string; mobileNumber: string;
  address: string; district: string; taxOffice: string;
  specialCode2: string; specialCode3: string; notes: string;
};
const empty:CariForm = {
  name:"",type:"customer",sourceCariNo:"",accountCode:"",city:"",
  taxNumber:"",phone:"",email:"",specialCode:"",
  accountKind:"",contactPrimary:"",contactSecondary:"",
  phoneSecondary:"",faxNumber:"",mobileNumber:"",
  address:"",district:"",taxOffice:"",specialCode2:"",specialCode3:"",notes:""
};
const fieldClass="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#172945] outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const currency=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
async function request(path:string,options?:RequestInit){
  const response=await fetch(path,{
    credentials:"include",cache:"no-store",...options,
    headers:{"Content-Type":"application/json",...(options?.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"İşlem tamamlanamadı.");
  return data;
}

export default function DukkanCariEdit({id}:{id:string}){
  const [,navigate]=useLocation();
  const query=new URLSearchParams(window.location.search);
  const storeId=query.get("storeId")||"";
  const origin=query.get("from")==="suppliers"?"suppliers":"parties";
  const isNew=id==="new";
  const [cari,setCari]=useState<Cari|null>(null);
  const [form,setForm]=useState<CariForm>({...empty,type:origin==="suppliers"?"supplier":"customer"});
  const [loading,setLoading]=useState(!isNew);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  const path="/api/dukkan/stores/"+encodeURIComponent(storeId)+"/parties/"+encodeURIComponent(id);
  const edit=(key:keyof CariForm,value:string)=>{setForm(old=>({...old,[key]:value}));setSaved(false);};

  const goBack=()=>{
    const target=cari ? (cari.type==="supplier"?"suppliers":"parties") : origin;
    const route="/dukkan?tab="+target+"&storeId="+encodeURIComponent(storeId);
    try{
      const previous=JSON.parse(sessionStorage.getItem("dukkan:last-cari-list")||"null");
      if(previous?.storeId===storeId&&previous?.section===target){
        sessionStorage.setItem("dukkan:return-to-cari","1");
      }else{
        sessionStorage.removeItem("dukkan:return-to-cari");
        sessionStorage.removeItem("dukkan:restore-cari-scroll");
      }
    }catch{ /* navigation works without session storage */ }
    navigate(route);
  };

  useEffect(()=>{
    let live=true;
    if(isNew){
      setLoading(false);
      return;
    }
    if(!storeId||!Number.isSafeInteger(Number(id))||Number(id)<1){
      setError("Cari hesap veya mağaza kimliği geçersiz.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void request(path)
      .then((item:Cari)=>{
        if(!live)return;
        setCari(item);
        setForm({
          name:String(item.name||""),
          type:item.type||"customer",
          sourceCariNo:String(item.source_cari_no||""),
          accountCode:String(item.account_code||""),
          city:String(item.city||""),
          taxNumber:String(item.tax_number||""),
          phone:String(item.phone||""),
          email:String(item.email||""),
          specialCode:String(item.special_code||""),
          accountKind:item.account_kind||"",
          contactPrimary:String(item.contact_primary||""),
          contactSecondary:String(item.contact_secondary||""),
          phoneSecondary:String(item.phone_secondary||""),
          faxNumber:String(item.fax_number||""),
          mobileNumber:String(item.mobile_number||""),
          address:String(item.address||""),
          district:String(item.district||""),
          taxOffice:String(item.tax_office||""),
          specialCode2:String(item.special_code_2||""),
          specialCode3:String(item.special_code_3||""),
          notes:String(item.notes||"")
        });
      })
      .catch((reason:Error)=>{if(live)setError(reason.message);})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[path,id,storeId,isNew]);

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if((!isNew&&!cari)||saving)return;
    setSaving(true);setError("");setSaved(false);
    try{
      const updated=await request(isNew?"/api/dukkan/stores/"+encodeURIComponent(storeId)+"/parties":path,
        {method:isNew?"POST":"PATCH",body:JSON.stringify(form)});
      if(isNew){
        navigate("/dukkan/cariler/"+encodeURIComponent(String(updated.id))+
          "?storeId="+encodeURIComponent(storeId)+"&from="+origin);
        return;
      }
      setCari(old=>old?{...old,...updated}:null);
      setSaved(true);
      // The account's financial ledger is not part of this profile form.
    }catch(reason){setError((reason as Error).message);}
    finally{setSaving(false);}
  };

  const input=(key:keyof CariForm,label:string,required=false):ReactNode=>
    <label key={key} className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input className={fieldClass} required={required} value={form[key]}
        maxLength={key==="name"||key==="contactPrimary"||key==="contactSecondary"?180:
          key==="email"||key==="specialCode"||key==="specialCode2"||key==="specialCode3"?200:
          ["phone","phoneSecondary","faxNumber","mobileNumber"].includes(key)?50:120}
        type={key==="email"?"email":["phone","phoneSecondary","faxNumber","mobileNumber"].includes(key)?"tel":"text"}
        onChange={event=>edit(key,event.target.value)}/>
    </label>;

  return <main className="h-full min-h-0 overflow-y-auto bg-[#f3f7fc] text-[#142b4e]">
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#17385f] shadow-sm hover:bg-slate-50">
          <ArrowLeft size={19}/> {cari?.type==="supplier"?"Tedarikçi Firmalara Dön":"Cari Hesaplara Dön"}
        </button>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ShieldCheck size={17}/> Çalışkan Dükkan · Cari Yönetimi
        </span>
      </div>

      <section className="mb-5 rounded-[24px] border border-[#dce6f3] bg-white px-5 py-6 shadow-sm sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#215b92]">
            {cari?.type==="supplier"?<Truck size={26}/>:<Building2 size={26}/>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sky-700">Cari Hesap Kartı</p>
            <h1 className="mt-1 break-words text-xl font-black sm:text-2xl">{isNew?"Yeni Cari Hesap Oluştur":cari?.name||"Cari hesap bilgileri"}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Cari No: {cari?.source_cari_no||"—"} · Hesap Kodu: {cari?.account_code||"—"}
            </p>
          </div>
          {cari&&<div className="min-w-[190px] rounded-2xl border border-slate-100 bg-[#f7faff] px-5 py-3 text-right">
            <p className="text-xs font-semibold text-slate-500">Güncel Cari Bakiye</p>
            <p className={"mt-1 text-lg font-black tabular-nums "+(Number(cari.balance)<0?"text-emerald-700":"text-[#122a51]")}>
              {currency(Math.abs(Number(cari.balance||0)))}
            </p>
            <p className="text-xs text-slate-500">{Number(cari.balance)>0?"Borç":Number(cari.balance)<0?"Alacak":"Bakiye yok"}</p>
          </div>}
        </div>
      </section>

      {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {saved&&<div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        <CheckCircle2 size={18}/> Cari hesap bilgileri kaydedildi.
      </div>}
      {loading?<div className="rounded-2xl bg-white p-10 text-center text-slate-500">Cari hesap bilgileri yükleniyor…</div>:(cari||isNew)?(
        <div className="space-y-5">
          <form onSubmit={submit} className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <h2 className="text-base font-black">{isNew?"Yeni Cari Hesap Bilgileri":"Cari Bilgilerini Düzenle"}</h2>
              <p className="mt-1 text-xs text-slate-500">Kimlik ve iletişim bilgilerini güncelleyebilirsiniz. Borç/alacak bakiyesi bu alandan değiştirilemez.</p>
            </div>
            <div className="space-y-7">
              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-black text-[#20416f]">Genel ve Hesap Bilgileri</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {input("accountCode","Hesap Kodu")}
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Hesap Tipi</span>
                    <select className={fieldClass} value={form.accountKind} onChange={event=>edit("accountKind",event.target.value)}>
                      <option value="">Belirtilmedi</option>
                      <option value="buyer">Alıcı</option>
                      <option value="seller">Satıcı</option>
                      <option value="both">Alıcı / Satıcı</option>
                    </select>
                    <span className="mt-1 block text-[11px] text-slate-500">Hesap tipi, müşteri ve tedarikçi listelerini değiştirmez.</span>
                  </label>
                  {input("name","Ünvan / Firma - Kişi Adı",true)}
                  {input("sourceCariNo","Cari No")}
                  {input("specialCode","Özel Kod")}
                  {input("specialCode2","Özel Kodlar 2")}
                  {input("specialCode3","Özel Kodlar 3")}
                </div>
              </section>
              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-black text-[#20416f]">İlgili Kişiler ve İletişim</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {input("contactPrimary","Birinci İlgili")}
                  {input("contactSecondary","İkinci İlgili")}
                  {input("phone","Telefon 1")}
                  {input("phoneSecondary","Telefon 2")}
                  {input("faxNumber","Fax No")}
                  {input("mobileNumber","GSM No")}
                  {input("email","E-Mail")}
                </div>
              </section>
              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-black text-[#20416f]">Adres ve Vergi Bilgileri</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {input("city","İl")}
                  {input("district","İlçesi")}
                  {input("taxOffice","Vergi Dairesi")}
                  {input("taxNumber","Vergi No")}
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Adresi</span>
                  <textarea className={fieldClass+" min-h-24 resize-y"} maxLength={1000}
                    value={form.address} onChange={event=>edit("address",event.target.value)}
                    placeholder="Cadde, sokak, bina numarası ve diğer adres bilgileri" />
                </label>
              </section>
              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-black text-[#20416f]">Notlar</h3>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Cari Hesap Notları</span>
                  <textarea className={fieldClass+" min-h-36 resize-y"} maxLength={8000}
                    value={form.notes} onChange={event=>edit("notes",event.target.value)}
                    placeholder="Cari hesap hakkında notlarınızı yazabilirsiniz." />
                  <span className="mt-1 block text-right text-[11px] text-slate-500">{form.notes.length} / 8000</span>
                </label>
              </section>
            </div>
            {!isNew&&cari&&form.type!==cari.type&&<div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-[#204e81]">
              <Users size={19} className="mt-0.5 shrink-0"/>
              Kaydedildiğinde bu hesap {form.type==="supplier"?"Tedarikçi Firmalar":"Cari Hesaplar"} listesinde görünecek. Mevcut cari hareketleri ve bakiyesi korunacak.
            </div>}
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={goBack} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold hover:bg-slate-50">Geri Dön</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#122a51] px-6 py-3 text-sm font-bold text-white hover:bg-[#1c4b83] disabled:opacity-50">
                <Save size={17}/> {saving?"Kaydediliyor…":isNew?"Cari Hesabı Oluştur":"Değişiklikleri Kaydet"}
              </button>
            </div>
          </form>

          {!isNew&&<section className="rounded-[24px] border border-[#dce6f3] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ClipboardList size={20} className="text-[#215b92]"/>
              <h2 className="text-base font-black">Son Cari Hareketleri</h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">Son 20 hareket · Kaydedilmiş finansal kayıtlar salt okunur.</p>
            {cari.recent_movements?.length?<div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[#f0f5fc] text-xs font-bold text-[#58708d]">
                  <tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Açıklama</th><th className="px-4 py-3 text-right">Borç</th><th className="px-4 py-3 text-right">Alacak</th></tr>
                </thead>
                <tbody>{cari.recent_movements.map(item=><tr key={item.id} className="border-t border-[#edf1f7]">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(item.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3">{item.description||"Cari hareket"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{currency(item.debit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{currency(item.credit)}</td>
                </tr>)}</tbody>
              </table>
            </div>:<p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Bu cari hesap için henüz hareket yok.</p>}
          </section>
        </div>
      ):<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        <CreditCard size={28} className="mx-auto mb-3 text-slate-400"/>
        Cari hesap görüntülenemiyor. Mağaza erişiminizi ve cari numarasını kontrol edin.
      </div>}
    </div>
  </main>;
}
