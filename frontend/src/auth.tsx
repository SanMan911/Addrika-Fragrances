// Auth context: holds the current profile, loads on mount, provides sign-in / sign-up / sign-out.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, getToken, Profile, saveSession } from "@/src/api";

interface AuthCtx {
  user: Profile | null;
  loading: boolean;
  signIn: (gstin: string, password: string) => Promise<Profile>;
  signUp: (body: {
    gstin: string;
    password: string;
    name: string;
    email: string;
    business_name?: string;
    phone?: string;
    role: "retailer" | "distributor";
    assigned_distributor_id?: string;
  }) => Promise<Profile>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      await clearSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signIn = useCallback(async (gstin: string, password: string) => {
    const res = await api.login({ gstin, password });
    await saveSession(res.access_token, res.refresh_token);
    setUser(res.user);
    return res.user;
  }, []);

  const signUp = useCallback(async (body: Parameters<AuthCtx["signUp"]>[0]) => {
    const res = await api.register(body);
    await saveSession(res.access_token, res.refresh_token);
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
