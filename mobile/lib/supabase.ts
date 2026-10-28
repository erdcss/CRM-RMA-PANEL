import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCTION_API_URL = 'https://b2b.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
const KEY = 'caliskan_auth_token';

// API requests need the saved token, not an extra /api/auth/session roundtrip.
// Keep a single shared storage read and update the cache on login/logout.
let cachedToken: string | null | undefined;
let tokenRead: Promise<string | null> | null = null;
let cachedUserId: string | null = null;

async function readSavedToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  if (!tokenRead) {
    tokenRead = AsyncStorage.getItem(KEY)
      .then((value) => {
        if (cachedToken === undefined) cachedToken = value;
        return cachedToken ?? null;
      })
      .finally(() => { tokenRead = null; });
  }
  return tokenRead;
}

function storeAuthCache(token: string | null, userId: unknown = null) {
  cachedToken = token;
  cachedUserId = token && userId != null ? String(userId) : null;
}

export type AuthUser = {
  id: string;
  username?: string;
  email: string;
  role: string;
  appAccess: string;
  isActive: boolean;
  mustChangePassword?: boolean;
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};

export type RegistrationPayload = {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  companyCategory: string;
  taxNumber: string;
};

export type RegistrationResult = {
  id: string | number;
  username: string;
  status: 'pending' | string;
  enrollmentToken?: string | null;
  taxVerified?: boolean;
  taxOffice?: string | null;
  message?: string;
};

export type TaxVerification = {
  valid: boolean;
  verified: boolean;
  taxNumber: string;
  taxOffice?: string | null;
  companyName?: string | null;
  serviceConfigured?: boolean;
  message?: string;
};

async function parse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'İşlem başarısız');
  }
  return payload;
}

async function requestPublic(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
  }
  return parse(response);
}

export const localAuth = {
  async getSession(): Promise<AuthSession | null> {
    const token = await readSavedToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // A temporary 5xx outage must not silently sign the user out.
        if (response.status === 401 || response.status === 403) {
          await AsyncStorage.removeItem(KEY);
          storeAuthCache(null);
        }
        return null;
      }

      const payload = await response.json();
      if (!payload?.user) {
        return null;
      }

      cachedUserId = String(payload.user.id ?? '');
      return {
        access_token: token,
        user: payload.user as AuthUser,
      };
    } catch {
      // Geçici ağ kesintisinde kayıtlı tokenı silmeyiz.
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/b2b/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
    } catch {
      throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    }

    const payload = await parse(response);
    if (!payload?.token || !payload?.user) {
      throw new Error('B2B mobil oturumu oluşturulamadı. Lütfen tekrar deneyin.');
    }

    const user = {
      ...(payload.user as AuthUser),
      mustChangePassword: Boolean(payload.mustChangePassword ?? payload.user?.mustChangePassword),
    };

    await AsyncStorage.setItem(KEY, String(payload.token));
    storeAuthCache(String(payload.token), user.id);
    return {
      access_token: String(payload.token),
      user,
    };
  },

  async completeInitialPassword(password: string, passwordAgain: string): Promise<AuthSession> {
    const token = await readSavedToken();
    if (!token) {
      throw new Error('Oturum bulunamadı. Tek kullanımlık şifrenizle tekrar giriş yapın.');
    }

    const response = await fetch(`${API_URL}/api/b2b/change-initial-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password, passwordAgain }),
    });

    await parse(response);

    const session = await localAuth.getSession();
    if (!session) {
      throw new Error('Yeni şifre kaydedildi fakat oturum yenilenemedi. Yeni şifrenizle giriş yapın.');
    }
    session.user.mustChangePassword = false;
    return session;
  },

  async registerApplication(payload: RegistrationPayload): Promise<RegistrationResult> {
    return requestPublic('/api/b2b/register', payload) as Promise<RegistrationResult>;
  },

  async verifyTaxNumber(taxNumber: string): Promise<TaxVerification> {
    return requestPublic('/api/b2b/tax-verify', { taxNumber }) as Promise<TaxVerification>;
  },

  async forgotPassword(email: string): Promise<{ ok: boolean; message?: string }> {
    return requestPublic('/api/b2b/forgot-password', {
      email: email.trim().toLowerCase(),
    }) as Promise<{ ok: boolean; message?: string }>;
  },

  async getRequestCredentials(): Promise<{ token: string | null; userId: string | null }> {
    return { token: await readSavedToken(), userId: cachedUserId };
  },

  async signOut() {
    const token = await readSavedToken();
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    await AsyncStorage.removeItem(KEY);
    storeAuthCache(null);
  },
};
