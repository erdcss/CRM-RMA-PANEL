import {useEffect,useState,type FormEvent} from "react";
import {Check,Eye,FileText,Printer,RotateCcw,Save,Settings2,ShoppingBag} from "lucide-react";
import {
  defaultInvoiceForm,invoiceColors,resolveInvoiceForm,
  type DukkanInvoiceForm,type InvoiceFormKind,
} from "@shared/dukkan-invoice-forms";

type Forms={sale:DukkanInvoiceForm;purchase:DukkanInvoiceForm};
const defaults=():Forms=>({sale:defaultInvoiceForm("sale"),purchase:defaultInvoiceForm("purchase")});
const fieldStyle="w-full min-w-0 rounded-xl border border-[#dbe5f1] bg-white px-3 py-2.5 text-[13px] text-[#153354] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const fieldLabel="mb-1.5 block text-[11px] font-bold text-slate-600";
const currency=(amount:number)=>amount.toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
type Props={base:string;storeId:string;storeName:string;canEdit:boolean};

async function api(path:string,opts?:RequestInit){
  const response=await fetch(path,{credentials:"include",cache:"no-store",...opts,
    headers:{"Content-Type":"application/json",...(opts?.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"Form ayarları alınamadı");
  return body;
}

export function DukkanInvoiceFormSettings({base,storeId,storeName,canEdit}:Props){
  const [kind,setKind]=useState<InvoiceFormKind>("sale");
  const [forms,setForms]=useState<Forms>(defaults);
  const [saved,setSaved]=useState<Forms>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [printing,setPrinting]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setNotice("");setError("");setForms(defaults());setSaved(defaults());
    void api(base+"/print-forms",{signal:controller.signal}).then((data:Forms)=>{
      if(controller.signal.aborted)return;
      const next={
        sale:resolveInvoiceForm("sale",data?.sale),
        purchase:resolveInvoiceForm("purchase",data?.purchase),
      };
      setForms(next);setSaved(next);
    }).catch((e:Error)=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[base,storeId]);

  const form=forms[kind];
  const dirty=JSON.stringify(form)!==JSON.stringify(saved[kind]);
  const put=<K extends keyof DukkanInvoiceForm>(field:K,value:DukkanInvoiceForm[K])=>{
    setForms(state=>({...state,[kind]:{...state[kind],[field]:value}}));
    setNotice("");setError("");
  };
  const textField=(key:keyof DukkanInvoiceForm,label:string,placeholder="",maxLength=140)=>{
    const value=form[key];
    if(typeof value!=="string")return null;
    return <label className="block min-w-0" key={key}>
      <span className={fieldLabel}>{label}</span>
      <input value={value} maxLength={maxLength} className={fieldStyle}
        placeholder={placeholder} onChange={e=>put(key,e.target.value as never)} disabled={!canEdit}/>
    </label>;
  };
  const toggle=(key:keyof DukkanInvoiceForm,label:string,desc:string)=>{
    const checked=form[key]===true;
    return <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#e4ebf5] bg-[#fafcff] px-3 py-3.5">
      <div className="min-w-0">
        <span className="block text-xs font-bold text-[#203e60]">{label}</span>
        <span className="mt-0.5 block text-[11px] text-[#768ba5]">{desc}</span>
      </div>
      <input type="checkbox" disabled={!canEdit} checked={checked}
        onChange={e=>put(key,e.target.checked as never)} className="h-5 w-5 accent-[#1569a8]"/>
    </label>;
  };
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(saving||!canEdit)return;
    setSaving(true);setError("");setNotice("");
    try{
      const output=await api(base+"/print-forms/"+kind,{method:"PUT",body:JSON.stringify(form)});
      const validated=resolveInvoiceForm(kind,output.template);
      setForms(state=>({...state,[kind]:validated}));
      setSaved(state=>({...state,[kind]:validated}));
      setNotice((kind==="sale"?"Satış":"Alış")+" yazdırma formu mağaza hesabına kaydedildi.");
    }catch(e){setError((e as Error).message);}
    finally{setSaving(false);}
  };
  const sampleData=()=>{
    const subtotal=1800,tax=360;
    return {
      invoice:{
        id:0,invoice_no:"ORNEK-000001",
        kind,issued_at:new Date().toISOString(),
        party_name:kind==="sale"?"ÖRNEK MÜŞTERİ":"ÖRNEK TEDARİKÇİ",
        party_tax_number:"1111111111",party_phone:"0500 000 00 00",
        store_name:storeName||"ÖRNEK MAĞAZA",
        subtotal,tax_total:tax,grand_total:subtotal+tax,
      },
      lines:[
        {id:1,sku:"ORNEK-001",product_name:"Örnek Ürün",unit:"adet",
          quantity:2,unit_price:900,tax_rate:20,line_total:2160},
      ],
      disclaimer:"ÖRNEKTİR — Resmî belge yerine geçmez",
      officialInvoice:false as const,
      template:{
        ...form,
        headerNote:("ÖRNEK ŞABLON · GERÇEK FATURA DEĞİLDİR · "+form.headerNote).slice(0,350),
      },
    };
  };
  const print=async(download:boolean)=>{
    if(printing)return;
    // Opening before any await avoids pop-up blockers.
    const target=download?null:window.open("","_blank");
    if(target){
      target.document.title="Çalışkan Dükkân · Örnek Form";
      target.document.body.textContent="Yazdırma örneği hazırlanıyor...";
    }
    setPrinting(true);setError("");
    try{
      const engine=await import("@/lib/dukkan-invoice-pdf");
      const sample=sampleData();
      if(download)await engine.exportDukkanInvoicePdf(sample);
      else engine.showDukkanInvoicePrint(engine.renderDukkanInvoicePdf(sample),target);
    }catch(e){
      if(target)target.close();
      setError("Örnek PDF hazırlanamadı: "+(e as Error).message);
    }finally{setPrinting(false);}
  };

  const colors=invoiceColors[form.color];
  return <section className="space-y-5" aria-label="Fatura Formları">
    <div className="rounded-[22px] border border-[#dfebf7] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[#e8f4ff] p-3 text-[#17649c]"><FileText size={23}/></span>
          <div>
            <h2 className="text-lg font-black text-[#173759]">Yazdırma Formları</h2>
            <p className="mt-1 text-xs text-slate-500">Satış ve alış belgelerinin şablonlarını ayrı ayrı düzenleyin.</p>
          </div>
        </div>
        {dirty&&<span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800">Kaydedilmemiş değişiklik</span>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#f1f6fc] p-1.5">
        {(["sale","purchase"] as const).map(value=>
          <button type="button" key={value} aria-pressed={kind===value}
            onClick={()=>{setKind(value);setError("");setNotice("");}}
            className={"flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition "+
              (kind===value?"bg-[#123d69] text-white shadow":"bg-transparent text-[#516b85] hover:bg-white")}>
            {value==="sale"?<ShoppingBag size={17}/>:<FileText size={17}/>}
            {value==="sale"?"Satış Faturası":"Alış Faturası"}
          </button>)}
      </div>
      <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-xs leading-5 text-[#315b85]">
        Bu ayarlar yalnızca belgenin yazdırılma biçimini değiştirir. Kayıtlı ürünler,
        cari, miktar, KDV ve fatura tutarları değiştirilemez. Resmî e-Fatura/e-Arşiv oluşturulmaz.
      </p>
    </div>
    {loading?<div className="rounded-xl bg-white p-12 text-center text-slate-500">Form ayarları yükleniyor…</div>:
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
        <form onSubmit={save} className="min-w-0 space-y-5">
          <div className="rounded-[22px] border border-[#e0e9f5] bg-white p-5">
            <h3 className="mb-4 text-sm font-extrabold text-[#163858]">Başlık ve İşletme Bilgileri</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {textField("documentTitle","Belge Başlığı","Örn. SATIŞ BELGESİ",90)}
              {textField("companyName","Yazdırılacak İşletme Adı",storeName,140)}
              <div className="sm:col-span-2">{textField("companyAddress","İşletme Adresi","Adres yazın",350)}</div>
              {textField("companyPhone","İşletme Telefonu","0...",45)}
              {textField("companyTaxOffice","Vergi Dairesi","Vergi dairesi",100)}
              {textField("companyTaxNumber","Vergi Numarası","VKN / TCKN",32)}
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={fieldLabel}>Üst Açıklama</span>
                <textarea value={form.headerNote} disabled={!canEdit} maxLength={350} rows={2}
                  onChange={e=>put("headerNote",e.target.value)}
                  className={fieldStyle+" resize-y"} placeholder="Örn. Siparişiniz için teşekkürler."/>
              </label>
              <label className="block">
                <span className={fieldLabel}>Alt Not / Açıklama</span>
                <textarea value={form.footerNote} disabled={!canEdit} maxLength={600} rows={3}
                  onChange={e=>put("footerNote",e.target.value)}
                  className={fieldStyle+" resize-y"} placeholder="Örn. Teslimat ve iade açıklamaları."/>
              </label>
            </div>
          </div>
          <div className="rounded-[22px] border border-[#e0e9f5] bg-white p-5">
            <h3 className="mb-4 text-sm font-extrabold text-[#163858]">Tablo Başlıkları ve Alanlar</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {textField("productHeader","Ürün Sütunu","ÜRÜN / HİZMET",40)}
              {textField("quantityHeader","Miktar Sütunu","MİKTAR",25)}
              {textField("priceHeader","Fiyat Sütunu","BİRİM FİYAT",25)}
              {textField("taxHeader","KDV Sütunu","KDV",25)}
              {textField("amountHeader","Tutar Sütunu","TUTAR",25)}
            </div>
            <div className="mt-4 grid gap-2">
              {toggle("showProductCode","Stok Kodu","Ürünün altında stok kodunu göster")}
              {toggle("showUnitPrice","Birim Fiyat","Satırdaki birim fiyat sütununu göster")}
              {toggle("showTaxRate","KDV Oranı","Ürün satırlarında KDV oranını göster")}
              {toggle("showPartyTaxNumber","Cari VKN / TCKN","Müşteri/tedarikçinin vergi numarası")}
              {toggle("showPartyPhone","Cari Telefonu","Müşteri/tedarikçinin telefon numarası")}
              {toggle("showCompanyDetails","İşletme Detayları","Adres, telefon ve vergi bilgileri")}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#e0e9f5] bg-white p-5">
            <h3 className="mb-4 text-sm font-extrabold text-[#163858]">Kağıt ve Renk Teması</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={fieldLabel}>Sayfa Boyutu</span>
                <select value={form.paperSize} disabled={!canEdit} className={fieldStyle}
                  onChange={e=>put("paperSize",e.target.value as DukkanInvoiceForm["paperSize"])}>
                  <option value="a4">A4 · 210 × 297 mm</option>
                  <option value="a5">A5 · 148 × 210 mm</option>
                </select>
              </label>
              <label className="block"><span className={fieldLabel}>Renk Teması</span>
                <select value={form.color} disabled={!canEdit} className={fieldStyle}
                  onChange={e=>put("color",e.target.value as DukkanInvoiceForm["color"])}>
                  <option value="navy">Lacivert</option>
                  <option value="blue">Mavi</option>
                  <option value="emerald">Yeşil</option>
                  <option value="charcoal">Antrasit</option>
                </select>
              </label>
            </div>
          </div>
          {error&&<p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice&&<p role="status" className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!canEdit||saving||!dirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#133a69] px-5 text-xs font-bold text-white hover:bg-[#235489] disabled:opacity-50">
              <Save size={16}/>{saving?"Kaydediliyor…":"Şablonu Kaydet"}
            </button>
            <button type="button" disabled={!canEdit}
              onClick={()=>put("documentTitle",defaultInvoiceForm(kind).documentTitle)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-[#526983] disabled:opacity-50">
              <RotateCcw size={15}/> Başlığı Sıfırla
            </button>
            <button type="button" disabled={!canEdit}
              onClick={()=>{setForms(curr=>({...curr,[kind]:defaultInvoiceForm(kind)}));setNotice("");}}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-bold text-amber-800 disabled:opacity-50">
              Varsayılan Tasarım
            </button>
          </div>
        </form>
        <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#163858]"><Eye size={17}/> Canlı Önizleme</h3>
            <span className="text-xs font-semibold text-slate-500">{form.paperSize.toUpperCase()}</span>
          </div>
          <div className="mx-auto max-w-[460px] overflow-hidden rounded-xl border border-[#dce5f0] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
            <div className="border-t-[7px] px-5 py-6 text-white" style={{background:colors.main,borderTopColor:colors.accent}}>
              <h4 className="break-words text-lg font-black">{form.companyName||storeName}</h4>
              <p className="mt-1 text-[11px] font-bold text-sky-200">{form.documentTitle}</p>
              {form.headerNote&&<p className="mt-2 break-words text-[10px] text-slate-200">{form.headerNote}</p>}
              <p className="mt-2 text-[9px] text-slate-300">Belge No: ÖRNEK-000001</p>
            </div>
            <div className="space-y-4 px-4 py-5">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f3f7fc] p-3 text-[10px]">
                <div><strong className="block text-slate-500">İŞLETME</strong><p className="mt-1 break-words font-bold">{form.companyName||storeName}</p>
                  {form.showCompanyDetails&&<p className="mt-1 break-words text-[9px] text-slate-500">
                    {[form.companyAddress,form.companyPhone,form.companyTaxOffice,form.companyTaxNumber].filter(Boolean).join(" · ")}
                  </p>}
                </div>
                <div><strong className="block text-slate-500">{kind==="sale"?"MÜŞTERİ":"TEDARİKÇİ"} / CARİ</strong>
                  <p className="mt-1 font-bold">ÖRNEK CARİ</p>
                  {form.showPartyTaxNumber&&<p className="mt-1 text-[9px] text-slate-500">VKN: 1111111111</p>}
                  {form.showPartyPhone&&<p className="mt-1 text-[9px] text-slate-500">Tel: 0500 000 00 00</p>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[350px] text-left text-[9px]">
                  <thead><tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2">{form.productHeader}</th>
                    <th className="py-2 text-right">{form.quantityHeader}</th>
                    {form.showUnitPrice&&<th className="py-2 text-right">{form.priceHeader}</th>}
                    {form.showTaxRate&&<th className="py-2 text-right">{form.taxHeader}</th>}
                    <th className="py-2 text-right">{form.amountHeader}</th>
                  </tr></thead>
                  <tbody><tr className="border-b border-slate-100 align-top">
                    <td className="py-3"><strong>Örnek Ürün</strong>
                      {form.showProductCode&&<span className="block text-slate-400">ORNEK-001</span>}</td>
                    <td className="py-3 text-right">2 adet</td>
                    {form.showUnitPrice&&<td className="py-3 text-right">{currency(900)}</td>}
                    {form.showTaxRate&&<td className="py-3 text-right">%20</td>}
                    <td className="py-3 text-right font-bold">{currency(2160)}</td>
                  </tr></tbody>
                </table>
              </div>
              <div className="ml-auto max-w-[230px] space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Ara Toplam</span><strong>{currency(1800)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">KDV Toplamı</span><strong>{currency(360)}</strong></div>
                <div className="flex justify-between gap-3 rounded-lg px-3 py-2 font-bold text-white" style={{background:colors.main}}>
                  <span>GENEL TOPLAM</span><span>{currency(2160)}</span>
                </div>
              </div>
              {form.footerNote&&<p className="break-words text-[10px] text-slate-500">{form.footerNote}</p>}
              <p className="border-t border-slate-100 pt-2 text-[9px] text-slate-500">
                Dahili ön muhasebe belgesidir; GİB e-Fatura / e-Arşiv yerine geçmez.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={printing} onClick={()=>void print(false)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#153b69] px-3 text-xs font-bold text-white disabled:opacity-50">
              <Printer size={16}/>{printing?"Hazırlanıyor…":"Test Yazdır"}
            </button>
            <button type="button" disabled={printing} onClick={()=>void print(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d4e3f3] bg-white px-3 text-xs font-bold text-[#1f5486] disabled:opacity-50">
              <FileText size={16}/> Örnek PDF
            </button>
          </div>
          <p className="text-[11px] leading-5 text-slate-500">
            Önizlemede örnek veriler kullanılır. Gerçek çıktıların fatura numarası,
            cari, ürün miktarları, fiyatları ve toplamları kayıtlı faturadan alınır.
          </p>
        </aside>
      </div>}
  </section>;
}
