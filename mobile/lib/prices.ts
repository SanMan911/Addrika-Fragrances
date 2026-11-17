import { apiFetch } from './api';

let cache: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/** Whether wholesale prices are currently visible to retailers.
 * Cached for the app session; failures default to visible so a network
 * blip never hides prices on its own. */
export function fetchPricesVisible(): Promise<boolean> {
  if (cache !== null) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = apiFetch<{ prices_visible?: boolean }>('/api/app/v2/me', { auth: true })
    .then((me) => {
      cache = me?.prices_visible !== false;
      return cache;
    })
    .catch(() => {
      return true;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetPricesVisibleCache() {
  cache = null;
}
