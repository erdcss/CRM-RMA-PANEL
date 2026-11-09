const API="https://admin.ecalisgan.com";
export type ProductPicture={id?:string|number;image_url?:string|null;image_external_url?:string|null;image_count?:number|string|null};
export type ProductImageSource={uri:string;headers?:Record<string,string>};

// The product list intentionally returns no raw image_data base64 payloads.
// Private store thumbnails require the member's existing bearer authorization.
export function productImageSource(product:ProductPicture,storeId:number|string,token:string):ProductImageSource|null{
  // PostgreSQL BIGINT is serialized as a string by node-postgres, including
  // dukkan_stores.id. Rejecting a string store id made ALL images disappear.
  const id=Number(product.id);
  const numericStoreId=Number(storeId);
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(numericStoreId)||numericStoreId<=0)return null;
  const raw=String(product.image_url||"").trim();
  const external=String(product.image_external_url||"").trim();
  const safeStorePath="/api/dukkan/stores/"+numericStoreId+"/products/"+id+"/image";
  const internal=API+safeStorePath;
  const count=Number(product.image_count||0);
  // External covers load directly; private headers must never follow a redirect
  // from our authenticated thumbnail endpoint to a third-party host.
  const url=external.startsWith("https://")?external:
    raw.startsWith("https://")?raw:
    count>0?internal+"?index=0":
    raw===safeStorePath||raw.startsWith(safeStorePath+"?")?API+raw:"";
  if(!url)return null;
  if(url.startsWith(internal)&&token)return {uri:url,headers:{Authorization:"Bearer "+token}};
  if(url.startsWith(API+"/")&&token)return {uri:url,headers:{Authorization:"Bearer "+token}};
  // Never send private login credentials to remote image/CDN hosts.
  return {uri:url};
}
