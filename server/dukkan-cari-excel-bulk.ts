import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { parseXlsxRows } from "./dukkan-xlsx-reader";

type CariType = "customer" | "supplier" | "both";
type ParsedRow = { row:number; name:string; sourceCariNo:string; accountCode:string; taxNumber:string;
  city:string; phone:string; type:CariType; cents:number; };
type Candidate = {id:string;name:string;sourceCariNo:string;accountCode:string;taxNumber:string};
type PreviewRow = ParsedRow & {partyId:string|null; match:"existing"|"new"|"conflict"|"skipped"; oldCents:number; afterCents:number; postingCents:number; issue:string|null; candidates:Candidate[];resolution:string;skipped:boolean};
const norm=(s:unknown)=>String(s||"").trim().toLocaleLowerCase("tr-TR")
  .replace(/ı/g,"i").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const compact=(s:unknown)=>String(s||"").trim().slice(0,180);
function invalid(message:string):never {throw Object.assign(new Error(message),{status:422});}
function cents(value:string):number {
  let s=String(value||"").trim();
  if(!s||s==="—"||s==="-")return 0;
  let sign=1;
  if(/^\(.*\)$/.test(s)){sign=-1;s=s.slice(1,-1);}
  s=s.replace(/[₺\s]/g,"").replace(/(?:TL|TRY)/gi,"");
  if(s.startsWith("-")){sign*=-1;s=s.slice(1);}
  if(s.startsWith("+"))s=s.slice(1);
  if(!/^[\d.,]+$/.test(s))invalid("Geçersiz Excel tutarı: "+value);
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  if(comma>=0&&dot>=0){
    const decimal=comma>dot?",":".";
    s=decimal===","?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
  }else if(comma>=0){
    s=s.replace(",",".");
  }else if((s.match(/\./g)||[]).length>1){
    s=s.replace(/\./g,"");
  }else if(dot>=0&&s.length-dot-1===3&&s.slice(0,dot).length<=3){
    s=s.replace(".","");
  }
  if(!/^\d+(?:\.\d{1,2})?$/.test(s))invalid("Tutar iki ondalık basamakla okunamadı: "+value);
  const valueCents=Math.round(Number(s)*100)*sign;
  if(!Number.isSafeInteger(valueCents)||Math.abs(valueCents)>99_999_999_999)invalid("Cari tutarı sınırı aşıyor.");
  return valueCents;
}
function mapping(rows:string[][]) {
  let h=-1, m:Record<string,number>={};
  const labels:Record<string,string[]>={
    name:["cari adi","cari unvani","cari unvan","firma","firma adi","firma unvani","ad soyad","unvan","musteri adi","tedarikci adi","hesap adi"],
    sourceCariNo:["cari no","cari numarasi","cari kodu","cari kod","no"],
    accountCode:["hesap kodu","hesap no","hesap numarasi","muhasebe kodu"],
    taxNumber:["vergi no","vergi numarasi","vkn","tckn","tc kimlik no"],
    phone:["telefon","cep telefonu","tel"],
    city:["il","sehir","il adi"],
    type:["cari tipi","hesap tipi","tur","tip"],
    debit:["borc bakiyesi","bakiye borc","borc bakiye","borc"],
    credit:["alacak bakiyesi","bakiye alacak","alacak bakiye","alacak"],
    balance:["son bakiye","net bakiye","bakiye tl","bakiye","mevcut bakiye"],
  };
  const normalized=Object.fromEntries(Object.entries(labels).map(([k,vs])=>[k,vs.map(norm)]));
  for(let n=0;n<Math.min(18,rows.length);n++){
    const found:Record<string,number>={};
    rows[n].forEach((v,i)=>{
      const key=norm(v);
      for(const [field,ls] of Object.entries(normalized)){
        if(ls.includes(key)&&found[field]===undefined)found[field]=i;
      }
    });
    if(found.name!==undefined&&(found.balance!==undefined||(found.debit!==undefined&&found.credit!==undefined)||
      found.debit!==undefined||found.credit!==undefined)){h=n;m=found;break;}
  }
  if(h<0)invalid("Excel başlıkları bulunamadı. 'Cari Adı' ve 'Borç Bakiyesi / Alacak Bakiyesi' veya 'Bakiye' sütunları gerekli.");
  return {header:h,m};
}
export function parseCariExcelRows(bytes:Buffer):ParsedRow[]{
  const rows=parseXlsxRows(bytes);
  const {header,m}=mapping(rows);
  const exportedCreditReport=rows.slice(0,header).some(row=>row.some(value=>norm(value).includes("alacaklicariler")));
  const read=(r:string[],key:string)=>m[key]===undefined?"":String(r[m[key]]||"").trim();
  const items:ParsedRow[]=[];
  for(let i=header+1;i<rows.length;i++){
    const r=rows[i],name=compact(read(r,"name"));
    if(!name||/^(genel\s*toplam|toplam\s*bakiye|toplam)$/i.test(name))continue;
    const a=m.debit===undefined?0:cents(read(r,"debit"));
    const b=m.credit===undefined?0:cents(read(r,"credit"));
    const hasDirectional=m.debit!==undefined||m.credit!==undefined;
    let net=hasDirectional?a-b:cents(read(r,"balance"));
    // Legacy Alacaklı Cariler exports display credit amounts as positive in the report.
    if(!hasDirectional&&exportedCreditReport)net=-Math.abs(net);
    // Exported signed Bakiye report carries credit balances as negative numbers.
    const rawType=norm(read(r,"type"));
    let type:CariType="customer";
    if(rawType.includes("tedarikci")||rawType.includes("satici"))type=rawType.includes("musteri")?"both":"supplier";
    else if(rawType.includes("heriki")||rawType.includes("both"))type="both";
    if((m.debit!==undefined||m.credit!==undefined)&&(a<0||b<0))
      invalid("Satır "+(i+1)+": Borç/Alacak sütunlarına negatif değer yazılamaz. Tek imzalı Bakiye sütunu kullanın.");
    items.push({row:i+1,name,sourceCariNo:compact(read(r,"sourceCariNo")).slice(0,80),
      accountCode:compact(read(r,"accountCode")).slice(0,80),taxNumber:read(r,"taxNumber").slice(0,30),
      city:compact(read(r,"city")).slice(0,120),phone:compact(read(r,"phone")).slice(0,40),
      type,cents:net});
  }
  if(!items.length)invalid("Excel'de geçerli cari satırı bulunamadı.");
  if(items.length>500)invalid("Tek belgede en fazla 500 cari kaydı işlenebilir.");
  return items;
}
const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
/** An exported debtor/creditor report is a snapshot of this store's ledger,
 * not a second receivable/payable transaction. Markers are inside the XLSX,
 * not inferred from the uploaded filename.
 */
function reportMetadata(bytes:Buffer):{kind:"debt"|"credit";storeName:string;reportDate:string}|null{
  const rows=parseXlsxRows(bytes);
  const heading=norm(rows[0]?.[0]);
  const kind=heading==="caliskandukkanborclucariler"?"debt":
    heading==="caliskandukkanalacaklicariler"?"credit":null;
  if(!kind)return null;
  const storeHeader=String(rows[1]?.[0]||"");
  const storeName=/^\s*Mağaza\s*:\s*(.+?)\s*$/iu.exec(storeHeader)?.[1]||"";
  const date=/^\s*Rapor tarihi\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/iu.exec(String(rows[1]?.[3]||""))?.[1]||"";
  const actualHeaders=rows[4]||[];
  if(!storeName||!date||norm(actualHeaders[0])!=="carino"||
     norm(actualHeaders[1])!=="hesapkodu"||norm(actualHeaders[2])!=="cariadi"||
     norm(actualHeaders[9])!=="bakiyetl")
    invalid("Çalışkan Dükkân raporunun başlıkları eksik veya değiştirilmiş. Orijinal Excel şablonunu kullanın.");
  return {kind,storeName,reportDate:date};
}
/**
 * Match by the complete set of identifiers, but resolve repeated names with
 * distinct account numbers safely: a duplicate key is the strongest available
 * identity (cari number, account code, tax number, then company name).
 * Conflicting identities must be reviewed individually; no auto-post on them.
 */
export type CariExcelResolutions = Record<string,string>;
function cleanResolutions(value:CariExcelResolutions):CariExcelResolutions {
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.keys(value).length>500)invalid("Excel eşleştirme kararları geçersiz.");
  for(const [row,decision] of Object.entries(value)){
    if(!/^[1-9]\d{0,5}$/.test(row)||typeof decision!=="string"||
       !(/^(skip|party:[1-9]\d{0,17})$/.test(decision)))
      invalid("Cari eşleştirme kararı geçersiz.");
  }
  return value;
}
async function prepared(db:Pool|PoolClient,storeId:number,bytes:Buffer,
  decisions:CariExcelResolutions={}) {
  const resolutions=cleanResolutions(decisions);
  const items=parseCariExcelRows(bytes),sha256=hash(bytes);
  const report=reportMetadata(bytes);
  if(report){
    const storeResult=await db.query("SELECT name FROM dukkan_stores WHERE id=$1",[storeId]);
    const currentName=String(storeResult.rows[0]?.name||"");
    if(!currentName||norm(report.storeName)!==norm(currentName))
      invalid("Bu cari raporu başka bir mağazaya aittir. Muhasebe bakiyeleri yanlış mağazaya aktarılamaz.");
  }
  const existing=await db.query(
    "SELECT p.id,p.name,p.source_cari_no,p.account_code,p.tax_number,COALESCE(SUM(e.debit-e.credit),0) AS balance "+
    "FROM dukkan_parties p LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id "+
    "WHERE p.store_id=$1 GROUP BY p.id ORDER BY p.id",[storeId]);
  const existingRows=existing.rows;
  const batch=await db.query("SELECT id FROM dukkan_cari_excel_batches WHERE store_id=$1 AND sha256=$2",[storeId,sha256]);
  const seen=new Set<string>();
  const output:PreviewRow[]=items.map(item=>{
    // These identifiers are OR candidates, not proof that all candidates
    // are the same party. Never silently choose one of several candidates.
    const byNo=item.sourceCariNo?existingRows.filter(p=>norm(p.source_cari_no)===norm(item.sourceCariNo)):[];
    const byAccount=item.accountCode?existingRows.filter(p=>norm(p.account_code)===norm(item.accountCode)):[];
    const byTax=item.taxNumber?existingRows.filter(p=>norm(p.tax_number)===norm(item.taxNumber)):[];
    const byName=existingRows.filter(p=>norm(p.name)===norm(item.name));
    // A report uniquely identifies the account by Cari No, then account/tax
    // code. Another account with the same name must not create a false conflict.
    const strong=byNo.length?byNo:byAccount.length?byAccount:byTax.length?byTax:byName;
    const matched=strong.length===1?strong[0]:null;
    const matches=existingRows.filter(p=>byNo.includes(p)||byAccount.includes(p)||byTax.includes(p)||byName.includes(p));
    const incompatibleIdentifiers=[byNo,byAccount,byTax].some(group=>
      group.length&&matched&&!group.some(p=>String(p.id)===String(matched.id)));
    // Prior implementation counted every identifier including repeated names.
    // Distinct company codes must not be rejected solely because names repeat.
    const fingerprint=item.sourceCariNo?"no:"+norm(item.sourceCariNo):
      item.accountCode?"account:"+norm(item.accountCode):
      item.taxNumber?"tax:"+norm(item.taxNumber):"name:"+norm(item.name);
    const repeated=seen.has(fingerprint);
    seen.add(fingerprint);
    const candidates:Candidate[]=matches.slice(0,40).map(p=>({
      id:String(p.id),name:String(p.name||""),
      sourceCariNo:String(p.source_cari_no||""),accountCode:String(p.account_code||""),
      taxNumber:String(p.tax_number||"")
    }));
    let issue:string|null=null;
    if(incompatibleIdentifiers)issue="Cari numarası, hesap kodu veya vergi numarası farklı hesaplara işaret ediyor; doğru cariyi seçin.";
    else if(!matched&&matches.length>1)issue="Birden çok cari kaydıyla eşleşiyor; hangi cariye ekleneceğini seçin.";
    else if(report&&!matched)issue="Bu rapor satırındaki cari mevcut mağazada bulunamadı; yanlış cari açılmasını önlemek için kontrol edin.";
    else if(repeated)issue="Excel içinde aynı cari numarası/kodu tekrar ediyor; mükerrer satırı atlayın.";
    else if(matched&&item.sourceCariNo&&matched.source_cari_no&&norm(matched.source_cari_no)!==norm(item.sourceCariNo))
      issue="Excel cari numarası mevcut hesapla farklı; aynı firmaysa eşleşmeyi doğrulayın.";
    else if(matched&&item.accountCode&&matched.account_code&&norm(matched.account_code)!==norm(item.accountCode))
      issue="Hesap kodu mevcut kayıtla farklı; eşleşmeyi doğrulayın.";
    else if(matched&&item.taxNumber&&matched.tax_number&&norm(matched.tax_number)!==norm(item.taxNumber))
      issue="Vergi numarası farklı; kimliği doğrulayın.";
    else if(matched&&norm(matched.name)!==norm(item.name))
      issue="Firma adı mevcut cariyle farklı; doğru hesabı seçin.";

    const resolution=resolutions[String(item.row)]||"";
    let selected=matched;
    let skipped=false;
    if(resolution==="skip"){
      skipped=true;
      issue=null;
    }else if(resolution.startsWith("party:")){
      if(repeated){
        issue="Bu cari numarası/kodu Excel içinde tekrar ediyor. Tekrar eden tutar atlanmalı; aynı cari iki kez işlenmez.";
      }else{
        const id=resolution.slice("party:".length);
        const chosen=matches.find(x=>String(x.id)===id);
        if(!chosen)issue="Seçilen cari bu satırın kimlik bilgileriyle eşleşmiyor; yeniden kontrol edin.";
        else{selected=chosen;issue=null;}
      }
    }
    const oldCents=selected?Math.round(Number(selected.balance)*100):0;
    // Report snapshots replace the TARGET balance via one signed adjustment.
    // Regular external Excel retains the existing additive behaviour.
    const postingCents=skipped?0:report?item.cents-oldCents:item.cents;
    const afterCents=oldCents+postingCents;
    return {...item,partyId:selected?String(selected.id):null,
      match:skipped?"skipped":issue?"conflict":selected?"existing":"new",
      oldCents,afterCents,postingCents,issue,candidates,
      resolution,skipped};
  });
  const existingCount=output.filter(x=>x.match==="existing").length;
  const createdCount=output.filter(x=>x.match==="new").length;
  const skippedCount=output.filter(x=>x.skipped).length;
  // Never post an otherwise successful file when an unrelated decision is
  // silently passed for a non-existent row, e.g. a stale browser preview.
  const knownRows=new Set(items.map(x=>String(x.row)));
  if(Object.keys(resolutions).some(key=>!knownRows.has(key)))
    invalid("Excel satırları değişti. Eşleştirmeleri yeniden kontrol edin.");
  const stateFingerprint=hash(Buffer.from(JSON.stringify({
    sha256,sourceKind:report?"report_snapshot":"external_excel",
    rows:output.map(x=>[x.row,x.partyId,x.oldCents,x.cents,x.postingCents,x.resolution,x.issue])
  })));
  return {stateFingerprint,sha256,duplicate:batch.rowCount!>0,rows:output,
    existing:existingCount,created:createdCount,skipped:skippedCount,
    conflicts:output.filter(x=>x.issue).length,
    sourceKind:report?"report_snapshot" as const:"external_excel" as const,
    reportDate:report?.reportDate||null,
    unchanged:output.filter(x=>!x.skipped&&!x.issue&&x.postingCents===0).length,
    changed:output.filter(x=>!x.skipped&&!x.issue&&x.postingCents!==0).length,
    totalAdjustmentCents:output.filter(x=>!x.skipped).reduce((sum,row)=>sum+row.postingCents,0)
  };
}
export async function previewCariExcel(db:Pool,storeId:number,bytes:Buffer,
  resolutions:CariExcelResolutions={}) {
  return prepared(db,storeId,bytes,resolutions);
}
export async function ensureCariExcelSchema(db:Pool){
  await db.query(
    "CREATE TABLE IF NOT EXISTS dukkan_cari_excel_batches ("+
    "id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),"+
    "sha256 CHAR(64) NOT NULL,filename TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),"+
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(store_id,sha256));"+
    "ALTER TABLE dukkan_cari_excel_batches ADD COLUMN IF NOT EXISTS resolutions JSONB NOT NULL DEFAULT '{}'::jsonb;"+
    "ALTER TABLE dukkan_cari_excel_batches ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'external_excel';"+
    "CREATE TABLE IF NOT EXISTS dukkan_cari_excel_rows ("+
    "id BIGSERIAL PRIMARY KEY,batch_id BIGINT NOT NULL REFERENCES dukkan_cari_excel_batches(id) ON DELETE CASCADE,"+
    "store_id BIGINT NOT NULL,party_id BIGINT NOT NULL,source_row INTEGER NOT NULL,"+
    "amount NUMERIC(18,2) NOT NULL,entry_id BIGINT REFERENCES dukkan_cari_entries(id),"+
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(batch_id,source_row));"+
    "ALTER TABLE dukkan_cari_excel_rows ADD COLUMN IF NOT EXISTS source_balance NUMERIC(18,2);"
  );
}
export async function importCariExcel(db:Pool,storeId:number,actor:number,
  filename:string,bytes:Buffer,expectedSha:string,resolutions:CariExcelResolutions,expectedFingerprint:string){
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize same-store XLSX imports across independent app instances.
    await client.query("SELECT pg_advisory_xact_lock($1,$2)",[31031,storeId]);
    const preview=await prepared(client,storeId,bytes,resolutions);
    if(preview.sha256!==expectedSha)invalid("Excel dosyası önizlemeden sonra değişmiş; yeniden analiz edin.");
    if(preview.stateFingerprint!==expectedFingerprint)
      throw Object.assign(new Error("Excel analizinden sonra cari bakiyesi veya eşleşme değişti. Lütfen yeniden analiz edip güncel bakiyeyi kontrol edin."),{status:409});
    if(preview.duplicate)throw Object.assign(new Error("Bu Excel belgesi daha önce içe aktarılmıştır. Bakiyeler yeniden eklenmedi."),{status:409});
    if(preview.conflicts)invalid("Cari eşleşmelerinde hata var. Bakiyeler kaydedilmedi; belgeyi kontrol edin.");
    if(preview.rows.every(x=>x.skipped))invalid("İçe aktarılacak cari bulunamadı; tüm satırlar atlanmış.");
    if(preview.sourceKind==="report_snapshot"&&preview.changed===0){
      await client.query("COMMIT");
      return {batchId:null,imported:0,matched:preview.existing,created:0,
        skipped:preview.skipped,unchanged:preview.unchanged,
        noChanges:true,netAmount:"0.00"};
    }
    const batch=await client.query(
      "INSERT INTO dukkan_cari_excel_batches(store_id,sha256,filename,created_by,resolutions,source_kind) VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id",
      [storeId,expectedSha,filename,actor,JSON.stringify(resolutions),preview.sourceKind]
    );
    for(const row of preview.rows){
      if(row.skipped)continue;
      let party=row.partyId;
      if(!party){
        const created=await client.query(
          "INSERT INTO dukkan_parties(store_id,name,type,source_cari_no,account_code,city,tax_number,phone) "+
          "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          [storeId,row.name,row.type,row.sourceCariNo||null,row.accountCode||null,
            row.city||null,row.taxNumber||null,row.phone||null]
        );
        party=String(created.rows[0].id);
      }
      let entryId:null|string=null;
      if(row.postingCents!==0){
        const posted=await client.query(
          "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description) "+
          "VALUES($1,$2,$3,$4,$5) RETURNING id",
          [storeId,party,row.postingCents>0?(row.postingCents/100).toFixed(2):"0.00",
            row.postingCents<0?(-row.postingCents/100).toFixed(2):"0.00",
            (preview.sourceKind==="report_snapshot"?"Çalışkan raporu bakiye mutabakat farkı":"AI Excel cari bakiye aktarımı")+
              " · "+filename.slice(0,110)+" · Satır "+row.row]
        );
        entryId=String(posted.rows[0].id);
      }
      await client.query(
        "INSERT INTO dukkan_cari_excel_rows(batch_id,store_id,party_id,source_row,amount,entry_id,source_balance) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7)",
        [batch.rows[0].id,storeId,party,row.row,(row.postingCents/100).toFixed(2),entryId,(row.cents/100).toFixed(2)]
      );
    }
    await client.query("COMMIT");
    return {batchId:String(batch.rows[0].id),imported:preview.changed,
      matched:preview.existing,created:preview.created,skipped:preview.skipped,
      unchanged:preview.unchanged,noChanges:false,sourceKind:preview.sourceKind,
      netAmount:(preview.totalAdjustmentCents/100).toFixed(2)};
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
