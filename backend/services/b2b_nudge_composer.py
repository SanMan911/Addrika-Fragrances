"""Admin custom-nudge broadcaster.

Sends a compiled email (+ optional WhatsApp) to a targeted retailer
audience for special drops, festive re-launches, price drops, and
promotional schemes. Every audience is derived on the server side so
the admin cannot accidentally leak PII by mis-typing a filter.

Audience selectors:
    ▸ "all"          — every active retailer with a valid email
    ▸ "verified"     — only retailers where `is_verified` is true
    ▸ "product"      — retailers who ordered `product_id` (paid) in last 180d
    ▸ "pincode"      — retailers whose pincode starts with `pincode_prefix`
    ▸ "retailer_ids" — an explicit list from the composer UI
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

MAX_RECIPIENTS = 2000
LOOKBACK_DAYS = 180


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_audience(
    db,
    *,
    audience: str,
    product_id: Optional[str],
    pincode_prefix: Optional[str],
    retailer_ids: Optional[list[str]],
) -> list[dict]:
    """Return the list of retailer docs matching the composer's audience selector."""
    projection = {
        "_id": 0, "retailer_id": 1, "email": 1, "phone": 1,
        "whatsapp": 1, "whatsapp_country_code": 1,
        "business_name": 1, "trade_name": 1, "spoc": 1,
        "is_verified": 1, "pincode": 1,
    }

    if audience == "retailer_ids" and retailer_ids:
        cursor = db.retailers.find(
            {"retailer_id": {"$in": list(retailer_ids)[:MAX_RECIPIENTS]}}, projection,
        )
        return await cursor.to_list(MAX_RECIPIENTS)

    if audience == "product" and product_id:
        since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()
        seen: set[str] = set()
        ordered: list[str] = []
        async for o in db.b2b_orders.find(
            {"items.product_id": product_id, "payment_status": "paid",
             "created_at": {"$gte": since}},
            {"_id": 0, "retailer_id": 1},
        ):
            rid = o.get("retailer_id")
            if rid and rid not in seen:
                seen.add(rid)
                ordered.append(rid)
        cursor = db.retailers.find(
            {"retailer_id": {"$in": ordered[:MAX_RECIPIENTS]}}, projection,
        )
        return await cursor.to_list(MAX_RECIPIENTS)

    if audience == "pincode" and pincode_prefix:
        return await db.retailers.find(
            {"pincode": {"$regex": f"^{str(pincode_prefix).strip()}"}},
            projection,
        ).to_list(MAX_RECIPIENTS)

    if audience == "verified":
        return await db.retailers.find(
            {"is_verified": True}, projection,
        ).to_list(MAX_RECIPIENTS)

    # default: "all"
    return await db.retailers.find({}, projection).to_list(MAX_RECIPIENTS)


def _e164(phone: Optional[str], country_code: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    p = str(phone).replace(" ", "").replace("-", "")
    if p.startswith("+"):
        return p
    cc = (country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = "+" + cc
    return f"{cc}{p}"


def _wrap_email(subject: str, inner_html: str, retailer_name: str) -> str:
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:22px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;letter-spacing:1.8px;'>ADDRIKA</h1>
          <p style='color:#fff;margin:6px 0 0;font-size:13px;'>{subject}</p>
        </td></tr>
        <tr><td style='padding:26px;color:#1e3a52;'>
          <p style='margin:0 0 12px;font-size:14px;'>Namaste {retailer_name},</p>
          <div style='font-size:14px;line-height:1.55;color:#333;'>{inner_html}</div>
          <p style='margin:22px 0 0;font-size:12px;color:#888;'>
            Head to your Addrika B2B portal to explore.
            Reply here or WhatsApp us at +91 62023 11736 if you'd like help.
          </p>
        </td></tr>
      </table>
    </body></html>
    """


async def broadcast_custom_nudge(
    db,
    *,
    subject: str,
    body_html: str,
    whatsapp_body: Optional[str],
    channels: list[str],
    audience: str,
    product_id: Optional[str],
    pincode_prefix: Optional[str],
    retailer_ids: Optional[list[str]],
    kind: str,
    admin_email: Optional[str],
) -> dict:
    """Execute the broadcast. Returns per-channel counters + a `broadcast_id`
    that can be looked up in `custom_nudges_log`."""
    broadcast_id = f"NUD-{uuid.uuid4().hex[:10].upper()}"
    ch = {c.strip().lower() for c in channels or []} & {"email", "whatsapp"}
    if not ch:
        ch = {"email"}

    retailers = await _resolve_audience(
        db,
        audience=audience,
        product_id=product_id,
        pincode_prefix=pincode_prefix,
        retailer_ids=retailer_ids,
    )

    stats = {
        "broadcast_id": broadcast_id,
        "kind": kind,
        "audience": audience,
        "audience_size": len(retailers),
        "channels": sorted(ch),
        "email_sent": 0,
        "whatsapp_sent": 0,
        "failed": 0,
    }
    if not retailers:
        await db.custom_nudges_log.insert_one({
            "broadcast_id": broadcast_id, "sent_at": _now(),
            "subject": subject, "kind": kind, "audience": audience,
            "audience_size": 0, "email_sent": 0, "whatsapp_sent": 0,
            "failed": 0, "admin_email": admin_email,
        })
        return stats

    # Lazy imports so tests can patch them
    try:
        from services.email_service import send_email, is_email_service_available
        email_ok = is_email_service_available()
    except Exception:
        email_ok = False
    try:
        from services.b2b_restock_nudge import _send_whatsapp_impl
    except Exception:
        _send_whatsapp_impl = None

    for r in retailers:
        display_name = (
            (r.get("spoc") or {}).get("name")
            or r.get("business_name")
            or r.get("trade_name")
            or "there"
        )
        first_name = str(display_name).split(" ")[0].strip() or "there"

        # Wire open-pixel + click-tracking into the per-recipient HTML
        try:
            from services.b2b_nudge_analytics import (
                append_open_pixel, rewrite_links_for_tracking,
            )
            import os as _os
            api_base = _os.environ.get(
                "PUBLIC_BASE_URL", "https://centraders.com"
            ).rstrip("/")
            personalised_body = rewrite_links_for_tracking(
                body_html,
                api_base=api_base,
                broadcast_id=broadcast_id,
                retailer_id=r["retailer_id"],
            )
            html = _wrap_email(subject, personalised_body, first_name)
            html = append_open_pixel(
                html,
                api_base=api_base,
                broadcast_id=broadcast_id,
                retailer_id=r["retailer_id"],
            )
        except Exception:
            html = _wrap_email(subject, body_html, first_name)

        # Email
        if "email" in ch and email_ok and r.get("email"):
            try:
                sent = await send_email(
                    to_email=r["email"], subject=subject, html_content=html,
                )
                if sent:
                    stats["email_sent"] += 1
                else:
                    stats["failed"] += 1
            except Exception as e:
                logger.debug("nudge email fail %s: %s", r.get("retailer_id"), e)
                stats["failed"] += 1

        # WhatsApp
        if "whatsapp" in ch and whatsapp_body and _send_whatsapp_impl:
            to = _e164(r.get("whatsapp") or r.get("phone"), r.get("whatsapp_country_code"))
            if to:
                try:
                    resp = await _send_whatsapp_impl(to, whatsapp_body)
                    if resp.get("ok"):
                        stats["whatsapp_sent"] += 1
                    else:
                        stats["failed"] += 1
                except Exception as e:
                    logger.debug("nudge whatsapp fail %s: %s", r.get("retailer_id"), e)
                    stats["failed"] += 1

    await db.custom_nudges_log.insert_one({
        "broadcast_id": broadcast_id,
        "sent_at": _now(),
        "subject": subject,
        "body_html": body_html[:2000],
        "whatsapp_body": (whatsapp_body or "")[:500],
        "kind": kind,
        "audience": audience,
        "audience_filter": {
            "product_id": product_id,
            "pincode_prefix": pincode_prefix,
            "retailer_ids": retailer_ids,
        },
        "audience_size": stats["audience_size"],
        "channels": stats["channels"],
        "email_sent": stats["email_sent"],
        "whatsapp_sent": stats["whatsapp_sent"],
        "failed": stats["failed"],
        "admin_email": admin_email,
    })
    logger.info(
        "custom-nudge %s (%s) → %d email · %d whatsapp · %d failed",
        broadcast_id, audience,
        stats["email_sent"], stats["whatsapp_sent"], stats["failed"],
    )
    return stats
