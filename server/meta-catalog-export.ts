/**
 * Meta Commerce Manager exports:
 * - Full product feed for Catalog > Data sources.
 * - Plain UTF-8 content IDs (one ID per line) for "Add items in bulk".
 *
 * These exports must only be served from authenticated admin endpoints:
 * B2B wholesale pricing is hidden on the public storefront.
 */
export const META_FEED_COLUMNS=[
  "id","title","description","availability","condition","price",
  "link","image_link","brand","mpn","gtin","inventory","product_type",
] as const;

export type MetaFeedEntry=Record<(typeof META_FEED_COLUMNS)[number],string>;

function csvField(input:unknown):string{
  const raw=String(input??"").replace(/[\u0000-\u001f\u007f]/g," ").trim();
  return '"'+raw.replace(/"/g,'""')+'"';
}

export function metaCatalogCsv(items:readonly MetaFeedEntry[]):string{
  const rows=[META_FEED_COLUMNS.join(",")];
  for(const item of items){
    rows.push(META_FEED_COLUMNS.map(key=>csvField(item[key])).join(","));
  }
  return rows.join("\r\n")+"\r\n";
}

/**
 * Meta's "Add by content ID" uploader parses raw IDs, not a full product
 * feed. A quoted CSV field can be treated as a literal ID with quotes.
 * Emit ASCII-safe, unquoted IDs, one per line, no column header or BOM.
 * Never replace product IDs with SKU or barcode: Meta catalog uses the id field.
 * These IDs must already exist in the target Meta catalog.
 */
export function metaContentIdsText(items:readonly Pick<MetaFeedEntry,"id">[]):string{
  const seen=new Set<string>();
  for(const item of items){
    const id=String(item.id||"").trim();
    // Existing company products may use historical TEXT keys (e.g. 32-char
    // hexadecimal IDs, UUIDs, mixed case SKUs), not just numeric sequences.
    // Keep exactly the ID in the catalog feed so Meta can match it. Reject
    // control characters, whitespace, spreadsheet formula prefixes and delimiters.
    // The first character must be alphanumeric; subsequent safe ASCII ID chars
    // include hyphen/underscore/dot/colon for legacy or supplier prefixes.
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(id))continue;
    seen.add(id);
  }
  return seen.size ? [...seen].join("\n")+"\n" : "";
}

/**
 * Backward-compatible CSV route: a single-column CSV does not require
 * quotation marks when IDs contain only digits or letters and hyphens.
 */
export function metaContentIdsCsv(items:readonly Pick<MetaFeedEntry,"id">[]):string{
  return metaContentIdsText(items);
}
