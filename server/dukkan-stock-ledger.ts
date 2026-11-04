/** Store-scoped stock history: invoice line prices are matched by their posting order,
 * including multiple lines of the same product on a single invoice.
 */
export const dukkanStockTotalsSql = [
  "SELECT COUNT(*)::integer AS total,COALESCE(SUM(delta),0) AS net_delta,",
  "COALESCE(SUM(CASE WHEN reason='purchase' THEN delta ELSE 0 END),0) AS purchased,",
  "COALESCE(SUM(CASE WHEN reason='sale' THEN -delta ELSE 0 END),0) AS sold,",
  "COALESCE(SUM(CASE WHEN reason='sale_return' THEN delta ELSE 0 END),0) AS sale_returned,",
  "COALESCE(SUM(CASE WHEN reason='purchase_return' THEN -delta ELSE 0 END),0) AS purchase_returned,",
  "COALESCE(SUM(CASE WHEN reason='adjustment' AND delta>0 THEN delta ELSE 0 END),0) AS manual_in,",
  "COALESCE(SUM(CASE WHEN reason='adjustment' AND delta<0 THEN -delta ELSE 0 END),0) AS manual_out",
  "FROM dukkan_stock_movements WHERE store_id=$1 AND product_id=$2 AND voided_at IS NULL",
].join(" ");

export const dukkanStockHistorySql = [
  "WITH movements AS (",
  "SELECT m.id,m.created_at,m.invoice_id,m.product_id,m.delta,m.reason,m.note,m.edited_at,m.voided_at,",
  "ROW_NUMBER() OVER (PARTITION BY m.invoice_id,m.product_id ORDER BY m.id) AS movement_line",
  "FROM dukkan_stock_movements m WHERE m.store_id=$1 AND m.product_id=$2),",
  "invoice_lines AS (",
  "SELECT l.invoice_id,l.product_id,l.quantity,l.unit_price,l.tax_rate,l.line_total,",
  "ROW_NUMBER() OVER (PARTITION BY l.invoice_id,l.product_id ORDER BY l.id) AS invoice_line",
  "FROM dukkan_invoice_lines l JOIN dukkan_invoices matched ON matched.id=l.invoice_id",
  "WHERE matched.store_id=$1 AND l.product_id=$2)",
  "SELECT m.id,m.created_at,m.delta,m.reason,m.note,m.invoice_id,m.edited_at,m.voided_at,",
  "i.invoice_no,i.issued_at,i.kind AS invoice_kind,party.name AS party_name,",
  "line.quantity,line.unit_price,line.tax_rate,line.line_total",
  "FROM movements m",
  "LEFT JOIN dukkan_invoices i ON i.id=m.invoice_id AND i.store_id=$1",
  "LEFT JOIN dukkan_parties party ON party.id=i.party_id AND party.store_id=$1",
  "LEFT JOIN invoice_lines line ON line.invoice_id=m.invoice_id AND line.product_id=m.product_id",
  "AND line.invoice_line=m.movement_line",
  "ORDER BY m.created_at DESC,m.id DESC LIMIT $3 OFFSET $4",
].join(" ");
