import { supabase } from './supabase';

/**
 * Current Supabase access token, for authenticated calls to our own backend.
 *
 * Lives in its own module so `api.ts` can read it without importing
 * `auth.ts` (which imports `api.ts`) — that cycle is what forced a dynamic
 * import here previously.
 */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
