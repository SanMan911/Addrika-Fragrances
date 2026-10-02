# Test Credentials

## Admin Account
- **Email**: contact.us@centraders.com
- **PIN**: 050499 (Note: 110078 in .env is the default, but actual PIN in DB is 050499)
- **Note**: The PIN-recovery master password was PERMANENTLY REMOVED in the iter108 security audit. Recovery accepts only the emailed OTP.

## Admin 2FA note
- POST /api/admin/login/initiate `{"email":"contact.us@centraders.com","pin":"050499"}` → returns `token_id`; the 6-digit OTP is e-mailed AND stored in Mongo collection `admin_2fa_tokens` (`{token_id, email, otp}`) — read it from the DB for automated tests (`mongosh $MONGO_URL/addrika_db --eval 'db.admin_2fa_tokens.find().sort({created_at:-1}).limit(1)'`), then POST /api/admin/login/verify-otp `{"token_id":..., "otp":...}` → sets `session_token` cookie (also returned in JSON).
- Admin UI login: /admin/login (PIN step → OTP step).

## Test User (D2C)
- **Email**: test.user@example.com
- **Password**: Test@123

## WEB B2B Retailer login (GSTIN + password)
- **IMPORTANT (June 2026 — GSTIN IS THE RETAILER LOGIN ID)**: web B2B retailer login uses the **GSTIN only**. Email login is REJECTED with 400. Send `{"gstin": "<GSTIN>", "password": "..."}` to `POST /api/retailer-auth/login`.
- **B2B Test Retailer** (auto-seeded when `SEED_TEST_B2B_RETAILER=1`): GSTIN **07AAAAA0000A1Z5** / **Test@12345** (retailer_id `RTL_TEST_B2B`, email test_b2b_retailer@example.com is recovery-only). Legacy username `test_b2b_retailer` is ALLOWLISTED.
  - Login lockout: 10 failed attempts per GSTIN → 429 for 15 min (collection `retailer_login_attempts`; delete the row to clear).
  - Returns 200 with `token` in the JSON body.
  - The `retailer_session` cookie is `secure=True`, so `requests.Session()` will NOT replay it over plain HTTP. Read `token` from the login JSON and send it manually: `headers={"Cookie": f"retailer_session={token}"}`. Bearer auth is NOT supported by `/api/retailer-dashboard/*` (cookie only).
- Password reset: POST /api/retailer-auth/forgot-password `{"gstin"}` → single-use 60-min link (raw token only in the email; sha256 stored in `retailer_password_resets`). Throttle 3/hour per GSTIN or IP — clear that collection to unblock tests.

---

# MOBILE APP (Aarohmm B2B) — Supabase Auth, added June 2026

**The mobile app does NOT use passwords.** Login is GSTIN → emailed 6-digit
one-time code → Supabase Auth session. See `/app/memory/MOBILE_APP_NOTES.md`.

## Mobile QA retailer
- **retailer_id**: `RTL_APP_QA`
- **GSTIN (login ID)**: `29AAAAA0000A1Z5`
- **Registered email**: `qa.aarohmm-test@centraders.com`
- Active, KYC complete, `is_test_account: true`. Created so the app flow can be
  driven without touching a real retailer's inbox.

## How to get a mobile session in automated tests (NO inbox needed)
Supabase stores the one-time token's hash in `auth.one_time_tokens`, and
`/auth/v1/verify` accepts that `token_hash` directly (it is the same value the
real email link carries). So a genuine session can be minted from the DB:

```bash
cd /app/backend && python -m scripts.mint_app_qa_session qa.aarohmm-test@centraders.com
# prints an access_token on stdout
```

**⚠️ Supabase built-in SMTP is capped at ~2 emails/hour project-wide**, so the
OTP request will often return 429. Prefer the cached refresh token, which needs
no email at all:

```bash
ANON=sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4
RT=$(cat /app/memory/.qa_refresh_token)
curl -s -X POST "https://qzzwaqwgzvrdecheunpn.supabase.co/auth/v1/token?grant_type=refresh_token" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$RT\"}"
# → save the NEW access_token AND write the NEW refresh_token back to
#   /app/memory/.qa_refresh_token (refresh tokens are single-use)
```

Then call the app API with `Authorization: Bearer <access_token>`, e.g.
`GET /api/app/v2/me`. The same token also authorises direct PostgREST reads
under RLS:
`curl "$SUPABASE_URL/rest/v1/app_products?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"`

## Mobile stock note
- Only SKU with stock in this environment: **`bold-bakhoor-b2b`** (100 pieces).
  Everything else is 0, so order tests must use that SKU.

---

## Password Recovery Testing
- **User Recovery**: Uses mobile number to send OTP to registered email
- **Admin Recovery**: Uses email to send OTP (master password removed — OTP only)

## Notes
- For email OTP testing, if email service is not configured, OTP is displayed in the API response ONLY when `ALLOW_DEV_OTP=1` (set in this preview env; must stay UNSET in production).
- Admin 2FA is always enabled and requires OTP verification.
- Resend REJECTS `@example.com` recipients, so emails to test accounts fail by design.

## External API (Field Sales Manager)
- **API key** (all 5 scopes: stock:read, catalog:read, retailers:read, orders:write, orders:read): `arhk_C2yoApjyj2zmmGZ6bM2qC47bxiJ--9o7ElyaRtbmPqk`
- Header: `X-API-Key: <key>` against `/api/external/v1/*` (ping, stock, catalog, retailers, orders, orders/preview, orders/{id}, orders/{id}/cancel)
- Keys with a non-empty `retailer_ids` are SCOPED to those retailers; empty means unrestricted. Rate limit 120 req/min per key.
- Test retailer for FSM orders: retailer_id `RTL_TEST_B2B` (GSTIN 07AAAAA0000A1Z5).
- Razorpay keys in this environment FAIL authentication → `payment_mode: razorpay_link` orders get `payment_link_url: null`; D2C checkout returns "Payment gateway error". Not a code bug — needs valid keys.

---

## ITER114 additions

### Admin App Desk
- UI: `/admin/app-support` (sidebar "Aarohmm App Desk"). Tabs: Grievances / Trade Schemes / Brochure.
- API prefix `/api/admin/app-support/` — auth via `Cookie: session_token=<token>` from the admin OTP login above.

### QA access token caching (IMPORTANT for tests)
- `tests/test_iter114_app_desk.py` and `test_iter112_mobile_app.py` cache the
  Supabase access token at **`/tmp/qa_access_token`** and it expires after **1 hour**.
- A stale token makes ~17 iter112 tests fail with `"Session expired"` / `"JWT expired"`.
  **This is NOT a product bug** — just run `rm -f /tmp/qa_access_token` and re-run;
  the suite refreshes from `/app/memory/.qa_refresh_token` automatically.

### Stock for order tests
- Order-placement tests consume REAL stock. `bold-bakhoor-b2b` is topped to **120 pieces**.
  If pricing/placement tests fail with "Only N pieces available", top up
  `b2b_products.stock_pieces` for that SKU and `POST /api/app/v2/sync`.

### ⚠️ Razorpay is LIVE in this environment
- `RAZORPAY_KEY_ID` is an **rzp_live_** key. **NEVER** call
  `POST /api/app/v2/payments/create` with a valid unpaid order and never click the
  mobile "Pay now" button — it creates a REAL payment link. Test only the
  404 / 409 / 400 guard paths.
- `RAZORPAY_WEBHOOK_SECRET` is the placeholder `your_razorpay_webhook_secret_here`;
  signature verification deliberately rejects it, so no order can be marked paid.

### Expo / EAS
- Token name `aarohmm`. Export as `EXPO_TOKEN` before any `eas-cli` command.
- Account `sanman911`, project `addrika-mobile`, projectId `f152117c-57fb-4506-a44a-7c53d1043dd3`.
- Android preview build: `cb22ba01-16e7-4d96-a49c-ec5f2f537014`.

## ITER115 — driving the mobile web preview in Playwright (no OTP email needed)
1. Mint a session: refresh with `/app/memory/.qa_refresh_token` (single-use — write the new one back).
2. Write the session JSON as `{access_token, refresh_token, expires_in, expires_at, token_type:"bearer", user}`
   into `localStorage` key **`sb-qzzwaqwgzvrdecheunpn-auth-token`** on `<host>/app-preview`, then reload.
   (Trick used: drop the JSON at `frontend-next/public/qa_session.json`, restart frontend, `fetch` it in the
   browser, set localStorage, then DELETE the file — never leave it served.)
3. Deep links reset to `/` after a hard reload — navigate by tapping the bottom tabs instead.
4. Payment screen: `pay-provider-razorpay` / `pay-provider-pinelabs` / `pay-now-btn`. Both providers are
   deliberately "Setup pending" (placeholder webhook secrets) so no real payment link can be created.

---

## ITER121 — IDSPay GST-to-Contact + GST-email OTP (keys NOT yet supplied)

IDSPay is **wired but not configured** — `backend/.env` holds `REPLACE_WITH_*` placeholders, which the code
treats exactly like "unset". `GET /api/retailer-auth/gst-contact/config` therefore returns
`{"configured": false, "required": false, "ready": false}` and `/gst-contact/fetch` returns **503**. This is
the intended state, not a bug. Nothing fabricates a verified result.

### Env keys involved
- `IDSPAY_ENV` = `uat` | `prod`
- `IDSPAY_API_ID`, `IDSPAY_API_KEY`, `IDSPAY_TOKEN_ID` — placeholders today
- `IDSPAY_REQUIRE_GST_EMAIL_OTP` = `0` (enforcement switch; flip to `1` only once a real UAT probe shows
  IDSPay returns UNMASKED emails)
- `OTP_PEPPER` — HMAC pepper for OTP digests. **Required**; the OTP service fails closed without it.

### Testing the CONFIGURED path without real keys
IDSPay has no sandbox we can reach, so simulate it:
- **Backend**: `python /app/backend/tests/test_iter121_idspay_gst_otp.py` — sets fake creds, monkeypatches
  `httpx.AsyncClient.post`, captures the OTP by patching `services.email_service.send_email`, and asserts
  32 behaviours (mask detection, nested-status handling, cache, OTP lifecycle, session single-use). All pass.
- **Frontend**: mock the 3 endpoints with Playwright `page.route`:
  `**/api/retailer-auth/gst-contact/config` → `{"configured":true,"required":true,"ready":true}`,
  `.../fetch` → `{"status":"otp_required","challenge_id":"...","email_hint":"ow*****@realbiz.com"}`,
  `.../verify-otp` → `{"verified":true,"onboarding_session":"...","mobile":"919876543210"}`.

### Register page testids (new)
`register-gst-contact-block`, `register-gst-contact-pending` (shown while keys absent),
`register-gst-contact-send`, `register-gst-otp-row`, `register-gst-otp-code`, `register-gst-otp-verify`,
`register-gst-email-verified`, `register-gst-email-unavailable`.

### Important behaviours to preserve when testing registration
- `POST /api/retailer-auth/register` accepts an optional `onboarding_session`. When present the server
  **overrides** the submitted email with the verified one and **skips** the SMS phone OTP.
- A session for a different GSTIN → 400. A bogus/expired session → 400. A session can be consumed **once**.
- With no session and IDSPay off, the pre-existing phone-OTP requirement still applies (400 without it) —
  `ALLOW_DEV_OTP=1` in this env, so `/phone/send-otp` returns the dev code in the response.

### Admin KYC column (also iter121)
`/admin/retailers` testids: `retailer-kyc-status-<id>`, `retailer-kyc-gst-<id>`, `retailer-kyc-spoc-<id>`,
`retailer-kyc-days-left-<id>`. Backed by the `kyc` block now embedded in `GET /api/retailers/admin/list`.

### KYC reminder cron (also iter121)
`POST /api/cron/kyc-reminders` with `Authorization: Bearer $WEBHOOK_CRON_SECRET` (401 without). Emails
retailers at day 7/15/29 of the 30-day window. Milestones persist in `retailers.kyc_reminders_sent`, so
reruns are idempotent — **delete that field to re-test a milestone**. Test accounts
(`is_test_account: true`) are skipped by design.
