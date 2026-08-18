import Constants from 'expo-constants';

/**
 * FastAPI backend client — WRITE side.
 * All mutations (place order, verify KYC, etc.) go through /api/* on the
 * Render backend. MongoDB is the source of truth; the backend fires
 * asyncio dual-writes down to Supabase.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  '';

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
  const { token, headers, ...rest } = opts;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
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
