import { getBusinessSession } from "./auth";

const API = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getBusinessSession();
  if (!session?.token) throw new Error("Oturum bulunamadı");

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
