"""Tests for the bulk-grandfather KYC endpoint and CSV bulk import."""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("BACKEND_URL")
    or "http://localhost:8001"
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture
def admin_session(mongo):
    s = requests.Session()
    r = s.post(
        f"{API}/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=10,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login initiate failed ({r.status_code})")
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


# ============================================================================
# Bulk-grandfather KYC
# ============================================================================
class TestBulkGrandfatherKYC:
    def test_requires_auth(self):
        r = requests.post(f"{API}/admin/b2b/retailers/bulk-grandfather-kyc", timeout=10)
        assert r.status_code in (401, 403)

    def test_grandfathers_unverified_retailers(self, admin_session, mongo):
        # Seed an un-verified retailer
        rid = f"RTL_TEST_{uuid.uuid4().hex[:8].upper()}"
        mongo.retailers.insert_one(
            {
                "retailer_id": rid,
                "email": f"{rid.lower()}@test.local",
                "business_name": "Pytest Co",
                "gst_verified": False,
                "pan_verified": False,
                "aadhaar_verified": False,
            }
        )
        try:
            r = admin_session.post(
                f"{API}/admin/b2b/retailers/bulk-grandfather-kyc", timeout=10
            )
            assert r.status_code == 200
            body = r.json()
            assert body["modified"] >= 1
            assert "grandfathered_at" in body

            # Our test retailer should now be fully verified
            doc = mongo.retailers.find_one({"retailer_id": rid})
            assert doc["gst_verified"] is True
            assert doc["pan_verified"] is True
            assert doc["aadhaar_verified"] is True
            assert "kyc_grandfathered_at" in doc
        finally:
            mongo.retailers.delete_one({"retailer_id": rid})

    def test_idempotent_when_all_verified(self, admin_session, mongo):
        # Seed a fully-verified retailer
        rid = f"RTL_OK_{uuid.uuid4().hex[:8].upper()}"
        mongo.retailers.insert_one(
            {
                "retailer_id": rid,
                "email": f"{rid.lower()}@test.local",
                "gst_verified": True,
                "pan_verified": True,
                "aadhaar_verified": True,
            }
        )
        try:
            r = admin_session.post(
                f"{API}/admin/b2b/retailers/bulk-grandfather-kyc", timeout=10
            )
            assert r.status_code == 200
            # Our retailer was already verified — must NOT be in matched set
            doc = mongo.retailers.find_one({"retailer_id": rid})
            # `kyc_grandfathered_at` must NOT have been added on this row
            assert "kyc_grandfathered_at" not in doc
        finally:
            mongo.retailers.delete_one({"retailer_id": rid})


# ============================================================================
# CSV Bulk Import
# ============================================================================
CSV_HEADER = (
    "id,product_id,name,image,net_weight,units_per_box,"
    "mrp_per_unit,price_per_box,price_per_half_box,min_order,"
    "gst_rate,hsn_code,is_active"
)


class TestCSVBulkImport:
    def test_requires_auth(self):
        r = requests.post(
            f"{API}/admin/b2b/products/bulk-import",
            data=f"{CSV_HEADER}\n",
            headers={"Content-Type": "text/csv"},
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_imports_valid_csv(self, admin_session, mongo):
        sku_id = f"pytest-csv-{uuid.uuid4().hex[:6]}-b2b"
        csv_body = (
            f"{CSV_HEADER}\n"
            f"{sku_id},pytest-csv,Pytest CSV SKU,,100g,12,150,,,1,5,33074100,true\n"
        )
        try:
            r = admin_session.post(
                f"{API}/admin/b2b/products/bulk-import",
                data=csv_body,
                headers={"Content-Type": "text/csv"},
                timeout=10,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["created"] >= 1
            assert body["failed"] == 0
            # Auto-derived prices: 12 * 150 * 0.7652 = 1377
            doc = mongo.b2b_products.find_one({"id": sku_id})
            assert doc is not None
            assert doc["mrp_per_unit"] == 150
            assert doc["price_per_box"] in (1377, 1378)  # rounding
            assert doc["units_per_box"] == 12
        finally:
            mongo.b2b_products.delete_one({"id": sku_id})

    def test_imports_partial_with_errors(self, admin_session, mongo):
        good_id = f"pytest-csv-good-{uuid.uuid4().hex[:6]}-b2b"
        csv_body = (
            f"{CSV_HEADER}\n"
            f"{good_id},pytest-good,Good SKU,,100g,12,150,1377,688,1,5,33074100,true\n"
            ",,,,,,,,,,,,\n"  # Empty row → should fail
            "missing-id,,No id,,100g,12,150,,,1,5,33074100,true\n"  # bad
        )
        try:
            r = admin_session.post(
                f"{API}/admin/b2b/products/bulk-import",
                data=csv_body,
                headers={"Content-Type": "text/csv"},
                timeout=10,
            )
            assert r.status_code == 200
            body = r.json()
            assert body["created"] == 1
            assert body["failed"] == 2
            # First failed row's error surfaces
            errs = [r for r in body["results"] if not r["ok"]]
            assert len(errs) == 2
        finally:
            mongo.b2b_products.delete_one({"id": good_id})

    def test_empty_csv_400(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/b2b/products/bulk-import",
            data="",
            headers={"Content-Type": "text/csv"},
            timeout=10,
        )
        assert r.status_code == 400
