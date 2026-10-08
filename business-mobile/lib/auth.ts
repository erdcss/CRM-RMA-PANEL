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

export async function signIn(email: string, password: string): Promise<BusinessSession> {
  let response: Response;

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

  currentSession = { user, token };
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

  if (token) {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}
