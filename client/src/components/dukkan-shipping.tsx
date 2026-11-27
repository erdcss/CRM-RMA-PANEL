import {useEffect,useMemo,useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Barcode,Printer,Truck,X,Download} from "lucide-react";

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
const PAPER_WIDTH=100, PAPER_HEIGHT=150;
function labelCanvas(label:Label){
  // 150 x 100 mm artwork at about 305 dpi. A single flattened page
  // prevents Chromium from fragmenting a grid across roll labels.
  const canvas=document.createElement("canvas");canvas.width=1800;canvas.height=1200;
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("Etiket çizimi açılamadı.");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,1800,1200);ctx.fillStyle="#000";
  const text=(v:string,x:number,y:number,size:number,bold=false,maxWidth?:number)=>{
    ctx.font=(bold?"700 ":"400 ")+size+"px Arial, sans-serif";
    if(maxWidth)ctx.fillText(v,x,y,maxWidth);else ctx.fillText(v,x,y);
  };
  const wrap=(value:string,maxWidth:number)=>{
    const lines:string[]=[];
    for(const paragraph of String(value||"").split(/\r?\n/)){
      let line="";
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        const next=line?line+" "+word:word;
        if(ctx.measureText(next).width<=maxWidth){line=next;continue;}
        if(line)lines.push(line);line="";
        for(const ch of word){if(line&&ctx.measureText(line+ch).width>maxWidth){lines.push(line);line="";}line+=ch;}
      }
      if(line)lines.push(line);
    }
    return lines;
  };
  text("SEVKİYAT ETİKETİ",48,96,48,true,900);
  ctx.textAlign="right";text("Gönderim: "+label.shippingType,1752,94,34,true,780);ctx.textAlign="left";
  ctx.strokeStyle="#000";ctx.lineWidth=3;
  const card=(title:string,person:Contact,x:number)=>{
    const y=138,w=840,h=660,pad=32,limit=w-2*pad;
    ctx.strokeRect(x,y,w,h);
    text(title,x+pad,y+60,32,true);
    const fields=[{value:person.name,bold:true},{value:person.contact,bold:false},{value:person.address,bold:false},{value:person.phone?"Tel: "+person.phone:"",bold:false}].filter(v=>v.value);
    let plan:{lines:string[];size:number;bold:boolean}[]=[];
    for(let base=35;base>=20;base--){
      plan=fields.map(f=>{const size=f.bold?base+5:base;ctx.font=(f.bold?"700 ":"400 ")+size+"px Arial, sans-serif";return {lines:wrap(f.value,limit),size,bold:f.bold};});
      const height=plan.reduce((sum,f)=>sum+f.lines.length*Math.ceil(f.size*1.25)+12,0);
      if(height<=h-110)break;
      if(base===20)throw Error("Firma bilgileri etikete sığmıyor. Adres veya firma adını kısaltın.");
    }
    let yy=y+105;
    for(const f of plan){for(const line of f.lines){text(line,x+pad,yy+f.size,f.size,f.bold);yy+=Math.ceil(f.size*1.25);}yy+=12;}
  };
  card("GÖNDEREN FİRMA",label.sender,48);card("ALICI FİRMA",label.receiver,912);
  const barcode=shippingBarcode(label.invoiceNo);
  const module=Math.floor(1620/barcode.width),left=Math.floor((1800-barcode.width*module)/2);
  if(module<3)throw Error("Barkod etikete sığmıyor.");
  for(const bar of barcode.bars)ctx.fillRect(left+bar.x*module,846,bar.w*module,210);
  ctx.textAlign="center";text(label.invoiceNo,900,1100,39,true);text("Çalışkan Dükkan · Dahili fatura barkodu",900,1155,25);
  // Most thermal rolls are 100 mm across and advance 150 mm per label.
  // Rotate the complete artwork, not the browser's page layout.
  const rotated=document.createElement("canvas");rotated.width=1200;rotated.height=1800;
  const out=rotated.getContext("2d");if(!out)throw Error("Etiket döndürülemedi.");
  out.translate(1200,0);out.rotate(Math.PI/2);out.drawImage(canvas,0,0);
  return rotated;
}
async function downloadLabel(label:Label){
  const canvas=labelCanvas(label),width=PAPER_WIDTH,height=PAPER_HEIGHT;
  const {jsPDF}=await import("jspdf");
  const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:[width,height],compress:true});
  pdf.addImage(canvas.toDataURL("image/png"),"PNG",3,4.5,94,141);
  if(pdf.getNumberOfPages()!==1)throw Error("Etiket tek sayfa oluşturulamadı.");
  pdf.save("Sevkiyat-"+label.invoiceNo+"-150x100.pdf");
}
type DesktopLabelBridge={printShippingLabel:(png:string)=>Promise<{ok:boolean;error?:string}>};
async function printLabel(label:Label){
  const canvas=labelCanvas(label),png=canvas.toDataURL("image/png");
  const desktop=(window as Window&{caliskanDukkan?:DesktopLabelBridge}).caliskanDukkan;
  if(desktop?.printShippingLabel){
    const result=await desktop.printShippingLabel(png);
    if(!result.ok&&result.error!=="cancelled")throw Error(result.error||"Yazdırma tamamlanamadı.");
    return;
  }
  // Browser fallback: a single fixed-position image, no in-flow content
  // that can create a second page. Leave a 3 mm / 4.5 mm safety inset.
  const frame=document.createElement("iframe");
  frame.style.cssText="position:fixed;left:-10000px;top:0;width:100mm;height:150mm;border:0";
  frame.setAttribute("title","Sevkiyat etiketi");
  const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sevkiyat etiketi</title><style>@page{size:100mm 150mm;margin:0}html,body{margin:0!important;padding:0!important;width:100%;height:100%;overflow:hidden!important;background:#fff}img{display:block;position:fixed;left:3mm;top:4.5mm;width:94mm;height:141mm;object-fit:contain;break-inside:avoid;page-break-inside:avoid}</style></head><body><img alt="Sevkiyat etiketi" src="'+png+'"></body></html>';
  await new Promise<void>((resolve,reject)=>{
    frame.onload=async()=>{try{
      const w=frame.contentWindow;if(!w)throw Error("Yazdırma açılamadı");
      const img=frame.contentDocument?.querySelector("img");if(!img)throw Error("Etiket görseli yüklenemedi");await img.decode();
      w.addEventListener("afterprint",()=>frame.remove(),{once:true});
      w.focus();w.print();resolve();
    }catch(e){frame.remove();reject(e);}};
    frame.srcdoc=html;document.body.appendChild(frame);
  });
}
export function DukkanShippingLabelDialog({base,invoiceId,onClose}:{base:string;invoiceId:string;onClose:()=>void}){
  const [label,setLabel]=useState<Label|null>(null),[error,setError]=useState("");
  const [printError,setPrintError]=useState(""),[pdfBusy,setPdfBusy]=useState(false),[printBusy,setPrintBusy]=useState(false);
  useEffect(()=>{let active=true;setLabel(null);setError("");fetch(base+"/invoices/"+encodeURIComponent(invoiceId)+"/shipping-label",{credentials:"include",cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Etiket yüklenemedi.");if(active)setLabel(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[base,invoiceId]);
  const barcode=useMemo(()=>{try{return label?shippingBarcode(label.invoiceNo):null;}catch{return null;}},[label?.invoiceNo]);
  const update=(side:"sender"|"receiver",key:keyof Contact,value:string)=>setLabel(old=>old?{...old,[side]:{...old[side],[key]:value}}:old);
  return <Dialog.Root open onOpenChange={v=>{if(!v)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[110] bg-slate-950/55"/>
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] flex max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-white text-[#142b4e] shadow-2xl">
      <div className="flex items-center justify-between gap-2 bg-[#122a51] p-4 text-white"><div><Dialog.Title className="flex items-center gap-2 text-lg font-black"><Barcode size={22}/> Barkod Etiketi</Dialog.Title><Dialog.Description className="text-xs text-slate-200">150 × 100 mm · Yatay gönderim etiketi</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Kapat"><X size={22}/></button></Dialog.Close></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{error?<p role="alert" className="text-red-700">{error}</p>:!label?<p>Etiket hazırlanıyor...</p>:<>
        <p className="mb-3 text-sm font-bold">{label.shippingType} · Fatura {label.invoiceNo}</p>
        <p className="mb-3 text-xs text-slate-600">150 × 100 mm etiket · Tek sayfa · Rulo yönü otomatik</p>
        <div className="grid gap-3 sm:grid-cols-2">{(["sender","receiver"] as const).map(side=><section key={side} className="space-y-2 rounded-xl border p-3"><h3 className="font-bold">{side==="sender"?"Gönderen firma":"Alıcı firma"}</h3>{(["name","contact","address","phone"] as const).map(key=><label key={key} className="block text-xs font-semibold">{{name:"Firma adı",contact:"Yetkili kişi",address:"Adres",phone:"Telefon"}[key]}{key==="address"?<textarea className={field} rows={3} maxLength={250} value={label[side][key]||""} onChange={e=>update(side,key,e.target.value)}/>:<input className={field} maxLength={key==="name"?140:key==="phone"?45:80} value={label[side][key]||""} onChange={e=>update(side,key,e.target.value)}/>}</label>)}</section>)}</div>
        {barcode&&<div className="mt-4 rounded-xl border bg-white p-3 text-center"><svg viewBox={"0 0 "+barcode.width+" 70"} className="mx-auto h-20 w-full max-w-[350px]" preserveAspectRatio="none" aria-label="Fatura barkodu">{barcode.bars.map(b=><rect key={b.x} x={b.x} y={0} width={b.w} height={70} fill="#000"/>)}</svg><p className="font-mono text-sm">{label.invoiceNo}</p></div>}
        {(!label.sender.address||!label.receiver.address||!label.sender.phone||!label.receiver.phone)&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Eksik adres veya telefon bilgilerini yazdırmadan önce tamamlayın.</p>}
        {printError&&<p role="alert" className="mt-3 text-sm text-red-700">{printError}</p>}
        <p className="mt-3 text-xs text-slate-500">Bu ekrandaki düzeltmeler sadece etikete yansır. Barkod kargo firması takip numarası değildir.</p>
      </>}</div>
      <div className="flex justify-end gap-2 border-t p-3"><Dialog.Close asChild><button type="button" className="rounded-xl border px-4 py-2 text-sm">Kapat</button></Dialog.Close><button type="button" disabled={printBusy||!label||!barcode||!label.sender.name.trim()||!label.receiver.name.trim()} onClick={async()=>{if(!label)return;setPrintBusy(true);setPrintError("");try{await printLabel(label);}catch(e){setPrintError((e as Error).message);}finally{setPrintBusy(false);}}} className="flex items-center gap-2 rounded-xl bg-[#123d70] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Printer size={17}/>{printBusy?"Yazdırılıyor...":"Yazdır"}</button><button type="button" disabled={pdfBusy||!label||!barcode||!label.sender.name.trim()||!label.receiver.name.trim()} onClick={async()=>{if(!label)return;setPdfBusy(true);setPrintError("");try{await downloadLabel(label);}catch(e){setPrintError((e as Error).message);}finally{setPdfBusy(false);}}} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"><Download size={17}/>{pdfBusy?"Hazırlanıyor...":"Tek Sayfa PDF"}</button></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
