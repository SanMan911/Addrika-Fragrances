"""Cross-site coupon integration with Amardeep Saanan (numerology).

Addrika ↔ Amardeep share a single HMAC-SHA256 secret over the raw
request body. This module provides:

  • `partner_signature(body_bytes)` / `verify_partner_signature(sig, body)` —
    symmetric HMAC helpers used on both sides of the bridge.
  • `issue_amardeep_voucher(order)` — fires when a retail Addrika order is
    paid and ≥ ₹499. Pushes an `ADRK-GIFT-*` coupon (₹99 off mobile-number
    numerology audit) into Amardeep's coupons table.
  • `validate_amardeep_coupon(code, sku)` — when a customer types an
    `AMD-GIFT-*` code at Addrika checkout, the canonical record lives on
    the Amardeep side; we proxy validation to them.
  • `redeem_amardeep_coupon(code, order_ref)` — after a successful Addrika
    order that used an `AMD-GIFT-*` code, mark it used on Amardeep.

All outbound calls are best-effort with short timeouts so payment flows
never block on a partner outage.
"""
from __future__ import annotations

import hmac
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

ADRK_GIFT_PREFIX = "ADRK-GIFT-"
AMD_GIFT_PREFIX = "AMD-GIFT-"


def _secret() -> bytes:
    return os.environ.get("PARTNER_SHARED_SECRET", "").encode()


def _base_url() -> str:
    return os.environ.get(
        "AMARDEEP_API_BASE",
        "https://amardeep-numerology.preview.emergentagent.com",
    ).rstrip("/")


def _min_order() -> int:
    try:
        return int(os.environ.get("PARTNER_MIN_ORDER_INR", "499"))
    except ValueError:
        return 499


def is_configured() -> bool:
    return bool(_secret())


# ---------- HMAC helpers ----------
def partner_signature(body: bytes) -> str:
    """Return hex HMAC-SHA256 of `body` using the shared secret."""
    return hmac.new(_secret(), body, hashlib.sha256).hexdigest()


def verify_partner_signature(signature: str, body: bytes) -> bool:
    """Constant-time verify an incoming partner signature."""
    if not signature or not _secret():
        return False
    expected = partner_signature(body)
    return hmac.compare_digest(signature, expected)


# ---------- Outbound: issue a coupon on Amardeep ----------
async def issue_amardeep_voucher(
    *,
    customer_email: str,
    source_order_ref: str,
    amount_inr: float,
    db=None,
) -> Optional[dict]:
    """Push a ₹99-off numerology voucher to Amardeep after a retail Addrika
    order ≥ ₹499. Returns the coupon dict on success, None otherwise.

    Fire-and-forget from the caller's POV — never raises. When `db` is
    provided, every attempt is recorded into `partner_sync_log` so the
    nightly reconciliation cron can replay failures.
    """
    if not is_configured():
        return None
    if amount_inr < _min_order():
        return None
    if not customer_email:
        return None

    code = f"{ADRK_GIFT_PREFIX}{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "code": code,
        "label": "₹99 off Mobile Number Numerology Audit",
        "value_inr": 99,
        "discount_type": "fixed",
        "applies_to_service_id": "mobile-numerology",
        "redeemable_on": "amardeep",
        "issued_by": "addrika",
        "user_email": customer_email,
        "valid_until": (
            datetime.now(timezone.utc) + timedelta(days=15)
        ).isoformat(),
        "source_order_ref": source_order_ref,
    }
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Partner-Signature": partner_signature(body),
    }
    url = f"{_base_url()}/api/partner/coupons/issue"

    success = False
    http_status: Optional[int] = None
    error_text: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, content=body, headers=headers)
        http_status = r.status_code
        success = r.status_code == 200
        if not success:
            error_text = (r.text or "")[:500]
            logger.warning(
                "issue_amardeep_voucher non-200 %s body=%s",
                r.status_code, error_text,
            )
    except Exception as e:
        error_text = str(e)
        logger.warning("issue_amardeep_voucher failed: %s", e)

    if db is not None:
        try:
            from services.partner_reconcile import record_outbound_attempt
            await record_outbound_attempt(
                db, op="issue", code=code, payload=payload,
                success=success, http_status=http_status, error=error_text,
            )
        except Exception as e:
            logger.warning("partner_sync_log write failed: %s", e)

    return payload if success else None


# ---------- Outbound: validate an AMD-GIFT coupon ----------
async def validate_amardeep_coupon(
    code: str, *, sku: str = "MEHARISHI_DHOOP", site: str = "addrika",
) -> dict:
    """Proxy a validate call to Amardeep. Returns the partner response dict.

    Shape on success: `{valid: true, coupon: {...}}`.
    On network / 4xx errors: `{valid: false, error: "..."}`.
    """
    if not is_configured():
        return {"valid": False, "error": "partner integration not configured"}
    body = json.dumps({"code": code, "site": site, "sku": sku}).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Partner-Signature": partner_signature(body),
    }
    url = f"{_base_url()}/api/partner/coupons/validate"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(url, content=body, headers=headers)
        if r.status_code == 200:
            data = r.json()
            # Normalise to always carry `valid`
            if "valid" not in data:
                data["valid"] = True
            return data
        try:
            detail = r.json().get("detail") or r.json().get("error") or r.text
        except Exception:
            detail = r.text or f"partner error ({r.status_code})"
        return {"valid": False, "error": detail}
    except Exception as e:
        logger.warning("validate_amardeep_coupon failed: %s", e)
        return {"valid": False, "error": "partner temporarily unavailable"}


# ---------- Outbound: redeem an AMD-GIFT coupon ----------
async def redeem_amardeep_coupon(code: str, order_ref: str, db=None) -> bool:
    """Mark an AMD-GIFT-* coupon as used on Amardeep. Best-effort.

    When `db` is provided, every attempt is logged into `partner_sync_log`
    so the nightly reconciliation cron can replay failures (this matters
    a lot for redemption — un-redeemed coupons could be double-spent).
    """
    if not is_configured():
        return False
    payload = {"code": code, "order_ref": order_ref}
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Partner-Signature": partner_signature(body),
    }
    url = f"{_base_url()}/api/partner/coupons/redeem"

    success = False
    http_status: Optional[int] = None
    error_text: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(url, content=body, headers=headers)
        http_status = r.status_code
        success = r.status_code == 200
        if not success:
            error_text = (r.text or "")[:500]
            logger.warning(
                "redeem_amardeep_coupon non-200 %s body=%s",
                r.status_code, error_text,
            )
    except Exception as e:
        error_text = str(e)
        logger.warning("redeem_amardeep_coupon failed: %s", e)

    if db is not None:
        try:
            from services.partner_reconcile import record_outbound_attempt
            await record_outbound_attempt(
                db, op="redeem", code=code, payload=payload,
                success=success, http_status=http_status, error=error_text,
            )
        except Exception as e:
            logger.warning("partner_sync_log write failed: %s", e)

    return success


# ---------- Local DB helper: persist an incoming AMD-GIFT coupon mirror ----
async def persist_partner_coupon_mirror(db, payload: dict) -> dict:
    """Write an incoming AMD-GIFT-* coupon into Addrika's `discount_codes`
    collection so admins see it in the existing admin UI and customers see
    it on their account page. Validation at checkout time still remotely
    verifies with Amardeep (single source of truth).

    Idempotent — re-pushing the same code just bumps `updated_at`.
    """
    code_upper = (payload.get("code") or "").upper()
    if not code_upper:
        raise ValueError("missing code")

    now = datetime.now(timezone.utc).isoformat()
    value_inr = float(payload.get("value_inr") or 0)
    doc = {
        "code": code_upper,
        "discount_type": payload.get("discount_type") or "fixed",
        "discount_value": value_inr,
        "min_order_value": 0,
        "max_uses": 1,
        "times_used": 0,
        "is_active": True,
        "usage_type": "limited",
        "expires_at": payload.get("valid_until"),
        "description": payload.get("label") or "Partner gift coupon",
        "partner_source": payload.get("issued_by") or "amardeep",
        "partner_redeemable_on": payload.get("redeemable_on") or "addrika",
        "partner_applies_to_sku": payload.get("applies_to_service_id"),
        "partner_user_email": (payload.get("user_email") or "").lower(),
        "partner_source_order_ref": payload.get("source_order_ref"),
        "updated_at": now,
    }
    res = await db.discount_codes.find_one_and_update(
        {"code": code_upper},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=True,
    )
    # Strip _id for JSON safety
    if res and "_id" in res:
        res.pop("_id", None)
    return res or {**doc, "created_at": now}
