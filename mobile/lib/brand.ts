import Constants from 'expo-constants';

/**
 * Mobile-shell-specific brand identity.
 *
 * The mobile app operates under its own name (`Aaroviah`) while the web
 * domain remains `Addrika` — hence a separate constant here instead of
 * pulling from `/api/app/config` which returns the web brand.
 * Overridable through `app.json → expo.extra.mobileBrandName` so the
 * companion mobile brand can be rotated without a rebuild.
 */
export const MOBILE_BRAND_NAME: string =
  (Constants.expoConfig?.extra?.mobileBrandName as string) || 'Aaroviah';

export const MOBILE_BRAND_TAGLINE: string =
  (Constants.expoConfig?.extra?.mobileBrandTagline as string) ||
  'Sacred Luxury in Every Scent';
