"""Retailer self-serve password reset.

Design notes (June 2026):
    ▸ The retailer types their GSTIN — the link always goes to the email on
      file, which is never echoed back. Responses are deliberately generic so
      the endpoint can't be used to probe which GSTINs are registered.
    ▸ Tokens are random 32-byte urlsafe values; only their SHA-256 hash is
      stored. Single use, 60-minute expiry, and requesting a new one
      invalidates every outstanding token for that retailer.
    ▸ Resetting revokes all existing retailer sessions and sends a
      "your password changed" confirmation.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

TOKEN_TTL_MINUTES = 60
MAX_REQUESTS_PER_HOUR = 3

COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwerty123", "iloveyou", "admin123", "welcome1", "welcome123", "letmein1",
    "abc12345", "test1234", "india@123", "aarohmm123", "changeme", "passw0rd",
}


def password_problems(password: str) -> list[str]:
    """Server-side password policy. Returns a list of human-readable problems."""
    problems = []
    if len(password) < 8:
        problems.append("Use at least 8 characters")
    if password.lower() in COMMON_PASSWORDS:
        problems.append("That password is too common — pick something unique")
    if password.isdigit():
        problems.append("Add letters, not just numbers")
    if password.isalpha():
        problems.append("Add a number or symbol")
    if len(set(password)) <= 2:
        problems.append("Too repetitive — mix in more characters")
    return problems


def portal_url() -> str:
    return os.environ.get(
        "FRONTEND_PUBLIC_URL",
        "https://aaroviah-retail.preview.emergentagent.com",
    ).rstrip("/")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_match(token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), stored_hash or "")


async def ensure_indexes(db) -> None:
    try:
        await db.retailer_password_resets.create_index("expires_at", expireAfterSeconds=0)
        await db.retailer_password_resets.create_index("token_hash")
    except Exception as e:  # noqa: BLE001
        logger.warning("password-reset indexes not created: %s", e)


async def too_many_requests(db, gstin: str, ip: str | None) -> bool:
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    keys = [{"gstin": gstin}]
    if ip:
        keys.append({"ip": ip})
    count = await db.retailer_password_resets.count_documents({
        "$or": keys,
        "created_at_dt": {"$gte": since},
    })
    return count >= MAX_REQUESTS_PER_HOUR


async def issue_reset_token(db, retailer: dict, ip: str | None) -> str:
    """Invalidate outstanding tokens and mint a fresh one. Returns the raw token."""
    now = datetime.now(timezone.utc)
    await db.retailer_password_resets.update_many(
        {"retailer_id": retailer["retailer_id"], "used_at": None},
        {"$set": {"used_at": now.isoformat(), "superseded": True}},
    )
    token = secrets.token_urlsafe(32)
    await db.retailer_password_resets.insert_one({
        "id": f"PWR-{uuid.uuid4().hex[:10].upper()}",
        "retailer_id": retailer["retailer_id"],
        "gstin": (retailer.get("gst_number") or "").upper(),
        "token_hash": hash_token(token),
        "expires_at": now + timedelta(minutes=TOKEN_TTL_MINUTES),
        "created_at_dt": now,
        "created_at": now.isoformat(),
        "used_at": None,
        "ip": ip,
    })
    return token


async def find_valid_token(db, token: str) -> dict | None:
    row = await db.retailer_password_resets.find_one({"token_hash": hash_token(token)})
    if not row or row.get("used_at"):
        return None
    expires = row.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        return None
    return row


async def send_reset_email(retailer: dict, token: str) -> bool:
    from services.email_service import send_email

    link = f"{portal_url()}/retailer/reset-password?token={token}"
    name = retailer.get("business_name") or retailer.get("name") or "Partner"
    gstin = (retailer.get("gst_number") or "").upper()
    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:#1e3a52;padding:24px;text-align:center;">
          <h1 style="color:#d4af37;margin:0;letter-spacing:2px;">AAROHMM</h1>
          <p style="color:#fff;margin:6px 0 0;font-size:13px;">Retailer password reset</p>
        </td></tr>
        <tr><td style="padding:26px;">
          <p style="color:#222;margin:0 0 14px;">Hello {name},</p>
          <p style="color:#444;line-height:1.6;margin:0 0 18px;">
            We received a request to reset the password for the retailer account with GSTIN
            <strong style="font-family:monospace;">{gstin}</strong>.
            This link works once and expires in {TOKEN_TTL_MINUTES} minutes.
          </p>
          <p style="text-align:center;margin:26px 0;">
            <a href="{link}" style="background:#d4af37;color:#1e3a52;padding:13px 30px;border-radius:8px;
               text-decoration:none;font-weight:bold;">Set a new password</a>
          </p>
          <p style="color:#666;font-size:12px;line-height:1.6;margin:0;">
            Remember: you sign in with your <strong>GSTIN</strong>, not your email address.
            If you didn't ask for this, you can ignore this email — your current password still works.
          </p>
        </td></tr>
      </table>
    </body></html>
    """
    return await send_email(
        to_email=retailer["email"],
        subject="Reset your AAROHMM retailer password",
        html_content=html,
    )


async def send_changed_email(retailer: dict) -> bool:
    from services.email_service import send_email

    gstin = (retailer.get("gst_number") or "").upper()
    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:#1e3a52;padding:22px;text-align:center;">
          <h1 style="color:#d4af37;margin:0;letter-spacing:2px;">AAROHMM</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="color:#1e3a52;margin:0 0 10px;font-size:18px;">Your password was changed</h2>
          <p style="color:#444;line-height:1.6;">
            The password for GSTIN <strong style="font-family:monospace;">{gstin}</strong> was just updated,
            and every device signed in to this account has been logged out.
            Sign in again with your GSTIN and the new password.
          </p>
          <p style="color:#666;font-size:12px;">
            Didn't do this? Reply to this email immediately.
          </p>
        </td></tr>
      </table>
    </body></html>
    """
    return await send_email(
        to_email=retailer["email"],
        subject="Your AAROHMM retailer password was changed",
        html_content=html,
    )
