/**
 * Supplier-only data policy.
 * Customer contact information is reserved for authorized administrator APIs.
 * Never spread raw order rows or billing/shipping JSON into a supplier response.
 */
export function supplierOrderView(row: Record<string, any>) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    order_id: row.order_id,
    status: row.status,
    subtotal: row.subtotal,
    delivery_mode: row.delivery_mode,
    created_at: row.created_at,
    currency: row.currency || "TRY",
    items: items.map((item: Record<string, any>) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      boxes: item.boxes,
      unitsPerBox: item.unitsPerBox,
      price: item.price,
      total: item.total,
    })),
  };
}

/** Redact Turkish phone numbers in buyer-authored chat shown to suppliers. */
export function redactCustomerPhones(text: string): string {
  return text.replace(
    /(?<![0-9])(?:(?:\+90|0090|0)[\s().-]*)?(?:5[0-9]{2}|[2-4][0-9]{2})[\s().-]*[0-9]{3}[\s().-]*[0-9]{2}[\s().-]*[0-9]{2}(?![0-9])/g,
    "[Telefon bilgisi gizlendi]",
  );
}
