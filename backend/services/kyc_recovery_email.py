"""
KYC Recovery Email — fired when a retailer is blocked at checkout because
their KYC is incomplete. Rate-limited to once per retailer per 24h via the
`kyc_email_log` MongoDB collection so retailers don't get spammed if they
retry the same blocked checkout repeatedly.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import List

from services.email_service import send_email

logger = logging.getLogger(__name__)

THROTTLE = timedelta(hours=24)


def _public_url() -> str:
    """Best-effort public origin for deep links in the email."""
    return (
        os.environ.get("PUBLIC_FRONTEND_URL")
        or os.environ.get("NEXT_PUBLIC_FRONTEND_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://centraders.com"
    ).rstrip("/")


def _email_html(retailer: dict, missing: List[str], deep_link: str) -> str:
    name = retailer.get("name") or retailer.get("business_name") or "there"
    business = retailer.get("business_name") or ""
    missing_html = "".join(
        f'<li style="margin:4px 0;color:#92400e;"><b>{m}</b></li>' for m in missing
    )
    return f"""
<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;background:#f5efe0;padding:24px;color:#2b3a4a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background:#fef3c7;border-radius:50%;line-height:56px;font-size:28px;">⚠️</div>
    </div>
    <h1 style="font-size:22px;color:#2b3a4a;text-align:center;margin:0 0 8px;font-family:'Libre Baskerville',Georgia,serif;">
      One last step, {name}
    </h1>
    <p style="font-size:14px;color:#475569;text-align:center;margin:0 0 24px;">
      We&rsquo;d love to process your B2B order for <b>{business}</b> —
      but a quick KYC verification is pending on your Addrika account.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;">Pending verifications:</p>
      <ul style="margin:0;padding-left:20px;font-size:13px;">{missing_html}</ul>
    </div>
    <p style="font-size:13px;color:#475569;line-height:1.6;margin:16px 0 24px;">
      Verification takes under 2 minutes — you&rsquo;ll need your PAN card
      and Aadhaar-linked mobile phone for the OTP step. All data is
      encrypted in transit and processed via Sandbox API (a UIDAI-licensed
      KYC provider).
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{deep_link}" style="display:inline-block;background:#2b3a4a;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Complete KYC now &rarr;
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:24px 0 0;">
      Questions? Reply to this email or reach us on WhatsApp.<br/>
      &mdash; Team Addrika
    </p>
  </div>
</body></html>
""".strip()


async def maybe_send_kyc_recovery_email(db, retailer: dict, missing: List[str]) -> bool:
    """Fire-and-forget recovery email to a blocked retailer.

    Rate-limited: at most once per retailer per 24h. Returns True if an
    email was actually sent, False if throttled or unconfigured.
    """
    if not missing:
        return False
    email = retailer.get("email")
    retailer_id = retailer.get("retailer_id")
    if not email or not retailer_id:
        return False

    now = datetime.now(timezone.utc)
    log = await db.kyc_email_log.find_one({"retailer_id": retailer_id})
    if log and log.get("last_sent_at"):
        try:
            last = datetime.fromisoformat(log["last_sent_at"].replace("Z", "+00:00"))
            if (now - last) < THROTTLE:
                logger.info(
                    f"KYC recovery email throttled for {retailer_id} (last sent {last.isoformat()})"
                )
                return False
        except Exception:
            pass  # bad timestamp — send anyway

    deep_link = f"{_public_url()}/retailer/b2b#kyc"
    subject = f"Complete your KYC to unlock B2B orders — {', '.join(missing)} pending"
    html = _email_html(retailer, missing, deep_link)

    sent = await send_email(email, subject, html)
    if sent:
        await db.kyc_email_log.update_one(
            {"retailer_id": retailer_id},
            {
                "$set": {
                    "retailer_id": retailer_id,
                    "email": email,
                    "missing": missing,
                    "last_sent_at": now.isoformat(),
                    "send_count": (log.get("send_count", 0) if log else 0) + 1,
                }
            },
            upsert=True,
        )
        logger.info(f"KYC recovery email sent to {email} (missing={missing})")
    return sent


def fire_and_forget(coro):
    """Schedule a coroutine without awaiting it. Used so the 403 response
    isn't slowed by an outbound HTTP call to Resend."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        asyncio.run(coro)
