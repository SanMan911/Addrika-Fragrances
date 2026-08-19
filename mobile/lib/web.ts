import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { CartLine } from './cart';
import { encodeCartForWeb } from './cart';

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

/** Customer signup lives at /login on the web (register tab is there). */
export const openCustomerSignup = () => openWebUrl('/login');

/** Retailer registration begins on the homepage (GST-KYC popup path). */
export const openRetailerSignup = () => openWebUrl('/');

/**
 * Hand the cart over to the web checkout. Cart is passed via query so the
 * web can bootstrap it before Razorpay + order-confirmation flows kick in.
 */
export function openWebCheckout(lines: CartLine[], userKind: 'customer' | 'retailer' | null): Promise<void> {
  if (lines.length === 0) return openWebUrl('/');
  const cartParam = encodeCartForWeb(lines);
  const path = userKind === 'retailer' ? '/retailer/b2b/cart' : '/checkout';
  return openWebUrl(`${path}?cart=${cartParam}&from=mobile`);
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
