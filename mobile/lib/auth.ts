/**
 * Supabase Auth session for the Aarohmm B2B app.
 *
 * Login is GSTIN-first so it matches how retailers already identify
 * themselves on the web portal:
 *
 *   1. retailer types their GSTIN
 *   2. our backend finds the inbox registered against it and asks Supabase
 *      to mail a 6-digit code — the app is told only a MASKED address
 *   3. the retailer types the code; the backend verifies it with Supabase
 *      and hands back the resulting session tokens
 *   4. we install those tokens into supabase-js, which then owns refresh
 *
 * Why the backend brokers it: GSTINs are public information, so an endpoint
 * that turned a GSTIN into a real email address would leak every retailer's
 * contact details. The raw address never leaves the server.
 *
 * No passwords exist in this app at all. supabase-js persists the session in
 * AsyncStorage, so a retailer stays signed in across restarts.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { apiFetch } from './api';
export type CodeRequest = {
  sent: boolean;
  business_name?: string;
  masked_email?: string;
};

export type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /** Mail a one-time code to the inbox registered against this GSTIN. */
  requestCode: (gstin: string) => Promise<CodeRequest>;
  /** Exchange the 6-digit code for a Supabase session. */
  verifyCode: (gstin: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  requestCode: async () => ({ sent: false }),
  verifyCode: async () => {},
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useAuthState(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const requestCode = useCallback(async (gstin: string) => {
    return apiFetch<CodeRequest>('/api/app/v2/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ gstin: gstin.trim().toUpperCase() }),
    });
  }, []);

  const verifyCode = useCallback(async (gstin: string, code: string) => {
    const data = await apiFetch<{ access_token: string; refresh_token: string }>(
      '/api/app/v2/auth/verify-code',
      {
        method: 'POST',
        body: JSON.stringify({ gstin: gstin.trim().toUpperCase(), code: code.trim() }),
      }
    );
    // Hand the tokens to supabase-js so it owns persistence + refresh, and
    // so PostgREST reads run as this retailer under Row-Level Security.
    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  return { session, loading, requestCode, verifyCode, signOut };
}

/** Current access token, for authenticated calls to our own backend. */
export { accessToken } from './token';
