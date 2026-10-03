# Addrika E-Commerce Platform — PRD

_Product Requirements Document — stable reference. Iteration history lives in
CHANGELOG.md; upcoming work lives in ROADMAP.md._

---

## Original Problem Statement
Build a premium B2B + B2C e-commerce platform for **Addrika** natural incense
(brand of **Centsibl Traders**). Features include a B2B product catalogue,
B2B waitlist with AppyFlow GST + Sandbox API KYC, auto-blog pipeline, map
locator, dynamic B2B PDF generation, category-specific carton math, fragrance
rewards trade-credit system, Shiprocket distance-based shipping, custom nudge
composer, pre-order capability, and dual-write Supabase mirror.

**Companion**: Expo React Native mobile app **Aaroviah** — browse + cart
builder that reads directly from Supabase and hands off checkout to the web
via one-time session-handoff nonces (Feb 2026, Iter 97).

## User Personas
1. **B2C customer** — walks in via SEO/social, browses catalogue, adds to
   cart, checks out via Razorpay. Optional Fragrance Rewards coins.
2. **B2B retailer** — waitlists via GST-verified form, admin onboards them,
   they self-KYC (PAN + Aadhaar), then unlock tiered wholesale pricing,
   loyalty milestones, retailer-only vouchers, credit-note redemption, and
   Shiprocket/pickup fulfilment.
3. **Aaroviah mobile user (B2B-only, Iter 98)** — logged-in **retailer**
   builds a B2B cart on the phone, taps "Complete Order on centraders.com →"
   and lands on `/retailer/b2b` already signed in (via 60-sec retailer
   handoff nonce) with quantities pre-filled. The mobile app uses the
   SAME `/api/retailer-auth/login` endpoint as the web. B2C flow is
   temporarily disabled in the mobile shell — code paths preserved,
   re-enable via `loginCustomer` + product filter flip.
4. **Admin** — Centraders team (Delhi). 2FA-guarded portal for products,
   orders, retailers, KYC review, RTO vouchers, auto-blog controls, Zoho
   sync health, Supabase mirror status, and support messaging.

## Tech Stack
- **Web frontend**: Next.js 14 App Router at `/app/frontend-next` — runs in
  production mode (`next start`) under supervisor; hot reload OFF.
- **Mobile**: Expo SDK 51 / React Native at `/app/mobile` (Aaroviah). EAS
  cloud build for Android APK / AAB.
- **Backend**: FastAPI at `/app/backend`, MongoDB (Motor async) as primary
  source of truth.
- **Mirror**: Supabase Postgres — dual-write via fire-and-forget async tasks
  in `services/supabase_sync.py`. Dead-letter queue with 5m→24h exponential
  backoff.
- **Payments**: Razorpay (retail + B2B), best-effort Zoho Books ledger sync.
- **Shipping**: Shiprocket (distance-based domestic).
- **Email**: Resend (order confirmation, OTP, KYC recovery, blog blasts).
- **GST/KYC**: Appyflow GST (autofill + anti-spoof), Sandbox API (PAN +
  Aadhaar OTP).
- **AI**: Google Gemini 2.5 Flash (auto-blog body via `GOOGLE_AI_STUDIO_API_KEY`)
  + Pollinations AI (blog images, keyless). Emergent LLM Key deprecated for
  blog after budget exhaustion.
- **Maps**: Mappls (MapMyIndia, Survey-of-India compliant); Leaflet+OSM fallback.
- **Object storage**: Emergent managed bucket (bills, blog images).
- **Deployment**: Vercel (web) + Render (backend) + Emergent EAS (mobile).

## Messaging Consistency Rules (CRITICAL — enforced by `scripts/brand-audit.js`)
1. **Smoke reduction**: "60%+" or "over 60% less smoke". Never 40%, 80%.
2. **Bamboo**: ONLY Dhoop is bambooless. Agarbattis have bamboo.
3. **Ingredients**: "Ethical Sourcing" — NOT "100% natural".
4. **Tree Donation**: Strictly ₹5 customer + ₹5 Addrika match.
5. **Burn Time**: Do NOT show burn time for Bakhoor products.
6. **Brand name**: NEVER hardcode "Addrika" in JSX — always via
   `lib/brand.config.js` (web) or `Constants.expoConfig.extra.brandName`
   (mobile). CI `node scripts/brand-audit.js` blocks regressions.

## Database Collections (MongoDB — primary truth)
- `users`, `admin_settings`, `admin_credentials`, `user_sessions`
- `products`, `b2b_products`, `b2b_pricing_tiers`
- `orders`, `b2b_orders`, `payment_sessions`
- `retailers`, `retailer_sessions`, `retailer_bills`, `retailer_vouchers`
- `credit_notes`, `retailer_admin_threads`, `retailer_messages`
- `discount_codes`, `carts`, `notify_me`, `subscribers`
- `blog_posts`, `blog_run_log`
- `zoho_tokens`, `zoho_sync_errors`, `kyc_email_log`, `otp_verifications`
- `auth_handoffs` — mobile→web session handoff nonces (60s TTL, Supabase-blocklisted)
- `store_pickup_otps`, `rto_vouchers`, `admin_events`
- Legacy: `sessions`, `inquiries`, `email_change_otps`, `reviews`

## Supabase Mirror Tables (secondary, read-only)
- `users_mirror`, `products_mirror` (typed, per-column)
- `collections_mirror` (generic — everything else, keyed by
  `(collection, doc_id)`; includes `orders`, `b2b_orders`, `blog_posts`, etc.)
- `sync_dead_letter` (failed writes with retry scheduling)

**Never mirrored** (`_MIRROR_BLOCKLIST`): admin_credentials, admin_2fa_tokens,
admin_recovery_tokens, admin_sessions, retailer_sessions, user_sessions,
sessions, otp_verifications, store_pickup_otps, payment_sessions, zoho_tokens,
**auth_handoffs**.

## Key API Endpoints
### Auth
- `POST /api/auth/register-with-otp` → send OTP
- `POST /api/auth/verify-otp` → confirm OTP + create user
- `POST /api/auth/login` → cookie + `session_token`
- `POST /api/auth/handoff/create` → mint 60-sec mobile→web nonce
- `POST /api/auth/handoff/consume` → nonce → session cookie
- `POST /api/auth/logout`, `GET /api/auth/me`
### Catalogue
- `GET /api/products`, `GET /api/products/:slug`
- `GET /api/app/config` (mobile bootstrap: brand + catalogue)
### Orders / Payments
- `POST /api/orders/create`, `POST /api/orders/verify-payment`
- `GET /api/orders/track/:order_number`
- `POST /api/b2b/order`, `POST /api/b2b/order/:id/verify-payment`
### Retailer / Waitlist / KYC
- `POST /api/retailer-auth/waitlist`, `GET /api/retailer-auth/waitlist/gst-lookup/:gstin`
- `POST /api/retailer-auth/login`, `POST /api/retailer-auth/setup-password`
- `POST /api/retailer-auth/kyc/pan/verify`, `POST /api/retailer-auth/kyc/aadhaar/otp`
### Admin
- `POST /api/admin/login/initiate` + `POST /api/admin/login/verify-otp` (2FA)
- `POST /api/admin/b2b-waitlist/:id/onboard`
- `GET /api/admin/zoho/status`, `POST /api/admin/zoho/resync/:order_id`
- `GET /api/admin/supabase-mirror/summary`, `POST /api/admin/supabase-mirror/backfill`
- `POST /api/admin/auto-blog/run-now`, `GET /api/admin/auto-blog/settings`
### Public
- `POST /api/notify-me`, `GET /api/blog/posts`, `GET /api/blog/posts/:slug`

## Active Integrations
| Integration | Env var(s) | Status | Notes |
| --- | --- | --- | --- |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | ✅ live | retail + B2B checkout |
| Resend | `RESEND_API_KEY`, `SENDER_EMAIL` | ✅ live | order, OTP, KYC recovery |
| Appyflow GST | `APPYFLOW_API_KEY` | ✅ live | GSTN auto-fill + anti-spoof |
| Sandbox API KYC | `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`, `SANDBOX_API_VERSION` | ✅ live | PAN + Aadhaar OTP eKYC |
| Zoho Books | `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/ORG_ID` | ✅ live | org `60057247059` |
| Shiprocket | admin_settings.shiprocket_* | ✅ live | distance-based domestic |
| GA4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` (+ direct gtag `G-9CBN63VGCK`) | ✅ live | hidden on admin/retailer paths |
| Google Gemini (blog) | `GOOGLE_AI_STUDIO_API_KEY` | ✅ live | 2.5 Flash, free tier |
| Pollinations AI | (no key) | ✅ live | blog hero + inline images |
| Mappls MapMyIndia | `NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY` | ✅ live | fallback: Leaflet+OSM |
| Emergent LLM Key | `EMERGENT_LLM_KEY` | ✅ live | object storage backend |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ live | dual-write mirror |
| Expo / EAS | (Expo secrets) | ✅ live | Android APK/AAB cloud builds |
| Invoice header | `SELLER_NAME/GSTIN/ADDRESS/STATE/EMAIL/PHONE` | optional | falls back to Centsibl Traders / Delhi |

## Brand + Mobile Architecture Rules
- **Web brand**: "Addrika" (via `BRAND.name` in `frontend-next/lib/brand.config.js`).
- **Mobile brand**: "Aaroviah" (via `Constants.expoConfig.extra.brandName`).
- **Mobile reads via Supabase anon key**; **mobile writes only via FastAPI** —
  never write directly to Supabase.
- **EAS builds** — do NOT use `.env` for Expo cloud builds; all
  `EXPO_PUBLIC_*` fallbacks are baked into `mobile/app.json` → `expo.extra`.
- **`expo-web-browser` pinned to `~13.0.3`** (SDK 51 compatibility). Do NOT
  upgrade to 57.x or Gradle builds fail.
- **Order tracking** redirects site-wide to `https://www.centraders.com/track-order`
  (parent domain, single source of truth).

## Testing Credentials
- Admin: `contact.us@centraders.com` / PIN `050499` (master override: `addrika_admin_override`)
- B2B Test Retailer: `test_b2b_retailer@example.com` / `Test@12345`

---
### Update 2026-09-21 (Iter101)
- **DONE**: Twilio SMS OTP "verify phone" step in retailer registration. Mandatory for +91 numbers, blocks Register until verified. Auto-activates real SMS when TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID are set in backend/.env (currently empty → DEV OTP fallback returns code in API response). Endpoints: `/api/retailer-auth/phone/send-otp`, `/phone/verify-otp`.
- **DONE**: Belpatra product image swapped to new uploaded jar image (B2C + B2B + live DB).
- **PENDING (user)**: paste Twilio credentials into backend/.env → restart backend to enable real SMS. Real-SMS path not yet verified.

### Update 2026-09-21 (Iter102)
- **DONE**: Mobile (Aaroviah) full retailer registration screen (GST + certificate upload + phone OTP + password) mirroring web; plus passwordless OTP login on registered number (backend verifies the number is registered before sending OTP).
- **DONE**: External machine-to-machine stock API (`/api/external/v1/stock`) secured by admin-managed API keys (generate/label/revoke/delete via /admin/api-keys; raw key shown once). Reads MongoDB source of truth; Supabase mirror carries same data.
- **DONE**: Supabase consistency — retailer register + admin status changes mirror to Supabase; OTP + api_key collections blocklisted from mirroring.
- **PENDING (user)**: paste Twilio Verify keys into backend/.env to switch OTP from DEV mode to real SMS. Mobile app needs an EAS/dev build to run the new native document-picker screen on a device.

### Update 2026-09-21 (Iter103)
- **DONE**: Live stock-change webhooks (stock.changed/low/out) fired from adjust_stock, HMAC-signed, admin-managed at /admin/stock-webhooks (register/test/pause/delete + delivery log). For Field Sales Manager etc. — real-time low-stock alerts, no polling.
- **DONE (queued)**: EAS Android preview build initiated for the updated Aaroviah app (registration + OTP login). Build URL: https://expo.dev/accounts/sanman911/projects/addrika-mobile/builds/4d504f85-3185-434e-9cd4-1ee48a49ae29
- **IMPORTANT**: Mobile app targets the Render production backend (app.json apiBaseUrl). Deploy backend (OTP/registration/webhook/external-API changes) to Render so the built app's new screens work in production.

### Update 2026-06-26 (Iter105 + Iter106)
- **DONE (iter105)**: D2C out-of-stock UI corrected on the PDP and the product grid. Root cause of the earlier false failures: the web app runs as a PRODUCTION `next start` build with NO hot reload (see `memory/ENV_NOTES.md`).
- **DONE (iter106)**: Retailer onboarding walkthrough (`/retailer/onboarding`, animated 60s, public), "Only X left" low-stock nudge (≤12 pieces), approval-gated Notify-Me restock alerts (`/admin/notify-me`), blog newsletter capture verified.
- **DONE (iter106)**: **GSTIN is now the retailer username for ALL B2B accounts.** Email no longer logs a retailer in — it is recovery/comms only. Duplicate GSTIN registration is hard-blocked; accounts with no GSTIN were deactivated; `RTL_TEST_B2B`'s legacy username stays allowlisted. Login has a 10-fail / 15-minute lockout per GSTIN.
- **OPEN**: Retailer self-serve password reset (recovery is currently a manual email to contact.us@centraders.com), Vercel redeploy (code verified deploy-ready — `yarn build` + `yarn ci` clean — NOT deployed on purpose), Twilio Verify still in DEV mode pending real credentials.

### Update 2026-06-26 (Iter107)
- **DONE**: Retailer self-serve password reset (GSTIN → emailed single-use 60-min link, 3/hour throttle, revokes all sessions). Pages: `/retailer/forgot-password`, `/retailer/reset-password`.
- **DONE**: 60-second walkthrough auto-opens once on a retailer's first dashboard visit (dismissible modal, replayable from the sidebar).
- **DONE**: Admin-gated "your GSTIN is now your login ID" notice at `/admin/notices` with preview, recipient count and per-retailer sent stamp. **4 live retailers still PENDING — the owner clicks Send.**
- **DONE**: Brand rename to **Aarohmm** across all user-visible web/mobile/email/PDF copy; internal identifiers (DB name, storage keys, secrets, Expo slug, deep-link scheme, `/why-choose-addrika` redirect) intentionally unchanged.
- **OPEN**: send the login-ID notice; Vercel redeploy (code is deploy-ready, not deployed); Twilio Verify still DEV-mode.

### Update 2026-06-26 (Iter108 — security)
- **DONE**: All 5 security-audit findings remediated and verified (unauthenticated pickup completion + hard-coded master password, public retailer PII/GSTIN leak, admin PIN-recovery backdoor, fail-closed JWT/PIN secrets, external-API scoping + rate limits + webhook SSRF). Dev-OTP echo now gated behind `ALLOW_DEV_OTP` (must remain UNSET in production). Retailer password policy + strength meter added.
- **DONE**: GSTIN login-ID notice emailed to the 2 real retailers; mobile app.json bumped to 0.2.0 / versionCode 2 for the Aarohmm store rename build.
- **OPEN (P1)**: run `eas build` for the renamed app; **OPEN (P2)**: WhatsApp/Instagram restock broadcast (needs API credentials); Twilio Verify still DEV-mode.

### Update 2026-06-27 (Iter109 — Render deploy blocker)
- **DONE**: Removed `emergentintegrations==0.1.0` from `backend/requirements.txt` (private-CDN-only package that broke Render's `pip install`). Removed `PIP_EXTRA_INDEX_URL` from `render.yaml`. **All 150 remaining pins verified resolvable from public PyPI.** No functional replacement required — nothing imported the SDK; `services/object_storage.py` already uses plain `requests` + `EMERGENT_LLM_KEY` and was verified working (put/get round trip).
- **DONE**: Deleted stale `backend/tests/test_store_pickup_hybrid_verification.py` (iter108 action item) so CI stays green.
- **Regression**: 23/23 iter108 security tests, GSTIN login, FSM external API all green (`/app/test_reports/iteration_109.json`).
- **OPEN (user action)**: push to GitHub via "Save to Github", then redeploy on Render; `eas build` for the renamed Aarohmm app; WhatsApp/Instagram restock broadcast (needs paid API creds); Twilio Verify still DEV-mode.

### Update 2026-06-27 (Iter110 — waitlist pseudo-onboard fix)
- **DONE**: B2B waitlist signup (`POST /api/retailer-auth/waitlist`) now persists `email_notifications {admin, applicant, error}` + `email_notifications_at` on every waitlist document — a failed/misconfigured Resend can no longer silently masquerade as a sent admin notification. Admin waitlist list surfaces it automatically. Tests: `/app/test_reports/iteration_110.json` (9/9).
- **OPEN (user action)**: push to GitHub + redeploy Render (fix only takes effect in production after redeploy); verify Render env has RESEND_API_KEY, ADMIN_EMAIL, SENDER_EMAIL. Still pending from before: EAS build, WhatsApp/Instagram restock broadcast, Twilio production keys.

### Update 2026-06-27 (Iter111 — watchfiles Render blocker)
- **DONE**: `backend/requirements.txt` watchfiles 1.1.1 → **1.0.5** (stable, requires_python >=3.9, prebuilt cp311 wheel verified). Nothing imports watchfiles directly; uvicorn hot reload confirmed working. Full requirements scan found no other Py3.11 blockers. Tests: `/app/test_reports/iteration_111.json` (32 passed / 0 failed).
- **OPEN (user action)**: push to GitHub + redeploy Render. If build still fails, verify the Render service honours render.yaml's pinned Python 3.11.6 (a manually-created service may ignore the blueprint). Still pending: EAS build, WhatsApp/Instagram broadcast, Twilio production keys, iter110 waitlist fix verification in production.

### Update 2026-06-27 (Iter112 — MOBILE APP PIVOT: Supabase auth + read model)
- **USER DIRECTIVE**: work stream is now the MOBILE APP until stated otherwise. Revert bookmark for the start of this branch: commit `d7a4e0c` (see `/app/memory/MOBILE_PIVOT_BOOKMARK.md`).
- **Architecture decision** (agent's call, per user "you decide"): Supabase Auth (email OTP keyed on GSTIN, **no passwords**) + Supabase Postgres as the app's READ layer under RLS + Supabase Storage for grievance photos; **order placement & pricing stay on FastAPI/MongoDB** so tier pricing, carton math, stock reservation and payments remain server-authoritative. Export-friendly: nothing is Emergent-specific.
- **DONE**: 7 RLS-guarded `app_*` tables + helpers (`app_current_retailer_id`, `app_fy`, `app_gstin_lookup`) + private storage bucket; Mongo→Supabase sync (`services/supabase_app_sync.py`, 10-min loop + on-order push); `/api/app/v2/*` router with JWKS-verified Supabase JWTs; full Expo app rebuilt (Stock / Order Pad / Orders with FY filter / More, plus grievance-with-photos, contact-admin, schemes, brochure).
- **DONE**: temporary web preview of the app at `<host>/app-preview`.
- **Tests**: `/app/test_reports/iteration_112.json` — 32/32 backend incl. adversarial RLS isolation, price tampering, path traversal, storage RLS, KYC gate, FY boundary, idempotency. 5 bugs found & fixed (see MOBILE_APP_NOTES.md).
- **BLOCKER (user action)**: Supabase built-in SMTP is ~2 emails/hour project-wide → configure Resend as custom SMTP before real retailers can log in.
- **OPEN**: in-app payments not wired (orders placed on credit terms); `app_schemes`/`app_brochures` empty (need admin CRUD); EAS preview APK needs the user's Expo token.

### Update 2026-06-27 (Iter114 — App Desk: brochure auto-sync, grievance threads, alerts, Razorpay)
- **DONE — Brochure auto-sync**: `app_brochure_items` rebuilt every 15 min + on demand from the website's own catalogue (D2C `products` image/tagline/description/notes × `b2b_products` sizes/prices). 16/16 SKUs with real images and short details; no invented copy; stale SKUs pruned.
- **DONE — Grievance two-way threads on the admin dashboard** (`/admin/app-support`, "Aarohmm App Desk"): whole conversation readable by BOTH admin and the concerned retailer, both can reply, admin-only close. RLS blocks author spoofing, posting to closed tickets, and status tampering.
- **DONE — Reply alerts**: in-app unread badge (`/api/app/v2/notifications/summary`) + email to the shop on every admin reply; "resolved" variant on close.
- **DONE — Admin Schemes CRUD** publishing straight to the app (honours `is_active` + validity windows). Closes the iter112 "schemes empty" gap.
- **DONE — Razorpay wired with placeholder keys**: Expo-friendly Payment Link, amount always server-side, webhook signature-verified and placeholder-secrets rejected. `payments/config` honestly reports `webhook_verification_ready: false`.
- **DONE — EAS Android preview build submitted** (build `cb22ba01-16e7-4d96-a49c-ec5f2f537014`).
- **Tests**: `/app/test_reports/iteration_114.json` — 31/31 new, 32/32 iter112, 23/23 iter108, 0 frontend issues.
- **OPEN (user action)**: (P0) Supabase custom SMTP via Resend — until then OTP login is capped at ~2 emails/hour project-wide. (P0) real `RAZORPAY_WEBHOOK_SECRET` before taking payments. (P1) push the backend to Render and redeploy — the APK points at Render, which is currently DOWN, so the app cannot log in until then. (P2) the external preview domain is served by a different/older deployment and cannot be updated from this pod.

### Update 2026-09-29 (Iter115 — retailer chooses the payment provider + flow verification)
- **DONE — Payment provider choice**: new mobile screen `mobile/app/pay.tsx` (Stack route `pay`, title "Payment"). Two large tappable cards — **Razorpay** (UPI/Cards/Netbanking/Wallets) and **Pine Labs** (UPI/Cards/Netbanking/EMI) — then a single "Pay ₹X with <provider>" button. Reached from the Orders list ("Pay ₹X now") and from the order-placed screen ("Pay now"). `testID`s: `pay-screen`, `pay-provider-razorpay`, `pay-provider-pinelabs`, `pay-now-btn`, `pay-notice`, `pay-later-btn`, `pay-already-paid`.
- **DONE — money safety guard**: `app_payments.can_collect()` / `pinelabs_payments.can_collect()` = configured **AND** a real webhook secret. `POST /api/app/v2/payments/create` now refuses (503, honest message) while the webhook secret is a placeholder, so the **LIVE** `rzp_live_` key in this environment can no longer mint a real payment link from the app. `payments/config` exposes `ready_for_payments` per provider; the UI shows a "Setup pending" pill and treats a missing field as not-ready (protects APKs pointed at an older backend).
- **Verified (curl + Playwright on `/app-preview`)**: `/me`, scheme auto-pricing (`Bakhoor Festive 10%` → ₹606 off on 6 boxes, grand total ₹5,726.7), order placement (`B2B-20260929-80567E`), provider selection + per-provider 503, brochure 16 SKUs with images, grievance create/list, notification summary. GSTIN OTP request reaches Supabase and returns its 429 (SMTP cap) — still the known login blocker.
- **Fixed**: order pad "Shipping" row read `shipping_charge`; the API returns `shipping_charges`.
- **Mobile version bumped to 0.4.0 / versionCode 4** — a new EAS APK is NOT built yet (needs the user's `EXPO_TOKEN`).
- **OPEN (user action)**: (P0) Supabase custom SMTP via Resend, (P0) real webhook secrets before taking money, (P1) `eas build` for 0.4.0, (P1) redeploy the backend to Render so the new guard + provider config reach installed APKs.

### Update 2026-09-29 (Iter116 — APK 0.4.0 built + Supabase→Resend SMTP live)
- **DONE — APK 0.4.0 (versionCode 4)**: EAS preview build `d740c501-a46d-4410-bfc0-4dfad5a51cd8`, download: https://expo.dev/artifacts/eas/cQAofwffpve-NFoT0r4mayOXdytwncLBuX69IVeNpgA.apk — includes the Razorpay/Pine Labs payment chooser (`pay` screen). Expo token `aarohmm` supplied by user.
- **DONE — Supabase custom SMTP via Resend (LIVE)**: configured through the Management API with the user's scoped token — host smtp.resend.com:465, user `resend`, password = Resend key, sender `Aarohmm <noreply@centraders.com>`, `rate_limit_email_sent` raised 2 → 100/hr. Verified: `POST /api/app/v2/auth/request-code` for QA GSTIN now returns `sent:true` (was the ~2/hr SMTP 429). The ~2/hour login cap is GONE.
- **DONE — token renewal reminder (user asked "remind me before 25 Sep 2027")**: platform cron `.emergent/crons.yml` → `at: 2027-09-24T09:00:00Z` → `POST /api/cron/supabase-token-reminder` (Bearer `WEBHOOK_CRON_SECRET` in backend/.env, constant-time compare, 401 on bad auth, acks immediately, emails ADMIN_EMAIL via Resend). Manually fired once as the end-to-end test.
- **NOTE — token security**: the scoped token (`sbp_fc…`, permissions auth_config_read/write + projects_read on qzzwaqwgzvrdecheunpn) was supplied in chat and is NOT stored in the repo. Reminder email explains renewal steps.
- **STILL OPEN**: redeploy backend to Render (payment guard + provider config), real RAZORPAY/PINELABS webhook secrets, reorder-in-one-tap (user: on hold).

### Update 2026-09-29 (Iter117 — Replaced Twilio with MSG91 SMS OTP architecture)
- **DONE — Architecture Pivot**: Replaced Twilio Verify with **MSG91 OTP API v5** in `services/phone_otp.py` (+ `MSG91_AUTH_KEY` in `backend/.env`). Removed Twilio dependencies and credentials.
- **Contract preserved**: `send_otp(e164)`, `verify_otp(e164, code)`, `to_e164(cc, phone)`, and `is_phone_verified(e164)` preserved with full backwards compatibility for web retailer registration (`/api/retailer-auth/phone/*`) and mobile registration.
- **Provider Status**: MSG91 Auth Key configured (`576489T9bOjdnJBm6abbb189P1`). Real delivery to Indian mobile handsets currently pending user's DLT template registration & mapping in MSG91 dashboard.
- **DEV Fallback preserved**: When `ALLOW_DEV_OTP=1` (or if MSG91 is unconfigured), local 6-digit dev codes continue to work for non-blocking QA.

### Update 2026-06 (Iter118 — Removed MSG91; wired Deepvue GST verification, pay-per-use)
- **DONE — MSG91 fully removed**: `services/phone_otp.py` rewritten to a provider-agnostic DEV OTP module (public contract `to_e164`/`send_otp`/`verify_otp`/`is_phone_verified` unchanged, routers untouched). `MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID` and the dead Twilio keys deleted from `backend/.env`; `ALLOW_DEV_OTP=1` set so QA login still works. Rationale: plain SMS OTP to Indian numbers always needs a DLT template (TRAI rule), not an MSG91 limitation.
- **DONE — Deepvue GST verification (pay-per-use wallet) wired as PRIMARY provider** in `services/gst_verification.py`. Auth: `POST https://production.deepvue.tech/v1/authorize` (multipart client_id+client_secret → 24h bearer, cached module-level). Lookup: `GET /v1/verification/gstinlite?gstin_number=` with `Authorization: Bearer` + `x-api-key: <client_secret>`. Order is now **Deepvue → Appyflow → gstincheck** (Appyflow/legacy kept as fallback).
- Keys in `backend/.env`: `DEEPVUE_CLIENT_ID`, `DEEPVUE_CLIENT_SECRET`. Pricing model chosen by user = prepaid wallet, per-check, no subscription. Used only for **one-time onboarding** GSTIN check (register flow).
- **Verified (live API + through app service)**: real GSTIN `27AAACR5055K1Z7` → provider=deepvue, verified=True, active, legal/trade name + address + state populated. Fake/invalid GSTIN → clean "not found" (400/422 treated as definitive to avoid burning a fallback call). Backend healthy (`/api/retailer-auth/portal-status` → enabled).
- **NOTE — OTP to GST-registered mobile NOT available via Deepvue's public API**: only the GST Basic registry lookup (`gstinlite`) is documented. The consent-based taxpayer-auth OTP flow (OTP sent by GSTN to the registered mobile+email) needs Deepvue to enable the "GST Taxpayer" product and share its spec. So current onboarding = GSTIN registry verification, not mobile-OTP ownership proof.

### Update 2026-06 (Iter118b — Onboarding autofill from Deepvue GSTIN lookup)
- **DONE — GSTIN autofill on the retailer register form** (`frontend-next/app/retailer/register/page.js`). Typing a valid 15-char GSTIN now auto-fills business name, city, state, **pincode, and full address** (previously only name/city/state). Verified live on desktop + mobile with `27AAACR5055K1Z7` → all fields populated, "✓ Verified" shown.
- **DONE — backend lookup upgraded** (`routers/b2b_waitlist.py` `GET /api/retailer-auth/waitlist/gst-lookup/{gstin}`): now flows through Deepvue (primary) and returns structured `city`/`district`/`pincode` from `pradr.addr` instead of fragile address-string parsing. Added **30-day per-GSTIN cache** (`db.gst_lookup_cache`) so repeated/debounced lookups don't re-bill the pay-per-use provider. `services/gst_verification.py` `_shape_deepvue`/`_shape_appyflow` now emit `pincode`/`city`/`district`.
- **CONFIRMED LIMITATION — Deepvue GST registry does NOT return the taxpayer's mobile number/email** (GSTN never exposes it; PII). So "fetch mobile from Deepvue → OTP to it" is not possible with the registry lookup. Options for mobile-OTP ownership are pending the user's decision (GST-OTP consent flow vs GST-to-Phone masked-number API vs OTP to typed number via SMS+DLT).
- Note: `next start` = production build (no hot reload); frontend changes require `yarn build` + `supervisorctl restart frontend`.

### Update 2026-06 (Iter119 — Storefront OOS fix, refund/exchange removal, register form upgrades)
- **BUG FIXED — D2C "Out of Stock" everywhere**: storefront stock is fed from an all-zero B2B inventory pool. Disabled OOS gating on the **D2C storefront only** — `FragranceGridServer.js`, `ProductActions.js` (isOutOfStock=false, maxQty=Infinity, removed per-size OOS label), `QuickViewModal.js` (removed stock cap). Items now always orderable ("produced on demand"); "Only X left" nudge still fires for genuinely positive stock. B2B app live stock untouched. Admin can still update physical stock via existing admin inventory endpoints.
- **BUG FIXED — Refund/Exchange removed sitewide**: reworded copy (includes the word "currently" to imply temporary) on `/shipping-returns`, `/terms-of-service` (§5 now "Refunds and Exchanges"), `/faq`, `/cart` (dropped "7 Day Returns"), product page trust badge ("Freshly Made · Produced on demand"), and Footer link ("Shipping Policy"). New wording: refunds/exchanges currently unavailable for hygiene/olfactory reasons; contact via details printed on every pack.
- **FEATURE — Register form (`/retailer/register`)**: GSTIN autofill now also fills pincode + address; **Business Name locked (read-only) once GST verified**; added optional **Alternate Mobile** + **Alternate Email** fields (`register-alternate-phone`/`register-alternate-email`). Backend `/api/retailer-auth/register` stores `alternate_phone`/`alternate_email`.
- **FEATURE — Trust chips**: register form now shows read-only Legal Name (green) + Trade Name (gold) chips under the verified GSTIN (`register-legal-name-chip` / `register-trade-name-chip`) so retailers instantly trust their auto-verified identity. Verified via screenshot.
- **Verified by testing_agent (iteration_115.json): 100% backend + 100% frontend, no bugs.** (Note: gst-lookup is GET, works fine — a naming nit only.)
- **Confirmed already-existing**: admin manual suspend/revoke via `PUT /api/retailers/admin/{retailer_id}` (status suspended/active + suspended_reason/suspended_at); admin doc-upload endpoints `/documents/gst-certificate` and `/documents/spoc-id` already exist.

### P0 BACKLOG (next, per user) — IDSPay onboarding overhaul (build after user provides IDSPay sandbox key)
- Fetch GST-registered **mobile + email** via IDSPay, then send an **OTP to the fetched email**; onboarding complete only on successful OTP. RISK (per integration_expert): IDSPay publicly documents only an async **bulk** GST-to-contact report and **SMS** OTP (no sync full-contact endpoint, no email-OTP, no masking guarantee) — must probe the real sandbox account before committing.
- Lock the auto-fetched **Email + Mobile** fields on the register form (once IDSPay returns them).
- **Post-login document upload**: retailer must upload GST Certificate + **Aadhaar of SPOC** after login; remind on every login with a 30-day warning; **auto-suspend after 30 days** if not uploaded (scheduled task via .emergent/crons.yml).

### Update 2026-06 (Iter119b — GST identity trust chips on register form)
- **DONE**: `/retailer/register` now renders read-only **Legal Name** (green) + **Trade Name** (gold) chips under the "✓ Verified" line once the GSTIN is verified via Deepvue (`register-gst-chips`, `register-legal-name-chip`, `register-trade-name-chip`). Builds instant trust in the auto-verified identity. Verified by screenshot (mobile).
- IDSPay onboarding overhaul remains **P0 — OPEN & WAITING** on the user's IDSPay sandbox key (see prior entry).

### Update 2026-06 (Iter120 — Dashboard trust chips, one-tap restock, KYC nudge + 30-day auto-suspension)
- **DONE — Dashboard GST trust chips**: `/retailer/dashboard` header shows read-only Legal Name (green) + Trade Name (gold) chips once status=active (`dashboard-gst-chips`). Register now stores distinct `legal_name` + `trade_name` on the retailer doc.
- **DONE — Fresh-Stock one-tap restock**: `/admin/b2b/inventory` each SKU row has a "+1 Batch" button (`restock-batch-btn-<id>`) → POST `/api/admin/b2b/inventory/{id}/adjust` {delta_pieces: pieces_per_carton, reason:'restock'}. Adds exactly one production carton so live counts stay accurate.
- **DONE — KYC nudge + 30-day auto-suspension**:
  - Backend (`retailer_auth.py`): `GET /api/retailer-auth/kyc/status`, `POST /api/retailer-auth/kyc/upload` (doc_type gst_certificate|spoc_aadhaar, PDF/JPG/PNG/WebP ≤8MB → Emergent object storage under kyc/<type>). KYC complete = GST cert + SPOC Aadhaar present. Uploading to completion self-heals a KYC suspension (kyc_suspended flag).
  - Cron (`cron_reminders.py` `_kyc_autosuspend` + `POST /api/cron/kyc-autosuspend`, bearer WEBHOOK_CRON_SECRET) — daily `0 4 * * *` in `.emergent/crons.yml` — suspends retailers created >30 days ago without both docs (revokes their sessions, sets suspended_reason). Verified: suspended the aged test retailer then restored fixture.
  - Frontend: `KycNudge` banner on the dashboard (`kyc-nudge`, `kyc-days-left`, `kyc-upload-gst_certificate`, `kyc-upload-spoc_aadhaar`) with days-left warning + upload tiles.
- **Verified by testing_agent (iteration_116.json): 100% backend + 100% frontend, no issues.** Admin manual suspend/revoke (`PUT /api/retailers/admin/{id}`) already existed.
- IDSPay onboarding overhaul remains **P0 — OPEN & ACTIVE** (awaiting IDSPay sandbox key).

### Update 2026-09-30 (Iter121 — KYC email reminders + admin KYC status column)
- **DONE — KYC email reminders (day 7/15/29)**: new `POST /api/cron/kyc-reminders` (bearer `WEBHOOK_CRON_SECRET`, acks immediately) → `_kyc_reminders()` in `routers/cron_reminders.py`. Emails retailers inside the 30-day KYC window at day-7/15/29 milestones until GST cert + SPOC Aadhaar are uploaded; branded AAROHMM email lists missing docs, days left, dashboard upload CTA. Sent milestones persisted in `kyc_reminders_sent` (idempotent across daily runs; only marked on successful Resend send → transient failures retry next day). Skips test accounts, retailers past the window (autosuspend owns those), and missing emails. Cron: daily 03:30 UTC in `.emergent/crons.yml` (30 min before the 04:00 autosuspend).
- **DONE — Admin KYC column**: `GET /api/retailers/admin/list` now embeds `kyc` (via `kyc_status_for`) per retailer; `/admin/retailers` cards show a "KYC Docs" row — GST Cert ✓/✗ + SPOC Aadhaar ✓/✗ chips and a days-left/"Window passed" indicator (red ≤7d, amber otherwise, emerald when complete). testids: `retailer-kyc-status-<id>`, `retailer-kyc-gst-<id>`, `retailer-kyc-spoc-<id>`, `retailer-kyc-days-left-<id>`.
- **FIXED — mobile overflow on /admin/retailers**: action-button row now wraps (`flex-wrap`).
- **Verified (self-test)**: cron auth 401/401/200; full send-chain simulation with aged fixture retailer (day-8 → milestone 7 fired + real email delivered, same-day rerun idempotent, day-16 → 15 fired, KYC-complete at day-29 → no more); admin list returns `kyc` for all 15 retailers; Playwright desktop+mobile screenshots show all 15 KYC rows, zero horizontal overflow.
- IDSPay onboarding overhaul remains **P0 — OPEN & ACTIVE** (awaiting IDSPay sandbox key from user).

### Update 2026-10-02 (Iter121b — IDSPay GST-to-Contact WIRED (placeholder keys) + email-OTP ownership proof)
- **Source of truth**: the user supplied IDSPay's official `ServiceDocumentation.pdf` v1.0. It documents **exactly one** endpoint —
  `POST /srv2/validation/kyb/gst-to-contacts` (UAT `https://javabackend.idspay.in/api/v1/uat`, PROD `.../prod`), credentials in the
  **JSON body** (`api_id`, `api_key`, `token_id`, `gstin`), returning `data.mobile` + `data.email`.
  **IDSPay has NO OTP endpoint** and the doc's sample response shows **masked** values (`911XXXXXXXX9`, `AjayXXXX09XX@gmail.com`).
- **Architecture consequence**: IDSPay fetches the GST-registered contact; **we** send the OTP ourselves by email via the already-live
  Resend integration. That delivers the user's original "GST Email → Email OTP" chain without inventing IDSPay endpoints.
- **NEW `services/idspay_gst_contacts.py`**: async httpx client (per-phase timeouts, 3 retries on transport errors only — never on a
  documented application error, to protect the pay-per-use wallet). Success requires HTTP 2xx **AND** nested `status.code==200` **AND**
  `status.type=='success'` (the doc proves these can disagree). Mask detection needs 2+ redaction chars or a placeholder word, so
  `max@example.com` / `xavier@foo.com` survive. 30-day per-GSTIN cache in `idspay_contact_cache`; **failures cached only 120s**.
  Unreplaced `REPLACE_WITH_*` placeholders are treated as UNSET → `not_configured`, never a fake "verified".
- **NEW `services/gst_email_otp.py`**: 6-digit `secrets` code, **never stored** — only `HMAC-SHA256(OTP_PEPPER, challenge_id:code)`.
  10-min TTL, 5 attempts, 60s resend cooldown, 5/hr per GSTIN + 20/hr per IP (counted in Mongo so limits hold across instances),
  single-use via atomic conditional update, and a 30-min `gst_onboarding_sessions` record holding the verified `(gstin, email)` pair.
  Undelivered codes invalidate their challenge.
- **NEW endpoints** (`retailer_auth.py`): `GET /api/retailer-auth/gst-contact/config` (honest readiness),
  `POST /gst-contact/fetch` (→ `otp_required` with a **server-masked** `email_hint`, or `email_unavailable` → manual verification;
  never returns the full GST email), `POST /gst-contact/verify-otp` (→ opaque `onboarding_session`).
- **Registration hardened**: `/register` takes an optional `onboarding_session`; identity is derived from the **server-side** record, so a
  client cannot skip the OTP or register a different email. GSTIN mismatch and bogus/expired sessions are rejected (400); the session is
  claimed atomically so one verification cannot register twice; a typed email is demoted to `alternate_email`. A verified GST contact also
  satisfies the phone step (no SMS/DLT needed) and auto-fills + locks the phone when IDSPay returns it unmasked.
- **Register UI**: new `register-gst-contact-block` — "Fetch & email code" → OTP row (masked hint) → green verified banner; email locked to
  the verified address, phone locked, SMS block replaced by "Verified via your GST-registered contact". Shows **"Setup pending"** while keys
  are absent so onboarding keeps working. Fixed a 390px overflow on the phone input (`min-w-0`).
- **Env placeholders** in `backend/.env`: `IDSPAY_ENV=uat`, `IDSPAY_API_ID/API_KEY/TOKEN_ID=REPLACE_WITH_*`, `OTP_PEPPER` (generated),
  and **`IDSPAY_REQUIRE_GST_EMAIL_OTP=0`** — the enforcement switch, default OFF so current onboarding is unaffected.
- **Tested (self, 32/32 + live HTTP + Playwright)**: placeholder→not_configured; UAT URL + exact body fields; 30-day cache suppresses a
  second billable call; masked email/mobile rejected; HTTP200+nested500 and HTTP500+nested200 both treated as failure; OTP issue/verify,
  raw code absent from DB, wrong-code attempt counting, replay rejection, cooldown, 5-attempt lockout, expiry, hourly cap, single-use
  session, send-failure invalidation; register tamper tests (GSTIN mismatch 400, bogus session 400, existing phone-OTP path intact);
  full register UI chain driven with mocked IDSPay → email+phone locked, zero overflow at 390px.
- **BUG FOUND & FIXED during testing**: Mongo returns **naive** datetimes, so the aware-vs-naive comparison in `verify_otp` raised
  TypeError on every verification. Fixed via an `_aware()` coercion helper. Watch for this in any new Mongo datetime comparison.
- **OPEN (user action)**: paste real IDSPay keys (UAT first) → restart backend → `config` should report `configured:true` → probe one real
  GSTIN. **If IDSPay returns unmasked emails, set `IDSPAY_REQUIRE_GST_EMAIL_OTP=1`** to make the GST-email OTP mandatory. If it returns
  masked values, the flow correctly degrades to manual verification and must stay optional.

### Update 2026-10-02 (Iter121c — LIVE IDSPay keys + entered-vs-GST-record matching + admin mismatch trail)
- **Keys wired (PRODUCTION)**: `IDSPAY_ENV=prod`, `IDSPAY_API_ID=APID3760`, `IDSPAY_API_KEY=f04ab9c6-…`. `token_id` left **blank**
  (`IDSPAY_TOKEN_ID=`) because it is IP-bound. `_credentials()` now requires only **api_id + api_key**; `token_id` is forwarded when present.
  `GET /gst-contact/config` → `{"configured": true, "environment": "prod", "ready": true}`.
- **LIVE PROBE RESULT (important)**: a real call returned
  `422 {"status":{"code":422,"type":"error","message":"Insufficient balance in api user wallet."}}`.
  ⇒ the api_id/api_key **authenticate correctly** and a blank `token_id` did **not** cause an auth error — it reached the wallet check.
  **The current blocker is an empty IDSPay wallet, not IP whitelisting.** Note the live `error` field is a **STRING** here (the PDF shows an
  object) — the parser handles both.
- **Account-issue classification**: wallet/key/whitelist/token/subscription errors set `account_issue=True` → the endpoint returns **503 with
  a neutral message** and onboarding continues. Our billing problem must never deny a genuine retailer or look like "invalid GSTIN".
- **NEW product rule — entered-vs-GST-record matching** (`idspay.compare_contacts`): the applicant now types email + mobile, which are
  compared with the GST record. Verdicts are `match` / `mismatch` / `indeterminate`.
  **Only UNMASKED values can produce a verdict** — a masked/absent value is `indeterminate` and can NEVER deny anyone.
  * **BOTH mismatch → registration DENIED (403)** and logged to `gst_contact_denials`.
  * **At least one matches (or is indeterminate) → OTP to the GST-registered email**, shown masked to the applicant.
  * Mobile compare normalizes to the last 10 digits (tolerates `+91`/spaces); email compare is case/whitespace-insensitive.
- **Mismatch audit trail**: the verdict rides the OTP challenge → onboarding session → retailer document as
  `gst_contact_mismatch` + `gst_contact_check {email_verdict, mobile_verdict, entered_email, entered_mobile, gst_email, gst_mobile}`
  (+ `gst_contact_mismatch_reviewed:false`). On completion an **admin alert email** is sent with an entered-vs-record table, and
  `/admin/retailers` renders a red **"GST contact mismatch — verified by email OTP"** panel showing exactly which field differed
  (`retailer-gst-mismatch-<id>`). Verified by screenshot: differing mobile highlighted with `≠`.
- **Register UI restructured**: the GST-contact block **moved from Step 1 into Step 2**, after the email/phone inputs (matching needs the
  typed values). CTA "Match & send code" stays disabled until both are filled. New states: `register-gst-contact-denied`,
  `register-gst-mismatch-notice`. A verified GST contact still bypasses the SMS OTP and locks the email/phone.
- **Tested (self, 45/45 + Playwright)**: both-match allowed; email-only and mobile-only mismatch allowed **and flagged**; BOTH mismatch
  **denied**; `+91`/case tolerance; masked record never denies; live 422 string-error parsed and flagged `account_issue`; mismatch metadata
  persisted through session→retailer. UI: CTA disabled until email+phone, deny banner, OTP + mismatch warning, verified banner with mismatch
  note, email locked; admin mismatch panel desktop + 390px with no overflow.
- **OPEN (user action)**: (1) **top up the IDSPay wallet** — this is the only thing blocking a real lookup. (2) `token_id` + IP whitelisting:
  the preview pod's egress IP is **34.170.12.145**, but it is **ephemeral** (changes on pod restart) and production on Render has a
  *different, also-dynamic* egress IP — so IP whitelisting is fragile for this architecture; ask IDSPay for a static/IP-independent token or
  use a fixed-IP egress proxy. (3) after a successful real lookup, decide `IDSPAY_REQUIRE_GST_EMAIL_OTP=1`.

### Update 2026-10-03 (Iter121d — auto-onboard gate, mismatch review queue, at-risk KYC filter)
- **Auto-onboard gate (replaces the blanket `under_processing`)**: a self-registered retailer is now set **`status=active`
  automatically ONLY when BOTH conditions hold** — (a) entered mobile **and** email both `match` the IDSPay GST record, **and**
  (b) the GST-email OTP was verified. Anything else → **`under_processing` (manual admin approval)**. New retailer fields:
  `auto_onboarded` (bool), `onboarding_mode` (`auto_idspay` | `manual_review`), `manual_review_reason` (human-readable).
  The register response returns `auto_onboarded` + `manual_review_reason`, and the UI routes to `/retailer/dashboard` on
  auto-approval instead of `/retailer/pending`.
- **Interim behaviour while the IDSPay wallet/IP is unresolved (explicitly requested)**: because no session can be minted when
  IDSPay is unavailable, retailers may enter **any** mobile/email and land in manual review — onboarding is never blocked by our
  account problem. Once the wallet is funded (and whitelisting sorted), the same code path auto-onboards clean matches with **no
  further changes** — it is driven purely by whether the match+OTP conditions are met.
- **Deny rule unchanged**: when IDSPay data IS available and BOTH entered values contradict the record → 403 at
  `/gst-contact/fetch` (logged to `gst_contact_denials`). Masked/absent record values stay `indeterminate` and never deny.
- **NEW — Mismatch Review Queue**: `GET /api/retailers/admin/gst-contact-mismatches?reviewed=true|false` (+ `counts`) and
  `PUT /api/retailers/admin/{retailer_id}/gst-contact-review {reviewed, note?}`. Both placed **before** `/admin/{retailer_id}` to
  avoid path shadowing. New admin page **`/admin/gst-mismatches`** ("GST Mismatches" in the sidebar, `ShieldAlert`) with
  Needs-review / Reviewed / All tabs, an entered-vs-GST-record table per retailer, and a **Mark reviewed** tick that stamps
  `gst_contact_mismatch_reviewed_at` / `_by`. Testids: `admin-gst-mismatches-page`, `mismatch-tab-{pending|reviewed|all}`,
  `mismatch-card-<id>`, `mismatch-table-<id>`, `mismatch-review-toggle-<id>`, `mismatch-empty`, `mismatch-refresh`.
- **NEW — At-risk KYC filter** on `/admin/retailers`: one-click chip `kyc-at-risk-filter` with a live count, showing only accounts
  the suspension cron will actually hit — **status active/under_processing AND KYC incomplete AND days_left ≤ 7** (window-passed
  included). Deliberately scoped to the cron's own query, so `deleted`/`suspended` accounts are excluded (caught during testing:
  the first version listed DELETED test rows).
- **Tested (self, 20/20 gate + Playwright)**: both-match+OTP → `active`/`auto_idspay`/no mismatch flag; mobile-differs →
  `under_processing`/`manual_review`/queued unreviewed with the entered-vs-record detail kept; no-IDSPay path → registers with an
  arbitrary email, `under_processing`, no false mismatch flag. UI: queue default tab shows only unreviewed, tick moves it to
  Reviewed and decrements the count, untick restores; at-risk chip filters 14 → 2 with zero deleted rows. Desktop + 390px, no overflow.
- Tests: `/app/backend/tests/test_iter121_auto_onboard_gate.py` (20/20), `/app/backend/tests/test_iter121_idspay_gst_otp.py` (45/45).

### Update 2026-06-03 (Iter122 — onboarding rebuilt: masked GST confirm → email OTP; mobile GSTIN+password; Verified Brand Partner)
**User-reported bugs, all fixed and verified (testing_agent `/app/test_reports/iteration_120.json`, backend 25/25, frontend 100%).**

- **FIXED — mobile app still said "Addrika" / "Sacred Luxury in Every Scent"**: `mobile/lib/brand.ts`
  + `app.json → extra.mobileBrandTagline` now carry **"Where Fragrance Becomes Atmosphere…"**. The
  Expo web export served at `/app-preview` was a **stale 0.1.0 build** — that was the real source of
  the visible "Addrika" strings; it has been regenerated. Zero occurrences of either string remain.
  Mobile bumped to **0.5.0 / versionCode 5** (new EAS APK NOT built yet).
- **FIXED — the app only allowed login**: `mobile/app/login.tsx` is now 4 steps —
  `gstin → password | register | code`. `POST /api/app/v2/auth/gstin-check` decides: a registered
  GSTIN asks for the password, an unregistered one shows `login-not-registered` →
  `login-register-btn` opens `WEB_URL/retailer/register` in an in-app browser.
  `POST /api/app/v2/auth/password-login` verifies the **same bcrypt password as the web** (MongoDB
  stays the only password authority), reuses the 10-fail/15-min lockout, and mints a real Supabase
  session via `services/supabase_session.py` (admin/users → admin/generate_link → /verify, keyed on
  the retailer's REAL email because `app_current_retailer_id()` resolves RLS from the JWT email).
- **FIXED — registration force-sent an SMS OTP**: the SMS block is **gone** (`register-otp-block`
  no longer exists) and `POST /api/retailer-auth/register` now **requires `onboarding_session`**
  (400 otherwise). New chain: GSTIN → Deepvue autofill → **masked GST contact shown** → one of
  *"Yes, my details are correct — send the OTP to my email"* / *"No, my mobile number has changed"*
  (reveals a **+91** select + blank 10-digit input + *"Update my mobile number & send the code to my
  registered email"*) → email OTP → details → password → certificate.
  New endpoints: `POST /gst-contact/preview` (masked only; our wallet/provider failure returns
  **200 `unavailable`**, never blames the retailer) and `POST /gst-contact/send-otp`
  (`confirm` | `update_mobile` | `fallback`). The legacy `/gst-contact/fetch` is kept for old tests.
  **Graceful fallback** (live behaviour today, empty IDSPay wallet): `register-gst-contact-fallback`
  asks for a typed email + mobile and verifies **that** email → always manual review.
  Verdicts: confirm → `email=match, mobile=match` → auto-onboard; `update_mobile` →
  `mobile=mismatch` → manual review + mismatch queue; fallback → both `indeterminate` → manual
  review with no false mismatch flag.
- **FIXED — no way to skip the GST certificate**: `register-cert-skip` ("Skip for now — I'll submit
  it later and wait for approval"). `defer_gst_certificate=true` registers with **no file**, forces
  `status=under_processing` + `gst_cert_deferred=true`, blocks auto-onboarding, and emails the admin
  with a "GST CERTIFICATE PENDING" subject. Admins can chase it:
  `POST /api/retailers/admin/{id}/signup-reminder` emails the retailer the exact list of missing
  docs (400 when nothing is outstanding) — button `signup-reminder-<id>` on `/admin/retailers`.
- **NEW — Verified Brand Partner gate**: `PUT /api/retailers/admin/{id}/brand-partner`
  `{verified, listed?, note?}` is **refused (400) unless the account is `active` AND both KYC
  documents are on file**, so the public locator can only ever list paperwork an admin has seen.
  Granting sets `brand_partner_verified` / `listed_on_locator` / `is_verified` and emails the
  retailer. Admin UI row `retailer-brand-partner-<id>` + `brand-partner-verify-<id>` /
  `brand-partner-revoke-<id>` / `retailer-cert-deferred-<id>`.
- **NEW — Where-to-buy is now dynamic**: public `GET /api/retailers/brand-partners` (no auth) lists
  only `active + brand_partner_verified + listed_on_locator`, with a **whitelisted** projection —
  store name, address, city/state/pincode, **phone** + WhatsApp, coordinates (Mappls → pincode
  fallback). GSTIN, email and KYC/legal fields are never exposed. `/find-retailers` reads this
  endpoint instead of `/api/retailers` (which stays the privacy-safe store-pickup picker).
- Tests: `/app/backend/tests/test_iter122_onboarding.py` (21/21), `test_iter123_retest.py` (4/4).
- **Known regression to the old suite**: `test_iter121_idspay_gst_otp.py`'s "register works with the
  SMS phone-OTP path and no session" case is intentionally obsolete — a session is now mandatory.

#### OPEN — needs the USER (both are environment, not code)
1. **(P1) Top up the IDSPay wallet.** The live lookup still returns
   `422 Insufficient balance in api user wallet`, so `/gst-contact/preview` answers
   `unavailable` and every registration takes the typed-email fallback into manual review. The
   moment the wallet is funded the masked-confirm + auto-onboard path activates with **no code
   change**. Egress IP (ephemeral): `34.170.12.145`.
2. **(P1) Add `SUPABASE_SERVICE_KEY` to `backend/.env`.** It is absent, so
   `password_login_ready` is `false`, `password-login` returns 503 and the app routes to the
   emailed one-time code. Supabase Dashboard → Project Settings → API → service_role / secret key.
   Password login then activates with no code change.
3. **(P1) `eas build`** for mobile 0.5.0 so installed APKs get the new branding + login.
4. **(P2)** Reorder-in-one-tap (user: on hold), WhatsApp/Instagram restock broadcast, Vercel/Render
   redeploy, real Razorpay/PineLabs webhook secrets.
