import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { accessToken } from './token';

/**
 * FastAPI backend client — WRITE side.
 * All mutations (place order, verify KYC, etc.) go through /api/* on the
 * Render backend. MongoDB is the source of truth; the backend fires
 * asyncio dual-writes down to Supabase.
 */

/**
 * Guard against EAS interpolating an unresolved template string
 * (e.g. the literal `"$EXPO_PUBLIC_API_BASE_URL"` when the matching
 * EAS secret does not exist) into `process.env`. Anything that
 * doesn't look like an http(s) URL is treated as empty so the
 * `Constants.expoConfig.extra.*` fallback in app.json wins.
 */
function pickUrl(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return '';
}

const API_BASE_URL = pickUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  Constants.expoConfig?.extra?.apiBaseUrl as string | undefined,
);

/**
 * On web the app is served from the same origin as the Next.js site, which
 * already proxies `/api/*` to the backend. We therefore ALWAYS use a relative
 * base on web, ignoring `EXPO_PUBLIC_API_BASE_URL` — that variable points at
 * the Render host for native builds, and honouring it on web sent the preview
 * at a backend that 404s (and would break CORS besides).
 *
 * Native builds have no origin to inherit, so they keep the absolute URL.
 */
function resolveBase(): string {
  return Platform.OS === 'web' ? '' : API_BASE_URL;
}

if (Platform.OS !== 'web' && !API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] Missing EXPO_PUBLIC_API_BASE_URL. Copy /app/mobile/.env.example → .env.'
  );
}

type FetchOpts = RequestInit & { token?: string; auth?: boolean };

export async function apiFetch<T = unknown>(
  path: string,
  opts: FetchOpts = {}
): Promise<T> {
  const base = resolveBase();
  if (Platform.OS !== 'web' && !base) {
    throw new Error(
      'App is not configured to reach the server yet. ' +
        'Please reinstall the latest build.'
    );
  }
  const { token, auth, headers, ...rest } = opts;
  // `auth: true` pulls the live Supabase access token so callers never
  // have to thread it through by hand.
  let bearer = token;
  if (!bearer && auth) {
    bearer = (await accessToken()) ?? undefined;
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Channel': 'mobile',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(headers || {}),
      },
    });
  } catch (e: any) {
    throw new Error(
      `Can't reach the server. Check your internet connection and try again. ` +
        `[url=${url} · ${e?.message || 'network error'}]`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Surface the server's human-readable `detail` instead of raw JSON.
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.detail === 'string') detail = parsed.detail;
      else if (Array.isArray(parsed?.detail)) detail = parsed.detail[0]?.msg || text;
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  // Some endpoints return non-JSON (e.g. PDFs). Callers can use rawFetch for those.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const API_URL = API_BASE_URL;

/** Absolute-or-relative URL for opening a backend route in a browser/viewer. */
export function apiUrl(path: string): string {
  const base = resolveBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}