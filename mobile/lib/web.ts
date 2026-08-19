import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import type { CartLine } from './cart';
import { encodeCartForWeb } from './cart';

/**
 * Deep-links from the mobile shell to the marketing domain.
 * All auth-adjacent flows (customer signup, retailer registration
 * with GST-KYC popup, checkout, order confirmation) live on the web —
 * the mobile app is a browse + cart-builder companion.
 */
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ||
  (Constants.expoConfig?.extra?.webUrl as string) ||
  'https://www.centraders.com';

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
