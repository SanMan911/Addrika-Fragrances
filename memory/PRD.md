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
