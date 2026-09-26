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
