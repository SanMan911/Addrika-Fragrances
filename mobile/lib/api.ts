import Constants from 'expo-constants';

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

if (!API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] Missing EXPO_PUBLIC_API_BASE_URL. Copy /app/mobile/.env.example → .env.'
  );
}

type FetchOpts = RequestInit & { token?: string };

export async function apiFetch<T = unknown>(
  path: string,
  opts: FetchOpts = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'App is not configured to reach the server yet. ' +
        'Please reinstall the latest build.'
    );
  }
  const { token, headers, ...rest } = opts;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error(`API ${res.status} ${path}: ${text || res.statusText}`);
  }
  // Some endpoints return non-JSON (e.g. PDFs). Callers can use rawFetch for those.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const API_URL = API_BASE_URL;
