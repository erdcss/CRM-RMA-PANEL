import type {PoolClient} from "pg";

/** Source PDF rows are historical and must never create or reverse inventory.
 * Archive corrections only affect their EXISTING cari entry and source-view
 * lines. Edits and soft-voids retain before/after JSON audit evidence.
 */
export type ArchivedSalesLine={
  productName:string; quantity:number; unit:string; unitPrice:number; lineTotal:number;
};
export type ArchivedSalesCorrection={
  storeId:number; importId:number; actorId:number; expectedRevision:number;
  action:"edit"|"delete";
  changes?:{date:string; amount:number; description:string; lines:ArchivedSalesLine[]};
};
const error=(message:string,status=409):never=>{
  throw Object.assign(new Error(message),{status});
};
const fixed=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export async function correctArchivedSalesInvoice(c:PoolClient,input:ArchivedSalesCorrection){
  const {storeId,importId,actorId,expectedRevision,action}=input;
  const result=await c.query(
    "SELECT ie.*,e.debit,e.credit,e.description AS ledger_description,e.created_at AS ledger_date "+
    "FROM dukkan_cari_import_entries ie JOIN dukkan_cari_entries e "+
    "ON e.id=ie.entry_id AND e.store_id=ie.store_id AND e.party_id=ie.party_id "+
    "WHERE ie.id=$1 AND ie.store_id=$2 FOR UPDATE OF ie,e",
    [importId,storeId]
  );
  if(!result.rowCount)error("Bu mağazada arşiv faturası bulunamadı",404);
  const invoice=result.rows[0];
  if(invoice.kind!=="sale")error("Yalnızca satış arşivi düzenlenebilir",403);
  if(invoice.voided_at)error("Silinmiş arşiv faturası değiştirilemez");
  if(Number(invoice.revision)!==expectedRevision)error("Arşiv belgesi başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.");
  if(action==="edit"&&!input.changes)error("Düzenlenecek alanlar eksik",400);

  const rows=await c.query(
    "SELECT product_name,quantity,unit,unit_price,discounted_unit_price,line_total FROM dukkan_cari_import_lines "+
    "WHERE import_entry_id=$1 ORDER BY line_position,id",[importId]
  );
  const previous={invoice,lines:rows.rows};
  if(action==="delete"){
    await c.query(
      "UPDATE dukkan_cari_import_entries SET voided_at=NOW(),revision=revision+1,edited_at=NOW(),edited_by=$3 "+
      "WHERE store_id=$1 AND id=$2",[storeId,importId,actorId]
    );
    await c.query(
      "UPDATE dukkan_cari_entries SET debit=0,credit=0,description=description||' · ARŞİV BELGESİ SİLİNDİ' "+
      "WHERE store_id=$1 AND id=$2",[storeId,invoice.entry_id]
    );
  }else{
    const changes=input.changes!;
    // Import balances can be a debit or a credit, depending on the source
    // statement; retain the source direction instead of inventing a new one.
    const credit=Number(invoice.credit)>Number(invoice.debit);
    const amount=fixed(changes.amount);
    const debit=credit?0:amount,creditAmount=credit?amount:0;
    await c.query(
      "UPDATE dukkan_cari_entries SET debit=$3,credit=$4,description=$5,created_at=$6::date::timestamp "+
      "WHERE store_id=$1 AND id=$2",
      [storeId,invoice.entry_id,debit,creditAmount,
        "Arşiv satış · "+invoice.document_no+(changes.description?" · "+changes.description:""),changes.date]
    );
    await c.query(
      "UPDATE dukkan_cari_import_entries SET document_date=$3::date,source_description=$4,"+
      "revision=revision+1,edited_at=NOW(),edited_by=$5 WHERE store_id=$1 AND id=$2",
      [storeId,importId,changes.date,changes.description,actorId]
    );
    await c.query("DELETE FROM dukkan_cari_import_lines WHERE import_entry_id=$1",[importId]);
    for(const [position,item] of changes.lines.entries()){
      await c.query(
        "INSERT INTO dukkan_cari_import_lines(import_entry_id,line_position,product_name,quantity,unit,unit_price,discounted_unit_price,line_total) "+
        "VALUES($1,$2,$3,$4,$5,$6,NULL,$7)",
        [importId,position,item.productName,item.quantity,item.unit,fixed(item.unitPrice),fixed(item.lineTotal)]
      );
    }
  }
  const next=await c.query(
    "SELECT ie.*,e.debit,e.credit,e.description AS ledger_description FROM dukkan_cari_import_entries ie "+
    "JOIN dukkan_cari_entries e ON e.id=ie.entry_id AND e.store_id=ie.store_id "+
    "WHERE ie.store_id=$1 AND ie.id=$2",[storeId,importId]
  );
  await c.query(
    "INSERT INTO dukkan_archive_invoice_audit(store_id,import_entry_id,action,previous_data,next_data,changed_by) "+
    "VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)",
    [storeId,importId,action,JSON.stringify(previous),
      JSON.stringify({invoice:next.rows[0],lines:action==="edit"?input.changes!.lines:rows.rows}),actorId]
  );
  return next.rows[0];
}
