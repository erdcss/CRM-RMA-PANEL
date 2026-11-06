import type {PoolClient} from "pg";

export type EditableInvoiceLine = {
  productId:number; quantity:number; unitPrice:number; taxRate:number;
};
export type SalesInvoiceRevision = {
  storeId:number; invoiceId:number; actorId:number; expectedRevision:number;
  action:"edit"|"delete";
  payload?:{partyId:number;date?:string;kind:"sale"|"sale_return";lines:EditableInvoiceLine[]};
};
const fail=(message:string,status=409):never=>{
  throw Object.assign(new Error(message),{status});
};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const milli=(n:number)=>Number(n.toFixed(3));

/** Revise a posted, internal sales document in one database transaction.
 * The row lock + revision prevent stale edits. All stock and cari deltas
 * are recalculated, with an immutable before/after audit snapshot.
 */
export async function reviseDukkanSalesInvoice(c:PoolClient,input:SalesInvoiceRevision){
  const {storeId,invoiceId,actorId,action,expectedRevision}=input;
  const original=await c.query(
    "SELECT * FROM dukkan_invoices WHERE store_id=$1 AND id=$2 FOR UPDATE",
    [storeId,invoiceId]
  );
  if(!original.rowCount)fail("Bu mağazada fatura bulunamadı",404);
  const doc=original.rows[0];
  if(!["sale","sale_return"].includes(doc.kind))fail("Yalnızca satış belgeleri değiştirilebilir",403);
  if(doc.status!=="posted")fail("Bu fatura daha önce silinmiş veya iptal edilmiş");
  if(Number(doc.revision)!==expectedRevision)
    fail("Fatura başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyin.");
  if(action==="edit"&&(!input.payload||input.payload.kind!==doc.kind))
    fail("Fatura türü değiştirilemez. Gerekirse yeni fatura düzenleyin.",400);

  const previous=await c.query(
    "SELECT product_id,quantity,unit_price,tax_rate,line_total FROM dukkan_invoice_lines WHERE invoice_id=$1 ORDER BY id",
    [invoiceId]
  );
  const oldState={invoice:doc,lines:previous.rows};
  const data=input.payload;
  if(action==="edit"){
    const party=await c.query("SELECT id FROM dukkan_parties WHERE store_id=$1 AND id=$2",[storeId,data!.partyId]);
    if(!party.rowCount)fail("Seçilen cari hesap bu mağazada bulunamadı",404);
  }
  const calculated=(action==="edit"?data!.lines:[]).map(line=>{
    const net=cents(line.quantity*cents(line.unitPrice));
    const tax=cents(net*line.taxRate/100);
    return {...line,total:cents(net+tax),net,tax};
  });
  const sign=doc.kind==="sale"?-1:1;
  const quantities=(lines:Array<{productId:number;quantity:number}>)=>{
    const result=new Map<number,number>();
    for(const line of lines)
      result.set(line.productId,milli((result.get(line.productId)||0)+Number(line.quantity)));
    return result;
  };
  const before=quantities(previous.rows.map(row=>({productId:Number(row.product_id),quantity:Number(row.quantity)})));
  const after=quantities(calculated);
  const productIds=[...new Set([...before.keys(),...after.keys()])].sort((a,b)=>a-b);
  for(const productId of productIds){
    const delta=milli(sign*((after.get(productId)||0)-(before.get(productId)||0)));
    if(delta===0)continue;
    const updated=await c.query(
      "UPDATE dukkan_products SET stock=stock+$3 WHERE store_id=$1 AND id=$2 AND stock+$3>=0 RETURNING id",
      [storeId,productId,delta]
    );
    if(!updated.rowCount)fail("Stok yetersiz veya ürün bu mağazaya ait değil. Stok koduna bağlı ürün: "+productId);
  }

  // Existing ledger postings are replaced, not double-booked. Other payments
  // and unrelated manual stock/cari movements are never modified.
  await c.query("DELETE FROM dukkan_stock_movements WHERE store_id=$1 AND invoice_id=$2",[storeId,invoiceId]);
  await c.query("DELETE FROM dukkan_cari_entries WHERE store_id=$1 AND invoice_id=$2",[storeId,invoiceId]);
  let changed;
  if(action==="delete"){
    changed=await c.query(
      "UPDATE dukkan_invoices SET status='voided',revision=revision+1 WHERE store_id=$1 AND id=$2 RETURNING *",
      [storeId,invoiceId]
    );
  }else{
    const subtotal=cents(calculated.reduce((sum,line)=>sum+line.net,0));
    const taxTotal=cents(calculated.reduce((sum,line)=>sum+line.tax,0));
    const grandTotal=cents(subtotal+taxTotal);
    await c.query("DELETE FROM dukkan_invoice_lines WHERE invoice_id=$1",[invoiceId]);
    for(const line of calculated){
      await c.query(
        "INSERT INTO dukkan_invoice_lines(invoice_id,product_id,quantity,unit_price,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6)",
        [invoiceId,line.productId,line.quantity,cents(line.unitPrice),line.taxRate,line.total]
      );
      await c.query(
        "INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,invoice_id,created_by) VALUES($1,$2,$3,$4,$5,$6)",
        [storeId,line.productId,sign*line.quantity,doc.kind,invoiceId,actorId]
      );
    }
    const debit=doc.kind==="sale"?grandTotal:0;
    const credit=doc.kind==="sale_return"?grandTotal:0;
    await c.query(
      "INSERT INTO dukkan_cari_entries(store_id,party_id,debit,credit,description,invoice_id) VALUES($1,$2,$3,$4,$5,$6)",
      [storeId,data!.partyId,debit,credit,doc.kind+" "+doc.invoice_no,invoiceId]
    );
    changed=await c.query(
      "UPDATE dukkan_invoices SET party_id=$3,issued_at=COALESCE($4::date,issued_at),subtotal=$5,tax_total=$6,grand_total=$7,revision=revision+1 WHERE store_id=$1 AND id=$2 RETURNING *",
      [storeId,invoiceId,data!.partyId,data!.date||null,subtotal,taxTotal,grandTotal]
    );
  }
  await c.query(
    "INSERT INTO dukkan_invoice_audit(store_id,invoice_id,action,previous_data,next_data,changed_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)",
    [storeId,invoiceId,action,JSON.stringify(oldState),JSON.stringify({
      invoice:changed.rows[0],lines:action==="edit"?calculated:previous.rows
    }),actorId]
  );
  return changed.rows[0];
}
