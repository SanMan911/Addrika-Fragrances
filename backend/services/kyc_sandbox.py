"""
Sandbox API KYC Service (https://api.sandbox.co.in)
==================================================
Provides PAN verification + Aadhaar OTP eKYC for B2B retailer onboarding.

Auth flow (Sandbox API v2):
  1. POST /authenticate with headers `x-api-key` + `x-api-secret`
     → returns `{ access_token }` (NOT a bearer token; pass as-is in
     `Authorization` header for subsequent calls).
  2. Token is short-lived (~24h); we cache in-memory until ~5 min before
     expiry.

Endpoints used:
  • GET  /pans/{pan}/verify                 — PAN verification (synthetic on free tier)
  • POST /kyc/aadhaar/okyc/otp              — Generate Aadhaar OTP
  • POST /kyc/aadhaar/okyc/otp/verify       — Verify OTP, returns name/dob/address

If `SANDBOX_API_KEY` / `SANDBOX_API_SECRET` are blank, all functions
return `{verified: False, error: "...", not_configured: True}` so callers
can degrade gracefully (same pattern as `gst_verification.py`).
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.sandbox.co.in"
TOKEN_REFRESH_BUFFER = timedelta(minutes=5)

# In-process token cache. Single-tenant — fine for our scale.
_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": None}


def _read_creds() -> tuple[str, str, str]:
    """Read credentials at call time so reloads pick up env changes."""
    return (
        os.environ.get("SANDBOX_API_KEY", "").strip(),
        os.environ.get("SANDBOX_API_SECRET", "").strip(),
        os.environ.get("SANDBOX_API_VERSION", "1.0").strip() or "1.0",
    )


def is_configured() -> bool:
    key, secret, _ = _read_creds()
    return bool(key and secret)


async def _authenticate() -> Optional[str]:
    """Get a fresh access_token. Caches in-memory until expiry-buffer."""
    api_key, api_secret, api_version = _read_creds()
    if not (api_key and api_secret):
        return None

    now = datetime.now(timezone.utc)
    if (
        _token_cache["access_token"]
        and _token_cache["expires_at"]
        and _token_cache["expires_at"] - TOKEN_REFRESH_BUFFER > now
    ):
        return _token_cache["access_token"]

    headers = {
        "x-api-key": api_key,
        "x-api-secret": api_secret,
        "x-api-version": api_version,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{BASE_URL}/authenticate", headers=headers)
        if r.status_code != 200:
            logger.error(f"Sandbox auth HTTP {r.status_code}: {r.text[:200]}")
            return None
        data = r.json()
        token = data.get("access_token")
        if not token:
            logger.error(f"Sandbox auth missing access_token: {data}")
            return None
        # Sandbox tokens are typically valid 24h; we refresh after ~23h55m.
        _token_cache["access_token"] = token
        _token_cache["expires_at"] = now + timedelta(hours=24)
        return token
    except Exception as e:
        logger.error(f"Sandbox authenticate error: {e}")
        return None


def _auth_headers(token: str) -> Dict[str, str]:
    api_key, _, api_version = _read_creds()
    return {
        "Authorization": token,
        "x-api-key": api_key,
        "x-api-version": api_version,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _extract_error_message(response) -> Optional[str]:
    """Pull the human-readable message out of a Sandbox error response."""
    try:
        body = response.json()
        if isinstance(body, dict):
            return (
                body.get("message")
                or body.get("error")
                or (body.get("data") or {}).get("message")
            )
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# PAN Verification
# ---------------------------------------------------------------------------
async def verify_pan(pan_number: str, name_to_match: str = "") -> Dict[str, Any]:
    """Verify a PAN against ITD records. Returns a normalized dict."""
    pan = (pan_number or "").upper().strip()
    if len(pan) != 10:
        return {"verified": False, "error": "Invalid PAN format"}

    if not is_configured():
        return {
            "verified": False,
            "error": "Sandbox KYC API not configured",
            "not_configured": True,
        }

    token = await _authenticate()
    if not token:
        return {"verified": False, "error": "Sandbox authentication failed"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            params = {"consent": "Y", "reason": "Retailer KYC for B2B onboarding"}
            if name_to_match:
                params["name_as_per_pan_match"] = name_to_match
            r = await client.get(
                f"{BASE_URL}/pans/{pan}/verify",
                headers=_auth_headers(token),
                params=params,
            )
        if r.status_code != 200:
            logger.error(f"Sandbox PAN verify HTTP {r.status_code}: {r.text[:200]}")
            err_msg = _extract_error_message(r) or f"Sandbox API error ({r.status_code})"
            return {"verified": False, "error": err_msg}
        return _shape_pan_response(r.json(), pan)
    except httpx.TimeoutException:
        return {"verified": False, "error": "Sandbox API timeout"}
    except Exception as e:
        logger.error(f"Sandbox PAN verify error: {e}")
        return {"verified": False, "error": str(e)}


def _shape_pan_response(payload: Dict[str, Any], pan: str) -> Dict[str, Any]:
    """Normalize Sandbox PAN response into our internal shape."""
    # Sandbox responses may be nested under data/result/etc. Be defensive.
    body = payload.get("data") or payload.get("result") or payload
    status_value = (
        body.get("status") or body.get("pan_status") or payload.get("status") or ""
    ).strip()
    is_valid = status_value.lower() in {"valid", "active", "existing", "e"}
    full_name = (
        body.get("full_name")
        or body.get("name_as_per_pan")
        or body.get("name")
        or ""
    )
    name_match = body.get("name_as_per_pan_match")

    return {
        "verified": bool(is_valid or full_name),
        "provider": "sandbox",
        "pan_number": pan,
        "status": status_value,
        "is_valid": is_valid,
        "full_name": full_name,
        "category": body.get("category") or body.get("pan_type"),
        "aadhaar_seeding_status": body.get("aadhaar_seeding_status"),
        "name_match": name_match,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "raw": payload,
    }


# ---------------------------------------------------------------------------
# Aadhaar OTP (e-KYC)
# ---------------------------------------------------------------------------
async def aadhaar_generate_otp(aadhaar_number: str) -> Dict[str, Any]:
    """Trigger an OTP to the mobile linked with the Aadhaar."""
    aadhaar = (aadhaar_number or "").replace(" ", "").replace("-", "").strip()
    if len(aadhaar) != 12 or not aadhaar.isdigit():
        return {"ok": False, "error": "Invalid Aadhaar number"}

    if not is_configured():
        return {
            "ok": False,
            "error": "Sandbox KYC API not configured",
            "not_configured": True,
        }

    token = await _authenticate()
    if not token:
        return {"ok": False, "error": "Sandbox authentication failed"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                f"{BASE_URL}/kyc/aadhaar/okyc/otp",
                headers=_auth_headers(token),
                json={
                    "aadhaar_number": aadhaar,
                    "consent": "y",
                    "reason": "Retailer KYC for B2B onboarding",
                },
            )
        if r.status_code != 200:
            logger.error(f"Sandbox Aadhaar OTP HTTP {r.status_code}: {r.text[:200]}")
            return {"ok": False, "error": f"OTP request failed ({r.status_code})"}
        body = r.json()
        data = body.get("data") or body
        ref_id = (
            data.get("ref_id")
            or data.get("reference_id")
            or data.get("transaction_id")
        )
        if not ref_id:
            return {"ok": False, "error": "OTP reference id missing", "raw": body}
        return {
            "ok": True,
            "reference_id": str(ref_id),
            "message": data.get("message") or "OTP sent to Aadhaar-linked mobile",
        }
    except httpx.TimeoutException:
        return {"ok": False, "error": "Sandbox API timeout"}
    except Exception as e:
        logger.error(f"Sandbox Aadhaar OTP error: {e}")
        return {"ok": False, "error": str(e)}


async def aadhaar_verify_otp(reference_id: str, otp: str) -> Dict[str, Any]:
    """Verify the OTP and return demographic data from UIDAI."""
    ref_id = (reference_id or "").strip()
    otp_value = (otp or "").strip()
    if not ref_id:
        return {"verified": False, "error": "Missing reference_id"}
    if len(otp_value) != 6 or not otp_value.isdigit():
        return {"verified": False, "error": "OTP must be 6 digits"}

    if not is_configured():
        return {
            "verified": False,
            "error": "Sandbox KYC API not configured",
            "not_configured": True,
        }

    token = await _authenticate()
    if not token:
        return {"verified": False, "error": "Sandbox authentication failed"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                f"{BASE_URL}/kyc/aadhaar/okyc/otp/verify",
                headers=_auth_headers(token),
                json={"reference_id": ref_id, "otp": otp_value},
            )
        if r.status_code != 200:
            logger.error(f"Sandbox Aadhaar verify HTTP {r.status_code}: {r.text[:200]}")
            err_msg = _extract_error_message(r) or f"OTP verify failed ({r.status_code})"
            return {"verified": False, "error": err_msg}
        return _shape_aadhaar_verify(r.json())
    except httpx.TimeoutException:
        return {"verified": False, "error": "Sandbox API timeout"}
    except Exception as e:
        logger.error(f"Sandbox Aadhaar verify error: {e}")
        return {"verified": False, "error": str(e)}


def _shape_aadhaar_verify(payload: Dict[str, Any]) -> Dict[str, Any]:
    body = payload.get("data") or payload.get("result") or payload
    aadhaar_data = body.get("aadhaar_data") or body
    name = aadhaar_data.get("name") or aadhaar_data.get("full_name") or ""
    address_obj = aadhaar_data.get("address") or {}
    if isinstance(address_obj, dict):
        address_str = ", ".join(
            v for v in [
                address_obj.get("house"),
                address_obj.get("street"),
                address_obj.get("landmark"),
                address_obj.get("locality"),
                address_obj.get("vtc"),
                address_obj.get("po"),
                address_obj.get("subdist"),
                address_obj.get("district"),
                address_obj.get("state"),
                address_obj.get("pincode") or address_obj.get("pc"),
                address_obj.get("country"),
            ] if v
        )
    else:
        address_str = str(address_obj)

    aadhaar_number = aadhaar_data.get("aadhaar_number") or ""
    last4 = aadhaar_number[-4:] if len(aadhaar_number) >= 4 else ""

    return {
        "verified": bool(name),
        "provider": "sandbox",
        "name": name,
        "dob": aadhaar_data.get("date_of_birth") or aadhaar_data.get("dob"),
        "gender": aadhaar_data.get("gender"),
        "address": address_str,
        "address_obj": address_obj if isinstance(address_obj, dict) else None,
        "pincode": (
            (address_obj.get("pincode") or address_obj.get("pc"))
            if isinstance(address_obj, dict)
            else None
        ),
        "state": address_obj.get("state") if isinstance(address_obj, dict) else None,
        "aadhaar_last_4": last4,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "raw": payload,
    }
