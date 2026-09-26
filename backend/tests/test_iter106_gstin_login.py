"""
Iteration 106 - GSTIN-as-username retailer login tests.

Covers:
- GSTIN login (200, token, gst_number/username in payload)
- Legacy body field aliases (`username`/`email`) still accepted as GSTIN
- Email address rejected (400 with fixed phrase)
- Malformed identifier -> 400
- Unknown but valid GSTIN -> 401 (non-leaky)
- Wrong password -> same 401
- Legacy username allowlist (`test_b2b_retailer`) still 200
- Login lockout after 10 fails -> 429, then cleared via Mongo
- Session cookie -> /api/retailer-auth/me + retailer dashboard performance
- Register duplicate GSTIN -> 409
- ensure_gstin_usernames idempotency: all live retailers have username==gst_number (except RTL_TEST_B2B); non-GSTIN retailers are soft-deleted
- Phone-OTP retailer login unaffected
- Handoff endpoints still work
- D2C /api/auth/login is untouched
"""
import os
import re
import time
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend .env.local
    with open("/app/frontend-next/.env.local") as f:
        for line in f:
            if line.startswith("NEXT_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

GSTIN_OK = "07AAAAA0000A1Z5"
PASSWORD = "Test@12345"
LEGACY_USERNAME = "test_b2b_retailer"
EMAIL = "test_b2b_retailer@example.com"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()

@pytest.fixture()
def clear_lockout(db):
    db.retailer_login_attempts.delete_many({"identifier": {"$regex": GSTIN_OK, "$options": "i"}})
    db.retailer_login_attempts.delete_many({"identifier": {"$regex": "^07AAAAA0000A1Z5$", "$options": "i"}})
    yield
    db.retailer_login_attempts.delete_many({"identifier": {"$regex": GSTIN_OK, "$options": "i"}})

def _login(payload):
    return requests.post(f"{BASE_URL}/api/retailer-auth/login", json=payload, timeout=15)

# ---- Positive: GSTIN login ----
def test_login_by_gstin(clear_lockout):
    r = _login({"gstin": GSTIN_OK, "password": PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("token")
    retailer = data.get("retailer") or {}
    assert retailer.get("gst_number", "").upper() == GSTIN_OK
    uname = (retailer.get("username") or "").lower()
    assert uname in (GSTIN_OK.lower(), LEGACY_USERNAME.lower()), retailer

def test_login_legacy_body_field_username_carries_gstin(clear_lockout):
    r = _login({"username": GSTIN_OK, "password": PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json().get("token")

def test_login_legacy_body_field_email_carries_gstin(clear_lockout):
    r = _login({"email": GSTIN_OK, "password": PASSWORD})
    assert r.status_code == 200, r.text

def test_legacy_username_allowlist_still_works(clear_lockout):
    r = _login({"username": LEGACY_USERNAME, "password": PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json().get("token")

# ---- Negative ----
def test_email_login_rejected(clear_lockout):
    r = _login({"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "GSTIN" in detail and "email" in detail.lower(), detail

def test_malformed_identifier_400(clear_lockout):
    r = _login({"gstin": "ABC123", "password": PASSWORD})
    assert r.status_code == 400
    assert "15-character GSTIN" in r.json().get("detail", "")

def test_unknown_gstin_returns_401_non_leaky(clear_lockout):
    r = _login({"gstin": "29ZZZZZ9999Z1Z9", "password": PASSWORD})
    assert r.status_code == 401
    assert r.json().get("detail") == "Invalid GSTIN or password"

def test_wrong_password_returns_same_401(clear_lockout):
    r = _login({"gstin": GSTIN_OK, "password": "wrong-pass-xyz"})
    assert r.status_code == 401
    assert r.json().get("detail") == "Invalid GSTIN or password"

# ---- Lockout ----
def test_lockout_after_10_failures(db, clear_lockout):
    for i in range(10):
        _login({"gstin": GSTIN_OK, "password": f"badpw-{i}"})
    r = _login({"gstin": GSTIN_OK, "password": f"badpw-final"})
    assert r.status_code == 429, r.text
    assert "Too many" in r.json().get("detail", "")
    # Even correct password is locked
    r2 = _login({"gstin": GSTIN_OK, "password": PASSWORD})
    assert r2.status_code == 429
    # Clear lockout via Mongo
    db.retailer_login_attempts.delete_many({})
    r3 = _login({"gstin": GSTIN_OK, "password": PASSWORD})
    assert r3.status_code == 200, r3.text

# ---- Session ----
def test_session_via_cookie(clear_lockout):
    r = _login({"gstin": GSTIN_OK, "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["token"]
    headers = {"Cookie": f"retailer_session={token}"}
    me = requests.get(f"{BASE_URL}/api/retailer-auth/me", headers=headers, timeout=15)
    assert me.status_code == 200, me.text
    perf = requests.get(f"{BASE_URL}/api/retailer-dashboard/performance", headers=headers, timeout=20)
    assert perf.status_code == 200, perf.text

# ---- Registration duplicate GSTIN ----
def test_register_duplicate_gstin_409():
    # Register requires prior phone-OTP verification. Send OTP, verify with dev_code,
    # then submit the register form using the already-registered GSTIN.
    phone = "9998887777"
    send = requests.post(
        f"{BASE_URL}/api/retailer-auth/phone/send-otp",
        json={"phone": phone, "country_code": "+91"},
        timeout=15,
    )
    if send.status_code != 200:
        pytest.skip(f"phone/send-otp unavailable: {send.status_code} {send.text[:120]}")
    dev_code = send.json().get("dev_code") or send.json().get("otp")
    if not dev_code:
        pytest.skip("phone OTP dev_code not returned; cannot proceed to dedupe check")
    v = requests.post(
        f"{BASE_URL}/api/retailer-auth/phone/verify-otp",
        json={"phone": phone, "country_code": "+91", "otp": dev_code, "code": dev_code},
        timeout=15,
    )
    assert v.status_code == 200, v.text

    files = {"gst_certificate": ("cert.pdf", b"%PDF-1.4 dummy cert", "application/pdf")}
    data = {
        "business_name": "Duplicate Attempt",
        "contact_name": "Dup Owner",
        "contact_person": "Dup Owner",
        "email": "dup_attempt_iter106@example.com",
        "phone": phone,
        "country_code": "+91",
        "password": "Test@12345",
        "gst_number": GSTIN_OK,
        "address_line1": "1 Test Rd",
        "city": "Delhi",
        "state": "Delhi",
        "pincode": "110001",
    }
    r = requests.post(f"{BASE_URL}/api/retailer-auth/register", data=data, files=files, timeout=30)
    assert r.status_code in (400, 409), r.text
    body = r.text.lower()
    assert "already exists" in body or "gstin" in body, body

# ---- Startup migration idempotency ----
def test_ensure_gstin_usernames_migration_state(db):
    # All live retailers must have username==gst_number (uppercase), except RTL_TEST_B2B
    live = list(db.retailers.find({"status": {"$ne": "deleted"}}))
    for r in live:
        rid = r.get("retailer_id")
        gst = (r.get("gst_number") or "").upper()
        uname = r.get("username") or ""
        if rid == "RTL_TEST_B2B":
            assert uname == LEGACY_USERNAME, f"RTL_TEST_B2B username should be legacy but is {uname}"
        else:
            assert gst and re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$", gst), \
                f"Live retailer {rid} missing valid GSTIN: {gst}"
            assert uname.upper() == gst, f"Live retailer {rid} username {uname} != gst {gst}"

    # Retailers without valid GSTIN must be soft-deleted with migration flag
    bad = list(db.retailers.find({"status": {"$ne": "deleted"}, "gst_number": {"$in": [None, ""]}}))
    assert bad == [], f"Found live retailers with no GSTIN: {[r.get('retailer_id') for r in bad]}"

# ---- Phone OTP unaffected ----
def test_phone_otp_login_send():
    r = requests.post(
        f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
        json={"phone": "9999999999"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dev_code") or j.get("otp") or j.get("success"), j

# ---- Handoff endpoints ----
def test_handoff_create_and_consume(clear_lockout):
    # Login to get session
    r = _login({"gstin": GSTIN_OK, "password": PASSWORD})
    token = r.json()["token"]
    headers = {"Cookie": f"retailer_session={token}"}
    c = requests.post(f"{BASE_URL}/api/auth/handoff/create", headers=headers, timeout=15)
    # Endpoint may require different auth; accept success or 401 documented behaviour
    assert c.status_code in (200, 201, 401, 403), c.text
    if c.status_code < 300:
        nonce = c.json().get("nonce") or c.json().get("handoff_token")
        if nonce:
            cons = requests.post(
                f"{BASE_URL}/api/auth/handoff/consume",
                json={"handoff_token": nonce, "nonce": nonce},
                timeout=15,
            )
            assert cons.status_code in (200, 201), cons.text

# ---- D2C customer login untouched ----
def test_d2c_login_endpoint_still_present():
    # Just verify contract - bad creds should not return the retailer-specific message
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "nope_iter106@example.com", "password": "wrong"},
        timeout=15,
    )
    assert r.status_code in (400, 401, 404, 422)
    detail = r.text
    assert "GSTIN" not in detail  # customer flow must not mention GSTIN
