import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Download, FileDown, FileText, Landmark, Loader2, Printer, ReceiptText, Trash2, Wallet, X } from "lucide-react";

type Party = {
  id: string | number; name: string; type?: string;
  source_cari_no?: string | null; account_code?: string | null;
  balance?: string | number; phone?: string | null;
};
type Bank = { id: string | number; name: string };
type InvoiceLine = {
  product_name: string; sku: string; unit: string;
  quantity: string | number; unit_price: string | number;
  tax_rate: string | number; line_total: string | number;
};
type StatementEntry = {
  id: string | number; created_at: string; document_date: string;
  description: string; debit: string | number; credit: string | number;
  running_balance: string | number; invoice_no?: string | null;
  invoice_kind?: string | null; payment_direction?: string | null;
  payment_method?: string | null; document_no?: string | null;
  invoice_lines?: InvoiceLine[];
};
type Statement = { party: Party; storeName: string; mode: "standard" | "detailed"; entries: StatementEntry[] };
type View = "menu" | "statement-select" | "statement" | "collection" | "payment" | "opening" | "delete";
type PaymentMethod = "cash" | "bank" | "card" | "cheque" | "promissory" | "other";
const formatMoney = (v: unknown) => Number(v || 0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2});
const money = (v: unknown) => formatMoney(v) + " ₺";
const today = () => new Date().toLocaleDateString("sv-SE");
const inputStyle = "w-full rounded-xl border border-[#d9e4f1] bg-white px-3.5 py-3 text-sm text-[#142b4e] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const primaryStyle = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#122a51] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#214b84] disabled:opacity-45";
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch] || ch));
const dateText = (v: string) => {
  const first=String(v||"").slice(0,10);
  const [year,month,day]=first.split("-");
  return year&&month&&day?day+"."+month+"."+year:first;
};
const entryLabel = (entry: StatementEntry) => {
  const names:Record<string,string> = {
    sale:"Satış Faturası",purchase:"Alış Faturası",
    sale_return:"Satış İadesi",purchase_return:"Alış İadesi"
  };
  return entry.invoice_kind?names[entry.invoice_kind]||"Fatura":
    entry.payment_direction==="collection"?"Tahsilat":
    entry.payment_direction==="payment"?"Ödeme":
    entry.description?.toLocaleLowerCase("tr-TR").includes("açılış")?"Açılış Bakiyesi":"Cari Hareket";
};
async function jsonRequest(path: string, options?: RequestInit) {
  const response=await fetch(path,{
    credentials:"include",cache:"no-store",...options,
    headers:{"Content-Type":"application/json",...(options?.headers||{})}
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"İşlem gerçekleştirilemedi.");
  return body;
}
async function fetchWholeStatement(base: string,partyId:string,mode:"standard"|"detailed"): Promise<Statement> {
  let offset=0;
  const entries:StatementEntry[]=[];
  let party:Party|null=null;
  let storeName="Çalışkan Dükkan";
  // Server returns an ordered 250-row page and computes running balances across
  // the full ledger before pagination, avoiding skipped balances or date gaps.
  for(;;) {
    const data=await jsonRequest(base+"/parties/"+encodeURIComponent(partyId)+
      "/statement?mode="+mode+"&offset="+offset) as Statement & {nextOffset:number|null};
    party=data.party;storeName=data.storeName;
    entries.push(...data.entries);
    if(data.nextOffset===null)break;
    if(data.nextOffset<=offset)throw new Error("Ekstre sayfalandırması tamamlanamadı.");
    offset=data.nextOffset;
  }
  return {party:party!,storeName,mode,entries};
}
function StatementTable({statement}:{statement:Statement}) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="min-w-[720px] w-full border-collapse text-left text-[12px]">
      <thead className="bg-[#eaf0fa] text-[#375476]"><tr>
        {["Tarih","İşlem","Belge No","Açıklama","Borç","Alacak","Bakiye"].map(label=>
          <th key={label} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-bold">{label}</th>)}
      </tr></thead>
      <tbody>{statement.entries.map(item=><tr key={String(item.id)} className="align-top border-t border-[#e8edf5]">
        <td className="whitespace-nowrap px-3 py-3">{dateText(item.document_date)}</td>
        <td className="whitespace-nowrap px-3 py-3">{entryLabel(item)}</td>
        <td className="px-3 py-3">{item.invoice_no||item.document_no||"—"}</td>
        <td className="min-w-40 px-3 py-3">{item.description||"—"}
          {statement.mode==="detailed"&&item.invoice_lines?.length?
            <div className="mt-2 space-y-1 rounded-lg bg-[#f5f8fc] p-2 text-[11px] text-slate-600">
              {item.invoice_lines.map((line,index)=><div key={index} className="border-b border-slate-200 pb-1 last:border-0 last:pb-0">
                <span className="font-bold text-slate-700">{line.product_name} ({line.sku})</span>
                <span className="block">{line.quantity} {line.unit} × {money(line.unit_price)} · KDV %{line.tax_rate} · {money(line.line_total)}</span>
              </div>)}
            </div>:null}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(item.debit)}</td>
        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(item.credit)}</td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{money(item.running_balance)}</td>
      </tr>)}</tbody>
    </table>
    {!statement.entries.length&&<div className="p-8 text-center text-sm text-slate-500">Bu cari hesap için henüz işlem yok.</div>}
  </div>;
}
function statementPageHtml(statement:Statement,items:StatementEntry[],index:number,pages:number){
  const total=statement.entries.length;
  const ending=statement.entries[total-1]?.running_balance||0;
  const rows=items.map(entry=>{
    const details=statement.mode==="detailed"&&entry.invoice_lines?.length?
      "<div style='margin-top:5px;padding:5px;background:#f3f6fa;font-size:10px'>"+
      entry.invoice_lines.map(line=>"<div>"+escapeHtml(line.product_name)+" ("+escapeHtml(line.sku)+") "+
        escapeHtml(line.quantity)+" "+escapeHtml(line.unit)+" x "+formatMoney(line.unit_price)+
        " TL · KDV %"+escapeHtml(line.tax_rate)+" · "+formatMoney(line.line_total)+" TL</div>").join("")+
      "</div>":"";
    const continued=(entry as StatementEntry & {_continuation?:boolean})._continuation===true;
    return "<tr>"+
      "<td>"+escapeHtml(dateText(entry.document_date))+"</td>"+
      "<td>"+escapeHtml(continued?"Fatura Devamı":entryLabel(entry))+"</td>"+
      "<td>"+escapeHtml(entry.invoice_no||entry.document_no||"—")+"</td>"+
      "<td>"+escapeHtml(entry.description||"—")+details+"</td>"+
      "<td class='num'>"+(continued?"—":formatMoney(entry.debit))+"</td>"+
      "<td class='num'>"+(continued?"—":formatMoney(entry.credit))+"</td>"+
      "<td class='num bold'>"+(continued?"—":formatMoney(entry.running_balance))+"</td></tr>";
  }).join("");
  return "<div style='box-sizing:border-box;width:794px;height:1122px;padding:42px 40px;background:#fff;color:#142b4e;font-family:Arial,Helvetica,sans-serif;position:relative'>"+
    "<div style='background:#152a4f;color:#fff;padding:17px 19px;border-radius:10px'>"+
    "<div style='font-weight:800;font-size:18px'>ÇALIŞKAN DÜKKAN · "+(statement.mode==="detailed"?"DETAYLI":"STANDART")+" CARİ EKSTRE</div>"+
    "<div style='font-size:12px;margin-top:5px'>"+escapeHtml(statement.storeName)+"</div></div>"+
    "<div style='display:flex;justify-content:space-between;padding:18px 0 20px;font-size:12px'>"+
    "<div><b>"+escapeHtml(statement.party.name)+"</b><div>Cari No: "+escapeHtml(statement.party.source_cari_no||"—")+
    " · Hesap Kodu: "+escapeHtml(statement.party.account_code||"—")+"</div></div>"+
    "<div style='text-align:right'><div>Rapor: "+dateText(today())+"</div>"+
    "<b>Son bakiye: "+formatMoney(ending)+" TL</b></div></div>"+
    "<table style='width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed'>"+
    "<colgroup><col style='width:69px'><col style='width:84px'><col style='width:82px'><col style='width:235px'>"+
    "<col style='width:72px'><col style='width:72px'><col style='width:85px'></colgroup>"+
    "<thead><tr style='background:#eef3fa'>"+
    ["Tarih","İşlem","Belge No","Açıklama","Borç","Alacak","Bakiye"].map(v=>
      "<th style='padding:8px 5px;text-align:left;border-bottom:1px solid #d2dce9'>"+v+"</th>").join("")+"</tr></thead>"+
    "<tbody>"+rows+"</tbody></table>"+
    "<div style='position:absolute;left:40px;right:40px;bottom:27px;border-top:1px solid #e1e7ef;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#64748b'>"+
    "<span>Toplam "+total+" hareket · İşyeri içi ön muhasebe ekstresi</span>"+
    "<span>Sayfa "+(index+1)+" / "+pages+"</span></div></div>";
}
async function saveStatementPdf(statement:Statement){
  const [{default:html2canvas},{jsPDF}]=await Promise.all([
    import("html2canvas"),import("jspdf")
  ]);
  // Fragment unusually long invoice detail into separate continuation pages:
  // every product line remains in the PDF, without duplicating financial totals.
  const printable: Array<StatementEntry & {_continuation?:boolean}>=[];
  for(const entry of statement.entries){
    if(statement.mode!=="detailed"||!entry.invoice_lines||entry.invoice_lines.length<=10){
      printable.push(entry);continue;
    }
    for(let index=0;index<entry.invoice_lines.length;index+=10){
      const continuation=index>0;
      printable.push({
        ...entry,
        description:continuation?"Fatura ürün kalemleri (devam)":entry.description,
        invoice_lines:entry.invoice_lines.slice(index,index+10),
        _continuation:continuation
      });
    }
  }
  const chunks:StatementEntry[][]=[];
  let current:StatementEntry[]=[],units=0;
  const capacity=statement.mode==="detailed"?13:20;
  for(const entry of printable){
    const unitsForEntry=1+(entry.invoice_lines?.length||0)*0.85+
      Math.min(3,Math.floor((entry.description||"").length/90))*0.5;
    if(current.length&&units+unitsForEntry>capacity){
      chunks.push(current);current=[];units=0;
    }
    current.push(entry);units+=unitsForEntry;
  }
  if(current.length||!chunks.length)chunks.push(current);
  const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  for(let index=0;index<chunks.length;index++){
    const element=document.createElement("div");
    element.style.cssText="position:fixed;top:0;left:0;width:794px;height:1122px;background:white;z-index:-1;pointer-events:none";
    element.innerHTML=statementPageHtml(statement,chunks[index],index,chunks.length);
    const style=document.createElement("style");
    style.textContent="td{padding:7px 5px;border-bottom:1px solid #e6ebf2;vertical-align:top;overflow-wrap:anywhere}.num{text-align:right;font-variant-numeric:tabular-nums}.bold{font-weight:700}";
    element.appendChild(style);
    document.body.appendChild(element);
    try{
      const canvas=await html2canvas(element,{scale:2,backgroundColor:"#ffffff",logging:false,useCORS:false,
        windowWidth:Math.max(window.innerWidth,1000)});
      if(index)pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg",0.88),"JPEG",0,0,210,297,undefined,"FAST");
    }finally{element.remove();}
  }
  const filename=(statement.mode==="detailed"?"detayli":"standart")+
    "-cari-ekstre-"+String(statement.party.account_code||statement.party.id).replace(/[^a-z0-9_-]/gi,"-")+".pdf";
  pdf.save(filename);
}

export function DukkanCariActionsDrawer({party,storeId,banks,onClose,onUpdated,onDeleted,canDelete}:{
  party:Party;storeId:string;banks:Bank[];onClose:()=>void;
  onUpdated:()=>void;onDeleted:()=>void;canDelete:boolean;
}){
  const [visible,setVisible]=useState(false);
  const [view,setView]=useState<View>("menu");
  const [current,setCurrent]=useState<Party>(party);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [statement,setStatement]=useState<Statement|null>(null);
  const [statementBusy,setStatementBusy]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);
  const [direction,setDirection]=useState<"debit"|"credit">("debit");
  const [method,setMethod]=useState<PaymentMethod>("cash");
  const [bankId,setBankId]=useState("");
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(today);
  const [dueDate,setDueDate]=useState("");
  const [documentNo,setDocumentNo]=useState("");
  const [note,setNote]=useState("");
  const [confirmName,setConfirmName]=useState("");
  const [confirmChecked,setConfirmChecked]=useState(false);
  const inFlight=useRef(false);
  const paymentRequestKey=useRef(crypto.randomUUID());
  const firstButton=useRef<HTMLButtonElement|null>(null);
  const printArea=useRef<HTMLDivElement|null>(null);
  const base="/api/dukkan/stores/"+encodeURIComponent(storeId);
  const partyId=String(party.id);
  const close=useCallback(()=>{
    setVisible(false);
    window.setTimeout(onClose,260);
  },[onClose]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setVisible(true));
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const keyboard=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
    document.addEventListener("keydown",keyboard);
    firstButton.current?.focus();
    return()=>{cancelAnimationFrame(frame);document.body.style.overflow=previous;document.removeEventListener("keydown",keyboard);};
  },[close]);
  useEffect(()=>{
    void jsonRequest(base+"/parties/"+encodeURIComponent(partyId))
      .then(item=>setCurrent(item)).catch(()=>{});
  },[base,partyId]);
  const changeView=(next:View)=>{
    setError("");setSuccess("");setView(next);
    setAmount("");setNote("");setDocumentNo("");setMethod("cash");setBankId("");
    setDate(today());setDueDate("");setDirection("debit");setConfirmName("");setConfirmChecked(false);
  };
  const refreshBalance=async()=>{
    const next=await jsonRequest(base+"/parties/"+encodeURIComponent(partyId));
    setCurrent(next);onUpdated();
  };
  useEffect(()=>{paymentRequestKey.current=crypto.randomUUID();},[view,amount,method,bankId,date,documentNo,note,direction]);
  const submitMovement=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(inFlight.current||busy)return;
    inFlight.current=true;
    setBusy(true);setError("");setSuccess("");
    try{
      const value=Number(amount.replace(",","."));if(!Number.isFinite(value)||value<=0)throw new Error("Pozitif bir tutar girin.");
      if(view==="opening"){
        await jsonRequest(base+"/parties/"+encodeURIComponent(partyId)+"/opening",{
          method:"POST",body:JSON.stringify({amount:value,type:direction,date,note})
        });
      }else if(method==="cheque"||method==="promissory"){
        if(!documentNo.trim()||!dueDate)throw new Error("Çek/senet numarası ve vade tarihi zorunludur.");
        await jsonRequest(base+"/instruments",{
          method:"POST",body:JSON.stringify({
            partyId:Number(partyId),kind:method,
            direction:view==="collection"?"received":"issued",
            number:documentNo.trim(),amount:value,dueDate,date,note
          })
        });
      }else{
        if(method==="bank"&&!bankId)throw new Error("Lütfen banka seçin.");
        await jsonRequest(base+"/parties/"+encodeURIComponent(partyId)+"/payments",{
          method:"POST",body:JSON.stringify({
            direction:view==="collection"?"collection":"payment",amount:value,method,
            bankId:method==="bank"?Number(bankId):undefined,date,documentNo,note,
            requestKey:paymentRequestKey.current
          })
        });
      }
      await refreshBalance();
      setAmount("");setNote("");setDocumentNo("");
      setSuccess(view==="opening"?"Açılış bakiyesi kaydedildi.":
        method==="cheque"||method==="promissory"?
        "Çek/senet kaydı vade takibine alındı. Tahsil/ödeme gerçekleşmediği için cari bakiye değişmedi.":
        "Ödeme/tahsilat cari hesaba işlendi.");
      setView("menu");
    }catch(e){setError((e as Error).message);}
    finally{inFlight.current=false;setBusy(false);}
  };
  const loadStatement=async(mode:"standard"|"detailed")=>{
    setStatementBusy(true);setError("");setStatement(null);
    try{
      const result=await fetchWholeStatement(base,partyId,mode);
      setStatement(result);setView("statement");
    }catch(e){setError((e as Error).message);}
    finally{setStatementBusy(false);}
  };
  const makePdf=async()=>{
    if(!statement||pdfBusy)return;
    setPdfBusy(true);setError("");
    try{await saveStatementPdf(statement);}
    catch(e){setError("PDF oluşturulamadı: "+(e as Error).message);}
    finally{setPdfBusy(false);}
  };
  const print=()=>{
    if(!printArea.current)return;
    const printable=printArea.current.outerHTML;
    const win=window.open("","_blank");
    if(!win){setError("Yazdırma penceresi engellendi. Tarayıcıda açılır pencerelere izin verin.");return;}
    win.document.open();
    win.document.write("<!doctype html><html lang='tr'><head><meta charset='utf-8'><title>Cari Ekstre</title>"+
      "<style>body{font:12px Arial,sans-serif;color:#142b4e;padding:28px}h1{font-size:19px}"+
      "table{border-collapse:collapse;width:100%;font-size:10px}th,td{padding:7px 5px;border-bottom:1px solid #dfe7ee;text-align:left;vertical-align:top}"+
      "thead{display:table-header-group}tr{break-inside:avoid}button{display:none}"+
      "@page{size:A4;margin:12mm}</style></head><body>"+printable+"</body></html>");
    win.document.close();win.focus();
    window.setTimeout(()=>win.print(),300);
  };
  const remove=async()=>{
    if(!canDelete||busy||!confirmChecked)return;
    if(confirmName!==current.name){setError("Son onay için cari adını birebir girin.");return;}
    if(!window.confirm("Son onay: "+current.name+" cari kartı kalıcı olarak silinsin mi?"))return;
    setBusy(true);setError("");
    try{
      await jsonRequest(base+"/parties/"+encodeURIComponent(partyId),{
        method:"DELETE",body:JSON.stringify({confirmName})
      });
      onDeleted();
      close();
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const actions=[
    {key:"statement-select" as View,title:"Ekstre",description:"Standart veya detaylı · PDF / Yazdır",icon:FileText},
    {key:"collection" as View,title:"Ödeme Al",description:"Tahsilatı cari alacak tarafına işle",icon:ArrowDownLeft},
    {key:"payment" as View,title:"Ödeme Ver",description:"Ödemeyi cari borç tarafına işle",icon:ArrowUpRight},
    {key:"opening" as View,title:"Açılış Kartı",description:"Bir defalık açılış borç / alacak bakiyesi",icon:BookOpen},
    ...(canDelete?[{key:"delete" as View,title:"Cari Sil",description:"Yalnızca hareketi olmayan hesaplar",icon:Trash2}]:[])
  ];
  const statementLast=statement?.entries[statement.entries.length-1]?.running_balance||0;
  return <div className="fixed inset-0 z-[130]">
    <div className={"absolute inset-0 bg-[#06142c]/55 backdrop-blur-[2px] transition-opacity duration-300 "+
      (visible?"opacity-100":"opacity-0")} onMouseDown={close} aria-hidden="true"/>
    <aside role="dialog" aria-modal="true" aria-label={current.name+" cari işlemleri"}
      className={"absolute inset-y-0 right-0 flex w-full max-w-[670px] flex-col border-l border-[#dbe5f0] bg-[#f7faff] shadow-2xl transition-transform duration-300 ease-out "+
      (visible?"translate-x-0":"translate-x-full")}>
      <div className="border-b border-[#e0e9f5] bg-white p-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-sky-700">Çalışkan Dükkan · Cari İşlemler</p>
            <h2 className="mt-1 break-words text-lg font-extrabold text-[#132b50]">{current.name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cari No: {current.source_cari_no||"—"} · Hesap Kodu: {current.account_code||"—"}
            </p>
          </div>
          <button ref={firstButton} aria-label="Çekmeceyi kapat" onClick={close}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-100"><X size={20}/></button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#eff5fd] px-4 py-3">
          <div>
            <div className="text-[11px] font-bold text-slate-500">Güncel Bakiye</div>
            <div className="text-xl font-black tabular-nums text-[#122a51]">{money(Math.abs(Number(current.balance||0)))}</div>
          </div>
          <span className={"rounded-full px-3 py-1.5 text-xs font-bold "+
            (Number(current.balance)<0?"bg-emerald-100 text-emerald-800":Number(current.balance)>0?
              "bg-amber-100 text-amber-900":"bg-slate-200 text-slate-600")}>
            {Number(current.balance)<0?"Alacaklı":Number(current.balance)>0?"Borçlu":"Bakiye yok"}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
        {view!=="menu"&&<button type="button" onClick={()=>changeView(view==="statement"?"statement-select":"menu")}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-sky-800 hover:underline">
          <ArrowLeft size={16}/> Geri
        </button>}
        {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success&&<div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={18}/>{success}</div>}
        {view==="menu"&&<div className="space-y-2.5">
          <p className="mb-4 text-sm text-slate-600">Gerçekleştirmek istediğiniz cari hesap işlemini seçin.</p>
          {actions.map(action=><button type="button" key={action.key} onClick={()=>changeView(action.key)}
            className={"group flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md "+
              (action.key==="delete"?"border-red-100 hover:border-red-300":"border-slate-200 hover:border-sky-300")}>
            <span className={"grid h-12 w-12 shrink-0 place-items-center rounded-xl "+
              (action.key==="delete"?"bg-red-50 text-red-600":"bg-[#edf5ff] text-[#1d538b]")}><action.icon size={23}/></span>
            <span className="min-w-0 flex-1">
              <span className={"block text-sm font-extrabold "+(action.key==="delete"?"text-red-700":"text-[#142b4e]")}>{action.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{action.description}</span>
            </span>
            <ChevronRight size={17} className="text-slate-400 transition group-hover:translate-x-1"/>
          </button>)}
        </div>}
        {view==="statement-select"&&<div className="space-y-3">
          <h3 className="text-lg font-extrabold">Ekstre Türünü Seçin</h3>
          <p className="text-sm text-slate-600">Tüm cari hareketleri ilk kayıttan son kayda kadar, işlem sonrası bakiye ile görüntülenir.</p>
          <button disabled={statementBusy} onClick={()=>void loadStatement("standard")} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-sky-300 disabled:opacity-50">
            <ReceiptText size={28} className="text-[#194d86]"/><span className="flex-1"><b className="block">Standart Ekstre</b><small className="mt-1 block text-slate-500">Tarih, belge no, açıklama, borç, alacak ve yürüyen bakiye</small></span><ChevronRight size={17}/>
          </button>
          <button disabled={statementBusy} onClick={()=>void loadStatement("detailed")} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-sky-300 disabled:opacity-50">
            <FileText size={28} className="text-[#194d86]"/><span className="flex-1"><b className="block">Detaylı Ekstre</b><small className="mt-1 block text-slate-500">Standart ekstreye ek olarak fatura içindeki ürünler, miktar, fiyat ve KDV</small></span><ChevronRight size={17}/>
          </button>
          {statementBusy&&<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Tüm hareketler yükleniyor…</p>}
        </div>}
        {view==="statement"&&statement&&<div>
          <h3 className="mb-3 text-lg font-extrabold">{statement.mode==="detailed"?"Detaylı":"Standart"} Cari Ekstre</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            <button className={primaryStyle} disabled={pdfBusy} onClick={()=>void makePdf()}>
              {pdfBusy?<Loader2 size={17} className="animate-spin"/>:<FileDown size={17}/>}
              {pdfBusy?"PDF hazırlanıyor":"PDF İndir"}
            </button>
            <button className={primaryStyle+" bg-white !text-[#15375d] ring-1 ring-slate-200 hover:!bg-slate-50"}
              onClick={print}><Printer size={17}/> Yazdır</button>
          </div>
          <div ref={printArea} id="dukkan-statement-print" className="rounded-2xl bg-white p-3 shadow-sm sm:p-5">
            <div className="mb-4 border-b border-slate-200 pb-3">
              <h3 className="font-black">{statement.storeName} · {statement.mode==="detailed"?"DETAYLI":"STANDART"} CARİ EKSTRE</h3>
              <p className="mt-1 text-xs">{statement.party.name} · {statement.party.account_code||"—"} · {statement.entries.length} hareket</p>
              <p className="mt-1 text-xs font-bold">Son bakiye: {money(statementLast)}</p>
            </div>
            <StatementTable statement={statement}/>
            <p className="mt-3 text-xs text-slate-500">Ön muhasebe ekstresi. İşlemler kayıt sırasına göre sıralanır.</p>
          </div>
        </div>}
        {["collection","payment","opening"].includes(view)&&<form onSubmit={event=>void submitMovement(event)} className="space-y-4">
          <h3 className="text-lg font-extrabold">{view==="collection"?"Ödeme Al / Tahsilat":view==="payment"?"Ödeme Ver":"Açılış Kartı"}</h3>
          <p className="rounded-xl bg-[#edf4fe] px-4 py-3 text-sm text-[#244f7e]">
            {view==="collection"?"Tahsilat carinin borç bakiyesini azaltır; mevcut alacağı artırabilir.":
              view==="payment"?"Ödeme vermek carinin borç tarafına işlenir; mevcut alacağı azaltabilir.":
              "Açılış bakiyesi yalnızca bir kez kaydedilir. Excel'den aktarılan açılışlar da ikinci kayda izin vermez."}
          </p>
          {view==="opening"?<label className="block text-xs font-bold text-slate-600">Açılış Türü
            <select className={inputStyle+" mt-2"} value={direction} onChange={e=>setDirection(e.target.value as "debit"|"credit")}>
              <option value="debit">Borç Açılışı</option><option value="credit">Alacak Açılışı</option>
            </select>
          </label>:<label className="block text-xs font-bold text-slate-600">Ödeme Yöntemi
            <select className={inputStyle+" mt-2"} value={method} onChange={e=>{setMethod(e.target.value as PaymentMethod);setBankId("");}}>
              <option value="cash">Nakit</option><option value="bank">Havale / EFT (Banka)</option>
              <option value="card">Kredi Kartı / POS</option><option value="cheque">Çek</option>
              <option value="promissory">Senet</option><option value="other">Diğer</option>
            </select>
          </label>}
          {view!=="opening"&&method==="bank"&&<label className="block text-xs font-bold text-slate-600">Banka
            <select className={inputStyle+" mt-2"} value={bankId} required onChange={e=>setBankId(e.target.value)}>
              <option value="">Banka seçin</option>
              {banks.map(item=><option key={String(item.id)} value={String(item.id)}>{item.name}</option>)}
            </select>
            {!banks.length&&<span className="mt-2 block text-amber-700">Önce Bankalar bölümünden bir banka hesabı ekleyin.</span>}
          </label>}
          {view!=="opening"&&(method==="cheque"||method==="promissory")&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Çek veya senet vadesi gelmeden tahsilat olarak işlenmez; yalnızca Çek ve Senetler modülüne bekleyen belge olarak kaydedilir. Tahsil edildiğinde ayrı bir ödeme kaydı oluşturmalısınız.
          </div>}
          {view!=="opening"&&method==="card"&&<p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">Kart tahsilatı cari hesaba işlenir. POS tahsilatının banka hesabına geçişi ayrıca mutabakat gerektirir.</p>}
          <label className="block text-xs font-bold text-slate-600">İşlem Tarihi
            <input type="date" required className={inputStyle+" mt-2"} value={date} onChange={e=>setDate(e.target.value)}/>
          </label>
          <label className="block text-xs font-bold text-slate-600">Tutar (₺)
            <input className={inputStyle+" mt-2"} type="number" required min="0.01" max="999999999999" step="0.01"
              placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)}/>
          </label>
          {view!=="opening"&&(method==="cheque"||method==="promissory")&&<label className="block text-xs font-bold text-slate-600">Vade Tarihi
            <input type="date" required value={dueDate} onChange={e=>setDueDate(e.target.value)} className={inputStyle+" mt-2"}/>
          </label>}
          {view!=="opening"&&<label className="block text-xs font-bold text-slate-600">{method==="cheque"||method==="promissory"?"Çek / Senet No (zorunlu)":"Belge / Makbuz No (isteğe bağlı)"}
            <input className={inputStyle+" mt-2"} required={method==="cheque"||method==="promissory"} maxLength={80} value={documentNo} onChange={e=>setDocumentNo(e.target.value)}/>
          </label>}
          <label className="block text-xs font-bold text-slate-600">Açıklama
            <textarea className={inputStyle+" mt-2 min-h-24 resize-y"} maxLength={500} value={note}
              onChange={e=>setNote(e.target.value)} placeholder="İşleme ait notlar"/>
          </label>
          <button type="submit" disabled={busy} className={primaryStyle+" w-full"}>
            {busy?<Loader2 size={17} className="animate-spin"/>:<CheckCircle2 size={17}/>}
            {busy?"Kaydediliyor...":"İşlemi Kaydet"}
          </button>
        </form>}
        {view==="delete"&&canDelete&&<div className="space-y-4">
          <h3 className="text-lg font-black text-red-700">Cari Hesabı Sil</h3>
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Yalnızca hiçbir işlem, fatura, sipariş, tahsilat, çek/senet, açılış veya cari hareket kaydı bulunmayan cari silinebilir.
            <strong className="mt-2 block">Bu işlem geri alınamaz.</strong>
          </p>
          <label className="block text-sm font-semibold">Onay için firma adını birebir yazın
            <input className={inputStyle+" mt-2"} value={confirmName} onChange={e=>setConfirmName(e.target.value)}
              placeholder={current.name} autoComplete="off"/>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmChecked} onChange={e=>setConfirmChecked(e.target.checked)}/>
            Cari hesabın, işlem yoksa kalıcı silinmesini onaylıyorum.
          </label>
          <button type="button" disabled={busy||!confirmChecked||confirmName!==current.name}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-40"
            onClick={()=>void remove()}><Trash2 size={17}/> Cari Sil – Son Onay</button>
        </div>}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 sm:px-7">
        <span>İşlemler yalnızca seçili mağaza cari hesabına işlenir.</span>
        <button type="button" onClick={close} className="font-bold text-[#194f86]">Kapat</button>
      </div>
    </aside>
  </div>;
}
