import type { PoolClient } from "pg";

/**
 * Verified gross supplier sales. These records are NOT disbursements.
 * Contractual fees, refunds, invoicing and actual payouts must be reconciled
 * separately. Never infer commission from a provisional cart estimate.
 */
type PurchasedLine = { productId?: unknown; supplierId?: unknown; total?: unknown };

function toCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Tedarikçi satış tutarı geçersiz");
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Tedarikçi satış tutarı çok yüksek");
  return cents;
}

/** Called inside the same DB transaction that marks provider-confirmed payment paid. */
export async function recordVerifiedSupplierSales(
  client: PoolClient,
  orderId: number | string,
  orderNumber: string,
  paymentMethod: "card" | "bank_transfer",
  rawItems: unknown,
): Promise<void> {
  if (!Array.isArray(rawItems)) throw new Error("Sipariş satırları geçersiz");
  const groups = new Map<number, number>();
  for (const item of rawItems as PurchasedLine[]) {
    const productId = String(item?.productId || "");
    if (!productId.startsWith("mp-")) continue;
    if (!/^mp-[1-9]\d*$/.test(productId)) throw new Error("Tedarikçi ürün kodu geçersiz");
    const supplierId = Number(item?.supplierId);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) throw new Error("Tedarikçi kimliği eksik");
    groups.set(supplierId, (groups.get(supplierId) || 0) + toCents(item.total));
  }
  if (!groups.size) return;

  await client.query("SELECT pg_advisory_xact_lock(hashtext('b2b_supplier_sales_ledger_v1'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS b2b_supplier_sales_ledger (
      order_id BIGINT NOT NULL REFERENCES b2b_orders(id) ON DELETE RESTRICT,
      supplier_id BIGINT NOT NULL REFERENCES mp_suppliers(id) ON DELETE RESTRICT,
      order_number TEXT NOT NULL,
      gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
      currency TEXT NOT NULL DEFAULT 'TRY',
      payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'bank_transfer')),
      settlement_status TEXT NOT NULL DEFAULT 'awaiting_reconciliation'
        CHECK (settlement_status IN ('awaiting_reconciliation', 'reconciled', 'disputed')),
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(order_id, supplier_id)
    )
  `);
  for (const [supplierId, cents] of groups) {
    if (cents <= 0) throw new Error("Tedarikçi satış tutarı sıfır olamaz");
    await client.query(
      `INSERT INTO b2b_supplier_sales_ledger
       (order_id, supplier_id, order_number, gross_amount, payment_method)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id, supplier_id) DO NOTHING`,
      [orderId, supplierId, orderNumber, (cents / 100).toFixed(2), paymentMethod],
    );
  }
}
