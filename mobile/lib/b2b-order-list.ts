import AsyncStorage from '@react-native-async-storage/async-storage';

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
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(items: B2BOrderListItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  emit();
  return items;
}

export async function addToOrderList(item: B2BOrderListItem) {
  const items = await getOrderList();
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
  const items = await getOrderList();
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
  const items = await getOrderList();
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
