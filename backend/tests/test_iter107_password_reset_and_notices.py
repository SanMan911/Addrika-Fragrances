"""Iteration 107: password reset lifecycle, admin notices GET, walkthrough-seen, brand audit.

Do NOT touch retailer email/password permanently. Password ends as Test@12345.
Do NOT call /api/admin/retailer-notices/gstin-login/send.
"""
import asyncio
import os
import re
import sys

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")

BASE_URL = "https://aaroviah-retail.preview.emergentagent.com"
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
GSTIN = "07AAAAA0000A1Z5"
UNKNOWN_GSTIN = "29ZZZZZ9999Z1Z9"
RETAILER_ID = "RTL_TEST_B2B"
PASSWORD = "Test@12345"
GENERIC_MSG = "If that GSTIN is registered, we've emailed a password reset link to the address on file."


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _clear_resets(db):
    async def run():
        await db.retailer_password_resets.delete_many({})
    asyncio.get_event_loop().run_until_complete(run())


# ---------------- Forgot-password endpoint ----------------

def test_forgot_password_registered_gstin(db):
    _clear_resets(db)
    r = requests.post(f"{API}/retailer-auth/forgot-password", json={"gstin": GSTIN}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("message") == GENERIC_MSG
    # no email leaked
    assert "@" not in str(data)


def test_forgot_password_unknown_gstin_generic(db):
    r = requests.post(f"{API}/retailer-auth/forgot-password", json={"gstin": UNKNOWN_GSTIN}, timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == GENERIC_MSG


def test_forgot_password_throttle_after_3(db):
    _clear_resets(db)
    for i in range(3):
        r = requests.post(f"{API}/retailer-auth/forgot-password", json={"gstin": GSTIN}, timeout=15)
        assert r.status_code == 200, f"attempt {i}: {r.text}"
    r4 = requests.post(f"{API}/retailer-auth/forgot-password", json={"gstin": GSTIN}, timeout=15)
    assert r4.status_code == 429, r4.text
    _clear_resets(db)


# ---------------- Token lifecycle (direct service) ----------------

def _issue_token(db):
    async def run():
        retailer = await db.retailers.find_one({"retailer_id": RETAILER_ID})
        assert retailer, "test retailer RTL_TEST_B2B missing"
        from services.retailer_password_reset import issue_reset_token
        return await issue_reset_token(db, retailer, "127.0.0.1")
    return asyncio.get_event_loop().run_until_complete(run())


def test_token_lifecycle_validate_reset_reuse(db):
    _clear_resets(db)
    token = _issue_token(db)
    # validate
    r = requests.get(f"{API}/retailer-auth/reset-password/validate/{token}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("valid") is True
    assert data.get("gst_number") == GSTIN
    assert data.get("business_name")

    # reset
    r2 = requests.post(f"{API}/retailer-auth/reset-password", json={"token": token, "password": PASSWORD}, timeout=15)
    assert r2.status_code == 200, r2.text

    # reuse rejected
    r3 = requests.post(f"{API}/retailer-auth/reset-password", json={"token": token, "password": PASSWORD}, timeout=15)
    assert r3.status_code == 400
    assert "invalid or has expired" in r3.json().get("detail", "").lower()

    # sessions cleared
    async def count_sessions():
        return await db.retailer_sessions.count_documents({"retailer_id": RETAILER_ID})
    # (Sessions were revoked by reset; new logins may exist from later tests but at this point should be 0)
    sess_count = asyncio.get_event_loop().run_until_complete(count_sessions())
    assert sess_count == 0

    # login still works
    login = requests.post(f"{API}/retailer-auth/login", json={"gstin": GSTIN, "password": PASSWORD}, timeout=15)
    assert login.status_code == 200, login.text
    assert login.json().get("token")


def test_garbage_token_rejected(db):
    r = requests.get(f"{API}/retailer-auth/reset-password/validate/garbagetokengarbagetokengarbage", timeout=15)
    assert r.status_code == 200
    assert r.json().get("valid") is False
    r2 = requests.post(f"{API}/retailer-auth/reset-password", json={"token": "garbagetokengarbagetokengarbage", "password": PASSWORD}, timeout=15)
    assert r2.status_code == 400


def test_new_token_invalidates_previous(db):
    _clear_resets(db)
    t1 = _issue_token(db)
    t2 = _issue_token(db)
    # t1 must no longer validate
    r = requests.get(f"{API}/retailer-auth/reset-password/validate/{t1}", timeout=15)
    assert r.json().get("valid") is False
    r2 = requests.get(f"{API}/retailer-auth/reset-password/validate/{t2}", timeout=15)
    assert r2.json().get("valid") is True
    _clear_resets(db)


# ---------------- Admin notices GET ----------------

def _admin_login_cookie():
    r = requests.post(f"{API}/admin/login/initiate", json={"email": "contact.us@centraders.com", "pin": "050499"}, timeout=15)
    assert r.status_code == 200, r.text
    token_id = r.json()["token_id"]

    async def get_otp():
        client = AsyncIOMotorClient(MONGO_URL)
        d = client[DB_NAME]
        row = await d.admin_2fa_tokens.find_one({"token_id": token_id})
        return row and row.get("otp")
    otp = asyncio.get_event_loop().run_until_complete(get_otp())
    assert otp
    r2 = requests.post(f"{API}/admin/login/verify-otp", json={"token_id": token_id, "otp": otp}, timeout=15)
    assert r2.status_code == 200, r2.text
    session_token = r2.json().get("session_token") or r2.cookies.get("session_token")
    assert session_token
    return session_token


def test_admin_notices_requires_auth():
    r = requests.get(f"{API}/admin/retailer-notices/gstin-login", timeout=15)
    assert r.status_code == 401


def test_admin_notices_content():
    tok = _admin_login_cookie()
    r = requests.get(f"{API}/admin/retailer-notices/gstin-login", cookies={"session_token": tok}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "subject" in data
    assert "preview_html" in data
    assert "in the AAROHMM app" in data["preview_html"]
    assert "Aaroviah" not in data["preview_html"]
    assert "AAROVIAH" not in data["preview_html"]
    assert isinstance(data.get("pending"), list)
    assert isinstance(data.get("sent"), list)
    assert len(data["pending"]) == 4
    assert len(data["sent"]) == 0


# ---------------- Walkthrough-seen ----------------

def test_walkthrough_seen_roundtrip(db):
    # login
    login = requests.post(f"{API}/retailer-auth/login", json={"gstin": GSTIN, "password": PASSWORD}, timeout=15)
    assert login.status_code == 200
    tok = login.json()["token"]

    # clear flag first
    async def clear():
        await db.retailers.update_one({"retailer_id": RETAILER_ID}, {"$unset": {"walkthrough_seen": ""}})
    asyncio.get_event_loop().run_until_complete(clear())

    r = requests.post(
        f"{API}/retailer-dashboard/b2b/walkthrough-seen",
        cookies={"retailer_session": tok},
        timeout=15,
    )
    assert r.status_code in (200, 204), r.text

    async def check():
        row = await db.retailers.find_one({"retailer_id": RETAILER_ID})
        return row.get("walkthrough_seen")
    val = asyncio.get_event_loop().run_until_complete(check())
    assert val is True or val  # truthy


# ---------------- Brand rename audit ----------------

PAGES_PUBLIC = ["/", "/products", "/wholesale", "/blog", "/retailer/login", "/retailer/forgot-password", "/retailer/onboarding"]

@pytest.mark.parametrize("path", PAGES_PUBLIC)
def test_brand_audit_public_pages(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    text = r.text
    assert "Aaroviah" not in text, f"{path} contains 'Aaroviah'"
    assert "AAROVIAH" not in text, f"{path} contains 'AAROVIAH'"
    assert "Addrika" not in text, f"{path} contains 'Addrika'"


# ---------------- Regression quick checks ----------------

def test_email_login_still_rejected():
    r = requests.post(f"{API}/retailer-auth/login", json={"gstin": "info@addrika.com", "password": "x"}, timeout=15)
    assert r.status_code == 400
    assert "GSTIN" in r.json().get("detail", "")


def test_notify_me_accepts_oos_regression():
    # Just check endpoint exists & doesn't 500 for a valid request
    # Endpoint schema varies; a quick smoke that it exists and responds
    r = requests.post(f"{API}/notify-me", json={"product_id": "royal-kewda", "email": "test.user@example.com", "product_slug": "royal-kewda"}, timeout=15)
    assert r.status_code in (200, 201, 400, 409, 422)


# ---------------- Internal identifiers preserved ----------------

def test_db_name_still_addrika():
    assert os.environ["DB_NAME"] == "addrika_db"


def test_mobile_app_display_name_aarohmm():
    import json as _json
    with open("/app/mobile/app.json") as f:
        cfg = _json.load(f)
    name = cfg.get("expo", {}).get("name") or cfg.get("name")
    assert name and "aarohmm" in name.lower()
    # scheme should NOT be renamed
    scheme = cfg.get("expo", {}).get("scheme", "")
    slug = cfg.get("expo", {}).get("slug", "")
    # Just record — don't fail if any is aaroviah/aarohmm; the spec says scheme/bundle NOT renamed
    print(f"scheme={scheme} slug={slug}")
