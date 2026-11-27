import { getBusinessSession, getBusinessToken } from "./auth";
import { businessReadCache } from "./read-cache";
import { getBusinessReviewFixture } from "./review-fixtures";

const API = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getBusinessSession();
  if (!session?.token) throw new Error("Oturum bulunamadı");
  if (session.user.role === "business_reviewer") {
    // Use the exact production screen components with isolated sample data.
    // The server already rejects reviewer access to real APIs. Never make a
    // privileged HTTP request for this account, including GET requests.
    const method = String(init.method || "GET").toUpperCase();
    if (method !== "GET") {
      throw new Error("İnceleme hesabında veri değiştirilemez. Bu işlemler yalnızca yetkili işletme hesabında kullanılabilir.");
    }
    return getBusinessReviewFixture(path) as T;
  }

  const mutation = !["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase());
  if (mutation) businessReadCache.clear();
  try {
  const response = await fetch(`${API}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) businessReadCache.clear();
    throw new Error(payload?.error || payload?.message || `İstek başarısız (HTTP ${response.status})`);
  }

  return payload as T;
  } finally {
    if (mutation) businessReadCache.clear();
  }
}

// Only explicitly opted-in list/dashboard reads are shared. Details, messages,
// financial operations and other sensitive requests keep the existing live API.
export const BUSINESS_PRODUCTS_PATH = "/api/admin/b2b-products?view=business-list";
const cachedReads = new Set([
  BUSINESS_PRODUCTS_PATH, "/api/admin/dashboard-overview", "/api/admin/orders",
  "/api/admin/b2b-applications",
]);
export function peekBusinessRead<T>(path: string): T | undefined {
  return cachedReads.has(path) ? businessReadCache.peek<T>(getBusinessToken(), path) : undefined;
}
export function apiRead<T>(path: string, force = false): Promise<T> {
  if (!cachedReads.has(path)) return apiFetch<T>(path);
  return businessReadCache.read<T>(getBusinessToken(), path, () => apiFetch<T>(path), force);
}

