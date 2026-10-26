import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useBranding } from "@/hooks/use-branding";
import { Building2, Plus, RefreshCw, Store, Trash2 } from "lucide-react";

type Entry = Record<string, any>;
type Field = { key: string; label: string; type?: "text" | "number" | "date" | "select"; options?: Array<{ value: string; label: string }>; required?: boolean };
type DocLine = { productId: string; quantity: string; unitPrice: string; taxRate: string };
type Section = "overview" | "sales" | "purchases" | "products" | "stock" | "orders" | "instruments" | "banks" | "parties" | "reports";
const SECTIONS: Array<{ key: Section; label: string }> = [
  { key:"overview",label:"Genel Bakış" },{key:"sales",label:"Satış Faturaları"},
  {key:"purchases",label:"Satın Alma Faturaları"},{key:"products",label:"Ürünler"},
  {key:"stock",label:"Stok Hareketleri"},{key:"orders",label:"Siparişler"},
  {key:"instruments",label:"Çek ve Senetler"},{key:"banks",label:"Bankalar"},
  {key:"parties",label:"Cari Hesaplar"},{key:"reports",label:"Raporlar"}
];
const NEW_LINE: DocLine = { productId:"",quantity:"1",unitPrice:"0",taxRate:"20" };
const currency=(v: unknown)=>Number(v||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const fmt=(v:unknown)=>v===null||v===undefined?"—":String(v);
const api=async(path:string,options?:RequestInit)=>{
  const response=await fetch(path,{credentials:"include",...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(value.error||"İşlem tamamlanamadı");
  return value;
};
const buttonClass="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40";
const inputClass="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-400";
const softCard="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

export default function Dukkan() {
  const {data:branding}=useBranding();
  const [stores,setStores]=useState<Entry[]>([]);
  const [isAdmin,setIsAdmin]=useState(false);
  const [members,setMembers]=useState<Entry[]>([]);
  const [storeId,setStoreId]=useState("");
  const [section,setSection]=useState<Section>("overview");
  const [rows,setRows]=useState<Entry[]>([]);
  const [parties,setParties]=useState<Entry[]>([]);
  const [products,setProducts]=useState<Entry[]>([]);
  const [banks,setBanks]=useState<Entry[]>([]);
  const [report,setReport]=useState<Entry|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [lines,setLines]=useState<DocLine[]>([{...NEW_LINE}]);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editingProductId,setEditingProductId]=useState<string|null>(null);
  const [newStoreName,setNewStoreName]=useState("");
  const [showNewStore,setShowNewStore]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const currentStore=stores.find(s=>String(s.id)===storeId);
  const cashier=currentStore?.role==="cashier";
  const base="/api/dukkan/stores/"+encodeURIComponent(storeId);
  const isWriter=currentStore?.role!=="viewer";
  const canManage=currentStore?.role==="owner"||currentStore?.role==="manager";
  const canAccount=!cashier;
  const isManager=["owner","manager"].includes(String(currentStore?.role));
  const identity=useMemo(()=>new URLSearchParams(window.location.search).get("tab"),[]);

  useEffect(()=>{if(identity && SECTIONS.some(s=>s.key===identity))setSection(identity as Section);},[identity]);
  const loadStores=useCallback(async()=>{
    try {
      const list=await api("/api/dukkan/stores") as Entry[];
      setStores(list);setStoreId(previous=>list.some(s=>String(s.id)===previous)?previous:String(list[0]?.id||""));
    }catch(e){setError((e as Error).message);}
  },[]);
  useEffect(()=>{void loadStores(); void api("/api/auth/me").then(person=>setIsAdmin(["super_admin","admin"].includes(person.role))).catch(()=>{});},[loadStores]);
  const load=useCallback(async()=>{
    if(!storeId)return;
    try{
      const [p,pr,b,summary]=await Promise.all([
        api(base+"/data/parties"),api(base+"/data/products"),cashier?Promise.resolve([]):api(base+"/data/banks"),cashier?Promise.resolve(null):api(base+"/report")
      ]);
      setParties(p);setProducts(pr);setBanks(b);setReport(summary);
      if(section==="overview"&&canManage){setMembers(await api(base+"/members"));}else setMembers([]);
      const resource:Record<Section,string|null>={
        overview:"invoices",sales:"invoices",purchases:"invoices",products:"products",stock:"stock-movements",
        orders:"orders",instruments:"instruments",banks:"bank-movements",parties:"parties",reports:"cari-movements"
      };
      const result=resource[section]?await api(base+"/data/"+resource[section]):[];
      setRows(result);
      setError("");
    }catch(e){setError((e as Error).message);}
  },[base,storeId,section,cashier,canManage]);
  useEffect(()=>{void load();},[load,refresh]);
  useEffect(()=>{setDraft({});setLines([{...NEW_LINE}]);setShowForm(false);setEditingProductId(null);},[section,storeId]);

  const partyOpts=parties.map(v=>({value:String(v.id),label:v.name+" (#"+v.id+")"}));
  const productOpts=products.map(v=>({value:String(v.id),label:v.name+" · "+v.sku+" · stok "+v.stock}));
  const bankOpts=banks.map(v=>({value:String(v.id),label:v.name+" · "+currency(v.balance)}));
  const fields:Field[]=useMemo(()=>{
    const party={key:"partyId",label:"Cari Hesap",type:"select" as const,options:partyOpts,required:true};
    const product={key:"productId",label:"Ürün",type:"select" as const,options:productOpts,required:true};
    const bank={key:"bankId",label:"Banka",type:"select" as const,options:bankOpts,required:true};
    switch(section){
      case "products":return [{key:"name",label:"Ürün Adı",required:true},{key:"sku",label:"Stok Kodu",required:true},{key:"barcode",label:"Barkod"},{key:"unit",label:"Birim"},{key:"purchasePrice",label:"Alış Fiyatı",type:"number"},{key:"salePrice",label:"Satış Fiyatı",type:"number"}];
      case "parties":return [{key:"name",label:"Firma / Kişi Adı",required:true},{key:"type",label:"Cari Tipi",type:"select",options:[{value:"customer",label:"Müşteri"},{value:"supplier",label:"Tedarikçi"},{value:"both",label:"Her ikisi"}]},{key:"taxNumber",label:"Vergi Numarası"},{key:"phone",label:"Telefon"},{key:"email",label:"E-posta"}];
      case "stock":return [product,{key:"delta",label:"Stok Değişimi (+/-)",type:"number",required:true},{key:"note",label:"Açıklama"}];
      case "sales":case "purchases":return [party,{key:"date",label:"Fatura Tarihi",type:"date"},{key:"kind",label:"İşlem Türü",type:"select",options:section==="sales"?(cashier?[{value:"sale",label:"Satış faturası"}]:[{value:"sale",label:"Satış faturası"},{value:"sale_return",label:"Satış iadesi"}]):[{value:"purchase",label:"Alış faturası"},{value:"purchase_return",label:"Alış iadesi"}]}];
      case "orders":return [party,{key:"number",label:"Sipariş Numarası",required:true},{key:"kind",label:"Sipariş Tipi",type:"select",options:cashier?[{value:"sale",label:"Müşteri siparişi"}]:[{value:"sale",label:"Müşteri siparişi"},{value:"purchase",label:"Tedarikçi siparişi"}]}];
      case "instruments":return [party,{key:"kind",label:"Tür",type:"select",options:[{value:"cheque",label:"Çek"},{value:"promissory",label:"Senet"}]},{key:"direction",label:"Yön",type:"select",options:[{value:"received",label:"Alınan"},{value:"issued",label:"Verilen"}]},{key:"number",label:"Belge Numarası",required:true},{key:"amount",label:"Tutar (TL)",type:"number",required:true},{key:"dueDate",label:"Vade",type:"date",required:true},{key:"note",label:"Açıklama"}];
      case "banks":return [bank,{key:"type",label:"İşlem",type:"select",options:[{value:"deposit",label:"Para girişi"},{value:"withdrawal",label:"Para çıkışı"}]},{key:"amount",label:"Tutar (TL)",type:"number",required:true},{key:"note",label:"Açıklama"}];
      default:return [];
    }
  },[section,parties,products,banks,cashier]);

  const put=(k:string,v:string)=>setDraft(d=>({...d,[k]:v}));
  const onSubmit=async(e:FormEvent)=>{
    e.preventDefault();if(!storeId)return;
    setBusy(true);setError("");setNotice("");
    try{
      const body:Entry={...draft};
      let path="";
      if(section==="sales"||section==="purchases"){
        path="/invoices";body.kind=body.kind||(section==="sales"?"sale":"purchase");
        body.requestKey=globalThis.crypto.randomUUID();
        body.lines=lines.map(l=>({productId:Number(l.productId),quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),taxRate:Number(l.taxRate)}));
      }else if(section==="orders"){
        path="/orders";body.kind=body.kind||"sale";
        body.lines=lines.map(l=>({productId:Number(l.productId),quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),taxRate:0}));
      }else if(section==="products")path="/products";
      else if(section==="parties"){path="/parties";body.type=body.type||"customer";}
      else if(section==="stock")path="/stock-movements";
      else if(section==="instruments"){path="/instruments";body.kind=body.kind||"cheque";body.direction=body.direction||"received";}
      else if(section==="banks"){path="/bank-movements";body.type=body.type||"deposit";}
      else return;
      const editing=section==="products"&&Boolean(editingProductId);
      const saved=await api(base+path+(editing?"/"+editingProductId:""),{method:editing?"PATCH":"POST",body:JSON.stringify(body)});
      setNotice("İşlem başarıyla kaydedildi. Tüm cihazlardaki ortak veritabanına işlendi."+((section==="sales"||section==="purchases")?" Fatura numarası: "+saved.invoice_no:""));
      setEditingProductId(null);
      setShowForm(false);setDraft({});setLines([{...NEW_LINE}]);setRefresh(x=>x+1);
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const editProduct=(item:Entry)=>{
    if(!canManage)return;
    setEditingProductId(String(item.id));setShowForm(true);
    setDraft({name:String(item.name||""),sku:String(item.sku||""),barcode:String(item.barcode||""),unit:String(item.unit||"adet"),
      purchasePrice:String(item.purchase_price||0),salePrice:String(item.sale_price||0)});
    setNotice("");setError("");
  };
  const createStore=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);
    try{await api("/api/dukkan/stores",{method:"POST",body:JSON.stringify({name:newStoreName})});setNewStoreName("");setShowNewStore(false);await loadStores();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const submitSpecial=async(resource:string,payload:Entry)=>{
    setBusy(true);setError("");
    try{await api(base+"/"+resource,{method:"POST",body:JSON.stringify(payload)});setNotice("İşlem kaydedildi");setDraft({});setRefresh(n=>n+1);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const updateInstrument=async(row:Entry,status:string)=>{
    setBusy(true);try{await api(base+"/instruments/"+row.id,{method:"PATCH",body:JSON.stringify({status})});setRefresh(n=>n+1);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const updateLine=(i:number,k:keyof DocLine,v:string)=>setLines(old=>old.map((l,n)=>{
    if(n!==i)return l;
    const next={...l,[k]:v};
    if(k==="productId"){const selected=products.find(p=>String(p.id)===v);next.unitPrice=String(section==="purchases"?selected?.purchase_price||0:selected?.sale_price||0);}
    return next;
  }));
  const total=lines.reduce((sum,l)=>sum+Number(l.quantity||0)*Number(l.unitPrice||0)*(1+Number(section==="orders"?0:l.taxRate||0)/100),0);
  const displayed=rows.filter(v=>section==="sales"?["sale","sale_return"].includes(v.kind):section==="purchases"?["purchase","purchase_return"].includes(v.kind):true);
  const typeLabel:Record<string,string>={sale:"Satış",purchase:"Alış",sale_return:"Satış İadesi",purchase_return:"Alış İadesi",received:"Alınan",issued:"Verilen",pending:"Bekliyor",settled:"Tahsil/Ödendi",bounced:"Karşılıksız",cancelled:"İptal"};

  return (
    <div className="h-full min-h-screen overflow-y-auto bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-[1680px] px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {branding?.dukkan_logo?<img src={branding.dukkan_logo} alt="Çalışkan Dükkan" className="h-12 w-12 rounded-xl object-contain"/>:<div className="rounded-xl bg-slate-900 p-3 text-white"><Store size={24}/></div>}
            <div><h1 className="text-xl font-black tracking-tight sm:text-2xl">Çalışkan Dükkan</h1><p className="text-xs text-slate-500">Ön muhasebe ve mağaza yönetimi · Masaüstü / Mobil</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stores.length>0&&<select aria-label="Mağaza seç" className={inputClass} value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            <button className="rounded-lg border bg-white p-2.5" onClick={()=>setRefresh(n=>n+1)} aria-label="Yenile"><RefreshCw size={17}/></button>
            {isAdmin&&<button className="rounded-lg border bg-white px-3 py-2.5 text-xs font-semibold" onClick={()=>setShowNewStore(v=>!v)}><Plus size={15} className="inline"/> Mağaza Oluştur</button>}
          </div>
        </header>
        {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice&&<div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
        {showNewStore&&<form onSubmit={createStore} className={softCard+" mb-4 flex flex-wrap gap-2"}><input className={inputClass+" flex-1"} placeholder="Yeni mağaza adı" required value={newStoreName} onChange={e=>setNewStoreName(e.target.value)}/><button className={buttonClass} disabled={busy}>Oluştur</button></form>}
        {!storeId?<div className={softCard+" text-center"}><Building2 className="mx-auto mb-3 text-slate-400" size={34}/><h2 className="font-bold">Henüz erişilebilir mağaza yok</h2><p className="mt-2 text-sm text-slate-500">Çalışkan Admin yöneticisi mağaza oluşturup kullanıcıları mağazaya atayabilir.</p></div>:<>
          <nav aria-label="Çalışkan Dükkan modülleri" className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {SECTIONS.filter(t=>!cashier||!["purchases","instruments","banks","reports","stock","products"].includes(t.key)).map(t=><button key={t.key} onClick={()=>setSection(t.key)} className={"shrink-0 rounded-xl border px-3 py-2.5 text-sm font-semibold "+(section===t.key?"border-slate-900 bg-slate-900 text-white":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{t.label}</button>)}
          </nav>
          {canAccount&&(section==="overview"||section==="reports")&&<div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {[
              ["Net Satış",currency(report?.sales)],["Net Alış",currency(report?.purchases)],
              ["Stok Maliyeti",currency(report?.stock?.stock_cost)],["Ürün Çeşidi",fmt(report?.stock?.product_count)],
              ["Cari Net Bakiye",currency(report?.netBalance)],["Banka Bakiyesi",currency(report?.bankBalance)]
            ].map(([title,value])=><div key={title} className={softCard}><p className="text-xs text-slate-500">{title}</p><p className="mt-2 text-lg font-bold tabular-nums">{value}</p></div>)}
          </div>}
          {section==="reports"&&<div className={softCard+" mb-4"}><h2 className="font-bold">Vadesi geçmiş çek ve senetler</h2><p className="mt-2 text-sm">Belge: {fmt(report?.overdue?.count)} · Toplam: {currency(report?.overdue?.amount)}</p><p className="mt-2 text-xs text-slate-500">Raporlar kayıtlı işlemlerden üretilir; resmî mali tablo veya GİB e-Fatura yerine geçmez.</p></div>}
          {section==="overview"&&canManage&&<div className={softCard+" mb-5"}><h2 className="mb-3 font-bold">Personel ve Mağaza Yetkileri</h2><form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void submitSpecial("members",{username:draft.memberUsername,role:draft.memberRole||"cashier"});}}><input className={inputClass+" flex-1"} value={draft.memberUsername||""} onChange={e=>put("memberUsername",e.target.value)} required placeholder="Sistemde kayıtlı kullanıcı adı / e-posta"/><select className={inputClass} value={draft.memberRole||"cashier"} onChange={e=>put("memberRole",e.target.value)}><option value="cashier">Kasiyer</option><option value="accountant">Muhasebeci</option><option value="manager">Mağaza Müdürü</option><option value="viewer">Yalnızca Görüntüleme</option></select><button className={buttonClass} disabled={busy}>Yetki Ata</button></form><div className="mt-3 flex flex-wrap gap-2">{members.map(m=><span key={m.user_id} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs">{m.username} · {m.role}</span>)}</div></div>}
          <div className={softCard}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-black">{SECTIONS.find(t=>t.key===section)?.label}</h2><p className="text-xs text-slate-500">{displayed.length} kayıt · Mağaza: {currentStore?.name}</p></div>
              {isWriter&&(!cashier||["sales","orders","parties"].includes(section))&&(section!=="products"||canManage)&&!["overview","reports"].includes(section)&&<button onClick={()=>{setShowForm(v=>!v);setEditingProductId(null);setDraft({});}} className={buttonClass}><Plus size={15} className="mr-1 inline"/>{showForm?"Formu Kapat":"Yeni İşlem"}</button>}
            </div>
            {showForm&&fields.length>0&&<form onSubmit={onSubmit} className="mb-5 rounded-xl border bg-slate-50 p-4">
              <h3 className="mb-4 font-bold">{editingProductId?"Ürün bilgilerini düzenle":"Yeni kayıt oluştur"}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(f=><label key={f.key} className="block min-w-0"><span className="mb-1 block text-xs font-semibold">{f.label}</span>
                  {f.type==="select"?<select className={inputClass} required={f.required} value={draft[f.key]||""} onChange={e=>put(f.key,e.target.value)}>
                    <option value="">Seçiniz</option>{f.options?.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>:<input className={inputClass} type={f.type||"text"} step={f.type==="number"?"any":undefined} required={f.required} value={draft[f.key]||""} onChange={e=>put(f.key,e.target.value)}/>}
                </label>)}
              </div>
              {["sales","purchases"].includes(section)&&<p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">Fatura Numarası: Kaydettiğinizde sistem tarafından benzersiz 14 haneli rakam atanacaktır.</p>}
              {["sales","purchases","orders"].includes(section)&&<div className="mt-5">
                <h4 className="mb-2 text-sm font-bold">Ürün Kalemleri</h4>
                <div className="mb-1 hidden grid-cols-12 gap-2 px-3 text-xs font-bold text-slate-500 md:grid">
                  <span className="col-span-4">Ürün</span><span className="col-span-2">Miktar</span><span className="col-span-2">Birim Fiyatı (TL)</span>
                  <span className="col-span-1">KDV (%)</span><span className="col-span-2 text-right">Tutar (TL)</span><span className="col-span-1 text-center">Sil</span>
                </div>
                {lines.map((l,i)=><div className="mb-2 grid grid-cols-2 items-center gap-2 rounded-xl bg-white p-3 md:grid-cols-12" key={i}>
                  <label className="col-span-2 md:col-span-4"><span className="mb-1 block text-xs font-semibold md:hidden">Ürün</span>
                    <select aria-label="Ürün" className={inputClass} value={l.productId} required onChange={e=>updateLine(i,"productId",e.target.value)}>
                      <option value="">Ürün seç</option>{productOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Miktar</span>
                    <input aria-label="Miktar" className={inputClass} required min="0.001" step="0.001" type="number" value={l.quantity} onChange={e=>updateLine(i,"quantity",e.target.value)}/>
                  </label>
                  <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Birim Fiyatı (TL)</span>
                    <input aria-label="Birim Fiyatı (TL)" className={inputClass} required min="0" step="0.01" type="number" value={l.unitPrice} onChange={e=>updateLine(i,"unitPrice",e.target.value)}/>
                  </label>
                  <label className="md:col-span-1"><span className="mb-1 block text-xs font-semibold md:hidden">KDV (%)</span>
                    {section!=="orders"?<input aria-label="KDV (%)" className={inputClass} min="0" max="100" step="0.01" type="number" value={l.taxRate} onChange={e=>updateLine(i,"taxRate",e.target.value)}/>:<span className="text-xs text-slate-500">—</span>}
                  </label>
                  <div className="text-right md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Tutar (TL)</span>
                    <strong className="text-xs tabular-nums sm:text-sm">{currency(Number(l.quantity||0)*Number(l.unitPrice||0)*(1+Number(section==="orders"?0:l.taxRate||0)/100))}</strong>
                  </div>
                  <button type="button" className="justify-self-end rounded-lg p-2 text-red-500 md:col-span-1" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,n)=>n!==i))} aria-label="Kalemi sil"><Trash2 size={18}/></button>
                </div>)}
                <div className="mt-2 flex items-center justify-between gap-3"><button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" onClick={()=>setLines(old=>[...old,{...NEW_LINE}])}>+ Ürün satırı</button><strong className="text-sm">Toplam: {currency(total)}</strong></div>
              </div>}
              <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className={buttonClass}>{busy?"Kaydediliyor...":"Kaydet ve İşle"}</button></div>
            </form>}
            {section==="banks"&&isWriter&&<div className="mb-4 grid gap-3 md:grid-cols-2">
              <form className="rounded-xl border p-3" onSubmit={e=>{e.preventDefault();void submitSpecial("banks",{name:draft.newBank,iban:draft.newIban});}}><h3 className="mb-2 text-sm font-bold">Yeni banka hesabı</h3><input className={inputClass+" mb-2"} placeholder="Banka adı" required value={draft.newBank||""} onChange={e=>put("newBank",e.target.value)}/><input className={inputClass+" mb-2"} placeholder="IBAN (opsiyonel)" value={draft.newIban||""} onChange={e=>put("newIban",e.target.value)}/><button disabled={busy} className={buttonClass}>Banka Ekle</button></form>
              <div className="rounded-xl border p-3"><h3 className="mb-2 text-sm font-bold">Banka bakiyeleri</h3>{banks.map(b=><p key={b.id} className="flex justify-between border-b py-2 text-sm"><span>{b.name}</span><strong>{currency(b.balance)}</strong></p>)}</div>
            </div>}
            {section==="parties"&&isWriter&&<form className="mb-4 grid gap-2 rounded-xl border p-3 sm:grid-cols-5" onSubmit={e=>{e.preventDefault();void submitSpecial("payments",{partyId:Number(draft.paymentParty),direction:draft.paymentDirection||"collection",method:draft.paymentMethod||"cash",bankId:draft.paymentMethod==="bank"?Number(draft.paymentBank):undefined,amount:Number(draft.paymentAmount),note:draft.paymentNote||""});}}>
              <h3 className="sm:col-span-5 text-sm font-bold">Tahsilat / Ödeme İşlemi</h3>
              <select required className={inputClass} value={draft.paymentParty||""} onChange={e=>put("paymentParty",e.target.value)}><option value="">Cari seç</option>{partyOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
              <select className={inputClass} value={draft.paymentDirection||"collection"} onChange={e=>put("paymentDirection",e.target.value)}><option value="collection">Tahsilat</option><option value="payment">Ödeme</option></select>
              <select className={inputClass} value={draft.paymentMethod||"cash"} onChange={e=>put("paymentMethod",e.target.value)}><option value="cash">Nakit</option><option value="bank">Banka</option></select>
              {draft.paymentMethod==="bank"?<select required className={inputClass} value={draft.paymentBank||""} onChange={e=>put("paymentBank",e.target.value)}><option value="">Banka seç</option>{bankOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input className={inputClass} type="number" min="0.01" step="0.01" required placeholder="Tutar" value={draft.paymentAmount||""} onChange={e=>put("paymentAmount",e.target.value)}/>}
              {draft.paymentMethod==="bank"&&<input className={inputClass} type="number" min="0.01" step="0.01" required placeholder="Tutar" value={draft.paymentAmount||""} onChange={e=>put("paymentAmount",e.target.value)}/>}
              <button disabled={busy} className={buttonClass}>İşle</button>
            </form>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                  {(section==="products"?["Stok Kodu","Ürün","Barkod","Miktar","Alış","Satış"]:
                    section==="parties"?["Cari Adı","Türü","Telefon","Bakiye"]:
                    section==="stock"?["Tarih","Ürün","Değişim","Neden"]:
                    ["sales","purchases","overview"].includes(section)?["Fatura No","Cari","Tür","Toplam","Tarih"]:
                    section==="orders"?["Sipariş No","Cari","Tür","Durum"]:
                    section==="instruments"?["Belge No","Cari","Tür","Tutar","Vade","Durum"]:
                    section==="banks"?["Tarih","Banka","İşlem","Tutar"]:
                    ["Tarih","Cari","Borç","Alacak","Açıklama"]).map(h=><th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
                  {(section==="instruments"||(section==="products"&&canManage))&&<th className="px-3 py-3">İşlem</th>}
                </tr></thead>
                <tbody>{displayed.map(r=><tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {(section==="products"?[r.sku,r.name,r.barcode,r.stock,currency(r.purchase_price),currency(r.sale_price)]:
                    section==="parties"?[r.name,r.type,r.phone,currency(r.balance)]:
                    section==="stock"?[String(r.created_at).slice(0,10),r.product_name,r.delta,r.reason]:
                    ["sales","purchases","overview"].includes(section)?[r.invoice_no,r.party_name,typeLabel[r.kind]||r.kind,currency(r.grand_total),r.issued_at?.slice(0,10)]:
                    section==="orders"?[r.order_no,r.party_name,typeLabel[r.kind]||r.kind,r.status]:
                    section==="instruments"?[r.document_no,r.party_name,(r.kind==="cheque"?"Çek":"Senet")+" · "+(typeLabel[r.direction]||""),currency(r.amount),r.due_date?.slice(0,10),typeLabel[r.status]||r.status]:
                    section==="banks"?[String(r.created_at).slice(0,10),r.bank_name,r.type,currency(r.amount)]:
                    [String(r.created_at).slice(0,10),r.party_name,currency(r.debit),currency(r.credit),r.description]).map((v,i)=><td key={i} className="whitespace-nowrap px-3 py-3">{fmt(v)}</td>)}
                  {section==="instruments"&&<td className="px-3 py-3">{r.status==="pending"&&isWriter?<select className="rounded-md border p-1 text-xs" defaultValue="" onChange={e=>void updateInstrument(r,e.target.value)}><option value="" disabled>Durum değiştir</option><option value="settled">Tahsil/Ödendi</option><option value="bounced">Karşılıksız</option><option value="cancelled">İptal</option></select>:null}</td>}
                </tr>)}</tbody>
              </table>
              {displayed.length===0&&<p className="py-10 text-center text-sm text-slate-500">Henüz kayıt bulunmuyor.</p>}
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">Çalışkan Dükkan · Veriler PostgreSQL üzerinde merkezi tutulur. E-Fatura/e-Arşiv gönderimi ayrıca entegrasyon gerektirir.</p>
        </>}
      </div>
    </div>
  );
}
