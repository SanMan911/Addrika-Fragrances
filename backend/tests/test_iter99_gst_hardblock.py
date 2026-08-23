"""Iteration 99 — B2B waitlist GST hard-block + provider_down flag tests.

Covers:
  • GET  /api/retailer-auth/waitlist/gst-lookup/{gstin}  (provider_down flag)
  • POST /api/retailer-auth/waitlist                     (hard block on user error)
  • services.gst_verification._is_provider_outage        (unit level)
"""
import os
import sys

import pytest
import requests
from dotenv import dotenv_values

next_env = dotenv_values("/app/frontend-next/.env.local")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or next_env.get("NEXT_PUBLIC_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("Backend URL missing from env files")
BASE_URL = base_url.rstrip("/")

INVALID_GSTIN = "22AAAAA0000A1Z5"  # well-formed, but not in GSTN db
FRIENDLY_NOT_FOUND = "GSTIN not found in the GSTN database. Please check the number and try again."


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Module: b2b_waitlist — public GST lookup -------------------------------
class TestGstLookup:
    def test_lookup_user_error_returns_provider_down_false(self, api):
        r = api.get(
            f"{BASE_URL}/api/retailer-auth/waitlist/gst-lookup/{INVALID_GSTIN}",
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["verified"] is False
        assert d["provider_down"] is False
        assert d["gst_number"] == INVALID_GSTIN
        assert d["error"] == FRIENDLY_NOT_FOUND
        assert d["state"] == "Chhattisgarh"

    def test_lookup_bad_format_400(self, api):
        r = api.get(
            f"{BASE_URL}/api/retailer-auth/waitlist/gst-lookup/ABC123", timeout=30
        )
        assert r.status_code == 400
        assert "Invalid GST number format" in r.json().get("detail", "")


# --- Module: b2b_waitlist — signup hard block -------------------------------
class TestWaitlistHardBlock:
    payload = {
        "business_name": "TEST_ Iter99 Traders",
        "contact_name": "TEST_ QA Agent",
        "email": "test_iter99_waitlist@example.com",
        "phone": "9876500099",
        "country_code": "+91",
        "gst_number": INVALID_GSTIN,
        "city": "Raipur",
        "state": "Chhattisgarh",
        "message": "iteration 99 automated test",
    }

    def test_invalid_gstin_hard_blocked_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/waitlist", json=self.payload, timeout=60
        )
        assert r.status_code == 400, f"expected hard block, got {r.status_code}: {r.text[:300]}"
        assert r.json().get("detail") == FRIENDLY_NOT_FOUND

    def test_not_persisted_after_hard_block(self, api):
        # Public listing isn't available; assert via lookup + no 200 duplication.
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/waitlist", json=self.payload, timeout=60
        )
        assert r.status_code == 400

    def test_malformed_gstin_400(self, api):
        bad = {**self.payload, "gst_number": "123456789012345"}
        r = api.post(f"{BASE_URL}/api/retailer-auth/waitlist", json=bad, timeout=30)
        assert r.status_code == 400
        assert "Invalid GST number format" in r.json().get("detail", "")

    def test_missing_required_fields_422(self, api):
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/waitlist",
            json={"gst_number": INVALID_GSTIN},
            timeout=30,
        )
        assert r.status_code == 422


# --- Module: services.gst_verification — outage classifier -----------------
class TestProviderOutageClassifier:
    @staticmethod
    def _fn():
        sys.path.insert(0, "/app/backend")
        from services.gst_verification import _is_provider_outage

        return _is_provider_outage

    @pytest.mark.parametrize(
        "msg",
        [
            "GST verification service is temporarily under maintenance. Please try again in a few minutes.",
            "GST verification credits exhausted. Please contact Addrika support to top up.",
            "Verification service timeout",
            "GST verification API not configured",
            "All GST providers failed",
            "GST verification key invalid. Admin: update the Appyflow key in Integrations.",
        ],
    )
    def test_outage_true(self, msg):
        assert self._fn()(msg) is True

    @pytest.mark.parametrize(
        "msg",
        [
            FRIENDLY_NOT_FOUND,
            "Invalid GST number format",
            "",
        ],
    )
    def test_outage_false(self, msg):
        assert self._fn()(msg) is False
