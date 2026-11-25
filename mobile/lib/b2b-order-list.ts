import AsyncStorage from '@react-native-async-storage/async-storage';
import { rmaApi, absoluteMediaUrl } from '@/lib/api';
import { localAuth } from '@/lib/supabase';

const KEY = 'caliskan_b2b_order_list_v1';
const TRACK_OWNER_KEY='caliskan_b2b_order_list_tracking_owner';

export type B2BOrderListItem = {
  productId: string;
  sku: string;
  name: string;
  image: string | null;
  unitPrice: number;
  unitsPerBox: number;
  boxQuantity: number;
  minOrderQty: number;
  stock: number;
  marketplaceProductId?: number;
  sellerSlug?: string;
  sellerName?: string;
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeOrderList(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getOrderList(): Promise<B2BOrderListItem[]> {
  let local:B2BOrderListItem[]=[];
  try {
    const raw=await AsyncStorage.getItem(KEY);
    const parsed=raw?JSON.parse(raw):[];
    local=Array.isArray(parsed)?parsed:[];
  }catch{}
  // Only show local products that the server says this account can access.
  // Never fall back to unverified AsyncStorage values on auth/network errors.
  const [catalogResult,cartResult]=await Promise.allSettled([
    rmaApi.listB2BProducts(),rmaApi.getMarketplaceCart()
  ]);
  const visibleIds=new Set(
    catalogResult.status==='fulfilled'
      ?catalogResult.value.map(row=>String(row.id))
      :[]
  );
  const verified=local.filter(item=>!item.marketplaceProductId&&!item.productId.startsWith('mp-')&&visibleIds.has(item.productId));
  if(catalogResult.status==='fulfilled'&&verified.length!==local.length){
    await AsyncStorage.setItem(KEY,JSON.stringify(verified)).catch(()=>undefined);
    queueMobileCartSync(verified,true);
  }else if(catalogResult.status==='fulfilled'&&verified.length>0){
    // Reconcile existing local carts after the app reconnects, without claiming another firm's cart.
    queueMobileCartSync(verified,true);
  }
  const cart=cartResult.status==='fulfilled'?cartResult.value:{items:[]};
  const suppliers:B2BOrderListItem[]=cart.items.map(line=>({
    productId:'mp-'+String(line.product_id),
    marketplaceProductId:Number(line.product_id),
    sellerSlug:String(line.seller_slug||''),
    sellerName:String(line.company_name||''),
    sku:String(line.sku||''),
    name:String(line.content?.name||'Ürün'),
    image:absoluteMediaUrl(line.content?.imageUrl)||null,
    unitPrice:Number(line.price)||0,
    unitsPerBox:Math.max(1,Number(line.unitsPerBox)||1),
    boxQuantity:Number(line.boxes)||1,
    minOrderQty:Math.max(1,Number(line.content?.minBoxes)||1),
    stock:Math.max(0,Number(line.stock)||0),
  }));
  return [...suppliers,...verified];
}

let lastMobileCartSync:{owner:string;payload:string;at:number}|null=null;
async function syncMobileCart(items:B2BOrderListItem[],ownedOnly=false){
  // App installations may be shared: do not upload the last user's old local
  // cart into a different customer's corporate profile.
  const {token,userId}=await localAuth.getRequestCredentials();
  if(!token||!userId)return;
  const owner=await AsyncStorage.getItem(TRACK_OWNER_KEY);
  if(ownedOnly&&owner!==userId)return;
  if(owner&&owner!==userId&&items.length>0)return;
  if(!owner||items.length===0)await AsyncStorage.setItem(TRACK_OWNER_KEY,userId);
  const lines=items.filter(item=>!item.marketplaceProductId&&!item.productId.startsWith('mp-'))
    .map(item=>({productId:item.productId,quantity:item.boxQuantity}));
  const payload=JSON.stringify(lines);
  if(ownedOnly&&lastMobileCartSync?.owner===userId&&lastMobileCartSync.payload===payload&&Date.now()-lastMobileCartSync.at<30_000)return;
  await rmaApi.syncB2BCartTracking(lines);
  lastMobileCartSync={owner:userId,payload,at:Date.now()};
}
let mobileCartSyncQueue=Promise.resolve();
function queueMobileCartSync(items:B2BOrderListItem[],ownedOnly=false){
  // Serialize quick quantity edits and removals so older requests cannot
  // finish later and restore an already cleared customer basket.
  mobileCartSyncQueue=mobileCartSyncQueue.catch(()=>undefined).then(()=>syncMobileCart(items,ownedOnly));
  void mobileCartSyncQueue.catch(error=>console.warn('B2B cart tracking sync failed',error));
}
async function save(items: B2BOrderListItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emit();
  // Only own-store items: supplier cart is already tracked by the server.
  queueMobileCartSync(items);
  return items;
}

export async function addToOrderList(item: B2BOrderListItem) {
  if(item.marketplaceProductId || item.productId.startsWith('mp-')){
    const productId=item.marketplaceProductId||Number(item.productId.slice(3));
    if(!Number.isSafeInteger(productId)||productId<=0)throw new Error('Geçersiz tedarikçi ürünü.');
    await rmaApi.addMarketplaceCart(productId,item.boxQuantity);
    emit();
    return getOrderList();
  }
  const items = (await getOrderList()).filter(row=>!row.marketplaceProductId);
  const index = items.findIndex((entry) => entry.productId === item.productId);

  if (index >= 0) {
    items[index] = {
      ...items[index],
      ...item,
      boxQuantity: item.boxQuantity,
    };
  } else {
    items.unshift(item);
  }

  return save(items);
}

export async function updateOrderListQuantity(productId: string, boxQuantity: number) {
  if(productId.startsWith('mp-')){
    await rmaApi.addMarketplaceCart(Number(productId.slice(3)),boxQuantity);
    emit();
    return getOrderList();
  }
  const items = (await getOrderList()).filter(row=>!row.marketplaceProductId);
  const index = items.findIndex((entry) => entry.productId === productId);
  if (index < 0) return items;

  const item = items[index];
  const maxBoxes = Math.max(0, Math.floor(item.stock / Math.max(1, item.unitsPerBox)));
  const next = Math.max(
    item.minOrderQty,
    Math.min(maxBoxes || item.minOrderQty, Math.trunc(boxQuantity)),
  );

  items[index] = { ...item, boxQuantity: next };
  return save(items);
}

export async function removeFromOrderList(productId: string) {
  if(productId.startsWith('mp-')){
    const cart=await rmaApi.getMarketplaceCart();
    const line=cart.items.find(x=>Number(x.product_id)===Number(productId.slice(3)));
    if(line)await rmaApi.removeMarketplaceCart(line.id);
    emit();
    return getOrderList();
  }
  const items = (await getOrderList()).filter(row=>!row.marketplaceProductId);
  return save(items.filter((entry) => entry.productId !== productId));
}

export async function clearOrderList() {
  await AsyncStorage.removeItem(KEY);
  emit();
  queueMobileCartSync([]);
}

export function orderListItemUnits(item: B2BOrderListItem) {
  return Math.max(1, item.unitsPerBox) * Math.max(1, item.boxQuantity);
}

export function orderListItemTotal(item: B2BOrderListItem) {
  return orderListItemUnits(item) * Number(item.unitPrice || 0);
}
