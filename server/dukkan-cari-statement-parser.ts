import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {z} from "zod";

export const importedLineSchema=z.object({
  productName:z.string().trim().min(1).max(500),
  quantity:z.number().finite().positive().max(99999999),
  unit:z.string().trim().min(1).max(24),
  unitPrice:z.number().finite().min(0).max(999999999),
  discountedUnitPrice:z.number().finite().min(0).max(999999999).nullable(),
  lineTotal:z.number().finite().min(0).max(999999999),
}).strict();
export const importedEntrySchema=z.object({
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  kind:z.enum(["opening","sale","purchase","collection","payment","other"]),
  documentNo:z.string().trim().min(1).max(80),
  description:z.string().trim().max(500),
  debit:z.number().finite().min(0).max(999999999),
  credit:z.number().finite().min(0).max(999999999),
  sourceBalance:z.number().finite().nullable(),
  sourcePage:z.number().int().min(1).max(200),
  lines:z.array(importedLineSchema).max(500),
}).strict().refine(row=>row.debit===0!== (row.credit===0),{
  message:"Her harekette borç veya alacak taraflarından yalnızca biri dolu olmalıdır",
}).refine(row=>Number.isFinite(Date.parse(row.date))&&
  (row.dueDate===null||Number.isFinite(Date.parse(row.dueDate))),{
  message:"Tarih geçersiz",
});
export const importedStatementSchema=z.object({
  party:z.object({
    name:z.string().trim().min(2).max(180),
    sourceCariNo:z.string().trim().min(1).max(80),
    currency:z.string().trim().min(2).max(12),
    sourceCompany:z.string().trim().max(180),
    reportDate:z.string().trim().max(10),
    periodStart:z.string().trim().max(10),
    periodEnd:z.string().trim().max(10),
  }).strict(),
  entries:z.array(importedEntrySchema).min(1).max(1500),
  declaredClosingBalance:z.number().finite().nullable(),
  warnings:z.array(z.string().max(300)).max(100),
  pageCount:z.number().int().min(1).max(200),
}).strict();
export type ImportedStatement=z.infer<typeof importedStatementSchema>;
export type ImportedEntry=z.infer<typeof importedEntrySchema>;
type Word={x:number;y:number;value:string};
type PageWords=Word[];

export function trMoney(value:string):number|null{
  const raw=value.trim().replace(/\s/g,"");
  const match=raw.match(/-?\d[\d.,]*/);
  if(!match)return null;
  let number=match[0];
  if(number.includes(","))number=number.replace(/\./g,"").replace(",",".");
  else if((number.match(/\./g)||[]).length>1)number=number.replace(/\./g,"");
  const parsed=Number(number);
  return Number.isFinite(parsed)?Math.round(parsed*100)/100:null;
}
function dateISO(s:string):string{
  const m=s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m?m[3]+"-"+m[2]+"-"+m[1]:"";
}
function collect(words:Word[],min:number,max:number):string{
  return words.filter(v=>v.x>=min&&v.x<max)
    .sort((a,b)=>a.x-b.x).map(w=>w.value).join(" ").replace(/\s+/g," ").trim();
}
function groupLines(words:PageWords):{y:number;words:Word[]}[]{
  const sorted=words.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines:{y:number;words:Word[]}[]=[];
  for(const word of sorted){
    let target=lines.find(row=>Math.abs(row.y-word.y)<2.7);
    if(!target){target={y:word.y,words:[]};lines.push(target);}
    target.words.push(word);
  }
  return lines.sort((a,b)=>a.y-b.y);
}
function kindFor(label:string):ImportedEntry["kind"]|null{
  const normalized=label.toLocaleLowerCase("tr-TR");
  if(/açılış/.test(normalized))return "opening";
  if(/satış/.test(normalized))return "sale";
  if(/alış/.test(normalized))return "purchase";
  if(/tahsil/.test(normalized))return "collection";
  if(/ödeme/.test(normalized))return "payment";
  return null;
}
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export function parsePositionedCariStatement(pages:PageWords[]):ImportedStatement{
  if(!pages.length||pages.length>200)throw Error("Belgede sayfa bulunamadı veya limit aşıldı");
  const entries:ImportedEntry[]=[];
  const warnings:string[]=[];
  let current:ImportedEntry|null=null;
  let partyName="",code="",currency="TL",company="",reportDate="",periodStart="",periodEnd="";
  let declaredClosingBalance:number|null=null;
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
    const lines=groupLines(pages[pageIndex]);
    for(const row of lines){
      const {y,words}=row;
      if(y>=41&&y<60){
        if(!company)company=collect(words,110,348);
        if(!reportDate)reportDate=dateISO(collect(words,526,590));
      }
      if(y>=62&&y<80){
        if(!code)code=collect(words,110,330);
        const range=collect(words,458,595).match(/\d{2}\.\d{2}\.\d{4}/g);
        if(range?.length===2){periodStart=dateISO(range[0]);periodEnd=dateISO(range[1]);}
      }
      if(y>=80&&y<98&&!partyName)partyName=collect(words,110,365);
      if(y>=98&&y<116){
        const curr=collect(words,110,175);
        if(curr)currency=curr;
      }
      if(y<151||y>758)continue;
      const dateRaw=collect(words,26,85);
      const due=collect(words,85,145);
      const type=collect(words,145,214);
      const docNo=collect(words,214,272);
      const desc=collect(words,272,433);
      const debit=collect(words,432,477);
      const credit=collect(words,477,521);
      const balance=collect(words,520,564);
      const balanceFlag=collect(words,563,595);
      const parsedKind=kindFor(type);
      if(dateISO(dateRaw)&&parsedKind&&docNo){
        const dr=trMoney(debit)||0,cr=trMoney(credit)||0;
        if(!dr&&!cr){warnings.push("Belge "+docNo+": borç/alacak tutarı okunamadı.");continue;}
        const rawBalance=trMoney(balance);
        const sign=/\[A\]/i.test(balanceFlag)?-1:1;
        const entry:ImportedEntry={
          date:dateISO(dateRaw),dueDate:dateISO(due)||null,kind:parsedKind,documentNo:docNo,
          description:desc,debit:dr,credit:cr,
          sourceBalance:rawBalance===null?null:round(sign*rawBalance),
          sourcePage:pageIndex+1,lines:[],
        };
        entries.push(entry);
        current=entry;
        continue;
      }
      const name=collect(words,85,241);
      const qtyRaw=collect(words,240,269);
      const unit=collect(words,269,306);
      const price=collect(words,305,375);
      const discounted=collect(words,375,435);
      const total=collect(words,435,477);
      const quantity=trMoney(qtyRaw);
      const lineTotal=trMoney(total);
      if(current&&name&&quantity!==null&&quantity>0&&lineTotal!==null&&unit){
        const item={
          productName:name,quantity,unit,unitPrice:trMoney(price)||0,
          discountedUnitPrice:trMoney(discounted),lineTotal,
        };
        current.lines.push(item);
        continue;
      }
      // Wrapped descriptions continue a product row and sometimes continue on
      // the first row of the following PDF page. Never treat them as new items.
      if(current?.lines.length&&name&&
        !/toplam|geciken|önceki|sayfa|tarih|rapor/i.test(name)&&
        !dateISO(dateRaw)&&!parsedKind&&qtyRaw===""&&
        total===""&&y<720){
        const last=current.lines[current.lines.length-1];
        if(last.productName.length+name.length<480)
          last.productName=(last.productName+" "+name).trim();
      }
      // The totals on each printed page are cumulative; only the final page
      // summary can be used as an independent reconciliation checkpoint.
      if(pageIndex===pages.length-1&&/Toplam\s+Miktar/i.test(dateRaw)){
        // Final balance is separately verified from all debit/credit entries.
        const lastBalance=entries.at(-1)?.sourceBalance;
        if(lastBalance!==undefined&&lastBalance!==null)declaredClosingBalance=lastBalance;
      }
    }
  }
  if(!partyName||!code||!entries.length)
    throw Error("Cari hesap ekstresi düzeni tanınamadı. Cari adı, kodu veya işlem satırları okunamadı.");
  // The same invoice may continue on another page. Keep the last active
  // invoice attached to its product rows across page boundaries.
  entries.forEach(e=>{
    if(e.lines.length&&["sale","purchase"].includes(e.kind)){
      const linesTotal=round(e.lines.reduce((sum,v)=>sum+v.lineTotal,0));
      const amount=round(e.debit+e.credit);
      if(Math.abs(linesTotal-amount)>0.05)
        warnings.push("Fatura "+e.documentNo+": kalem toplamı "+linesTotal+" TL, belge tutarı "+amount+" TL. Manuel doğrulama gerekli.");
    }
  });
  const expected=round(entries.reduce((v,e)=>v+e.debit-e.credit,0));
  const lastBalance=entries.at(-1)?.sourceBalance;
  if(lastBalance!==null&&lastBalance!==undefined&&
    Math.abs(expected-lastBalance)>0.02)
    warnings.push("Ekstre tutarları uyuşmuyor: hareket neti "+expected+
      " TL, son belge bakiyesi "+lastBalance+" TL.");
  return importedStatementSchema.parse({
    party:{name:partyName,sourceCariNo:code,currency,
      sourceCompany:company,reportDate,periodStart,periodEnd},
    entries,declaredClosingBalance:lastBalance??declaredClosingBalance,
    warnings:warnings.slice(0,100),pageCount:pages.length,
  });
}

export async function extractPositionedPdfWords(bytes:Buffer):Promise<PageWords[]>{
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true});
  const doc=await task.promise;
  if(doc.numPages>200)throw Error("En fazla 200 sayfalık ekstre destekleniyor");
  const pages:PageWords[]=[];
  try{
    for(let index=1;index<=doc.numPages;index++){
      const page=await doc.getPage(index);
      const viewport=page.getViewport({scale:1});
      const contents=await page.getTextContent();
      const scaleX=595/viewport.width,scaleY=842/viewport.height;
      const words:Word[]=[];
      for(const item of contents.items){
        if(!("str" in item)||!item.str.trim())continue;
        words.push({x:item.transform[4]*scaleX,
          y:(viewport.height-item.transform[5])*scaleY,
          value:item.str.trim()});
      }
      pages.push(words);
      page.cleanup();
    }
  }finally{await doc.destroy();}
  return pages;
}
