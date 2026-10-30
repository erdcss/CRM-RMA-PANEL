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
import { markB2BPushSignedOut } from '@/lib/push';
import { AppState } from 'react-native';
import { trackMobileSession } from '@/lib/customer-insights';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  completeInitialPassword: (password: string, passwordAgain: string) => Promise<AuthSession>;
  registerApplication: (payload: RegistrationPayload) => Promise<RegistrationResult>;
  verifyTaxNumber: (taxNumber: string) => Promise<TaxVerification>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    // Finish session detection before the 5-second launch splash expires,
    // even when an offline request hangs. The saved token is not deleted.
    const deadline = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), 4_500);
    });

    void Promise.race([localAuth.getSession().catch(() => null), deadline])
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (session?.user?.role !== 'b2b_customer' || session.user.isActive !== true) return;
    void trackMobileSession();
    const listener=AppState.addEventListener('change',state=>{
      if(state==='active')void trackMobileSession();
    });
    return ()=>listener.remove();
  }, [session?.access_token]);

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
      forgotPassword: (email) => localAuth.forgotPassword(email),
      async signOut() {
        // Keep the push-token association only for explicit admin campaigns.
        // Normal account notifications must not expose sensitive details
        // when this device has been signed out.
        if(session?.access_token)await markB2BPushSignedOut(session.access_token);
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
