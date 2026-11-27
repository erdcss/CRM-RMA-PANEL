// Read-only customer/product sales history. Posted invoices take precedence
// over duplicate imported evidence; no stock/cari movements are written.
export const dukkanPartyProductHistorySql = `
WITH target AS (
  SELECT id, name,
    regexp_replace(lower(translate(name,'Iİ','ıi')), '[[:space:]]+', ' ', 'g') AS normalized_name
  FROM dukkan_products WHERE store_id=$1 AND id=$3 AND deleted_at IS NULL
), scoped_party AS (
  SELECT id,name FROM dukkan_parties WHERE store_id=$1 AND id=$2
), history AS (
  SELECT 'invoice'::text AS source, i.id AS document_id, l.id AS line_id,
    i.invoice_no AS document_no, i.issued_at AS sale_date, l.quantity,
    l.unit_price, l.line_total, p.unit, l.tax_rate
  FROM dukkan_invoices i
  JOIN dukkan_invoice_lines l ON l.invoice_id=i.id AND l.product_id=$3
  JOIN target t ON t.id=l.product_id
  JOIN dukkan_products p ON p.id=l.product_id AND p.store_id=i.store_id
  WHERE i.store_id=$1 AND i.party_id=$2 AND i.kind='sale' AND i.status='posted'
    AND EXISTS(SELECT 1 FROM scoped_party)
  UNION ALL
  SELECT 'archive', ie.id, l.id, ie.document_no, ie.document_date, l.quantity,
    COALESCE(l.discounted_unit_price,l.unit_price), l.line_total, l.unit, NULL::numeric
  FROM dukkan_cari_import_entries ie
  JOIN dukkan_cari_entries e ON e.id=ie.entry_id AND e.store_id=ie.store_id AND e.party_id=ie.party_id
  JOIN dukkan_cari_import_lines l ON l.import_entry_id=ie.id
  CROSS JOIN target t
  WHERE ie.store_id=$1 AND ie.party_id=$2 AND ie.kind='sale' AND ie.voided_at IS NULL
    AND EXISTS(SELECT 1 FROM scoped_party)
    AND (l.product_id=t.id OR (l.product_id IS NULL
      AND length(trim(t.normalized_name))>=4
      AND trim(regexp_replace(lower(translate(l.product_name,'Iİ','ıi')), '[[:space:]]+', ' ', 'g'))=trim(t.normalized_name)
      AND NOT EXISTS (SELECT 1 FROM dukkan_products other WHERE other.store_id=$1 AND other.deleted_at IS NULL
        AND other.id<>t.id AND trim(regexp_replace(lower(translate(other.name,'Iİ','ıi')), '[[:space:]]+', ' ', 'g'))=trim(t.normalized_name))))
    AND NOT EXISTS (SELECT 1 FROM dukkan_invoices i WHERE i.store_id=ie.store_id
      AND i.party_id=ie.party_id AND i.kind=ie.kind AND i.invoice_no=ie.document_no AND i.status='posted')
), summary AS (
  SELECT COUNT(*)::integer AS line_count, COUNT(DISTINCT (source,document_id))::integer AS invoice_count,
    MIN(sale_date)::text AS first_date, MAX(sale_date)::text AS last_date,
    COUNT(DISTINCT unit)::integer AS unit_count,
    CASE WHEN COUNT(DISTINCT unit)<=1 THEN COALESCE(SUM(quantity),0)::text END AS total_quantity,
    CASE WHEN COUNT(DISTINCT unit)<=1 THEN ROUND(SUM(quantity*unit_price)/NULLIF(SUM(quantity),0),2)::text END AS average_price,
    (SELECT unit_price::text FROM history ORDER BY sale_date DESC, source, document_id DESC,line_id DESC LIMIT 1) AS last_price
  FROM history
), page AS (
  SELECT source,document_id::text,line_id::text,document_no,sale_date::text,quantity::text,
    unit_price::text,line_total::text,unit,tax_rate::text
  FROM history ORDER BY sale_date DESC,source,document_id DESC,line_id DESC LIMIT $4 OFFSET $5
)
SELECT (SELECT row_to_json(t) FROM target t) AS product,
  (SELECT row_to_json(p) FROM scoped_party p) AS party,
  (SELECT row_to_json(s) FROM summary s) AS summary,
  COALESCE((SELECT json_agg(p) FROM page p),'[]'::json) AS rows,
  COALESCE((SELECT json_agg(u) FROM (SELECT unit,SUM(quantity)::text AS quantity FROM history GROUP BY unit ORDER BY unit) u),'[]'::json) AS units
`;
