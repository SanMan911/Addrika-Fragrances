"""Admin — one-off retailer notices.

Currently: the "your GSTIN is now your login ID" announcement. Preview and
recipient count first, one click to send, and a per-retailer sent stamp so
nobody receives it twice.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Request

from dependencies import db, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-notices", tags=["Admin · Retailer Notices"])

NOTICE_KEY = "gstin_login_notice_sent_at"
SUBJECT = "Important: your GSTIN is now your AAROHMM login ID"


def build_html(business_name: str, gstin: str) -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:#1e3a52;padding:24px;text-align:center;">
          <h1 style="color:#d4af37;margin:0;letter-spacing:2px;">AAROHMM</h1>
          <p style="color:#fff;margin:6px 0 0;font-size:13px;">A small change to how you sign in</p>
        </td></tr>
        <tr><td style="padding:26px;">
          <p style="color:#222;margin:0 0 14px;">Dear {business_name},</p>
          <p style="color:#444;line-height:1.7;margin:0 0 16px;">
            From today, your <strong>GSTIN is your login ID</strong> for your AAROHMM trade account —
            on the website and in the AAROHMM app. Your password has not changed.
          </p>
          <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">
            <tr><td style="background:#fbf7ea;border:1px solid #e6d9a8;border-radius:8px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#8a7a52;letter-spacing:1px;">YOUR LOGIN ID</div>
              <div style="font-family:monospace;font-size:19px;color:#1e3a52;font-weight:bold;letter-spacing:2px;margin-top:4px;">{gstin}</div>
            </td></tr>
          </table>
          <p style="color:#444;line-height:1.7;margin:0 0 16px;">
            Signing in with your email address will no longer work. Your email stays on file for
            invoices, order updates and password recovery.
          </p>
          <p style="color:#444;line-height:1.7;margin:0 0 6px;"><strong>Forgot your password?</strong></p>
          <p style="color:#444;line-height:1.7;margin:0 0 20px;">
            Use “Forgot password?” on the retailer login page — enter your GSTIN and we'll email a
            reset link to this address.
          </p>
          <p style="color:#666;font-size:12px;margin:0;">
            Questions? Just reply to this email and our team will help.
          </p>
        </td></tr>
      </table>
    </body></html>
    """


async def _eligible():
    return await db.retailers.find(
        {"status": {"$ne": "deleted"}, "gst_number": {"$type": "string"}, "email": {"$type": "string"}},
        {"_id": 0, "retailer_id": 1, "business_name": 1, "name": 1, "email": 1,
         "gst_number": 1, NOTICE_KEY: 1},
    ).to_list(500)


@router.get("/gstin-login")
async def gstin_notice_status(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    rows = await _eligible()
    pending = [r for r in rows if not r.get(NOTICE_KEY)]
    sent = [r for r in rows if r.get(NOTICE_KEY)]
    sample = rows[0] if rows else {"business_name": "Sharma Traders", "gst_number": "27ABCDE1234F1Z5"}
    return {
        "subject": SUBJECT,
        "pending_count": len(pending),
        "sent_count": len(sent),
        "pending": pending,
        "sent": sent,
        "preview_html": build_html(
            sample.get("business_name") or sample.get("name") or "Partner",
            (sample.get("gst_number") or "").upper(),
        ),
    }


@router.post("/gstin-login/send")
async def send_gstin_notice(request: Request, session_token: Optional[str] = Cookie(None)):
    admin = await require_admin(request, session_token)
    from services.email_service import send_email

    rows = [r for r in await _eligible() if not r.get(NOTICE_KEY)]
    sent, failed = 0, 0
    for r in rows:
        gstin = (r.get("gst_number") or "").upper()
        try:
            ok = await send_email(
                to_email=r["email"],
                subject=SUBJECT,
                html_content=build_html(r.get("business_name") or r.get("name") or "Partner", gstin),
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("GSTIN notice failed for %s: %s", r["retailer_id"], e)
            ok = False
        if ok:
            await db.retailers.update_one(
                {"retailer_id": r["retailer_id"]},
                {"$set": {NOTICE_KEY: datetime.now(timezone.utc).isoformat(),
                          "gstin_login_notice_sent_by": (admin or {}).get("email")}},
            )
            sent += 1
        else:
            failed += 1

    return {
        "message": f"Notice sent to {sent} retailer(s)" + (f", {failed} failed" if failed else ""),
        "sent": sent,
        "failed": failed,
    }
