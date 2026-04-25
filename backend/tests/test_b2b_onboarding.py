"""
Regression tests for one-click waitlist → retailer onboarding.
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


@pytest.fixture
def waitlist_signup():
    """Create a fresh waitlist signup for each test, clean up after."""
    email = f"onboard_pytest_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{API}/retailer-auth/waitlist",
        json={
            "business_name": "Reliance Industries Limited",
            "contact_name": "Pytest User",
            "email": email,
            "country_code": "+91",
            "phone": "9988776655",
            "gst_number": "27AAACR5055K1Z7",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    db = _mongo()
    doc = db.retailer_waitlist.find_one({"email": email})
    yield {"email": email, "id": doc["id"]}
    # cleanup
    if doc.get("retailer_id"):
        db.retailers.delete_many({"retailer_id": doc["retailer_id"]})
        db.retailer_sessions.delete_many({"retailer_id": doc["retailer_id"]})
    db.retailer_waitlist.delete_many({"email": email})


class TestOnboarding:
    def test_unauth_rejected(self, waitlist_signup):
        r = requests.post(
            f"{API}/admin/b2b-waitlist/{waitlist_signup['id']}/onboard", timeout=30
        )
        assert r.status_code == 401

    def test_unknown_signup_404(self, admin):
        r = admin.post(f"{API}/admin/b2b-waitlist/no-such-id/onboard", timeout=30)
        assert r.status_code == 404

    def test_full_flow_creates_retailer_and_emails_invite(
        self, admin, waitlist_signup
    ):
        # Onboard
        r = admin.post(
            f"{API}/admin/b2b-waitlist/{waitlist_signup['id']}/onboard", timeout=60
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["retailer_id"].startswith("RTL_")
        assert "/retailer/setup-password?token=" in body["invite_link"]

        # Token validates
        token = body["invite_link"].split("token=")[1]
        v = requests.get(
            f"{API}/retailer-auth/setup-password/validate/{token}", timeout=30
        )
        assert v.status_code == 200
        vbody = v.json()
        assert vbody["valid"] is True
        assert vbody["email"] == waitlist_signup["email"]
        assert vbody["business_name"]

        # Set password
        sp = requests.post(
            f"{API}/retailer-auth/setup-password",
            json={"token": token, "password": "NewPass@1234"},
            timeout=30,
        )
        assert sp.status_code == 200, sp.text
        assert sp.json()["ok"] is True

        # Re-using the same token must now fail (single-use)
        v2 = requests.get(
            f"{API}/retailer-auth/setup-password/validate/{token}", timeout=30
        )
        assert v2.json()["valid"] is False

        sp2 = requests.post(
            f"{API}/retailer-auth/setup-password",
            json={"token": token, "password": "NewPass@1234"},
            timeout=30,
        )
        assert sp2.status_code == 404

        # Retailer record has Appyflow address fields populated
        db = _mongo()
        retailer = db.retailers.find_one(
            {"retailer_id": body["retailer_id"]}, {"_id": 0}
        )
        assert retailer["state"] == "Maharashtra"
        assert retailer["status"] == "active"
        assert retailer.get("password_hash")
        assert "invite_token" not in retailer  # cleared

        # Waitlist row updated
        signup = db.retailer_waitlist.find_one({"id": waitlist_signup["id"]})
        assert signup["status"] == "onboarded"
        assert signup["retailer_id"] == body["retailer_id"]

    def test_double_onboard_returns_409(self, admin, waitlist_signup):
        r1 = admin.post(
            f"{API}/admin/b2b-waitlist/{waitlist_signup['id']}/onboard", timeout=60
        )
        assert r1.status_code == 200
        r2 = admin.post(
            f"{API}/admin/b2b-waitlist/{waitlist_signup['id']}/onboard", timeout=30
        )
        assert r2.status_code == 409


class TestSetupPasswordValidation:
    def test_invalid_token_returns_valid_false(self):
        r = requests.get(
            f"{API}/retailer-auth/setup-password/validate/notarealtoken_abcdef0123456789",
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_short_password_rejected(self):
        r = requests.post(
            f"{API}/retailer-auth/setup-password",
            json={"token": "x" * 30, "password": "short"},
            timeout=30,
        )
        assert r.status_code == 422  # pydantic validation

    def test_invalid_token_setup_returns_404(self):
        r = requests.post(
            f"{API}/retailer-auth/setup-password",
            json={"token": "x" * 50, "password": "ValidPass1!"},
            timeout=30,
        )
        assert r.status_code == 404
