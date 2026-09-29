"""
Phone OTP verification for retailer registration and passwordless login.

Provider: **none currently wired.** MSG91 was removed in June 2026 because plain
SMS OTP to Indian numbers always needs a DLT-registered template (a TRAI rule,
not an MSG91 limitation). The next provider will most likely be a GST OTP /
consent-based taxpayer-auth API (e.g. Surepass / Sandbox) whose OTP is sent by
the GST portal itself, so the app needs no DLT template of its own.

Until then this module runs in DEV mode: it generates a local 6-digit code and
(when ALLOW_DEV_OTP=1) returns it in the API response so the whole flow can be
exercised without sending real SMS. The public contract (`to_e164`, `send_otp`,
`verify_otp`, `is_phone_verified`) is unchanged, so callers in routers/ need no
edits when a real provider is plugged in later.
"""
import os
import logging
import random
import hashlib
from datetime import datetime, timezone, timedelta

from dependencies import db

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600  # dev code lifetime (10 min)
RESEND_COOLDOWN_SECONDS = 30
MAX_VERIFY_ATTEMPTS = 5
VERIFIED_WINDOW_MINUTES = 120  # how long a verified phone stays valid for registration


def is_configured() -> bool:
    """True when a real SMS/OTP provider is wired. None currently."""
    return False


def provider_name() -> str:
    return "dev"


def dev_codes_exposed() -> bool:
    """Whether the DEV code may be returned in API responses (ALLOW_DEV_OTP=1)."""
    return os.environ.get("ALLOW_DEV_OTP", "").strip() == "1"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_e164(country_code: str, phone: str) -> str:
    cc = (country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = "+" + cc
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return f"{cc}{digits}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


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

    # ---- DEV OTP (no SMS provider wired) ----
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
    logger.warning(f"[DEV OTP] {e164} -> {code} (no SMS provider wired; no real SMS sent)")
    out = {"status": "pending", "dev_mode": True}
    if dev_codes_exposed():
        out["dev_code"] = code
    return out


async def verify_otp(e164: str, code: str) -> dict:
    code = (code or "").strip()
    rec = await db.phone_otps.find_one({"phone": e164})

    if not rec or not rec.get("code_hash"):
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
