import {useEffect,useMemo,useState} from "react";
import {AlertTriangle,CheckCircle2,ChevronDown,FileText,FileUp,Loader2,ShieldCheck} from "lucide-react";

export type LegacyLine={
  productName:string;quantity:number;unit:string;unitPrice:number;
  discountedUnitPrice:number|null;lineTotal:number;
};
export type LegacyEntry={
  date:string;dueDate:string|null;
  kind:"opening"|"sale"|"purchase"|"collection"|"payment"|"other";
  documentNo:string;description:string;debit:number;credit:number;
  sourceBalance:number|null;sourcePage:number;lines:LegacyLine[];
};
export type LegacyStatement={
  party:{name:string;sourceCariNo:string;currency:string;sourceCompany:string;
    reportDate:string;periodStart:string;periodEnd:string};
  entries:LegacyEntry[];declaredClosingBalance:number|null;warnings:string[];pageCount:number;
};
type Preview={
  sha256:string;filename:string;statement:LegacyStatement;duplicate:boolean;
  existingParty:{id:number;name:string;source_cari_no:string}|null;
  summary:{entryCount:number;invoiceCount:number;invoiceLineCount:number;
    debit:number;credit:number;balance:number;reportedBalance:number|null;
    warnings:string[];blockingMismatches:string[];earliest:string;latest:string};
};
type Props={base:string;onImported:(result:{partyId:number;entryCount:number;invoiceLineCount:number})=>void};
const fmt=(n:number)=>n.toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const kindLabel:Record<LegacyEntry["kind"],string>={
  opening:"Açılış",sale:"Satış Faturası",purchase:"Alış Faturası",
  collection:"Tahsilat",payment:"Ödeme",other:"Diğer",
};
const input="h-10 w-full min-w-0 rounded-lg border border-[#dce6f1] bg-white px-2.5 text-xs text-[#152f51] outline-none focus:border-sky-400";
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const num=(value:string)=>Number(value);
const valid=(v:number)=>Number.isFinite(v)&&v>=0&&Math.abs(v*100-Math.round(v*100))<0.00001;
async function request(url:string,body:unknown){
  const res=await fetch(url,{method:"POST",credentials:"include",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||"Cari ekstre içe aktarılamadı.");
  return json;
}
async function asBase64(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(Error("Dosya okunamadı."));
    reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
    reader.readAsDataURL(file);
  });
}
export function DukkanCariStatementImport({base,onImported}:Props){
  const [file,setFile]=useState<File|null>(null);
  const [url,setUrl]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [expandAll,setExpandAll]=useState(false);
  useEffect(()=>{
    if(!file){setUrl("");return;}
    const obj=URL.createObjectURL(file);setUrl(obj);
    return()=>URL.revokeObjectURL(obj);
  },[file]);
  const document=preview?.statement;
  const summary=useMemo(()=>{
    if(!document)return null;
    const debit=round(document.entries.reduce((sum,e)=>sum+e.debit,0));
    const credit=round(document.entries.reduce((sum,e)=>sum+e.credit,0));
    const balance=round(debit-credit);
    const invoices=document.entries.filter(e=>e.kind==="sale"||e.kind==="purchase");
    const mismatches:string[]=[];
    invoices.forEach(e=>{
      const amount=round(e.debit+e.credit);
      const lines=round(e.lines.reduce((sum,line)=>sum+line.lineTotal,0));
      if(!e.lines.length)mismatches.push(e.documentNo+": faturanın ürün satırları eksik.");
      else if(Math.abs(amount-lines)>0.05)mismatches.push(
        e.documentNo+": fatura toplamı "+fmt(amount)+", ürün satırları toplamı "+fmt(lines));
    });
    if(document.declaredClosingBalance!==null&&Math.abs(balance-document.declaredClosingBalance)>0.02)
      mismatches.push("Belge kapanış bakiyesi "+fmt(document.declaredClosingBalance)+
        ", hareketlerin toplam bakiyesi "+fmt(balance)+".");
    return {debit,credit,balance,invoiceCount:invoices.length,
      lineCount:invoices.reduce((a,e)=>a+e.lines.length,0),mismatches};
  },[document]);
  const analyze=async()=>{
    if(!file)return;
    if(file.type!=="application/pdf"||file.size>8_000_000||file.size<64){
      setError("PDF seçin; dosya 8 MB sınırını aşmamalıdır.");return;
    }
    setBusy(true);setError("");setSuccess("");setPreview(null);setConfirmed(false);
    try{
      const data=await request(base+"/ai-documents/preview-cari-statement",{
        filename:file.name,mimeType:"application/pdf",base64:await asBase64(file),
      }) as Preview;
      setPreview(data);
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const editParty=(field:"name"|"sourceCariNo",value:string)=>{
    setPreview(p=>p?{...p,statement:{...p.statement,
      party:{...p.statement.party,[field]:value}}}:p);
    setConfirmed(false);
  };
  const editRow=(i:number,patch:Partial<LegacyEntry>)=>{
    setPreview(p=>p?{...p,statement:{...p.statement,
      entries:p.statement.entries.map((entry,index)=>index===i?{...entry,...patch}:entry)}}:p);
    setConfirmed(false);
  };
  const editLine=(row:number,line:number,patch:Partial<LegacyLine>)=>{
    setPreview(p=>p?{...p,statement:{...p.statement,
      entries:p.statement.entries.map((entry,index)=>index===row?
        {...entry,lines:entry.lines.map((item,k)=>k===line?{...item,...patch}:item)}:entry)}}:p);
    setConfirmed(false);
  };
  const importData=async()=>{
    if(!preview||!document||!summary||busy||preview.duplicate||summary.mismatches.length)return;
    if(!confirmed){setError("İçe aktarmadan önce kontrol ve onay kutusunu işaretleyin.");return;}
    if(document.entries.some(e=>!valid(e.debit)||!valid(e.credit)||((e.debit===0)===(e.credit===0))))
      {setError("Borç / alacak alanları geçerli ve yalnızca bir tanesi dolu olmalı.");return;}
    if(!window.confirm(document.entries.length+" tarihli cari hareket ve "+summary.lineCount+
      " fatura ürün satırı kaydedilecek. Bu işlem güncel cari bakiyeyi etkiler. Onaylıyor musunuz?"))return;
    setBusy(true);setError("");
    try{
      const result=await request(base+"/ai-documents/import-cari-statement",{
        filename:preview.filename,sha256:preview.sha256,statement:document,
        partyId:preview.existingParty?.id,confirmed:true,
      });
      setSuccess("İçe aktarıldı: "+result.entryCount+" hareket, "+
        result.invoiceLineCount+" ürün satırı. Bakiye "+fmt(Number(result.balance))+".");
      onImported({partyId:Number(result.partyId),
        entryCount:Number(result.entryCount),invoiceLineCount:Number(result.invoiceLineCount)});
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const sameParty=preview?.existingParty?
    preview.existingParty.name.trim().toLocaleLowerCase("tr-TR")===
      document?.party.name.trim().toLocaleLowerCase("tr-TR"):true;
  return <div className="grid min-h-0 gap-5 overflow-auto p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-[#245481]">
        <strong>Detaylı cari hareket aktarımı</strong>
        <p>PDF'deki tüm sayfalar okunur; açılış, satış/alış, tahsilat, ödeme ve fatura ürün satırları tarihleriyle hazırlanır.</p>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-sky-200 p-4 text-sm font-semibold">
        <FileUp size={20} className="text-[#1676b4]"/>
        <span className="min-w-0 truncate">{file?.name||"Cari hesap ekstresi PDF seçin (en fazla 8 MB)"}</span>
        <input type="file" accept=".pdf,application/pdf" className="sr-only"
          onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setConfirmed(false);setError("");setSuccess("");}}/>
      </label>
      {url&&<iframe title="Cari hesap ekstresi PDF önizlemesi" src={url}
        className="h-[360px] w-full rounded-xl border border-slate-200"/>}
      <button type="button" disabled={!file||busy} onClick={()=>void analyze()}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123d6a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
        {busy?<Loader2 size={16} className="animate-spin"/>:<FileText size={17}/>}
        {busy?"İşleniyor…":"PDF'deki Tüm Hareketleri Analiz Et"}
      </button>
      <p className="text-[11px] leading-5 text-slate-500">
        Eski hareketler arşiv cari bakiyesine işlenir. Stok, banka, POS veya resmî
        e-fatura kayıtlarında yeniden satış / ödeme yapılmaz.
      </p>
    </div>
    <div className="min-w-0 space-y-3">
      {!preview?<div className="rounded-xl border border-[#e3eaf4] bg-white p-5 text-sm text-slate-500">
        Belgeyi seçip analiz edin. Cari numarası, işlem tarihleri, belge numaraları,
        tutarlar ve satış faturalarının ürünleri ayrı ayrı listelenecek.
      </div>:<>
        <div className="rounded-xl border border-[#dbe8f5] bg-[#f6faff] p-4">
          <h4 className="font-black text-[#183b62]">Belgeden Okunan Cari</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Cari No
              <input className={input+" mt-1"} maxLength={80}
                value={document?.party.sourceCariNo||""}
                onChange={e=>editParty("sourceCariNo",e.target.value)}/>
            </label>
            <label className="text-xs font-semibold text-slate-600">Cari Adı
              <input className={input+" mt-1"} maxLength={180}
                value={document?.party.name||""}
                onChange={e=>editParty("name",e.target.value)}/>
            </label>
          </div>
          <p className="mt-2 text-[11px] text-[#59718d]">
            {document?.pageCount} sayfa · {document?.party.sourceCompany||"Kaynak firma belirtilmedi"} ·
            Para birimi: {document?.party.currency} · {document?.party.periodStart||"?"} — {document?.party.periodEnd||"?"}
          </p>
          <p className="mt-2 text-xs font-bold text-[#2b5b89]">
            {preview.existingParty?
              "Eşleşen mevcut cari: "+preview.existingParty.name+" (#"+preview.existingParty.id+")":
              "Bu cari numarası bulunamadı; onaylanırsa yeni cari kartı açılacak."}
          </p>
        </div>
        {summary&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Hareket",document?.entries.length||0],["Fatura",summary.invoiceCount],
            ["Ürün Satırı",summary.lineCount],["Net Bakiye",fmt(summary.balance)],
          ].map(([k,v])=><div key={String(k)} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-500">{k}</p>
            <p className="mt-1 break-words text-sm font-black text-[#193d64]">{v}</p>
          </div>)}
        </div>}
        {summary&&<p className="text-xs text-slate-600">
          Borç: <strong>{fmt(summary.debit)}</strong> · Alacak: <strong>{fmt(summary.credit)}</strong>
          {document?.declaredClosingBalance!==null&&
            <> · Belgede son bakiye: <strong>{fmt(document?.declaredClosingBalance??0)}</strong></>}
        </p>}
        {preview.duplicate&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
          Bu dosya daha önce içe aktarılmış. Yeniden aktarım engellendi.
        </p>}
        {!sameParty&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Belgedeki cari adı, aynı cari numarasına sahip kayıtlı firmayla farklı. Aktarım öncesi cari bilgilerini doğrulayın.
        </p>}
        {!!summary?.mismatches.length&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <h5 className="flex items-center gap-2 font-black"><AlertTriangle size={16}/> Tutar kontrolü – kayıt öncesi düzeltme gerekli</h5>
          {summary.mismatches.map((x,i)=><p key={i} className="mt-1">{x}</p>)}
        </div>}
        {!!document?.warnings.length&&<details className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs">
          <summary className="cursor-pointer font-bold">PDF okuma uyarıları ({document.warnings.length})</summary>
          {document.warnings.map((w,i)=><p key={i} className="mt-1">{w}</p>)}
        </details>}
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-extrabold text-[#1a3a62]">Tüm Tarihli Hareketler</h5>
          <button type="button" className="text-xs font-semibold text-sky-700"
            onClick={()=>setExpandAll(v=>!v)}>{expandAll?"Kalemleri Kapat":"Fatura Kalemlerini Aç"}</button>
        </div>
        <div className="max-h-[470px] space-y-2 overflow-auto rounded-xl border border-[#e2e9f2] bg-white p-2">
          {document?.entries.map((row,i)=><details key={i} open={expandAll?true:undefined}
            className="rounded-lg border border-slate-200 p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs text-[#1b385a]">
              <ChevronDown size={14}/> <span className="font-bold">{i+1}. {kindLabel[row.kind]}</span>
              <span>{row.date} · {row.documentNo}</span>
              <span className="ml-auto font-extrabold">{fmt(row.debit||row.credit)} {row.debit>0?"Borç":"Alacak"}</span>
              {row.lines.length>0&&<span className="text-sky-700">({row.lines.length} kalem)</span>}
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-[11px]">İşlem Tarihi
                <input type="date" className={input} value={row.date}
                  onChange={e=>editRow(i,{date:e.target.value})}/>
              </label>
              <label className="text-[11px]">Vade Tarihi
                <input type="date" className={input} value={row.dueDate||""}
                  onChange={e=>editRow(i,{dueDate:e.target.value||null})}/>
              </label>
              <label className="text-[11px]">İşlem Türü
                <select className={input} value={row.kind}
                  onChange={e=>editRow(i,{kind:e.target.value as LegacyEntry["kind"]})}>
                  {Object.entries(kindLabel).map(([val,label])=><option key={val} value={val}>{label}</option>)}
                </select>
              </label>
              <label className="text-[11px]">Belge No
                <input className={input} value={row.documentNo}
                  onChange={e=>editRow(i,{documentNo:e.target.value})}/>
              </label>
              <label className="text-[11px]">Borç
                <input type="number" step="0.01" min="0" className={input} value={row.debit}
                  onChange={e=>editRow(i,{debit:num(e.target.value)})}/>
              </label>
              <label className="text-[11px]">Alacak
                <input type="number" step="0.01" min="0" className={input} value={row.credit}
                  onChange={e=>editRow(i,{credit:num(e.target.value)})}/>
              </label>
              <label className="text-[11px] sm:col-span-2 lg:col-span-3">Açıklama
                <input className={input} maxLength={500} value={row.description}
                  onChange={e=>editRow(i,{description:e.target.value})}/>
              </label>
            </div>
            {!!row.lines.length&&<div className="mt-3 space-y-2">
              <h6 className="text-[11px] font-bold">Fatura Ürün Satırları</h6>
              {row.lines.map((line,j)=><div key={j} className="grid gap-1.5 rounded-lg bg-[#f4f7fb] p-2 sm:grid-cols-6">
                <label className="text-[10px] sm:col-span-3">Ürün
                  <input className={input} value={line.productName}
                    onChange={e=>editLine(i,j,{productName:e.target.value})}/>
                </label>
                <label className="text-[10px]">Adet
                  <input type="number" step="0.001" min="0.001" className={input} value={line.quantity}
                    onChange={e=>editLine(i,j,{quantity:num(e.target.value)})}/>
                </label>
                <label className="text-[10px]">Birim Fiyat
                  <input type="number" step="0.01" min="0" className={input} value={line.unitPrice}
                    onChange={e=>editLine(i,j,{unitPrice:num(e.target.value)})}/>
                </label>
                <label className="text-[10px]">Satır Tutarı
                  <input type="number" step="0.01" min="0" className={input} value={line.lineTotal}
                    onChange={e=>editLine(i,j,{lineTotal:num(e.target.value)})}/>
                </label>
              </div>)}
            </div>}
          </details>)}
        </div>
        <label className="flex cursor-pointer gap-2 rounded-xl border border-[#dce9f7] bg-[#f5faff] p-3 text-xs leading-5">
          <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#165c94]"/>
          <span><strong>Kontrol ettim ve onaylıyorum.</strong> Tarihleri, borç/alacak tutarlarını,
            belge numaralarını ve fatura ürünlerini inceledim. Aktarılan tarihî kayıtların
            cari bakiyeyi etkileyeceğini biliyorum.</span>
        </label>
        <button type="button" onClick={()=>void importData()}
          disabled={busy||!confirmed||preview.duplicate||!sameParty||Boolean(summary?.mismatches.length)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0e426c] p-3 text-sm font-bold text-white disabled:opacity-40">
          {busy?<Loader2 size={16} className="animate-spin"/>:<ShieldCheck size={17}/>}
          Onayla · {document?.entries.length||0} Hareketi ve {summary?.lineCount||0} Fatura Kalemini İçe Aktar
        </button>
      </>}
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {success&&<p role="status" className="flex gap-2 rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-800"><CheckCircle2 size={16}/>{success}</p>}
    </div>
  </div>;
}
