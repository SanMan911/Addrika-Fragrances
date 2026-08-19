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
