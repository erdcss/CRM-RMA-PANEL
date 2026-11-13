import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { parseXlsxRows } from "./dukkan-xlsx-reader";

type CariType = "customer" | "supplier" | "both";
type ParsedRow = { row:number; name:string; sourceCariNo:string; accountCode:string; taxNumber:string;
  city:string; phone:string; type:CariType; cents:number; };
type PreviewRow = ParsedRow & {partyId:string|null; match:"existing"|"new"|"conflict"; oldCents:number; afterCents:number; issue:string|null};
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
async function prepared(db:Pool|PoolClient,storeId:number,bytes:Buffer) {
  const items=parseCariExcelRows(bytes),sha256=hash(bytes);
  const existing=await db.query(
    "SELECT p.id,p.name,p.source_cari_no,p.account_code,p.tax_number,COALESCE(SUM(e.debit-e.credit),0) AS balance "+
    "FROM dukkan_parties p LEFT JOIN dukkan_cari_entries e ON e.store_id=p.store_id AND e.party_id=p.id "+
    "WHERE p.store_id=$1 GROUP BY p.id ORDER BY p.id",[storeId]);
  const existingRows=existing.rows;
  const batch=await db.query("SELECT id FROM dukkan_cari_excel_batches WHERE store_id=$1 AND sha256=$2",[storeId,sha256]);
  const seen=new Set<string>();
  const output:PreviewRow[]=items.map(item=>{
    const keys=[item.sourceCariNo&&"no:"+norm(item.sourceCariNo),
      item.accountCode&&"account:"+norm(item.accountCode),item.taxNumber&&"tax:"+norm(item.taxNumber),
      "name:"+norm(item.name)].filter(Boolean) as string[];
    const matches=existingRows.filter(p=>
      (item.sourceCariNo&&norm(p.source_cari_no)===norm(item.sourceCariNo))||
      (item.accountCode&&norm(p.account_code)===norm(item.accountCode))||
      (item.taxNumber&&norm(p.tax_number)===norm(item.taxNumber))||
      (norm(p.name)===norm(item.name)));
    const matched=matches.length===1?matches[0]:null;
    const duplicate=keys.some(k=>seen.has(k));
    keys.forEach(k=>seen.add(k));
    let issue:string|null=null;
    if(matches.length>1)issue="Birden çok cari kaydıyla eşleşiyor; manuel kontrol gerekli.";
    else if(duplicate)issue="Belgede mükerrer cari bulundu; tekrar bakiye eklenemez.";
    else if(matched&&item.sourceCariNo&&matched.source_cari_no&&norm(matched.source_cari_no)!==norm(item.sourceCariNo))
      issue="Cari numarası mevcut kayıtla çelişiyor.";
    else if(matched&&item.accountCode&&matched.account_code&&norm(matched.account_code)!==norm(item.accountCode))
      issue="Hesap kodu mevcut kayıtla çelişiyor.";
    else if(matched&&item.taxNumber&&matched.tax_number&&norm(matched.tax_number)!==norm(item.taxNumber))
      issue="Vergi numarası mevcut kayıtla çelişiyor.";
    const oldCents=matched?Math.round(Number(matched.balance)*100):0;
    return {...item,partyId:matched?String(matched.id):null,match:issue?"conflict":matched?"existing":"new",
      oldCents,afterCents:oldCents+item.cents,issue};
  });
  return {sha256,duplicate:batch.rowCount!>0,rows:output,
    existing:output.filter(x=>x.match==="existing").length,
    created:output.filter(x=>x.match==="new").length,
    conflicts:output.filter(x=>x.issue).length};
}
export async function previewCariExcel(db:Pool,storeId:number,bytes:Buffer){
  return prepared(db,storeId,bytes);
}
export async function ensureCariExcelSchema(db:Pool){
  await db.query(
    "CREATE TABLE IF NOT EXISTS dukkan_cari_excel_batches ("+
    "id BIGSERIAL PRIMARY KEY,store_id BIGINT NOT NULL REFERENCES dukkan_stores(id),"+
    "sha256 CHAR(64) NOT NULL,filename TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),"+
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(store_id,sha256));"+
    "CREATE TABLE IF NOT EXISTS dukkan_cari_excel_rows ("+
    "id BIGSERIAL PRIMARY KEY,batch_id BIGINT NOT NULL REFERENCES dukkan_cari_excel_batches(id) ON DELETE CASCADE,"+
    "store_id BIGINT NOT NULL,party_id BIGINT NOT NULL,source_row INTEGER NOT NULL,"+
    "amount NUMERIC(18,2) NOT NULL,entry_id BIGINT REFERENCES dukkan_cari_entries(id),"+
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(batch_id,source_row));"
  );
}
export async function importCariExcel(db:Pool,storeId:number,actor:number,
  filename:string,bytes:Buffer,expectedSha:string){
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize same-store XLSX imports across independent app instances.
    await client.query("SELECT pg_advisory_xact_lock($1,$2)",[31031,storeId]);
    const preview=await prepared(client,storeId,bytes);
    if(preview.sha256!==expectedSha)invalid("Excel dosyası önizlemeden sonra değişmiş; yeniden analiz edin.");
    if(preview.duplicate)throw Object.assign(new Error("Bu Excel belgesi daha önce içe aktarılmıştır. Bakiyeler yeniden eklenmedi."),{status:409});
    if(preview.conflicts)invalid("Cari eşleşmelerinde hata var. Bakiyeler kaydedilmedi; belgeyi kontrol edin.");
    const batch=await client.query(
      "INSERT INTO dukkan_cari_excel_batches(store_id,sha256,filename,created_by) VALUES($1,$2,$3,$4) RETURNING id",
      [storeId,expectedSha,filename,actor]
    );
    for(const row of preview.rows){
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
      if(row.cents!==0){
        const posted=await client.query(
          "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description) "+
          "VALUES($1,$2,$3,$4,$5) RETURNING id",
          [storeId,party,row.cents>0?(row.cents/100).toFixed(2):"0.00",
            row.cents<0?(-row.cents/100).toFixed(2):"0.00",
            "AI Excel cari bakiye aktarımı · "+filename.slice(0,110)+" · Satır "+row.row]
        );
        entryId=String(posted.rows[0].id);
      }
      await client.query(
        "INSERT INTO dukkan_cari_excel_rows(batch_id,store_id,party_id,source_row,amount,entry_id) "+
        "VALUES($1,$2,$3,$4,$5,$6)",
        [batch.rows[0].id,storeId,party,row.row,(row.cents/100).toFixed(2),entryId]
      );
    }
    await client.query("COMMIT");
    return {batchId:String(batch.rows[0].id),imported:preview.rows.length,
      matched:preview.existing,created:preview.created,
      netAmount:(preview.rows.reduce((sum,row)=>sum+row.cents,0)/100).toFixed(2)};
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
