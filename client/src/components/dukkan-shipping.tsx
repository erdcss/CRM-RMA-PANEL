import {useEffect,useMemo,useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Barcode,Printer,Truck,X} from "lucide-react";

const standard=["Kargo","Ambar","Nakliye"];
const ADD="__custom__";
const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#142b4e] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
export function DukkanShippingType({base,value,onChange,disabled}:{base:string;value:string;onChange:(s:string)=>void;disabled?:boolean}){
  const [custom,setCustom]=useState(false),[draft,setDraft]=useState(""),[options,setOptions]=useState<string[]>([]);
  useEffect(()=>{let active=true;setOptions([]);fetch(base+"/shipping-types",{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():[]).then(r=>{if(active&&Array.isArray(r))setOptions(r.filter(v=>typeof v==="string"&&!standard.includes(v)));}).catch(()=>{});return()=>{active=false;};},[base]);
  const extras=[...new Set([...options,...(value&&!standard.includes(value)?[value]:[])])];
  return <div className="mt-4 rounded-2xl border border-[#dbe8f6] bg-[#f5f9ff] p-4">
    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#123d70]"><Truck size={18}/> Gönderim Tipi</div>
    <div className="flex flex-wrap items-start gap-2">
      <select aria-label="Gönderim tipi" disabled={disabled} className={field+" sm:max-w-xs"} value={custom?ADD:value} onChange={e=>{if(e.target.value===ADD){setCustom(true);setDraft("");}else{setCustom(false);onChange(e.target.value);}}}>
        <option value="">Gönderim tipi seçin (isteğe bağlı)</option>
        {standard.map(v=><option key={v} value={v}>{v}</option>)}
        <option value={ADD}>+ Seçenek Ekle</option>
        {extras.length>0&&<optgroup label="Özel gönderim tipleri">{extras.map(v=><option key={v} value={v}>{v}</option>)}</optgroup>}
      </select>
      {custom&&<div className="flex min-w-0 flex-1 flex-wrap gap-2"><input aria-label="Yeni gönderim tipi" maxLength={80} className={field+" flex-1"} placeholder="Özel gönderim tipi" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.preventDefault();}}/><button type="button" disabled={disabled||!draft.trim()||draft.trim()===ADD} className="rounded-xl bg-[#123d70] px-4 py-2 text-sm font-bold text-white disabled:opacity-40" onClick={()=>{const v=draft.trim();setOptions(old=>[...new Set([...old,v])]);onChange(v);setCustom(false);}}>Ekle</button><button type="button" className="text-sm text-slate-600" onClick={()=>setCustom(false)}>Vazgeç</button></div>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Gönderim tipi faturaya kaydedilir. Barkod etiketi kayıtlı fatura numarasıyla hazırlanır.</p>
  </div>;
}
type Contact={name:string;address:string;phone:string;contact:string};
type Label={invoiceNo:string;shippingType:string;sender:Contact;receiver:Contact};
// Code 39 numeric subset: narrow/wide widths, alternating black/white.
const patterns:Record<string,string>={"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","*":"nwnnwnwnn"};
export function shippingBarcode(value:string){
  if(!/^\d{1,18}$/.test(value))throw Error("Barkod için sayısal fatura numarası gerekli.");
  let x=10;const bars:{x:number;w:number}[]=[];
  for(const ch of "*"+value+"*"){patterns[ch].split("").forEach((width,i)=>{const w=width==="w"?3:1;if(i%2===0)bars.push({x,w});x+=w;});x++;}
  return {width:x+10,bars};
}
const esc=(s:unknown)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
function printLabel(label:Label){
  const barcode=shippingBarcode(label.invoiceNo);
  const contact=(title:string,p:Contact)=>'<section><h2>'+title+'</h2><strong>'+esc(p.name)+'</strong><p>'+esc(p.contact)+'</p><p>'+esc(p.address)+'</p><p>Tel: '+esc(p.phone)+'</p></section>';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+barcode.width+' 70" preserveAspectRatio="none">'+barcode.bars.map(b=>'<rect x="'+b.x+'" y="0" width="'+b.w+'" height="70"/>').join("")+'</svg>';
  const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>@page{size:150mm 100mm;margin:0}*{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#000;background:#fff}main{width:150mm;height:100mm;padding:4mm;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:2mm;overflow:hidden}header{display:flex;align-items:center;justify-content:space-between;gap:3mm}header p{max-width:52%;text-align:right}.contacts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3mm;min-height:0}h1{font-size:19px;margin:0}h2{font-size:11px;letter-spacing:1px;margin:0 0 2mm}section{border:1px solid #000;padding:2.5mm;min-width:0;overflow-wrap:anywhere}strong{font-size:14px}p{margin:1mm 0;white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;height:19mm;display:block}footer{text-align:center;font-size:12px;letter-spacing:1px}footer p{margin:0.5mm 0}</style></head><body><main><header><h1>SEVKİYAT ETİKETİ</h1><p>Gönderim: '+esc(label.shippingType)+'</p></header><div class="contacts">'+contact("GÖNDEREN",label.sender)+contact("ALICI",label.receiver)+'</div><footer>'+svg+'<p>'+esc(label.invoiceNo)+'</p><p style="font-size:10px;letter-spacing:0">Çalışkan Dükkan · Dahili fatura barkodu</p></footer></main></body></html>';
  const frame=document.createElement("iframe");frame.style.cssText="position:fixed;left:-10000px;top:0;width:150mm;height:100mm;border:0";
  frame.onload=()=>{try{const w=frame.contentWindow;if(!w)throw Error("Yazdırma açılamadı");w.addEventListener("afterprint",()=>frame.remove(),{once:true});w.focus();w.print();}catch(e){frame.remove();window.alert((e as Error).message);}};
  frame.srcdoc=html;document.body.appendChild(frame);
}
export function DukkanShippingLabelDialog({base,invoiceId,onClose}:{base:string;invoiceId:string;onClose:()=>void}){
  const [label,setLabel]=useState<Label|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;setLabel(null);setError("");fetch(base+"/invoices/"+encodeURIComponent(invoiceId)+"/shipping-label",{credentials:"include",cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Etiket yüklenemedi.");if(active)setLabel(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[base,invoiceId]);
  const barcode=useMemo(()=>{try{return label?shippingBarcode(label.invoiceNo):null;}catch{return null;}},[label?.invoiceNo]);
  const update=(side:"sender"|"receiver",key:keyof Contact,value:string)=>setLabel(old=>old?{...old,[side]:{...old[side],[key]:value}}:old);
  return <Dialog.Root open onOpenChange={v=>{if(!v)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[110] bg-slate-950/55"/>
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] flex max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-white text-[#142b4e] shadow-2xl">
      <div className="flex items-center justify-between gap-2 bg-[#122a51] p-4 text-white"><div><Dialog.Title className="flex items-center gap-2 text-lg font-black"><Barcode size={22}/> Barkod Etiketi</Dialog.Title><Dialog.Description className="text-xs text-slate-200">150 × 100 mm · Yatay gönderim etiketi</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Kapat"><X size={22}/></button></Dialog.Close></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{error?<p role="alert" className="text-red-700">{error}</p>:!label?<p>Etiket hazırlanıyor...</p>:<>
        <p className="mb-3 text-sm font-bold">{label.shippingType} · Fatura {label.invoiceNo}</p>
        <div className="grid gap-3 sm:grid-cols-2">{(["sender","receiver"] as const).map(side=><section key={side} className="space-y-2 rounded-xl border p-3"><h3 className="font-bold">{side==="sender"?"Gönderen firma":"Alıcı firma"}</h3>{(["name","contact","address","phone"] as const).map(key=><label key={key} className="block text-xs font-semibold">{{name:"Firma adı",contact:"Yetkili kişi",address:"Adres",phone:"Telefon"}[key]}{key==="address"?<textarea className={field} rows={3} maxLength={250} value={label[side][key]||""} onChange={e=>update(side,key,e.target.value)}/>:<input className={field} maxLength={key==="name"?140:key==="phone"?45:80} value={label[side][key]||""} onChange={e=>update(side,key,e.target.value)}/>}</label>)}</section>)}</div>
        {barcode&&<div className="mt-4 rounded-xl border bg-white p-3 text-center"><svg viewBox={"0 0 "+barcode.width+" 70"} className="mx-auto h-20 w-full max-w-[350px]" preserveAspectRatio="none" aria-label="Fatura barkodu">{barcode.bars.map(b=><rect key={b.x} x={b.x} y={0} width={b.w} height={70} fill="#000"/>)}</svg><p className="font-mono text-sm">{label.invoiceNo}</p></div>}
        {(!label.sender.address||!label.receiver.address||!label.sender.phone||!label.receiver.phone)&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Eksik adres veya telefon bilgilerini yazdırmadan önce tamamlayın.</p>}
        <p className="mt-3 text-xs text-slate-500">Bu ekrandaki düzeltmeler sadece etikete yansır. Barkod kargo firması takip numarası değildir.</p>
      </>}</div>
      <div className="flex justify-end gap-2 border-t p-3"><Dialog.Close asChild><button type="button" className="rounded-xl border px-4 py-2 text-sm">Kapat</button></Dialog.Close><button type="button" disabled={!label||!barcode||!label.sender.name.trim()||!label.receiver.name.trim()} onClick={()=>{if(label)printLabel(label);}} className="flex items-center gap-2 rounded-xl bg-[#123d70] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Printer size={17}/> Yazdır</button></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
