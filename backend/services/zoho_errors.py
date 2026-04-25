"""
Zoho Books sync error tracking.

Persists Zoho sync failures in `zoho_sync_errors` so the admin can see
them in a banner + dashboard, and e-mails the admin on first occurrence.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from dependencies import db, NOTIFICATION_EMAIL

logger = logging.getLogger(__name__)

COLLECTION = "zoho_sync_errors"


async def record_error(
    op: str,
    order_id: Optional[str],
    retailer_id: Optional[str],
    error_message: str,
    *,
    send_email: bool = True,
) -> None:
    """Persist a Zoho error doc + email admin."""
    doc = {
        "id": str(uuid.uuid4()),
        "op": op,  # 'sales_order' | 'payment' | 'contact'
        "order_id": order_id,
        "retailer_id": retailer_id,
        "error_message": str(error_message)[:1000],
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db[COLLECTION].insert_one(doc)
    except Exception as e:  # pragma: no cover
        logger.error(f"Failed to persist zoho error: {e}")

    if send_email:
        try:
            from services.email_service import send_email as _send_email

            html = f"""
            <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
              <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
                <tr><td style='background:#dc2626;padding:20px;text-align:center;'>
                  <h2 style='color:#fff;margin:0;'>Zoho Books Sync Failed</h2>
                </td></tr>
                <tr><td style='padding:20px;'>
                  <p><b>Operation:</b> {op}</p>
                  <p><b>Order:</b> {order_id or '—'}</p>
                  <p><b>Retailer:</b> {retailer_id or '—'}</p>
                  <p><b>Time:</b> {doc['created_at']}</p>
                  <div style='background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-top:12px;'>
                    <p style='margin:0;color:#991b1b;font-family:monospace;font-size:12px;'>{doc['error_message']}</p>
                  </div>
                  <p style='margin-top:16px;color:#666;font-size:12px;'>
                    Visit <b>/admin/b2b/zoho-errors</b> to resolve, or use
                    <b>POST /api/admin/zoho/resync/{order_id or 'ORDER_ID'}</b> to retry.
                  </p>
                </td></tr>
              </table>
            </body></html>
            """
            await _send_email(
                to_email=NOTIFICATION_EMAIL,
                subject=f"[Zoho] Sync failed — {op} · {order_id or 'no order'}",
                html_content=html,
            )
        except Exception as e:  # pragma: no cover
            logger.error(f"Zoho error alert email failed: {e}")


async def unresolved_count() -> int:
    return await db[COLLECTION].count_documents({"resolved": False})


async def list_errors(include_resolved: bool = False, limit: int = 100):
    q: dict = {} if include_resolved else {"resolved": False}
    return await db[COLLECTION].find(q, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(limit)


async def resolve(error_id: str) -> bool:
    res = await db[COLLECTION].update_one(
        {"id": error_id, "resolved": False},
        {
            "$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return res.modified_count > 0
