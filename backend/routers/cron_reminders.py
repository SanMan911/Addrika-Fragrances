"""Platform cron receivers (Emergent webhook-cron).

One-time / scheduled reminders and maintenance jobs land here. The platform
dispatches with `Authorization: Bearer $WEBHOOK_CRON_SECRET`.
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import os

from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter(prefix="/cron", tags=["cron"])
logger = logging.getLogger(__name__)


def _check_auth(authorization: str | None) -> None:
    secret = (os.environ.get("WEBHOOK_CRON_SECRET") or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Cron receiver not configured")
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :]
    if not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def _send_supabase_token_reminder() -> None:
    from services.email_service import send_email

    admin = (os.environ.get("ADMIN_EMAIL") or "contact.us@centraders.com").strip()
    ok = await send_email(
        admin,
        "Reminder: renew the Aarohmm Supabase access token (expires 25 Sep 2027)",
        """
        <div style="font-family:Georgia,serif;max-width:560px">
          <h2 style="color:#1e3a52">Supabase token renewal reminder</h2>
          <p>The scoped Supabase personal access token created on 29 Sep 2026
          for the Aarohmm project expires on <b>25 September 2027</b>.</p>
          <p>Before then, generate a fresh token at
          <a href="https://supabase.com/dashboard/account/tokens">supabase.com/dashboard/account/tokens</a>
          (permissions: <code>auth_config_read</code>, <code>auth_config_write</code>,
          <code>projects_read</code> on project <code>qzzwaqwgzvrdecheunpn</code>).</p>
          <p style="color:#6b6357">This token is only used for one-off admin
          configuration (e.g. SMTP settings), so there is no outage risk if it
          lapses — you would just need a new one before the next config change.</p>
        </div>
        """,
    )
    logger.info(f"supabase token reminder email sent={ok} to={admin}")


@router.post("/supabase-token-reminder")
async def supabase_token_reminder(
    request: Request,
    authorization: str | None = Header(None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _check_auth(authorization)
    try:
        body = await request.json()
    except Exception:
        body = None
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid cron envelope")
    asyncio.create_task(_send_supabase_token_reminder())
    return {"ok": True, "run_id": (body or {}).get("run_id")}


async def _kyc_autosuspend() -> None:
    """Suspend retailers who haven't uploaded GST cert + SPOC Aadhaar within 30 days."""
    from datetime import datetime, timezone, timedelta
    from dependencies import db
    from routers.retailer_auth import _kyc_has_gst, _kyc_has_spoc

    now = datetime.now(timezone.utc)
    suspended = 0
    cursor = db.retailers.find({"status": {"$in": ["active", "under_processing"]}})
    async for r in cursor:
        ca = r.get("created_at")
        try:
            created = datetime.fromisoformat(ca) if ca else None
        except Exception:
            created = None
        if not created or (now - created) < timedelta(days=30):
            continue
        if _kyc_has_gst(r) and _kyc_has_spoc(r):
            continue
        await db.retailers.update_one(
            {"retailer_id": r["retailer_id"]},
            {"$set": {
                "status": "suspended",
                "kyc_suspended": True,
                "suspended_reason": "KYC documents (GST certificate + SPOC Aadhaar) were not uploaded within 30 days. Upload them from your dashboard to restore access.",
                "suspended_at": now.isoformat(),
            }},
        )
        await db.retailer_sessions.delete_many({"retailer_id": r["retailer_id"]})
        suspended += 1
    logger.info(f"kyc autosuspend run complete: suspended={suspended}")


@router.post("/kyc-autosuspend")
async def kyc_autosuspend(
    request: Request,
    authorization: str | None = Header(None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _check_auth(authorization)
    try:
        body = await request.json()
    except Exception:
        body = None
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid cron envelope")
    asyncio.create_task(_kyc_autosuspend())
    return {"ok": True, "run_id": (body or {}).get("run_id")}


KYC_REMINDER_MILESTONES_DAYS = (7, 15, 29)


def _kyc_reminder_email_html(name: str, days_left: int, missing: list[str]) -> str:
    docs = "".join(f"<li>{d}</li>" for d in missing)
    urgency = "#c0392b" if days_left <= 1 else "#b8860b" if days_left <= 15 else "#1e3a52"
    return f"""
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto">
      <div style="background:#1e3a52;padding:24px;text-align:center">
        <h1 style="color:#d4af37;margin:0;font-size:24px">AAROHMM</h1>
        <p style="color:#ffffff;margin:4px 0 0;font-size:12px">Where Fragrance Becomes Atmosphere…</p>
      </div>
      <div style="padding:28px;border:1px solid #e5e0d8;border-top:none">
        <h2 style="color:{urgency};margin:0 0 12px">KYC documents pending — {days_left} day{"s" if days_left != 1 else ""} left</h2>
        <p>Dear {name},</p>
        <p>Your Aarohmm B2B account still needs the following document(s):</p>
        <ul style="color:#1e3a52">{docs}</ul>
        <p>Please upload them from your retailer dashboard within <b>{days_left} day{"s" if days_left != 1 else ""}</b>.
        Accounts without these documents after the 30-day window are
        <b>automatically suspended</b> until the documents are uploaded.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="https://centraders.com/retailer/dashboard" style="display:inline-block;background:#1e3a52;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:bold">Upload documents now</a>
        </p>
        <p style="color:#6b6357;font-size:12px">Uploading both documents restores access immediately if your account is ever suspended.</p>
      </div>
    </div>
    """


async def _kyc_reminders() -> None:
    """Email retailers at day 7/15/29 of the 30-day KYC window until docs are uploaded."""
    from datetime import datetime, timezone, timedelta
    from dependencies import db
    from routers.retailer_auth import (
        KYC_UPLOAD_DEADLINE_DAYS,
        _kyc_has_gst,
        _kyc_has_spoc,
    )
    from services.email_service import send_email

    now = datetime.now(timezone.utc)
    sent = 0
    cursor = db.retailers.find({"status": {"$in": ["active", "under_processing"]}})
    async for r in cursor:
        if r.get("is_test_account"):
            continue
        has_gst = _kyc_has_gst(r)
        has_spoc = _kyc_has_spoc(r)
        if has_gst and has_spoc:
            continue
        email = (r.get("email") or "").strip()
        if not email:
            continue
        ca = r.get("created_at")
        try:
            created = datetime.fromisoformat(ca) if ca else None
        except Exception:
            created = None
        if not created:
            continue
        days_since = (now - created).days
        if days_since >= KYC_UPLOAD_DEADLINE_DAYS:
            continue  # past the window — the autosuspend cron owns these
        days_left = KYC_UPLOAD_DEADLINE_DAYS - days_since
        already = set(r.get("kyc_reminders_sent") or [])
        due = [m for m in KYC_REMINDER_MILESTONES_DAYS if days_since >= m and m not in already]
        if not due:
            continue
        missing = []
        if not has_gst:
            missing.append("GST Certificate")
        if not has_spoc:
            missing.append("SPOC Aadhaar")
        name = r.get("trade_name") or r.get("business_name") or r.get("store_name") or "Partner"
        ok = await send_email(
            email,
            f"Action needed: upload your KYC documents ({days_left} day{'s' if days_left != 1 else ''} left)",
            _kyc_reminder_email_html(name, days_left, missing),
        )
        if ok:
            await db.retailers.update_one(
                {"retailer_id": r["retailer_id"]},
                {"$addToSet": {"kyc_reminders_sent": {"$each": due}}},
            )
            sent += 1
            logger.info(f"kyc reminder sent to {r['retailer_id']} milestones={due} days_left={days_left}")
        else:
            logger.warning(f"kyc reminder email FAILED for {r['retailer_id']} (will retry next run)")
    logger.info(f"kyc reminders run complete: sent={sent}")


@router.post("/kyc-reminders")
async def kyc_reminders(
    request: Request,
    authorization: str | None = Header(None),
):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _check_auth(authorization)
    try:
        body = await request.json()
    except Exception:
        body = None
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid cron envelope")
    asyncio.create_task(_kyc_reminders())
    return {"ok": True, "run_id": (body or {}).get("run_id")}
