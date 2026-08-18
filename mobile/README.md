# Addrika Mobile (Expo + expo-router)

Native mobile client for the Addrika B2B / B2C platform.

**Architecture**

- **Reads** → Supabase Postgres (mirror of MongoDB). See `lib/supabase.ts`.
- **Writes** → FastAPI backend on Render (`/api/*`). See `lib/api.ts`.
- **Boot config** → `GET /api/app/config` (brand tokens, feature flags, live impact). See `lib/config.ts`.

MongoDB stays the single source of truth. Every backend write fires a
non-blocking `asyncio.create_task` that upserts the row into Supabase.
A 6-hour safety-net backfill and dead-letter retry queue guarantee 100%
consistency across all 60+ collections.

---

## Local development

```bash
cd /app/mobile
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_API_BASE_URL
yarn install
yarn start           # opens the Expo dev tools
```

Then either:

- Scan the QR with **Expo Go** on your phone (fastest for demos)
- Press `i` for iOS Simulator (macOS)
- Press `a` for Android Emulator
- Press `w` for the web preview

---

## Environment variables

| Var | Where it's used | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase JS client | Same URL that's in `backend/.env` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase JS client | **Public anon key**, not the service_role. Safe to bundle. RLS on the Postgres side protects data. |
| `EXPO_PUBLIC_API_BASE_URL` | FastAPI writes | e.g. `https://addrika-api.onrender.com` |

`EXPO_PUBLIC_*` env vars are inlined into the JS bundle at build time.

---

## Building for TestFlight / Play Console (EAS)

1. `npm install -g eas-cli` (once, globally)
2. `eas login` (uses your Expo account)
3. `eas init` — creates an `eas.json` and links this repo to a project
4. `eas build --profile production --platform all` — kicks off cloud builds

EAS handles code signing on both platforms — no need for a Mac or Android
Studio locally to ship. First build takes ~15 min; subsequent builds are
cached.

---

## Repo layout

This app lives on the `mobile-app` branch of the main repo so the backend
and web frontend keep deploying independently from `main`. The Render web
service and Vercel frontend never trigger on this branch.

```
/app
├── backend/           # FastAPI on Render (main branch)
├── frontend-next/     # Next.js on Vercel (main branch)
└── mobile/            # Expo (mobile-app branch)
```

---

## What the sample screens do

- **`app/index.tsx`** — Home. Hits `/api/app/config` and renders brand
  name, tagline, live tree count, and catalog counts. Proves the
  FastAPI-write side works.
- **`app/products.tsx`** — Product list. Reads directly from
  `products_mirror` on Supabase (`channel = 'b2c'`, 50 rows). Proves the
  Supabase-read side works.

Both screens have `testID` props on every interactive element so a QA
suite can drive them from Detox/Maestro later.
