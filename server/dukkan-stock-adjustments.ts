import type { PoolClient } from "pg";

/** All changes stay in a single PostgreSQL transaction, with the existing
 * Dükkan-to-B2B stock trigger handling the linked public stock snapshot. */
export type ManualStockResult = {
  id: string | number;
  product_id: string | number;
  delta: string | number;
  note?: string | null;
  stock: string | number;
  replayed?: boolean;
  voided_at?: string | null;
  edited_at?: string | null;
};

const error = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

export function validStockDelta(value: number) {
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 999999999 ||
      Math.abs(value * 1000 - Math.round(value * 1000)) > 0.00001)
    throw error("Stok miktarı sıfırdan farklı, en fazla 3 ondalıklı olmalıdır.",400);
  return value;
}

export async function createManualStockMovement(
  client: PoolClient,
  args: {storeId: number;productId: number;delta: number;note: string;actor: number;requestKey?: string},
): Promise<ManualStockResult> {
  const {storeId,productId,actor,requestKey} = args;
  const delta=validStockDelta(args.delta);
  const note=args.note.trim();
  if(note.length<3 || note.length>500)throw error("3–500 karakterlik açıklama gerekli",400);
  if(requestKey){
    // Lock the request key before checking for it. A repeated request after an
    // upstream timeout must return its original posting, not repeat the delta.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",
      ["dukkan_stock_"+storeId+"_"+requestKey]);
    const prior=await client.query(
      "SELECT m.*,p.stock FROM dukkan_stock_movements m "+
      "JOIN dukkan_products p ON p.store_id=m.store_id AND p.id=m.product_id "+
      "WHERE m.store_id=$1 AND m.request_key=$2 LIMIT 1",[storeId,requestKey]);
    if(prior.rows[0]){
      const posted=prior.rows[0];
      if(Number(posted.product_id)!==productId||Number(posted.delta)!==delta||posted.note!==note)
        throw error("Bu işlem kimliği farklı stok bilgileriyle daha önce kullanılmış.",409);
      return {...posted,replayed:true};
    }
  }
  const product=await client.query(
    "UPDATE dukkan_products SET stock=stock+$3 "+
    "WHERE store_id=$1 AND id=$2 AND deleted_at IS NULL AND archived_at IS NULL AND stock+$3>=0 RETURNING stock",
    [storeId,productId,delta],
  );
  if(!product.rows[0])throw error("Ürün bulunamadı veya stok eksiye düşüyor.",409);
  const saved=await client.query(
    "INSERT INTO dukkan_stock_movements(store_id,product_id,delta,reason,note,created_by,request_key) "+
    "VALUES($1,$2,$3,'adjustment',$4,$5,$6::uuid) RETURNING *",
    [storeId,productId,delta,note,actor,requestKey||null],
  );
  return {...saved.rows[0],stock:product.rows[0].stock,replayed:false};
}

export async function changeManualStockMovement(
  client: PoolClient,
  args:{
    storeId:number;movementId:number;actor:number;
    action:"edit"|"delete";delta?:number;note?:string;
  },
):Promise<ManualStockResult> {
  const {storeId,movementId,actor,action}=args;
  const result=await client.query(
    "SELECT * FROM dukkan_stock_movements WHERE store_id=$1 AND id=$2 FOR UPDATE",
    [storeId,movementId],
  );
  const existing=result.rows[0];
  if(!existing)throw error("Stok hareketi bulunamadı.",404);
  if(existing.reason!=="adjustment"||existing.invoice_id!==null)
    throw error("Faturaya bağlı alış/satış hareketleri bu ekrandan düzenlenemez.",403);
  if(existing.voided_at)throw error("Bu stok hareketi daha önce silinmiş.",409);

  const beforeDelta=Number(existing.delta);
  const afterDelta=action==="edit"?validStockDelta(Number(args.delta)):0;
  const afterNote=action==="edit"?(args.note||"").trim():(existing.note||"");
  if(action==="edit"&&(afterNote.length<3||afterNote.length>500))
    throw error("3–500 karakterlik açıklama gerekli",400);
  if(action==="edit"&&afterDelta===beforeDelta&&afterNote===existing.note)
    throw error("Hareket üzerinde değişiklik yapılmadı.",400);
  const stockDiff=afterDelta-beforeDelta;
  const changedProduct=await client.query(
    "UPDATE dukkan_products SET stock=stock+$3 "+
    "WHERE store_id=$1 AND id=$2 AND stock+$3>=0 RETURNING stock",
    [storeId,existing.product_id,stockDiff],
  );
  if(!changedProduct.rows[0])
    throw error("Bu işlem mevcut stoğu eksiye düşüreceği için yapılamaz.",409);

  const changed=await client.query(
    "UPDATE dukkan_stock_movements SET "+
    "delta=CASE WHEN $3='delete' THEN delta ELSE $4 END,"+
    "note=CASE WHEN $3='delete' THEN note ELSE $5 END,"+
    "edited_at=CASE WHEN $3='edit' THEN NOW() ELSE edited_at END,"+
    "edited_by=CASE WHEN $3='edit' THEN $6 ELSE edited_by END,"+
    "voided_at=CASE WHEN $3='delete' THEN NOW() ELSE voided_at END,"+
    "voided_by=CASE WHEN $3='delete' THEN $6 ELSE voided_by END "+
    "WHERE store_id=$1 AND id=$2 RETURNING *",
    [storeId,movementId,action,afterDelta,afterNote,actor],
  );
  await client.query(
    "INSERT INTO dukkan_stock_movement_audit "+
    "(store_id,movement_id,action,previous_delta,new_delta,previous_note,new_note,"+
    "stock_before,stock_after,changed_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [storeId,movementId,action,beforeDelta,afterDelta,existing.note||null,afterNote||null,
      Number(changedProduct.rows[0].stock)-stockDiff,
      changedProduct.rows[0].stock,actor],
  );
  return {...changed.rows[0],stock:changedProduct.rows[0].stock};
}
