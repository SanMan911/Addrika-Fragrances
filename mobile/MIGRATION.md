# Aarohmm App — Standalone & Migration Guide

This document explains how the mobile app connects to its backend + data, and how
to move the whole stack (app, API, and data) to a new host or new services.

## 1. Architecture at a glance

The app has **two halves**, and the split is deliberate:

| Half | Where it lives | What it does | How the app reaches it |
|------|----------------|--------------|------------------------|
| **READ** | **Supabase** (Postgres) | Catalogue, live stock, schemes, grievances, orders list | Directly via the Supabase JS client (`mobile/lib/data.ts`) using the **public anon key** |
| **WRITE** | **FastAPI backend** (hosted on Render) | Login/OTP, KYC, placing orders, checkout, payments | Via HTTPS `apiFetch` (`mobile/lib/api.ts`) |

MongoDB (behind the FastAPI backend) is the **source of truth**. The backend
dual-writes down to Supabase so the app can read cheaply and stay fast even if
the backend is cold-starting.

```
┌─────────────┐      READ (anon key)      ┌──────────────┐
│  Aarohmm    │ ────────────────────────▶ │   Supabase   │
│  mobile app │                           │  (Postgres)  │
│             │      WRITE (HTTPS)        └──────▲───────┘
│             │ ────────────────────────┐        │ dual-write
└─────────────┘                         ▼        │
                                  ┌──────────────┴───┐
                                  │  FastAPI backend │◀── MongoDB (source of truth)
                                  │   (on Render)    │
                                  └──────────────────┘
```

## 2. Every table the app touches

**Supabase (READ)** — queried directly from `mobile/lib/data.ts` and the backend
mirror (`backend/services/supabase*`):

- `app_products` — B2B catalogue (sku, name, mrp, b2b_price, stock_pieces, …)
- `app_schemes` — active schemes/offers
- `app_brochures` + `app_brochure_items` — the digital brochure
- `app_retailers` — the logged-in retailer's profile
- `app_orders` — order history for the logged-in retailer
- `app_grievances` + `app_grievance_images` — support tickets + photo evidence
- `app_current_retailer_id` — helper view/function used by the mirror

**MongoDB (WRITE / source of truth)** — only reached through the FastAPI backend.
Key collections: `retailers`, `orders`, `b2b_orders`, `b2b_products`,
`retailer_messages`, `profile_change_tickets`, `payment_sessions`,
`retailer_sessions`, `admin_settings`, `carts`, plus loyalty/rewards/nudge
collections. You never connect to Mongo from the app directly.

## 3. Where configuration lives (single source per value)

The app resolves every URL/key at boot from **three layers, first non-empty wins**:

1. `EXPO_PUBLIC_*` env var (set as an **EAS secret** for cloud builds)
2. `app.json → expo.extra.*`  (hard-coded production fallbacks — see below)
3. A URL-safety check (`pickUrl`) that ignores anything that isn't `https://…`

The values and their current defaults (all in `app.json → expo.extra`):

| Key | Purpose | Default in `app.json` |
|-----|---------|------------------------|
| `extra.apiBaseUrl` | FastAPI write backend | `https://addrika-fragrances-backend.onrender.com` |
| `extra.supabaseUrl` | Supabase project URL | `https://qzzwaqwgzvrdecheunpn.supabase.co` |
| `extra.supabaseAnonKey` | Supabase **public** anon key | `sb_publishable_…` (public-safe, RLS-guarded) |
| `extra.webUrl` | Web storefront (checkout hand-off) | `https://www.centraders.com` |

> The anon key is **public by design** — it's safe to ship inside the APK because
> Postgres Row-Level-Security restricts what it can read. Never ship a
> `service_role` key in the app.

## 4. Making the app standalone / pointing it elsewhere

To migrate, you change **three things** and rebuild. No code changes needed.

### Step A — new write backend
Deploy the FastAPI backend to your new host (Render, Railway, Fly, a VPS — anything
that runs a Python web service). Set its env (`MONGO_URL`, Supabase keys, payment
keys, etc. — see `backend/.env.example`). Then point the app at it.

### Step B — new Supabase (optional, only if you're also moving the read layer)
Create a new Supabase project, recreate the tables in section 2 (schema lives in
the Supabase dashboard / your migrations), and copy the data.

### Step C — tell the app the new URLs
Edit `mobile/app.json → expo.extra`:

```json
"extra": {
  "apiBaseUrl": "https://YOUR-NEW-BACKEND.example.com",
  "supabaseUrl": "https://YOUR-NEW-PROJECT.supabase.co",
  "supabaseAnonKey": "YOUR-NEW-ANON-KEY",
  "webUrl": "https://YOUR-NEW-WEBSITE.example.com",
  "eas": { "projectId": "…" }
}
```

**or** (preferred for rotation without a code edit) set them as EAS secrets:

```bash
eas secret:create --name EXPO_PUBLIC_API_BASE_URL   --value https://…
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL   --value https://…
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value …
```
and re-add the `env` block to `eas.json` referencing them.

### Step D — rebuild
```bash
eas build --profile preview --platform android
```
The new APK now talks only to your new stack. The old APK keeps talking to the old
stack until users install the new build.

## 5. Migrating the data

### Supabase (read layer)
- Dashboard → Database → **Backups** (paid tiers) or use `pg_dump` against the
  connection string in Project Settings → Database.
- Restore into the new project, then re-run any migrations so the schema matches.
- Because Supabase is a **mirror of Mongo**, you can also skip a manual copy: after
  pointing the backend at the new Supabase, re-run the mirror to repopulate it.

### MongoDB (source of truth)
- `mongodump --uri="$MONGO_URL" --out ./dump` on the old host.
- `mongorestore --uri="$NEW_MONGO_URL" ./dump` on the new host (Atlas, a VPS, etc.).
- Update `MONGO_URL` in the backend env, restart, then let the backend re-mirror
  into Supabase.

## 6. What makes this safe / portable

- **No secrets baked into the APK** other than the public anon key.
- **URLs are config, not code** — one `app.json` edit (or EAS secrets) redirects the app.
- **Supabase is a rebuildable mirror**, so the only data you must preserve is MongoDB.
- **RLS on Supabase** means a leaked anon key can't read other retailers' data.

## 7. Quick checklist for a full move

- [ ] Deploy FastAPI backend on new host, set env, confirm `/api/health` = 200
- [ ] (If moving reads) provision new Supabase, restore tables, enable RLS
- [ ] `mongodump` old → `mongorestore` new MongoDB
- [ ] Update `app.json → expo.extra` (or EAS secrets) with new URLs
- [ ] `eas build --profile preview --platform android` → install new APK
- [ ] Smoke-test: login OTP, catalogue loads, place a test order
- [ ] Decommission old stack once the new APK is rolled out
