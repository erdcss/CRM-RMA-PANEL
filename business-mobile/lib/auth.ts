import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

export type BusinessAuthUser = {
  id: number;
  username: string;
  email?: string;
  role: string;
  appAccess: string;
  isActive: boolean;
};

type BusinessSession = {
  user: BusinessAuthUser;
  token: string;
};

let currentSession: BusinessSession | null = null;
const BUSINESS_SESSION_KEY = "caliskan.business.session.v1";

async function forgetStoredSession() {
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(BUSINESS_SESSION_KEY).catch((error) => {
      console.warn("Business secure session cleanup failed:", error);
    });
  }
}

/** Restore the signed mobile token from the device's encrypted storage.
 * Never interpret a network outage as a logout; server 401/403 invalidates it.
 */
export async function restoreBusinessSession(): Promise<BusinessSession | null> {
  if (currentSession) return currentSession;
  if (Platform.OS === "web") return null;

  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(BUSINESS_SESSION_KEY);
  } catch (error) {
    console.warn("Business secure session read failed:", error);
    return null;
  }
  if (!stored) return null;

  let session: BusinessSession;
  try {
    session = JSON.parse(stored) as BusinessSession;
    if (!session?.token || typeof session.token !== "string" ||
        !session.user || !Number.isSafeInteger(session.user.id) ||
        session.user.id <= 0 || !session.user.isActive) {
      throw new Error("Invalid stored Business session");
    }
  } catch {
    await forgetStoredSession();
    return null;
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      await forgetStoredSession();
      return null;
    }
    if (response.ok) {
      const profile = await response.json() as BusinessAuthUser & { mustChangePassword?: boolean };
      const permitted = profile.id === session.user.id && profile.isActive &&
        !profile.mustChangePassword &&
        (["admin", "super_admin", "b2b_seller", "business_reviewer"].includes(profile.role) ||
          profile.appAccess === "business");
      if (!permitted) {
        await forgetStoredSession();
        return null;
      }
      session.user = {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role,
        appAccess: profile.appAccess,
        isActive: profile.isActive,
      };
    }
  } catch {
    // Keep a validly shaped local session during temporary network failures.
    // Subsequent API calls still require the server to authorize the bearer token.
  } finally {
    clearTimeout(deadline);
  }

  currentSession = session;
  return session;
}

export async function signIn(email: string, password: string): Promise<BusinessSession> {
  let response: Response;
  let supplierLogin = false;

  try {
    response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  } catch {
    throw new Error("Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.");
  }

  // Dedicated Business App Review login has no admin or supplier permissions.
  // Only failed admin attempts may try this identity provider.
  let reviewLogin = false;
  if (response.status === 401) {
    try {
      const reviewResponse = await fetch(`${API}/api/business-review/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (reviewResponse.ok) {
        response = reviewResponse;
        reviewLogin = true;
      }
    } catch {
      // Preserve the existing seller login fallback when reviewer login is unavailable.
    }
  }

  // Super admins use the admin endpoint. Suppliers use the existing
  // B2B identity provider. The reviewer route is isolated from both.
  if (response.status === 401) {
    try {
      response = await fetch(`${API}/api/seller/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      supplierLogin = response.ok;
    } catch {
      throw new Error("Sunucuya bağlanılamadı.");
    }
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Giriş başarısız");
  }

  const user = payload.user as BusinessAuthUser | undefined;
  const token = typeof payload.token === "string" ? payload.token : "";

  if (!user || !token) {
    throw new Error("Mobil oturum oluşturulamadı. Lütfen tekrar deneyin.");
  }

  if (reviewLogin) {
    if (user.role !== "business_reviewer" || user.appAccess !== "business" || !user.isActive) {
      throw new Error("Geçersiz Business inceleme hesabı.");
    }
  } else if (supplierLogin) {
    if (user.role !== "b2b_seller") throw new Error("Çalışkan Business için tedarikçi hesabı gerekiyor");
    if (payload.mustChangePassword) throw new Error("Önce Çalışkan B2B web hesabınızda ilk şifrenizi belirleyin.");
    const supplierCheck = await fetch(`${API}/api/marketplace/me`, {
      headers: {Authorization: `Bearer ${token}`, Accept: "application/json"},
    });
    if (!supplierCheck.ok) throw new Error("Tedarikçi yetkisi doğrulanamadı");
    const supplier = await supplierCheck.json().catch(() => null);
    if (supplier?.status !== "approved") throw new Error("Çalışkan Business erişimi için tedarikçi onayı gerekiyor.");
  } else if (user.role === "b2b_seller") {
    const supplierCheck = await fetch(`${API}/api/marketplace/me`, {headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
    if (!supplierCheck.ok) throw new Error("Tedarikçi yetkisi doğrulanamadı");
    const supplier = await supplierCheck.json().catch(() => null);
    if (!supplier || supplier.status !== "approved") throw new Error("Onaylı tedarikçi hesabı gerekiyor");
  } else if (user.appAccess !== "business" && !["admin","super_admin"].includes(user.role)) {
    throw new Error("Bu hesabın Çalışkan Business erişimi yok");
  }

  currentSession = { user, token };
  if (Platform.OS !== "web") {
    try {
      await SecureStore.setItemAsync(BUSINESS_SESSION_KEY, JSON.stringify(currentSession));
    } catch (error) {
      console.warn("Business session could not be saved securely:", error);
    }
  }
  return currentSession;
}

export async function getBusinessSession() {
  return currentSession;
}

export function getBusinessToken() {
  return currentSession?.token || "";
}

export async function signOut() {
  const token = currentSession?.token;
  currentSession = null;
  await forgetStoredSession();

  if (token) {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}
