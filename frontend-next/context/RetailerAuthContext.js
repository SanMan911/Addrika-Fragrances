'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const RetailerAuthContext = createContext(null);

// Default values for when hook is used outside provider (during SSR/prerender)
const defaultValue = {
  retailer: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false, error: 'Provider not mounted' }),
  logout: async () => {},
  fetchWithAuth: async () => new Response(null, { status: 401 }),
  checkAuth: async () => {}
};

export function useRetailerAuth() {
  const context = useContext(RetailerAuthContext);
  // Return default value during SSR instead of throwing
  if (!context) {
    return defaultValue;
  }
  return context;
}

export function RetailerAuthProvider({ children }) {
  const [retailer, setRetailer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch with auth helper
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('retailer_token') 
      : null;
    
    const headers = {
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    return fetch(url, { ...options, credentials: 'include', headers });
  }, []);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-auth/me`);
      if (res.ok) {
        const data = await res.json();
        setRetailer(data.retailer || data);
        setIsAuthenticated(true);
      } else {
        setRetailer(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setRetailer(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    (async () => {
      // Mobile → Web retailer session handoff. When the Aaroviah shell
      // hands the retailer over via `?handoff=hoff_<nonce>`, exchange the
      // nonce for a real `retailer_session` cookie BEFORE running
      // checkAuth so the retailer shows as logged-in on first paint.
      // Silently no-ops if the nonce is missing / expired / used — the
      // retailer just sees the normal login gate.
      let handedOff = false;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const handoff = params.get('handoff');
        if (handoff && handoff.startsWith('hoff_')) {
          // Strip the nonce immediately (single-use + prevents replay).
          try {
            params.delete('handoff');
            const nextSearch = params.toString();
            window.history.replaceState(
              {},
              '',
              `${window.location.pathname}${nextSearch ? '?' + nextSearch : ''}${window.location.hash}`,
            );
          } catch { /* non-fatal */ }

          try {
            const res = await fetch(`${API_URL}/api/auth/handoff/consume`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ handoff_token: handoff }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.kind === 'retailer' && data?.token) {
                try { localStorage.setItem('retailer_token', data.token); } catch { /* localStorage unavailable */ }
                if (data.retailer) {
                  setRetailer(data.retailer);
                  setIsAuthenticated(true);
                  handedOff = true;
                  const first = (data.retailer.name || '').trim().split(/\s+/)[0];
                  toast.success(`Welcome back${first ? `, ${first}` : ''}`, {
                    description: 'Signed in from your mobile cart.',
                    duration: 3500,
                  });
                }
              }
            }
          } catch { /* handoff failed — fall through to normal auth */ }
        }
      }
      if (handedOff) {
        // Cookie was just set — give the browser a tick to persist.
        await new Promise((r) => setTimeout(r, 50));
      }
      await checkAuth();
    })();
  }, [checkAuth]);

  // Login — routes at /api/retailer-auth (not /api/retailer). Body shape
  // matches RetailerLoginRequest: {email|username, password}. We accept a
  // single `identifier` param at the UI layer and route it into the right
  // field so retailers can sign in with either their email or username.
  const login = async (identifier, password) => {
    try {
      const body = { password };
      if (identifier && identifier.includes('@')) body.email = identifier;
      else body.username = identifier;

      const res = await fetch(`${API_URL}/api/retailer-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      // Guard against non-JSON error bodies (HTML 404/502 pages, empty
      // bodies, gateway timeouts) — otherwise `res.json()` throws and the
      // real HTTP status is lost. Fall back to the raw text (truncated)
      // when parsing fails.
      const ctype = res.headers.get('content-type') || '';
      let data = null;
      if (ctype.includes('application/json')) {
        try { data = await res.json(); } catch { data = null; }
      } else {
        const raw = (await res.text().catch(() => '')).slice(0, 160);
        data = { detail: raw || `Login failed (HTTP ${res.status})` };
      }

      if (!res.ok) {
        throw new Error((data && data.detail) || `Login failed (HTTP ${res.status})`);
      }
      
      if (data.token) {
        localStorage.setItem('retailer_token', data.token);
      }
      
      setRetailer(data.retailer || data);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetchWithAuth(`${API_URL}/api/retailer-auth/logout`, { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('retailer_token');
      setRetailer(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    retailer,
    isLoading,
    isAuthenticated,
    login,
    logout,
    fetchWithAuth,
    checkAuth
  };

  return (
    <RetailerAuthContext.Provider value={value}>
      {children}
    </RetailerAuthContext.Provider>
  );
}
