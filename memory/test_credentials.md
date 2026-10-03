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

## ITER121 — IDSPay GST-to-Contact + GST-email OTP (LIVE PROD keys, wallet empty)

IDSPay is **configured with the user's live PRODUCTION keys** (`IDSPAY_ENV=prod`, `IDSPAY_API_ID=APID3760`,
`IDSPAY_API_KEY=gst-onboard-hub`). `IDSPAY_TOKEN_ID` is intentionally **blank** — it is
IP-bound, and a live probe proved the API authenticates on api_id + api_key alone.

**⚠ A REAL LOOKUP CURRENTLY FAILS** with
`422 {"status":{"code":422,"type":"error","message":"Insufficient balance in api user wallet."}}`.
The **IDSPay wallet is empty** — this is NOT a code bug. The code classifies it as an `account_issue`, so
`POST /gst-contact/fetch` returns **503 with a neutral message** and onboarding continues instead of
wrongly denying the retailer. `GET /gst-contact/config` still reports `configured: true`.

Egress IP of this preview pod (what IDSPay sees): **34.170.12.145** — ephemeral, changes on pod restart.

### Matching rule (tested)
Applicant types email + mobile → compared against the GST record:
- **BOTH mismatch → 403 DENY** (also logged to `gst_contact_denials`)
- **≥1 matches, or value is masked/absent (`indeterminate`) → OTP to the GST-registered email**
- Masked/absent GST values can **never** deny anyone.
- Mobile compares on the last 10 digits (`+91`/spaces tolerated); email is case/whitespace-insensitive.

### Mismatch audit trail
Verdict flows OTP challenge → onboarding session → retailer doc as `gst_contact_mismatch` +
`gst_contact_check {email_verdict, mobile_verdict, entered_email, entered_mobile, gst_email, gst_mobile}`.
Admin gets an alert email, and `/admin/retailers` shows panel `retailer-gst-mismatch-<id>`.

### Testing the CONFIGURED path without spending wallet balance
- **Backend**: `python /app/backend/tests/test_iter121_idspay_gst_otp.py` → **45/45**. Monkeypatches
  `httpx.AsyncClient.post`, captures the OTP by patching `services.email_service.send_email`. Covers mask
  detection, nested-status handling, the 422 wallet string-error, cache, OTP lifecycle, the deny rule and
  mismatch propagation. **Does not call IDSPay for real.**
- **Frontend**: mock the 3 endpoints with Playwright `page.route` — `/config` →
  `{"configured":true,"required":false,"ready":true}`; `/fetch` → 403 to test deny, or
  `{"status":"otp_required","challenge_id":"...","email_hint":"ow*****@realbiz.com","mismatch":true,"mobile_matches":true,"email_matches":false}`;
  `/verify-otp` → `{"verified":true,"onboarding_session":"...","mobile":"919876543210","mismatch":true}`.
- **DO NOT** call the live endpoint in a loop — it is pay-per-use once funded.

### Register page testids
`register-gst-contact-block` (now in **Step 2**, after email/phone), `register-gst-contact-send`
("Match & send code" — disabled until email AND phone are filled), `register-gst-otp-row`,
`register-gst-otp-code`, `register-gst-otp-verify`, `register-gst-email-verified`,
`register-gst-contact-denied`, `register-gst-email-unavailable`, `register-gst-mismatch-notice`.
When IDSPay is unconfigured the whole block is hidden and the SMS phone-OTP path applies as before.

### Env keys
- `IDSPAY_ENV` = `uat` | `prod` · `IDSPAY_API_ID`, `IDSPAY_API_KEY` (required) · `IDSPAY_TOKEN_ID` (optional)
- `IDSPAY_REQUIRE_GST_EMAIL_OTP` = `0` — enforcement switch; flip to `1` only after a funded real lookup
- `OTP_PEPPER` — HMAC pepper for OTP digests. **Required**; the OTP service fails closed without it.

### Registration behaviours to preserve
- `POST /api/retailer-auth/register` accepts optional `onboarding_session`; when present the server
  **overrides** the submitted email with the verified one and **skips** the SMS phone OTP.
- Session for a different GSTIN → 400. Bogus/expired session → 400. Consumable **once**.
- With no session and IDSPay unavailable, the pre-existing phone-OTP requirement still applies.

### Admin KYC column (also iter121)
`/admin/retailers` testids: `retailer-kyc-status-<id>`, `retailer-kyc-gst-<id>`, `retailer-kyc-spoc-<id>`,
`retailer-kyc-days-left-<id>`. Backed by the `kyc` block now embedded in `GET /api/retailers/admin/list`.

### KYC reminder cron (also iter121)
`POST /api/cron/kyc-reminders` with `Authorization: Bearer $WEBHOOK_CRON_SECRET` (401 without). Emails
retailers at day 7/15/29 of the 30-day window. Milestones persist in `retailers.kyc_reminders_sent`, so
reruns are idempotent — **delete that field to re-test a milestone**. Test accounts
(`is_test_account: true`) are skipped by design.

---

## ITER121d — Auto-onboard gate + mismatch queue + at-risk filter

### Auto-onboard gate (IMPORTANT when testing registration)
`POST /api/retailer-auth/register` no longer always returns `under_processing`:
- **`status=active`, `auto_onboarded=true`, `onboarding_mode=auto_idspay`** ONLY when the onboarding session's
  meta has `email=="match"` **AND** `mobile=="match"` (i.e. both contacts matched IDSPay) **AND** the email
  OTP was verified. Frontend then routes to `/retailer/dashboard`.
- **Everything else → `status=under_processing`, `auto_onboarded=false`, `onboarding_mode=manual_review`**
  with a human-readable `manual_review_reason`. Frontend routes to `/retailer/pending`.
- With IDSPay unavailable (today: empty wallet) no session can exist, so **any** email/mobile is accepted and
  the retailer waits for manual admin approval. This is intended, not a bug.

To mint a session with a chosen verdict in tests, see `tests/test_iter121_auto_onboard_gate.py::make_session`
(it issues a real challenge, overwrites `code_digest` with a known code, then verifies).
Registration calls Deepvue for GST verification, so use a **real** GSTIN such as `27AAACR5055K1Z7`.
Note `db.retailers` has a **unique index on `email`** — give each fixture a distinct address.

### Mismatch review queue
- `GET /api/retailers/admin/gst-contact-mismatches?reviewed=false|true` → `{retailers, counts:{pending,reviewed,total}}`
- `PUT /api/retailers/admin/{retailer_id}/gst-contact-review` `{reviewed: bool, note?: str}` → 400 if that
  retailer has no mismatch, 404 if unknown.
- UI `/admin/gst-mismatches`. Testids: `admin-gst-mismatches-page`, `mismatch-tab-pending` /
  `mismatch-tab-reviewed` / `mismatch-tab-all`, `mismatch-card-<id>`, `mismatch-table-<id>`,
  `mismatch-review-toggle-<id>`, `mismatch-open-<id>`, `mismatch-empty`, `mismatch-refresh`.

### At-risk KYC filter
`/admin/retailers` chip `kyc-at-risk-filter` (+ `kyc-at-risk-hint`). Matches the cron's scope exactly:
status `active`/`under_processing` **AND** KYC incomplete **AND** `days_left <= 7`. Deleted/suspended rows are
intentionally excluded — if you see DELETED accounts in this list, that is a regression.
