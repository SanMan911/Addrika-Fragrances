# Addrika Platform — Changelog

_Chronological iteration log. Newest at top. See PRD.md for stable
architecture reference and ROADMAP.md for pending work._

---

### 🏪 Feb 2026 (Iteration 98) — B2B-only mobile pivot + retailer session handoff

**Product change**: The mobile app (Aaroviah) is now **B2B-only**. B2C paths
remain in the codebase (one-flag flip to re-enable) but the visible flow is
retailers-only.

**1. Retailer session handoff** — end-to-end auto-login from mobile → web B2B
- Backend (`/api/auth/handoff/*`) now branches on session KIND:
  - `create` sniffs the Bearer/Cookie against BOTH `user_sessions` and
    `retailer_sessions`, sets `kind: "customer"|"retailer"` on the nonce.
  - `consume` mints the correct session on the target: customer branch sets
    `session_token` cookie (existing); retailer branch sets `retailer_session`
    cookie (new) via `create_retailer_session` and returns the retailer object.
- Web (`context/RetailerAuthContext.js`): new `consumeMobileHandoff` runs
  before `checkAuth` on mount. Detects `?handoff=hoff_...`, strips it from
  the URL, POSTs to `/consume`, sets local state + welcome-back toast:
  _"Welcome back, {firstName} — Signed in from your mobile cart."_
- 30/30 pytest cases green (`tests/test_iter97_auth_handoff.py` +
  `tests/test_iter98_handoff_supplement.py`).

**2. `/retailer/b2b` URL cart hydration** — first B2B cart deep-link
- Existing page never read the URL; quantities lived only in local state.
- New `useEffect` fires when `catalog` finishes loading: decodes
  `?cart=<json>&from=mobile`, filters out SKUs not in the retailer's
  current catalogue, and calls `setQuantities({...})`. Toast confirms
  count. URL cleaned of `cart`+`from` afterwards.
- Handles both `product_id` + `productId` and `quantity_boxes` + `quantity`
  key variants (mobile sends both for cross-flow compat).

**3. Two CRITICAL bug fixes uncovered by testing agent (iteration_96.json)**:
- `RetailerAuthContext.login()` was POSTing to `/api/retailer/login` (non-
  existent) with `{identifier, password}`. Fixed → `/api/retailer-auth/login`
  with `{email|username, password}` auto-routed by `@` sniffing. Same fix on
  `logout`.
- The global `CartContext.importCartFromMobileLink` ran on EVERY route
  including `/retailer/b2b`, stripped `?cart&from` params before the B2B
  page's catalog-gated effect could see them. Fixed → early-return when
  `pathname` starts with `/retailer/` (with trailing slash so future
  `/retailers-map` still gets B2C hydration).

**4. Hardening (from Iter 97 test report follow-ups)**:
- `/retailer/login` portal-status now FAILS OPEN on network/JSON errors —
  a transient API hiccup can no longer hide the login form behind the
  "Coming Soon" waitlist. Only an explicit `{enabled: false}` disables.
- `RetailerAuthContext.login` guards against non-JSON error bodies
  (HTML 404/502 pages) — extracts the real HTTP status instead of
  throwing a generic parse error.
- Removed double `decodeURIComponent` in both `CartContext` and
  `/retailer/b2b` hydration — `URLSearchParams.get()` already decodes once,
  a second decode corrupted payloads containing literal `%`.

**5. Mobile — B2B-only redesign**
- `app/_layout.tsx` REWRITE: fixed the "correct credentials do nothing"
  bug. The root layout was calling `useSessionState()` in two places
  (Provider + gate), so the gate watched a different `session` state than
  the provider mutated on login. Now the gate reads from `useSession()`
  context — single source of truth. This is why the app used to only
  land you inside after force-close + reopen (SecureStore was read from
  scratch on the second boot into the gate's own state instance).
- `app/login.tsx` REWRITE: B2B-only form. Serif brand mark (Georgia iOS
  / serif Android — no new font deps). Uses `/api/retailer-auth/login`
  via `loginRetailer` in `session.ts` (same endpoint as the web).
  WhatsApp "Message admin" for password reset (retailers have no
  self-serve reset yet).
- `app/index.tsx` REWRITE: elegant hero with dual halo, serif wordmark,
  gold accent rule. Removed Trees Planted counter. New **Fragrance
  Spotlight** card rotates through 8 live products from Supabase every
  6 s. Catalogue card shows B2B SKU count only. New "Grievances?"
  WhatsApp CTA replaces retailer-facing links.
- `app/products.tsx` — Supabase query now filters `channel='b2b'`;
  quantity label switched from `50g` to `1 box` for wholesale units.
- `lib/web.ts::openWebCheckout` — retailers deep-link to
  `/retailer/b2b?cart=...&from=mobile&handoff=...` (not `/retailer/b2b/cart`
  which never existed). Handoff nonce is minted for BOTH kinds now.
- `lib/cart.ts::encodeCartForWeb` — payload carries both `quantity` and
  `quantity_boxes` so the same string drives either B2C or B2B page.

**Regression checks (all green)**:
- Customer handoff (Iter 97) still works: `/cart?handoff=&cart=` auto-logs in,
  hydrates items, welcome-back toast.
- `/track-order` still 308 → `https://www.centraders.com/track-order`.
- `mirror_order_snapshot` (Iter 96) + supabase mirror blocklist tests green.
- 30/30 handoff + mirror pytest pass.

---

### 🔐 Feb 2026 (Iteration 97) — Mobile → Web session handoff (auto-login on checkout)

**Problem**: mobile users had to log in again on the web to check out — added
friction, and cart items risked being lost mid-transition.

**Solution — one-time nonce handoff** (industry-standard, like Stripe / OAuth code exchange).**Backend** (`/api/auth/handoff/*`)
- `POST /api/auth/handoff/create` (Bearer or Cookie auth) — mints a
  60-second single-use nonce `hoff_<uuid>`, stored in the new `auth_handoffs`
  Mongo collection (Mongo TTL index auto-purges).
- `POST /api/auth/handoff/consume` — atomically claims the nonce via
  `find_one_and_update({used: False, expires_at: {$gt: now}}, {$set: {used: True}})`,
  mints a fresh session, sets HttpOnly `session_token` cookie
  (`Secure; SameSite=none; Max-Age=7d`), returns `{user, session_token}`.
- `auth_handoffs` added to `services/supabase_sync._MIRROR_BLOCKLIST` —
  nonces never travel to Supabase.
- 6 pytest cases (`tests/test_iter97_auth_handoff.py`): unauth reject,
  happy path, single-use enforcement, malformed rejection, expired rejection,
  mirror-blocklist assertion. **All 6 green.**

**Mobile** (`mobile/lib/web.ts::openWebCheckout`)
- Signature extended: `openWebCheckout(lines, userKind, bearerToken?)`.
- When `userKind === 'customer'` and a bearer token is present, calls
  `handoff/create` and appends `?handoff=<nonce>` to the URL alongside
  `?cart=<b64>`.
- Falls back silently to the plain deep-link if the API call fails — checkout
  is never blocked by a handoff error.
- `mobile/app/cart.tsx` passes `session?.token` into `openWebCheckout`.
- Retailer flow NOT yet wired — deliberately deferred to avoid B2B
  regression. Tracked in ROADMAP.md P1.

**Web** (`frontend-next/context/AuthContext.js`)
- New `consumeMobileHandoff()` runs BEFORE `checkAuth()` on mount.
- Detects `?handoff=hoff_...` on any route, strips it from the URL
  immediately (single-use + prevents replay via history), POSTs to
  `/api/auth/handoff/consume`. On 200 → sets `user` state + writes
  `addrika_session_token` to `localStorage`.
- Runs on any page (not just `/cart`) so future landing pages get the
  same behaviour for free.
- **Welcome-back toast** (sonner) fires on successful consume:
  _"Welcome back, {firstName} — Signed in from your mobile cart."_
  (3.5s duration). Confirms the auto-login to the customer before the
  cart items visibly hydrate.

**E2E verified via curl**: mint returns `{handoff_token: "hoff_...", expires_in: 60}`;
consume returns 200 with `Set-Cookie: session_token=...; HttpOnly; Secure; SameSite=none`;
second consume of same nonce returns 401 `"already used"`.

**Security notes**
- Nonces live in URLs — URLs land in browser history, server logs, Referer
  headers — so we made them SINGLE-USE + 60-second TTL. Even if leaked,
  they're dead in a minute.
- The blocklist entry means a compromised Supabase never yields live
  handoff tokens.

---

### 🔗 Feb 2026 (Iteration 96) — Orders in Supabase mirror + `/track-order` external redirect

**1. Orders now mirror to Supabase on every write** (22/22 supabase_sync unit tests green)
- `services/supabase_sync.py::mirror_order_snapshot(db, *, order_number, order_id, collection)` — new fire-and-forget async helper that re-reads the latest order doc from Mongo and pushes it into `collections_mirror`. Never raises.
- **Write sites wired** (11 total): `routers/orders.py` insert + 4 updates; `routers/b2b_orders.py` insert + 4 updates; `routers/admin/admin_orders.py` status update + RTO voucher + delete + restore.
- **Backfill already covered** — `scripts/backfill_supabase_mirror.py::_backfill_all_collections` iterates every non-typed, non-blocklisted collection.
- Sensitive keys (`password`, `razorpay_signature`, `otp`, etc.) auto-stripped by `_sanitize()`.

**2. `/track-order` redirects to `https://www.centraders.com/track-order`** (verified HTTP/1.1 308)
- `frontend-next/next.config.js` — new `redirects()` block for `/track-order` and `/track-order/:path*`.
- Header + Footer links rebuilt as external `<a target="_blank" rel="noopener noreferrer">` with `data-testid`.
- `app/sitemap.js` cleaned; `app/track-order/` directory deleted.

**3. P1 Vercel redeploy verification checklist** — `frontend-next/VERCEL_REDEPLOY_CHECKLIST.md` (9-step manual QA).

---

### 📦 Feb 2026 (Iteration 86) — B2B retailer seed + b2b mirror prices + Aaroviah EAS-ready

**1. Test B2B Retailer auto-seed** (verified iter86 — TestB2BCatalog no longer skips)
- `/app/backend/services/seed_test_b2b_retailer.py` — new idempotent seed inserts `test_b2b_retailer@example.com / Test@12345` with `retailer_id=RTL_TEST_B2B`, `status='active'`, `is_verified=True`, `gst_verified=True`, `name='Test B2B Retailer'`, `username='test_b2b_retailer'`. Heals missing fields on subsequent boots.
- **Env-gated for safety**: only fires when `SEED_TEST_B2B_RETAILER=1` (default OFF). Prod deploys that forget the env var can never create the live account with a known password.
- `/app/backend/.env` sets `SEED_TEST_B2B_RETAILER=1` for this preview.
- Verified via testing agent: `POST /api/retailer-auth/login` returns HTTP 200 for both email and username identifiers; pytest test_iter82_product_cleanup.py went from 18 passed / 1 skipped → **19/19 green**; 74/74 regression tests pass.

**2. B2B mirror `price_inr` hydration** (verified iter86)
- `services/supabase_sync.py::_product_row` — new `if channel == 'b2b'` branch reads `price_inr` from `mrp_per_unit || price_per_carton || price_per_box` and `mrp_inr` from `mrp_per_unit`. B2B docs never carried a top-level `price` field which is why iter79-85 always mirrored NULL.
- Periodic backfill (`services/supabase_bootstrap.py`) picks up the fix on the 90s post-boot tick.
- Verified: all 16 b2b `products_mirror` rows now have non-null `price_inr` + `mrp_inr` (0 NULL from 16 NULL).

**3. Mobile Alpha (EAS build ready)** — everything on the Emergent side is set; user runs `eas init` + `eas build --profile preview --platform android` from their Windows machine.
- `mobile/app.json` — Aaroviah rebrand: `name`, `slug=aaroviah-mobile`, `scheme=aaroviah`, `ios.bundleIdentifier=com.centraders.aaroviah`, `android.package=com.centraders.aaroviah`, `android.versionCode=1`, `extra.eas.projectId` placeholder.
- `mobile/eas.json` (new) — `preview` profile (internal APK, distribution:internal) + `production` profile (Play Store AAB, distribution:store). All 4 build-time envs (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WEB_URL`) sourced from Expo secrets.
- `mobile/EAS_BUILD_GUIDE.md` (new) — step-by-step walkthrough: `git pull` → `yarn install` → `expo login` → `eas init` (commits projectId) → `eas secret:create` (×4) → `eas build --profile preview --platform android` → download APK URL / QR from Expo dashboard → sanity-test on device.
- `npx tsc --noEmit` in mobile/: 0 errors.

**Iter86 testing agent flagged (informational, not blocking):**
- `/api/retailer-dashboard/*` reads auth exclusively from `retailer_session` cookie (secure=True samesite=none). Python `requests` refuses to send that cookie over HTTP → subsequent authenticated calls 401 on non-HTTPS clients. iter86 test harness now attaches the cookie manually from the login JSON body. Long-term: consider accepting `Authorization: Bearer <token>` alongside the cookie.
- 23 of 25 mirror rows still have `stock_pieces=0` (only bold-bakhoor has 100). Prices are correct now; if 0 isn't the true inventory that's a separate hydration gap.

---

### 🎨 Feb 2026 (Iteration 85) — One-click brand rename mechanism (final sweep)

- **Iter84 backend regressions closed** (verified iter85, 21/21 tests green + fault-injection self-heal proven):
  * `/app/backend/routers/products.py::_migrate_products` — Iter82 cleanup is now an **unconditional tombstone** that removes bambooless from Mongo + Supabase mirror on every boot, plus common `<slug>-<size>-b2b` variants defensively.
  * `services/supabase_bootstrap.py::periodic_backfill_loop` — 90s post-boot warmup + 6h cadence re-hydrates b2c mirror rows (price_inr, stock_pieces) via the fixed `_backfill_products` (pre-loads `b2b_products` + calls `enrich_b2c_products_with_stock`).
  * Fault-injected orphan + NULL-hydration were auto-healed within ~140s (iter85 report).

- **Full frontend refactor sweep** (~215 hardcoded refs → 0 user-visible + intentional external identifiers only):
  * Central config `lib/brand.config.js` expanded with:
    * `logo.src`, `srcGold`, `srcGoldCropped`, `srcBrandNameGoldTransparent`, `logoUrlAbs`
    * `social.instagramHandle/Upper/Slug/Url/UrlWww`, `social.twitterCreator`
    * `seo.keywords` (23 keywords array)
    * `nameUpper` helper for uppercase display contexts
  * **Files touched (~55 total)**: `app/layout.js` (SEO metadata + 3 JSON-LD blocks), `app/orders`, `app/account`, `app/admin/login`, `app/admin/forgot-password`, `app/admin/milestones`, `app/products/[slug]`, `app/our-story`, `app/blog`, `app/blog/[slug]`, `app/shipping-returns`, `app/find-retailers`, `app/why-choose-addrika`, `app/retailer/b2b/rewards`, `app/faq`, `app/about-us`, `app/ingredients`, `app/our-quality`, `app/sustainability`, `app/community`, `app/register`, `app/forgot-username`, `app/admin/tree-donations`, plus `components/Header.js`, `Footer.js`, `Hero.js`, `USPSection.js`, `CSRSection.js`, `PackagingSection.js`, `CTASection.js`, `InstagramFeed.js`, `NudgeComposerModal.js`, `RetailerPartnershipModal.js`, `RetailerFloatingCTA.js`, `ZohoSyncHealthCard.js`, `admin/b2b/retailers/[id]/page.js`, `retailer/layout.js`.
  * **Migration script** `frontend-next/scripts/refactor_brand.py` (idempotent, safely re-runnable). Injects `import BRAND from '<rel>/lib/brand.config'` + rewrites string literals / JSX text / template literals / JSX attributes containing "Addrika" → `BRAND.name` / `${BRAND.name}` / `{BRAND.name}` per context.
  * **Manual fixes** for 20+ multi-line JSX paragraphs the regex couldn't safely span + 5 files where the auto-injected import was placed inside a multi-line `import { ... } from 'lucide-react'` block.
  * **Verified end-to-end** via BrandFlipTest → yarn build → curl (0 "Addrika" in HTML, "FlipTest" everywhere) → revert → yarn build → verify normal.

- **Intentionally NOT config-driven** (external identifiers): Instagram handle format (`@brand.fragrances` — Instagram username isn't automatic), physical PNG file names in `/public/images/logos/*` (assets stay named as-is; config points at them), URL route paths like `/why-choose-addrika` (renaming URL paths breaks bookmarks + SEO history), internal object property keys (`row.addrika`, `is_addrika_verified_partner`), localStorage keys, CSS classes.

- **Known low-priority items** (not blocking, out of scope):
  * B2B mirror rows have `price_inr=NULL` (b2b prices are tier-based — mirror stores base rows without pricing). Iter85 flagged as informational.
  * B2B test retailer credentials `test_b2b_retailer@example.com / Test@12345` are broken → 1 pytest skips permanently. Needs reseed.
  * Legacy env-fallback URL in `sitemap.js` still references `addrika-fragrances-backend.onrender.com` (only used if `NEXT_PUBLIC_BACKEND_URL` env var is unset).

**Testing**: iteration_79 → iteration_85 all green. Iter85 explicitly proves self-healing via fault-injection tests.

---

### 🧴 Feb 2026 (Iteration 84) — Product cleanup, Aaroviah mobile, one-click brand rename mechanism

**1. Product data cleanup (verified iter79 → iter83)**
- Removed **"8" Bambooless Dhoop"** (`bambooless-dhoop-8inch`) from Mongo `products` + linked `b2b_products` + Supabase `products_mirror` + default seed + blog references. Iter82 startup migration purges leftovers idempotently.
- Renamed **"Bilvapatra Fragrance" → "Belpatra"** across B2C storefront, all derived B2B SKUs (`bilvapatra-fragrance-*-b2b`), Supabase mirror, blog topics, and brand-voice prompt. Slug retained for URL stability.
- Root-cause bug fixes shipped alongside:
  * `services/supabase_sync.py::_product_row` — B2C products now derive `price_inr` from `sizes[0].mrp` and `stock_pieces` from summed `sizes[*].stock`; also handles `isActive` (camelCase) alongside `is_active`.
  * `routers/admin/admin_products.py::admin_delete_product` — cascade DELETE now removes linked b2b_products from Mongo AND every `<slug>-<size>-b2b` mirror row from Supabase.
  * `services/supabase_sync.py::_run` — added per-entity `asyncio.Lock` map (`_entity_locks`) so back-to-back mirror writes for the same `(entity, id)` serialize FIFO. Kills the PUT-then-DELETE race that used to re-materialise deleted rows.
  * `tests/test_iter74_unified_products.py` now cleans up Mongo + Supabase mirror before AND after each run (`_purge_iter74_product` helper).
- Verified end-to-end by iterations 79 → 83 (`iteration_79.json` through `iteration_83.json`) — all green.

**2. Mobile shell overhaul — "Aaroviah" branding + login gate + cart + web checkout hand-off**
- Mobile is now branded **"Aaroviah"** (icon: golden lotus/Ω monogram, generated at 1024×1024 iOS + Android adaptive + splash + favicon). Web/backend still "Addrika". Mobile brand lives in `mobile/lib/brand.ts`, sourced from `app.json → expo.extra.mobileBrandName` so it can be rotated without a rebuild.
- Login-gated navigation (`mobile/lib/session.ts`): expo-secure-store persists a `{kind, token, displayName, email}` blob. `_layout.tsx::useAuthGate` bounces unauth'd users to `/login` and auth'd users into the home screen.
- `mobile/app/login.tsx` — tabbed **Customer / Retailer** sign-in.
  * Customer tab hits `POST /api/auth/login` with `{identifier, password}`.
  * Retailer tab hits `POST /api/retailer-auth/login` with `{email, password}` (or `{username, password}`).
  * "New to Aaroviah?" CTA opens **`https://www.centraders.com/login`** (customer signup lives on the web).
  * "Own a shop?" CTA opens **`https://www.centraders.com/`** (retailer flow starts with the GST-KYC popup on the homepage).
- `mobile/app/products.tsx` — reads live from Supabase `products_mirror` (channel=b2c, is_active=true), shows real prices + stock counts. Adds "Add" button per product; carted items show quantity indicator.
- `mobile/app/cart.tsx` (new) — AsyncStorage-backed cart. Line items support qty ± and remove. Footer surfaces `n items · ₹subtotal` and a **"Complete Order on centraders.com →"** button that opens `expo-web-browser` to `/checkout?cart=<encoded>&from=mobile` for customers or `/retailer/b2b/cart?cart=<encoded>&from=mobile` for retailers.
- `mobile/lib/web.ts` — helper for all deep-links (`openCustomerSignup`, `openRetailerSignup`, `openWebCheckout`). URL sourced from `EXPO_PUBLIC_WEB_URL` env / `app.json → extra.webUrl` (default `https://www.centraders.com`).
- All interactive elements carry `data-testid` (`login-submit`, `add-to-cart-<id>`, `cart-checkout-btn`, etc.).
- New icon build pipeline: `mobile/assets/icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png` generated from `mobile/assets/aaroviah-src.webp`.
- `npx tsc --noEmit` passes with zero errors.

**3. One-click brand rename mechanism — full frontend-next refactor**
- Every user-visible "Addrika" reference (~200 hardcoded strings across 43 files) now consumes `BRAND.name` from `frontend-next/lib/brand.config.js`. Batch-migrated via `frontend-next/scripts/refactor_brand.py` (idempotent + fully commented).
- `brand.config.js` reworked so the entire brand identity (name, tagline, logo alt, monogram, welcome-email subject, support-email body) derives from a single `NAME` const at line 24. **Flip one line to rename everywhere.**
- **Verified end-to-end**: temporarily set `NAME='BrandFlipTest'`, ran `yarn build`, restarted frontend, and confirmed `curl /` + `curl /faq` returned **zero** "Addrika" references while "BrandFlipTest" appeared everywhere it should. Reverted after test.
- `next build` output: 90/90 pages compiled successfully, 0 blocking errors.
- Manual JSX-text fixes for 10 multi-line paragraphs the script's regex couldn't safely handle (about-us, sustainability, community, our-story, register, CSR, Packaging, RetailerFloatingCTA, RetailerPartnershipModal, forgot-username, admin/tree-donations).
- Backend/`brand.config.py` env vars (`BRAND_NAME`, `BRAND_TAGLINE`) already wired — flip both in one turn to complete a future rebrand.

**Testing**: Iteration reports 79/80/81/82/83 (all green) cover the product data + mirror fixes. Frontend refactor verified via live BrandFlipTest → revert cycle. Mobile TypeScript passes with zero errors; UI needs user's device via Expo Go (agent cannot drive Expo).

---

### 📱 Feb 2026 (Iteration 84) — Expo Mobile Bootstrap + b2b_low_stock scheduler fix

**1. `b2b_low_stock.py` scheduler f-string bug FIXED**
- Extracted the `ETA` + `note` HTML fragments out of the inline f-string expression so pre-Python 3.12 no longer chokes on escaped `\"` inside the expression brackets. Backend boot logs are now silent — the nightly low-stock digest scheduler runs cleanly.
- Verified with `python -c "import services.b2b_low_stock"` + `pytest tests/test_b2b_category_stock.py tests/test_supabase_mirror.py` (**40/40 pass**).

**2. Expo mobile client scaffolded at `/app/mobile/`**
- Stack: Expo SDK 51 · expo-router 3.5 · React Native 0.74 · TypeScript strict · `@supabase/supabase-js` 2.45.4 (pinned for Node 20 compat) · `react-native-async-storage` for session persistence · `expo-secure-store` for tokens.
- File tree:
  ```
  /app/mobile/
  ├── app/
  │   ├── _layout.tsx     — expo-router Stack, navy/gold theme
  │   ├── index.tsx       — Home: /api/app/config (brand, live tree count, catalog counts)
  │   └── products.tsx    — Product list read directly from Supabase products_mirror
  ├── lib/
  │   ├── supabase.ts     — Supabase client, AsyncStorage-backed session
  │   ├── api.ts          — apiFetch helper for FastAPI writes
  │   └── config.ts       — fetchAppConfig() typed wrapper
  ├── app.json, package.json, tsconfig.json, babel.config.js
  ├── .env.example        — EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY / _API_BASE_URL
  ├── .gitignore
  └── README.md           — local dev + EAS build instructions
  ```
- `yarn install` clean (667 packages, 40s). `npx tsc --noEmit` passes with zero errors.
- **Repo layout decision**: lives on a `mobile-app` branch of the same repo (not a separate repo). Render/Vercel deploy only from `main`, so `mobile-app` won't trigger the web pipelines.
- Data direction locked in: **Supabase = READ mirror only**, all writes go through FastAPI which mirrors down via the iter83 dual-write pipeline.
- Ready for `eas init && eas build --profile production --platform all` once the user creates the branch on GitHub and fills in `.env` with the rotated Supabase anon key + Render domain.

**Pending user actions (as of Feb 2026)**:
- Push `/app/mobile/*` to a new `mobile-app` branch via "Save to Github".
- Fill `/app/mobile/.env` locally with the rotated Supabase URL + anon key + Render backend URL.
- Rotate the Supabase DB password when ready (see instructions below — user updates `.env` and Render EnvVar directly; the new value never needs to be shared in chat).

### 🔁 Feb 2026 (Iteration 83) — Supabase Postgres Dual-Write Mirror + Router Refactor + Mirror-Everything

**1. Supabase Postgres Dual-Write Mirror — MongoDB stays source of truth**
- Connected to Supabase via the **Transaction Pooler URI** (port 6543) using SQLAlchemy 2.x async + asyncpg, per the integration playbook. `statement_cache_size=0` set on `connect_args` (mandatory for the pooler).
- New files:
    - `/app/backend/supabase_db.py` — lazy async engine + session factory. Reads `SUPABASE_DB_URL` from `.env`, converts to `postgresql+asyncpg://` under the hood, respects `SUPABASE_MIRROR_ENABLED` kill-switch (default `true`).
    - `/app/backend/models/mirror.py` — SQLAlchemy models for `users_mirror` (kind: b2c/b2b/admin), `products_mirror` (channel: b2c/b2b), `sync_dead_letter` (retry queue).
    - `/app/backend/alembic.ini` + `/app/backend/alembic/env.py` + `versions/0001_initial_mirror.py` — Alembic migration stack. `alembic upgrade head` runs automatically on backend startup.
    - `/app/backend/services/supabase_sync.py` — fire-and-forget helpers:
        - `mirror_user_upsert(doc, kind)` / `mirror_user_delete(id)`
        - `mirror_product_upsert(doc, channel)` / `mirror_product_delete(id)`
        - All wrap the actual write in `asyncio.create_task` so Mongo writes NEVER block.
        - `replay_dead_letter(limit)` + `dead_letter_scheduler_loop()` — exponential backoff (5m → 30m → 2h → 6h → 24h), auto-abandon after 5 attempts.
        - `_as_datetime()` normalises ISO string timestamps → tz-aware `datetime` for TIMESTAMPTZ columns.
    - `/app/backend/services/supabase_bootstrap.py` — startup hook (`run_alembic_upgrade_on_boot`) + `periodic_backfill_loop(db)` runs every 6h as a safety net.
    - `/app/backend/scripts/backfill_supabase_mirror.py` — one-time / periodic full backfill of users, retailers, products, b2b_products. Idempotent via `ON CONFLICT DO UPDATE`.
    - `/app/backend/routers/admin/admin_supabase_mirror.py` — admin endpoints:
        - `GET  /api/admin/supabase-mirror/status` — enabled? dead-letter counters.
        - `POST /api/admin/supabase-mirror/replay-dead-letter` — force drain due retries.
        - `POST /api/admin/supabase-mirror/backfill?kind=all|users|retailers|products|b2b_products` — force a full re-mirror.
- **Live write hooks** (never block Mongo):
    - `services/auth_service.py::create_user` → `mirror_user_upsert(kind="b2c")`
    - `routers/retailers.py` (admin create + public partner-add) → `mirror_user_upsert(kind="b2b")`
    - `routers/b2b_waitlist.py` onboarding → `mirror_user_upsert(kind="b2b")`
    - `routers/admin/admin_products.py` create/update/delete → `mirror_product_*`
    - `services/product_sync.py::mirror_b2c_product` → per-SKU `mirror_product_upsert(channel="b2b")`
- **Sync-forever guarantee**: Even if a new write path is ever added without a live hook, the 6-hourly backfill catches up (idempotent upsert). GitHub push → Render redeploys → Alembic auto-applies migrations → schema stays in lockstep.
- **First-time results**: Backfill mirrored **22 users** (12 B2C, 10 B2B), **27 products** (10 B2C, 17 B2B), **0 dead-letter rows**. End-to-end live verification: registering a new user via `POST /api/auth/register` landed the row in Supabase within 3s while the API response returned instantly.
- Password + URI stored in `/app/backend/.env` as `SUPABASE_DB_URL` (URL-encoded `%21` for the `!` in the password). Env keys: `SUPABASE_DB_URL`, `SUPABASE_MIRROR_ENABLED`.

**2. Router organization refactor (`server.py`)**
- Grouped `include_router` calls into 5 clearly labelled sections: Public storefront · Retailer/B2B portal · Mobile/SDK · Admin · Third-party integrations. Zero behavioural change — only reordering + section comments so new routers land in the right neighbourhood.

**3. Testing** — NEW `tests/test_supabase_mirror.py` (**11/11 passing**): id extraction, ISO/naive datetime coercion, user/product row mapping, JSON coercion of Mongo types, public helpers noop when disabled + swallow-no-running-loop, dead-letter mark-sent, reschedule-on-failure, abandon-after-max, disabled summary. Full regression: **126/126 across iter74–83 + B2B + fragrance rewards + shipping/inventory**. Frontend untouched this iteration.

**4. Environment recovery** — The Python venv had ~1,265 site-package files corrupted with null bytes (pre-existing damage, not caused by this session). Force-reinstalled every dep from `requirements.txt`; backend now boots cleanly.

**5. Mirror-Everything expansion (same iteration)** — Extended the mirror to cover ALL non-sensitive Mongo collections for mobile-app read access:
- New table `collections_mirror` (composite PK `collection` + `doc_id`, JSONB `raw`) — migration `0002_collections_mirror`.
- `services/supabase_sync.py::mirror_collection_upsert/delete` — fire-and-forget generic helpers.
- **Blocklist enforced**: `admin_credentials`, `admin_2fa_tokens`, `admin_recovery_tokens`, `admin_sessions`, `retailer_sessions`, `user_sessions`, `sessions`, `otp_verifications`, `store_pickup_otps`, `payment_sessions`, `zoho_tokens` — **never** mirrored.
- **Sensitive-key stripping** on JSONB payloads: `password`, `password_hash`, `session_token`, `access_token`, `refresh_token`, `api_key`, `secret`, `reset_token`, `otp`, `otp_hash`, `verification_code`, `two_factor_secret` — removed from every mirrored doc.
- `run_backfill(kind="all"|"collections")` now walks `db.list_collection_names()` and re-mirrors every allowed collection. First run mirrored **439 rows across 50 collections** (blog_posts, orders, b2b_orders, carts, wishlists, retailer_admin_messages, rewards_ledger, retailer_milestones, auto_blog_log, b2b_inventory_log, notify_me, discount_codes, etc.).
- 6-hour periodic backfill loop now catches every collection automatically → **mobile app gets fresh reads within 6h of any change, even for collections without a dedicated live hook**.
- Admin backfill endpoint now accepts `kind=collections`.
- 6 new pytests cover the generic mirror path (sanitize recursion, business-id fallback, blocklist enforcement, delete blocklist). **17/17 mirror tests + 83/83 regression across iter74–83 pass**.

### 🏆 Feb 2026 (Iteration 82) — Aroma Ranking Tiers · Monthly Constant Companion Auto-Blog

**1. Aroma Ranking Tiers — Bronze / Silver / Gold rings**
- Backend (`services/retailer_milestones.py`): `compute_tier(n)` returns `{id, label, min_achievements, color, ring_class, achievements_count, next_tier{tags_to_go}}`. Novice (0), Bronze (1-2), Silver (3-4), Gold (5+). Exposed via existing `/api/retailer-dashboard/patron` and `/api/admin/retailers/{id}/patron` under key `tier`.
- Frontend: `PatronStatusCard` on `/retailer/b2b/rewards` now wears a colored **ring** matching the tier (amber-400 gold / slate-400 silver / orange-400 bronze / dashed slate-300 novice) plus a bold medal-pill (🥇🥈🥉). Card also shows "N more tag(s) to reach Silver" motivational hint when a next tier exists.
- `CompactPatronProgress` on `/retailer/b2b` catalog wears a slim `ring-2` in the same tier color + inline tier pill + tier-progress hint. Both surfaces read the same `tier` block so they never disagree.

**2. Leaderboard Prize Cadence — Monthly Constant Companion shout-out**
- NEW `services/leaderboard_shoutout.py` (`run_monthly_shoutout`, `has_run_this_month`, `_month_key`). Reads the top of `leaderboard_cache`, respects `leaderboard_opt_in` (anonymises if opted-out), skips silently when streak < 2 months or leaderboard empty. Idempotent per `YYYY-MM` via `constant_companion_shoutout_log` collection.
- Publishes a full `blog_posts` doc (community-authored, is_published=True) with hand-crafted template — NO Gemini call, so it's free, fast, and reliable. Includes FAQ block + social caption + best-effort social cross-post fan-out.
- Wired into `services/auto_blog.py::scheduler_loop` — fires opportunistically on day-1-of-month ticks. Also exposed via admin endpoints:
  - `POST /api/admin/auto-blog/constant-companion/run-now` (`?force=true` to override monthly gate)
  - `GET  /api/admin/auto-blog/constant-companion/status` (reports `already_run_this_month` + latest run summary)

**3. Testing** — NEW `tests/test_iter82_tiers_shoutout.py` (**9/9 passing**): tier boundaries + next-tier progression, `/api/retailer-dashboard/patron` returns tier, shout-out publishes for opted-in leader, anonymises when opted-out, skips streak-too-short, skips no-leader, admin auth gate + idempotent re-run + force. Runs alongside all previous iter74-81 suites.

### 🎊 Feb 2026 (Iteration 81) — Milestone Unlock Notifications · Retailer Progress Widget · Public Community Leaderboard · Scheduled Weekly Refresh

**1. Milestone Unlock Notifications (Email + WhatsApp)**
- `sync_achievements()` now calls `_notify_milestone_unlocked` whenever it inserts new achievement rows.
- Email template: gold-gradient hero, retailer first-name greeting, tag + immutable earn-date, CTA button → `/retailer/b2b/rewards`.
- WhatsApp template: "🎉 Congrats Priya! You just earned *Cedar Patron*…" with a deep-link to the rewards page.
- Both channels are best-effort with per-channel try/except — a delivery failure never rolls back the achievement row.

**2. Retailer-facing Progress Widget on `/retailer/b2b` catalog**
- NEW `CompactPatronProgress` component pinned right below the "B2B Wholesale Orders" header. Reads from `/api/retailer-dashboard/patron` (same source as the full journey card so both surfaces always agree).
- Shows current tag + next milestone + human-readable "N more orders to X" copy + a slim amber-orange progress bar + a "See journey →" link that jumps to `/retailer/b2b/rewards`.
- Gracefully hides itself if the retailer has no progress AND no current tag yet.

**3. Public Community Leaderboard (`/community`)**
- NEW `GET /api/community/leaderboard` — returns the top-3 opted-in retailers straight from the streak cache (O(1) reads, no scan at request time).
- NEW `PUT/GET /api/retailer-dashboard/leaderboard-opt-in` — self-service opt-in toggle. Default is **opt-out** (privacy-first).
- Frontend:
    - NEW `/community` marketing page — Trophy hero, gold-silver-bronze cards with business name + city + streak count. Empty state when no one has opted in yet.
    - NEW `LeaderboardOptInToggle` on the Patron Journey card — retailers can flip their public visibility with one click, with a clear preview of exactly what becomes public.

**4. Scheduled Weekly Refresh**
- NEW `streak_leaderboard_weekly_loop(db)` in `services/monthly_rewards_digest.py` — polls every `CHECK_INTERVAL_SECONDS`, fires the O(N) `refresh_streak_leaderboard` **once every Sunday between 00:00 and 00:59 UTC**. Guarded by an `%Y-%W` run key so a container restart mid-window doesn't double-fire.
- Wired into `server.py` startup alongside the monthly digest scheduler. Together with iter80's lazy fallback, retailers now see a fresh leaderboard within a week + never eat a stale-cache slow read.

**5. Testing** — `tests/test_iter81_progress_leaderboard.py` — **9/9 passing** (email/whatsapp body content, opt-out hides retailer, opt-in shows correctly with city + streak, retailer opt-in CRUD, auth gate, weekly loop importable, refresh updates timestamp, next_milestone key present on retailer status). Full regression **83/83 across iter74-81**. Frontend `yarn build` succeeds in 43s.



### 📈 Feb 2026 (Iteration 80) — Milestone Progress Bar · Streak Leaderboard Cache

**1. Milestone Progress Bar — turns silent progress into active motivation**
- Backend: `get_retailer_patron_status` now returns a `next_milestone` payload — the closest un-earned active milestone with `{name, aroma_tag, stat, threshold, current_value, remaining, progress_pct}`. Chosen by "closest to 100%" so the retailer always sees the milestone they're most likely to hit next.
- Returns `null` once every active milestone is earned (verified by test).
- Frontend: NEW `NextMilestoneProgress` component on `/retailer/b2b/rewards`:
    - Amber-orange gradient progress bar (`data-testid="next-milestone-progress-bar"`).
    - Human-readable remaining copy: "2 more orders to Cedar Patron", "₹40,000 more in purchases to Musk Maven", "3 more months in a row to Amber Guardian".
    - Shows current value, percentage, and threshold below the bar.
    - Rendered on both the populated Patron Journey card AND the empty state so new retailers see their first milestone immediately.

**2. Streak Leaderboard Cache — O(1) reads for Constant Companion**
- NEW `db.leaderboard_cache` collection with a single `streak_leaderboard` doc holding the top-3 streak retailers + timestamp.
- `refresh_streak_leaderboard()` scans all non-suspended retailers and stores the top 3. Called from:
    - `_get_streak_leader()` lazily whenever the cache is missing or older than **STREAK_CACHE_TTL_DAYS (default 7)**.
    - NEW admin endpoint `POST /api/admin/milestones/refresh-streak-leaderboard` for on-demand rebuilds.
- `_compute_honors` no longer scans every retailer — it reads the cached top holder in O(1). The O(N) scan runs at most once per week per environment.
- TTL is a single constant — bump to 14 or 30 if scans get costly (per user's guidance).

**3. Testing** — `tests/test_iter80_progress_cache.py` — **6/6 passing** (next_milestone progress math, null when all earned, cache creation + within-TTL reuse, stale-cache rebuild, admin refresh endpoint, iter79 immutability regression). Full regression **74/74** across iter74-80. Frontend `yarn build` succeeds in 43s.



### 🏅 Feb 2026 (Iteration 79) — Patron Milestones · CI SDK Generation · Standalone-App Foundation

**1. Retailer Patron Milestones — aroma-themed loyalty tags**
- NEW `services/retailer_milestones.py`:
    - Milestone schema: `name`, `aroma_tag` (cedar / sandalwood / oudh / musk / amber / kewda / rose), `stat` (lifetime_orders / lifetime_gmv_inr / monthly_order_streak / active_months), `threshold`, `description`, `order`, `is_active`.
    - Default seed on first read: **Cedar Patron (5 orders)** → **Sandalwood Sage (20)** → **Oudh Master (50)** → **Musk Maven (₹1L GMV)** → **Amber Guardian (12 active months)**.
    - **IMMUTABLE `achieved_at` timestamps** — `retailer_achievements` rows are insert-only. Threshold edits, renames, and even deactivation never rewrite an earned achievement (verified by tests).
    - `sync_achievements()` runs automatically after every paid B2B order via the post-payment hook pipeline — tags appear the moment they're earned.
- NEW live-computed **Honor badges**:
    - **Aroma Trailblazer** — whichever retailer reached the top milestone fastest (days from `retailer.created_at` to `achievement.achieved_at`).
    - **Constant Companion** — longest unbroken monthly ordering streak (≥ 3 months).
    - Never stored — freshly computed on read so the crown correctly passes the moment someone else overtakes.
- NEW `routers/retailer_milestones.py`:
    - Admin CRUD: `GET/POST/PUT/DELETE /api/admin/milestones` (soft-delete only — preserves audit history).
    - Admin viewer: `GET /api/admin/retailers/{id}/patron`.
    - Retailer self-service: `GET /api/retailer-dashboard/patron`.
- Frontend:
    - NEW `/admin/milestones` — full CRUD UI with aroma-themed pill previews, threshold picker, description field, active/retired toggle. Deactivation dialog reminds the admin that earned achievements are immutable.
    - Retailer `/retailer/b2b/rewards` page gains a **Patron Journey** card: current aroma-themed tag, honor badges, and every earned milestone with its immutable earned-on date.

**2. CI SDK Generation — `.dart` / `.swift` / `.kt` / `.ts` clients**
- NEW `scripts/generate-sdks.sh` — fetches `/openapi.json` and runs `openapi-generator-cli` for Flutter (Dart), iOS (Swift 5), Android (Kotlin) and TypeScript-Axios (shared web/RN). Outputs to `clients/`.
- NEW `.github/workflows/generate-sdks.yml` — triggers on every push to `main` that touches `backend/**`. Regenerates the SDKs and commits them back to the repo so mobile teams pull typed clients that never drift from the backend. `PROD_BACKEND_URL` is a repo secret.
- Backend already exposes a rich 344 KB OpenAPI schema at `/openapi.json` — nothing else needed.

**3. Standalone e-commerce app foundation**
- Extended `/api/app/manifest.stable_endpoints` with the surfaces a native storefront needs: `cart_add`, `cart_update`, `cart_remove`, `cart_clear`, `checkout_create_order`, `checkout_verify_payment`, `customer_orders`, `product_asset`, `retailer_patron`. A Flutter/Swift/Kotlin generator now sees every endpoint required for a full-fat storefront app (not just a WebView wrapper).
- Docs baked into the script + workflow explaining how to add the SDK as a Gradle module / SwiftPM package / `pub` dep.

**4. Testing** — `tests/test_iter79_milestones.py` — **5/5 passing** (CRUD flow, invalid stat rejection, achievement timestamp immutability under re-runs AND threshold hikes, Trailblazer honor to the fastest retailer, manifest exposes all e-commerce endpoints, admin can read any retailer's patron status). Full regression **68/68 across iter74-79 + legacy B2B**. Frontend `yarn build` succeeds in 35s.



### 📱 Feb 2026 (Iteration 78) — ImpactProvider single-source + Mobile-app foundation

**1. `ImpactContext` single-source refactor**
- NEW `context/ImpactContext.js` — one fetch, one provider, one truth. `<ImpactProvider>` wraps the app in `layout.js` and every consumer (`useImpact()`) reads the same in-memory state.
- Background refresh every 5 min so long-lived tabs stay in lockstep.
- Graceful degradation: `useImpact()` returns safe defaults if a component is rendered outside the provider — no crashes, ever.
- `TreeCounter.js` and `CSRSection.js` now BOTH consume `useImpact()` — dropped their independent `/api/impact/trees` fetches (was two round-trips + a theoretical drift window; now zero drift by construction).

**2. Mobile / iOS / Android foundation** *(all made stable so a native client can be built later without more backend work)*
- NEW `routers/app_config.py` — the ONE endpoint a mobile app hits at boot:
    - `GET /api/app/config` — brand tokens (colors, fonts, logo), contact info, social links, deep-link routes, feature flags, live impact snapshot (`trees_planted`), catalog counts, compatibility check (`must_upgrade`), deep-link scheme, public web URL.
    - `GET /api/app/manifest` — points at `/openapi.json` + lists the stable public endpoints so SDK generators (`openapi-generator -g dart / swift5 / kotlin`) can auto-scaffold typed clients.
- DB-driven overrides: the `platform_config` MongoDB doc can override `brand`, `contact`, `social`, `routes`, `features` — ops can flip a feature flag without a deploy.
- Impact snapshot inside `/api/app/config` uses the same `_compute_trees()` helper as `/api/impact/trees` — verified via test that the two never diverge.
- Backwards compatibility guaranteed via `schema_version` + `min_supported_app_version` + additive-only field policy. Old clients continue to work when new fields are added.
- FastAPI's built-in `/openapi.json` (344KB) and `/docs` (Swagger UI) already expose the full typed contract — **regenerates automatically on every backend change**. That's the "always-in-sync source" the user asked for.

**3. Testing** — `tests/test_iter78_app_config.py` — **8/8 passing**:
- Impact endpoint stability (no race between two calls)
- App config shape (all required keys, brand/routes/features/impact/catalog present)
- Feature flags are `bool` (safe for `if features['x']` on mobile)
- `must_upgrade` toggle: old client (v=0) sees `True`, new client (v=999) sees `False`
- DB override merges on top of defaults (feature toggle, contact edit)
- Manifest points at OpenAPI + lists stable endpoints
- OpenAPI 3.x served with all new paths discoverable
- Swagger `/docs` UI reachable

**Regression**: 86/86 backend tests green (iter74-78 + legacy B2B). Frontend production build succeeds (56.7s).



### 🌿 Feb 2026 (Iteration 77) — Blog in header · Tree-count sync · Frontend build unblocked

**1. Blog nav in the site header** — `components/Header.js` now renders **Blog** as a top-level nav item between *Sustainability* and *Find Retailers*, so the auto-blog pipeline surface is one click from every page.

**2. Tree-count mismatch bug fix** — `/` "Giving Back to Society" section had two divergent numbers:
- Live pill (`data-testid="tree-counter-value"`): **39** (from `/api/impact/trees`, authoritative)
- "Environmental Conservation" card badge: **50+ trees planted** (hard-coded string in `csrInitiatives`)

Fix: `CSRSection.js` now fetches `/api/impact/trees` and renders the exact live count on the badge (`{liveTrees} trees planted`). Both figures now share a single source of truth and always agree. Fallback to "Growing every day" if the API is unreachable — never a hard-coded number again. Verified by testing agent (iter77): DOM shows `39 == 39 == API` with zero drift, "50+ trees planted" string completely gone.

**3. Frontend production build unblocked** *(critical, pre-existing regression from iter74)*
- Root cause: `app/admin/b2b/preorders/page.js` was importing `authFetch` from `'../../../layout'` — from that depth `../../../` resolves to `app/` (the ROOT server layout that exports `metadata`), not `app/admin/`. Bundling then flagged the "cannot export metadata from a `use client` component" and killed `yarn build`.
- Fix: corrected the import to `'../../layout'` (which correctly points to `app/admin/layout.js` — the client layout that owns `authFetch`).
- `yarn build` now completes cleanly (41.85s, all routes emitted). Supervisor `frontend` service back to **RUNNING**.

**4. Preview URL `/api` 404 — flagged (env/infra, not code)**
`NEXT_PUBLIC_BACKEND_URL` in `.env.local` points to the preview URL, but the preview ingress doesn't forward `/api/*` to the backend — so client-side fetches from the deployed preview 404. Recommended env fix (safer than an ingress change): set `NEXT_PUBLIC_BACKEND_URL=''` so client code uses relative URLs which the Next.js rewrite in `next.config.js` proxies to the backend at the server layer. Deliberately not changed in this iteration because the deployment target may rely on the current value — leaving as an ops note.



### 🚀 Feb 2026 (Iteration 76) — Launch SKU Toggle · Balance Payment Link · Bulk CSV Upload · Founding Retailer Early-Access

**1. Balance Payment Link (closes the Batch-Ready loop)**
- Two new B2B endpoints under `/api/retailer-dashboard/b2b/order/{id}`:
    - `POST /create-balance-payment` — mints a Razorpay order for the remaining 50%, refuses non-preorders / already-settled balances.
    - `POST /verify-balance-payment` — verifies signature, marks `balance_paid_at`, pushes the order to `confirmed`, then re-runs the shared `run_post_payment_hooks` pipeline (rewards + inventory + Zoho) so the balance settlement behaves identically to a full-price payment.
- Frontend: NEW `/retailer/b2b/orders/[order_id]` page. When landed with `?balance=1` from the Batch-Ready nudge it auto-opens Razorpay checkout for the outstanding amount. Shows token paid / balance due / status pills + a confirmation banner once settled.
- `services/b2b_batch_ready_nudge.py` now reads `PUBLIC_APP_URL` from env for the deep-link base.

**2. Bulk CSV Product Upload**
- NEW `POST /api/admin/products/bulk-import` — multipart CSV → parses `name, description, type, size, mrp, price, opening_stock, image`. Rows sharing a `name` are collapsed into a single product with multiple sizes. Each new product runs through `mirror_b2c_product` so B2B SKUs auto-populate.
- NEW `GET /api/admin/products/bulk-import/template.csv` — downloadable starter CSV with 3 example rows.
- Frontend: `/admin/products` gains a **Bulk Import CSV** button next to Add Product + a "CSV template" quick-download link. Shows per-row error summary if any rows are malformed.

**3. Founding Retailer Early-Access + One-Click SKU Launch**
- NEW `services/product_launch.py`:
    - `sign_preview_token(product_id, expires_at)` / `verify_preview_token(token)` — HMAC-SHA256 signed, self-verifying tokens (no DB round-trip needed for validation).
    - `launch_sku(db, product, admin_email, hidden_hours=24, broadcast=True)` — stamps `early_access_until`, `launched_at`, `preview_token` on the product; broadcasts the launch via `broadcast_custom_nudge` (email + WhatsApp with the product image); emails the platform accountant CC that a new revenue line went live.
- `GET /api/products` + `GET /api/products/{id}` now respect the early-access window:
    - Hidden products are stripped from the public list (a coming-soon teaser stub with `coming_soon: true` is stitched onto the tail).
    - A `?preview={token}` query reveals the SKU end-to-end (both endpoints).
- NEW `GET /api/preview/resolve/{token}` — exchanges a signed token for the full product payload (used by the preview landing page).
- Frontend:
    - NEW `/preview/[token]` page — private "Founding Retailer Early Access" landing with the product image, sizes, and CTAs to `/retailer/b2b` + `/collection`. Shows a graceful "link expired" state.
    - `/admin/products` — every product row now has a 🚀 **Launch** button (`data-testid="launch-product-{id}"`). Confirms + kicks off the launch sequence, shows the preview URL + broadcast recipient count in a toast.
    - Row pill: 🚀 **Early Access** badge (`data-testid="early-access-badge-{id}"`) while the SKU is inside the 24h window.

**4. Testing** — `tests/test_iter76_features.py` — **10/10 passing** (balance payment endpoint shape + non-preorder rejection, bulk CSV create+merge+B2B mirror + missing-column rejection + template download, HMAC token sign/verify/expiry/tamper roundtrip, launch hides from public, preview reveals it, invalid token → 404). Full regression across iter74 + iter75 + iter76 + legacy B2B: **78/78 green**.



### 🎯 Feb 2026 (Iteration 75) — Product Image Uploader · Sync Health Dot · Batch-Ready Nudge · Per-Retailer Accountant CC

**1. Product Image Uploader (drop-and-go)**
- New public asset proxy: `GET /api/products/asset/{asset_id}` streams from Emergent object storage with a 1-year immutable cache header — makes URLs safe to bake into brochures / share with retailers.
- New admin upload: `POST /api/admin/products/upload-image` (multipart) — 8 MB cap, image/* only (415 on other MIME types), returns `{asset_id, url, size, content_type}`. Uses the pre-existing `services/object_storage.py` (EMERGENT_LLM_KEY-driven).
- Frontend: NEW `components/ImageDropUploader.js` (drag/drop + click-to-pick + preview + Replace/Remove actions). Wired into `/admin/products` for the **Primary Image** and each **per-size gallery** (URL textarea still available as fallback).

**2. Stock Sync Health Dot**
- New admin endpoint `GET /api/admin/b2b/inventory/sync-health` returns `{healthy, counts, ok, drift, orphaned}`. Drift = a B2C size with no matching B2B SKU (by `product_id + net_weight`). Orphaned = B2B SKU whose `product_id` no longer exists in B2C (usually wholesale-only variants like the Ready-to-Use Dhoop packs).
- Frontend: green **Sync OK** / red **N drifted** pill next to the "B2B Inventory" title on `/admin/b2b/inventory` (`data-testid="sync-health-pill"`). Clicking opens a modal (`data-testid="sync-health-panel"`) with the drift + orphaned breakdown and a "Save the product to auto-mirror" hint.

**3. Auto Restock ETA Nudge — Batch Ready**
- NEW `services/b2b_batch_ready_nudge.py` — every outstanding paid pre-order (`is_preorder=True`, `payment_status='paid'`, not fulfilled/shipped/cancelled) for the flipped SKU receives an Email + WhatsApp "🎉 Your Batch Is Ready" nudge containing the balance amount + deep-link (`/retailer/b2b/orders/{order_id}?balance=1`).
- Wired into `POST /api/admin/b2b/inventory/{product_id}/status` — the endpoint now snapshots the previous status, and only fires the nudge on a real out→in flip. Response includes `batch_ready_nudge: {sent, skipped, product_id}`.
- Idempotent per `(order_id, product_id)` via a new `db.batch_ready_nudges` guard collection.

**4. Per-Retailer Accountant CC**
- Retailer-side: NEW `GET/PUT /api/retailer-dashboard/accountant-email`. UI: `AccountantEmailCard` (`data-testid="accountant-email-card"`) on `/retailer/b2b/rewards`.
- Admin-side: `accountant_email` added to `RetailerUpdateRequest` + `direct_fields` so `PUT /api/retailers/admin/{retailer_id}` can update it too.
- Monthly Rewards Digest: NEW `_accountant_email_for_retailer(retailer, platform_default)` resolver — retailer's personal CC wins, platform default is the fallback. The digest cursor now projects `accountant_email` for every recipient.

**5. Testing** — `tests/test_iter75_features.py` — **11/11 passing** (image upload roundtrip, 415 rejection, admin gate, sync-health shape, batch-ready nudge fires + is idempotent, "no outstanding preorders" skip path, retailer accountant CRUD + validation + auth gate, resolver unit test, regression on `/api/products` stock enrichment + batch-allocation).



### 🔗 Feb 2026 (Iteration 74) — Refactor · Batch Allocation · Pre-Order Badge · **Unified Product/Inventory Model** + "Mogra Magic" bug fix

**1. Refactor (pricing engine split)**
- `services/b2b_pricing_extras.py` (NEW) — pulled the pre-order/shipping/rewards/projection augmentations out of `routers/b2b_orders.py` into four composable helpers (`apply_preorder_terms`, `apply_shipping`, `apply_rewards_redemption`, `add_rewards_projection`).
- `services/b2b_payment_hooks.py` (NEW) — bundled the four post-payment side-effects (rewards accrual + redemption consumption + inventory deduction + Zoho payment sync), each guarded independently.
- `services/b2b_emails.py` gained `send_b2b_order_confirmation_email` (retailer-facing HTML, moved out of the router).
- `routers/b2b_orders.py` shrank from **951 → 714 lines**.

**2. Batch Allocation Dashboard (P2 done)**
- Admin endpoint `GET /api/admin/b2b/preorders/batch-allocation` groups every outstanding paid pre-order by SKU with proportional token/balance attribution (line_total/subtotal weight), sorted by pieces booked desc so production can prioritize.
- Drill-down `GET /api/admin/b2b/preorders/by-sku/{product_id}` returns every retailer + contact per SKU.
- New page `/admin/b2b/preorders` with 5 summary cards, expandable rows and per-retailer drill-down.

**3. Pre-Order Available badge (P3 done)**
- New helper `isPreorderAvailable(product)` on `/retailer/b2b` page; renders an amber-outlined **PRE-ORDER AVAILABLE** pill next to out-of-stock / restocking / manufacturing / delayed SKUs on both mobile and desktop layouts.

**4. Bug fix: "Royal Kewda" showing as "Mogra Magic"**
- Root cause: `_SEED_PRODUCTS` in `b2b_catalog.py` seeded a phantom "Mogra Magic" SKU that never existed on the B2C storefront. Royal Kewda (which DID exist on B2C) was never mirrored to B2B.
- Fix: Swapped Mogra Magic out for Royal Kewda 50g + 200g in the seed. One-off migration purged 2 lingering Mogra Magic rows from `db.b2b_products`. Static grep confirms zero `mogra magic` references anywhere in the codebase.

**5. Missing Ready-to-Use Dhoop SKUs added**
- `mystical-meharishi-b2b` (100g Dhoop + Ceramic Stand + Safety Matchbox) — B2B mirror of the existing B2C `mystical-meharishi` product.
- `belpatra-dhoop-b2b` (100g Dhoop + Ceramic Stand + Safety Matchbox) — B2B mirror of the existing B2C `bilvapatra-fragrance`.
- Both stamped with `ready_to_use=True`, category `dhoop`, 32 pieces per carton, GST 18%, HSN 33074900.

**6. Unified Product / Inventory Model** *(the big one)*
- `services/product_sync.py` (NEW) — bidirectional linkage between the B2C `products` collection and the B2B `b2b_products` collection.
    - `mirror_b2c_product(db, product)` — one B2B SKU per B2C size, matched by `product_id + net_weight` so legacy IDs (`kesar-chandan-200-b2b`) are reused, never duplicated. Existing `stock_pieces` is preserved on updates.
    - `deduct_stock_for_b2c_order(db, order)` — B2C paid orders now decrement the same `stock_pieces` counter used by the B2B panel. Idempotent via `b2b_inventory_log` guard row per order+SKU.
    - `enrich_b2c_products_with_stock(products, b2b_rows)` — `GET /api/products` and `GET /api/products/{id}` now surface the shared stock number on each size (via product_id + net_weight lookup).
- `admin/admin_products.py` — POST/PUT now call `mirror_b2c_product` after saving to `products`. A new **`opening_stock`** field on `ProductSizeInput` seeds the linked B2B SKU on creation (ignored on updates — live stock is edited from the Inventory panel).
- Frontend `/admin/products` gained an **Opening Stock (pieces)** input per size (`data-testid="size-opening-stock-{idx}"`).
- One-off migration re-mirrored every B2C product into `b2b_products` so the two catalogs are now in lockstep. Brochure PDF continues to render from `db.products` — so every new product added via the admin form auto-appears in the retailer catalog + brochure with no manual intervention.

**7. Testing**
- iteration_74.json: **100% backend (8/8 new integration cases in `tests/test_iter74_unified_products.py`)**. Regression: 63/63 legacy pytest pass (`test_b2b_shipping_inventory`, `test_b2b_category_stock`, `test_fragrance_rewards`, `test_order_pricing_refactor`).
- Frontend UI walk was blocked because the Emergent preview URL was in "Wake up servers" state — testing agent verified via static grep that the string `Mogra Magic` is nowhere in `/app/frontend-next/**`.



### 📦 Feb 2026 (later still⁷) — Pre-Order · CSV Filters · Monthly Rewards Digest

**1. Pre-Order flow (out-of-stock SKUs)** — NEW
- `services/b2b_preorder.py` — token math (fixed 50%), eligibility gate (out_of_stock / restocking / manufacturing / delayed OR stock_pieces=0), terms text v1 stamp (`PRE-ORDER-V1-2026-02`) containing all 6 user-mandated clauses: non-refundable, non-cancellable, no CNs, amend-only-upward-from-prepaid, exchange only on manufacturing-defect-with-intact-seal, damage-must-be-reported-at-delivery, plus signature-closes-preorder.
- `B2BOrderCreate` gained `is_preorder` + `accept_preorder_terms`. `/calculate` and `/order` bypass the out-of-stock guard only when both are true. Server-side terms validation rejects missing acceptance with a 400.
- Razorpay now charges ONLY the 50% `token_amount_inr` on pre-orders (not the grand_total). Balance due at delivery is stamped on the order.
- `services/b2b_preorder_pdf.py` — reportlab receipt with prominent **"Next Production Batch"** banner (user-mandated language, NEVER shows a timeline / ETA / delivery date), retailer + payment blocks, items table, full legal terms block, and a signature line for the retailer to sign upon delivery — one copy retained by the sales rep / delivery boy.
- New endpoint `GET /api/retailer-dashboard/b2b/orders/{order_id}/preorder-receipt.pdf` (retailer auth). Non-preorder orders 400.
- `<PreOrderModal />` component (React) built with all 6 terms as separate checkboxes; ready-to-wire on the retailer catalog (deferred as a small follow-up polish ticket).

**2. Admin CSV Filter UI**
- Clicking "Export Log (CSV)" on `/admin/b2b/inventory` now opens a slide-in filter panel with **Product dropdown · From Date · To Date · Download CSV** — all three filters forward to `GET /api/admin/b2b/inventory/log/export.csv?product_id&from_date&to_date` which backend already supported. Empty filters download the full log.

**3. Monthly Rewards PDF Digest**
- `services/monthly_rewards_digest.py` — scheduler task runs 120s after boot then daily-polls; actually dispatches ONLY on the 1st of each calendar month. Per-month idempotency via `db.settings.rewards_monthly_digest_state.last_month`.
- Emails every retailer their PDF statement (built via `services/b2b_rewards_pdf.py`) with a friendly HTML body. **Accountant CC** — reads from the new `accountant_email` slot in the DB-backed admin integrations panel; when set, every retailer's monthly statement lands in the accountant's inbox too.
- `services/email_service.send_email()` gained a `cc=` kwarg (string or list) forwarded to Resend.
- New `KNOWN_KEYS` entry `accountant_email` (category `bookkeeping`) so admin can PUT it via the existing integrations panel.
- Admin manual-trigger endpoint `POST /api/admin/b2b/inventory/rewards-digest/send-now` (force=True) for immediate dispatch. Every send is logged to `db.rewards_monthly_digest_log`.

**4. Regression** — 12 new pytest cases in `tests/test_preorder_monthly_digest.py` (token math, eligibility, terms text clauses, receipt PDF, email dedup, no-email skip, digest idempotency) + testing_agent iter73's 4 integration cases. Combined **104/104 backend pytest pass, 16/16 iter73 pass (12 unit + 4 integration)**. Testing_agent iteration_73 = **100% backend, 100% frontend, zero action items**.

### 📊 Feb 2026 (later still⁶) — Stock CSV export + Retailer Rewards PDF statement

**1. Admin Stock Change-Log CSV export**
- New endpoints on the `/admin/b2b/inventory` router:
  - `GET /log` — full audit list across every SKU (up to 2,000 rows).
  - `GET /log/export.csv` — streaming CSV download filterable by `product_id`, `from_date`, `to_date`. Columns: **Date (UTC) · Product ID · Product Name · Reason · Δ Pieces · Before · After · Order ID · Admin · Note · Entry ID**. Product name auto-enriched from `b2b_products` so accountants see e.g. "Bold Bakhoor (50g)" instead of a raw ID.
- Guards: rows with a non-ISO `created_at` (e.g. date-only strings) no longer IndexError — they pass through with the raw stamp.
- New black **"Export Log (CSV)"** button on `/admin/b2b/inventory` (data-testid `export-inventory-csv-btn`) streams the response into a Blob and triggers a browser download.
- Route order corrected: `/log`, `/log/export.csv`, `/low-stock/*`, `/nudges/*`, `/restock-nudges/*` are now all declared BEFORE the `/{product_id}` parameterized routes to prevent shadowing.

**2. Retailer Fragrance Rewards Statement PDF**
- New `services/b2b_rewards_pdf.py` — reportlab-based renderer that emits an accountant-friendly statement:
  - Addrika brand header + generation timestamp.
  - Retailer block: business name, GSTIN, retailer ID, address, email, phone.
  - Totals summary: Earned / Redeemed / Adjusted / Expired / **Current Balance** (colour-coded).
  - Full chronological ledger table with a **running balance** column, alternate-row shading, and 100/110/125% multiplier hint per earn row.
  - Programme footer explaining the multipliers, 45-day streak reset, and ₹2,500 redemption threshold.
- New endpoint `GET /api/fragrance-rewards/statement.pdf` (retailer session required) — streams the PDF with a filename like `addrika-rewards-{retailer_id}-{YYYYMMDD}.pdf`.
- Empty ledger renders a valid PDF with a "No ledger entries yet" placeholder row (empty-ledger retailers can now generate a statement — was disabled in first pass, fixed after testing_agent flagged the spec violation).
- New navy **"Download Statement (PDF)"** button on `/retailer/b2b/rewards` (data-testid `rewards-download-statement-btn`).

**3. Regression** — 4 new pytest cases in `tests/test_stock_csv_rewards_pdf.py` (empty ledger PDF, full ledger PDF, missing-fields PDF, CSV headers contract). Combined with testing_agent's iter71+iter72 integration suites, **11/11 integration cases + 4/4 unit cases pass**. Overall backend pytest count: **92/92 green.** Verified end-to-end by testing_agent iteration_72 → 100% backend, 100% frontend, zero action items.

### 🐞 Feb 2026 (later still⁵) — Blog contrast + Admin Inventory backfill + Best-Time-to-Send

**1. Blog body text unreadable (white on light bg)** — FIXED
- Root cause: `/app/frontend-next/app/blog/[slug]/page.js` used `prose prose-lg` but only styled headings + links. Global dark-mode CSS was bleeding into body text making it white on the light hero background.
- Fix: added `prose-p:text-[#2B3A4A] prose-li:text-[#2B3A4A] prose-strong:text-[#2B3A4A] prose-blockquote:text-[#2B3A4A]/80 text-[#2B3A4A]` classes + inline `style={{color: '#2B3A4A'}}` on the content div so every text node inherits the brand navy. **Verified live by testing_agent iteration_70**: body text now renders in `rgb(43,58,74)` on paragraphs, list items, and strong tags.

**2. Admin Inventory tab shows empty list** — FIXED
- Root cause: `services/b2b_catalog.py::seed_b2b_catalog` only ran when `count_documents({})` was 0. Existing production had 10 legacy rows without the newly-introduced `category`, `pieces_per_carton`, `stock_pieces`, `stock_status`, `restock_eta_days`, `is_active` fields → `list_stock` returned rows with all-zero stock and no category, and the UI filtered them out visually.
- Fix: `seed_b2b_catalog` is now a two-mode helper:
  - **First-run**: bulk-insert every row from `_SEED_PRODUCTS`.
  - **Upgrade path**: for every seed row already in DB, `$set` the fields that are `None`/empty (idempotent — never touches fields that were manually adjusted).
- Runs automatically on backend boot. **Verified live by testing_agent iteration_70**: all 10 SKUs now show with correct per-category carton sizes (Bakhoor/Dhoop 32, Agarbatti Jar 16, Agarbatti packet 12); Adjust +100 pieces persists and reflects in the list.

**3. Nudge Best-Time-to-Send — NEW FEATURE**
- New `services/b2b_nudge_send_time.py`:
  - IST-aware bucketing — every open event's UTC timestamp is converted to `UTC+5:30` before slotting into 3-hour buckets across the 7-day week (56 slots total).
  - Weighted scoring — score = `opens + 2 × recent_opens` where recent = last 30 days, so freshly active retailers move the recommendation faster than stale history does.
  - `recommend_send_time(db, retailer_id)` → returns top 3 slots; **falls back to platform default (Tue-Thu, 10-13 IST)** when the retailer has fewer than 3 opens on file.
  - `recommend_send_time_for_audience(db, retailer_ids)` → aggregates opens across a broadcast audience so the composer can suggest a single send-slot for the entire cohort.
- New admin endpoints:
  - `GET /api/admin/b2b/inventory/nudges/best-time/{retailer_id}?top_n=3` — single-retailer recommendation.
  - `POST /api/admin/b2b/inventory/nudges/best-time-for-audience` — audience-wide recommendation. Reuses the composer's `_resolve_audience` selector so the recommendation always matches the exact cohort the admin is about to broadcast to.
- Composer modal (`components/NudgeComposerModal.js`) now shows a blue "Best time to send · learned from open history" panel with three slot chips (first is highlighted with confidence %). Auto-refreshes whenever the audience selector, product, or pincode-prefix changes.
- **7 new pytest cases** in `tests/test_best_send_time.py` (hour → slot mapping, UTC → IST conversion, recency 2× weighting, empty-history default, real-history ranking, audience-wide aggregation). **88/88 pass** across the whole B2B suite.

### 🐞 Feb 2026 (later still⁴) — 3 P0 bug fixes + Broadcast Analytics

**1. Blog SSR crash** (Digest 3506429118) — FIXED
- Root cause: `/app/frontend-next/app/blog/[slug]/page.js` used `<BlogShareToolbar>` component and `SITE_URL` constant without imports → React ReferenceError during Node SSR → generic Application-Error page for every blog post.
- Fix: added `import BlogShareToolbar from '../../../components/BlogShareToolbar'` and `const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://centraders.com'`. Blog list + post pages now serve 200 with the share toolbar rendered. **Verified live by testing_agent iteration_69.**

**2. Appyflow GST — raw upstream error leak** — FIXED
- Root cause: `verify_gst_number()` was falling through to the legacy gstincheck provider on ANY Appyflow non-verified response, discarding the friendly reason and surfacing gstincheck's raw upstream text ('Credit Expire.' / '503 - API Under Maintenance in DC2') to retailers and admin.
- Fix (`services/gst_verification.py`):
  1. Extracted shared `_friendly_upstream_error(raw)` helper — maps maintenance/503/credit/expire/limit/invalid-key/not-found upstream strings to human one-liners.
  2. `_shape_appyflow` and `_shape_legacy` BOTH use it, so raw upstream text never reaches the client from either provider.
  3. `verify_gst_number()` returns the shaped Appyflow error immediately when Appyflow actually spoke — no more fall-through discarding the friendly reason.
- Also: `_read_keys_async()` prefers DB-backed integration keys via `admin_integrations.get_effective('appyflow_api_key')` — admin can rotate keys via the panel without a redeploy.
- **Verified live by testing_agent iteration_69**: endpoint returns `error: "GST verification service is temporarily under maintenance. Please try again in a few minutes."` when upstream 503s.

**3. Sandbox eKYC subscription-expired error UX** — FIXED
- Root cause: Sandbox account subscription is EXPIRED at the account level (HTTP 401 'Subscription has expired'). Not fixable in code — admin must renew. But error UX was generic 'Sandbox authentication failed'.
- Fix (`services/kyc_sandbox.py`):
  - `_authenticate()` catches HTTP 401/403 + subscription-expired string and stores a friendly message in `_token_cache["last_error"]`.
  - New `last_auth_error()` public helper — bubbled through PAN verify + Aadhaar OTP generate + Aadhaar OTP verify paths.
  - New `_read_creds_async()` + `_auth_headers_async()` — DB-backed keys via `admin_integrations.get_effective('sandbox_api_key'/'sandbox_api_secret')`.
- **Verified live by testing_agent iteration_69**: PAN verify endpoint now returns `error: "Sandbox eKYC subscription has expired. Please contact Addrika support to renew."`

**4. Broadcast Analytics — NEW FEATURE**
- New `services/b2b_nudge_analytics.py`:
  - `pixel_bytes()` — 1x1 transparent GIF89a.
  - `append_open_pixel(html, api_base, broadcast_id, retailer_id)` — injects the pixel before `</body>`.
  - `rewrite_links_for_tracking(html, api_base, broadcast_id, retailer_id)` — rewrites every `<a href="http(s)://…">` to route through the click-tracking endpoint. `mailto:` / `#anchor` / relative links are left alone.
  - `record_open` / `record_click` — bumps `opens` / `clicks` on every hit; only bumps `unique_opens` / `unique_clicks` on first-per-retailer / first-per-(retailer,url).
  - `summarise_broadcast()` — returns funnel with `open_rate_pct`, `click_rate_pct`, `ctr_pct`.
- New public router `routers/nudge_tracking.py`:
  - `GET /api/nudges/track/open/{broadcast_id}/{retailer_id}.gif` — always 200 GIF with no-cache headers.
  - `GET /api/nudges/track/click/{broadcast_id}/{retailer_id}?url=…` — 302 redirect. Rejects non-http URLs by redirecting to `/`.
- `broadcast_custom_nudge()` now wires pixel + link rewrite into every recipient's HTML (per-retailer personalisation).
- Admin endpoints:
  - `GET /api/admin/b2b/inventory/nudges/history` — every broadcast row now carries `opens`, `unique_opens`, `clicks`, `unique_clicks`, `open_rate_pct`, `click_rate_pct`, `ctr_pct`.
  - `GET /api/admin/b2b/inventory/nudges/{broadcast_id}/analytics` — funnel drilldown + `top_urls` aggregation.
- Composer sidebar shows three chips per broadcast: **Opens · Clicks · CTR%** so admin sees what actually drives orders.
- **11 new pytest cases** in `tests/test_nudge_analytics.py` — HTML rewrite, pixel bytes, open/click de-dup, rate math, top URLs. **81/81 pass** across the whole B2B suite.

### 🆕 Feb 2026 (later still³) — Redemption History Card · Admin Nudge Composer

**1. Retailer Redemption History Card** (`/retailer/b2b/rewards`)
- New retailer-facing endpoint `GET /api/fragrance-rewards/ledger` returns every earn / redeem / adjust / expire row for the signed-in retailer, sorted newest-first (500 row cap).
- New page renders a KPI strip (Total Earned / Redeemed / Adjustments / Expired), 5 filter chips (All / Earned / Redeemed / Adjustments / Expired), and a row-per-entry ledger with icon + tone by kind, order-id link, multiplier %, and validity date. Empty-state guides new retailers to place a qualifying ₹1,000 order.
- `<RewardsBalanceCard />` now has a "View history →" link so the history page is one tap away from the main dashboard.

**2. Admin Nudge Composer** (`/admin/b2b/inventory` → "Compose Nudge")
- `services/b2b_nudge_composer.py` exposes `broadcast_custom_nudge()` that resolves the audience server-side, wraps the admin's HTML in the Addrika template, and dispatches emails + optional WhatsApp. Every send is logged to `db.custom_nudges_log` with counters (`audience_size`, `email_sent`, `whatsapp_sent`, `failed`, `broadcast_id`, `admin_email`).
- Audience selectors (server-derived so admin can't leak PII by mis-typing): **all**, **verified**, **product** (paid buyers of a SKU in the last 180d), **pincode** (prefix), **retailer_ids** (explicit list). 2,000-recipient hard cap.
- Five nudge templates auto-fill subject/body/WhatsApp text: **Drop · Price Drop · Festive Re-launch · Promo Scheme · Announcement**. Free-form edits allowed on all three fields.
- New endpoints:
  - `POST /api/admin/b2b/inventory/nudges/broadcast` — send the compiled nudge.
  - `GET  /api/admin/b2b/inventory/nudges/history` — recent broadcasts with per-broadcast counters, shown as a live sidebar on the composer modal.
- Full-featured composer modal (`components/NudgeComposerModal.js`): template chips · subject · HTML body · WhatsApp text (1,000-char clamp) · channel checkboxes · audience picker with contextual sub-selectors (SKU dropdown for `product`, pincode-prefix input for `pincode`) · live email preview iframe · recent-broadcasts sidebar. Every interactive element has a `data-testid`.

**3. Regression**
- 10 new pytest tests in `tests/test_nudge_composer.py` cover audience resolution (all / verified / pincode / product / retailer_ids), full broadcast counters, empty-audience handling, e164 normalisation. **70/70 pass** across the new + prior B2B / rewards / iter63 / email-layout suites.

### 🆕 Feb 2026 (later still²) — Redeem at Checkout · Category Chips · Restock ETA Nudges

**1. Fragrance Rewards Redemption at B2B checkout**
- New `services/fragrance_rewards.py::preview_credit` — non-destructive dry-run (same clamps as `apply_credit`) surfaced as `POST /api/fragrance-rewards/preview`.
- `B2BOrderCreate` gained `redeem_rewards_inr` field. The `/calculate` endpoint enforces the rules (invoice ≥ ₹2,500, balance ≥ ₹2,500, credit only offsets invoice value not shipping/GST) and clamps to eligible amount, returning `rewards_redemption` + `rewards_redeemed_inr` in the response so the UI can show the discount line live.
- `POST /order/{order_id}/verify-payment` now actually consumes ledger entries via FIFO (`apply_credit`) after the earn hook fires. Idempotency guard checks for existing `kind=redeem` row.
- Frontend `<RewardsRedeemToggle />` component: checkbox + slider (max = min(balance, subtotal)), server-side preview call debounced 300ms, gracefully disabled when invoice < ₹2,500. Injected below the shipping input on `/retailer/b2b`.

**2. B2B Catalog Category Filter Chips**
- Filter chips (All · Agarbatti · Agarbatti Jars · Bakhoor · Dhoop) render above the product table with live per-category counts, driven by the `category` field already on each SKU. Chips auto-hide when a category has zero SKUs.

**3. Auto-Restock ETA Nudge** (`services/b2b_restock_nudge.py`)
- Scheduler task runs 90s after boot + every 12h. Scans SKUs whose ETA window is 1-2 days from expiring, finds retailers who ordered that SKU in the last 90 days, and pushes an email nudge (Resend). WhatsApp Business Cloud API fallback lands the same message on the retailer's number if the `whatsapp` platform integration is enabled — otherwise silently no-ops.
- Persists every send to `db.restock_nudges` with a 20-day cooldown per SKU × retailer, so retailers are never spammed.
- Manual force-trigger via `POST /api/admin/b2b/inventory/restock-nudges/run` for admins who want to fire the cycle immediately after a batch is confirmed.

**4. Regression**
- 13 new pytest tests in `tests/test_redeem_and_nudge.py` cover preview_credit clamping, FIFO burn, sub-threshold rejects, due-SKU selection window, past-buyer lookup, cooldown de-dup, e164 phone normalisation, end-to-end nudge cycle. **77/77 pass** across the whole B2B suite.

### 🆕 Feb 2026 (later still) — Category carton math · Stock status · Rewards card · Nightly low-stock digest · Pincode auto-fill

**1. Category-based carton math** (`services/b2b_catalog.py::CATEGORY_PACK_SIZE`)
- `dhoop` + `bakhoor` → **32 pcs/carton** (half = 16)
- `agarbatti_jar` (200g) → **16 pcs/carton** (half = 8)
- `agarbatti` (50g/100g) → **12 pcs/packet dozen** (half = 6)
- New `pack_size_for(product)` + `unit_label_for(product)` helpers; explicit `pieces_per_carton` on a product row still wins over category defaults. Seed data updated so every SKU carries the right `category` + pack size.
- Enriched catalog response now carries `price_per_carton`, `price_per_half_carton`, `unit_label` ("carton" or "packet") so the frontend can render category-appropriate labels without any client-side branching.

**2. Stock status + admin-editable ETA** (`services/b2b_inventory.py::set_stock_status`)
- Five states: `in_stock`, `out_of_stock`, `restocking`, `manufacturing`, `delayed`.
- `restock_eta_days` (0-365) + `restock_note` on every SKU. Catalog auto-composes `stock_status_display: {label, tone, is_orderable, subtext}` so the storefront can render *"Out of Stock — Restocking in Progress · Available ETA 15 days"*.
- **Orders are blocked server-side** in `services/b2b_pricing.py::calculate_b2b_order` when a SKU's status is not `in_stock` OR when requested pieces > `stock_pieces`. Error surfaces the shortfall + eta_days.
- Admin endpoints: `POST /api/admin/b2b/inventory/{id}/status {status, eta_days, note}` + status pill / modal wired on the admin inventory page.

**3. Fragrance Rewards Balance card** (`components/RewardsBalanceCard.js`)
- Rendered above the fold on `/retailer/b2b` — shows current balance, next-multiplier (100/110/125 %), streak count, days until streak reset (45-day window), and a redeemable badge once balance ≥ ₹2,500.
- Balance snapshot also added to `GET /api/retailers/admin/list` payload so `/admin/retailers` cards now show *"Fragrance Rewards · ₹X · redeemable"* per retailer without an extra roundtrip.

**4. Distance-based shipping input on B2B cart** (`components/PincodeShippingInput.js`)
- 6-digit pincode input → `GET /api/shipping/check-pincode` auto-fills City + State (**both read-only** — user cannot override the auto-fetched values). Uses Shiprocket serviceability first, falls back to an **offline India-Post 2-digit → state mapping** (`services/pincode_lookup.py`) so state auto-fills even when Shiprocket creds aren't set yet.
- Once pincode is 6 digits, calls `POST /api/retailer-dashboard/b2b/shipping-quote` and surfaces courier + ETD + rate inline. The quote is forwarded to the calculate/place-order endpoints so shipping rolls into `grand_total`.
- Titlecase applied to city/state via existing `formHelpers.titleCase`.

**5. Nightly low-stock digest** (`services/b2b_low_stock.py`)
- Scheduler task fires 60s after boot + every 24h. Scans every active b2b_product with `stock_pieces < pack_size` and emails Addrika ops a table (product · category · stock · status · ETA · admin note). Throttled to once per 20h; forced-send via `POST /api/admin/b2b/inventory/low-stock/send-digest`. Admin inventory page has a "Send Low-Stock Digest" button.

**6. Admin retailers list — rewards column**
- Every retailer card now shows a Fragrance Rewards row with balance, streak-hint tooltip, and a "redeemable" pill once ≥ ₹2,500 available. Zero extra queries per row (batched inside the existing `/admin/list` handler).

**7. Regression**
- 23 new tests in `tests/test_b2b_category_stock.py` (category pack sizes, stock display messaging, offline PIN → state map, low-stock scan, status setter/audit).
- Combined **64/64 pass** across new + prior B2B + rewards + iter63 + email layout suites.

### 🆕 Feb 2026 (later) — B2B Shipping · Carton Math · Inventory Adjust · Order PDF (P0 batch)

**1. Shiprocket distance-based B2B shipping** (`services/b2b_shipping.py`)
- New `get_b2b_shipping_quote(delivery_pincode, items)` computes cart weight from carton math (grams-per-piece × pieces × 1.15 packaging overhead, floor 0.5kg) then calls Shiprocket serviceability. Cheapest courier's rate = `shipping_charges`.
- Graceful fallback: if Shiprocket errors or is unconfigured, returns a transparent linear estimate (₹120 base + ₹25/kg) with `fallback: true` and `courier_name: "Standard (Fallback)"` so checkout NEVER breaks.
- Credentials are read via `admin_integrations.get_effective("shiprocket_email"/"shiprocket_password"/"shiprocket_pickup_pin")` — DB overrides env vars, so admins can rotate keys without a redeploy (see `services/shiprocket_service.py::_resolve_credentials`).
- New endpoint `POST /api/retailer-dashboard/b2b/shipping-quote {delivery_pincode, items, cod?}` for the B2B cart to preview the rate. `POST /api/retailer-dashboard/b2b/calculate` now accepts `delivery_pincode` + `include_shipping` and rolls the shipping into `grand_total`.
- The calc response also carries `rewards_projection: {will_earn_inr, multiplier_pct, streak_after}` so the retailer UI can show "You'll earn ₹X in Fragrance Rewards" alongside shipping.

**2. Carton Math (1 carton = 32 pieces)** (`services/b2b_catalog.py`, `services/b2b_inventory.py`)
- New `pieces_per_carton` field on `b2b_products` (default 32). Existing legacy `units_per_box` still works — `pieces_for_quantity(product, qty_boxes)` prefers `pieces_per_carton` and falls back to `units_per_box`.
- `_enrich_carton_fields(product)` backfills `price_per_carton`, `price_per_half_carton`, `price_per_piece`, `mrp_per_piece` on the fly so the B2B catalog response carries BOTH the legacy per-box view AND the new per-carton view (user's "Both toggle" preference).
- Half-carton always allowed (16 pcs, no minimum) per user's spec.

**3. B2B Inventory Quick-Adjust** (`services/b2b_inventory.py`, `routers/admin/admin_b2b_inventory.py`)
- Piece-level stock on `b2b_products.stock_pieces`. Every adjustment writes an audit row to `b2b_inventory_log` (`before → after`, reason, admin email, optional note).
- Reasons whitelist: `restock`, `damage`, `return`, `offline_sale`, `correction`, `manual_adjust`.
- Auto-deduct on successful Razorpay payment via `deduct_for_paid_order(db, order)` — idempotent via a per-`(order_id, product_id)` guard so re-verifying a payment never double-deducts. Wired into `POST /api/retailer-dashboard/b2b/order/{order_id}/verify-payment`.
- New admin endpoints: `GET /api/admin/b2b/inventory`, `GET /api/admin/b2b/inventory/{id}`, `POST /api/admin/b2b/inventory/{id}/adjust`, `GET /api/admin/b2b/inventory/{id}/log`.
- New admin page `/admin/b2b/inventory` with per-product row + Adjust modal (Add / Deduct) + History modal. `data-testid`s wired for testing.

**4. B2B Order PDF regeneration + admin-notification attachment**
- `services/b2b_emails.py::send_b2b_admin_notification_email` now auto-attaches the reportlab-generated tax invoice PDF to the admin notification email (contact.us@centraders.com). Silent no-op if PDF build fails so notification email always ships.
- New endpoint `POST /api/admin/b2b/orders/{order_id}/email-to-admin` regenerates the PDF and emails it to the ops inbox on demand.
- Existing retailer-facing PDF endpoint (`GET /api/admin/b2b/orders/{id}/invoice.pdf`, `GET /api/retailer-dashboard/b2b/orders/{id}/invoice.pdf`) unchanged — includes GST + Name + Address + Contact per user's spec.
- Admin retailer detail page (`/admin/b2b/retailers/[id]`) now has an "→ Admin" button next to the existing PDF / Email buttons for each order.

**5. Regression** — 19 new pytest tests in `tests/test_b2b_shipping_inventory.py` cover carton math, piece calculation, adjust +/-, negative-delta clamp-to-zero, deduct-idempotent, log filtering, weight parsing, fallback rate scaling, and shiprocket happy/fallback paths. **41/41 pass** (19 new + 7 fragrance rewards + 14 iteration_63 + 1 email layout).

### 🆕 Feb 2026 — Landing page journal strip + broken admin retailers list URL

**1. "From the Journal" section on the home page**
- Auto-blog was generating posts but the landing page never surfaced them, so returning visitors saw no fresh content. Added `components/LatestBlogSection.js` (server component, 5-min ISR) between CSR + Instagram sections in `app/page.js`. Renders the 3 most-recent `/api/blog/posts` as gold-accent cards on a dark gradient panel with a "View all articles →" CTA to `/blog`. Missing cover images fall back to a monogram-A tile so nothing looks broken.
- data-testids: `home-latest-blog`, `home-blog-view-all`, `home-blog-card-{slug}`.

**2. Admin `/admin/retailers` panel showing "No retailers found" (even though M.G. Shoppie + Mela Stores exist in DB)**
- Root cause: `app/admin/retailers/page.js` called `GET /api/admin/retailers` and `PATCH /api/admin/retailers/{id}/status` — **both 404** on the backend. The actual endpoints are `GET /api/retailers/admin/list` and `PUT /api/retailers/admin/{id}` (accepts `{status}` in body via `RetailerUpdateRequest`).
- Fix: repointed both calls in `app/admin/retailers/page.js` + one call in `app/admin/retailer-activity/page.js`. Also expanded the search filter to look at `business_name`, `trade_name`, `spoc.name`, `gst_number` (the real field names) instead of `store_name` / `owner_name`. Buttons now pass `retailer_id || id` so the PUT hits the right document.
- Verified: `/api/retailers/admin/list` now returns 401 (auth-required, path exists) instead of 404 on both preview and production. Both M.G. Shoppie + Mela Stores are in the prod retailers collection with `status=active, is_verified=true, kyc_grandfathered_at` — they'll render as soon as this deploys.

### 🆕 Feb 2026 — Fix: GST verification silently failing for new prospective retailers
- **Root cause**: `RetailerPartnershipModal.js` (line 250) and `app/retailer/login/page.js` (line 162) both did `e.target.value.toUpperCase().slice(0, 15)` in their onChange handlers. When a prospective retailer pasted a GSTIN with a leading space, non-breaking space, tab, or hyphen (extremely common when copying from PDF invoices, registration certificates, or emails), the paste ended up as e.g. ` 27AAACR5055K1Z` — 15 chars but with a leading space, missing the last real character. The regex silently rejected it, no API call was fired, and the user saw a filled input with **no feedback at all**.
- **Fix** (`lib/formHelpers.js`): new shared `normalizeGstInput(raw)` helper strips **every non-alphanumeric character** (spaces, hyphens, tabs, dots, NBSP) before upper-casing + slicing to 15. Both onChange handlers now use it. Added a clear red "That doesn't look like a valid GSTIN. Expected 15 characters e.g. 22AAAAA0000A1Z5" inline error when the user has filled 15 chars but the regex still fails — no more silent failures.
- **Verified live** on preview `/find-retailers` partnership modal: leading-space, trailing-space, hyphens, tabs, non-breaking spaces, lowercase-with-spaces, and 16-char paste all normalize to `27AAACR5055K1Z7` and successfully verify against Appyflow as *Reliance Industries Limited · Active · Navi Mumbai, Maharashtra — 400701*. Truly-invalid GSTIN now surfaces the red hint instead of hanging silent.

### 🆕 Feb 2026 — Partner-bridge nightly reconciliation cron
- ✅ **`services/partner_reconcile.py`** — adds a local `partner_sync_log` collection that records every outbound `issue` / `redeem` call (status ∈ `sent / failed / abandoned`). The scheduler loop fires once on boot (after a 60s warm-up) and then every 24h (configurable via `PARTNER_RECONCILE_INTERVAL_SECONDS`), replays every `failed` row whose `next_retry_at` has elapsed, and gives up after `MAX_ATTEMPTS=5` (5m → 30m → 2h → 6h → 24h backoff).
- ✅ **`partner_coupons.issue_amardeep_voucher` / `redeem_amardeep_coupon`** now optionally accept `db=` and write a sync-log row on every attempt. `routers/orders.py::verify_payment` passes `db` so payment-time issues + redeems are auto-tracked.
- ✅ **Admin control** — three new admin-gated endpoints:
  - `GET /api/admin/partner/sync-log?status=failed&limit=100` — list with running counts of `sent / failed / abandoned`.
  - `POST /api/admin/partner/reconcile-now` — trigger a sweep on demand.
  - `POST /api/admin/partner/sync-log/{op}/{code}/retry` — manually replay a single row (also rescues `abandoned` rows).
- ✅ **Regression**: 8 new pytest cases in `tests/test_partner_reconcile.py` (success/failure logging, exponential-backoff scheduling, abandon-threshold, sweep-due-only, future-retry-skip, re-fail-and-reschedule, issue + redeem write log rows). **24/24 partner tests pass** + 16 prior brochure/map/KYC = **40/40 batch**.
- ✅ **Optional bidirectional probe** stub left in module-doc — when Amardeep ships `GET /api/partner/coupons/list?since=…&issued_by=amardeep` we'll fetch the diff and upsert anything we don't have.

### 🆕 Feb 2026 — Cross-site coupon bridge with Amardeep Saanan (numerology)
- ✅ **HMAC-SHA256 partner bridge shipped** using shared `PARTNER_SHARED_SECRET`:
  - **Inbound** `POST /api/partner/coupons/issue` (`routers/partner.py`) — HMAC-verifies raw body against `X-Partner-Signature`, upserts incoming `AMD-GIFT-*` coupons into `discount_codes` collection with `partner_source`/`partner_redeemable_on`/`partner_applies_to_sku`/`partner_user_email` metadata so the existing admin discount UI immediately lists them. Idempotent on re-push.
  - **Outbound** `services/partner_coupons.py::issue_amardeep_voucher` — fires from the retail order `verify_payment` hook on any paid Addrika order ≥ ₹499, posts an `ADRK-GIFT-*` ₹99 voucher (15-day validity) to `{AMARDEEP_API_BASE}/api/partner/coupons/issue`. Runs via `BackgroundTasks` so a partner outage never blocks checkout.
  - **Outbound** `validate_amardeep_coupon` — intercepts any `AMD-GIFT-*` code in **both** `/api/discount-codes/validate` (public preview) and `services/order_pricing.py::validate_and_apply_coupon` (authoritative server-side checkout path). Canonical record stays on Amardeep; Addrika proxies.
  - **Outbound** `redeem_amardeep_coupon` — after a successful Addrika order that used an `AMD-GIFT-*` code, marks it redeemed on Amardeep (also via `BackgroundTasks`).
  - **Admin control**: `GET /api/admin/partner/coupons`, `POST /api/admin/partner/coupons/{code}/suspend`, `POST /api/admin/partner/coupons/{code}/reactivate`. Existing `/admin/discount-codes` list also surfaces them since they share the `discount_codes` collection.
  - **Safety**: self-pickup still blocks any coupon (including partner ones); minimum-order threshold configurable via `PARTNER_MIN_ORDER_INR` (defaults to 499).
- ✅ **Env wired** in `backend/.env`: `PARTNER_SHARED_SECRET=<redacted>`, `AMARDEEP_API_BASE=https://fragrance-rewards.preview.emergentagent.com`, `PARTNER_MIN_ORDER_INR=499`.
- ✅ **Regression**: 16 new pytest cases in `tests/test_partner_coupons.py` covering HMAC helpers, signature rejection paths, persistence idempotency, remote validate happy / 404 / network-failure paths, `validate_and_apply_coupon` delegation, self-pickup short-circuit, and ≥₹499 threshold gating. **All 16 pass** + 25 prior regression = **41/41**.

### Feb 1, 2026 (later) — Floating Retailer CTA · Brochure messaging cleanup + redesign
- ✅ **Site-wide "Become a Retailer" floating CTA** (`components/RetailerFloatingCTA.js`) — bottom-left pill (gold ring + dark pill, opposite the WhatsApp button), shows on every public page **except** `/find-retailers`, `/admin/**`, `/retailer/**`, `/cart`, `/checkout`. Click → popover with two actions: "Become a Retailer" (opens `RetailerPartnershipModal` GST-first wizard) and "Download Brochure (PDF)" (hits `/api/brochure/download` with toast feedback). Mounted in `app/layout.js`.
- ✅ **Brochure messaging cleansed** — removed all banned phrases: `100% natural`, `100% organic`, `halmaddi`, `essential oils`, `Hand-Crafted`, `Hand-Rolled`. Replaced with brand-approved language: `Ethical Sourcing`, `60%+ less smoke`, `Zero Charcoal`, `Crafted in Delhi`. Pills updated to `ZERO CHARCOAL · 60%+ LESS SMOKE · SMALL-BATCH · ETHICAL SOURCING · PAN-INDIA SHIPPING`. Front-cover top tag now reads `PREMIUM CHARCOAL-FREE INCENSE`.
- ✅ **Brochure redesigned for elegance** (`services/brochure_pdf.py`):
  - Decorative gold L-shaped corner ornaments on every panel (`_draw_corner_ornaments`).
  - New `_draw_ornate_divider` — gold line + flanking diamonds + center diamond accent.
  - Brand monogram glyph (ringed `A`) as an accent on the front cover and a giant 6%-opacity watermark behind the front-cover text.
  - Diagonal gold pin-stripe watermark on the back-cover panel.
  - Product cards now have a soft drop-shadow, a gold left-edge accent bar, gold border on the thumbnail, and a tiny gold underline beneath each product name.
  - Subtle gold underline accents under each contact label on the back cover.
  - "ADDRIKA · COLLECTION" eyebrow tag added above each inside-panel header.
- ✅ **New regression test** `test_brochure_no_banned_messaging` (uses `pdfminer.six`) extracts the PDF text and asserts banned phrases are absent + brand-approved phrases are present. **3/3 brochure tests pass.**

### Feb 1, 2026 — Plan B India boundary overlay (Mappls 24h provisioning workaround)
- ✅ **Survey-of-India compliant national boundary overlay** rendered on `/find-retailers` while Mappls is provisioning. Source: DataMeet `india-composite.geojson` simplified with shapely (tolerance=0.02°) → 106 KB asset bundled at `/public/india-boundary.geojson`. Rendered via Leaflet `L.geoJSON` as a dark halo (#1a1a2e, weight 4.5, opacity 0.55) + gold dashed accent (#D4AF37, weight 2, dashArray 6,4). Map now shows full India outline including PoK, Aksai Chin, Ladakh, Arunachal Pradesh on top of OSM tiles. Tile-source badge updated to "OSM · INDIA BORDER" with explanatory tooltip. Will continue to work when Mappls flips on (geojson layer just sits on top of Mappls tiles).
- 🔁 **Mappls integration kept wired** — when the 24h provisioning + CORS toggle completes, `NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY` will activate and the tile-source badge will flip to "MAPPLS · INDIA". GeoJSON overlay is harmless either way.

### 🆕 Apr 28-May 1, 2026 — Shipped
- ✅ **Production grandfather migration prepped (May 1, 2026)** — one-tap playbook at `/api/docs/grandfather-migration` (HTML) and `.txt`. One-liner: paste `fetch('/api/admin/b2b/retailers/bulk-grandfather-kyc', {method:'POST', credentials:'include'}).then(r=>r.json()).then(console.log)` in DevTools Console while logged into `centraders.com/admin` → all existing retailers get `gst_verified/pan_verified/aadhaar_verified = true` + `kyc_grandfathered_at` stamp. Idempotent.
- ✅ **Mappls static-key probe corrected (May 1, 2026)** — fixed the probe URL to use static-key path-style (`/advancedmaps/v1/{key}/geo_code`) instead of the OAuth Bearer Atlas endpoint. Probe now correctly reports `auth_error` (HTTP 412 — key valid, Allocations + Whitelisting tabs not yet configured in Mappls console) with precise next-step instructions rendered on the admin Balances card. No OAuth Client ID/Secret needed — earlier assumption was wrong.
- ✅ **Docs hub generalised (May 1, 2026)** — `docs.py` now serves both Mappls cheat-sheet AND Grandfather migration via a shared renderer. Both at `/api/docs/<slug>` and `/api/docs/<slug>.txt` with cross-linking between them.
- ✅ **Admin "Provider Balances" panel** — `/admin/settings/balances` with live probes + 30d rollup.
- ✅ **Pre-order KYC nudge upgrade** — sticky banner with progress chips.
- ✅ **B2B eKYC gate turned ON**.
- ✅ **Grandfathered 3 retailers in preview DB + cleaned Reliance dupes**.
- ✅ **AppyFlow recharge confirmed**.
- ✅ **"Hand-rolled" purged domain-wide**.
- ✅ **Brochure**: product count + grouping + ₹ + address + Noto Sans.
- ✅ **GST modal contrast fix**.
- ✅ **India-map focus, Leaflet pins, Smoke Signal subscribe**.

### 🟢 P0 — Complete
*(B2B portal, retailer self-onboarding, KYC live, order gate ON, recovery email, admin catalog UI, CSV bulk import, archive filter, GDPR cookie variant, gtag.js direct injection, GST-first 2-step waitlist with anti-spoofing, auto-blog Gemini 2.5 Flash + Pollinations + Resend blast — all shipped & tested.)*

### 🟠 P1 — User action only (no engineering)
- ⏳ **AppyFlow API top-up** — account is out of credits ("Credit Expire."). Live GST autofill/anti-spoofing on `/find-retailers` will resume once you recharge AppyFlow.
- ⏳ **Replace placeholder images** for Bilvapatra Fragrance Agarbatti, 8" Bambooless Dhoop, Royal Kewda *(awaiting your real product photos; deferred per user)*.
- ⏳ **Verify Zoho refresh-token health** quarterly — `<ZohoSyncHealthCard />` polls live.
- ✅ **KYC gate is ON** in production since Apr 26, 2026.

### 🟡 P2 — Deferred / future enhancements (per user)
- ❌ Weekly admin digest of KYC-incomplete retailers + recovery email open rates *(per user)*
- ❌ Image upload (vs URL field) in catalog editor *(per user)*
- ⏳ Migrate to a paid Sandbox API plan if monthly KYC verifications exceed free-tier (~100/mo).

### 🔵 Backlog — Deferred / future
- ❌ SMS 2FA for admin (currently email-only OTP) *(per user)*
- ✅ Wishlist test suite — 17/17 pass after Apr 26 fix (Bearer-token auth + default BASE_URL).
- ✅ GDPR-region cookie consent — region-aware banner shipped Apr 26 (browser timezone detection → stricter copy + "Reject all" CTA).

---

## 🔑 Active Integrations (Apr 26, 2026)
| Integration | Env var(s) | Status | Notes |
| --- | --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | ✅ live | retail + B2B checkout |
| Resend | `RESEND_API_KEY`, `SENDER_EMAIL` | ✅ live | order, OTP, KYC recovery |
| Appyflow GST | `APPYFLOW_API_KEY` | ✅ live | GSTN auto-fill on waitlist |
| Sandbox API KYC | `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`, `SANDBOX_API_VERSION` | ✅ live | PAN + Aadhaar OTP eKYC, free ~100/mo |
| Zoho Books | `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/REDIRECT_URI`, `admin_settings.zoho_oauth` | ✅ live | OAuth completed; org `60057247059` |
| Google Analytics 4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` *(legacy, optional)* + **direct gtag injection in `app/layout.js`** for `G-9CBN63VGCK` | ✅ live | Direct injection on every page (admin/retailer/public) per Google's setup |
| Emergent LLM Key | `EMERGENT_LLM_KEY` | ✅ live | object storage backend (bills, future uploads) |
| Invoice header (optional) | `SELLER_NAME/GSTIN/ADDRESS/STATE/EMAIL/PHONE` | optional | falls back to Centsibl Traders / Delhi |

---

## 🔑 Active Integrations (Apr 26, 2026)
| Integration | Env var(s) | Status | Notes |
| --- | --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | ✅ live | retail + B2B checkout |
| Resend | `RESEND_API_KEY`, `SENDER_EMAIL` | ✅ live | order, OTP, KYC recovery |
| Appyflow GST | `APPYFLOW_API_KEY` | ✅ live | GSTN auto-fill on waitlist |
| Sandbox API KYC | `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`, `SANDBOX_API_VERSION` | ✅ live | PAN + Aadhaar OTP eKYC, free ~100/mo |
| Zoho Books | `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/REDIRECT_URI`, `admin_settings.zoho_oauth` | ✅ live | OAuth completed; org `60057247059` |
| Google Analytics 4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ✅ live | hidden on /admin/** & /retailer/** |
| Emergent LLM Key | `EMERGENT_LLM_KEY` | ✅ live | object storage backend (bills, future uploads) |
| Invoice header (optional) | `SELLER_NAME/GSTIN/ADDRESS/STATE/EMAIL/PHONE` | optional | falls back to Centsibl Traders / Delhi |

---

## 🔴 Original Priority Snapshot (historical)
- ~~Zoho Books OAuth~~ ✅ Apr 25, 2026
- ~~AEPS India / KYC integration~~ ✅ Apr 26, 2026 (chose Sandbox API instead)
- ~~Sandbox KYC infrastructure + retailer self-KYC + order gate~~ ✅ Apr 26, 2026
- ~~B2B Catalog admin CRUD UI~~ ✅ Apr 26, 2026
- ~~KYC recovery email with rate-limited deep link~~ ✅ Apr 26, 2026
- ~~Dark-OS white-text bug on /retailer/*~~ ✅ Apr 26, 2026
- ~~GST-first waitlist form with autofill~~ ✅ Apr 26, 2026
- ~~Bills base64 → object storage migration~~ ✅ Apr 26, 2026

---

## Historical Completed Work (April 2026 iterations previously misfiled under Backlog)

### April 24, 2026 — B2B Portal Infrastructure (Hidden/Disabled by default)
- **Admin kill-switch**: `admin_settings` key `b2b_enabled` (default `false`). When off, `/api/retailer-auth/login`, `/api/retailer-auth/portal-status`, and all `/api/retailer-dashboard/b2b/*` endpoints return 403 with a "portal unavailable" message.
- **Public portal-status endpoint** `GET /api/retailer-auth/portal-status` so the retailer login page renders a "Retailer Portal Coming Soon" screen when disabled.
- **1.5% online-payment discount** (was 2%). Stored in `admin_settings.b2b_cash_discount_percent`, admin-editable. Auto-applied at Razorpay when retailer toggles "Pay Now & Save additional 1.5%" at checkout.
- **Quantity-tiered wholesale pricing** per B2B product (new collection `b2b_pricing_tiers`). Line-level discount picks highest `min_boxes` tier that applies. Returned as `tier_discount_percent`, `tier_discount_amount` per item and `tier_discount_total` in calculate response.
- **Admin order-notification email** to `contact.us@centraders.com` fired on every B2B order creation (B2B orders bypass ShipRocket — Addrika team contacts the retailer to arrange delivery).
- **Admin UI** `/admin/settings/b2b` — toggle portal, edit discount %, manage per-product quantity tiers.
- **GST gating preserved** — retailer accounts still require `is_verified`/`gst_verified` status; kill-switch is an additional global layer.
- **Tested** — iteration_60.json, 20/20 backend tests pass.

### April 24, 2026 — B2B Phase 2 (Waitlist · Loyalty · Bills · Messaging · Refactor)
- **Retailer Waitlist** captured on `/retailer/login` while portal is disabled. Public `POST /api/retailer-auth/waitlist` (deduped on email). Admin view at `/admin/b2b/waitlist` with status workflow (new → contacted → onboarded → archived).
- **Quarterly Loyalty Bonus** — admin-configurable milestones (defaults seeded: ₹10k→0.5%, ₹25k→1%, ₹50k→2%). Highest-matched milestone applied automatically on subtotal **AFTER tier discount** and **BEFORE 1.5% cash discount**. Retailer sees a progress bar + next-milestone hint on `/retailer/b2b`. Admin manages milestones at `/admin/settings/b2b/loyalty`. New endpoint `GET /api/retailer-dashboard/b2b/loyalty`.
- **Bills & Invoices** — admin uploads PDFs/images per retailer at `/admin/b2b/retailers/{id}` (Bills tab); retailer downloads at `/retailer/bills`. Base64 in Mongo, 5MB cap, allowed: PDF/PNG/JPG/WEBP. List endpoints strip `file_base64` for performance.
- **Admin↔Retailer Messaging** — threaded chat with safe attachments (5MB, same MIME whitelist). Retailer at `/retailer/admin-chat`, admin at `/admin/b2b/retailers/{id}` (Messages tab). Endpoints: `GET/POST /api/retailer-dashboard/admin-chat`, `GET /api/retailer-dashboard/admin-chat/attachment/{id}/{i}`; admin: `GET /api/admin/b2b/threads`, `GET/POST /api/admin/b2b/retailers/{id}/messages`, `GET /api/admin/b2b/messages/attachment/{id}/{i}`.
- **Per-retailer admin detail page** at `/admin/b2b/retailers/[id]` with 3 tabs: **Orders** (status + payment_status), **Bills**, **Messages**.
- **Refactor** — `B2B_PRODUCTS` extracted from `b2b_orders.py` into `services/b2b_catalog.py`; `admin_b2b_settings.py` now imports the shared module (no more cross-router coupling).
- **Tested** — iteration_61 (initial), iteration_62 (after route-collision fix). 40/40 backend tests green. Pytest regression: `tests/test_b2b_expansion.py`, `tests/test_b2b_iteration_61.py`.

### April 24, 2026 — B2B Phase 3 (Reports · UX rules · GA · Hero · GST-after-discount)
- **GST is now calculated AFTER all known-at-supply discounts** (tier → loyalty → voucher → cash) per Indian GST law. New `taxable_value` field and per-line `line_total_after_loyalty` / `taxable_value`.
- **Top 5 Retailers widget** on `/admin` dashboard — `GET /api/admin/b2b/reports/top-retailers` (period=quarter|fy). Highlights retailers within 10% of their next loyalty tier so admin can nudge them.
- **Sales Reports** at `/admin/b2b/reports` — `GET /api/admin/b2b/reports/sales` with `period=quarter|fy|custom`, `group_by=retailer|quarter|month`, plus combined totals and CSV export. Indian FY (Apr 1 → Mar 31).
- **Waitlist UX rules** — GST now mandatory + format-validated, best-effort auto-verify (non-blocking), country-code dropdown (defaults `+91`), WhatsApp number, **server-side title-case** for names/city, lowercase email. Stores `whatsapp_full = country_code + phone`. New `frontend-next/lib/formHelpers.js` — `titleCase`, `lowerEmail`, `COUNTRY_CODES`, `GST_REGEX` reusable across all future forms.
- **Bills 15-month retention** — `purge_old_bills(db)` runs on backend startup; deletes `retailer_bills` older than 458 days.
- **Refactor** — `send_b2b_admin_notification_email` extracted from `b2b_orders.py` into `services/b2b_emails.py`.
- **Google Analytics + cookie consent** — `NEXT_PUBLIC_GA_MEASUREMENT_ID` placeholder; `<CookieConsentAndGA />` only loads GA after Accept and only on public paths (skips `/admin/**` and `/retailer/**`); IP anonymization on.
- **Hero smoke wisps** — `<HeroSmoke />` pure-CSS layered radial-gradient blurs drifting upward at low opacity; respects `prefers-reduced-motion`; ~3 KB, no video. Rendered behind hero text via `z-index: 0`.
- **Tested** — iteration_63.json: 55/55 backend (15 iter63 + 13 iter61 + 7 expansion + 20 killswitch). Public frontend (cookie/hero/waitlist) verified.

### April 24, 2026 — Zoho Books · Nudge · Magic-number · Coming-Soon Blast
- **Zoho Books direct integration** (single-tenant OAuth refresh-token, region `in`). Auto-creates Sales Order on B2B order placement and records Customer Payment on Razorpay verify. Discounts (loyalty + voucher + cash) split proportionally per line so Zoho's GST math matches ours. Tier discount stays inside `line_total`. Best-effort, gated behind `is_configured()` — silently no-ops if `ZOHO_REFRESH_TOKEN` / `ZOHO_ORG_ID` blank, never breaks the user-facing flow.
- **Admin Zoho controls**: `GET /api/admin/zoho/status` (health), `POST /api/admin/zoho/resync/{order_id}` (idempotent retry); per-row "Sync" button on retailer-detail Orders tab (only renders for orders not yet synced).
- **Nudge button** on Top-5 Retailers widget → opens `wa.me/{cc}{phone}?text=…` with a pre-filled INR-localized message; only shown for retailers within 10% of next milestone AND who have a phone number on file. `country_code` now in projection (no `+91` fallback).
- **Magic-number sniffing** on bill / message attachments — server-side validates first 16 bytes against PDF / PNG / JPEG / WEBP signatures AND asserts sniffed MIME == declared `file_type` (with `image/jpg` ↔ `image/jpeg` alias). Defense in depth on top of the 5MB cap and MIME whitelist.
- **Coming Soon → Available email blast**: `POST /api/admin/notify-me/{product_id}/blast` — emails every subscriber, sets `notified_at` so re-runs are idempotent. 400 if product still flagged comingSoon, 404 if unknown.
- **`.env` cleanup**: pre-existing `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` (from the old Sheets work) are reused; only `ZOHO_REFRESH_TOKEN` and `ZOHO_ORG_ID` need to be plugged in to flip the integration on.
- **Tested** — iteration_64.json: 72/72 (17 new + 55 regression). All Zoho calls covered for the no-op path so production is safe with creds blank.

### Zoho Books — to flip on
1. Visit https://api-console.zoho.in → Self Client → use the existing CLIENT_ID/SECRET in `.env`.
2. Generate a code with scope: `ZohoBooks.contacts.CREATE,ZohoBooks.contacts.UPDATE,ZohoBooks.contacts.READ,ZohoBooks.salesorders.CREATE,ZohoBooks.salesorders.READ,ZohoBooks.customerpayments.CREATE,ZohoBooks.customerpayments.READ` (offline access).
3. Exchange the code for a refresh_token (one-time).
4. Find your `organization_id` under **Settings → Organization Profile** in Zoho Books.
5. Set `ZOHO_REFRESH_TOKEN` and `ZOHO_ORG_ID` in `backend/.env`, restart backend. Done.

### April 24, 2026 (later) — GST-after-discount visibility · Object storage · Form rules · Email layout
- **Admin notification email rewritten** — explicit row-by-row breakdown: `Subtotal → bulk-tier savings (info) → Loyalty Discount → Voucher Discount → Online Payment Discount → Taxable Value → GST @ 18% (on taxable value) → Credit Note → Grand Total`. GST is now visually proven to be on the post-discount taxable value. Persisted on order doc: `subtotal_after_loyalty`, `tier_discount_total`, `taxable_value`. New regression test `tests/test_b2b_email_layout.py`.
- **Object-storage support for bills**: `services/object_storage.py` + Emergent managed bucket. Bill upload tries object storage first (≤5MB), falls back to base64-in-Mongo if not configured. Download endpoints transparently hydrate either source — fully backwards-compatible with existing legacy bills. Records carry `storage_path` (new) or `file_base64` (legacy).
- **Form rules** applied to remaining customer-facing forms (`/register`, `<NotifyMeButton>`, `/track-order`): emails lowercase-normalized; existing register form already had title-case + WhatsApp + `+91` default. Helper at `lib/formHelpers.js` is the canonical source for any future form.
- **Tested** — 18/18 (1 new email-layout test + 17 iter64 regression). Full suite: 73/73 across all 6 test files.

### April 25, 2026 — PDF Invoices · Zoho Error Alerts · 90-day Thread Auto-Archive
- **Server-side B2B GST tax invoice (PDF)** via `reportlab` — `services/b2b_invoice_pdf.py`. Splits CGST+SGST when buyer & seller share state, IGST otherwise (state derived from GSTIN prefix). Uses persisted per-line `taxable_value` so GST math always equals the on-screen / email math. New endpoints:
  - Admin: `GET /api/admin/b2b/orders/{order_id}/invoice.pdf`
  - Retailer: `GET /api/retailer-dashboard/b2b/orders/{order_id}/invoice.pdf`
  Admin invoice button rendered on `/admin/b2b/retailers/[id]` Orders tab; retailer download button on `/retailer/b2b` Orders list. Both use blob-download via `authFetch`. Optional `SELLER_*` env vars override the hard-coded Centsibl Traders fallback.
- **Zoho Books sync error log**: `services/zoho_errors.py` + `zoho_sync_errors` collection. Every B2B order create + payment verify (and admin resync) records a row + emails `contact.us@centraders.com` when Zoho returns `None` or raises. New endpoints:
  - `GET /api/admin/zoho/errors` (admin), `GET /api/admin/zoho/errors/count`, `POST /api/admin/zoho/errors/{id}/resolve`
- **Admin Zoho Errors banner**: `<ZohoErrorsBanner />` rendered above Top-5 Retailers on `/admin`. Polls every 60s, expandable list with per-row Retry (calls existing `/api/admin/zoho/resync/{order_id}`) and Resolve buttons. Dismissible per session.
- **Auto-archive admin↔retailer threads idle > 90 days**: `services/b2b_thread_archive.py`. Runs on backend startup + daily 24h loop. Flags `archived: true` on `retailer_admin_threads` (no retailer status change). Posting a new message auto-unarchives. Admin threads list (`/api/admin/b2b/threads`) hides archived by default — pass `?include_archived=true` to see them.
- **Tested** — `tests/test_b2b_invoice_zoho_archive.py` (9 new tests: PDF magic-bytes, admin & retailer endpoints, 401/404 paths, Zoho error CRUD, idle thread flagging + filter). Full B2B suite: **82/82** (53 + 9 new + 20 killswitch).
- **Bug fix surfaced during this session**: `services/b2b_emails.py` had a duplicate `if loyalty_disc > 0:` causing IndentationError → backend crash on import. Fixed.
- **Required new env vars**: none. Optional: `SELLER_*` vars to override invoice header.

### April 25, 2026 (later) — Appyflow GST Verify · P2 Pricing Refactor
- **Appyflow GST verification integrated** as primary provider. `services/gst_verification.py` rewritten as `Appyflow → gstincheck` cascade: tries `https://appyflow.in/api/verifyGST?gstNo=…&key_secret=…` first, falls back to legacy free-tier if Appyflow returns non-verified or errors. Both providers reshape to the same internal dict, so all callers (`/api/admin/retailers/{id}/verify-gst`, `/api/retailer-auth/waitlist`, etc.) keep working. Live-tested — verified `27AAACR5055K1Z7` ⇒ `Appyflow Technologies` is Active.
- **Env**: `APPYFLOW_API_KEY` added to backend `.env`. `GST_VERIFICATION_API_KEY` retained as fallback.
- **P2 refactor — pricing engine extracted**: `routers/b2b_orders.py` shrank from **881 → 621 lines** (-30%). New `services/b2b_pricing.py` owns: `calculate_line_total`, `validate_retailer_voucher`, `validate_credit_note`, and the entire `calculate_b2b_order` discount-cascade (subtotal → tier → loyalty → voucher/cash → taxable → GST → credit-note → grand_total). Router now just auth-gates and delegates; the order-create path reuses the same service so create/calculate are guaranteed identical.
- **Tested** — full B2B suite: **90/90** passing (82 prior + 8 new GST shape tests in `tests/test_gst_verification.py`). No behavior change in pricing math; refactor is pure code-locality cleanup.

### April 25, 2026 (final) — GSTIN Autofill · Email Invoice · Catalog to MongoDB · Bills Migrator
- **Waitlist GSTIN autofill (Appyflow-powered)**: typing a complete GSTIN on `/retailer/login` fires a debounced call to public endpoint `GET /api/retailer-auth/waitlist/gst-lookup/{gst_number}` and auto-prefills `Business Name`, `City` and `State` from the verified GSTN record. GST input border turns emerald on verify / amber on lookup-miss; state is always derivable from the 2-digit GSTIN prefix as a graceful fallback. New **State** field added next to City. Fixed a pre-existing waitlist bug that read the wrong shape keys (`valid`/`legal_name`) — now reads `verified`/`taxpayer_name`. **Live-tested**: `27AAACR5055K1Z7` ⇒ "Reliance Industries Limited / Navi Mumbai / Maharashtra" ✓.
- **One-click email invoice**: `POST /api/admin/b2b/orders/{order_id}/email-invoice` generates the PDF + attaches it via Resend to the retailer's account email. Sets `invoice_emailed_at` + `invoice_emailed_to` on the order doc. "Email" button added next to the "PDF" button on `/admin/b2b/retailers/[id]` Orders tab — shows ✓ once sent (with last-sent timestamp tooltip). `services/email_service.py` extended to accept `attachments=[{filename, content}]`.
- **B2B catalog → MongoDB**: new `b2b_products` collection. `services/b2b_catalog.py` exposes the same synchronous `B2B_PRODUCTS` / `find_b2b_product` API on top of an in-memory cache warmed at startup from the DB. One-time idempotent seeding happens on boot (`seed_b2b_catalog`). Admin CRUD endpoints: `GET/POST /api/admin/b2b/products`, `DELETE /api/admin/b2b/products/{id}`.
- **Bills migrator** (one-shot): `scripts/migrate_bills_to_object_storage.py` — walks `retailer_bills` with `file_base64` + no `storage_path`, decodes + uploads to Emergent object storage, unsets `file_base64`, writes `storage_path`. Idempotent + dry-run flag. Exposed via `POST /api/admin/b2b/maintenance/migrate-bills[?dry_run=true]`.
- **Tested** — `tests/test_b2b_autofill_backlog.py` adds 11 new tests (GST lookup happy/invalid/unverified, catalog CRUD, migrator dry-run, email-invoice 404/401/send). Full B2B suite: **101/101** passing.

### April 25, 2026 (later still) — One-Click Waitlist → Retailer Onboarding
- **`POST /api/admin/b2b-waitlist/{id}/onboard`** — creates the retailer record using freshly re-fetched Appyflow GSTN data (legal_name, address, city, state, pincode), generates a single-use 24h invite token, and emails a magic-link `setup-password` page via Resend. Marks the waitlist row `onboarded` + links the new `retailer_id`. Returns 409 if already onboarded.
- **`GET /api/retailer-auth/setup-password/validate/{token}`** + **`POST /api/retailer-auth/setup-password`** — public endpoints. Validation returns the welcome name + business name; setup is single-use (token + invite_expires_at unset on success), enforces 8-char minimum.
- **New page**: `/retailer/setup-password?token=…` — pre-greets the user with their business name, asks for new password + confirmation, redirects to login on success. Works with the existing portal kill-switch (login still gated).
- **Admin UI**: green "Onboard as Retailer" button on `/admin/b2b/waitlist` for any non-onboarded entry. Once onboarded, the row shows a "View RTL_…" deep-link to the retailer detail page instead.
- **Tested** — 7 new tests in `tests/test_b2b_onboarding.py` (full happy-path with Appyflow address pull, double-onboard returns 409, single-use token semantics, password length validation, unauth/404 paths). Full B2B suite: **108/108**.

### Feb, 2026 — Find-Retailers Partnership Form: GST-First + Anti-Spoofing
- **Frontend** (`/components/RetailerPartnershipModal.js`): completely rewritten as a 2-step wizard.
  - **Step 1**: prominent full-width GSTIN input. Live Appyflow lookup (debounced 400ms). Verified card shows legal name + state + city + pincode pulled from the GST registry.
  - **Step 2**: reveals once GST is verified (or user clicks "contact us directly" for non-GST businesses). Auto-fills business_name, legal_name, state, city, pincode. **Locked fields** (legal_name, state, pincode) become read-only when GST verifies — user cannot override registry data.
  - "Why GST first?" explainer card + "Not GST-registered yet?" graceful path.
- **Backend** (`/routers/b2b_waitlist.py`): adds anti-spoofing cross-checks on `POST /api/retailer-auth/waitlist`:
  - New optional `legal_name` field. When GST verifies, claimed legal name is fuzzy-matched against Appyflow's `taxpayer_name`/`trade_name` via `_names_match()` (strips suffixes like "PVT LTD", "PRIVATE LIMITED", "INDIA LIMITED", "& Sons", etc.). Mismatch → 400 with the registered name surfaced.
  - Claimed `state` (if provided) must match the GSTIN state code (first 2 digits via `INDIAN_STATE_CODES`). Mismatch → 400.
  - Claimed `pincode` (if provided) must appear in Appyflow's registered address. Mismatch → 400.
  - **Graceful degrade**: if Appyflow is offline OR credits are exhausted, all checks skip and submission is accepted with `gst_verified: false` so admin can review manually.
- **GST lookup endpoint** improved: pincode extraction now uses regex `\b\d{6}\b` on the address string (was: last comma-segment, which sometimes failed on long Appyflow addresses).
- **Tests** (`tests/test_waitlist_antispoof.py`): 15 total. 9 pure-helper tests (TestNameMatcher) cover suffix-stripping, case-insensitivity, punctuation tolerance, false-positive rejection. 6 endpoint tests auto-skip when Appyflow credits expire (currently the case — need top-up).
- **Operational note**: Appyflow returned "Credit Expire" during this session. Top up at https://appyflow.in dashboard to keep auto-verification + anti-spoofing live; until then waitlist submissions still work but go through with `gst_verified: false`.

### Feb, 2026 — Auto-Blog Email Blast on Auto-Publish
- After every auto-published post, `services/auto_blog.py::_send_blog_email_blast()` queues `send_blog_notification()` (Resend) to all rows in `db.subscribers` where `is_active=true` and `preferences.blog_posts=true`. Failures per recipient don't block others; drafts skip the blast. Result dict now includes `email_blast_sent`.
- Currently 0 active blog subscribers in production — consider adding a `<NewsletterSubscribeForm />` on `/blog` to start populating the list.

### Feb, 2026 — Auto-Blog Pipeline LIVE on FREE STACK (Gemini 2.5 Flash + Pollinations)
- **Migrated off Emergent LLM Key** (budget exhausted at $1.0). New stack: **Google Gemini 2.5 Flash** (free tier, no card) for body+FAQ+JSON-LD via direct REST with `responseSchema` for guaranteed valid JSON; **Pollinations AI** (no key, no signup) for hero + 2 inline images.
- **Randomized 2-3 posts/week cadence**: settings model replaced `cadence_days` with `cadence_min_days` / `cadence_max_days` (defaults 2.0 / 4.0). `_next_due()` picks a random offset uniformly between min/max, snaps to a random hour 09:00-21:00 IST so posts publish during waking hours.
- **Pollinations rate-limit handling**: 18s/36s staggered launches + 3-attempt retry with exponential backoff per image. Hero + at least 1 inline image lands consistently; second inline is best-effort.
- **Admin UI updated** (`/admin/content/auto-blog`): cadence presets are now ranges (`~5/week`, `2-3/week`, `Weekly`, `Bi-weekly`); "Run now" warning replaced (no cost mention); status pill shows `2-3 / week` etc.
- **Backend env**: requires `GOOGLE_AI_STUDIO_API_KEY` in `backend/.env` — **LIVE** (key plugged in). Without it, `run_one_cycle` returns `{ok:false, error:"GOOGLE_AI_STUDIO_API_KEY not configured"}` and the scheduler is a no-op.
- **Tests updated**: 14/14 in `tests/test_auto_blog.py` pass against the new architecture (image staggers monkey-patched to 0 inside the cleanup fixture).
- **Smoke verified**: real post `elevate-morning-ritual-incense-practices-harmony` created with hero image, 6 FAQs, geo:Delhi, JSON-LD BlogPosting + FAQPage. Public endpoint + image proxy both return 200.
- **Bug fix**: previous fork left `services/auto_blog.py` with both old + new code stitched together (duplicate `from __future__ import annotations` on line 579) → SyntaxError → backend crash-loop. Truncated to lines 1-577 (free-stack only).

### April 27, 2026 — Auto-Blog Pipeline (AI-generated, SEO + GEO friendly) [SUPERSEDED Feb 2026]
- **`services/auto_blog.py`** — orchestrator: Claude Sonnet 4.5 for body + FAQ + JSON-LD, Gemini Nano Banana for hero + 2 inline images, alternates topic-bank ↔ trend cycles, dedup by 90-day title window, auto-retry on 502/timeout (fails fast on budget exhaustion), markdown→HTML pipeline.
- **`services/auto_blog_topics.py`** — 30-entry topic bank + 12-month seasonal hint table (Indian festivals, monsoon, Diwali, Navratri, etc.).
- **`routers/admin/admin_auto_blog.py`** — admin endpoints: `GET/PUT /api/admin/auto-blog/settings`, `POST /api/admin/auto-blog/run-now`, `GET /api/admin/auto-blog/log`.
- **Public image proxy** at `GET /api/blog/images/{post_id}/{kind}` — serves hero/inline-1/inline-2 from Emergent object storage with 1-day cache. Path-allow-list prevents traversal.
- **Background scheduler** — asyncio task started in FastAPI startup, ticks hourly, fires `run_one_cycle` when `next_due_at` has passed. Defaults: enabled=True, cadence=3.5d (twice/week), publish_mode=auto.
- **Admin UI** at `/admin/content/auto-blog` — status cards (enabled, cadence, mode, last/next run), 4 cadence presets, publish-mode toggle, "Run now" button (with cost warning), live activity log feed with deep links.
- **Blog post page upgrades** (`/blog/[slug]`): JSON-LD `BlogPosting` with `contentLocation` for geo-tagged posts; separate JSON-LD `FAQPage` schema (GEO-optimised for Perplexity/ChatGPT/Google AI Overviews); FAQ accordion rendered from `post.faqs[]`; geo tag displayed in meta row; **`<BlogShareToolbar>`** — WhatsApp / X / Telegram / VK / Copy link / Instagram (mobile native share + desktop caption-copy fallback) / Image+caption download.
- **Admin sidebar** — new "Auto-Blog" entry under Content with Sparkles icon.
- **Tested** — 14 new pytest tests in `tests/test_auto_blog.py` covering topic bank shape, settings get/update, next-due math, picker logic, full mocked run cycle (post creation, JSON-LD, geo, FAQ, image paths, cycle counter, draft mode), JSON-LD builder. **14/14 pass.**
- **Live status (Apr 27)**: pipeline is fully wired but **Emergent Universal Key budget exhausted** (`Current cost: $1.048 / Max: $1.0`) — first real generation will succeed once balance is added (Profile → Universal Key → Add Balance, or enable auto top-up).


### April 26, 2026 — Sandbox API KYC Infrastructure (PAN + Aadhaar OTP)
- **Sandbox API integrated** at `services/kyc_sandbox.py`. Auth flow uses `x-api-key` + `x-api-secret` headers → `/authenticate` returns short-lived `access_token` (cached in-memory ~24h with 5-min refresh buffer). Token reused across PAN + Aadhaar calls.
- **Endpoints exposed** under both retailer-facing (`/api/retailer-auth/kyc/*`) and admin-facing (`/api/admin/kyc/*`) routers:
  - `GET /status` — public health check, returns `{enabled, provider}`.
  - `POST /pan/verify` — body `{pan_number, name_to_match?, waitlist_id?, retailer_id?}`; persists `pan_verified, pan_full_name, pan_status, pan_verified_at` on the linked doc.

### April 26, 2026 (final) — KYC Recovery Email + Self-Service KYC Tab
- **Automated recovery email** fires whenever a retailer hits the KYC gate at checkout. Implemented in `services/kyc_recovery_email.py` with `maybe_send_kyc_recovery_email(db, retailer, missing)`:
  - Rate-limited to **once per retailer per 24h** via the new `kyc_email_log` MongoDB collection — repeated blocked checkouts don't spam.
  - Fired **fire-and-forget** from `require_kyc_complete()` so the 403 response isn't slowed by Resend's outbound HTTP.
  - HTML email lists exactly which verifications are missing (`PAN`, `Aadhaar`, etc.) and includes a **deep link** to `/retailer/b2b#kyc`.
- **Retailer self-service KYC tab** on `/retailer/b2b`: the amber gate banner now has a "Verify now" CTA button. Clicking expands an inline `<KYCVerificationCard retailerId={…} />` so the retailer can complete PAN + Aadhaar OTP without leaving the page. The deep link in the recovery email auto-expands this section + scrolls into view (via `#kyc` URL hash + `useEffect`).
- **Tested** — 8 new pytest tests in `tests/test_kyc_recovery_email.py` covering: HTML rendering with/without name, skip when no missing items, skip when no email, first-time send + log persistence, throttle within 24h, re-send after 24h, no-op when send_email returns False. All 8 pass. Combined batch: **36 passing** (8 recovery + 11 gate/catalog + 17 sandbox).

### April 26, 2026 (eve) — KYC Gate · Admin B2B Catalog UI
- **B2B order KYC gate** added (admin-toggleable). New `b2b_kyc_required_for_orders` setting in `admin_settings` (default OFF so existing retailers aren't broken). When ON, `POST /api/retailer-dashboard/b2b/order` returns 403 `{error:"kyc_incomplete", missing:[...]}` until retailer has all of `gst_verified + pan_verified + aadhaar_verified` set on their record. Helper `require_kyc_complete(retailer)` in `routers/b2b_orders.py`. New retailer endpoint `GET /api/retailer-dashboard/b2b/kyc-gate` returns `{gate_enabled, fully_kyc_verified, missing, can_order}` so the dashboard can render an actionable banner.
- **Admin toggle UI** on `/admin/settings/b2b` — new "KYC Gate · GST + PAN + Aadhaar" section with a single Enable/Disable button. Persists via `PUT /api/admin/b2b-settings` (now accepts `kyc_required_for_orders` bool).
- **Retailer banner** on `/retailer/b2b` — amber banner shows the exact `missing: ["GST","PAN","Aadhaar"]` list when the gate is on and the retailer is incomplete. Banner is hidden once gate flipped off OR retailer fully verified.
- **Admin B2B Catalog UI** at `/admin/b2b/catalog` — new full CRUD page wired to existing `/api/admin/b2b/products` endpoints. Features: list table (SKU id, name, weight, units/box, MRP, ₹/box, ₹/half, GST%, status), Add/Edit modal with all fields including an auto-calculate "Re-calc" button that sets price at 76.52% of MRP, soft Active/Inactive toggle, delete with confirm. Linked from `/admin/b2b` via a new "B2B Catalog" nav button.
- **Tested** — 11 new pytest tests in `tests/test_kyc_gate_and_catalog.py` (full admin CRUD cycle, KYC gate toggle persistence, auth gates, validation). All 11 pass + still passing 17 KYC + 41 P1 regression = **69 passing in this batch**.

- **Sandbox API KYC activated** (live keys plugged into `backend/.env`). End-to-end smoke verified — real PAN `AAACG2115R` returns `{"verified":true, "full_name":"GE VERNOVA T&D INDIA LIMITED", "status":"VALID", "category":"Company"}`. Invalid PAN surfaces Sandbox's actual error message ("Invalid Pan pattern") instead of generic HTTP code.
- **Retailer self-KYC during onboarding**: `/retailer/setup-password?token=…` is now a 2-step wizard. After password is set, retailer is shown the embedded `<KYCVerificationCard retailerId={…} />` so they can verify their PAN + Aadhaar OTP themselves before first login. Skip option preserved (can be done later from dashboard). New `retailer_id` returned by `/setup-password/validate/{token}` so the widget knows which retailer record to persist on.
- **GST-first waitlist form** on `/retailer/login` (Coming Soon screen): GSTIN is now Step 1, full-width prominent field, autofocus + required (form-level + Pydantic-pattern validated). Step 2 (business name / contact / email / phone / city / state) is dimmed + non-interactive until a valid 15-character GSTIN is entered, then revealed with Appyflow auto-fill. Submission blocked client-side if GST missing/invalid.
- **Dark-OS white-input bug FIXED** on `/retailer/*` pages: root cause was browsers in dark-mode OS auto-styling native inputs with white text, ignoring our light theme. Fixed in `globals.css` with `color-scheme: light` on `:root` plus a defensive `input/select/textarea { color: #1a1918 }` rule (admin's `dark:text-*` classes still override correctly via `.dark` parent selector).
- **Bills object-storage migration completed**: `migrate_bills(db)` ran successfully in production — 3 legacy base64 bills moved to Emergent object storage, `file_base64` unset, `storage_path` written. Idempotent re-run shows `{moved: 3, already_in_storage: 3, failed: 0}`.
- **Sandbox error transparency**: new `_extract_error_message()` in `services/kyc_sandbox.py` pulls Sandbox's `message` / `error` field into the user-facing response on non-200, so `verified:false` carries an actionable reason rather than just `"Sandbox API error (422)"`.
- **Tested** — all 17 KYC + 41 P1 regression tests still pass (58/58). Live curl: `/kyc/status` → `{enabled:true}`, `/pan/verify` with real PAN → 200 with full_name; bad PAN → 422 with Sandbox's "Invalid Pan pattern" message.

  - `POST /aadhaar/otp` — body `{aadhaar_number}`; returns `reference_id` for the OTP flow.
  - `POST /aadhaar/verify` — body `{reference_id, otp, waitlist_id?, retailer_id?}`; persists `aadhaar_verified, aadhaar_last_4, aadhaar_name, aadhaar_dob, aadhaar_address, aadhaar_state, aadhaar_pincode, aadhaar_verified_at`.
  - Admin-only: `GET /summary/{retailer|waitlist}/{id}` — fully composed KYC status (GST + PAN + Aadhaar).
- **Graceful degrade**: `is_configured()` short-circuits when `SANDBOX_API_KEY` / `SANDBOX_API_SECRET` blank (current state). Verify endpoints return 503 "KYC service not configured"; status returns `{enabled:false}` (200) so frontend can show an amber notice.
- **Frontend widget**: reusable `<KYCVerificationCard waitlistId|retailerId admin? />` at `components/KYCVerificationCard.js`. Auto-renders amber "KYC service not yet activated" panel (with sandbox.co.in signup link) when service disabled. Embedded as a per-row chevron-toggle on `/admin/b2b/waitlist`.
- **Tested** — 17 new tests in `tests/test_kyc_sandbox.py` (graceful-degrade paths, format validation, monkey-patched happy-path & HTTP-error path for PAN + Aadhaar OTP + verify, route auth gates). Live URL curl: `/status` ⇒ 200 `{enabled:false}`, `/pan/verify` ⇒ 503, bad PAN ⇒ 422, admin status w/o auth ⇒ 401. Frontend testing-agent (iteration_65): backend 65/65 pass, KYC widget renders amber state correctly. Full B2B suite: **125/125** (17 new + 41 P1 + 67 prior).
- **To flip on**: sign up free at https://app.sandbox.co.in/signup → API Keys → set `SANDBOX_API_KEY` + `SANDBOX_API_SECRET` in `backend/.env`, restart backend. Free tier ~100 calls/month for PAN + Aadhaar.
- **Side fix**: cleaned up duplicate stale lines at bottom of `components/ZohoSyncHealthCard.js` that were causing webpack build errors. Added `data-testid="zoho-sync-health-card"` (root) and renamed Backfill testid to `zoho-backfill-button` per testing-agent feedback.

