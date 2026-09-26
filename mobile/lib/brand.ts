import Constants from 'expo-constants';

/**
 * Mobile-shell-specific brand identity.
 *
 * The mobile app and the web storefront share ONE brand name (`Aarohmm`).
 * Kept as a constant here instead of
 * pulling from `/api/app/config` which returns the web brand.
 * Overridable through `app.json → expo.extra.mobileBrandName` so the
 * companion mobile brand can be rotated without a rebuild.
 */
export const MOBILE_BRAND_NAME: string =
  (Constants.expoConfig?.extra?.mobileBrandName as string) || 'Aarohmm';

export const MOBILE_BRAND_TAGLINE: string =
  (Constants.expoConfig?.extra?.mobileBrandTagline as string) ||
  'Sacred Luxury in Every Scent';
