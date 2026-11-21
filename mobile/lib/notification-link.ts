/**
 * B2B promotional notification destinations. Never follow arbitrary
 * external URLs or react-native deep links from push payloads.
 * Resolve known pages to native screens; keep other approved B2B pages on web.
 */
export type NotificationDestination =
  | {kind:'product';id:string}
  | {kind:'category';category:string}
  | {kind:'subcategory';category:string;subcategoryId:string}
  | {kind:'store';slug:string}
  | {kind:'route';path:string}
  | {kind:'support';ticketId:string}
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
    '/pazaryeri-sepetim':'/(tabs)/orders',
    '/hesabim':'/(tabs)/profile',
    '/hesabim/destek':'/account/support',
    '/reels':'/(tabs)/discover',
    '/kampanyalar':'/campaigns',
    '/defter':'/ledger',
    '/magazalar':'/(tabs)/marketplace',
  };
  if(pages[path])return {kind:'route',path:pages[path]};
  const support=/^\/hesabim\/destek\/([1-9]\d{0,15})\/?$/.exec(path);
  if(support)return {kind:'support',ticketId:support[1]};
  const product=/^\/urun\/([A-Za-z0-9._-]{1,100})\/?$/.exec(path);
  if(product)return {kind:'product',id:product[1]};
  // Storefront URLs use category names, which can contain Turkish characters.
  // /kategori/<name>/alt/<24-hex-id> must open the filtered native collection.
  const decodeCategory = (part:string):string|null => {
    try {
      const name=decodeURIComponent(part);
      if (!name || name.length > 80 || name === '.' || name === '..' ||
          /[\/\\\u0000-\u001f\u007f?#]/.test(name)) return null;
      return name;
    } catch { return null; }
  };
  const subcategory=/^\/kategori\/([^/]+)\/alt\/([a-fA-F0-9]{24})\/?$/.exec(path);
  if (subcategory) {
    const name=decodeCategory(subcategory[1]);
    if (!name) return null;
    return {kind:'subcategory',category:name,subcategoryId:subcategory[2].toLowerCase()};
  }
  const category=/^\/kategori\/([^/]+)\/?$/.exec(path);
  if (category) {
    const name=decodeCategory(category[1]);
    return name ? {kind:'category',category:name} : null;
  }
  const store=/^\/magaza\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path);
  if(store)return {kind:'store',slug:store[1]};
  // Unsupported B2B web pages may still be visited securely in the browser.
  return {kind:'web',url:'https://b2b.ecalisgan.com'+path};
}
