"""
Phone OTP verification for retailer registration.

Uses Twilio Verify when configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
TWILIO_VERIFY_SERVICE_SID). When Twilio is NOT configured it falls back to a
DEV mode that generates a local 6-digit code (returned in the API response and
logged) so the flow can be exercised end-to-end without real SMS. The moment
the three Twilio env vars are populated, real SMS OTPs are used automatically.
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


def _cfg():
    return (
        os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        os.environ.get("TWILIO_VERIFY_SERVICE_SID", "").strip(),
    )


def is_configured() -> bool:
    sid, token, service = _cfg()
    return bool(sid and token and service)


def dev_codes_exposed() -> bool:
    """Whether the DEV fallback code may be returned in API responses.

    OFF unless ALLOW_DEV_OTP=1 is set explicitly, so production never leaks a
    one-time code to the caller even if Twilio is misconfigured.
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

    if is_configured():
        sid, token, service = _cfg()
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            client.verify.v2.services(service).verifications.create(to=e164, channel="sms")
        except Exception as e:
            logger.error(f"Twilio send_otp failed for {e164}: {e}")
            return {"status": "error", "error": "Could not send the OTP right now. Please try again."}
        await db.phone_otps.update_one(
            {"phone": e164},
            {"$set": {"phone": e164, "provider": "twilio", "last_sent_at": _now().isoformat()}},
            upsert=True,
        )
        return {"status": "pending", "dev_mode": False}

    # ---- DEV fallback (Twilio not configured) ----
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
    logger.warning(f"[DEV OTP] {e164} -> {code} (Twilio not configured; no real SMS sent)")
    out = {"status": "pending", "dev_mode": True}
    if dev_codes_exposed():
        out["dev_code"] = code
    return out


async def verify_otp(e164: str, code: str) -> dict:
    code = (code or "").strip()

    if is_configured():
        sid, token, service = _cfg()
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            check = client.verify.v2.services(service).verification_checks.create(to=e164, code=code)
            approved = check.status == "approved"
        except Exception as e:
            logger.error(f"Twilio verify_otp failed for {e164}: {e}")
            return {"verified": False, "error": "Verification failed. Please try again."}
        if approved:
            await _mark_verified(e164)
        return {"verified": approved, "error": None if approved else "Incorrect or expired code."}

    # ---- DEV fallback ----
    rec = await db.phone_otps.find_one({"phone": e164})
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
