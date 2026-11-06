import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {useLocation} from "wouter";
import {ArrowLeft,CheckCircle2,Copy,Download,FileText,Pencil,Plus,Save,Trash2,AlertTriangle} from "lucide-react";

type Entry=Record<string,any>;
type DocumentData={invoice:Entry;lines:Entry[];importedArchive?:boolean;disclaimer?:string;officialInvoice?:false};
type InvoiceLine={
  productId:string;productName:string;quantity:string;unitPrice:string;
  taxRate:string;unit:string;lineTotal:string;
};
type Mode="view"|"edit"|"copy"|"delete";
const blank=():InvoiceLine=>({productId:"",productName:"",quantity:"1",unitPrice:"0",taxRate:"20",unit:"adet",lineTotal:"0"});
const money=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const field="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const btn="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-[#122a51] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#254b83] disabled:opacity-50";
async function api(path:string,init?:RequestInit){
  const response=await fetch(path,{credentials:"include",cache:"no-store",...init,
    headers:{"Content-Type":"application/json",...(init?.headers||{})}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||"Fatura işlemi tamamlanamadı.");
  return result;
}
const str=(value:unknown)=>String(value??"");
const number=(value:string)=>Number(value||0);
const validMode=(raw:string|null):Mode=>raw==="edit"||raw==="copy"||raw==="delete"?raw:"view";

/** Deep-linked sales invoice view/editor for posted and imported statement records. */
export default function DukkanSalesInvoiceEdit({id}:{id:string}){
  const [,navigate]=useLocation();
  const params=new URLSearchParams(window.location.search);
  const storeId=params.get("storeId")||"";
  const archived=/^archive-[1-9]\d*$/.test(id);
  const numericId=archived?id.slice(8):id;
  const [mode,setMode]=useState<Mode>(()=>validMode(params.get("mode")));
  const [details,setDetails]=useState<DocumentData|null>(null);
  const [products,setProducts]=useState<Entry[]>([]);
  const [parties,setParties]=useState<Entry[]>([]);
  const [role,setRole]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [partyId,setPartyId]=useState("");
  const [date,setDate]=useState("");
  const [amount,setAmount]=useState("");
  const [description,setDescription]=useState("");
  const [lines,setLines]=useState<InvoiceLine[]>([]);
  const [stockCodeMappings,setStockCodeMappings]=useState<Record<string,string>>({});
  const [taxReviewed,setTaxReviewed]=useState(false);
  const base="/api/dukkan/stores/"+encodeURIComponent(storeId);
  const canWrite=role!==""&&role!=="viewer";
  const canEdit=["owner","manager","accountant"].includes(role);
  const canCopy=canWrite;
  const archivePath=base+"/invoices/archived/"+encodeURIComponent(numericId);
  const standardPath=base+"/invoices/"+encodeURIComponent(numericId);
  const pdfPath=(archived?archivePath:standardPath)+"/pdf-data";
  const back=()=>navigate("/dukkan?tab=sales&storeId="+encodeURIComponent(storeId));
  const urlFor=(value:Mode)=>"/dukkan/faturalar/"+encodeURIComponent(id)+"?storeId="+encodeURIComponent(storeId)+"&mode="+value;
  const switchMode=(value:Mode)=>{
    setMode(value);setError("");setNotice("");setTaxReviewed(false);
    if(details)fromDoc(details,products,value);
    navigate(urlFor(value));
  };
  const fromDoc=useCallback((doc:DocumentData,productRows:Entry[],target:Mode)=>{
    const inv=doc.invoice;
    setPartyId(str(inv.party_id));
    const now=new Date();
    const localToday=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
    setDate(target==="copy"?localToday:str(inv.issued_at).slice(0,10));
    setAmount(str(inv.grand_total));
    setDescription(str(inv.source_description||""));
    setTaxReviewed(false);
    const normalized=(v:unknown)=>str(v).trim().toLocaleLowerCase("tr-TR");
    setStockCodeMappings(Object.fromEntries(doc.lines.map(row=>[str(row.id),str(row.product_id||"")])));
    const converted=doc.lines.map(row=>{
      const prod=doc.importedArchive?productRows.filter(p=>normalized(p.name)===normalized(row.product_name)):productRows.filter(p=>str(p.id)===str(row.product_id));
      const productId=doc.importedArchive&&row.product_id?str(row.product_id):prod.length===1?str(prod[0].id):"";
      return {
        productId,productName:str(row.product_name),quantity:str(row.quantity),
        unitPrice:str(row.unit_price),taxRate:doc.importedArchive?"0":str(row.tax_rate??20),
        unit:str(row.unit||"adet"),lineTotal:str(row.line_total)
      };
    });
    setLines(converted.length?converted:doc.importedArchive&&target==="edit"?[]:[blank()]);
  },[]);
  const load=useCallback(async()=>{
    if(!storeId||!/^\d+$/.test(numericId)){setError("Geçerli mağaza ve fatura numarası gerekli.");setLoading(false);return;}
    setLoading(true);setError("");
    try{
      const [doc,productRows,partyRows,stores]=await Promise.all([
        api(pdfPath),api(base+"/data/products?includeArchived=1"),api(base+"/data/parties"),api("/api/dukkan/stores")
      ]);
      const store=Array.isArray(stores)?stores.find((s:Entry)=>str(s.id)===storeId):null;
      if(!store)throw Error("Bu mağazaya erişim izniniz bulunmuyor.");
      setRole(str(store.role));setDetails(doc);
      setProducts(Array.isArray(productRows)?productRows:[]);
      setParties(Array.isArray(partyRows)?partyRows:[]);
      fromDoc(doc,Array.isArray(productRows)?productRows:[],mode);
    }catch(e){setError((e as Error).message);}
    finally{setLoading(false);}
  },[storeId,numericId,pdfPath,base,fromDoc]);
  useEffect(()=>{void load();},[load]);
  const current=details?.invoice||{};
  const readOnly=mode==="view"||mode==="delete";
  const isArchiveEdit=archived&&mode==="edit";
  const itemTotal=(line:InvoiceLine)=>Number(line.quantity||0)*Number(line.unitPrice||0)*(1+Number(line.taxRate||0)/100);
  const total=useMemo(()=>lines.reduce((sum,l)=>sum+itemTotal(l),0),[lines]);
  const changeLine=(index:number,key:keyof InvoiceLine,value:string)=>{
    setLines(rows=>rows.map((row,i)=>{
      if(i!==index)return row;
      const changed={...row,[key]:value};
      if(key==="productId"){
        const product=products.find(p=>str(p.id)===value);
        if(product){
          changed.productName=str(product.name);
          changed.unit=str(product.unit||"adet");
          if(mode==="copy")changed.unitPrice=str(product.sale_price||0);
        }
      }
      if(isArchiveEdit&&key==="productName")changed.productId="";
      if(isArchiveEdit&&(key==="quantity"||key==="unitPrice")){
        changed.lineTotal=(Math.round(number(changed.quantity)*number(changed.unitPrice)*100)/100).toFixed(2);
      }
      return changed;
    }));
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!details||busy||!canWrite)return;
    if(mode==="edit"&&!canEdit)return;
    if(archived&&mode==="copy"&&!taxReviewed){setError("Arşiv kaynaklı belgede KDV bilgisi kesin değil. Kaydetmeden önce oranları kontrol edip onaylayın.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      let saved:Entry;
      if(isArchiveEdit){
        saved=await api(archivePath,{method:"PATCH",body:JSON.stringify({
          expectedRevision:Number(current.revision),date,amount:Number(amount),description,
          lines:lines.filter(l=>l.productName.trim()).map(l=>({
            productName:l.productName.trim(),quantity:number(l.quantity),unit:l.unit.trim(),
            unitPrice:number(l.unitPrice),lineTotal:number(l.lineTotal),
            productId:l.productId?Number(l.productId):null
          }))
        })});
      }else{
        const submitLines=lines.map(l=>({
          productId:Number(l.productId),quantity:number(l.quantity),
          unitPrice:number(l.unitPrice),taxRate:number(l.taxRate)
        }));
        if(submitLines.some(l=>!l.productId))throw Error("Her ürün için stoktaki karşılığını seçin. Kaynağı eşleşmeyen arşiv ürünlerini kontrol edin.");
        const payload:Entry={partyId:Number(partyId),kind:str(current.kind),
          date,lines:submitLines};
        if(mode==="edit")payload.expectedRevision=Number(current.revision);
        else payload.requestKey=crypto.randomUUID();
        saved=await api(mode==="edit"?standardPath:base+"/invoices",{
          method:mode==="edit"?"PATCH":"POST",body:JSON.stringify(payload)
        });
      }
      if(mode==="copy"){
        navigate("/dukkan/faturalar/"+encodeURIComponent(str(saved.id))+"?storeId="+encodeURIComponent(storeId)+"&mode=view");
      }else{
        setMode("view");
        navigate(urlFor("view"));
        await load();
        setNotice("Fatura değişiklikleri kaydedildi.");
      }
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const saveStockCodeMappings=async()=>{
    if(!details||!archived||!canEdit||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      await api(archivePath+"/stock-codes",{
        method:"PATCH",body:JSON.stringify({
          expectedRevision:Number(current.revision),
          mappings:details.lines.map(line=>({
            lineId:Number(line.id),
            productId:stockCodeMappings[str(line.id)]?Number(stockCodeMappings[str(line.id)]):null
          }))
        })
      });
      await load();
      setNotice("Stok kodu eşleştirmeleri kaydedildi. Yeni PDF ve yazdırma çıktısında görünecek.");
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!canEdit||!details||busy)return;
    if(!window.confirm("Belge "+current.invoice_no+" silinsin mi? Cari etkisi geri alınacak, işlemin denetim kaydı korunacaktır."))return;
    setBusy(true);setError("");
    try{
      await api(archived?archivePath:standardPath,{
        method:"DELETE",body:JSON.stringify({expectedRevision:Number(current.revision)})
      });
      back();
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const exportPdf=async(print:boolean)=>{
    if(!details)return;
    const win=print?window.open("","_blank"):null;
    try{
      const module=await import("@/lib/dukkan-invoice-pdf");
      const fresh=await api(pdfPath);
      if(print)module.showDukkanInvoicePrint(module.renderDukkanInvoicePdf(fresh),win);
      else await module.exportDukkanInvoicePdf(fresh);
    }catch(e){win?.close();setError("PDF oluşturulamadı: "+(e as Error).message);}
  };
  const viewLine=(l:InvoiceLine,i:number)=>(
    <tr key={i} className="border-b border-slate-100">
      <td className="px-3 py-3 font-medium">{l.productName||"—"}</td>
      <td className="px-3 py-3">{str(details?.lines[i]?.sku)||"—"}</td>
      <td className="px-3 py-3 text-right">{l.quantity}</td>
      <td className="px-3 py-3 text-right">{money(l.unitPrice)}</td>
      <td className="px-3 py-3 text-right">{archived?"Bilinmiyor":"%"+l.taxRate}</td>
      <td className="px-3 py-3 text-right font-semibold">{money(l.lineTotal)}</td>
    </tr>
  );
  return <div className="mx-auto h-full min-h-0 max-w-[1300px] overflow-y-auto p-4 pb-20 text-[#172945] sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={btn} onClick={back}><ArrowLeft size={17}/> Satış Faturalarına Dön</button>
      {details&&<div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={()=>void exportPdf(false)}><Download size={16}/> PDF İndir</button>
        <button type="button" className={btn} onClick={()=>void exportPdf(true)}><FileText size={16}/> Yazdır</button>
      </div>}
    </div>
    {loading?<div role="status" className="rounded-xl border bg-white p-8 text-sm">Fatura yükleniyor...</div>:!details?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-red-800">{error||"Fatura bulunamadı."}</div>:<>
      <div className="mb-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-sky-700">Çalışkan Dükkan · Satış Faturası</p>
            <h1 className="mt-1 text-2xl font-black">Fatura {current.invoice_no}</h1>
            <p className="mt-1 text-sm text-slate-500">{current.party_name} · {str(current.issued_at).slice(0,10)}</p></div>
          <div className="text-right"><div className="text-xs text-slate-500">Fatura tutarı</div><div className="text-xl font-black">{money(current.grand_total)}</div></div>
        </div>
        {archived&&<div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertTriangle size={18} className="shrink-0"/>
          <span>Bu kayıt cari ekstresinden aktarılmış bir arşiv belgesidir. Ürün stoklarına işlememiştir. Düzenleme ve silme mevcut cari kaydı etkiler; kaynak dosya geçmişi denetim için korunur. KDV bilgileri kaynaktan doğrulanamayabilir.</span>
        </div>}
        <p className="mt-3 text-xs text-slate-500">{details.disclaimer||"Dahili ön muhasebe belgesidir, resmî e-Fatura değildir."}</p>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button className={btn} type="button" onClick={()=>switchMode("view")}>Görüntüle</button>
        {canEdit&&<button className={btn} type="button" onClick={()=>switchMode("edit")}><Pencil size={15}/> Düzenle</button>}
        {canCopy&&<button className={btn} type="button" onClick={()=>switchMode("copy")}><Copy size={15}/> Kopyala</button>}
        {canEdit&&<button className={btn+" border-rose-200 text-rose-700"} type="button" onClick={()=>switchMode("delete")}><Trash2 size={15}/> Sil</button>}
      </div>
      {error&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
      {notice&&<p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17}/>{notice}</p>}
      {mode==="delete"?<section className="max-w-2xl rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="text-xl font-black text-red-800">Faturayı sil</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Bu işlem faturayı aktif listeden kaldırır ve cari üzerindeki etkisini geri alır. Normal satış faturalarında stok etkisi de geri alınır. Denetim geçmişi saklanır.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btn} onClick={()=>switchMode("view")}>Vazgeç</button>
          {canEdit&&<button className={primary+" bg-red-700 hover:bg-red-800"} disabled={busy} onClick={()=>void remove()}><Trash2 size={16}/>{busy?"İşleniyor":"Silmeyi Onayla"}</button>}
        </div>
      </section>:readOnly?<section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div><div className="text-xs text-slate-500">Cari hesap</div><strong>{current.party_name}</strong></div>
          <div><div className="text-xs text-slate-500">Tarih</div><strong>{str(current.issued_at).slice(0,10)}</strong></div>
          <div><div className="text-xs text-slate-500">İşlem türü</div><strong>{current.kind==="sale_return"?"Satış İadesi":"Satış"}</strong></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>
          {["Ürün","Stok Kodu","Miktar","Birim Fiyat","KDV","Tutar"].map(x=><th key={x} className="px-3 py-3">{x}</th>)}
        </tr></thead><tbody>{details.lines.length?lines.map(viewLine):<tr><td colSpan={6} className="p-6 text-center text-slate-500">Kaynak belgede ürün satırı bulunmuyor.</td></tr>}</tbody></table></div>
      </section>        {archived&&details.lines.length>0&&<section className="mt-5 rounded-2xl border border-sky-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black">Arşiv ürünlerinin stok kodları</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Ürün adı mağaza kataloğunda tek bir kayıtla eşleşirse stok kodu otomatik gösterilir.
                Eşleşmeyenleri aşağıdan stok kaydına bağlayın; PDF ve yazdırma şablonu bu kodları kullanır.
              </p>
            </div>
            {canEdit&&<button className={primary} type="button" disabled={busy} onClick={()=>void saveStockCodeMappings()}>
              <Save size={15}/>{busy?"Kaydediliyor...":"Stok Kodlarını Kaydet"}
            </button>}
          </div>
          <div className="grid gap-2">
            {details.lines.map((line:Entry,index:number)=><label key={str(line.id)} className="grid items-center gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <span className="min-w-0 text-xs font-semibold">{index+1}. {line.product_name}
                <span className="mt-1 block font-normal text-slate-500">Mevcut kod: {line.sku||"Eşleştirilmedi"}</span>
              </span>
              <select className={field} disabled={!canEdit||busy}
                value={stockCodeMappings[str(line.id)]||""}
                onChange={event=>setStockCodeMappings(current=>({...current,[str(line.id)]:event.target.value}))}
                aria-label={str(line.product_name)+" stok kodu eşleştirmesi"}>
                <option value="">Stok kodu bulunamadı / eşleştirme yok</option>
                {products.map(product=><option key={str(product.id)} value={str(product.id)}>
                  {str(product.sku)} · {str(product.name)}
                </option>)}
              </select>
            </label>)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Bu eşleştirme yalnız ürün kodunu bağlar. Cari bakiye, stok adedi ve fiyat değiştirilmez.</p>
        </section>}
:<form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-black">{mode==="copy"?"Yeni fatura taslağı":"Faturayı düzenle"}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-semibold">Cari hesap
              <select className={field+" mt-1"} required disabled={isArchiveEdit} value={partyId} onChange={e=>setPartyId(e.target.value)}>
                <option value="">Cari seçin</option>{parties.map(p=><option value={str(p.id)} key={str(p.id)}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold">Fatura tarihi
              <input className={field+" mt-1"} type="date" required value={date} onChange={e=>setDate(e.target.value)}/>
            </label>
            <div className="flex flex-col justify-end gap-1 text-xs"><span className="font-semibold">Belge numarası</span><span className="rounded-xl bg-slate-50 p-3">{mode==="copy"?"Kaydetme sırasında yeni numara oluşturulur":current.invoice_no}</span></div>
          </div>
          {isArchiveEdit&&<div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold">Cari ekstresindeki toplam tutar (TL)
              <input className={field+" mt-1"} required type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </label>
            <label className="text-xs font-semibold">Açıklama
              <input className={field+" mt-1"} maxLength={800} value={description} onChange={e=>setDescription(e.target.value)}/>
            </label>
          </div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-black">Fatura Ürün Kalemleri</h2>
            <button type="button" className={btn} onClick={()=>setLines(v=>[...v,blank()])} disabled={lines.length>=200}><Plus size={15}/> Satır Ekle</button>
          </div>
          <div className="space-y-3">{lines.map((line,index)=><div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-12" key={index}>
            {isArchiveEdit?
              <label className="text-xs font-semibold md:col-span-4">Ürün adı
                <input className={field+" mt-1"} value={line.productName} required onChange={e=>changeLine(index,"productName",e.target.value)}/>
              </label>:
              <label className="text-xs font-semibold md:col-span-4">Stoktan ürün seçimi
                <select className={field+" mt-1"} required value={line.productId} onChange={e=>changeLine(index,"productId",e.target.value)}>
                  <option value="">Ürün seçin</option>{products.map(p=><option key={str(p.id)} value={str(p.id)}>{p.sku} · {p.name}</option>)}
                </select>
                {archived&&line.productName&&<span className="mt-1 block text-[11px] text-amber-800">Kaynak: {line.productName}</span>}
              </label>}
            <label className="text-xs font-semibold md:col-span-2">Miktar
              <input className={field+" mt-1"} type="number" min="0.001" step="0.001" required value={line.quantity} onChange={e=>changeLine(index,"quantity",e.target.value)}/>
            </label>
            <label className="text-xs font-semibold md:col-span-2">Birim fiyat (TL)
              <input className={field+" mt-1"} type="number" min="0" step="0.01" required value={line.unitPrice} onChange={e=>changeLine(index,"unitPrice",e.target.value)}/>
            </label>
            {isArchiveEdit?
              <label className="text-xs font-semibold md:col-span-2">Tutar (TL)
                <input className={field+" mt-1"} type="number" min="0" step="0.01" required value={line.lineTotal} onChange={e=>changeLine(index,"lineTotal",e.target.value)}/>
              </label>:
              <label className="text-xs font-semibold md:col-span-2">KDV (%)
                <input className={field+" mt-1"} type="number" min="0" max="100" step="0.01" required value={line.taxRate} onChange={e=>changeLine(index,"taxRate",e.target.value)}/>
              </label>}
            <div className="flex items-end justify-end md:col-span-2">
              <button className={btn+" text-red-700"} type="button" disabled={lines.length<=1&&!isArchiveEdit} onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}><Trash2 size={15}/> Kaldır</button>
            </div>
          </div>)}</div>
          {!isArchiveEdit&&<p className="mt-4 text-right text-lg font-black">Toplam: {money(total)}</p>}
          {isArchiveEdit&&<p className="mt-3 text-xs text-slate-500">Ürün satırları bilgi amaçlıdır. Arşiv tutarı cari ekstredeki tutar alanından güncellenir; stok ve KDV kaydı oluşturulmaz.</p>}
        </section>
        {mode==="copy"&&archived&&<label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <input className="mt-1" type="checkbox" checked={taxReviewed} onChange={e=>setTaxReviewed(e.target.checked)}/>
          <span>Arşiv belgesinde KDV doğrulanamadığından taslakta %0 gösterilir. Ürün eşleştirmelerini, fiyatları ve doğru KDV oranlarını kontrol ettim.</span>
        </label>}
        <div className="flex flex-wrap justify-end gap-3">
          <button className={btn} type="button" onClick={()=>switchMode("view")}>Vazgeç</button>
          <button className={primary} disabled={busy||!canWrite||(mode==="edit"&&!canEdit)} type="submit"><Save size={16}/>{busy?"Kaydediliyor...":mode==="copy"?"Yeni Fatura Oluştur":"Değişiklikleri Kaydet"}</button>
        </div>
      </form>}
    </>}
  </div>;
}
