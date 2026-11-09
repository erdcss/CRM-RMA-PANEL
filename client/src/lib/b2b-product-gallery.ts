export type ProductImageSources = {
  images?: unknown;
  image_data?: unknown;
  image_url?: unknown;
};

/**
 * Product API already returns images[]; web used to show only image_data.
 * Preserve the same gallery ordering as the B2B iOS/Android app, keeping
 * a legacy single cover as a fallback. Skip duplicates and empty values.
 */
export function collectB2BProductImages(product?:ProductImageSources|null): string[] {
  if(!product)return [];
  const candidates=[
    ...(Array.isArray(product.images)?product.images:[]),
    product.image_data,
    product.image_url,
  ];
  const unique=new Set<string>();
  for(const candidate of candidates){
    if(typeof candidate!=="string")continue;
    const source=candidate.trim();
    if(!source || /^javascript:/i.test(source) || /^data:(?!image\/)/i.test(source))continue;
    unique.add(source);
    if(unique.size>=26)break;
  }
  return [...unique];
}

export function galleryIndexAfterMove(index:number,count:number,direction:-1|1):number {
  if(!Number.isInteger(count)||count<1)return 0;
  const safeIndex=Number.isInteger(index)?Math.max(0,Math.min(index,count-1)):0;
  return (safeIndex+direction+count)%count;
}
