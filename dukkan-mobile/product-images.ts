const API="https://admin.ecalisgan.com";
export type ProductPicture={id?:string|number;image_url?:string|null;image_count?:number|string|null};
export type ProductImageSource={uri:string;headers?:Record<string,string>};

// The product list intentionally returns no raw image_data base64 payloads.
// Private store thumbnails require the member's existing bearer authorization.
export function productImageSource(product:ProductPicture,storeId:number,token:string):ProductImageSource|null{
  const id=Number(product.id);
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(storeId)||storeId<=0)return null;
  const raw=String(product.image_url||"").trim();
  const safeStorePath="/api/dukkan/stores/"+storeId+"/products/"+id+"/image";
  const internal=API+safeStorePath;
  const count=Number(product.image_count||0);
  const url=count>0?internal+"?index=0":
    raw===safeStorePath||raw.startsWith(safeStorePath+"?")?API+raw:
    raw.startsWith("https://")?raw:"";
  if(!url)return null;
  if(url.startsWith(internal)&&token)return {uri:url,headers:{Authorization:"Bearer "+token}};
  if(url.startsWith(API+"/")&&token)return {uri:url,headers:{Authorization:"Bearer "+token}};
  // Never send private login credentials to remote image/CDN hosts.
  return {uri:url};
}
