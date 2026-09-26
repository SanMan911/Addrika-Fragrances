"""
Iteration 108 — Security audit remediation verification.
Covers SEC-001..SEC-005, dev-OTP gate, and password strength policy.
Uses PUBLIC preview URL (REACT_APP_BACKEND_URL semantics) via env.
"""
import os
import time
import uuid
import hashlib
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = "https://aaroviah-retail.preview.emergentagent.com"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

RETAILER_GSTIN = "07AAAAA0000A1Z5"
RETAILER_ID = "RTL_TEST_B2B"
RETAILER_PW = "Test@12345"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
FSM_KEY = "arhk_C2yoApjyj2zmmGZ6bM2qC47bxiJ--9o7ElyaRtbmPqk"


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="module")
def retailer_cookie():
    r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                      json={"gstin": RETAILER_GSTIN, "password": RETAILER_PW}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json().get("token")
    assert token
    return {"Cookie": f"retailer_session={token}"}


@pytest.fixture(scope="module")
def admin_cookie(mongo):
    r = requests.post(f"{BASE_URL}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=15)
    assert r.status_code == 200, r.text
    token_id = r.json()["token_id"]
    time.sleep(0.5)
    tok = list(mongo.admin_2fa_tokens.find({"token_id": token_id}).limit(1))
    assert tok, "no 2FA token in db"
    otp = tok[0]["otp"]
    v = requests.post(f"{BASE_URL}/api/admin/login/verify-otp",
                      json={"token_id": token_id, "otp": otp}, timeout=15)
    assert v.status_code == 200, v.text
    sess = v.json().get("session_token") or v.cookies.get("session_token")
    assert sess
    return {"Cookie": f"session_token={sess}"}


# ============ SEC-001 ============
class TestSec001StorePickup:
    def _seed(self, mongo, retailer_id, otp="123456"):
        order_number = f"SECTEST-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc)
        mongo.store_pickup_otps.insert_one({
            "order_number": order_number, "otp_code": otp,
            "retailer_id": retailer_id, "status": "pending",
            "customer_email": "sec@test", "customer_phone": "9",
            "balance_amount": 0,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(days=7)).isoformat(),
        })
        mongo.orders.insert_one({
            "order_number": order_number, "user_id": "sec-test",
            "delivery_mode": "self_pickup", "order_status": "shipped",
            "items": [], "pricing": {"final_total": 0},
            "billing": {}, "shipping": {},
        })
        return order_number

    def _cleanup(self, mongo, order_number):
        mongo.store_pickup_otps.delete_many({"order_number": order_number})
        mongo.orders.delete_many({"order_number": order_number})

    def test_a_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                          json={"order_number": "X", "retailer_id": "Y", "otp_code": "1"})
        assert r.status_code == 401

    def test_b_exploit_payload_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "SECTEST-EXPLOIT", "retailer_id": RETAILER_ID,
            "otp_code": "AddrikaAdmin@2026", "use_master_password": True})
        assert r.status_code == 401

    def test_c_retailer_wrong_store(self, mongo, retailer_cookie):
        order_number = self._seed(mongo, retailer_id="RTL_OTHER_STORE")
        try:
            r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                              headers=retailer_cookie,
                              json={"order_number": order_number,
                                    "retailer_id": "RTL_OTHER_STORE",
                                    "otp_code": "123456"})
            assert r.status_code == 403
            assert "different store" in r.text.lower()
        finally:
            self._cleanup(mongo, order_number)

    def test_d_retailer_success(self, mongo, retailer_cookie):
        order_number = self._seed(mongo, RETAILER_ID, otp="654321")
        try:
            r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                              headers=retailer_cookie,
                              json={"order_number": order_number,
                                    "retailer_id": RETAILER_ID,
                                    "otp_code": "654321"})
            assert r.status_code == 200, r.text
            j = r.json()
            assert j.get("success") is True
            assert j.get("verification_method") == "customer_otp"
            o = mongo.orders.find_one({"order_number": order_number})
            assert o["order_status"] == "delivered"
        finally:
            self._cleanup(mongo, order_number)

    def test_e_bruteforce_lockout(self, mongo, retailer_cookie):
        order_number = self._seed(mongo, RETAILER_ID, otp="999999")
        try:
            for _ in range(5):
                r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                                  headers=retailer_cookie,
                                  json={"order_number": order_number,
                                        "retailer_id": RETAILER_ID,
                                        "otp_code": "000000"})
                assert r.status_code == 200
                assert r.json().get("success") is False
            r6 = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                               headers=retailer_cookie,
                               json={"order_number": order_number,
                                     "retailer_id": RETAILER_ID,
                                     "otp_code": "000000"})
            assert r6.status_code == 429
        finally:
            self._cleanup(mongo, order_number)

    def test_f_admin_override_blocked_for_retailer(self, mongo, retailer_cookie):
        order_number = self._seed(mongo, RETAILER_ID)
        try:
            r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                              headers=retailer_cookie,
                              json={"order_number": order_number,
                                    "retailer_id": RETAILER_ID,
                                    "admin_override": True})
            assert r.status_code == 403
        finally:
            self._cleanup(mongo, order_number)

    def test_f2_admin_override_works(self, mongo, admin_cookie):
        order_number = self._seed(mongo, RETAILER_ID)
        try:
            r = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp",
                              headers=admin_cookie,
                              json={"order_number": order_number,
                                    "retailer_id": RETAILER_ID,
                                    "admin_override": True})
            assert r.status_code == 200, r.text
            assert r.json().get("verification_method") == "admin_override"
        finally:
            self._cleanup(mongo, order_number)


# ============ SEC-002 ============
class TestSec002PIILeak:
    FORBIDDEN = ["email", "phone", "gst_number", "gstin", "spoc",
                 "admin_notes", "legal_documents", "password_hash",
                 "is_verified", "bank"]

    def test_by_location_whitelist(self, mongo):
        # find a retailer's state/district
        r = mongo.retailers.find_one({"status": "active", "is_verified": True},
                                     {"state": 1, "district": 1})
        if not r:
            pytest.skip("no active verified retailer")
        resp = requests.get(f"{BASE_URL}/api/retailers/by-location",
                            params={"state": r["state"], "district": r["district"]})
        assert resp.status_code == 200
        for item in resp.json().get("retailers", []):
            for f in self.FORBIDDEN:
                for k in item.keys():
                    assert f not in k.lower(), f"leak field {k} in {item}"
                assert not any(kk.startswith("kyc") for kk in item.keys())

    def test_public_list_endpoints(self):
        # try common map endpoint
        for path in ["/api/retailers/public", "/api/retailers/all"]:
            resp = requests.get(f"{BASE_URL}{path}")
            if resp.status_code != 200:
                continue
            data = resp.json()
            items = data.get("retailers", data) if isinstance(data, dict) else data
            if not isinstance(items, list):
                continue
            for item in items[:10]:
                if not isinstance(item, dict):
                    continue
                for f in self.FORBIDDEN:
                    for k in item.keys():
                        assert f not in k.lower(), f"{path} leaks {k}"


# ============ SEC-003 ============
class TestSec003AdminPinBackdoor:
    def test_backdoor_string_rejected(self, mongo):
        r = requests.post(f"{BASE_URL}/api/admin/forgot-pin/initiate",
                          json={"email": ADMIN_EMAIL})
        assert r.status_code == 200, r.text
        # find token
        time.sleep(0.5)
        recovery_token = r.json().get("recovery_token")
        assert recovery_token, r.text
        # try backdoor
        v = requests.post(f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
                          json={"recovery_token": recovery_token, "otp": "addrika_admin_override"})
        assert v.status_code == 400, v.text
        assert "invalid otp" in v.text.lower()
        # cleanup
        mongo.admin_recovery_tokens.delete_many({"recovery_token": recovery_token})

    def test_reset_requires_verified_otp(self, mongo):
        # Attempt reset without verification
        r = requests.post(f"{BASE_URL}/api/admin/forgot-pin/reset",
                          json={"token_id": "nonexistent", "new_pin": "999999"})
        assert r.status_code in (400, 401, 403, 404, 422)


# ============ SEC-004 ============
class TestSec004FailClosed:
    def test_admin_login_still_works(self, admin_cookie):
        # fixture already validated login. verify the cookie hits an admin route
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=admin_cookie)
        assert r.status_code in (200, 404)  # route may vary but must not 401

    def test_wrong_pin_rejected(self):
        r = requests.post(f"{BASE_URL}/api/admin/login/initiate",
                          json={"email": ADMIN_EMAIL, "pin": "000000"})
        assert r.status_code in (400, 401, 403)


# ============ SEC-005 ============
class TestSec005ExternalAPI:
    def test_rate_limit(self, mongo):
        from datetime import datetime as _dt
        minute_key = _dt.now(timezone.utc).strftime("%Y%m%d%H%M")
        # find FSM key doc
        key_doc = mongo.api_keys.find_one({"key_prefix": {"$regex": "^arhk_C2yo"}}) \
                  or mongo.api_keys.find_one({}, sort=[("created_at", -1)])
        # Try both id fields
        key_id = key_doc.get("key_id") or key_doc.get("id") or str(key_doc.get("_id"))
        rl_id = f"{key_id}:{minute_key}"
        mongo.api_key_rate_limits.update_one({"_id": rl_id},
                                             {"$set": {"count": 500,
                                                       "minute": minute_key,
                                                       "key_id": key_id}},
                                             upsert=True)
        try:
            r = requests.get(f"{BASE_URL}/api/external/v1/ping",
                             headers={"X-API-Key": FSM_KEY})
            assert r.status_code == 429, f"expected 429 got {r.status_code} {r.text}"
            assert "rate limit" in r.text.lower()
        finally:
            mongo.api_key_rate_limits.delete_one({"_id": rl_id})

    def test_scoped_key_lifecycle(self, admin_cookie, mongo):
        # Create restricted key
        r = requests.post(f"{BASE_URL}/api/admin/api-keys", headers=admin_cookie,
                          json={"name": "SECTEST-scoped",
                                "scopes": ["orders:read", "orders:write", "retailers:read"],
                                "retailer_ids": [RETAILER_ID]})
        assert r.status_code in (200, 201), r.text
        body = r.json()
        new_key = body.get("api_key") or body.get("key") or body.get("token")
        key_id = body.get("key_id") or body.get("id")
        assert new_key, body
        try:
            # /retailers only shows our retailer
            rr = requests.get(f"{BASE_URL}/api/external/v1/retailers",
                              headers={"X-API-Key": new_key})
            assert rr.status_code == 200, rr.text
            data = rr.json()
            items = data.get("retailers", data) if isinstance(data, dict) else data
            if isinstance(items, list) and items:
                for it in items:
                    rid = it.get("retailer_id") or it.get("id")
                    assert rid == RETAILER_ID, f"scoped leak: {rid}"

            # /orders scoped
            ro = requests.get(f"{BASE_URL}/api/external/v1/orders",
                              headers={"X-API-Key": new_key})
            assert ro.status_code == 200
            odata = ro.json()
            oitems = odata.get("orders", odata) if isinstance(odata, dict) else odata
            if isinstance(oitems, list):
                for o in oitems:
                    if isinstance(o, dict) and "retailer_id" in o:
                        assert o["retailer_id"] == RETAILER_ID

            # Placing order for another retailer_id
            po = requests.post(f"{BASE_URL}/api/external/v1/orders",
                               headers={"X-API-Key": new_key},
                               json={"retailer_id": "RTL_OTHER",
                                     "items": [{"sku": "x", "quantity": 1}]})
            assert po.status_code in (403, 422), po.text
        finally:
            # Revoke/delete
            if key_id:
                requests.delete(f"{BASE_URL}/api/admin/api-keys/{key_id}",
                                headers=admin_cookie)

    def test_ssrf_webhook_blocked(self, admin_cookie):
        for url in ["http://127.0.0.1:8001/api/products",
                    "http://localhost/x",
                    "http://169.254.169.254/latest/meta-data",
                    "http://10.0.0.5/x"]:
            r = requests.post(f"{BASE_URL}/api/admin/stock-webhooks",
                              headers=admin_cookie,
                              json={"url": url, "name": "sectest",
                                    "events": ["stock.low"]})
            assert r.status_code == 422, f"{url} accepted: {r.status_code} {r.text}"
            assert "private" in r.text.lower() or "reserved" in r.text.lower() \
                   or "internal" in r.text.lower()

    def test_ssrf_public_url_accepted(self, admin_cookie):
        r = requests.post(f"{BASE_URL}/api/admin/stock-webhooks", headers=admin_cookie,
                          json={"url": "https://example.com/hook",
                                "name": "SECTEST-public",
                                "events": ["stock.low"]})
        assert r.status_code in (200, 201), r.text
        wid = (r.json().get("webhook") or r.json()).get("id") \
              or r.json().get("id") or r.json().get("webhook_id")
        if wid:
            requests.delete(f"{BASE_URL}/api/admin/stock-webhooks/{wid}",
                            headers=admin_cookie)


# ============ DEV OTP GATE ============
class TestDevOtpGate:
    def test_dev_code_present_when_flag_on(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/phone/login-send-otp",
                          json={"phone": "9999999999"})
        assert r.status_code in (200, 201, 400, 404), r.text
        if r.status_code == 200:
            body = r.json()
            # ALLOW_DEV_OTP=1 → dev_code should be present
            assert "dev_code" in body or "dev_otp" in body, body


# ============ PASSWORD STRENGTH ============
class TestPasswordStrength:
    def _mint_token(self, mongo):
        import secrets as _s, uuid as _u
        mongo.retailer_password_resets.delete_many({"gstin": RETAILER_GSTIN})
        raw = _s.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        mongo.retailer_password_resets.insert_one({
            "id": f"PWR-{_u.uuid4().hex[:10].upper()}",
            "retailer_id": RETAILER_ID,
            "gstin": RETAILER_GSTIN,
            "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
            "expires_at": now + timedelta(minutes=60),
            "created_at_dt": now,
            "created_at": now.isoformat(),
            "used_at": None, "ip": None,
        })
        return raw

    def test_weak_passwords_rejected_and_strong_ok(self, mongo):
        raw = self._mint_token(mongo)
        for weak in ["12345678", "password123", "aaaaaaaa"]:
            r = requests.post(f"{BASE_URL}/api/retailer-auth/reset-password",
                              json={"token": raw, "password": weak})
            assert r.status_code == 422, f"{weak}: {r.status_code} {r.text}"
        # now use a fresh token to set strong password (must restore Test@12345)
        raw2 = self._mint_token(mongo)
        r = requests.post(f"{BASE_URL}/api/retailer-auth/reset-password",
                          json={"token": raw2, "password": RETAILER_PW})
        assert r.status_code == 200, r.text


# ============ REGRESSION ============
class TestRegression:
    def test_gstin_login_works(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"gstin": RETAILER_GSTIN, "password": RETAILER_PW})
        assert r.status_code == 200

    def test_email_login_400s(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"email": "test_b2b_retailer@example.com",
                                "password": RETAILER_PW})
        assert r.status_code == 400

    def test_fsm_external_api_ping(self):
        r = requests.get(f"{BASE_URL}/api/external/v1/ping",
                         headers={"X-API-Key": FSM_KEY})
        assert r.status_code == 200

    def test_storefront_products_public(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
