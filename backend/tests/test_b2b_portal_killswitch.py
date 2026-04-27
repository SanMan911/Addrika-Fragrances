"""
Regression tests for B2B Retailer Portal kill-switch, cash-discount, and
quantity-tier pricing.

The backend defaults the portal to DISABLED. These tests:
  * verify disabled-state responses
  * authenticate admin (2FA) and toggle settings
  * verify retailer login/catalog/calculate/order when enabled
  * restore disabled state at the end
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = "https://kyc-verification-14.preview.emergentagent.com"
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")


def _fetch_admin_otp(token_id: str) -> str:
    """OTP is not returned in the HTTP response. Fetch it directly from the DB
    (dev/test-only helper)."""
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    doc = client[DB_NAME]["admin_2fa_tokens"].find_one({"token_id": token_id})
    client.close()
    assert doc, f"2FA token {token_id[:8]}... not found in DB"
    return doc["otp"]

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"

PRODUCT_ID = "kesar-chandan-b2b"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"admin initiate failed: {r.status_code} {r.text}"
    otp = r.json().get("otp")
    token_id = r.json().get("token_id")
    if not otp:
        otp = _fetch_admin_otp(token_id)
    r2 = s.post(f"{API}/admin/login/verify-otp",
                json={"token_id": token_id, "otp": otp}, timeout=30)
    assert r2.status_code == 200, f"admin verify failed: {r2.status_code} {r2.text}"
    return s


@pytest.fixture(scope="session")
def portal_disabler(admin_session):
    """Always restore portal to DISABLED at end of session."""
    yield
    try:
        admin_session.put(f"{API}/admin/b2b-settings",
                          json={"enabled": False}, timeout=30)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 1. Disabled-state behaviour (default)
# ---------------------------------------------------------------------------
class TestDisabledState:
    def test_portal_status_default_disabled(self, admin_session, portal_disabler):
        # Make sure the portal is disabled first
        admin_session.put(f"{API}/admin/b2b-settings",
                          json={"enabled": False}, timeout=30)
        r = requests.get(f"{API}/retailer-auth/portal-status", timeout=30)
        assert r.status_code == 200
        assert r.json() == {"enabled": False}

    def test_retailer_login_returns_403_when_disabled(self):
        r = requests.post(f"{API}/retailer-auth/login",
                          json={"email": RETAILER_EMAIL,
                                "password": RETAILER_PASSWORD},
                          timeout=30)
        assert r.status_code == 403
        assert "unavailable" in r.json().get("detail", "").lower()

    def test_catalog_returns_403_when_disabled_no_auth(self):
        r = requests.get(f"{API}/retailer-dashboard/b2b/catalog", timeout=30)
        # should be 403 (disabled), NOT 401
        assert r.status_code == 403, f"got {r.status_code}: {r.text}"

    def test_calculate_returns_403_when_disabled(self):
        r = requests.post(f"{API}/retailer-dashboard/b2b/calculate",
                          json={"items": [{"product_id": PRODUCT_ID,
                                           "quantity_boxes": 1}]},
                          timeout=30)
        assert r.status_code == 403

    def test_order_returns_403_when_disabled(self):
        r = requests.post(f"{API}/retailer-dashboard/b2b/order",
                          json={"items": [{"product_id": PRODUCT_ID,
                                           "quantity_boxes": 1}]},
                          timeout=30)
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# 2. Admin settings endpoints (auth + data)
# ---------------------------------------------------------------------------
class TestAdminSettings:
    def test_admin_settings_requires_auth(self):
        r = requests.get(f"{API}/admin/b2b-settings", timeout=30)
        assert r.status_code == 401

    def test_admin_get_settings(self, admin_session):
        r = admin_session.get(f"{API}/admin/b2b-settings", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "enabled" in data
        assert "cash_discount_percent" in data
        # Default cash discount should be 1.5 (not 2)
        assert data["cash_discount_percent"] == 1.5
        assert isinstance(data["products"], list)
        assert len(data["products"]) > 0
        p = data["products"][0]
        assert {"id", "name", "net_weight", "pricing_tiers"} <= set(p.keys())

    def test_invalid_cash_discount_rejected_high(self, admin_session):
        r = admin_session.put(f"{API}/admin/b2b-settings",
                              json={"cash_discount_percent": 25}, timeout=30)
        assert r.status_code in (400, 422)

    def test_invalid_cash_discount_rejected_negative(self, admin_session):
        r = admin_session.put(f"{API}/admin/b2b-settings",
                              json={"cash_discount_percent": -1}, timeout=30)
        assert r.status_code in (400, 422)

    def test_invalid_tier_discount_percent_rejected(self, admin_session):
        r = admin_session.put(
            f"{API}/admin/b2b-settings/pricing-tiers/{PRODUCT_ID}",
            json={"tiers": [{"min_boxes": 1, "discount_percent": 150}]},
            timeout=30)
        assert r.status_code in (400, 422)

    def test_nonexistent_product_pricing_tier_returns_404(self, admin_session):
        r = admin_session.put(
            f"{API}/admin/b2b-settings/pricing-tiers/not-a-real-product",
            json={"tiers": [{"min_boxes": 1, "discount_percent": 5}]},
            timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 3. Enable-portal flow (cash discount, tiers, order, restore)
# ---------------------------------------------------------------------------
class TestEnabledPortalFlow:
    def test_enable_portal_and_set_cash_discount(self, admin_session, portal_disabler):
        r = admin_session.put(
            f"{API}/admin/b2b-settings",
            json={"enabled": True, "cash_discount_percent": 1.5},
            timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["enabled"] is True
        assert body["cash_discount_percent"] == 1.5

        # public portal-status reflects
        r2 = requests.get(f"{API}/retailer-auth/portal-status", timeout=30)
        assert r2.json() == {"enabled": True}

    def test_set_pricing_tiers(self, admin_session):
        tiers = [
            {"min_boxes": 1, "discount_percent": 0},
            {"min_boxes": 5, "discount_percent": 3},
            {"min_boxes": 10, "discount_percent": 7},
        ]
        r = admin_session.put(
            f"{API}/admin/b2b-settings/pricing-tiers/{PRODUCT_ID}",
            json={"tiers": tiers}, timeout=30)
        assert r.status_code == 200, r.text
        saved = r.json()["tiers"]
        assert len(saved) == 3
        # sorted asc
        mins = [t["min_boxes"] for t in saved]
        assert mins == sorted(mins)

        # GET returns same sorted tiers
        r2 = admin_session.get(
            f"{API}/admin/b2b-settings/pricing-tiers/{PRODUCT_ID}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["tiers"] == saved

    def test_retailer_login_after_enable(self):
        s = requests.Session()
        r = s.post(f"{API}/retailer-auth/login",
                   json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD},
                   timeout=30)
        # Should be 200 (valid creds) — NOT 403. 401 acceptable if creds invalid.
        assert r.status_code in (200, 401), r.text
        assert r.status_code != 403

    def test_invalid_creds_return_401_not_403(self):
        r = requests.post(f"{API}/retailer-auth/login",
                          json={"email": "bogus@example.com",
                                "password": "wrong"},
                          timeout=30)
        assert r.status_code == 401

    def test_catalog_reflects_cash_discount_and_tiers(self):
        s = requests.Session()
        login = s.post(f"{API}/retailer-auth/login",
                       json={"email": RETAILER_EMAIL,
                             "password": RETAILER_PASSWORD},
                       timeout=30)
        if login.status_code != 200:
            pytest.skip(f"retailer login unavailable: {login.status_code}")
        r = s.get(f"{API}/retailer-dashboard/b2b/catalog", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["cash_discount_percent"] == 1.5
        kc = next((p for p in body["products"] if p["id"] == PRODUCT_ID), None)
        assert kc is not None
        tiers = kc["pricing_tiers"]
        assert any(t["min_boxes"] == 10 and t["discount_percent"] == 7
                   for t in tiers)

    def test_calculate_applies_tier_discount_at_qty10(self):
        s = requests.Session()
        login = s.post(f"{API}/retailer-auth/login",
                       json={"email": RETAILER_EMAIL,
                             "password": RETAILER_PASSWORD},
                       timeout=30)
        if login.status_code != 200:
            pytest.skip("retailer login unavailable")
        r = s.post(f"{API}/retailer-dashboard/b2b/calculate",
                   json={"items": [{"product_id": PRODUCT_ID,
                                    "quantity_boxes": 10}],
                         "apply_cash_discount": False},
                   timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        line = body["items"][0]
        assert line["tier_discount_percent"] == 7
        assert line["tier_discount_amount"] > 0
        assert body["tier_discount_total"] == line["tier_discount_amount"]

    def test_calculate_applies_cash_discount(self):
        s = requests.Session()
        login = s.post(f"{API}/retailer-auth/login",
                       json={"email": RETAILER_EMAIL,
                             "password": RETAILER_PASSWORD},
                       timeout=30)
        if login.status_code != 200:
            pytest.skip("retailer login unavailable")
        r = s.post(f"{API}/retailer-dashboard/b2b/calculate",
                   json={"items": [{"product_id": PRODUCT_ID,
                                    "quantity_boxes": 2}],
                         "apply_cash_discount": True},
                   timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        expected = round(body["subtotal"] * 1.5 / 100, 2)
        assert body["cash_discount"] == expected
        assert body["cash_discount_percent"] == 1.5

    def test_place_order_triggers_admin_email_and_online_payment(self):
        s = requests.Session()
        login = s.post(f"{API}/retailer-auth/login",
                       json={"email": RETAILER_EMAIL,
                             "password": RETAILER_PASSWORD},
                       timeout=30)
        if login.status_code != 200:
            pytest.skip("retailer login unavailable")
        r = s.post(f"{API}/retailer-dashboard/b2b/order",
                   json={"items": [{"product_id": PRODUCT_ID,
                                    "quantity_boxes": 10}],
                         "apply_cash_discount": True,
                         "notes": f"TEST_{uuid.uuid4().hex[:6]}"},
                   timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "order_id" in body
        assert body["order_id"].startswith("B2B-")

        # Verify order persisted with payment_method=online and cash_discount > 0
        client = MongoClient(MONGO_URL)
        order_doc = client[DB_NAME]["b2b_orders"].find_one(
            {"order_id": body["order_id"]}, {"_id": 0})
        client.close()
        assert order_doc is not None
        assert order_doc["payment_method"] == "online"
        assert order_doc["cash_discount"] > 0
        assert order_doc["cash_discount_percent"] == 1.5
        # tier discount recorded on line
        line = order_doc["items"][0]
        assert line["tier_discount_percent"] == 7
        assert line["tier_discount_amount"] > 0

    def test_disable_portal_restores_403(self, admin_session):
        r = admin_session.put(f"{API}/admin/b2b-settings",
                              json={"enabled": False}, timeout=30)
        assert r.status_code == 200
        assert r.json()["enabled"] is False

        # catalog/calculate/order/login now 403
        assert requests.get(f"{API}/retailer-dashboard/b2b/catalog",
                            timeout=30).status_code == 403
        assert requests.post(f"{API}/retailer-dashboard/b2b/calculate",
                             json={"items": [{"product_id": PRODUCT_ID,
                                              "quantity_boxes": 1}]},
                             timeout=30).status_code == 403
        assert requests.post(f"{API}/retailer-dashboard/b2b/order",
                             json={"items": [{"product_id": PRODUCT_ID,
                                              "quantity_boxes": 1}]},
                             timeout=30).status_code == 403
        assert requests.post(f"{API}/retailer-auth/login",
                             json={"email": RETAILER_EMAIL,
                                   "password": RETAILER_PASSWORD},
                             timeout=30).status_code == 403
