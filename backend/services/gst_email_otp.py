"""Email OTP ownership proof for the GST-registered address fetched from IDSPay.

IDSPay exposes no OTP endpoint, so we mint and verify the code ourselves and
deliver it with the already-live Resend integration.

Security properties:
  * 6-digit code from `secrets`, never stored — only an HMAC-SHA256 digest
    peppered with OTP_PEPPER and bound to the challenge_id.
  * 10-minute TTL, 5 verification attempts, 60s resend cooldown.
  * Per-GSTIN (5/hour) and per-IP (20/hour) send limits, counted in Mongo so
    the limit holds across backend instances.
  * Single-use: verification is an atomic conditional update, so two parallel
    requests cannot both consume one code.
  * On success a short-lived onboarding session records the verified
    (gstin, email) pair. Registration derives identity from that session, so a
    client cannot skip the OTP or register a different email.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from dependencies import db

logger = logging.getLogger(__name__)

OTP_TTL = timedelta(minutes=10)
SESSION_TTL = timedelta(minutes=30)
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)
PER_GSTIN_HOURLY = 5
PER_IP_HOURLY = 20
PURPOSE = "gst_email_ownership"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt):
    """Mongo returns naive UTC datetimes — coerce before comparing."""
    if isinstance(dt, datetime) and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _pepper() -> bytes:
    p = (os.environ.get("OTP_PEPPER") or "").strip()
    if not p:
        # Fail closed: without a pepper the digest would be brute-forceable.
        raise RuntimeError("OTP_PEPPER is not configured")
    return p.encode()


def _digest(challenge_id: str, code: str) -> str:
    return hmac.new(_pepper(), f"{challenge_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _new_id() -> str:
    return secrets.token_urlsafe(32)


def _otp_email_html(code: str, business: Optional[str]) -> str:
    who = f" for <b>{business}</b>" if business else ""
    return f"""
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto">
      <div style="background:#1e3a52;padding:24px;text-align:center">
        <h1 style="color:#d4af37;margin:0;font-size:24px">AAROHMM</h1>
        <p style="color:#ffffff;margin:4px 0 0;font-size:12px">Where Fragrance Becomes Atmosphere…</p>
      </div>
      <div style="padding:28px;border:1px solid #e5e0d8;border-top:none">
        <h2 style="color:#1e3a52;margin:0 0 8px">Verify your business email</h2>
        <p style="color:#4a4a4a">This address is registered against your GSTIN{who}.
        Enter the code below to confirm you own this business and continue your
        Aarohmm wholesale onboarding.</p>
        <div style="background:#f9f7f4;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
          <p style="color:#6b6357;font-size:11px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Your verification code</p>
          <p style="color:#1e3a52;font-size:34px;font-weight:bold;letter-spacing:8px;margin:0">{code}</p>
        </div>
        <p style="color:#6b6357;font-size:12px">The code expires in 10 minutes and can be used once.
        If you did not request this, you can ignore this email — no account is created without it.</p>
      </div>
    </div>
    """


async def _hourly_count(field: str, value: str) -> int:
    return await db.gst_otp_challenges.count_documents({
        "purpose": PURPOSE,
        field: value,
        "created_at": {"$gt": _now() - timedelta(hours=1)},
    })


async def issue_otp(gstin: str, email: str, *, ip: str = "", business_name: Optional[str] = None,
                    meta: Optional[dict] = None) -> dict:
    """Create a challenge and email the code. Returns {ok, challenge_id, expires_in} or {ok:False, ...}.

    `meta` (e.g. the entered-vs-GST-record comparison) is carried through to the
    onboarding session so registration can persist it for admin review.
    """
    from services.email_service import send_email

    t = _now()

    recent = await db.gst_otp_challenges.find_one({
        "purpose": PURPOSE,
        "gstin": gstin,
        "created_at": {"$gt": t - RESEND_COOLDOWN},
    })
    if recent:
        wait = int((_aware(recent["created_at"]) + RESEND_COOLDOWN - t).total_seconds()) or 1
        return {"ok": False, "reason": "cooldown", "retry_after": wait}

    if await _hourly_count("gstin", gstin) >= PER_GSTIN_HOURLY:
        return {"ok": False, "reason": "rate_limited"}
    if ip and await _hourly_count("request_ip", ip) >= PER_IP_HOURLY:
        return {"ok": False, "reason": "rate_limited"}

    challenge_id = _new_id()
    code = _new_code()

    # Supersede any still-open challenge for this GSTIN.
    await db.gst_otp_challenges.update_many(
        {"purpose": PURPOSE, "gstin": gstin, "consumed_at": None, "invalidated_at": None},
        {"$set": {"invalidated_at": t}},
    )
    await db.gst_otp_challenges.insert_one({
        "challenge_id": challenge_id,
        "purpose": PURPOSE,
        "gstin": gstin,
        "email": email,
        "code_digest": _digest(challenge_id, code),
        "attempts": 0,
        "created_at": t,
        "expires_at": t + OTP_TTL,
        "consumed_at": None,
        "invalidated_at": None,
        "request_ip": ip or None,
        "meta": meta or {},
    })

    sent = await send_email(email, "Your Aarohmm business verification code", _otp_email_html(code, business_name))
    if not sent:
        await db.gst_otp_challenges.update_one(
            {"challenge_id": challenge_id}, {"$set": {"invalidated_at": _now()}}
        )
        logger.error(f"gst email otp: delivery FAILED gstin={gstin}")
        return {"ok": False, "reason": "send_failed"}

    logger.info(f"gst email otp: issued gstin={gstin} challenge={challenge_id[:8]}…")
    return {"ok": True, "challenge_id": challenge_id, "expires_in": int(OTP_TTL.total_seconds())}


async def verify_otp(challenge_id: str, code: str, *, ip: str = "") -> dict:
    """Consume a challenge. Returns {ok:True, onboarding_session, gstin, email} or {ok:False, reason}."""
    t = _now()
    c = await db.gst_otp_challenges.find_one({"challenge_id": challenge_id, "purpose": PURPOSE})
    if not c or c.get("invalidated_at") or c.get("consumed_at") or _aware(c["expires_at"]) <= t:
        return {"ok": False, "reason": "invalid"}
    if c.get("attempts", 0) >= MAX_ATTEMPTS:
        return {"ok": False, "reason": "too_many_attempts"}

    submitted = "".join(ch for ch in (code or "") if ch.isdigit())
    if not hmac.compare_digest(c["code_digest"], _digest(challenge_id, submitted)):
        await db.gst_otp_challenges.update_one({"_id": c["_id"]}, {"$inc": {"attempts": 1}})
        return {"ok": False, "reason": "invalid"}

    claimed = await db.gst_otp_challenges.update_one(
        {"_id": c["_id"], "consumed_at": None, "invalidated_at": None,
         "expires_at": {"$gt": t}, "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$set": {"consumed_at": t, "verified_ip": ip or None}},
    )
    if claimed.modified_count != 1:
        return {"ok": False, "reason": "invalid"}

    session_id = _new_id()
    await db.gst_onboarding_sessions.insert_one({
        "session_id": session_id,
        "challenge_id": challenge_id,
        "gstin": c["gstin"],
        "verified_email": c["email"],
        "meta": c.get("meta") or {},
        "created_at": t,
        "expires_at": t + SESSION_TTL,
        "consumed_at": None,
    })
    logger.info(f"gst email otp: verified gstin={c['gstin']}")
    return {
        "ok": True,
        "onboarding_session": session_id,
        "gstin": c["gstin"],
        "email": c["email"],
        "meta": c.get("meta") or {},
        "expires_in": int(SESSION_TTL.total_seconds()),
    }


async def peek_session(session_id: str) -> Optional[dict]:
    """Read an unconsumed, unexpired session without claiming it."""
    if not session_id:
        return None
    return await db.gst_onboarding_sessions.find_one({
        "session_id": session_id,
        "consumed_at": None,
        "expires_at": {"$gt": _now()},
    })


async def claim_session(session_id: str) -> Optional[dict]:
    """Atomically consume a session so it cannot register twice."""
    if not session_id:
        return None
    t = _now()
    doc = await db.gst_onboarding_sessions.find_one_and_update(
        {"session_id": session_id, "consumed_at": None, "expires_at": {"$gt": t}},
        {"$set": {"consumed_at": t}},
    )
    return doc


async def ensure_indexes() -> None:
    await db.gst_otp_challenges.create_index("challenge_id", unique=True)
    await db.gst_otp_challenges.create_index("expires_at", expireAfterSeconds=3600)
    await db.gst_otp_challenges.create_index([("gstin", 1), ("created_at", -1)])
    await db.gst_onboarding_sessions.create_index("session_id", unique=True)
    await db.gst_onboarding_sessions.create_index("expires_at", expireAfterSeconds=3600)
    await db.idspay_contact_cache.create_index("gstin", unique=True)
    await db.idspay_contact_cache.create_index("expires_at", expireAfterSeconds=0)
