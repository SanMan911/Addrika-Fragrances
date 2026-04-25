"""
Tests for Zoho sync-health card endpoint, backfill endpoint, and the
retailer first-login tour endpoint.
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
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"


def _mongo():
    return MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(
        f"{API}/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=30,
    )
    tid = r.json()["token_id"]
    db = _mongo()
    otp = db.admin_2fa_tokens.find_one({"token_id": tid})["otp"]
    r2 = s.post(
        f"{API}/admin/login/verify-otp",
        json={"token_id": tid, "otp": otp},
        timeout=30,
    )
    s.headers["Authorization"] = f"Bearer {r2.json()['session_token']}"
    return s


@pytest.fixture(scope="session")
def retailer():
    db = _mongo()
    db.admin_settings.update_one(
        {"setting_key": "b2b_enabled"},
        {"$set": {"setting_value": True}},
        upsert=True,
    )
    s = requests.Session()
    r = s.post(
        f"{API}/retailer-auth/login",
        json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    token = body.get("token") or body.get("session_token") or body.get("retailer_session")
    if token:
        # Cookie has secure=True, so we need to set it manually for http
        s.cookies.set("retailer_session", token)
    return s


# ---------------------------------------------------------------------------
# Zoho sync-health card endpoint
# ---------------------------------------------------------------------------
class TestZohoSyncHealth:
    def test_unauth_rejected(self):
        r = requests.get(f"{API}/admin/zoho/sync-health", timeout=30)
        assert r.status_code == 401

    def test_returns_full_payload(self, admin):
        r = admin.get(f"{API}/admin/zoho/sync-health", timeout=30)
        assert r.status_code == 200
        body = r.json()
        for key in (
            "configured", "synced_sales_orders", "pending_sales_orders",
            "synced_payments", "pending_payments", "unresolved_errors", "last_sync",
        ):
            assert key in body, f"missing {key}"
        assert isinstance(body["synced_sales_orders"], int)


# ---------------------------------------------------------------------------
# Zoho backfill endpoint
# ---------------------------------------------------------------------------
class TestZohoBackfill:
    def test_unauth_rejected(self):
        r = requests.post(f"{API}/admin/zoho/backfill", timeout=30)
        assert r.status_code == 401

    def test_412_when_not_configured(self, admin):
        """When Zoho isn't connected, we expect 412 (Precondition Failed).
        If our environment IS connected, we expect 200 with a clean payload."""
        r = admin.post(f"{API}/admin/zoho/backfill?limit=1", timeout=60)
        assert r.status_code in (200, 412), r.text
        if r.status_code == 200:
            body = r.json()
            for key in (
                "ok", "sales_orders_pushed", "payments_pushed", "failed",
                "skipped_orphan", "failures",
            ):
                assert key in body


# ---------------------------------------------------------------------------
# Retailer first-login tour endpoint
# ---------------------------------------------------------------------------
class TestRetailerTour:
    def setup_method(self, _):
        _mongo().retailers.update_one(
            {"retailer_id": "RTL_TEST_B2B"},
            {"$unset": {"tour_completed": "", "tour_completed_at": ""}},
        )

    def teardown_method(self, _):
        _mongo().retailers.update_one(
            {"retailer_id": "RTL_TEST_B2B"},
            {"$unset": {"tour_completed": "", "tour_completed_at": ""}},
        )

    def test_unauth_rejected(self):
        r = requests.post(f"{API}/retailer-dashboard/b2b/tour-complete", timeout=30)
        assert r.status_code == 401

    def test_marks_completed_idempotent(self, retailer):
        r = retailer.post(
            f"{API}/retailer-dashboard/b2b/tour-complete", timeout=30
        )
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # Second call still ok
        r2 = retailer.post(
            f"{API}/retailer-dashboard/b2b/tour-complete", timeout=30
        )
        assert r2.status_code == 200

        doc = _mongo().retailers.find_one(
            {"retailer_id": "RTL_TEST_B2B"}, {"_id": 0}
        )
        assert doc["tour_completed"] is True
        assert doc.get("tour_completed_at")
