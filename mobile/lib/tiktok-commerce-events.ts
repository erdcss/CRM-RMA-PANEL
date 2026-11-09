import AsyncStorage from '@react-native-async-storage/async-storage';
import type { B2BProduct, B2BCheckoutPreview, B2BCheckoutCartPreview, B2BOrderSummary, B2BOrderDetail } from './api';
import {rmaApi} from './api';
import {sendTikTokNativeCommerceEvent} from './tiktok-app-events';

type EventName='ViewContent'|'Search'|'AddToCart'|'Checkout'|'Purchase';
type CommerceLine={contentId:string;contentName:string;brand?:string;contentCategory?:string;price:number;quantity:number};
type Payload={eventId:string;value:number;currency:'TRY';contents:CommerceLine[]};
const rules=require('./tiktok-commerce-rules.cjs') as {
  buildCommercePayload:(name:EventName,items:CommerceLine[],value:number,eventId?:string)=>Payload|null;
  sanitizeProductSearch:(query:string)=>string;
  isVerifiedPaidOrder:(order:B2BOrderSummary)=>boolean;
  verifiedPurchaseEventId:(order:B2BOrderSummary)=>string;
  createPurchaseGuard:()=> (eventId:string,storage:{getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>},send:()=>Promise<boolean>)=>Promise<boolean>;
};
const deliverPurchaseOnce=rules.createPurchaseGuard();
const searchHistory=new Map<string,number>();
const orderPrefix='caliskan_tiktok_paid_order_v1_';
function safePositive(value:unknown):number|null{
  const n=Number(value);
  return Number.isFinite(n)&&n>0?n:null;
}
function contentId(product:{id?:string|number;sku?:string|null}):string{
  // Catalog SKU is preferred to align app content IDs with product feed entries.
  // Marketplace IDs remain namespaced when SKU is missing.
  return String(product.sku||product.id||'').trim();
}
function productLine(product:B2BProduct,unitCount=1):CommerceLine|null{
  const price=safePositive(product.price);
  const id=contentId(product);
  if(!price||!id||!Number.isSafeInteger(unitCount)||unitCount<1)return null;
  return {contentId:id,contentName:product.name,brand:product.brand||undefined,
    contentCategory:product.category||product.collection_name||undefined,
    price,quantity:unitCount};
}
async function dispatch(name:EventName,items:CommerceLine[],value:number,eventId=''):Promise<boolean>{
  const payload=rules.buildCommercePayload(name,items,value,eventId);
  if(!payload)return false;
  return sendTikTokNativeCommerceEvent(name,payload);
}
export async function trackTikTokProductView(product:B2BProduct):Promise<boolean>{
  const line=productLine(product);
  return line?dispatch('ViewContent',[line],line.price):false;
}
export async function trackTikTokProductSearch(query:string):Promise<boolean>{
  const term=rules.sanitizeProductSearch(query);
  if(!term)return false;
  const key=term.toLocaleLowerCase('tr-TR');
  const now=Date.now();
  if(now-(searchHistory.get(key)||0)<30000)return false;
  const ok=await sendTikTokNativeCommerceEvent('Search',{eventId:'',query:term});
  if(ok)searchHistory.set(key,now);
  return ok;
}
export async function trackTikTokAddToCart(product:B2BProduct,boxes:number):Promise<boolean>{
  const unitCount=boxes*Math.max(1,Number(product.units_per_box||1));
  const line=productLine(product,unitCount);
  return line?dispatch('AddToCart',[line],line.price*line.quantity):false;
}
export async function trackTikTokCheckout(preview:B2BCheckoutPreview|B2BCheckoutCartPreview):Promise<boolean>{
  const lines=('items' in preview?preview.items:[{
    product:preview.product,quantity:preview.quantity,totalUnits:preview.totalUnits,total:preview.total
  }]);
  const items:CommerceLine[]=[];
  for(const row of lines){
    const units=Number(row.totalUnits);
    const total=safePositive(row.total);
    const id=contentId(row.product);
    if(!total||!id||!Number.isSafeInteger(units)||units<1)return false;
    items.push({contentId:id,contentName:row.product.name,
      contentCategory:row.product.category,price:total/units,quantity:units});
  }
  const total=safePositive(preview.total);
  return total?dispatch('Checkout',items,total):false;
}
function detailsToContents(order:B2BOrderDetail):CommerceLine[]|null{
  if(!Array.isArray(order.items)||order.items.length===0)return null;
  const rows:CommerceLine[]=[];
  for(const item of order.items){
    const id=String(item.sku||item.productId||'').trim();
    const units=Number(item.totalUnits||0) ||
      Number(item.quantity||0)*Math.max(1,Number(item.unitsPerBox||1));
    const total=safePositive(item.total);
    if(!id||!total||!Number.isSafeInteger(units)||units<1)return null;
    rows.push({contentId:id,contentName:String(item.name||'Ürün'),
      price:total/units,quantity:units});
  }
  return rows;
}
/** Server payment status is authoritative. A successful deep link or bank notification
 * is not proof of capture. This function can only count server-confirmed paid orders.
 * Locally remembered order IDs and native event IDs prevent navigation/retry duplicates.
 */
export async function trackTikTokVerifiedPurchase(orderNumber:string):Promise<boolean>{
  const number=String(orderNumber||'').trim();
  if(!number||number.length>100)return false;
  try{
    const orders=await rmaApi.listB2BOrders();
    const summary=orders.find(o=>String(o.order_number||'')===number);
    if(!summary||!rules.isVerifiedPaidOrder(summary))return false;
    const id=rules.verifiedPurchaseEventId(summary);
    if(!id)return false;
    const storageKey=orderPrefix+id;
    return deliverPurchaseOnce(storageKey,{
      getItem:key=>AsyncStorage.getItem(key),
      setItem:(key,value)=>AsyncStorage.setItem(key,value)
    },async()=>{
      const details=await rmaApi.getB2BOrderDetail(summary.id);
      if(String(details.order_number||'')!==number||!rules.isVerifiedPaidOrder(details))return false;
      const lines=detailsToContents(details);
      const amount=safePositive(details.total_amount);
      if(!lines||!amount)return false;
      return dispatch('Purchase',lines,amount,id);
    });
  }catch{return false;}
}
