"""
Admin Zoho Books integration controls.
- Status / health
- Manually resync a B2B order (sales order + payment) to Zoho
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
import logging

from dependencies import db, require_admin
from services.zoho_books import status as zoho_status, push_sales_order, push_payment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/zoho", tags=["Admin Zoho"])


@router.get("/status")
async def admin_zoho_status(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return await zoho_status()


@router.post("/resync/{order_id}")
async def admin_resync_order(
    order_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Idempotent: pushes the sales order and (if paid) the payment to Zoho."""
    await require_admin(request, session_token)
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    retailer = await db.retailers.find_one(
        {"retailer_id": order["retailer_id"]}, {"_id": 0}
    )
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    so = await push_sales_order(order, retailer)
    pmt = None
    if order.get("payment_status") == "paid":
        pmt = await push_payment(
            order,
            retailer,
            float(order.get("grand_total", 0)),
            order.get("razorpay_payment_id") or order["order_id"],
        )

    updates = {}
    if so:
        updates["zoho_salesorder_id"] = so.get("salesorder_id")
    if pmt:
        updates["zoho_payment_id"] = pmt.get("payment_id")
    if updates:
        from datetime import datetime, timezone
        updates["zoho_synced_at"] = datetime.now(timezone.utc).isoformat()
        await db.b2b_orders.update_one({"order_id": order_id}, {"$set": updates})

    return {
        "configured": bool(so or pmt) or False,
        "salesorder_pushed": bool(so),
        "payment_pushed": bool(pmt),
        "zoho_salesorder_id": (so or {}).get("salesorder_id"),
        "zoho_payment_id": (pmt or {}).get("payment_id"),
    }
