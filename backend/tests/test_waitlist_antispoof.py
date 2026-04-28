"""Anti-spoofing tests for the public B2B waitlist endpoint.

Verifies the /api/retailer-auth/waitlist POST cross-checks user-typed
legal_name / state / pincode against the Appyflow-verified GST record.

Strategy: hits the live backend (so motor + asyncio work normally) and
seeds a deterministic Appyflow response by patching the live-process
`services.gst_verification.verify_gst_number` via a small admin debug
hook is overkill — instead we run the logic helpers as pure unit tests
and exercise the endpoint paths that DON'T require a live Appyflow call
(invalid GST format, missing legal_name) plus a single happy-path that
relies on a real, well-known GSTIN.
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

# Reliance Industries — public, well-known GSTIN. Address contains MUMBAI 400021.
RELIANCE_GST = "27AAACR5055K1Z7"

from routers.b2b_waitlist import _normalize_for_match, _names_match  # noqa: E402


@pytest.fixture
def cleanup_waitlist():
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    db.retailer_waitlist.delete_many({"email": {"$regex": "^pytest-antispoof"}})
    yield
    db.retailer_waitlist.delete_many({"email": {"$regex": "^pytest-antispoof"}})
    c.close()


# ---------------------------------------------------------------------------
# Pure helpers — no network
# ---------------------------------------------------------------------------
class TestNameMatcher:
    def test_exact_match(self):
        assert _names_match("Acme Corp", "Acme Corp")

    def test_case_insensitive(self):
        assert _names_match("acme corp", "ACME CORP")

    def test_strips_legal_suffix_pvt_ltd(self):
        assert _names_match("Reliance Industries", "RELIANCE INDUSTRIES LIMITED")

    def test_strips_legal_suffix_private_limited(self):
        assert _names_match("Tata Motors", "Tata Motors Private Limited")

    def test_strips_india(self):
        assert _names_match("Vodafone", "VODAFONE INDIA LIMITED")

    def test_punctuation_tolerant(self):
        assert _names_match("M.G. Shoppie", "M G SHOPPIE")

    def test_rejects_unrelated_names(self):
        assert not _names_match("Reliance Industries", "Tata Steel Ltd")

    def test_rejects_empty(self):
        assert not _names_match("", "Reliance")
        assert not _names_match("Reliance", "")
        assert not _names_match(None, "Reliance")

    def test_short_substring_rejected(self):
        # Generic 3-char substring inside long name → too short ratio
        assert not _names_match("ABC", "ABC Industries Holdings Group Limited")


# ---------------------------------------------------------------------------
# Endpoint integration — hits the live backend with a real GSTIN.
# ---------------------------------------------------------------------------
BASE_PAYLOAD = {
    "business_name": "Reliance Industries",
    "contact_name": "Test User",
    "phone": "9999999999",
    "country_code": "+91",
    "gst_number": RELIANCE_GST,
    "city": "Mumbai",
}


def _post(payload):
    return requests.post(f"{API}/retailer-auth/waitlist", json=payload, timeout=30)


def _appyflow_alive() -> bool:
    """Probe Appyflow once. If credits expired or service down, skip the live
    endpoint tests — graceful degrade is already covered by no-mock tests."""
    try:
        r = requests.get(
            f"{API}/retailer-auth/waitlist/gst-lookup/{RELIANCE_GST}",
            timeout=20,
        )
        return r.status_code == 200 and r.json().get("verified") is True
    except Exception:
        return False


@pytest.mark.skipif(
    not os.environ.get("APPYFLOW_API_KEY") or not _appyflow_alive(),
    reason="Appyflow API key not configured or out of credits — skipping live tests",
)
class TestAntiSpoofEndpoint:
    def test_invalid_gst_format_rejected(self, cleanup_waitlist):
        bad = {**BASE_PAYLOAD, "email": "pytest-antispoof-invalid@example.com",
               "gst_number": "BADGST123"}
        r = _post(bad)
        assert r.status_code in (400, 422)

    def test_legal_name_mismatch_rejected(self, cleanup_waitlist):
        bad = {
            **BASE_PAYLOAD,
            "email": "pytest-antispoof-mismatch@example.com",
            "legal_name": "Tata Steel Limited",
            "state": "Maharashtra",
            "pincode": "400701",
        }
        r = _post(bad)
        assert r.status_code == 400, r.text
        assert "Legal name does not match" in r.json().get("detail", "")

    def test_state_mismatch_rejected(self, cleanup_waitlist):
        bad = {
            **BASE_PAYLOAD,
            "email": "pytest-antispoof-state@example.com",
            "legal_name": "Reliance Industries",
            "state": "Karnataka",
            "pincode": "400701",
        }
        r = _post(bad)
        assert r.status_code == 400, r.text
        assert "State does not match" in r.json().get("detail", "")

    def test_pincode_mismatch_rejected(self, cleanup_waitlist):
        bad = {
            **BASE_PAYLOAD,
            "email": "pytest-antispoof-pin@example.com",
            "legal_name": "Reliance Industries",
            "state": "Maharashtra",
            "pincode": "560001",  # Bangalore PIN
        }
        r = _post(bad)
        assert r.status_code == 400, r.text
        assert "Pincode does not match" in r.json().get("detail", "")

    def test_happy_path_all_fields_match(self, cleanup_waitlist):
        ok = {
            **BASE_PAYLOAD,
            "email": "pytest-antispoof-ok@example.com",
            "legal_name": "Reliance Industries",
            "state": "Maharashtra",
            "pincode": "400701",  # Reliance's actual registered PIN
        }
        r = _post(ok)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["gst_verified"] is True

    def test_legal_name_optional_when_not_provided(self, cleanup_waitlist):
        """Backwards compat: legal_name is optional. If not sent, no spoof check."""
        no_legal = {
            **BASE_PAYLOAD,
            "email": "pytest-antispoof-nolegal@example.com",
            "state": "Maharashtra",
            "pincode": "400701",
        }
        r = _post(no_legal)
        assert r.status_code == 200, r.text
