/**
 * B2B promotional notification destinations. Never follow arbitrary
 * external URLs or react-native deep links from push payloads.
 * Resolve known pages to native screens; keep other approved B2B pages on web.
 */
export type NotificationDestination =
  | {kind:'product';id:string}
  | {kind:'category';category:string}
  | {kind:'store';slug:string}
  | {kind:'route';path:string}
  | {kind:'web';url:string}
  | null;

export function resolveB2BNotificationLink(value:unknown):NotificationDestination {
  if(typeof value!=='string'||!value.trim()||value.length>500 ||
     /[\u0000-\u001f\u007f\\]/.test(value))return null;
  const raw=value.trim();
  if(raw.startsWith('//')||(!raw.startsWith('/')&&!/^https:\/\//i.test(raw))||
      /%(?:2f|5c|2e)/i.test(raw))return null;
  let url:URL;
  try{url=new URL(raw,'https://b2b.ecalisgan.com');}
  catch{return null;}
  if(url.origin!=='https://b2b.ecalisgan.com'||url.search||url.hash||
     url.username||url.password||url.pathname.startsWith('//'))return null;
  const path=url.pathname;
  if(path.length>450)return null;

  const pages:Record<string,string>={
    '/':'/(tabs)',
    '/urunler':'/(tabs)/products',
    '/kategoriler':'/(tabs)/menu',
    '/siparislerim':'/my-orders',
    '/hesabim':'/(tabs)/profile',
    '/reels':'/(tabs)/discover',
    '/kampanyalar':'/campaigns',
    '/defter':'/ledger',
    '/magazalar':'/(tabs)/marketplace',
  };
  if(pages[path])return {kind:'route',path:pages[path]};
  const product=/^\/urun\/([A-Za-z0-9._-]{1,100})\/?$/.exec(path);
  if(product)return {kind:'product',id:product[1]};
  const category=/^\/kategori\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path);
  if(category)return {kind:'category',category:category[1]};
  const store=/^\/magaza\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path);
  if(store)return {kind:'store',slug:store[1]};
  // Unsupported B2B web pages may still be visited securely in the browser.
  return {kind:'web',url:'https://b2b.ecalisgan.com'+path};
}
