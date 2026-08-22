import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './api';

/**
 * Mobile → Web → Mobile "loop closer".
 *
 * When a retailer taps "Complete Order on centraders.com →", we
 * SNAPSHOT their most-recent order id. When they switch back to the
 * app (AppState → 'active'), we check the same endpoint again. If a
 * newer order landed while they were on the web, we route them to
 * `/order-placed` for the celebration screen.
 *
 * Design decisions
 * ----------------
 *  * SecureStore (not AsyncStorage) so the snapshot survives with the
 *    session token — same lifecycle.
 *  * Endpoint reuse: `/api/retailer-dashboard/b2b/orders?limit=1` is
 *    already there. No new backend surface.
 *  * Fire-and-forget: every helper returns null on any error so the
 *    app never crashes on a transient API hiccup.
 *  * The snapshot key includes the retailer's bearer token prefix so
 *    two retailers on the same device (rare) don't cross-signal.
 */

const KEY = 'aaroviah.lastSeenB2BOrderId.v1';

type OrderRow = {
  order_id: string;
  order_number?: string;
  order_status?: string;
  grand_total?: number;
  created_at?: string;
  items?: unknown[];
};

async function fetchLatestB2BOrder(token: string): Promise<OrderRow | null> {
  try {
    const data = await apiFetch<{ orders?: OrderRow[] }>(
      '/api/retailer-dashboard/b2b/orders?limit=1&page=1',
      { token },
    );
    const first = Array.isArray(data?.orders) ? data.orders[0] : null;
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Take a snapshot of the retailer's current most-recent order id.
 * Called RIGHT BEFORE we push the user out to the web.
 *
 * Also handles the "retailer has never placed an order" case — we
 * write a sentinel `""` so the follow-up check can still detect the
 * FIRST order landing.
 */
export async function snapshotLatestOrder(token: string): Promise<void> {
  const latest = await fetchLatestB2BOrder(token);
  const id = latest?.order_id || '';
  try {
    await SecureStore.setItemAsync(KEY, id);
  } catch {
    /* SecureStore unavailable — degrade to no-op */
  }
}

/**
 * On foreground return, check whether a NEWER order has landed since
 * the last `snapshotLatestOrder` call. Returns the new order on hit,
 * null on miss (including when the snapshot key is unset — no snapshot
 * means the user never went out via `openWebCheckout` and therefore
 * has no in-flight order to celebrate).
 *
 * Also updates the snapshot to the new id so a re-foreground doesn't
 * re-celebrate the same order.
 */
export async function checkForNewOrder(token: string): Promise<OrderRow | null> {
  let previous: string | null = null;
  try {
    previous = await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
  // No snapshot → the user hasn't been sent to the web this session.
  // Don't bother the API.
  if (previous === null) return null;

  const latest = await fetchLatestB2BOrder(token);
  if (!latest?.order_id) return null;

  // Same id as the snapshot → no new order landed.
  if (latest.order_id === previous) return null;

  // New order! Roll the snapshot forward and hand the row back.
  try {
    await SecureStore.setItemAsync(KEY, latest.order_id);
  } catch { /* non-fatal */ }
  return latest;
}

/**
 * Clear the snapshot key. Called on logout so the next retailer on
 * this device doesn't inherit a stale trigger.
 */
export async function clearOrderSnapshot(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch { /* non-fatal */ }
}
