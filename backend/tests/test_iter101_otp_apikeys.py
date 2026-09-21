"""
Iteration 101 — OTP passwordless login + External API keys.
Backend tests as per review request. Uses preview base URL.
"""
import os
import re
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = "https://b2b-handoff.preview.emergentagent.com"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_PHONE = "9999999999"
RETAILER_CC = "+91"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token(mongo_db):
    # 2FA initiate
    r = requests.post(f"{BASE_URL}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"initiate failed: {r.status_code} {r.text}"
    token_id = r.json().get("token_id")
    assert token_id
    time.sleep(1)
    rec = mongo_db.admin_2fa_tokens.find_one({"token_id": token_id})
    assert rec, f"no 2FA record for token_id={token_id}"
    otp = rec.get("otp") or rec.get("code") or rec.get("otp_code")
    assert otp, f"no OTP in record: {list(rec.keys())}"
    r2 = requests.post(f"{BASE_URL}/api/admin/login/verify-otp",
                       json={"token_id": token_id, "otp": otp}, timeout=30)
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    session_token = r2.json().get("session_token")
    assert session_token
    return session_token


def admin_headers(tok):
    return {"Authorization": f"Bearer {tok}", "Cookie": f"session_token={tok}"}


# ============ OTP LOGIN TESTS ============

class TestOtpLogin:
    def test_login_send_otp_unregistered_returns_404(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
                          json={"country_code": "+91", "phone": "9000000123"}, timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_login_send_otp_bad_length_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
                          json={"country_code": "+91", "phone": "12345678"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_login_send_and_verify_registered(self):
        # send
        r = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
                          json={"country_code": RETAILER_CC, "phone": RETAILER_PHONE}, timeout=30)
        assert r.status_code == 200, f"send failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("sent") is True
        assert data.get("dev_mode") is True
        code = data.get("dev_code")
        assert code and re.fullmatch(r"\d{6}", code), f"bad dev_code: {code}"
        assert data.get("business_name")

        # wrong code
        rw = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-verify",
                           json={"country_code": RETAILER_CC, "phone": RETAILER_PHONE,
                                 "code": "000001" if code != "000001" else "000002"}, timeout=30)
        assert rw.status_code == 400, f"wrong code should be 400, got {rw.status_code}: {rw.text}"

        # re-send (may hit cooldown 429) - handle
        time.sleep(31)
        r2 = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
                           json={"country_code": RETAILER_CC, "phone": RETAILER_PHONE}, timeout=30)
        assert r2.status_code == 200, f"re-send failed: {r2.status_code} {r2.text}"
        code2 = r2.json().get("dev_code")

        # verify correct code
        rv = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-verify",
                           json={"country_code": RETAILER_CC, "phone": RETAILER_PHONE,
                                 "code": code2}, timeout=30)
        assert rv.status_code == 200, f"verify failed: {rv.status_code} {rv.text}"
        vd = rv.json()
        assert vd.get("message") == "Login successful"
        assert vd.get("token")
        assert vd.get("retailer", {}).get("retailer_id") == "RTL_TEST_B2B"


# ============ REGRESSION: password login ============

class TestPasswordLoginRegression:
    def test_password_login_still_works(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}, timeout=30)
        assert r.status_code == 200, f"pw login failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("token")
        assert d.get("retailer", {}).get("retailer_id") == "RTL_TEST_B2B"


# ============ EXTERNAL API AUTH ============

class TestExternalApiAuth:
    def test_ping_without_key_401(self):
        r = requests.get(f"{BASE_URL}/api/external/v1/ping", timeout=30)
        assert r.status_code == 401

    def test_stock_without_key_401(self):
        r = requests.get(f"{BASE_URL}/api/external/v1/stock", timeout=30)
        assert r.status_code == 401


# ============ ADMIN API KEY CRUD + E2E ============

class TestApiKeysAdmin:
    _created_id = None
    _raw_key = None

    def test_create_key(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/api-keys",
                          headers={**admin_headers(admin_token), "Content-Type": "application/json"},
                          json={"name": "TEST_iter101_key"}, timeout=30)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("id")
        assert d.get("key", "").startswith("addk_")
        assert "stock:read" in (d.get("scopes") or [])
        TestApiKeysAdmin._created_id = d["id"]
        TestApiKeysAdmin._raw_key = d["key"]

    def test_list_keys_contains_created(self, admin_token):
        assert TestApiKeysAdmin._created_id
        r = requests.get(f"{BASE_URL}/api/admin/api-keys",
                         headers=admin_headers(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        ids = [x["id"] for x in items]
        assert TestApiKeysAdmin._created_id in ids

    def test_ping_with_key_200(self):
        assert TestApiKeysAdmin._raw_key
        r = requests.get(f"{BASE_URL}/api/external/v1/ping",
                         headers={"X-API-Key": TestApiKeysAdmin._raw_key}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "stock:read" in (d.get("scopes") or [])

    def test_stock_list_with_key_200(self):
        r = requests.get(f"{BASE_URL}/api/external/v1/stock",
                         headers={"X-API-Key": TestApiKeysAdmin._raw_key}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        items = d.get("items") or []
        assert len(items) > 0
        first = items[0]
        for f in ["id", "product_id", "name", "category", "net_weight",
                  "stock_pieces", "stock_status", "price_per_unit",
                  "price_per_carton", "is_active"]:
            assert f in first, f"missing field {f} in {first}"

        # single row fetch
        sku_id = first["id"]
        r2 = requests.get(f"{BASE_URL}/api/external/v1/stock/{sku_id}",
                          headers={"X-API-Key": TestApiKeysAdmin._raw_key}, timeout=30)
        assert r2.status_code == 200, r2.text
        row = r2.json()
        assert row.get("id") == sku_id

    def test_revoke_key(self, admin_token):
        assert TestApiKeysAdmin._created_id
        r = requests.post(f"{BASE_URL}/api/admin/api-keys/{TestApiKeysAdmin._created_id}/revoke",
                          headers=admin_headers(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("revoked") is True

    def test_revoked_key_rejected(self):
        r = requests.get(f"{BASE_URL}/api/external/v1/ping",
                         headers={"X-API-Key": TestApiKeysAdmin._raw_key}, timeout=30)
        assert r.status_code == 401, f"revoked key should 401, got {r.status_code}"

    def test_delete_key(self, admin_token):
        assert TestApiKeysAdmin._created_id
        r = requests.delete(f"{BASE_URL}/api/admin/api-keys/{TestApiKeysAdmin._created_id}",
                            headers=admin_headers(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        # verify gone
        r2 = requests.get(f"{BASE_URL}/api/admin/api-keys",
                          headers=admin_headers(admin_token), timeout=30)
        ids = [x["id"] for x in (r2.json().get("items") or [])]
        assert TestApiKeysAdmin._created_id not in ids
