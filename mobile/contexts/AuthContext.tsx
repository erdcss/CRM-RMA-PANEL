import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  localAuth,
  type AuthSession,
  type AuthUser,
  type RegistrationPayload,
  type RegistrationResult,
  type TaxVerification,
} from '@/lib/supabase';
import { rmaApi } from '@/lib/api';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  completeInitialPassword: (password: string, passwordAgain: string) => Promise<AuthSession>;
  registerApplication: (payload: RegistrationPayload) => Promise<RegistrationResult>;
  verifyTaxNumber: (taxNumber: string) => Promise<TaxVerification>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localAuth
      .getSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const next = await localAuth.signIn(email, password);
        setSession(next);
        return next;
      },
      async completeInitialPassword(password, passwordAgain) {
        const next = await localAuth.completeInitialPassword(password, passwordAgain);
        setSession(next);
        return next;
      },
      registerApplication: (payload) => localAuth.registerApplication(payload),
      verifyTaxNumber: (taxNumber) => localAuth.verifyTaxNumber(taxNumber),
      async signOut() {
        await localAuth.signOut();
        setSession(null);
      },
      async deleteAccount() {
        await rmaApi.deleteAccount();
        await localAuth.signOut();
        setSession(null);
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
