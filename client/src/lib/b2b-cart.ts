import { useEffect, useMemo, useState } from "react";

export type B2BCartItem = {
  productId: string;
  sku: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  minOrderQty: number;
  stock: number;
};

const STORAGE_KEY = "caliskan-b2b-order-draft-v1";
const EVENT_NAME = "caliskan-b2b-cart-change";

function normalize(items: unknown): B2BCartItem[] {
  if (!Array.isArray(items)) return [];

  const result: B2BCartItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const value = raw as Record<string, unknown>;
    const productId = String(value.productId || "").trim();
    const name = String(value.name || "").trim();
    const price = Number(value.price);
    const stock = Math.max(0, Number(value.stock || 0));
    const minOrderQty = Math.max(1, Number(value.minOrderQty || 1));
    const quantity = Math.min(
      stock || minOrderQty,
      Math.max(minOrderQty, Number(value.quantity || minOrderQty)),
    );

    if (!productId || !name || !Number.isFinite(price) || price < 0) continue;
    result.push({
      productId,
      sku: String(value.sku || ""),
      name,
      image: typeof value.image === "string" && value.image ? value.image : null,
      price,
      quantity,
      minOrderQty,
      stock,
    });
  }
  return result.slice(0, 100);
}

export function getB2BCart(): B2BCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function persist(items: B2BCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(items)));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function addB2BCartItem(item: B2BCartItem) {
  const current = getB2BCart();
  const index = current.findIndex((entry) => entry.productId === item.productId);

  if (index >= 0) {
    const previous = current[index];
    const quantity = Math.min(
      item.stock || item.minOrderQty,
      Math.max(item.minOrderQty, previous.quantity + item.quantity),
    );
    current[index] = { ...previous, ...item, quantity };
  } else {
    current.push(item);
  }

  persist(current);
}

export function updateB2BCartQuantity(productId: string, quantity: number) {
  const current = getB2BCart().map((item) => {
    if (item.productId !== productId) return item;
    return {
      ...item,
      quantity: Math.min(
        item.stock || item.minOrderQty,
        Math.max(item.minOrderQty, quantity),
      ),
    };
  });
  persist(current);
}

export function removeB2BCartItem(productId: string) {
  persist(getB2BCart().filter((item) => item.productId !== productId));
}

export function clearB2BCart() {
  persist([]);
}

export function useB2BCart() {
  const [items, setItems] = useState<B2BCartItem[]>(() => getB2BCart());

  useEffect(() => {
    const refresh = () => setItems(getB2BCart());
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  return { items, itemCount, total };
}
