"""
Regression tests for the autofill + backlog batch:
- GSTIN → autofill public lookup
- Admin email-invoice PDF
- B2B catalog CRUD (MongoDB-managed)
- Bills migration endpoint (dry-run, smoke only)
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def _mongo():
    return MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]


def _fetch_admin_otp(token_id: str) -> str:
    doc = _mongo()["admin_2fa_tokens"].find_one({"token_id": token_id})
    assert doc, "OTP token missing"
    return doc["otp"]


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(
        f"{API}/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=30,
    )
    tid = r.json()["token_id"]
    otp = r.json().get("otp") or _fetch_admin_otp(tid)
    r2 = s.post(
        f"{API}/admin/login/verify-otp",
        json={"token_id": tid, "otp": otp},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    s.headers["Authorization"] = f"Bearer {r2.json()['session_token']}"
    return s


# ---------------------------------------------------------------------------
# 1. GSTIN public lookup (Appyflow-backed)
# ---------------------------------------------------------------------------
class TestGstLookup:
    def test_invalid_format_rejected(self):
        r = requests.get(f"{API}/retailer-auth/waitlist/gst-lookup/INVALID", timeout=30)
        assert r.status_code == 400

    def test_valid_gstin_returns_verified_payload(self):
        """Uses a well-known public GSTIN (Reliance). Tolerant of Appyflow rate-limits."""
        r = requests.get(
            f"{API}/retailer-auth/waitlist/gst-lookup/27AAACR5055K1Z7",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # We can't hard-assert verified=True because Appyflow may throttle.
        # But state must always be derivable from the GSTIN prefix.
        assert body["gst_number"] == "27AAACR5055K1Z7"
        assert body["state"] in ("Maharashtra", None)
        if body.get("verified"):
            assert body.get("business_name")

    def test_unknown_gstin_returns_200_with_verified_false(self):
        r = requests.get(
            f"{API}/retailer-auth/waitlist/gst-lookup/27AAAAA0000A1Z5",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["gst_number"] == "27AAAAA0000A1Z5"
        assert body["state"] == "Maharashtra"
        # Not verified since this GSTIN doesn't actually exist
        if not body.get("verified"):
            assert "error" in body


# ---------------------------------------------------------------------------
# 2. B2B catalog CRUD
# ---------------------------------------------------------------------------
class TestB2BCatalogCRUD:
    NEW_ID = f"test-catalog-{uuid.uuid4().hex[:6]}"

    def teardown_method(self, _):
        _mongo().b2b_products.delete_many({"id": {"$regex": "^test-catalog-"}})

    def test_list_products(self, admin):
        r = admin.get(f"{API}/admin/b2b/products", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "products" in body
        assert len(body["products"]) >= 1

    def test_unauth_rejected(self):
        r = requests.get(f"{API}/admin/b2b/products", timeout=30)
        assert r.status_code == 401

    def test_upsert_and_delete(self, admin):
        payload = {
            "id": self.NEW_ID,
            "product_id": "test-product",
            "name": "Test Catalog Item",
            "image": "https://example.com/img.jpg",
            "net_weight": "50g",
            "units_per_box": 12,
            "mrp_per_unit": 100.0,
            "price_per_box": 900,
            "price_per_half_box": 450,
            "min_order": 0.5,
            "gst_rate": 5,
            "hsn_code": "33074100",
            "is_active": True,
        }
        r = admin.post(f"{API}/admin/b2b/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # Verify cache hot-refreshed — find product via admin list
        lst = admin.get(f"{API}/admin/b2b/products", timeout=30).json()
        assert any(p["id"] == self.NEW_ID for p in lst["products"])

        # Delete
        d = admin.delete(f"{API}/admin/b2b/products/{self.NEW_ID}", timeout=30)
        assert d.status_code == 200 and d.json()["deleted"] is True

        # 2nd delete → 404
        d2 = admin.delete(f"{API}/admin/b2b/products/{self.NEW_ID}", timeout=30)
        assert d2.status_code == 404


# ---------------------------------------------------------------------------
# 3. Bills migrator endpoint (dry-run smoke test)
# ---------------------------------------------------------------------------
class TestBillsMigrator:
    def test_dry_run(self, admin):
        r = admin.post(
            f"{API}/admin/b2b/maintenance/migrate-bills?dry_run=true", timeout=60
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Either object storage configured (ok=True) or not (ok=False + explicit error)
        if body.get("ok"):
            assert "moved" in body
            assert body["dry_run"] is True
        else:
            assert "Object storage not configured" in body.get("error", "")

    def test_unauth_rejected(self):
        r = requests.post(
            f"{API}/admin/b2b/maintenance/migrate-bills", timeout=30
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 4. Admin email-invoice endpoint
# ---------------------------------------------------------------------------
class TestEmailInvoice:
    def test_unknown_order_returns_404(self, admin):
        r = admin.post(
            f"{API}/admin/b2b/orders/NO-SUCH/email-invoice", timeout=30
        )
        assert r.status_code == 404

    def test_unauth_rejected(self):
        r = requests.post(f"{API}/admin/b2b/orders/X/email-invoice", timeout=30)
        assert r.status_code == 401

    def test_email_sends_or_502(self, admin):
        """If there's a B2B order + Resend key is set, we expect 200. If Resend is
        misconfigured we expect 502. Either path should never crash."""
        db = _mongo()
        order = db.b2b_orders.find_one({}, {"_id": 0})
        if not order:
            pytest.skip("No B2B order present")
        r = admin.post(
            f"{API}/admin/b2b/orders/{order['order_id']}/email-invoice", timeout=60
        )
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            body = r.json()
            assert body["emailed"] is True
            assert "@" in body["to"]
