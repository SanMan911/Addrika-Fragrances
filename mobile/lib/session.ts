import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { apiFetch } from './api';
import { clearOrderSnapshot } from './orderWatcher';

/**
 * Session state for the Expo app.
 *
 * Two user types are supported (same as web):
 *  - customer  → POST /api/auth/login (identifier + password)
 *  - retailer  → POST /api/retailer-auth/login (email/username + password)
 *
 * Tokens are stored in expo-secure-store so they survive app restarts
 * but never touch disk in plaintext. New-account CTAs deep-link to the
 * web app (registration flows involve OTP + GST-KYC popups that don't
 * belong in the mobile shell yet).
 */
export type UserKind = 'customer' | 'retailer';

export type Session = {
  kind: UserKind;
  token: string;
  displayName: string;
  email?: string;
};

const KEY = 'addrika.session.v1';

async function persist(session: Session | null): Promise<void> {
  if (session) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}

async function loadPersisted(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  loginCustomer: (identifier: string, password: string) => Promise<void>;
  loginRetailer: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  loginCustomer: async () => {},
  loginRetailer: async () => {},
  logout: async () => {},
});

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/**
 * Provider hook (used inside a <SessionContext.Provider> in _layout).
 * Kept as a hook — not a component — so the layout owns rendering.
 */
export function useSessionState(): SessionContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersisted()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const loginCustomer = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<{ session_token: string; user: { email: string; name?: string } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ identifier, password }) }
    );
    const s: Session = {
      kind: 'customer',
      token: data.session_token,
      displayName: data.user.name || data.user.email,
      email: data.user.email,
    };
    await persist(s);
    setSession(s);
  }, []);

  const loginRetailer = useCallback(async (identifier: string, password: string) => {
    const body = identifier.includes('@')
      ? { email: identifier, password }
      : { username: identifier, password };
    const data = await apiFetch<{ token: string; retailer: { name: string; email: string } }>(
      '/api/retailer-auth/login',
      { method: 'POST', body: JSON.stringify(body) }
    );
    const s: Session = {
      kind: 'retailer',
      token: data.token,
      displayName: data.retailer.name,
      email: data.retailer.email,
    };
    await persist(s);
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    // Clear the B2B "new order" snapshot so the next retailer on this
    // device doesn't inherit a stale trigger.
    try { await clearOrderSnapshot(); } catch { /* non-fatal */ }
    await persist(null);
    setSession(null);
  }, []);

  return { session, loading, loginCustomer, loginRetailer, logout };
}
