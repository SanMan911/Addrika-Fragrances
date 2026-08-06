'use client';

/**
 * ImpactContext — a single source of truth for the "live impact" metrics
 * (currently just tree-plantation, easy to extend with water saved, artisan
 * families, CO₂ offset, etc.).
 *
 * Why this exists:
 * ▸ Before iter78, both <TreeCounter /> and <CSRSection /> each called
 *   /api/impact/trees independently — two round-trips on every home-page
 *   load with a theoretical race window if the backend rate changed between
 *   calls (see testing_agent iter77 code-review comment).
 * ▸ Lifting the fetch here guarantees a SINGLE network call feeds every
 *   downstream widget with the exact same value.
 * ▸ New metrics can be added without touching the widgets — just extend
 *   the /api/impact endpoint and the reducer here.
 *
 * Consumption:
 *     const { trees, note, ctaHref, refresh } = useImpact();
 *
 * Mobile-app note:
 * ▸ The `/api/impact/trees` shape (see backend/routers/impact.py) is stable
 *   and part of the public OpenAPI schema. A React-Native / Flutter client
 *   can consume the same endpoint directly OR call `/api/app-config` (see
 *   iter78) which bundles it into the boot payload.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const ImpactContext = createContext(null);

const REFRESH_MS = 5 * 60 * 1000; // 5-minute background refresh so long-lived tabs stay live

export function ImpactProvider({ children }) {
  const [state, setState] = useState({
    trees: null,
    note: null,
    ctaHref: '/csr',
    updatedAt: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/impact/trees`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setState({
        trees: Number(j.trees) || 0,
        note: j.note || null,
        ctaHref: j.cta_href || '/csr',
        updatedAt: Date.now(),
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'fetch failed' }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <ImpactContext.Provider value={{ ...state, refresh }}>
      {children}
    </ImpactContext.Provider>
  );
}

export function useImpact() {
  const ctx = useContext(ImpactContext);
  // Graceful degradation — a widget rendered outside the provider still works
  // (falls back to null values) so this is safe to sprinkle anywhere.
  if (!ctx) return { trees: null, note: null, ctaHref: '/csr', loading: false, refresh: () => {} };
  return ctx;
}
