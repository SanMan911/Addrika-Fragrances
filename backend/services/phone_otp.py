"""
Phone OTP verification for retailer registration and passwordless login.

Provider: **MSG91 OTP API v5** (India-first, DLT-registered SMS).
Replaced Twilio Verify in Sept 2026 — Twilio's per-verification platform fee
made Indian OTPs ~15x costlier and its trial mode blocked unverified numbers.

Configured via MSG91_AUTH_KEY (+ optional MSG91_TEMPLATE_ID). When the auth key
is absent the module falls back to a DEV mode that generates a local 6-digit
code so the whole flow can be exercised without sending real SMS. The public
contract (`to_e164`, `send_otp`, `verify_otp`, `is_phone_verified`) is
unchanged, so callers in routers/ needed no edits.
"""
import os
import logging
import random
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta

import requests

from dependencies import db

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600  # dev code lifetime (10 min)
OTP_EXPIRY_MINUTES = 10  # what we ask MSG91 to enforce
RESEND_COOLDOWN_SECONDS = 30
MAX_VERIFY_ATTEMPTS = 5
VERIFIED_WINDOW_MINUTES = 120  # how long a verified phone stays valid for registration

MSG91_BASE = "https://control.msg91.com/api/v5/otp"
HTTP_TIMEOUT = 20


def _auth_key() -> str:
    return os.environ.get("MSG91_AUTH_KEY", "").strip()


def _template_id() -> str:
    return os.environ.get("MSG91_TEMPLATE_ID", "").strip()


def is_configured() -> bool:
    """True when real SMS can be sent (MSG91 auth key present)."""
    return bool(_auth_key())


def provider_name() -> str:
    return "msg91" if is_configured() else "dev"


def dev_codes_exposed() -> bool:
    """Whether the DEV fallback code may be returned in API responses.

    OFF unless ALLOW_DEV_OTP=1 is set explicitly, so production never leaks a
    one-time code to the caller even if the provider is misconfigured.
    """
    return os.environ.get("ALLOW_DEV_OTP", "").strip() == "1"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_e164(country_code: str, phone: str) -> str:
    cc = (country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = "+" + cc
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return f"{cc}{digits}"


def to_msg91_mobile(e164: str) -> str:
    """MSG91 wants country code + number, digits only (e.g. 919876543210)."""
    return "".join(ch for ch in (e164 or "") if ch.isdigit())


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _msg91_ok(payload: dict) -> bool:
    return str(payload.get("type", "")).lower() == "success"


async def _msg91_send(mobile: str) -> dict:
    params = {
        "authkey": _auth_key(),
        "mobile": mobile,
        "otp_length": 6,
        "otp_expiry": OTP_EXPIRY_MINUTES,
    }
    if _template_id():
        params["template_id"] = _template_id()

    def _post():
        return requests.post(
            MSG91_BASE,
            params=params,
            headers={"Content-Type": "application/json"},
            timeout=HTTP_TIMEOUT,
        )

    resp = await asyncio.to_thread(_post)
    try:
        data = resp.json()
    except ValueError:
        data = {"type": "error", "message": resp.text[:200]}
    # Never log the auth key or the OTP — only the sanitised provider reply.
    if not _msg91_ok(data):
        logger.error(f"MSG91 send failed ({resp.status_code}): {data}")
    return data


async def _msg91_verify(mobile: str, code: str) -> dict:
    def _get():
        return requests.get(
            f"{MSG91_BASE}/verify",
            params={"mobile": mobile, "otp": code},
            headers={"accept": "application/json", "authkey": _auth_key()},
            timeout=HTTP_TIMEOUT,
        )

    resp = await asyncio.to_thread(_get)
    try:
        data = resp.json()
    except ValueError:
        data = {"type": "error", "message": resp.text[:200]}
    return data


async def send_otp(e164: str) -> dict:
    existing = await db.phone_otps.find_one({"phone": e164})
    if existing and existing.get("last_sent_at"):
        try:
            last = datetime.fromisoformat(existing["last_sent_at"])
            elapsed = (_now() - last).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                return {"status": "cooldown", "retry_after": max(1, RESEND_COOLDOWN_SECONDS - int(elapsed))}
        except Exception:
            pass

    if is_configured():
        data = await _msg91_send(to_msg91_mobile(e164))
        if not _msg91_ok(data):
            return {
                "status": "error",
                "error": "Could not send the OTP right now. Please try again.",
            }
        await db.phone_otps.update_one(
            {"phone": e164},
            {"$set": {
                "phone": e164,
                "provider": "msg91",
                "request_id": data.get("request_id"),
                "last_sent_at": _now().isoformat(),
            }},
            upsert=True,
        )
        return {"status": "pending", "dev_mode": False}

    # ---- DEV fallback (MSG91 not configured) ----
    code = f"{random.randint(0, 999999):06d}"
    await db.phone_otps.update_one(
        {"phone": e164},
        {"$set": {
            "phone": e164,
            "provider": "dev",
            "code_hash": _hash_code(code),
            "expires_at": (_now() + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
            "attempts": 0,
            "last_sent_at": _now().isoformat(),
        }},
        upsert=True,
    )
    logger.warning(f"[DEV OTP] {e164} -> {code} (MSG91 not configured; no real SMS sent)")
    out = {"status": "pending", "dev_mode": True}
    if dev_codes_exposed():
        out["dev_code"] = code
    return out


async def verify_otp(e164: str, code: str) -> dict:
    code = (code or "").strip()

    rec = await db.phone_otps.find_one({"phone": e164})

    # MSG91-issued code
    if is_configured() and (rec is None or rec.get("provider") == "msg91"):
        if rec is not None:
            if rec.get("attempts", 0) >= MAX_VERIFY_ATTEMPTS:
                return {"verified": False, "error": "Too many attempts. Please request a new code."}
            await db.phone_otps.update_one({"phone": e164}, {"$inc": {"attempts": 1}})
        data = await _msg91_verify(to_msg91_mobile(e164), code)
        if _msg91_ok(data):
            await _mark_verified(e164)
            return {"verified": True, "error": None}
        msg = str(data.get("message") or "").lower()
        if "already verified" in msg:
            await _mark_verified(e164)
            return {"verified": True, "error": None}
        if "expire" in msg:
            return {"verified": False, "error": "Code expired. Please request a new one."}
        return {"verified": False, "error": "Incorrect code. Please try again."}

    # ---- DEV fallback ----
    if not rec or rec.get("provider") != "dev" or not rec.get("code_hash"):
        return {"verified": False, "error": "Please request a code first."}
    if rec.get("attempts", 0) >= MAX_VERIFY_ATTEMPTS:
        return {"verified": False, "error": "Too many attempts. Please request a new code."}
    try:
        expires = datetime.fromisoformat(rec["expires_at"])
    except Exception:
        return {"verified": False, "error": "Code expired. Please request a new one."}
    if _now() > expires:
        return {"verified": False, "error": "Code expired. Please request a new one."}
    await db.phone_otps.update_one({"phone": e164}, {"$inc": {"attempts": 1}})
    if _hash_code(code) != rec["code_hash"]:
        return {"verified": False, "error": "Incorrect code. Please try again."}
    await _mark_verified(e164)
    return {"verified": True, "error": None}


async def _mark_verified(e164: str):
    await db.phone_verifications.update_one(
        {"phone": e164},
        {"$set": {"phone": e164, "verified_at": _now().isoformat()}},
        upsert=True,
    )
    await db.phone_otps.delete_one({"phone": e164})


async def is_phone_verified(e164: str) -> bool:
    rec = await db.phone_verifications.find_one({"phone": e164})
    if not rec or not rec.get("verified_at"):
        return False
    try:
        verified_at = datetime.fromisoformat(rec["verified_at"])
    except Exception:
        return False
    return (_now() - verified_at) <= timedelta(minutes=VERIFIED_WINDOW_MINUTES)
