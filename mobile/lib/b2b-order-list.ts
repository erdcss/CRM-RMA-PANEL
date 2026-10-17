import AsyncStorage from '@react-native-async-storage/async-storage';
import { rmaApi, absoluteMediaUrl } from '@/lib/api';

const KEY = 'caliskan_b2b_order_list_v1';

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
  // Supplier lines are stored per-account on the server, shared across web/iOS/Android.
  // Old locally stored supplier lines must not reappear after a server-side removal.
  try {
    const cart=await rmaApi.getMarketplaceCart();
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
    return [...suppliers,...local.filter(item=>!item.marketplaceProductId&&!item.productId.startsWith('mp-'))];
  }catch {
    return local;
  }
}

async function save(items: B2BOrderListItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emit();
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
}

export function orderListItemUnits(item: B2BOrderListItem) {
  return Math.max(1, item.unitsPerBox) * Math.max(1, item.boxQuantity);
}

export function orderListItemTotal(item: B2BOrderListItem) {
  return orderListItemUnits(item) * Number(item.unitPrice || 0);
}
