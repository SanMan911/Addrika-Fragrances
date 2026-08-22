import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { CartLine } from './cart';
import { encodeCartForWeb } from './cart';
import { apiFetch } from './api';
import { snapshotLatestOrder } from './orderWatcher';

/**
 * Deep-links from the mobile shell to the marketing domain.
 * All auth-adjacent flows (customer signup, retailer registration
 * with GST-KYC popup, checkout, order confirmation) live on the web —
 * the mobile app is a browse + cart-builder companion.
 */
/**
 * Guard against EAS interpolating an unresolved template string
 * (e.g. the literal `"$EXPO_PUBLIC_WEB_URL"` when the matching EAS
 * secret doesn't exist) into `process.env`. Only real https URLs win.
 */
function pickHttps(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return '';
}

export const WEB_URL =
  pickHttps(
    process.env.EXPO_PUBLIC_WEB_URL,
    Constants.expoConfig?.extra?.webUrl as string | undefined,
  ) || 'https://www.centraders.com';

export async function openWebUrl(path: string): Promise<void> {
  const url = path.startsWith('http')
    ? path
    : `${WEB_URL}${path.startsWith('/') ? path : `/${path}`}`;
  await WebBrowser.openBrowserAsync(url);
}

/** Customer signup lives at /register on the web (dedicated page). */
export const openCustomerSignup = () => openWebUrl('/register');

/** Retailer registration begins on the homepage (GST-KYC popup path). */
export const openRetailerSignup = () => openWebUrl('/');

/**
 * Mint a 60-second one-time nonce that the web can exchange for a fresh
 * HttpOnly session cookie — the retailer (or customer) lands already
 * logged-in. The backend `/api/auth/handoff/create` endpoint sniffs the
 * bearer against BOTH `user_sessions` and `retailer_sessions`, so a
 * single API call covers both flows.
 *
 * Returns `null` if the caller has no session, the API call fails, or
 * the response is malformed. Callers must fall back to the plain
 * deep-link so checkout is never blocked by a handoff error.
 */
async function mintWebHandoff(bearerToken: string): Promise<string | null> {
  try {
    const data = await apiFetch<{ handoff_token?: string }>(
      '/api/auth/handoff/create',
      { method: 'POST', token: bearerToken },
    );
    return typeof data?.handoff_token === 'string' && data.handoff_token.startsWith('hoff_')
      ? data.handoff_token
      : null;
  } catch {
    return null;
  }
}

/**
 * Hand the cart over to the web. For retailers we deep-link to the
 * existing B2B dashboard (`/retailer/b2b`) which now hydrates its
 * `quantities` state from `?cart=<b64>` on mount. Customer flow is
 * kept intact for the day we re-enable B2C in the mobile shell.
 *
 * If the caller is a logged-in retailer/customer, we ALSO mint a
 * 60-second handoff nonce and append it as `?handoff=<nonce>` so the
 * web page can auto-login the same session before hydrating the cart.
 * This preserves the "must be signed-in to place an order" contract on
 * the web.
 */
export async function openWebCheckout(
  lines: CartLine[],
  userKind: 'customer' | 'retailer' | null,
  bearerToken?: string,
): Promise<void> {
  if (lines.length === 0) return openWebUrl('/');
  const cartParam = encodeCartForWeb(lines);
  const path = userKind === 'retailer' ? '/retailer/b2b' : '/cart';

  let handoffQuery = '';
  if (userKind && bearerToken) {
    // Snapshot the current most-recent B2B order id BEFORE we leave the
    // app. The AppState listener in `_layout.tsx` will compare against
    // this snapshot on foreground return and fire the celebration
    // screen if a new order landed while the retailer was on the web.
    // Runs in parallel with the handoff mint so we don't add latency.
    const [nonce] = await Promise.all([
      mintWebHandoff(bearerToken),
      userKind === 'retailer' ? snapshotLatestOrder(bearerToken) : Promise.resolve(),
    ]);
    if (nonce) handoffQuery = `&handoff=${encodeURIComponent(nonce)}`;
  }

  return openWebUrl(`${path}?cart=${cartParam}&from=mobile${handoffQuery}`);
}

/**
 * Build the shareable web-cart URL — this lands on the public /cart page
 * with the cart pre-filled, so a colleague who taps the WhatsApp link can
 * review it in their own browser and check out under *their* account.
 */
export function buildShareableCartUrl(lines: CartLine[]): string {
  const cartParam = encodeCartForWeb(lines);
  return `${WEB_URL}/cart?cart=${cartParam}&from=mobile-share`;
}

/**
 * Open the WhatsApp app directly (falls back to wa.me in a browser when
 * WhatsApp is not installed). Used by the mobile shell for admin-support
 * hand-offs (e.g. retailer forgot-password) and by shareCartOnWhatsApp.
 */
export async function openWhatsAppTo(phoneNoPlus: string, message: string): Promise<void> {
  const encoded = encodeURIComponent(message);
  const waUrl = `whatsapp://send?phone=${phoneNoPlus}&text=${encoded}`;
  const waWebUrl = `https://wa.me/${phoneNoPlus}?text=${encoded}`;
  try {
    const supported = await Linking.canOpenURL(waUrl);
    if (supported) {
      await Linking.openURL(waUrl);
      return;
    }
  } catch {
    // fall through
  }
  await Linking.openURL(waWebUrl);
}

/**
 * Open WhatsApp's share sheet with a pre-composed message that carries a
 * shareable cart URL. Falls back to the OS share sheet if WhatsApp isn't
 * installed on the device.
 */
export async function shareCartOnWhatsApp(
  lines: CartLine[],
  brandName: string,
  subtotal: number,
): Promise<void> {
  if (lines.length === 0) return;
  const url = buildShareableCartUrl(lines);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const message =
    `Check out my ${brandName} cart — ${itemCount} item${itemCount === 1 ? '' : 's'} ` +
    `worth \u20B9${subtotal}. Tap to open in your browser and check out under your own account:\n\n${url}`;
  const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const waWebUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    const supported = await Linking.canOpenURL(waUrl);
    if (supported) {
      await Linking.openURL(waUrl);
      return;
    }
  } catch {
    // fall through to the wa.me fallback below
  }
  await Linking.openURL(waWebUrl);
}
