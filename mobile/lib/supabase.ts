import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Supabase client — READ ONLY for the mobile app.
 * Writes MUST go through the FastAPI backend (see ./api.ts) which
 * mirrors changes down to Supabase via the dual-write pipeline.
 *
 * The anon key is public by design (it's protected by Row-Level Security
 * policies on the Postgres side) so it's fine to bundle in the app.
 */
/**
 * Guard against EAS interpolating an unresolved template string
 * (e.g. `"$EXPO_PUBLIC_SUPABASE_URL"` when the matching EAS secret
 * doesn't exist) into `process.env`. Anything that isn't a real
 * https URL for the URL, or a non-empty non-`$`-prefixed string for
 * the key, is treated as empty so `Constants.expoConfig.extra.*`
 * fallbacks from app.json win.
 */
function pickHttps(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https:\/\//i.test(c)) return c;
  }
  return '';
}

function pickKey(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0 && !c.startsWith('$')) return c;
  }
  return '';
}

const supabaseUrl = pickHttps(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  Constants.expoConfig?.extra?.supabaseUrl as string | undefined,
);

const supabaseAnonKey = pickKey(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined,
);

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy /app/mobile/.env.example → /app/mobile/.env and fill in the values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
