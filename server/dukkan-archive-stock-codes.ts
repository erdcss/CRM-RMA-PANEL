/** Archive excerpts contain free-text names, not catalog product ids.
 * Only resolve SKUs when names identify exactly one product in the store.
 * Never infer a stock code from another store, fuzzy spelling or row order.
 */
export type ArchiveLineForSku={
  id:number|string;product_id?:number|string|null;product_name:string;sku?:string|null;
};
export type CatalogSkuRecord={
  id:number|string;name:string;sku:string;b2b_source_sku?:string|null;
};
export function normalizeArchiveProductName(value:unknown){
  return String(value??"")
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g,"i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]/g,"");
}
export function resolveArchiveStockCodes<T extends ArchiveLineForSku>(
  lines:T[],catalog:CatalogSkuRecord[]
):Array<T & {sku:string;product_id:number|string|null;stock_code_match:"linked"|"exact"|"unmatched"}>{
  const byId=new Map(catalog.map(p=>[String(p.id),p]));
  const byName=new Map<string,CatalogSkuRecord[]>();
  for(const product of catalog){
    const name=normalizeArchiveProductName(product.name);
    if(name.length<4)continue;
    const matches=byName.get(name)||[];
    matches.push(product);byName.set(name,matches);
  }
  return lines.map(line=>{
    const linked=line.product_id==null?undefined:byId.get(String(line.product_id));
    const normalized=normalizeArchiveProductName(line.product_name);
    const possibilities=byName.get(normalized)||[];
    const resolved=linked||(possibilities.length===1?possibilities[0]:undefined);
    return {...line,
      sku:resolved?String(resolved.b2b_source_sku||resolved.sku||""):"",
      product_id:resolved?resolved.id:line.product_id??null,
      stock_code_match:linked?"linked":resolved?"exact":"unmatched"
    };
  });
}
