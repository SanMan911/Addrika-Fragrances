/**
 * Supabase Auth session for the Aarohmm B2B app.
 *
 * Sign-in mirrors the web portal, GSTIN-first:
 *
 *   1. retailer types their GSTIN
 *   2. the backend says whether that GSTIN is already a stockist. If it is
 *      not, the app sends them to the web registration form instead of
 *      pretending a password exists
 *   3. registered retailers type the SAME password they use on the website.
 *      The backend verifies it against MongoDB and mints a Supabase session
 *   4. we install those tokens into supabase-js, which then owns refresh
 *
 * A one-time emailed code is kept as a secondary route for retailers who
 * have forgotten their password.
 *
 * Why the backend brokers it: GSTINs are public information, so an endpoint
 * that turned a GSTIN into a real email address would leak every retailer's
 * contact details. The raw address never leaves the server.
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

export type GstinCheck = {
  registered: boolean;
  status: string | null;
  has_password: boolean;
  password_login_ready?: boolean;
  business_name?: string;
};

export type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /** Is this GSTIN already a stockist? Decides password vs registration. */
  checkGstin: (gstin: string) => Promise<GstinCheck>;
  /** GSTIN + the retailer's web password. */
  passwordLogin: (gstin: string, password: string) => Promise<void>;
  /** Mail a one-time code to the inbox registered against this GSTIN. */
  requestCode: (gstin: string) => Promise<CodeRequest>;
  /** Exchange the 6-digit code for a Supabase session. */
  verifyCode: (gstin: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  checkGstin: async () => ({ registered: false, status: null, has_password: false }),
  passwordLogin: async () => {},
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

  const checkGstin = useCallback(async (gstin: string) => {
    return apiFetch<GstinCheck>('/api/app/v2/auth/gstin-check', {
      method: 'POST',
      body: JSON.stringify({ gstin: gstin.trim().toUpperCase() }),
    });
  }, []);

  const installSession = useCallback(
    async (data: { access_token: string; refresh_token: string }) => {
      // Hand the tokens to supabase-js so it owns persistence + refresh, and
      // so PostgREST reads run as this retailer under Row-Level Security.
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) throw new Error(error.message);
    },
    []
  );

  const passwordLogin = useCallback(
    async (gstin: string, password: string) => {
      const data = await apiFetch<{ access_token: string; refresh_token: string }>(
        '/api/app/v2/auth/password-login',
        {
          method: 'POST',
          body: JSON.stringify({ gstin: gstin.trim().toUpperCase(), password }),
        }
      );
      await installSession(data);
    },
    [installSession]
  );

  const requestCode = useCallback(async (gstin: string) => {
    return apiFetch<CodeRequest>('/api/app/v2/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ gstin: gstin.trim().toUpperCase() }),
    });
  }, []);

  const verifyCode = useCallback(
    async (gstin: string, code: string) => {
      const data = await apiFetch<{ access_token: string; refresh_token: string }>(
        '/api/app/v2/auth/verify-code',
        {
          method: 'POST',
          body: JSON.stringify({ gstin: gstin.trim().toUpperCase(), code: code.trim() }),
        }
      );
      await installSession(data);
    },
    [installSession]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  return { session, loading, checkGstin, passwordLogin, requestCode, verifyCode, signOut };
}

/** Current access token, for authenticated calls to our own backend. */
export { accessToken } from './token';
