import type { PoolClient } from "pg";

/** Hide products from active Dükkan inventory and B2B listings.
 * Do not physically delete invoice/stock/order foreign-key targets, nor
 * overwrite stock balances: historical accounting records remain intact.
 * Caller must SELECT the store-scoped rows FOR UPDATE in one transaction.
 */
export async function softDeleteDukkanProducts(
  c: PoolClient,
  storeId: number,
  ids: number[],
): Promise<{affected:number;withStock:number;preservedHistory:true}> {
  if (!ids.length || ids.length > 100 || ids.some(v=>!Number.isSafeInteger(v)||v<=0) ||
      new Set(ids).size!==ids.length) {
    throw Object.assign(new Error("Geçersiz toplu ürün seçimi"),{status:400});
  }
  const result = await c.query(
    "UPDATE dukkan_products SET archived_at=COALESCE(archived_at,NOW())," +
    "deleted_at=NOW(),publish_b2b=FALSE " +
    "WHERE store_id=$1 AND id=ANY($2::bigint[]) AND deleted_at IS NULL " +
    "RETURNING id,b2b_product_id,stock",
    [storeId,ids],
  );
  if (result.rows.length !== ids.length) {
    throw Object.assign(new Error("Ürünlerden biri artık silinemiyor; listeyi yenileyin"),{status:409});
  }
  const links = [...new Set(result.rows.map(row=>String(row.b2b_product_id||"").trim()).filter(Boolean))];
  if (links.length) {
    // Keep the link, so automatic B2B import cannot resurrect a deleted row.
    // Only deactivate linked B2B products; do not mutate other stores' inventory.
    await c.query(
      "UPDATE b2b_products SET is_active=FALSE,updated_at=NOW() " +
      "WHERE id::text=ANY($1::text[])",
      [links],
    );
  }
  return {
    affected:result.rows.length,
    withStock:result.rows.filter(row=>Number(row.stock)!==0).length,
    preservedHistory:true,
  };
}
