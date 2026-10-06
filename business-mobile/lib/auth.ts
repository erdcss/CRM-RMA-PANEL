import AsyncStorage from "@react-native-async-storage/async-storage";

const API = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");
const KEY = "caliskan_business_token";

export type BusinessAuthUser = {
  id: number;
  username: string;
  email?: string;
  role: string;
  appAccess: string;
  isActive: boolean;
};

export async function signIn(email: string, password: string) {
  let response: Response;

  try {
    response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });
  } catch {
    throw new Error("Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.");
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

  if (
    user.appAccess !== "business" &&
    !["admin", "super_admin"].includes(user.role)
  ) {
    throw new Error("Bu hesabın Çalışkan Business erişimi yok");
  }

  await AsyncStorage.setItem(KEY, token);
  return { user, token };
}

export async function getBusinessSession() {
  const token = await AsyncStorage.getItem(KEY);
  if (!token) return null;

  try {
    const response = await fetch(`${API}/api/auth/session`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }

    const payload = await response.json();
    return payload?.user ? { token, user: payload.user as BusinessAuthUser } : null;
  } catch {
    return null;
  }
}

export async function signOut() {
  const token = await AsyncStorage.getItem(KEY);
  if (token) {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  await AsyncStorage.removeItem(KEY);
}
