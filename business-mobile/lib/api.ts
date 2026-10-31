import { getBusinessSession } from "./auth";
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
    throw new Error(payload?.error || payload?.message || `İstek başarısız (HTTP ${response.status})`);
  }

  return payload as T;
}
