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
/** PDF.js can merge neighboring table cells without whitespace, e.g.
 * "0,00 150,00250,00" or "ADET100,00". Split monetary lexemes by their
 * Turkish decimal comma rather than trusting the start x-position alone. */
function moneyTokens(text:string):number[]{
  return [...text.matchAll(/-?\d+(?:\.\d{3})*,\d{1,2}/g)]
    .map(match=>trMoney(match[0]))
    .filter((v):v is number=>v!==null);
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
  const normalized=label.toLocaleLowerCase("tr-TR")
    .replaceAll("ç","c").replaceAll("ş","s").replaceAll("ğ","g")
    .replaceAll("ı","i").replaceAll("ö","o").replaceAll("ü","u");
  if(/acilis/.test(normalized))return "opening";
  if(/satis/.test(normalized))return "sale";
  if(/alis/.test(normalized))return "purchase";
  if(/tahsil/.test(normalized))return "collection";
  if(/odeme/.test(normalized))return "payment";
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
      if(dateISO(dateRaw)){
        // Do not attach text after an unrecognized movement to the preceding
        // invoice. Preserve otherwise valid unknown movements as "other".
        current=null;
        if(!docNo){
          warnings.push("Sayfa "+(pageIndex+1)+": belge numarası okunamayan tarihli hareket atlandı.");
          continue;
        }
        const grouped=moneyTokens(collect(words,430,565));
        const sign=/\[A\]/i.test(balanceFlag)?-1:1;
        let dr=trMoney(debit)??0;
        let cr=trMoney(credit)??0;
        let rawBalance=trMoney(balance);
        if(grouped.length===3){
          // Debit, credit and running balance; even when PDF.js merged cells.
          [dr,cr,rawBalance]=grouped;
        }else if(grouped.length===2&&(!credit.trim()||!balance.trim())){
          // Two values must not be interpreted as debit + credit when the
          // second one could be the running balance.
          const previous=entries.at(-1)?.sourceBalance;
          const change=previous===null||previous===undefined?null:
            round(sign*grouped[1]-previous);
          if(change!==null&&Math.abs(Math.abs(change)-grouped[0])<=0.02&&grouped[0]>0){
            dr=change>0?grouped[0]:0;
            cr=change<0?grouped[0]:0;
            rawBalance=grouped[1];
          }else if(parsedKind==="opening"&&Math.abs(grouped[0]-grouped[1])<=0.02){
            dr=sign>0?grouped[0]:0;
            cr=sign<0?grouped[0]:0;
            rawBalance=grouped[1];
          }else if(credit.trim()&&!balance.trim()){
            [dr,cr]=grouped;
            rawBalance=null;
          }else{
            warnings.push("Belge "+docNo+": bitişik tutarlar kesin ayrıştırılamadı; hareket atlandı.");
            continue;
          }
        }else if(grouped.length!==3&&
          (moneyTokens(debit).length>1||moneyTokens(credit).length>1||
            moneyTokens(balance).length>1)){
          warnings.push("Belge "+docNo+": birleşik tutar sütunları ayrıştırılamadı; hareket atlandı.");
          continue;
        }
        if((dr===0)===(cr===0)){
          warnings.push("Belge "+docNo+": borç/alacak okunamadı veya iki taraf da dolu; hareket atlandı.");
          continue;
        }
        if(!parsedKind)warnings.push("Belge "+docNo+": işlem türü tanınmadı; 'Diğer' olarak gösterildi.");
        const entry:ImportedEntry={
          date:dateISO(dateRaw),dueDate:dateISO(due)||null,
          kind:parsedKind??"other",documentNo:docNo,
          description:desc||type,debit:dr,credit:cr,
          sourceBalance:rawBalance===null?null:round(sign*rawBalance),
          sourcePage:pageIndex+1,lines:[],
        };
        entries.push(entry);
        current=entry.kind==="sale"||entry.kind==="purchase"?entry:null;
        continue;
      }
      const name=collect(words,85,241);
      const qtyRaw=collect(words,240,269);
      const unitRaw=collect(words,269,306);
      const unit=unitRaw.match(/^(ADET|AD|KG|LT|LİTRE|PAKET|KOLİ|PCS|SET)/i)?.[0]||unitRaw;
      const price=collect(words,305,375);
      const discounted=collect(words,375,435);
      const total=collect(words,435,477);
      const monetary=moneyTokens(collect(words,269,517));
      const quantityRaw=trMoney(qtyRaw);
      const quantity=quantityRaw===null?null:Math.round(quantityRaw*1000)/1000;
      const lineTotal=trMoney(total)??(monetary.length>=3?monetary.at(-1)??null:null);
      if(current&&name&&!/^(?:toplam|ara toplam|genel toplam|sayfa toplamı)\b/i.test(name)&&
        quantity!==null&&quantity>0&&lineTotal!==null&&unit){
        const priceAmount=trMoney(price)??(monetary.length>=2?monetary[0]:0);
        const discountedAmount=trMoney(discounted)??(monetary.length>=3?monetary[monetary.length-2]:null);
        const item={
          productName:name,quantity,unit,unitPrice:priceAmount,
          discountedUnitPrice:discountedAmount,lineTotal,
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
  // An invoice can continue on the next page, but any new movement closes it.
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
  }finally{await task.destroy();}
  return pages;
}
