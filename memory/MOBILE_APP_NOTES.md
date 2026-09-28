# Aarohmm B2B Mobile App — architecture & operations notes

_Written June 2026, at the start of the mobile-app work stream._

---

## Why this architecture

The user asked for Supabase auth + database "instead of MongoDB", and for the
app to be **safe for B2B** and **export-friendly**. Those two goals pull in
opposite directions for money-critical writes, so the split is deliberate:

| Layer | Where it lives | Reason |
|---|---|---|
| **Auth** | Supabase Auth (email OTP, keyed on GSTIN) | No passwords in the app at all. Standard Supabase Auth, so the project exports cleanly. GSTIN stays the login ID, matching the web portal. |
| **Reads** (stock, orders, schemes, brochures, grievances) | Supabase Postgres, queried **directly** from the app under Row-Level Security | Fast, and isolation is enforced by the database rather than by app code. A tampered client still cannot read another shop's rows. |
| **Writes that touch money or stock** (order placement, payment) | FastAPI → MongoDB (source of truth) | Tier pricing, carton math, stock reservation and Razorpay must be server-authoritative. If the phone could INSERT orders straight into Postgres, a modified build could set its own prices or oversell stock. |
| **Grievance photos** | Supabase Storage (private bucket, RLS per retailer folder) | Built-in, signed URLs, exports with the project. |

MongoDB was **not** ripped out for order writes — that was the safety call.
Supabase is the app's auth + read + file layer.

## Login flow (no passwords)

1. Retailer types their **GSTIN** (15 chars).
2. `POST /api/app/v2/auth/request-code` → backend finds the registered email,
   asks Supabase to mail a 6-digit code, and returns only a **masked** address.
3. Retailer types the code.
4. `POST /api/app/v2/auth/verify-code` → backend verifies with Supabase and
   returns `{access_token, refresh_token}`.
5. App calls `supabase.auth.setSession(...)` so supabase-js owns refresh and
   PostgREST reads run as that retailer under RLS.

**The backend brokers this on purpose.** GSTINs are public information, so an
endpoint that turned a GSTIN into a real email address would leak every
retailer's contact details (the SEC-002 class of bug). The raw address never
leaves the server.

Throttle: 5 code requests per GSTIN per hour (`app_login_codes` collection).

## ⚠️ REQUIRED before real retailers can log in

Supabase's **built-in SMTP is capped at ~2 emails/hour, project-wide**. Login
is therefore unusable in production until custom SMTP is configured:

> Supabase Dashboard → Project Settings → Authentication → SMTP Settings → enable
> - Host `smtp.resend.com`, Port `465`, User `resend`
> - Password = the Resend API key
> - Sender = `noreply@centraders.com`

Also confirm Authentication → Providers → **Email is enabled** and
"Confirm email" is OFF (the OTP is the confirmation).

## Supabase schema

Applied by `python -m scripts.apply_supabase_app_schema` (idempotent).
Source of truth: `/app/backend/sql/supabase_app_schema.sql`.

Tables (all RLS-enabled): `app_retailers`, `app_products`, `app_schemes`,
`app_brochures`, `app_orders`, `app_grievances`, `app_grievance_images`.

Helpers:
- `app_current_retailer_id()` — resolves the retailer from `auth.jwt() ->> 'email'`.
  **Every RLS policy keys off this.**
- `app_fy(ts)` — Indian financial year label (Apr 1 – Mar 31), e.g. `2026-27`.
- `app_gstin_lookup(gstin)` — anon-callable, returns masked email only.

Storage bucket `grievance-uploads` (private, 10 MB, images only). Storage RLS
restricts each retailer to a folder named after their `retailer_id`.

> **Gotcha**: `language sql` function bodies are validated at CREATE time, so
> the helper functions MUST be defined after the tables in the SQL file.

## Mongo → Supabase sync

`services/supabase_app_sync.py`, idempotent upserts:
- `sync_retailers` — **only `status == 'active'` retailers WITH a GSTIN**, deduped
  by GSTIN. Soft-deleted test accounts in Mongo legitimately share GSTINs and
  would violate the unique constraint.
- `sync_products` — from `b2b_products` (`product_id` → `sku`).
- `sync_orders` — from `b2b_orders`; skips orders whose retailer isn't in the
  read model (FK safety); computes `fy`.

Runs every 10 minutes (`app_read_model_scheduler_loop`, started in `server.py`),
plus immediately after each order placement, plus on-demand via
`POST /api/app/v2/sync`.

## Backend endpoints (`routers/mobile_app_v2.py`, prefix `/api/app/v2`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/request-code` | none | GSTIN → mail OTP, returns masked email |
| POST | `/auth/verify-code` | none | code → Supabase session tokens |
| POST | `/gstin-lookup` | none | masked email for a GSTIN (no send) |
| GET | `/me` | Supabase JWT | retailer profile + KYC state |
| POST | `/orders/calculate` | Supabase JWT | server-authoritative price preview |
| POST | `/orders` | Supabase JWT | place order (reuses `b2b_order_engine`) |
| POST | `/grievances` | Supabase JWT | raise ticket + record image paths |
| POST | `/support/contact` | Supabase JWT | message the admin desk |
| POST | `/sync` | Supabase JWT | refresh this retailer's read model |

JWT verification: `services/supabase_auth.py` uses the project's **published
JWKS (ES256)**, so no shared secret is needed on the server. A signed-in
Supabase user who is not an active retailer gets **403**, so signing up in
Supabase Auth alone grants no B2B access.

## App structure (`/app/mobile`, Expo SDK 51 + expo-router)

```
lib/  theme.ts  auth.ts  token.ts  api.ts  data.ts  pad.ts  supabase.ts  brand.ts
app/  _layout.tsx  login.tsx  grievance.tsx  support.tsx  schemes.tsx  order-placed.tsx
app/(tabs)/  _layout.tsx  index.tsx(Stock)  pad.tsx(Order Pad)  orders.tsx  more.tsx
```

- `lib/token.ts` exists only to break the `api.ts ↔ auth.ts` import cycle.
- Order Pad counts **boxes** and allows halves (`0.5`) — never assume integers.
  Prices shown in the pad are *indicative*; the total always comes from
  `/orders/calculate`.

> **Gotcha (caused a blank white screen)**: the auth gate in `_layout.tsx` must
> wait for `useRootNavigationState().key` before calling `router.replace`,
> otherwise expo-router throws "Attempted to navigate before mounting the Root
> Layout component" and nothing renders.

## Previewing the app

**Web preview** (no Expo account needed) — exported into the Next.js public dir:

```bash
cd /app/mobile && npx expo export --platform web --output-dir /tmp/webexport --clear
rm -rf /app/frontend-next/public/app-preview
mkdir -p /app/frontend-next/public/app-preview
cp -r /tmp/webexport/* /app/frontend-next/public/app-preview/
sudo supervisorctl restart frontend    # REQUIRED — next start caches /public
```
→ `<preview-url>/app-preview/index.html`

- `app.json → experiments.baseUrl = "/app-preview"` makes the asset paths work.
- Must use the **`/index.html`** suffix; Next.js 308-redirects the bare
  directory path and does not serve directory indexes.
- `expo-image-picker` is limited on web — attach-photo is best tested on device.

**EAS preview APK** (what the user asked for) — needs their Expo token:

```bash
cd /app/mobile
export EXPO_TOKEN=<token from expo.dev → Account Settings → Access Tokens>
npx eas build --platform android --profile preview
```
Project is already linked: `eas.projectId f152117c-57fb-4506-a44a-7c53d1043dd3`.

## Open items

- **SMTP not configured** → real OTP login is rate-limited to ~2/hour. BLOCKER
  for real retailers.
- **`app_schemes` / `app_brochures` are empty** — no Mongo source exists yet, so
  the Schemes screen shows an honest empty state. Needs an admin CRUD screen.
- **Payments**: orders are placed on credit terms (`payment_method: credit`).
  In-app Razorpay is not wired; Razorpay keys in this environment fail auth.
- **`apiBaseUrl`** in `app.json` currently points at the Emergent preview URL so
  preview builds work today. Switch to the Render URL for production.
- **service_role key** was never needed and is NOT stored anywhere.

---

## Bugs found & fixed during iter112 verification

1. **Blank white screen** — the auth gate called `router.replace` before the
   `Stack` navigator mounted. Fixed with a `useRootNavigationState().key` guard
   in `app/_layout.tsx`.
2. **Retailer email leak (design flaw, caught before shipping)** — an early
   design had the app call a GSTIN→email endpoint. GSTINs are public, so that
   would have leaked every retailer's contact address. The backend now brokers
   the OTP and returns only a masked address.
3. **`disabled` does nothing on react-native-web** — `Pressable`'s `disabled`
   prop is style-only on web; onPress still fires. Every submit handler
   (`login.onSendCode`/`onVerify`, `pad.onPlace`, `support.send`,
   `grievance.submit`) now early-returns on its own guard.
4. **WRONG PRODUCT KEY IN SYNC (the important one)** — `sync_products` keyed on
   `b2b_products.product_id`, but that column is the *fragrance*, shared across
   SIZES; the real SKU is **`id`** (e.g. `bold-bakhoor-b2b`), which is also what
   the order engine accepts. Keying on `product_id` collapsed 16 SKUs into 9 and
   let a 0-stock size overwrite a real one (`bold-bakhoor` 52 pcs → 0), so the
   app showed everything as "Out of stock". **Always sync on `id`.**
5. **Web preview called the Render backend** — `EXPO_PUBLIC_API_BASE_URL` in
   `/app/mobile/.env` points at Render for native builds, and the web bundle was
   honouring it. `lib/api.ts → resolveBase()` now returns `''` (relative) on web
   **unconditionally**, so the web build always goes through the same-origin
   Next.js `/api` proxy.

## Preview URL (final, working)

**`<host>/app-preview`** — no trailing slash, no `/index.html`.

Two pieces of plumbing make that work, both requiring a **`yarn build`** of
`frontend-next` (rewrites are compiled into the production build):
- `next.config.js` rewrites `/app-preview` and `/app-preview/:path*` →
  `/app-preview/index.html`. These are *afterFiles* rewrites, so real assets
  under `/app-preview/_expo/**` still resolve from `/public` first.
- `.env.local → NEXT_PUBLIC_BACKEND_URL=http://localhost:8001`. It previously
  pointed at the external preview host, which made the `/api` proxy hairpin
  through the ingress and return 404 for **every** API call — that broke the
  web portal's own API calls too, not just the app.

### Signing the web preview in without an inbox (for automated UI tests)
supabase-js persists its session in `localStorage` under
`sb-qzzwaqwgzvrdecheunpn-auth-token`. Mint a session from the cached refresh
token, then inject it before reload:

```python
await page.evaluate("([k,v]) => window.localStorage.setItem(k,v)",
                    ["sb-qzzwaqwgzvrdecheunpn-auth-token", payload])
await page.reload()
```
where `payload` is the JSON `{access_token, refresh_token, expires_at,
expires_in, token_type, user}`.

## Verified working end-to-end (iter112)
GSTIN login screen → session → Stock (16 SKUs, correct per-size stock, "Only 7
pcs left" nudge, search) → add to Order Pad (halves, tab badge) → server-priced
summary (₹1,010 + ₹50.5 GST = ₹1,060.5) → Place order → order-placed screen with
order number → Orders tab with FY chips and RLS-scoped history → More/profile.

---

# ITER114 — App Desk: brochure auto-sync, grievance threads, alerts, Razorpay

Verified: `/app/test_reports/iteration_114.json` — 31/31 new tests + 32/32 iter112
+ 23/23 iter108, 0 frontend issues.

## Brochure auto-sync (`services/app_brochure_sync.py`)
`app_brochure_items` is rebuilt from the **website's own catalogue** — D2C
`products` (image, tagline, description, notes) joined to `b2b_products`
(sizes, prices). Nothing is invented: a product with no description gets an
EMPTY `detail`, never fabricated copy. `_short_detail()` caps at 280 chars and
cuts on a sentence boundary. Stale SKUs are deleted each run.
Runs every 15 min (`brochure_scheduler_loop`) + on demand via
`POST /api/admin/app-support/brochure/sync`.
**Keys on `b2b_products.id`, never `product_id`** (same trap as iter112).

## Grievance threads
`app_grievance_messages` holds BOTH sides; the original complaint is injected
as `thread[0]` (`is_origin: true`) so the UI renders one uniform list.
`unread_for_retailer` / `unread_for_admin` badge each side.

RLS is what makes this safe — a retailer may insert ONLY with
`author='retailer'`, ONLY on their own ticket, and ONLY while it is not
closed. So a tampered client cannot forge an admin reply, cannot post to a
closed ticket, and cannot change `status`/`closed_at`/`admin_reply`. Admin
writes go through the backend (RLS-exempt). Admin-only close.

Status auto-advances `open → in_progress` on the first admin reply.

## Grievance reply alert
Admin reply → `unread_for_retailer = true` (surfaced by
`GET /api/app/v2/notifications/summary`) **and** an email to the shop's
registered address. `close_ticket: true` sends the "resolved" variant.

## Razorpay (wired, keys placeholdered)
Expo-friendly: a **Payment Link** opened in the system browser — no native SDK,
no ejecting. The amount is ALWAYS read from the stored order, never the request.

⚠️ `RAZORPAY_KEY_ID` in this env is a **rzp_live_** key — do NOT call
`POST /api/app/v2/payments/create` with a valid unpaid order in tests, and do
not click the mobile "Pay now" button: it creates a REAL payment link.

`RAZORPAY_WEBHOOK_SECRET` is the placeholder `your_razorpay_webhook_secret_here`.
`_looks_placeholder()` makes `verify_webhook_signature()` reject even an HMAC
computed with that placeholder, so **no order can be marked paid until a real
secret is set**. `GET /api/app/v2/payments/config` reports
`webhook_verification_ready: false` with a warning — deliberately honest rather
than implying payments work.

## Gotchas learned this iteration
- **asyncpg will not accept `'YYYY-MM-DD'` strings for `date` columns** —
  it raised `'str' object has no attribute 'toordinal'` and every scheme
  create/update 500'd. `admin_app_support._parse_date()` converts explicitly
  (and 400s on bad input); the `::date` casts were removed as redundant.
- **The QA access token lives at `/tmp/qa_access_token` and expires in 1 hour.**
  A stale one makes 17 iter112 tests fail with "Session expired" / "JWT expired".
  `rm -f /tmp/qa_access_token` and re-run — it is NOT a product bug.
- **Order-placement tests drain real stock.** `bold-bakhoor-b2b` fell 52 → 4
  across iter112–114 runs and broke pricing tests. Topped back to 120. If
  those tests fail with "Only N pieces available", top up
  `b2b_products.stock_pieces` and `POST /api/app/v2/sync`.

## New endpoints
Admin (`/api/admin/app-support/`): `GET/…/grievances[?status]`,
`GET /grievances/{id}`, `POST /grievances/{id}/reply` `{body, close_ticket}`,
`POST /grievances/{id}/status`, `GET/POST/PUT/DELETE /schemes`,
`GET /brochure`, `POST /brochure/sync`.
Retailer (`/api/app/v2/`): `GET /grievances`, `GET /grievances/{id}`,
`POST /grievances/{id}/reply`, `GET /notifications/summary`, `GET /brochure`,
`GET /payments/config`, `POST /payments/create`, `GET /payments/{order_id}`.
Webhook: `POST /api/app/v2/payments/webhook` (signature-verified, unauthenticated).

## Admin UI
`/admin/app-support` — sidebar "Aarohmm App Desk". Tabs: Grievances (list +
status filters + full thread + reply / reply-and-close), Trade Schemes (CRUD,
published straight to the app), Brochure (cards + Sync now).

## New mobile screens
`app/brochure.tsx` (in-app brochure, replaces the PDF download),
`app/grievance-thread.tsx` (tap any past ticket → full conversation + reply;
closed tickets show a notice instead of the reply box), and a
"Pay ₹X now" button on unpaid orders in the Orders tab.

## ⚠️ The external preview host does NOT serve this pod
`https://aaroviah-retail.preview.emergentagent.com/app-preview` returns 404
even though `http://localhost:3000/app-preview` is 200. Proven by comparing
build hashes: local serves `720-ba9f0f9bda4a5319.js`, external serves
`720-a07e09dda4910b81.js` — a different, older deployment. `/app/frontend` is
just a symlink to `/app/frontend-next`, and only one next-server runs on 3000,
so this is an infrastructure routing/caching layer we cannot update from here.
Use the EAS APK (or localhost) to demo the app.

## Lint-caught bug (iter114, post-test)
`routers/mobile_app_v2.py` used `os.environ.get(...)` in the retailer
grievance-reply handler while `os` was only imported *locally* inside other
functions — a latent `NameError`. It never surfaced in tests because the call
sits inside a `try/except Exception` that only logs, so **admin notifications
on retailer replies were silently never sent**. Fixed by importing `os` at
module level; the endpoint now returns 200 and the email fires.
Lesson: a bare `except Exception` around a notification can hide a NameError —
`ruff check --select F821` catches it.

## oxlint configuration
The Expo web export under `frontend-next/public/app-preview/` is generated,
minified Metro output and trips `no-undef` on Metro's `__d`/`__r` globals.
It is ignored via `.oxlintrc.json` in **both** `/app` and `/app/frontend-next`
(the linter may run from either cwd, so a repo-root-relative pattern alone is
not enough). Patterns use `**/public/app-preview/**` and `**/_expo/**`.
Keep the bundle tracked (not gitignored) so the preview survives deploys.
