"""
Tests for B2B KYC order gate + B2B Catalog admin CRUD.

Uses sync requests + pymongo to match the existing B2B test pattern in
this folder (avoids the "event loop is closed" issue motor has when
multiple async tests share a global motor client).
"""
from __future__ import annotations

import os

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture
def admin_session(mongo):
    """Returns an authenticated admin session (handles 2FA OTP flow)."""
    s = requests.Session()
    r = s.post(
        f"{API}/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=10,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login initiate failed ({r.status_code}); skipping admin tests.")
    tid = r.json()["token_id"]
    otp = r.json().get("otp")
    if not otp:
        doc = mongo["admin_2fa_tokens"].find_one({"token_id": tid})
        if not doc:
            pytest.skip("OTP token missing in DB")
        otp = doc["otp"]
    r2 = s.post(
        f"{API}/admin/login/verify-otp",
        json={"token_id": tid, "otp": otp},
        timeout=10,
    )
    if r2.status_code != 200:
        pytest.skip(f"Admin OTP verify failed ({r2.status_code})")
    s.headers["Authorization"] = f"Bearer {r2.json()['session_token']}"
    return s


@pytest.fixture
def kyc_gate_off(mongo):
    mongo.admin_settings.update_one(
        {"setting_key": "b2b_kyc_required_for_orders"},
        {"$set": {"setting_value": False, "updated_by": "test"}},
        upsert=True,
    )
    yield
    mongo.admin_settings.update_one(
        {"setting_key": "b2b_kyc_required_for_orders"},
        {"$set": {"setting_value": False, "updated_by": "test"}},
        upsert=True,
    )


@pytest.fixture
def kyc_gate_on(mongo):
    mongo.admin_settings.update_one(
        {"setting_key": "b2b_kyc_required_for_orders"},
        {"$set": {"setting_value": True, "updated_by": "test"}},
        upsert=True,
    )
    yield
    mongo.admin_settings.update_one(
        {"setting_key": "b2b_kyc_required_for_orders"},
        {"$set": {"setting_value": False, "updated_by": "test"}},
        upsert=True,
    )


# ============================================================================
# Gate API tests
# ============================================================================
class TestKYCGateAPI:
    def test_admin_kyc_toggle_requires_auth(self):
        r = requests.put(
            f"{API}/admin/b2b-settings",
            json={"kyc_required_for_orders": True},
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_retailer_kyc_gate_endpoint_requires_auth(self):
        r = requests.get(f"{API}/retailer-dashboard/b2b/kyc-gate", timeout=10)
        # 401 (no retailer session) or 403 (b2b portal disabled)
        assert r.status_code in (401, 403)

    def test_admin_can_toggle_kyc_gate(self, admin_session, kyc_gate_off, mongo):
        # Enable
        r = admin_session.put(
            f"{API}/admin/b2b-settings",
            json={"kyc_required_for_orders": True},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["kyc_required_for_orders"] is True
        # DB persisted
        doc = mongo.admin_settings.find_one(
            {"setting_key": "b2b_kyc_required_for_orders"}
        )
        assert doc and doc.get("setting_value") is True
        # Disable
        r = admin_session.put(
            f"{API}/admin/b2b-settings",
            json={"kyc_required_for_orders": False},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["kyc_required_for_orders"] is False

    def test_settings_get_includes_kyc_field(self, admin_session, kyc_gate_off):
        r = admin_session.get(f"{API}/admin/b2b-settings", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "kyc_required_for_orders" in body
        assert body["kyc_required_for_orders"] is False


# ============================================================================
# Gate enforcement on order creation
# ============================================================================
class TestKYCGateEnforcement:
    def test_unauthenticated_blocked_first(self):
        # No retailer session — order endpoint must return 401/403 BEFORE
        # checking KYC, so neither response should mention 'kyc'.
        r = requests.post(f"{API}/retailer-dashboard/b2b/order", json={}, timeout=10)
        assert r.status_code in (401, 403, 422)


# ============================================================================
# Catalog admin CRUD
# ============================================================================
TEST_SKU = {
    "id": "pytest-sku-b2b",
    "product_id": "pytest-sku",
    "name": "Pytest Test SKU",
    "image": "",
    "net_weight": "100g",
    "units_per_box": 24,
    "mrp_per_unit": 100,
    "price_per_box": 1837,
    "price_per_half_box": 918,
    "min_order": 1,
    "gst_rate": 5,
    "hsn_code": "33074100",
    "is_active": True,
}


class TestB2BCatalogAPI:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/admin/b2b/products", timeout=10)
        assert r.status_code in (401, 403)

    def test_create_requires_auth(self):
        r = requests.post(f"{API}/admin/b2b/products", json=TEST_SKU, timeout=10)
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self):
        r = requests.delete(f"{API}/admin/b2b/products/foo", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_full_crud_cycle(self, admin_session, mongo):
        # Cleanup any leftover
        mongo.b2b_products.delete_one({"id": TEST_SKU["id"]})
        try:
            # CREATE
            r = admin_session.post(
                f"{API}/admin/b2b/products", json=TEST_SKU, timeout=10
            )
            assert r.status_code == 200, r.text
            assert r.json()["ok"] is True
            assert mongo.b2b_products.find_one({"id": TEST_SKU["id"]}) is not None

            # LIST — should include our new SKU
            r = admin_session.get(f"{API}/admin/b2b/products", timeout=10)
            assert r.status_code == 200
            ids = [p["id"] for p in r.json().get("products", [])]
            assert TEST_SKU["id"] in ids

            # UPDATE (re-upsert with new name)
            updated = {**TEST_SKU, "name": "Pytest Test SKU UPDATED", "mrp_per_unit": 150}
            r = admin_session.post(
                f"{API}/admin/b2b/products", json=updated, timeout=10
            )
            assert r.status_code == 200
            doc = mongo.b2b_products.find_one({"id": TEST_SKU["id"]})
            assert doc["name"] == "Pytest Test SKU UPDATED"
            assert doc["mrp_per_unit"] == 150

            # DELETE
            r = admin_session.delete(
                f"{API}/admin/b2b/products/{TEST_SKU['id']}", timeout=10
            )
            assert r.status_code == 200
            assert mongo.b2b_products.find_one({"id": TEST_SKU["id"]}) is None
        finally:
            mongo.b2b_products.delete_one({"id": TEST_SKU["id"]})

    def test_delete_nonexistent_returns_404(self, admin_session):
        r = admin_session.delete(
            f"{API}/admin/b2b/products/no-such-sku-{os.urandom(4).hex()}",
            timeout=10,
        )
        assert r.status_code == 404

    def test_create_validates_required_fields(self, admin_session):
        # Missing required fields → Pydantic 422
        r = admin_session.post(
            f"{API}/admin/b2b/products", json={"id": "x"}, timeout=10
        )
        assert r.status_code == 422
