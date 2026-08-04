"""Auto-restock ETA nudges (email + optional WhatsApp).

Every 12 hours the scheduler scans every out-of-stock / restocking /
manufacturing / delayed SKU whose `restock_eta_days` window is about to
lapse in **≈2 days**. For each match, we find retailers who purchased
that SKU in the last 90 days and send them a heads-up so they can
pre-book their next carton.

Channels:
    ▸ Email (Resend / SMTP) — primary, always attempted when configured
    ▸ WhatsApp Business Cloud API — if `settings.social_platforms.whatsapp`
      has `enabled=true` + `access_token` + `phone_number_id`.

Every send is logged to `db.restock_nudges` (product_id + retailer_id +
sent_at) so we NEVER spam the same retailer twice for the same ETA cycle.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 12 * 60 * 60          # every 12h
NUDGE_WINDOW_DAYS = 2                          # nudge when ETA is 1-2 days away
LOOKBACK_DAYS = 90                             # historic buyers we notify
NUDGE_COOLDOWN_HOURS = 20 * 24                 # do not re-nudge same retailer for same SKU within 20 days


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _due_skus(db) -> list[dict]:
    """SKUs whose status is not `in_stock` AND ETA is within
    NUDGE_WINDOW_DAYS of expiring since the status was last updated."""
    docs = await db.b2b_products.find(
        {
            "is_active": {"$ne": False},
            "stock_status": {"$in": ["out_of_stock", "restocking", "manufacturing", "delayed"]},
        },
        {"_id": 0},
    ).to_list(500)
    out = []
    now = _now()
    for d in docs:
        eta_days = int(d.get("restock_eta_days") or 0)
        if eta_days <= 0:
            continue
        updated_at_iso = d.get("stock_status_updated_at") or d.get("stock_updated_at")
        if not updated_at_iso:
            continue
        try:
            updated_at = datetime.fromisoformat(updated_at_iso)
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        eta_date = updated_at + timedelta(days=eta_days)
        remaining = (eta_date - now).days
        if 0 <= remaining <= NUDGE_WINDOW_DAYS:
            d["_remaining_days"] = remaining
            d["_eta_date"] = eta_date.isoformat()
            out.append(d)
    return out


async def _past_buyers(db, product_id: str) -> list[dict]:
    """Retailers who ordered a given SKU in the last LOOKBACK_DAYS."""
    since = _now() - timedelta(days=LOOKBACK_DAYS)
    cursor = db.b2b_orders.find(
        {
            "items.product_id": product_id,
            "payment_status": "paid",
            "created_at": {"$gte": since.isoformat()},
        },
        {"_id": 0, "retailer_id": 1},
    )
    seen: set[str] = set()
    retailers: list[dict] = []
    async for o in cursor:
        rid = o.get("retailer_id")
        if not rid or rid in seen:
            continue
        seen.add(rid)
        r = await db.retailers.find_one(
            {"retailer_id": rid},
            {
                "_id": 0, "retailer_id": 1, "email": 1, "phone": 1,
                "whatsapp": 1, "whatsapp_country_code": 1,
                "business_name": 1, "trade_name": 1, "spoc": 1,
            },
        )
        if r:
            retailers.append(r)
    return retailers


async def _already_nudged_recently(db, product_id: str, retailer_id: str) -> bool:
    cutoff = (_now() - timedelta(hours=NUDGE_COOLDOWN_HOURS)).isoformat()
    doc = await db.restock_nudges.find_one({
        "product_id": product_id,
        "retailer_id": retailer_id,
        "sent_at": {"$gte": cutoff},
    })
    return doc is not None


async def _record_nudge(db, *, product_id, retailer_id, channel, meta=None):
    await db.restock_nudges.insert_one({
        "product_id": product_id,
        "retailer_id": retailer_id,
        "channel": channel,
        "sent_at": _now().isoformat(),
        "meta": meta or {},
    })


async def _send_whatsapp_text(to_number_e164: str, body: str) -> dict:
    """WhatsApp Business Cloud API text message. Silent no-op if not configured."""
    try:
        from services import social_crosspost as sc
        from dependencies import db as _dbref  # noqa: F401
        # Import DB from the running app
    except Exception:
        return {"ok": False, "error": "wa_import_failed"}
    return await _send_whatsapp_impl(to_number_e164, body)


async def _send_whatsapp_impl(to_number_e164: str, body: str) -> dict:
    """Low-level Meta Graph API POST — reads creds from social_platforms doc."""
    from dependencies import db
    from services.social_crosspost import get_social_config
    import httpx

    cfg_all = await get_social_config(db)
    cfg = (cfg_all or {}).get("whatsapp", {})
    if not cfg.get("enabled") or not cfg.get("access_token") or not cfg.get("phone_number_id"):
        return {"ok": False, "error": "not_configured"}

    url = f"{cfg.get('endpoint') or 'https://graph.facebook.com/v18.0'}/{cfg['phone_number_id']}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number_e164.lstrip("+"),
        "type": "text",
        "text": {"body": body[:1024]},
    }
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, json=payload, headers=headers)
        ok = 200 <= r.status_code < 300
        return {"ok": ok, "status": r.status_code, "response": r.text[:200] if not ok else None}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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


def _email_body(retailer_name: str, product: dict, remaining_days: int) -> str:
    eta_pretty = "tomorrow" if remaining_days == 1 else f"in {remaining_days} days"
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:22px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;letter-spacing:1.5px;'>ADDRIKA</h1>
          <p style='color:#fff;margin:6px 0 0;font-size:13px;'>Restock heads-up · pre-book your carton</p>
        </td></tr>
        <tr><td style='padding:26px;'>
          <p style='margin:0 0 10px;font-size:14px;'>Namaste {retailer_name},</p>
          <p style='margin:0 0 14px;font-size:14px;'>
            Your favourite <b>{product.get('name')}</b> ({product.get('net_weight') or ''})
            is coming back into stock <b>{eta_pretty}</b> —
            reserve your carton before the batch is spoken for.
          </p>
          <div style='background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px;border-radius:6px;margin:14px 0;'>
            <b style='color:#92400E;'>Reserve early &middot; first-come first-serve</b>
          </div>
          <p style='margin:0 0 14px;font-size:13px;color:#555;'>
            Head to your B2B portal to place a pre-order — the crew will
            allocate stock the moment the new batch clears QC.
          </p>
          <p style='margin:22px 0 0;font-size:12px;color:#888;'>
            Questions? Reply to this email or WhatsApp us at +91 62023 11736.
          </p>
        </td></tr>
      </table>
    </body></html>
    """


def _whatsapp_body(retailer_name: str, product: dict, remaining_days: int) -> str:
    eta_pretty = "tomorrow" if remaining_days == 1 else f"in {remaining_days} days"
    return (
        f"Hi {retailer_name}! 🌸 Just a heads-up from Team Addrika — "
        f"*{product.get('name')} ({product.get('net_weight') or ''})* is back in stock {eta_pretty}. "
        f"Pre-book your carton on the B2B portal before the batch is spoken for. "
        f"Reply here if you'd like us to reserve one for you."
    )


async def _nudge_one(db, product: dict, retailer: dict) -> dict:
    if await _already_nudged_recently(db, product["id"], retailer["retailer_id"]):
        return {"skipped": "cooldown"}

    display_name = (
        (retailer.get("spoc") or {}).get("name")
        or retailer.get("business_name")
        or retailer.get("trade_name")
        or "there"
    )
    display_name = str(display_name).split(" ")[0].strip() or "there"
    remaining_days = int(product.get("_remaining_days", 2))

    channels_used: list[str] = []

    # 1) Email — primary
    try:
        from services.email_service import send_email, is_email_service_available
        if is_email_service_available() and retailer.get("email"):
            subject = f"Restock ETA · {product.get('name')} back in {remaining_days} day(s)"
            html = _email_body(display_name, product, remaining_days)
            if await send_email(to_email=retailer["email"], subject=subject, html_content=html):
                channels_used.append("email")
                await _record_nudge(
                    db,
                    product_id=product["id"], retailer_id=retailer["retailer_id"],
                    channel="email", meta={"remaining_days": remaining_days},
                )
    except Exception as e:
        logger.debug("restock-nudge email failed: %s", e)

    # 2) WhatsApp — best-effort, opt-in via admin integrations panel
    try:
        to = _e164(retailer.get("whatsapp") or retailer.get("phone"),
                   retailer.get("whatsapp_country_code"))
        if to:
            resp = await _send_whatsapp_impl(to, _whatsapp_body(display_name, product, remaining_days))
            if resp.get("ok"):
                channels_used.append("whatsapp")
                await _record_nudge(
                    db,
                    product_id=product["id"], retailer_id=retailer["retailer_id"],
                    channel="whatsapp", meta={"remaining_days": remaining_days, "to": to},
                )
    except Exception as e:
        logger.debug("restock-nudge whatsapp failed: %s", e)

    return {"channels": channels_used}


async def run_restock_nudges(db) -> dict:
    """Main entry point — safe to call ad-hoc from an admin endpoint."""
    stats = {"skus_scanned": 0, "nudges_sent": 0, "retailers_reached": 0}
    due = await _due_skus(db)
    stats["skus_scanned"] = len(due)
    for product in due:
        buyers = await _past_buyers(db, product["id"])
        for r in buyers:
            res = await _nudge_one(db, product, r)
            if res.get("channels"):
                stats["nudges_sent"] += len(res["channels"])
                stats["retailers_reached"] += 1
    logger.info("restock-nudge cycle: %s", stats)
    return stats


async def restock_nudge_scheduler_loop(db):
    """Runs the nudge cycle 90s after boot then every 12h."""
    await asyncio.sleep(90)
    while True:
        try:
            await run_restock_nudges(db)
        except Exception as e:
            logger.warning("restock-nudge scheduler failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
