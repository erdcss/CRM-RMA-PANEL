/**
 * The web admin's "Son Onaylanan Siparişler" and its "bugün" badge must
 * use exactly the same predicate as the Çalışkan Business mobile dashboard.
 *
 * Payment initialization, self-reported bank transfers, failed transactions,
 * cancellations and unapproved checkout drafts are not confirmed orders.
 * No email/customer heuristics: real approval is established by order state.
 */
export const APPROVED_B2B_ORDER_SQL = `
  LOWER(TRIM(COALESCE(status,''))) IN ('approved','confirmed','paid','onaylandi')
  AND LOWER(TRIM(COALESCE(payment_status,''))) NOT IN ('failure','initialize_failed')
  AND LOWER(TRIM(COALESCE(payment_status,''))) NOT LIKE '3ds_failed%'
`;
