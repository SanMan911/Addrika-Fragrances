/**
 * Small module-level cache for the retailer tier-perks map that lives on
 * `/api/app/config → retailer_tier_perks`. The two spots on the retailer
 * UI that surface the tier ring (rewards journey card and the catalog's
 * compact patron pill) can both call `getTierPerks()` without triggering
 * duplicate network round-trips.
 */
'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

let _cache = null;      // resolved perks map, keyed by tier id
let _inflight = null;   // shared promise so parallel callers don't race

export async function getTierPerks() {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/app/config`);
      if (!res.ok) throw new Error(`app-config ${res.status}`);
      const data = await res.json();
      _cache = data.retailer_tier_perks || null;
      return _cache;
    } catch {
      _cache = null;
      return null;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}
