"""IDSPay "GST To Contact Details" KYB client.

Official spec (ServiceDocumentation.pdf v1.0, supplied by the client):
  UAT   base : https://javabackend.idspay.in/api/v1/uat
  PROD  base : https://javabackend.idspay.in/api/v1/prod
  Endpoint   : POST /srv2/validation/kyb/gst-to-contacts
  Credentials travel in the JSON BODY (not headers):
      {"api_id", "api_key", "token_id", "gstin"}
  Success    : {"status":{"code":200,"type":"success",...},
                "data":{"mobile":"...","email":"..."}}
  Failure    : {"status":{"code":500,"type":"error",...},"error":{...}}

IDSPay documents NO OTP endpoint, so ownership proof is done by emailing our
own OTP to the fetched address (see services/gst_email_otp.py).

Keys are env placeholders only. When unset the module reports `not_configured`
and NEVER fabricates a contact or a verified result.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from dependencies import db

logger = logging.getLogger(__name__)

BASES = {
    "uat": "https://javabackend.idspay.in/api/v1/uat",
    "prod": "https://javabackend.idspay.in/api/v1/prod",
}
PATH = "/srv2/validation/kyb/gst-to-contacts"

GST_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")

# A run of 2+ redaction chars, or an explicit placeholder word. Deliberately
# NOT a single "x" — real addresses legitimately contain one.
MASK_RE = re.compile(
    r"(?:x{2,}|\*{2,}|\u2026|\.\.\.|masked|redacted|hidden|not[\s-]?available)",
    re.IGNORECASE,
)

CACHE_TTL_DAYS = 30
FAILURE_CACHE_SECONDS = 120  # never cache a failure for 30 days
_PLACEHOLDER_HINTS = ("replace_with", "your_", "xxx", "changeme", "placeholder")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean(v: Optional[str]) -> Optional[str]:
    return v.strip() if isinstance(v, str) and v.strip() else None


def _is_placeholder(v: str) -> bool:
    low = v.lower()
    return any(h in low for h in _PLACEHOLDER_HINTS)


def _credentials() -> Optional[dict]:
    """Return credentials, or None when IDSPay isn't really configured."""
    env = (os.environ.get("IDSPAY_ENV") or "").strip().lower()
    api_id = (os.environ.get("IDSPAY_API_ID") or "").strip()
    api_key = (os.environ.get("IDSPAY_API_KEY") or "").strip()
    token_id = (os.environ.get("IDSPAY_TOKEN_ID") or "").strip()
    if env not in BASES:
        return None
    if not (api_id and api_key and token_id):
        return None
    # Unreplaced placeholders must behave exactly like "unset".
    if any(_is_placeholder(v) for v in (api_id, api_key, token_id)):
        return None
    return {"env": env, "api_id": api_id, "api_key": api_key, "token_id": token_id}


def is_configured() -> bool:
    return _credentials() is not None


def usable_email(value: Optional[str]) -> Optional[str]:
    """Normalized email, or None when absent / masked / invalid."""
    v = _clean(value)
    if not v or MASK_RE.search(v):
        return None
    v = v.lower()
    return v if EMAIL_RE.match(v) else None


def usable_mobile(value: Optional[str]) -> Optional[str]:
    """Digits-only mobile, or None when absent / masked / unusable."""
    v = _clean(value)
    if not v or MASK_RE.search(v):
        return None
    digits = re.sub(r"\D", "", v)
    return digits if 10 <= len(digits) <= 15 else None


def mask_email_hint(email: str) -> str:
    """Server-side hint so the browser never receives the full GST email."""
    local, _, domain = email.partition("@")
    if not domain:
        return "***"
    shown = local[:2] if len(local) > 3 else local[:1]
    return f"{shown}{'*' * max(3, len(local) - len(shown))}@{domain}"


def mask_mobile_hint(mobile: str) -> str:
    return f"{'*' * max(0, len(mobile) - 4)}{mobile[-4:]}" if len(mobile) >= 4 else "****"


async def _call_idspay(gstin: str, creds: dict) -> dict:
    """POST to IDSPay. Returns a normalized result dict; never raises upward."""
    payload = {
        "api_id": creds["api_id"],
        "api_key": creds["api_key"],
        "token_id": creds["token_id"],
        "gstin": gstin,
    }
    url = f"{BASES[creds['env']]}{PATH}"
    timeout = httpx.Timeout(connect=5.0, read=20.0, write=5.0, pool=5.0)
    last_transport_error: Optional[str] = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
            try:
                body = r.json()
            except ValueError:
                # Never log the body: it echoes credentials.
                logger.error(f"idspay: non-JSON response http={r.status_code}")
                return {"ok": False, "error": "IDSPay returned an unreadable response.", "provider_down": True}

            status = body.get("status") or {}
            nested_code = status.get("code")
            nested_type = str(status.get("type") or "").lower()
            ok = r.is_success and nested_code == 200 and nested_type == "success"
            if not ok:
                err_obj = body.get("error") or {}
                detail = err_obj.get("error") or status.get("message") or body.get("message") or "Details fetching failed"
                req_id = err_obj.get("request_id")
                logger.warning(f"idspay: lookup failed http={r.status_code} code={nested_code} req={req_id} detail={detail}")
                # Documented failures are definitive — do not burn another call.
                return {
                    "ok": False,
                    "error": str(detail),
                    "provider_down": False,
                    "request_id": req_id,
                }

            data = body.get("data") or {}
            raw_email = _clean(data.get("email"))
            raw_mobile = _clean(data.get("mobile"))
            email = usable_email(raw_email)
            mobile = usable_mobile(raw_mobile)
            logger.info(
                f"idspay: lookup ok gstin={gstin} email_usable={bool(email)} mobile_usable={bool(mobile)}"
            )
            return {
                "ok": True,
                "email": email,
                "mobile": mobile,
                "email_masked": bool(raw_email) and not email,
                "mobile_masked": bool(raw_mobile) and not mobile,
            }
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPError) as exc:
            last_transport_error = type(exc).__name__
            if attempt < 2:
                await asyncio.sleep(0.25 * (2 ** attempt))

    logger.error(f"idspay: unavailable after retries ({last_transport_error})")
    return {"ok": False, "error": "IDSPay is unreachable right now. Please try again.", "provider_down": True}


async def fetch_contacts(gstin: str, *, use_cache: bool = True) -> dict:
    """GSTIN -> registered {email, mobile}, cached 30 days (pay-per-use API).

    Returns one of:
      {"status": "not_configured"}
      {"status": "invalid_gstin"}
      {"status": "failed", "error": str, "provider_down": bool}
      {"status": "ok", "email": str|None, "mobile": str|None,
       "email_masked": bool, "mobile_masked": bool, "cached": bool}
    """
    gst = (gstin or "").upper().strip()
    if not GST_PATTERN.match(gst):
        return {"status": "invalid_gstin"}

    creds = _credentials()
    if not creds:
        return {"status": "not_configured"}

    if use_cache:
        hit = await db.idspay_contact_cache.find_one({"gstin": gst, "expires_at": {"$gt": _now()}})
        if hit:
            if hit.get("ok"):
                return {
                    "status": "ok",
                    "email": hit.get("email"),
                    "mobile": hit.get("mobile"),
                    "email_masked": bool(hit.get("email_masked")),
                    "mobile_masked": bool(hit.get("mobile_masked")),
                    "cached": True,
                }
            return {
                "status": "failed",
                "error": hit.get("error") or "Details fetching failed",
                "provider_down": bool(hit.get("provider_down")),
                "cached": True,
            }

    result = await _call_idspay(gst, creds)
    now = _now()
    if result.get("ok"):
        await db.idspay_contact_cache.update_one(
            {"gstin": gst},
            {"$set": {
                "gstin": gst,
                "ok": True,
                "email": result.get("email"),
                "mobile": result.get("mobile"),
                "email_masked": result.get("email_masked", False),
                "mobile_masked": result.get("mobile_masked", False),
                "env": creds["env"],
                "fetched_at": now,
                "expires_at": now + timedelta(days=CACHE_TTL_DAYS),
            }},
            upsert=True,
        )
        return {
            "status": "ok",
            "email": result.get("email"),
            "mobile": result.get("mobile"),
            "email_masked": result.get("email_masked", False),
            "mobile_masked": result.get("mobile_masked", False),
            "cached": False,
        }

    # Cache failures only briefly so a transient outage can't poison 30 days.
    await db.idspay_contact_cache.update_one(
        {"gstin": gst},
        {"$set": {
            "gstin": gst,
            "ok": False,
            "error": result.get("error"),
            "provider_down": result.get("provider_down", False),
            "env": creds["env"],
            "fetched_at": now,
            "expires_at": now + timedelta(seconds=FAILURE_CACHE_SECONDS),
        }},
        upsert=True,
    )
    return {
        "status": "failed",
        "error": result.get("error") or "Details fetching failed",
        "provider_down": result.get("provider_down", False),
        "cached": False,
    }
