import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCTION_API_URL = 'https://admin.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
const KEY = 'caliskan_auth_token';

export type AuthUser = {
  id: string;
  username?: string;
  email: string;
  role: string;
  appAccess: string;
  isActive: boolean;
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};

async function parse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'İşlem başarısız');
  }
  return payload;
}

export const localAuth = {
  async getSession(): Promise<AuthSession | null> {
    const token = await AsyncStorage.getItem(KEY);
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await AsyncStorage.removeItem(KEY);
        return null;
      }

      const payload = await response.json();
      if (!payload?.user) {
        await AsyncStorage.removeItem(KEY);
        return null;
      }

      return {
        access_token: token,
        user: payload.user as AuthUser,
      };
    } catch {
      // Network interruption should not destroy a valid saved login token.
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
    } catch {
      throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    }

    const payload = await parse(response);
    if (!payload?.token || !payload?.user) {
      throw new Error('Mobil oturum oluşturulamadı. Lütfen tekrar deneyin.');
    }

    await AsyncStorage.setItem(KEY, String(payload.token));
    return {
      access_token: String(payload.token),
      user: payload.user as AuthUser,
    };
  },

  async signOut() {
    const token = await AsyncStorage.getItem(KEY);
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    await AsyncStorage.removeItem(KEY);
  },
};
