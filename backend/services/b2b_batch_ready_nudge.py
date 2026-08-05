"""
Pre-Order Batch Ready nudge.

Fires the moment an admin flips a SKU's `stock_status` from any not-orderable
state back to `in_stock`. Every outstanding paid pre-order for that SKU gets
a "Your Batch Is Ready" WhatsApp + Email nudge containing:

    ▸ A prominent CTA to the balance-payment link
    ▸ The exact outstanding balance amount
    ▸ Their reserved pieces count

Idempotency: uses a `db.batch_ready_nudges` guard row per (order_id, product_id).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Statuses considered "outstanding" — orders in these states are still owed
# stock. Matches routers/admin/admin_b2b_preorders.FULFILLED_STATES.
_FULFILLED = {"fulfilled", "shipped", "delivered", "cancelled", "closed"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _outstanding_preorders(db, product_id: str) -> list[dict]:
    cursor = db.b2b_orders.find(
        {
            "is_preorder": True,
            "payment_status": "paid",
            "order_status": {"$nin": list(_FULFILLED)},
            "items.product_id": product_id,
        },
        {"_id": 0},
    )
    return await cursor.to_list(1000)


async def _already_nudged(db, order_id: str, product_id: str) -> bool:
    return bool(await db.batch_ready_nudges.find_one({
        "order_id": order_id, "product_id": product_id,
    }))


async def _record_nudge(db, order_id, product_id, retailer_id, channels, meta=None):
    await db.batch_ready_nudges.insert_one({
        "order_id": order_id,
        "product_id": product_id,
        "retailer_id": retailer_id,
        "channels": channels,
        "sent_at": _now().isoformat(),
        "meta": meta or {},
    })


def _balance_link(order_id: str, retailer_id: Optional[str]) -> str:
    # The retailer portal shows an "Outstanding Balance" CTA on any paid
    # pre-order whose order_status is not fulfilled — deep-link straight to it.
    base = os.environ.get("PUBLIC_APP_URL", "https://addrika.com").rstrip("/")
    return f"{base}/retailer/b2b/orders/{order_id}?balance=1"


def _email_html(retailer_name: str, product: dict, order: dict, balance_link: str) -> str:
    balance = float(order.get("balance_due_inr") or 0)
    pieces = 0
    for item in order.get("items") or []:
        if item.get("product_id") == product.get("product_id") or item.get("product_id") == product.get("id"):
            ppc = int(product.get("pieces_per_carton") or 32)
            pieces += int(round(float(item.get("quantity_boxes") or 0) * ppc))
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:22px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;letter-spacing:1.5px;'>ADDRIKA</h1>
          <p style='color:#fff;margin:6px 0 0;font-size:13px;'>Your Batch Is Ready · settle the balance to dispatch</p>
        </td></tr>
        <tr><td style='padding:26px;'>
          <p style='margin:0 0 10px;font-size:14px;'>Namaste {retailer_name},</p>
          <p style='margin:0 0 14px;font-size:14px;'>
            Great news — <b>{product.get('name')} ({product.get('net_weight') or ''})</b> is
            <b>BACK IN STOCK</b>. Your pre-order for <b>{pieces} pieces</b> is packed and ready
            to ship the moment the balance is cleared.
          </p>
          <div style='background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px;border-radius:6px;margin:16px 0;'>
            <p style='margin:0;color:#92400E;font-size:14px;'><b>Outstanding balance</b></p>
            <p style='margin:6px 0 0;color:#7C2D12;font-size:20px;font-weight:700;'>₹{balance:,.2f}</p>
          </div>
          <p style='margin:0 0 20px;font-size:13px;color:#555;'>
            Order reference: <b>{order.get('order_id')}</b>
          </p>
          <a href='{balance_link}' style='display:inline-block;background:#1e3a52;color:#d4af37;padding:12px 22px;
            border-radius:6px;font-weight:600;text-decoration:none;'>Pay Balance &amp; Dispatch</a>
          <p style='margin:22px 0 0;font-size:12px;color:#888;'>
            Questions? Reply to this email or WhatsApp us at +91 62023 11736.
          </p>
        </td></tr>
      </table>
    </body></html>
    """


def _whatsapp_body(retailer_name: str, product: dict, order: dict, balance_link: str) -> str:
    balance = float(order.get("balance_due_inr") or 0)
    return (
        f"🎉 Great news {retailer_name}! *{product.get('name')} ({product.get('net_weight') or ''})* "
        f"is BACK IN STOCK — your reserved batch is packed and ready to ship.\n\n"
        f"Order: *{order.get('order_id')}*\n"
        f"Balance due: *₹{balance:,.2f}*\n\n"
        f"Pay the balance and we dispatch today 👉 {balance_link}"
    )


async def notify_batch_ready(db, product_id: str) -> dict:
    """Send the Batch Ready nudge to every outstanding pre-order retailer
    for a specific SKU. Called from `admin_set_stock_status` whenever the
    status flips to `in_stock`. Idempotent per (order_id, product_id)."""
    product = await db.b2b_products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        return {"skipped": "product_not_found"}
    orders = await _outstanding_preorders(db, product_id)
    if not orders:
        return {"skipped": "no_outstanding_preorders", "product_id": product_id}

    from services.email_service import send_email, is_email_service_available
    from services.b2b_restock_nudge import _e164, _send_whatsapp_impl

    sent = 0
    skipped = 0
    for order in orders:
        if await _already_nudged(db, order["order_id"], product_id):
            skipped += 1
            continue
        retailer = await db.retailers.find_one(
            {"retailer_id": order.get("retailer_id")},
            {"_id": 0},
        ) or {}
        name = str(
            (retailer.get("spoc") or {}).get("name")
            or retailer.get("business_name")
            or retailer.get("trade_name")
            or "there"
        ).split(" ")[0].strip() or "there"
        link = _balance_link(order["order_id"], retailer.get("retailer_id"))
        channels: list[str] = []

        # Email — primary
        try:
            if is_email_service_available() and retailer.get("email"):
                ok = await send_email(
                    to_email=retailer["email"],
                    subject=f"🎉 Your Batch Is Ready · {product.get('name')} · Pay balance to dispatch",
                    html_content=_email_html(name, product, order, link),
                )
                if ok:
                    channels.append("email")
        except Exception as e:
            logger.debug("batch-ready email failed: %s", e)

        # WhatsApp — best-effort
        try:
            to = _e164(retailer.get("whatsapp") or retailer.get("phone"),
                       retailer.get("whatsapp_country_code"))
            if to:
                resp = await _send_whatsapp_impl(to, _whatsapp_body(name, product, order, link))
                if resp.get("ok"):
                    channels.append("whatsapp")
        except Exception as e:
            logger.debug("batch-ready whatsapp failed: %s", e)

        if channels:
            await _record_nudge(
                db, order["order_id"], product_id, retailer.get("retailer_id"),
                channels, meta={"balance_link": link},
            )
            sent += 1
        else:
            skipped += 1

    logger.info(
        "Batch-ready nudge for %s: sent=%d skipped=%d",
        product_id, sent, skipped,
    )
    return {"sent": sent, "skipped": skipped, "product_id": product_id}
