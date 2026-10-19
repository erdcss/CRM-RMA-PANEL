import type { PoolClient } from "pg";
import { pool } from "./db";
import { notifyB2BEvent } from "./b2b-notification-center";
import { sendBusinessPushToUsers } from "./push-notifications";

type PaidLine={
  productId?:unknown;supplierId?:unknown;quantity?:unknown;
  totalUnits?:unknown;unitsPerBox?:unknown;total?:unknown;
};
function marketplaceLine(line:PaidLine){
  const match=/^mp-([1-9]\d*)$/.exec(String(line.productId||""));
  if(!match)return null;
  const supplierId=Number(line.supplierId),units=Number(line.totalUnits);
  if(!Number.isSafeInteger(supplierId)||supplierId<1||!Number.isSafeInteger(units)||units<1)
    throw Error("Tedarikçi sipariş satırı doğrulanamadı");
  return {id:Number(match[1]),supplierId,units};
}
/** Called only from a provider-confirmed payment transaction. */
export async function deductMarketplaceStock(client:PoolClient,line:PaidLine){
  const item=marketplaceLine(line);
  if(!item)return false; // caller handles original B2B stock
  const result=await client.query(
    "UPDATE mp_products SET stock=stock-$3 WHERE id=$1 AND supplier_id=$2 AND stock >= $3 RETURNING id",
    [item.id,item.supplierId,item.units]
  );
  return Boolean(result.rows[0]);
}
export function isMarketplaceLine(line:PaidLine){
  return /^mp-[1-9]\d*$/.test(String(line.productId||""));
}
/** After payment commit, notify each owning supplier plus admin. Never trust client-supplied seller recipients. */
export async function notifyVerifiedSupplierOrder(orderNumber:string,rawItems:unknown,stockReview=false){
  if(!pool||!Array.isArray(rawItems))return;
  const supplierIds=[...new Set(rawItems.filter(x=>x&&typeof x==="object"&&isMarketplaceLine(x as PaidLine))
    .map(x=>Number((x as PaidLine).supplierId)).filter(x=>Number.isSafeInteger(x)&&x>0))];
  if(!supplierIds.length)return;
  const ownership=await pool.query(
    "SELECT id,owner_user_id,company_name FROM mp_suppliers WHERE id=ANY($1::bigint[])",
    [supplierIds]
  );
  const admin=await pool.query("SELECT id FROM users WHERE role IN ('admin','super_admin') AND is_active=1");
  const subtitle=stockReview ? "Ödeme alındı; stok kontrolü gerekli" : "Ödemesi doğrulandı";
  const currency=(v:number)=>v.toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
  for(const supplier of ownership.rows){
    const lines=rawItems as PaidLine[];
    const amount=lines.filter(x=>Number(x.supplierId)===Number(supplier.id))
      .reduce((n,x)=>n+Number(x.total||0),0);
    const notification=await notifyB2BEvent(Number(supplier.owner_user_id),"supplier_order_paid",{
      orderNumber,amount:currency(amount),sellerName:String(supplier.company_name),status:subtitle,
    }, "supplier_order_paid:"+orderNumber+":"+supplier.id).catch(e=>console.error("Seller paid notification",e));
    if(notification.recorded)await sendBusinessPushToUsers([Number(supplier.owner_user_id)],{
      title:"Ürününüz satıldı",
      body:orderNumber+" · "+currency(amount)+" · "+subtitle,
      data:{type:"supplier_order_paid",orderNumber,supplierId:String(supplier.id)}
    }).catch(e=>console.error("Business seller paid push",e));
  }
  for(const row of admin.rows){
    await notifyB2BEvent(Number(row.id),"admin_supplier_paid",{
      orderNumber,amount:currency((rawItems as PaidLine[]).filter(x=>isMarketplaceLine(x))
       .reduce((n,x)=>n+Number(x.total||0),0)),
      status:subtitle,
    },"admin_supplier_paid:"+orderNumber).catch(e=>console.error("Admin paid notification",e));
  }
}
export async function removePurchasedMarketplaceCartItems(
  userId:number,rawItems:unknown
){
  if(!pool||!Number.isSafeInteger(userId)||!Array.isArray(rawItems))return;
  const ids=rawItems.filter(x=>x&&typeof x==="object"&&isMarketplaceLine(x as PaidLine))
    .map(x=>Number(String((x as PaidLine).productId).slice(3)));
  if(ids.length)await pool.query(
    "DELETE FROM mp_cart_lines WHERE buyer_user_id=$1 AND product_id=ANY($2::bigint[])",
    [userId,ids]
  );
}
