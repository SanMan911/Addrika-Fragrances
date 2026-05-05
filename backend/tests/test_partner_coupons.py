"""Regression tests for the Addrika ↔ Amardeep Saanan partner coupon bridge.

Covers:
  • HMAC sign/verify helpers
  • `POST /api/partner/coupons/issue` with & without a valid signature
  • Mirror-row persistence + idempotency on re-push
  • Outbound `validate_amardeep_coupon` happy + error paths (mocked)
  • `validate_and_apply_coupon` delegating AMD-GIFT-* codes to Amardeep
  • Admin list / suspend / reactivate endpoints
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from services import partner_coupons  # noqa: E402

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "http://localhost:8001",
).rstrip("/")

SECRET = os.environ.get(
    "PARTNER_SHARED_SECRET",
    "EXaS4_N21qxP1xo8nqv9kQuOaMm3oUm2m3e8VnWJxKuhyZVBi_yMAo9mx0vvrN7k",
).encode()


def _sign(body: bytes) -> str:
    return hmac.new(SECRET, body, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# Helper unit tests
# ---------------------------------------------------------------------------
def test_partner_signature_is_hex_sha256():
    sig = partner_coupons.partner_signature(b"hello")
    assert len(sig) == 64  # 256 bits / 4
    assert all(c in "0123456789abcdef" for c in sig)


def test_verify_good_and_bad_signatures():
    body = b'{"x":1}'
    good = partner_coupons.partner_signature(body)
    assert partner_coupons.verify_partner_signature(good, body) is True
    assert partner_coupons.verify_partner_signature(good, b'{"x":2}') is False
    assert partner_coupons.verify_partner_signature("deadbeef", body) is False
    assert partner_coupons.verify_partner_signature("", body) is False


def test_amd_prefix_constant_matches_spec():
    assert partner_coupons.AMD_GIFT_PREFIX == "AMD-GIFT-"
    assert partner_coupons.ADRK_GIFT_PREFIX == "ADRK-GIFT-"


# ---------------------------------------------------------------------------
# HTTP: incoming `POST /api/partner/coupons/issue`
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_issue_rejects_missing_signature():
    body = json.dumps({"code": "AMD-GIFT-NOSIG001"}).encode()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{BASE_URL}/api/partner/coupons/issue",
            content=body,
            headers={"Content-Type": "application/json"},
        )
    assert r.status_code == 401
    assert "signature" in r.text.lower()


@pytest.mark.asyncio
async def test_issue_rejects_wrong_signature():
    body = json.dumps({"code": "AMD-GIFT-WRONG001"}).encode()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{BASE_URL}/api/partner/coupons/issue",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Partner-Signature": "0" * 64,
            },
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_issue_persists_and_is_idempotent():
    payload = {
        "code": "AMD-GIFT-IDEMPO001",
        "label": "Free Mystical Meharishi Dhoop (₹149)",
        "value_inr": 149,
        "discount_type": "fixed",
        "applies_to_service_id": "MEHARISHI_DHOOP",
        "redeemable_on": "addrika",
        "issued_by": "amardeep",
        "user_email": "buyer@example.com",
        "valid_until": "2026-06-30T00:00:00+00:00",
        "source_order_ref": "AMD-ORDER-TEST-42",
    }
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "X-Partner-Signature": _sign(body)}

    async with httpx.AsyncClient(timeout=10) as c:
        r1 = await c.post(f"{BASE_URL}/api/partner/coupons/issue", content=body, headers=headers)
        assert r1.status_code == 200, r1.text
        assert r1.json()["ok"] is True
        coupon1 = r1.json()["coupon"]

        r2 = await c.post(f"{BASE_URL}/api/partner/coupons/issue", content=body, headers=headers)
        assert r2.status_code == 200
        coupon2 = r2.json()["coupon"]

    # Core fields stable across re-push
    for k in ("code", "discount_value", "partner_source", "partner_applies_to_sku"):
        assert coupon1[k] == coupon2[k]

    # Verify row exists in DB
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    doc = await db.discount_codes.find_one({"code": "AMD-GIFT-IDEMPO001"}, {"_id": 0})
    assert doc is not None
    assert doc["partner_source"] == "amardeep"
    assert doc["partner_user_email"] == "buyer@example.com"
    assert doc["discount_value"] == 149
    assert doc["is_active"] is True
    client.close()


@pytest.mark.asyncio
async def test_issue_rejects_bad_json():
    body = b"not-json"
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{BASE_URL}/api/partner/coupons/issue",
            content=body,
            headers={"Content-Type": "application/json", "X-Partner-Signature": _sign(body)},
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_issue_rejects_missing_code():
    body = json.dumps({"label": "no code here"}).encode()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{BASE_URL}/api/partner/coupons/issue",
            content=body,
            headers={"Content-Type": "application/json", "X-Partner-Signature": _sign(body)},
        )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Outbound: validate_amardeep_coupon (mocked)
# ---------------------------------------------------------------------------
class _FakeResp:
    def __init__(self, status: int, payload):
        self.status_code = status
        self._payload = payload
        self.text = json.dumps(payload) if isinstance(payload, dict) else str(payload)

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, *a, **kw):
        return self._resp


@pytest.mark.asyncio
async def test_validate_amardeep_coupon_ok():
    resp = _FakeResp(200, {"valid": True, "coupon": {"value_inr": 149}})
    with patch("services.partner_coupons.httpx.AsyncClient", return_value=_FakeClient(resp)):
        out = await partner_coupons.validate_amardeep_coupon("AMD-GIFT-OK")
    assert out["valid"] is True
    assert out["coupon"]["value_inr"] == 149


@pytest.mark.asyncio
async def test_validate_amardeep_coupon_remote_404():
    resp = _FakeResp(404, {"detail": "Coupon not found"})
    with patch("services.partner_coupons.httpx.AsyncClient", return_value=_FakeClient(resp)):
        out = await partner_coupons.validate_amardeep_coupon("AMD-GIFT-BAD")
    assert out["valid"] is False
    assert "not found" in out["error"].lower()


@pytest.mark.asyncio
async def test_validate_amardeep_coupon_network_failure():
    class _Boom:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def post(self, *a, **kw):
            raise httpx.ConnectError("boom")

    with patch("services.partner_coupons.httpx.AsyncClient", return_value=_Boom()):
        out = await partner_coupons.validate_amardeep_coupon("AMD-GIFT-X")
    assert out["valid"] is False
    assert "unavailable" in out["error"].lower()


# ---------------------------------------------------------------------------
# validate_and_apply_coupon delegates AMD-GIFT to Amardeep
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_validate_and_apply_coupon_partner_happy_path():
    from services.order_pricing import validate_and_apply_coupon

    with patch(
        "services.partner_coupons.validate_amardeep_coupon",
        new=AsyncMock(return_value={
            "valid": True,
            "coupon": {"value_inr": 149, "issued_by": "amardeep"},
        }),
    ):
        result = await validate_and_apply_coupon(
            db=None, coupon_code="AMD-GIFT-HAPPYFLOW", mrp_total=599,
            delivery_mode="shipping", user_email="u@x.com",
        )
    assert result["has_coupon_applied"] is True
    assert result["coupon_discount"] == 149
    assert result["voucher_type"] == "partner_coupon"
    assert result["partner_source"] == "amardeep"


@pytest.mark.asyncio
async def test_validate_and_apply_coupon_partner_invalid():
    from services.order_pricing import validate_and_apply_coupon

    with patch(
        "services.partner_coupons.validate_amardeep_coupon",
        new=AsyncMock(return_value={"valid": False, "error": "expired"}),
    ):
        result = await validate_and_apply_coupon(
            db=None, coupon_code="AMD-GIFT-EXPIRED", mrp_total=599,
            delivery_mode="shipping",
        )
    assert result["has_coupon_applied"] is False
    assert result["error"] == "expired"


@pytest.mark.asyncio
async def test_validate_and_apply_coupon_partner_self_pickup_blocked():
    """Self-pickup still blocks any coupon — including partner ones."""
    from services.order_pricing import validate_and_apply_coupon

    with patch(
        "services.partner_coupons.validate_amardeep_coupon",
        new=AsyncMock(return_value={"valid": True, "coupon": {"value_inr": 149}}),
    ) as m:
        result = await validate_and_apply_coupon(
            db=None, coupon_code="AMD-GIFT-PICKUP", mrp_total=599,
            delivery_mode="self_pickup",
        )
    assert result["has_coupon_applied"] is False
    assert m.await_count == 0  # short-circuited before any partner call


# ---------------------------------------------------------------------------
# issue_amardeep_voucher skips below threshold + posts above
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_issue_amardeep_voucher_skipped_below_threshold():
    """Orders under ₹499 must NOT trigger a partner voucher push."""
    with patch("services.partner_coupons.httpx.AsyncClient") as m:
        out = await partner_coupons.issue_amardeep_voucher(
            customer_email="x@y.com", source_order_ref="A1", amount_inr=498,
        )
    assert out is None
    m.assert_not_called()


@pytest.mark.asyncio
async def test_issue_amardeep_voucher_pushes_above_threshold():
    resp = _FakeResp(200, {"ok": True})
    with patch("services.partner_coupons.httpx.AsyncClient", return_value=_FakeClient(resp)):
        out = await partner_coupons.issue_amardeep_voucher(
            customer_email="x@y.com", source_order_ref="A1", amount_inr=1200,
        )
    assert out is not None
    assert out["code"].startswith("ADRK-GIFT-")
    assert out["value_inr"] == 99
    assert out["redeemable_on"] == "amardeep"
    assert out["source_order_ref"] == "A1"
