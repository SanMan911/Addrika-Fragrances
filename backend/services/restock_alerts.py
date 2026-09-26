"""Restock alerts — Notify-Me waitlist emails when a sold-out SKU comes back.

Flow:
    1. `b2b_inventory.adjust_stock` detects a 0 → positive transition and calls
       `record_restock_candidate` (best-effort, non-blocking).
    2. A row lands in `restock_alerts` with status `pending` — nothing is sent.
    3. An admin approves it from /admin/notify-me, which calls
       `send_restock_alert` → emails every waitlist entry that has not been
       notified yet and stamps `notified_at` so nobody is emailed twice.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SITE_URL = "https://centraders.com"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_restock_email(product_name: str, product_id: str, image: str | None, size: str | None) -> str:
    """The 'it's back in stock' email body — shared by auto restock alerts and
    the manual product-launch blast."""
    img_html = (
        f'<img src="{image}" alt="{product_name}" '
        f'style="width:100%;max-width:480px;border-radius:8px;display:block;margin:0 auto 18px;" />'
        if image
        else ""
    )
    size_line = f' <span style="color:#8a7a52;">({size})</span>' if size else ""
    return f"""
    <!DOCTYPE html>
    <html><body style="font-family:Arial,sans-serif;background:#f9f7f4;padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
            <tr><td style="background:#1e3a52;padding:24px;text-align:center;">
                <h1 style="color:#d4af37;margin:0;letter-spacing:2px;">AAROHMM</h1>
                <p style="color:#fff;margin:6px 0 0;font-size:13px;">Back in stock</p>
            </td></tr>
            <tr><td style="padding:24px;">
                {img_html}
                <h2 style="color:#1e3a52;margin:0 0 8px;">{product_name}{size_line} is back in stock</h2>
                <p style="color:#444;line-height:1.6;">
                    You asked us to let you know — and we kept our word.
                    <strong>{product_name}</strong> is on the shelf again and ready to ship.
                    Popular sizes move quickly, so grab yours while it lasts.
                </p>
                <p style="text-align:center;margin:24px 0;">
                    <a href="{SITE_URL}/products/{product_id}"
                       style="background:#d4af37;color:#1e3a52;padding:12px 28px;border-radius:8px;
                              text-decoration:none;font-weight:bold;">
                        Shop now
                    </a>
                </p>
                <p style="color:#666;font-size:12px;margin-top:24px;">
                    You're receiving this because you asked for a back-in-stock alert
                    on centraders.com. Reply if you'd rather not hear from us again.
                </p>
            </td></tr>
        </table>
    </body></html>
    """


async def pending_recipient_count(db, product_id: str) -> int:
    return await db.notify_me.count_documents(
        {"product_id": product_id, "notified_at": {"$exists": False}}
    )


async def record_restock_candidate(db, b2b_prod: dict, before: int, after: int, reason: str) -> None:
    """Queue an admin-approval row when a SKU goes from zero to in-stock."""
    if before > 0 or after <= 0:
        return
    product_id = b2b_prod.get("product_id")
    if not product_id:
        return

    waiting = await pending_recipient_count(db, product_id)
    if waiting <= 0:
        return  # nobody to notify — don't clutter the approval queue

    existing = await db.restock_alerts.find_one({"product_id": product_id, "status": "pending"})
    if existing:
        await db.restock_alerts.update_one(
            {"id": existing["id"]},
            {"$set": {
                "pending_recipients": waiting,
                "stock_after": after,
                "updated_at": _now(),
            }},
        )
        return

    b2c = await db.products.find_one({"id": product_id}, {"_id": 0, "name": 1, "image": 1})
    await db.restock_alerts.insert_one({
        "id": f"RSA-{uuid.uuid4().hex[:10].upper()}",
        "product_id": product_id,
        "product_name": (b2c or {}).get("name") or b2b_prod.get("name") or product_id,
        "product_image": (b2c or {}).get("image"),
        "size": b2b_prod.get("net_weight"),
        "b2b_id": b2b_prod.get("id"),
        "stock_before": before,
        "stock_after": after,
        "reason": reason,
        "pending_recipients": waiting,
        "status": "pending",
        "sent": 0,
        "failed": 0,
        "created_at": _now(),
        "updated_at": _now(),
    })
    logger.info("restock-alert queued for %s (%d waiting)", product_id, waiting)


async def send_restock_alert(db, alert: dict, admin_email: str | None = None) -> dict:
    """Email every un-notified waitlist entry for this product. Idempotent."""
    from services.email_service import send_email

    product_id = alert["product_id"]
    name = alert.get("product_name") or product_id
    html = build_restock_email(name, product_id, alert.get("product_image"), alert.get("size"))

    sent, failed = 0, 0
    cursor = db.notify_me.find(
        {"product_id": product_id, "notified_at": {"$exists": False}}, {"_id": 0}
    )
    async for sub in cursor:
        try:
            ok = await send_email(
                to_email=sub["email"],
                subject=f"Back in stock · {name}",
                html_content=html,
            )
            if not ok:
                failed += 1
                continue
            await db.notify_me.update_one(
                {"email": sub["email"], "product_id": product_id},
                {"$set": {"notified_at": _now()}},
            )
            sent += 1
        except Exception as e:
            logger.warning("restock email failed for %s: %s", sub.get("email"), e)
            failed += 1

    await db.restock_alerts.update_one(
        {"id": alert["id"]},
        {"$set": {
            "status": "sent",
            "sent": sent,
            "failed": failed,
            "approved_by": admin_email,
            "approved_at": _now(),
            "updated_at": _now(),
        }},
    )
    return {"alert_id": alert["id"], "sent": sent, "failed": failed}
