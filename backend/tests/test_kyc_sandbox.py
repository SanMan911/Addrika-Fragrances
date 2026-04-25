"""
Tests for Sandbox KYC service + routes.

Strategy: monkeypatch httpx so we never hit the live API; exercise both
the "not configured" graceful-degrade path and the happy/error paths.
"""
import os
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient

# Ensure env loaded the same way server.py does
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from server import app, db  # noqa: E402
from services import kyc_sandbox  # noqa: E402

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class _FakeResp:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text or str(self._json)

    def json(self):
        return self._json


def _patch_token():
    """Make _authenticate succeed without hitting the network."""
    # Reset and prime the cache to a known token
    kyc_sandbox._token_cache["access_token"] = "fake-token"
    from datetime import datetime, timedelta, timezone
    kyc_sandbox._token_cache["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(hours=1)
    )


def _set_creds(monkeypatch, key="key_test_xxx", secret="secret_test_xxx"):
    monkeypatch.setenv("SANDBOX_API_KEY", key)
    monkeypatch.setenv("SANDBOX_API_SECRET", secret)


def _clear_creds(monkeypatch):
    monkeypatch.setenv("SANDBOX_API_KEY", "")
    monkeypatch.setenv("SANDBOX_API_SECRET", "")
    # Clear any prior token cache so is_configured() flips correctly
    kyc_sandbox._token_cache["access_token"] = None
    kyc_sandbox._token_cache["expires_at"] = None


# ---------------------------------------------------------------------------
# Service-level tests
# ---------------------------------------------------------------------------
class TestKYCSandboxService:
    @pytest.mark.asyncio
    async def test_not_configured_pan(self, monkeypatch):
        _clear_creds(monkeypatch)
        result = await kyc_sandbox.verify_pan("ABCDE1234F")
        assert result["verified"] is False
        assert result.get("not_configured") is True

    @pytest.mark.asyncio
    async def test_not_configured_aadhaar(self, monkeypatch):
        _clear_creds(monkeypatch)
        out = await kyc_sandbox.aadhaar_generate_otp("123456789012")
        assert out["ok"] is False
        assert out.get("not_configured") is True

    @pytest.mark.asyncio
    async def test_invalid_pan_format(self, monkeypatch):
        _set_creds(monkeypatch)
        out = await kyc_sandbox.verify_pan("BAD")
        assert out["verified"] is False
        assert "Invalid PAN" in out["error"]

    @pytest.mark.asyncio
    async def test_invalid_aadhaar_format(self, monkeypatch):
        _set_creds(monkeypatch)
        out = await kyc_sandbox.aadhaar_generate_otp("12345")
        assert out["ok"] is False

    @pytest.mark.asyncio
    async def test_invalid_otp_format(self, monkeypatch):
        _set_creds(monkeypatch)
        out = await kyc_sandbox.aadhaar_verify_otp("ref-1", "abc")
        assert out["verified"] is False

    @pytest.mark.asyncio
    async def test_pan_happy_path(self, monkeypatch):
        _set_creds(monkeypatch)
        _patch_token()
        fake_payload = {
            "data": {
                "status": "valid",
                "full_name": "JOHN DOE",
                "category": "Individual",
                "aadhaar_seeding_status": "linked",
            }
        }

        async def _fake_get(self, url, headers=None, params=None, **kw):
            assert "/pans/ABCDE1234F/verify" in url
            assert headers["Authorization"] == "fake-token"
            return _FakeResp(200, fake_payload)

        monkeypatch.setattr("httpx.AsyncClient.get", _fake_get)
        result = await kyc_sandbox.verify_pan("ABCDE1234F", name_to_match="John Doe")
        assert result["verified"] is True
        assert result["full_name"] == "JOHN DOE"
        assert result["is_valid"] is True
        assert result["provider"] == "sandbox"
        assert "raw" in result

    @pytest.mark.asyncio
    async def test_pan_http_error(self, monkeypatch):
        _set_creds(monkeypatch)
        _patch_token()

        async def _fake_get(self, url, headers=None, params=None, **kw):
            return _FakeResp(401, {}, text="unauthorized")

        monkeypatch.setattr("httpx.AsyncClient.get", _fake_get)
        result = await kyc_sandbox.verify_pan("ABCDE1234F")
        assert result["verified"] is False
        assert "401" in result["error"]

    @pytest.mark.asyncio
    async def test_aadhaar_otp_happy(self, monkeypatch):
        _set_creds(monkeypatch)
        _patch_token()

        async def _fake_post(self, url, headers=None, json=None, **kw):
            assert "/kyc/aadhaar/okyc/otp" in url
            return _FakeResp(200, {"data": {"ref_id": "ref-xyz", "message": "sent"}})

        monkeypatch.setattr("httpx.AsyncClient.post", _fake_post)
        out = await kyc_sandbox.aadhaar_generate_otp("123456789012")
        assert out["ok"] is True
        assert out["reference_id"] == "ref-xyz"

    @pytest.mark.asyncio
    async def test_aadhaar_verify_happy(self, monkeypatch):
        _set_creds(monkeypatch)
        _patch_token()

        fake_payload = {
            "data": {
                "aadhaar_data": {
                    "name": "Jane Doe",
                    "date_of_birth": "1990-01-01",
                    "gender": "F",
                    "aadhaar_number": "123456789012",
                    "address": {
                        "house": "12",
                        "street": "Main St",
                        "vtc": "Mumbai",
                        "district": "Mumbai",
                        "state": "Maharashtra",
                        "pincode": "400001",
                        "country": "India",
                    },
                }
            }
        }

        async def _fake_post(self, url, headers=None, json=None, **kw):
            assert "/kyc/aadhaar/okyc/otp/verify" in url
            return _FakeResp(200, fake_payload)

        monkeypatch.setattr("httpx.AsyncClient.post", _fake_post)
        result = await kyc_sandbox.aadhaar_verify_otp("ref-xyz", "123456")
        assert result["verified"] is True
        assert result["name"] == "Jane Doe"
        assert result["aadhaar_last_4"] == "9012"
        assert result["pincode"] == "400001"
        assert result["state"] == "Maharashtra"
        assert "Mumbai" in result["address"]


# ---------------------------------------------------------------------------
# Route tests (auth + 503 when not configured)
# ---------------------------------------------------------------------------
class TestKYCRoutes:
    def test_public_status_when_not_configured(self, monkeypatch):
        _clear_creds(monkeypatch)
        r = client.get("/api/retailer-auth/kyc/status")
        assert r.status_code == 200
        assert r.json()["enabled"] is False
        assert r.json()["provider"] == "sandbox"

    def test_public_status_when_configured(self, monkeypatch):
        _set_creds(monkeypatch)
        r = client.get("/api/retailer-auth/kyc/status")
        assert r.status_code == 200
        assert r.json()["enabled"] is True

    def test_pan_verify_503_when_not_configured(self, monkeypatch):
        _clear_creds(monkeypatch)
        r = client.post(
            "/api/retailer-auth/kyc/pan/verify",
            json={"pan_number": "ABCDE1234F"},
        )
        assert r.status_code == 503

    def test_aadhaar_otp_503_when_not_configured(self, monkeypatch):
        _clear_creds(monkeypatch)
        r = client.post(
            "/api/retailer-auth/kyc/aadhaar/otp",
            json={"aadhaar_number": "123456789012"},
        )
        assert r.status_code == 503

    def test_admin_status_requires_auth(self):
        r = client.get("/api/admin/kyc/status")
        assert r.status_code in (401, 403)

    def test_admin_pan_requires_auth(self):
        r = client.post(
            "/api/admin/kyc/pan/verify",
            json={"pan_number": "ABCDE1234F"},
        )
        assert r.status_code in (401, 403)

    def test_admin_summary_requires_auth(self):
        r = client.get("/api/admin/kyc/summary/retailer/RTL_X")
        assert r.status_code in (401, 403)

    def test_pydantic_pan_length_validation(self, monkeypatch):
        _set_creds(monkeypatch)
        # min_length=10, max_length=10 — short PAN rejected by Pydantic
        r = client.post(
            "/api/retailer-auth/kyc/pan/verify",
            json={"pan_number": "BAD"},
        )
        assert r.status_code == 422
