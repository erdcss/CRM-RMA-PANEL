/**
 * Least-privilege supplier order projection.
 * Only explicitly-listed fields reach seller apps and PDFs.
 * Never forward raw billing/shipping objects or contact information.
 */
export function redactCustomerPhones(text: string): string {
  return String(text||"").replace(
    /(?<![0-9])(?:(?:\+90|0090|0)[\s().-]*)?(?:5[0-9]{2}|[2-4][0-9]{2})[\s().-]*[0-9]{3}[\s().-]*[0-9]{2}[\s().-]*[0-9]{2}(?![0-9])/g,
    "[Telefon gizlendi]",
  );
}
function safeVisibleText(value: unknown, maxLength=180): string {
  if(typeof value!=="string")return "";
  return redactCustomerPhones(value)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[E-posta gizlendi]")
    .slice(0,maxLength).trim();
}
export function supplierOrderView(row: Record<string, any>) {
  const items=Array.isArray(row.items)?row.items:[];
  const company=safeVisibleText(row.customer_company,120);
  const address=safeVisibleText(row.delivery_address,350);
  return {
    id:row.id,
    order_id:row.order_id,
    status:row.status,
    subtotal:row.subtotal,
    delivery_mode:row.delivery_mode,
    payment_method:row.payment_method==="bank_transfer"?"bank_transfer":
      row.payment_method==="card"||row.payment_method==="iyzico"?"card":null,
    created_at:row.created_at,
    currency:row.currency||"TRY",
    customer_company:company||null,
    delivery_address:address||null,
    items:items.map((item:Record<string,any>)=>({
      productId:item.productId,
      sku:safeVisibleText(item.sku,80),
      name:safeVisibleText(item.name,170),
      boxes:item.boxes,
      unitsPerBox:item.unitsPerBox,
      price:item.price,
      total:item.total,
    })),
  };
}
export type SupplierOrderView=ReturnType<typeof supplierOrderView>;
