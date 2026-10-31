"""Welcome email for newly approved B2B retailers (Iteration 130).

Sent when an admin approves a self-registered retailer, plus manual resend /
bulk blast endpoints in routers/admin/admin_retailer_requests.py.

The email never contains a password — retailers sign in with the GSTIN and the
password they chose at registration.
"""
import logging
import os
from datetime import datetime, timezone

from services.email_service import send_email

logger = logging.getLogger(__name__)

PORTAL_URL = "https://www.centraders.com/retailer/login"
B2B_URL = "https://www.centraders.com/retailer/b2b"
DEFAULT_APK_URL = (
    "https://expo.dev/artifacts/eas/L-GoJZZZqsK0NQTOfucQ3vt6mTcH-kJvpOaGPbIxtyM.apk"
)


def get_app_apk_url() -> str:
    return os.environ.get("APP_APK_URL") or DEFAULT_APK_URL


def get_retailer_welcome_html(retailer: dict) -> str:
    business = retailer.get("business_name") or "Partner"
    contact = retailer.get("contact_name") or retailer.get("name") or ""
    gstin = retailer.get("gst_number") or ""
    city = retailer.get("city") or ""
    state = retailer.get("state") or ""
    greeting = f"Namaste {contact}," if contact else "Namaste,"
    apk_url = get_app_apk_url()

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">AAROHMM</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 13px;">Where Fragrance Becomes Atmosphere…</p>
                </td>
            </tr>

            <tr>
                <td style="padding: 36px 30px 10px; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: #d4af37; border-radius: 50%; margin: 0 auto 16px; line-height: 64px;">
                        <span style="color: #ffffff; font-size: 30px;">🙏</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 8px 0;">Welcome to the AAROHMM family!</h2>
                    <p style="color: #666; margin: 0;">{business}{f' · {city}, {state}' if city else ''} is now an approved Brand Partner.</p>
                </td>
            </tr>

            <tr>
                <td style="padding: 20px 30px;">
                    <p style="color: #333; margin: 0 0 14px 0;">{greeting}</p>
                    <p style="color: #666; line-height: 1.7; margin: 0 0 18px 0;">
                        Your verification is complete and your wholesale account is <strong style="color:#1e3a52;">active</strong>.
                        You can now punch orders at brand-partner pricing, track live stock, raise grievance
                        tickets and manage rewards — all from one place.
                    </p>

                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 10px; border-left: 4px solid #d4af37;">
                        <p style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">Your sign-in details</p>
                        <p style="margin: 4px 0; color: #333;"><strong>Login ID (GSTIN):</strong> <span style="font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 1px;">{gstin}</span></p>
                        <p style="margin: 4px 0; color: #333;"><strong>Password:</strong> the one you set during registration</p>
                        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
                            Use the same GSTIN + password on the website and in the Aarohmm app.
                            If you forget your password, use "Forgot password" on the sign-in page.
                        </p>
                    </div>
                </td>
            </tr>

            <tr>
                <td style="padding: 10px 30px 8px; text-align: center;">
                    <a href="{PORTAL_URL}" style="display: inline-block; background-color: #1e3a52; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 12px;">
                        Sign in to the Partner Portal
                    </a>
                    <br>
                    <a href="{apk_url}" style="display: inline-block; background-color: #d4af37; color: #1a252f; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Download the Aarohmm App (Android)
                    </a>
                    <p style="color: #999; font-size: 11px; margin: 12px 0 0 0;">
                        On your phone, open this email and tap the gold button. Android may ask you to
                        "install from unknown sources" the first time — that is normal for direct installs.
                    </p>
                </td>
            </tr>

            <tr>
                <td style="padding: 16px 30px 10px;">
                    <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
                        <p style="color: #166534; margin: 0 0 8px 0; font-weight: bold;">Getting started</p>
                        <p style="color: #333; font-size: 13px; margin: 0; line-height: 1.8;">
                            1. Sign in and open <strong>B2B Ordering</strong><br>
                            2. Add products to your pad — schemes apply automatically<br>
                            3. Pay 70–100% upfront and upload your payment proof<br>
                            4. We verify, pack and dispatch — track it from your dashboard
                        </p>
                    </div>
                </td>
            </tr>

            <tr>
                <td style="background-color: #1e3a52; padding: 24px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 6px 0; font-weight: bold;">AAROHMM</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">Premium Agarbattis · Made for Bharat</p>
                    <p style="color: #999; margin: 12px 0 0 0; font-size: 11px;">
                        Questions? Reply to this email or write to contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_retailer_welcome_email(db, retailer: dict, *, admin_email: str = "system") -> bool:
    """Send the welcome email and stamp `welcome_email_sent_at` on success."""
    email = (retailer.get("email") or "").strip()
    if not email:
        logger.warning(f"Retailer {retailer.get('retailer_id')} has no email — welcome email skipped")
        return False

    ok = await send_email(
        to_email=email,
        subject=f"Welcome aboard, {retailer.get('business_name') or 'Partner'} — your AAROHMM account is active 🙏",
        html_content=get_retailer_welcome_html(retailer),
    )
    if ok:
        now = datetime.now(timezone.utc).isoformat()
        await db.retailers.update_one(
            {"retailer_id": retailer.get("retailer_id")},
            {
                "$set": {"welcome_email_sent_at": now, "welcome_email_sent_by": admin_email},
                "$push": {
                    "admin_notes": {
                        "id": f"note_{now}",
                        "author": admin_email,
                        "body": f"Welcome email sent to {email}",
                        "created_at": now,
                        "kind": "audit",
                    }
                },
            },
        )
    else:
        logger.error(f"Welcome email FAILED for retailer {retailer.get('retailer_id')} ({email})")
    return ok
