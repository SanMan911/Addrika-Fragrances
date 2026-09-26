# Test Credentials

## Admin Account
- **Email**: contact.us@centraders.com
- **PIN**: 050499 (Note: 110078 in .env is the default, but actual PIN in DB is 050499)
- **Master Password** (for PIN recovery OTP bypass only): addrika_admin_override
- **Note**: Master password only works for PIN recovery flow, NOT for regular 2FA login

## Test User
- **Email**: test.user@example.com
- **Password**: Test@123

## Test Retailer
- **Email**: info@addrika.com
- **Password**: 12345 (not currently in DB)
- **B2B Test Retailer (auto-seeded when `SEED_TEST_B2B_RETAILER=1` is in backend/.env — VERIFIED WORKING iter86)**: test_b2b_retailer@example.com / Test@12345 (retailer_id=RTL_TEST_B2B, also accepts username=test_b2b_retailer)
  - POST /api/retailer-auth/login returns 200 with `token` in the JSON body.
  - IMPORTANT for tests: the `retailer_session` cookie is set with `secure=True`, so `requests.Session()` will NOT replay it over plain HTTP. Read `token` from the login JSON and send it manually: `headers={"Cookie": f"retailer_session={token}"}`. Bearer auth is NOT supported by /api/retailer-dashboard/* (cookie only).

## Password Recovery Testing
- **User Recovery**: Uses mobile number to send OTP to registered email
- **Admin Recovery**: Uses email to send OTP, master password works as OTP

## Notes
- For email OTP testing, if email service is not configured, OTP is displayed in the API response (DEV MODE)
- Admin 2FA is always enabled and requires OTP verification

## External API (Field Sales Manager) — added June 2026
- **API key** (all 5 scopes: stock:read, catalog:read, retailers:read, orders:write, orders:read): `arhk_C2yoApjyj2zmmGZ6bM2qC47bxiJ--9o7ElyaRtbmPqk`
- Header: `X-API-Key: <key>` against `/api/external/v1/*` (ping, stock, catalog, retailers, orders, orders/preview, orders/{id}, orders/{id}/cancel)
- Test retailer for FSM orders: retailer_id `RTL_TEST_B2B` (GSTIN 07AAAAA0000A1Z5). Only SKU with stock: `bold-bakhoor-b2b` (100 pieces = 8.33 cartons of 12).
- Razorpay keys in this environment FAIL authentication → `payment_mode: razorpay_link` orders are placed with `payment_link_url: null`; D2C checkout returns "Payment gateway error". Not a code bug — needs valid keys.

## Admin 2FA note
- POST /api/admin/login/initiate `{"email":"contact.us@centraders.com","pin":"050499"}` → returns `token_id`; the 6-digit OTP is e-mailed AND stored in Mongo collection `admin_2fa_tokens` (`{token_id, email, otp}`) — read it from the DB for automated tests (`mongosh $MONGO_URL/addrika_db --eval 'db.admin_2fa_tokens.find().sort({created_at:-1}).limit(1)'`), then POST /api/admin/login/verify-otp `{"token_id":..., "otp":...}` → sets `session_token` cookie (also returned in JSON).
- Admin UI login: /admin/login (PIN step → OTP step).
