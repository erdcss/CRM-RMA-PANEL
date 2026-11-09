/**
 * Meta Commerce Manager exports:
 * - Full product feed for Catalog > Data sources.
 * - A headerless one-column file of content IDs for "Add items in bulk".
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
 * This is NOT a feed. Commerce Manager's "bulk add by content ID" picker
 * expects one existing Meta content ID per line, without a header.
 */
export function metaContentIdsCsv(items:readonly Pick<MetaFeedEntry,"id">[]):string{
  const seen=new Set<string>();
  for(const item of items){
    const id=String(item.id||"").trim();
    // Product IDs in our catalog are numeric or "mp-"+numeric.
    // Reject arbitrary CSV/Excel formula input or line breaks.
    if(!/^(?:mp-)?[0-9]+$/.test(id))continue;
    seen.add(id);
  }
  return [...seen].map(csvField).join("\r\n")+"\r\n";
}
