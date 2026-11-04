import type {PoolClient} from "pg";
import {createHash} from "node:crypto";
import {importedStatementSchema,type ImportedStatement} from "./dukkan-cari-statement-parser";

const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const fixed=(v:number)=>round(v).toFixed(2);
const error=(message:string,status=409)=>Object.assign(new Error(message),{status});
export function documentSha256(buffer:Buffer):string{
  return createHash("sha256").update(buffer).digest("hex");
}
export function summarizeImportedStatement(raw:ImportedStatement){
  const document=importedStatementSchema.parse(raw);
  const debit=round(document.entries.reduce((a,x)=>a+x.debit,0));
  const credit=round(document.entries.reduce((a,x)=>a+x.credit,0));
  const net=round(debit-credit);
  const invoices=document.entries.filter(x=>x.kind==="sale"||x.kind==="purchase");
  const rows=invoices.reduce((a,x)=>a+x.lines.length,0);
  const mismatches=[
    ...document.warnings.filter(w=>/hareket atlandı|sütunları ayrıştırılamadı/i.test(w)),
    ...invoices.flatMap(x=>{
    const total=round(x.lines.reduce((a,v)=>a+v.lineTotal,0));
    const documentAmount=round(x.debit+x.credit);
    if(x.lines.length&&Math.abs(total-documentAmount)>0.05)
      return [x.documentNo+": fatura kalemleri ("+total.toFixed(2)+
        " TL) belge tutarından ("+documentAmount.toFixed(2)+" TL) farklı."];
    if(!x.lines.length)return [x.documentNo+": faturanın ürün kalemleri belgede okunamadı."];
    return [];
  }),
  ];
  // A correct final balance does not guarantee correct individual movements.
  // Compare every printed running balance to its immediately preceding one.
  let previousBalance=0;
  for(const movement of document.entries){
    const expected=round(previousBalance+movement.debit-movement.credit);
    if(movement.sourceBalance!==null){
      if(Math.abs(expected-movement.sourceBalance)>0.02)
        mismatches.push(movement.documentNo+" (sayfa "+movement.sourcePage+
          "): hesaplanan hareket bakiyesi "+fixed(expected)+" TL, PDF satır bakiyesi "+
          fixed(movement.sourceBalance)+" TL.");
      previousBalance=movement.sourceBalance;
    }else previousBalance=expected;
  }
  if(document.declaredClosingBalance!==null&&
    Math.abs(net-document.declaredClosingBalance)>0.02)
    mismatches.push("Ekstre net bakiyesi ("+net.toFixed(2)+
      " TL) belgedeki son bakiye ("+document.declaredClosingBalance.toFixed(2)+" TL) ile uyuşmuyor.");
  return {
    entryCount:document.entries.length,invoiceCount:invoices.length,invoiceLineCount:rows,
    debit,credit,balance:net,reportedBalance:document.declaredClosingBalance,
    warnings:[...document.warnings,...mismatches],
    blockingMismatches:mismatches,
    earliest:document.entries.map(x=>x.date).sort()[0]||"",
    latest:document.entries.map(x=>x.date).sort().at(-1)||"",
  };
}
export async function postImportedStatement(
  c:PoolClient,
  args:{storeId:number;actor:number;sha256:string;filename:string;statement:ImportedStatement;
    partyId?:number;confirmExisting?:boolean;replaceOpening?:boolean},
){
  const {storeId,actor,sha256,filename}=args;
  const statement=importedStatementSchema.parse(args.statement);
  const summary=summarizeImportedStatement(statement);
  if(summary.blockingMismatches.length)
    throw error("Fatura satırı veya bakiye tutarsız. Önizlemedeki uyarıları düzeltmeden içe aktarma yapılamaz.",422);
  if(statement.party.currency.toLocaleUpperCase("tr-TR")!=="TL"&&
    statement.party.currency.toLocaleUpperCase("tr-TR")!=="TRY")
    throw error("Bu mağaza yalnız TL hesap tutarlarını işliyor; farklı dövizli ekstre otomatik aktarılamaz.",422);
  // Store-scoped advisory lock closes duplicate-document races across uploads.
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",["dukkan_cari_"+storeId+"_"+statement.party.sourceCariNo]);
  const existing=await c.query(
    "SELECT id,name,source_cari_no FROM dukkan_parties WHERE store_id=$1 AND source_cari_no=$2 LIMIT 2",
    [storeId,statement.party.sourceCariNo],
  );
  const byId=args.partyId?await c.query(
    "SELECT id,name,source_cari_no FROM dukkan_parties WHERE store_id=$1 AND id=$2",
    [storeId,args.partyId],
  ):null;
  if(args.partyId&&!byId?.rows[0])throw error("Seçilen cari hesap bu mağazada bulunamadı.",404);
  if(existing.rows[0]&&byId?.rows[0]&&Number(existing.rows[0].id)!==Number(byId.rows[0].id))
    throw error("Belgedeki cari numarası başka bir hesaba ait. Yanlış cari hesaba aktarmak engellendi.");
  const found=byId?.rows[0]||existing.rows[0]||null;
  if(found?.source_cari_no&&found.source_cari_no!==statement.party.sourceCariNo)
    throw error("Cari numarası eşleşmiyor; başka hesaba hareket aktarılamaz.");
  if(found&&String(found.name).trim().toLocaleLowerCase("tr-TR")!==
    statement.party.name.trim().toLocaleLowerCase("tr-TR"))
    throw error("Belgedeki cari adı mevcut cari kartıyla farklı. Önce cari kartını doğrulayın.");
  let partyId:number;
  let created=false;
  if(found)partyId=Number(found.id);
  else{
    const added=await c.query(
      "INSERT INTO dukkan_parties(store_id,type,name,source_cari_no,account_code) "+
      "VALUES($1,'customer',$2,$3,$4) RETURNING id",
      [storeId,statement.party.name,statement.party.sourceCariNo,statement.party.sourceCariNo],
    );
    partyId=Number(added.rows[0].id);
    created=true;
  }
  const dupBatch=await c.query(
    "SELECT id FROM dukkan_cari_import_batches WHERE store_id=$1 AND party_id=$2 AND source_sha256=$3",
    [storeId,partyId,sha256],
  );
  if(dupBatch.rows.length)
    throw error("Bu PDF zaten içe aktarılmış. Aynı dosya tekrar işlenmedi.");
  const currentEntries=await c.query(
    "SELECT id,debit,credit,description,invoice_id,payment_id "+
    "FROM dukkan_cari_entries WHERE store_id=$1 AND party_id=$2 ORDER BY id",
    [storeId,partyId],
  );
  if(currentEntries.rows.length&&!args.confirmExisting)
    throw error("Mevcut cari bakiyesi var. Çift bakiye oluşmaması için mevcut kayıtlar ayrı olarak onaylanmalı.");
  const canReplaceOpening=currentEntries.rows.length===1 &&
    !currentEntries.rows[0].invoice_id&&!currentEntries.rows[0].payment_id &&
    /^(excel\s+)?açılış bakiyesi/i.test(String(currentEntries.rows[0].description||""));
  if(args.replaceOpening&&!canReplaceOpening)
    throw error("Yalnızca tek bir eski Excel/açılış bakiyesi mahsup edilebilir; diğer cari işlemleri silinemez.");
  const collision=await c.query(
    "SELECT doc.document_no,doc.document_date,doc.kind FROM dukkan_cari_import_entries doc "+
    "WHERE doc.store_id=$1 AND doc.party_id=$2 AND "+
    "(doc.kind,doc.document_date,doc.document_no) IN "+
    "(SELECT i.kind,i.d::date,i.n FROM UNNEST($3::text[],$4::text[],$5::text[]) AS i(kind,d,n)) LIMIT 1",
    [storeId,partyId,statement.entries.map(x=>x.kind),
      statement.entries.map(x=>x.date),statement.entries.map(x=>x.documentNo)],
  );
  if(collision.rows.length)
    throw error("Bu cari için "+collision.rows[0].document_no+
      " numaralı eski hareket zaten içe aktarılmış. Çift bakiye engellendi.");
  const postedInv=await c.query(
    "SELECT invoice_no FROM dukkan_invoices WHERE store_id=$1 AND party_id=$2 "+
    "AND invoice_no=ANY($3::text[]) LIMIT 1",
    [storeId,partyId,statement.entries.filter(x=>
      x.kind==="sale"||x.kind==="purchase").map(x=>x.documentNo)],
  );
  if(postedInv.rows.length)
    throw error("Mevcut fatura numarası ("+postedInv.rows[0].invoice_no+
      ") yeniden içe aktarılamaz; muhasebe çakışması engellendi.");
  const batch=await c.query(
    "INSERT INTO dukkan_cari_import_batches(store_id,party_id,source_sha256,source_filename,"+
    "source_company,source_currency,report_date,source_page_count,entry_count,"+
    "reported_balance,imported_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    [storeId,partyId,sha256,filename,statement.party.sourceCompany,
      statement.party.currency,statement.party.reportDate||null,
      statement.pageCount,statement.entries.length,
      statement.declaredClosingBalance===null?null:fixed(statement.declaredClosingBalance),actor],
  );
  const batchId=Number(batch.rows[0].id);
  if(args.replaceOpening){
    const opening=currentEntries.rows[0];
    const oldBalance=round(Number(opening.debit)-Number(opening.credit));
    // Reversal entry preserves an audit trail of the original Excel opening.
    // The incoming full historical statement then replaces its balance effect.
    await c.query(
      "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description) "+
      "VALUES($1,$2,$3,$4,$5)",
      [storeId,partyId,fixed(Math.max(0,-oldBalance)),fixed(Math.max(0,oldBalance)),
        "Eski açılış bakiyesi mahsup edildi · cari arşiv aktarımı #"+batchId],
    );
  }
  for(const [index,entry] of statement.entries.entries()){
    // Imported archival entries affect only the current account balance,
    // never product stock, bank accounts, POS, e-invoices or actual posted invoices.
    const row=await c.query(
      "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,created_at) "+
      "VALUES($1,$2,$3,$4,$5,$6::date::timestamp) RETURNING id",
      [storeId,partyId,fixed(entry.debit),fixed(entry.credit),
        "Arşiv "+entry.kind+" · "+entry.documentNo+
        (entry.description?" · "+entry.description:""),entry.date],
    );
    const original=await c.query(
      "INSERT INTO dukkan_cari_import_entries("+
      "store_id,party_id,batch_id,entry_id,document_date,due_date,kind,document_no,"+
      "source_description,source_balance,source_page,source_position) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
      [storeId,partyId,batchId,row.rows[0].id,entry.date,entry.dueDate,entry.kind,
        entry.documentNo,entry.description,
        entry.sourceBalance===null?null:fixed(entry.sourceBalance),
        entry.sourcePage,index],
    );
    const ref=original.rows[0].id;
    for(const [lineIndex,item] of entry.lines.entries()){
      await c.query(
        "INSERT INTO dukkan_cari_import_lines("+
        "import_entry_id,line_position,product_name,quantity,unit,unit_price,"+
        "discounted_unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [ref,lineIndex,item.productName,item.quantity.toFixed(3),item.unit,
          fixed(item.unitPrice),item.discountedUnitPrice===null?null:fixed(item.discountedUnitPrice),
          fixed(item.lineTotal)],
      );
    }
  }
  return {batchId,partyId,created,entryCount:summary.entryCount,
    invoiceCount:summary.invoiceCount,invoiceLineCount:summary.invoiceLineCount,
    balance:summary.balance};
}
