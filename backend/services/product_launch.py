"""
Founding Retailer Early-Access & Zero-Touch SKU Launch.

**Concept.** When the admin toggles "Launch this SKU" on a product, we:

    ▸ Mark the product with an `early_access_until` timestamp (default 24h).
    ▸ Broadcast the launch via the existing Nudge Composer to every active
      retailer with the fresh product image + a preview URL.
    ▸ CC the platform-level accountant that a new revenue line just went live.
    ▸ Return everything so the admin sees a launch report.

**Preview URL.** The launch broadcast contains a token-signed preview link
(`/preview/{token}`) that lets a retailer see the SKU on the storefront during
the hidden window. Anyone without a valid token sees the SKU as "coming soon"
until `early_access_until` expires.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_HIDDEN_HOURS = 24


def _signing_secret() -> str:
    """Preview URL HMAC key — reuses RAZORPAY_KEY_SECRET as a stable per-env
    secret to avoid adding yet another .env slot. Any 16+ char secret works."""
    return (
        os.environ.get("EARLY_ACCESS_SECRET")
        or os.environ.get("RAZORPAY_KEY_SECRET")
        or "addrika-early-access-fallback"
    )


def sign_preview_token(product_id: str, expires_at: datetime) -> str:
    """Return `{product_id}.{unix_ts}.{hmac_sig}` — server-verifiable, no DB round trip."""
    ts = str(int(expires_at.timestamp()))
    msg = f"{product_id}.{ts}".encode()
    sig = hmac.new(_signing_secret().encode(), msg, hashlib.sha256).hexdigest()[:16]
    return f"{product_id}.{ts}.{sig}"


def verify_preview_token(token: str) -> Optional[str]:
    """Return `product_id` if the token is valid and not expired, else None."""
    if not token or token.count(".") < 2:
        return None
    try:
        pid, ts, sig = token.rsplit(".", 2)
        expected = hmac.new(_signing_secret().encode(),
                            f"{pid}.{ts}".encode(),
                            hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(expected, sig):
            return None
        if int(ts) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return pid
    except (ValueError, TypeError):
        return None


def is_in_early_access(product: dict) -> bool:
    """True if `early_access_until` is in the future — SKU is hidden from
    the public storefront during this window."""
    ea = product.get("early_access_until")
    if not ea:
        return False
    try:
        end = datetime.fromisoformat(str(ea).replace("Z", "+00:00"))
        return end > datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


def early_access_hint(product: dict) -> Optional[dict]:
    """Public-facing "coming soon" hint (no leaking image/price). Returned
    on the storefront so retailers who arrive without a preview token
    still see a teaser."""
    if not is_in_early_access(product):
        return None
    return {
        "product_id": product.get("id"),
        "name": product.get("name"),
        "available_from": product.get("early_access_until"),
        "message": "🌸 Launching soon — join the waitlist or ask your Addrika rep for early access.",
    }


async def launch_sku(db, product: dict, admin_email: str, *,
                     hidden_hours: int = DEFAULT_HIDDEN_HOURS,
                     broadcast: bool = True) -> dict:
    """Kick off the one-touch launch sequence for a product.
    Returns a summary of what was done. Idempotent — a `launched_at` flag on
    the product means subsequent calls just broadcast without re-flagging."""
    from services.email_service import send_email, is_email_service_available

    now = datetime.now(timezone.utc)
    ea_until = now + timedelta(hours=hidden_hours)
    token = sign_preview_token(product["id"], ea_until)
    preview_path = f"/preview/{token}"

    # Only stamp launch metadata the first time
    if not product.get("launched_at"):
        await db.products.update_one(
            {"id": product["id"]},
            {"$set": {
                "launched_at": now.isoformat(),
                "launched_by": admin_email,
                "early_access_until": ea_until.isoformat(),
                "preview_token": token,
            }},
        )

    summary = {
        "product_id": product["id"],
        "preview_url": preview_path,
        "early_access_until": ea_until.isoformat(),
        "broadcast_id": None,
        "recipients": 0,
        "accountant_notified": False,
    }

    if broadcast:
        base_url = os.environ.get("PUBLIC_APP_URL", "https://addrika.com").rstrip("/")
        preview_full = f"{base_url}{preview_path}"
        wa_msg = _launch_broadcast_message(product, preview_full)
        email_html = _launch_email_html(product, preview_full)
        try:
            from services.b2b_nudge_composer import broadcast_custom_nudge
            result = await broadcast_custom_nudge(
                db,
                subject=f"🌸 Introducing {product.get('name')} · Founding Retailer Early Access",
                body_html=email_html,
                whatsapp_body=wa_msg,
                channels=["email", "whatsapp"],
                audience="active",
                product_id=None,
                pincode_prefix=None,
                retailer_ids=None,
                kind="sku_launch",
                admin_email=admin_email,
            )
            summary["broadcast_id"] = result.get("broadcast_id")
            summary["recipients"] = result.get("audience_size", 0)
            summary["email_sent"] = result.get("email_sent", 0)
            summary["whatsapp_sent"] = result.get("whatsapp_sent", 0)
        except Exception as e:
            logger.warning("Launch broadcast failed for %s: %s", product["id"], e)

        # Accountant CC — platform default only (per-retailer CCs don't apply here)
        try:
            from routers.admin.admin_integrations import get_effective
            accountant = (await get_effective("accountant_email") or "").strip()
            if accountant and "@" in accountant and is_email_service_available():
                ok = await send_email(
                    to_email=accountant,
                    subject=f"New SKU launched: {product.get('name')}",
                    html_content=_accountant_email_html(product, admin_email, summary),
                )
                summary["accountant_notified"] = bool(ok)
        except Exception as e:
            logger.warning("Accountant launch notification failed: %s", e)

    return summary


def _launch_broadcast_message(product: dict, preview_url: str) -> str:
    return (
        f"🌸 *{product.get('name')}* is here — and *you* get the first look.\n\n"
        f"For the next 24 hours, this SKU is visible only to our Founding Retailer network. "
        f"Explore & pre-order before it opens to the public.\n\n"
        f"👉 {preview_url}\n\n"
        f"Reply to this message for a private catalog walkthrough."
    )


def _launch_email_html(product: dict, preview_url: str) -> str:
    img = product.get("image") or ""
    img_html = (
        f"<img src='{img}' alt='{product.get('name')}' style='max-width:100%;border-radius:8px;margin:12px 0;'/>"
        if img else ""
    )
    return f"""
      <p style='margin:0 0 12px;font-size:15px;'>🌸 <b>{product.get('name')}</b> is here — and <b>you</b> get the first look.</p>
      {img_html}
      <p style='margin:0 0 12px;font-size:14px;'>
        For the next 24 hours, this SKU is visible only to our Founding Retailer network.
        Explore, sample and pre-order before it opens to the public.
      </p>
      <a href='{preview_url}' style='display:inline-block;background:#1e3a52;color:#d4af37;
        padding:12px 22px;border-radius:6px;font-weight:600;text-decoration:none;margin:10px 0;'>
        View Early-Access Catalog
      </a>
      <p style='margin:14px 0 0;font-size:12px;color:#888;'>
        Reply to this email for a private walkthrough with your account manager.
      </p>
    """


def _accountant_email_html(product: dict, admin_email: str, summary: dict) -> str:
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <div style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;'>
        <h2 style='color:#1e3a52;margin:0 0 12px;'>New Revenue Line Live</h2>
        <p style='font-size:14px;color:#333;'>
          A new SKU just went live in the Addrika catalog.
        </p>
        <table style='width:100%;font-size:13px;color:#333;border-collapse:collapse;'>
          <tr><td style='padding:4px 0;color:#888;'>Product</td><td>{product.get('name')}</td></tr>
          <tr><td style='padding:4px 0;color:#888;'>Weight</td><td>{product.get('net_weight') or (product.get('sizes') or [{}])[0].get('size') or '—'}</td></tr>
          <tr><td style='padding:4px 0;color:#888;'>Launched by</td><td>{admin_email}</td></tr>
          <tr><td style='padding:4px 0;color:#888;'>Broadcast reach</td><td>{summary.get('recipients') or 0} retailers</td></tr>
          <tr><td style='padding:4px 0;color:#888;'>Early access until</td><td>{summary.get('early_access_until')}</td></tr>
        </table>
        <p style='font-size:12px;color:#888;margin-top:20px;'>
          Automated notification from the Addrika Launch Composer.
        </p>
      </div>
    </body></html>
    """
