"""Nightly B2B low-stock digest email to Addrika ops.

Scans `b2b_products` for any active SKU whose remaining pieces are below
one carton/packet AND emails a summary to `NOTIFICATION_EMAIL` so
restocking is never a surprise. Runs on backend boot + every 24h.

Guardrails:
    ▸ Only runs when `RESEND_API_KEY` is configured — otherwise silently
      no-ops (dev environments won't spam).
    ▸ Once per day (persists last-sent stamp in `db.settings` doc
      `low_stock_email_state`). Manual retriggering via admin endpoint
      is unrestricted.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 24 * 60 * 60      # 24h
MIN_HOURS_BETWEEN_SENDS = 20               # avoid double-send on restart


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _last_sent_at(db) -> datetime | None:
    doc = await db.settings.find_one({"_id": "low_stock_email_state"})
    if not doc:
        return None
    ts = doc.get("last_sent_at")
    if not ts:
        return None
    try:
        d = datetime.fromisoformat(ts)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        return None


async def _mark_sent(db, count: int):
    await db.settings.update_one(
        {"_id": "low_stock_email_state"},
        {"$set": {"last_sent_at": _now().isoformat(), "last_count": count}},
        upsert=True,
    )


async def send_low_stock_digest(db, *, force: bool = False) -> dict:
    """Compose + send the digest. Returns {sent, count, skipped_reason?}."""
    from services.b2b_inventory import find_low_stock
    from services.email_service import send_email, is_email_service_available
    from dependencies import NOTIFICATION_EMAIL

    if not is_email_service_available():
        return {"sent": False, "count": 0, "skipped_reason": "email_service_unavailable"}

    if not force:
        last = await _last_sent_at(db)
        if last and (_now() - last) < timedelta(hours=MIN_HOURS_BETWEEN_SENDS):
            return {
                "sent": False, "count": 0,
                "skipped_reason": "already_sent_recently",
                "last_sent_at": last.isoformat(),
            }

    low_items = await find_low_stock(db)
    if not low_items:
        return {"sent": False, "count": 0, "skipped_reason": "no_low_stock_skus"}

    html = _render_html(low_items)
    subject = f"[Addrika B2B] {len(low_items)} SKU(s) low on stock — restock soon"
    sent = await send_email(
        to_email=NOTIFICATION_EMAIL, subject=subject, html_content=html,
    )
    if sent:
        await _mark_sent(db, len(low_items))
        logger.info("Low-stock digest sent to %s (%d SKUs)", NOTIFICATION_EMAIL, len(low_items))
        return {"sent": True, "count": len(low_items), "to": NOTIFICATION_EMAIL}
    return {"sent": False, "count": len(low_items), "skipped_reason": "email_send_failed"}


def _render_html(items: list[dict]) -> str:
    rows = []
    for it in items:
        stock_line = f"{it['stock_pieces']} / {it['pieces_per_carton']} pcs per carton"
        status = (it.get("stock_status") or "in_stock").replace("_", " ").title()
        eta = it.get("restock_eta_days")
        note = it.get("restock_note") or ""
        status_cell = status
        if it.get("stock_pieces") == 0:
            status_cell = f"<b style='color:#b91c1c;'>{status}</b>"
        elif it.get("stock_pieces") < it["pieces_per_carton"]:
            status_cell = f"<b style='color:#b45309;'>{status} · Low</b>"
        eta_html = f"ETA {eta}d" if eta is not None else "—"
        note_html = f"<div style='font-size:11px;color:#888;'>{note}</div>" if note else ""
        rows.append(
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;'>{it['name']} ({it.get('net_weight') or '—'})</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;color:#666;'>{it.get('category') or '—'}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;'>{stock_line}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;'>{status_cell}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee;color:#666;'>"
            f"{eta_html}"
            f"{note_html}"
            f"</td>"
            f"</tr>"
        )
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:720px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:24px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;'>ADDRIKA</h1>
          <p style='color:#fff;margin:4px 0 0;font-size:14px;'>Nightly B2B Low-Stock Digest</p>
        </td></tr>
        <tr><td style='padding:22px;'>
          <div style='background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px;border-radius:6px;margin-bottom:16px;'>
            <b style='color:#92400E;'>{len(items)} SKU(s)</b>
            <span style='color:#78350F;'> have dropped below one carton. Consider triggering a production batch.</span>
          </div>
          <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #eee;border-radius:6px;overflow:hidden;'>
            <thead>
              <tr style='background:#f9f7f4;'>
                <th style='padding:10px;text-align:left;font-size:12px;'>Product</th>
                <th style='padding:10px;text-align:left;font-size:12px;'>Category</th>
                <th style='padding:10px;text-align:right;font-size:12px;'>Stock</th>
                <th style='padding:10px;text-align:left;font-size:12px;'>Status</th>
                <th style='padding:10px;text-align:left;font-size:12px;'>ETA / Note</th>
              </tr>
            </thead>
            <tbody>{''.join(rows)}</tbody>
          </table>
          <p style='margin-top:16px;color:#666;font-size:12px;'>
            Adjust stock &amp; ETA at <b>Admin → B2B → Inventory</b>.
          </p>
        </td></tr>
      </table>
    </body></html>
    """


async def low_stock_scheduler_loop(db):
    """Fire once ~60s after boot (warm-up), then every 24h."""
    await asyncio.sleep(60)
    while True:
        try:
            await send_low_stock_digest(db)
        except Exception as e:
            logger.warning("low_stock_digest cycle failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
