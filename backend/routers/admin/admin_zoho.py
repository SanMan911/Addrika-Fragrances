"""
Admin Zoho Books integration controls.
- Status / health
- Manually resync a B2B order (sales order + payment) to Zoho
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
import logging

from dependencies import db, require_admin
from services.zoho_books import status as zoho_status, push_sales_order, push_payment, is_configured
from services.zoho_errors import (
    list_errors as list_zoho_errors,
    resolve as resolve_zoho_error,
    unresolved_count as zoho_unresolved_count,
    record_error as record_zoho_error,
)

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
    so_err = None
    pmt_err = None
    if not so:
        so_err = "push_sales_order returned None (check server logs for Zoho API response)"
        await record_zoho_error(
            "sales_order", order_id, order.get("retailer_id"), so_err
        )
    if order.get("payment_status") == "paid":
        pmt = await push_payment(
            order,
            retailer,
            float(order.get("grand_total", 0)),
            order.get("razorpay_payment_id") or order["order_id"],
        )
        if not pmt:
            pmt_err = "push_payment returned None (check server logs for Zoho API response)"
            await record_zoho_error(
                "payment", order_id, order.get("retailer_id"), pmt_err
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
        "configured": is_configured(),
        "salesorder_pushed": bool(so),
        "payment_pushed": bool(pmt),
        "zoho_salesorder_id": (so or {}).get("salesorder_id"),
        "zoho_payment_id": (pmt or {}).get("payment_id"),
        "errors": {k: v for k, v in {"sales_order": so_err, "payment": pmt_err}.items() if v},
    }


# ---------------------------------------------------------------------------
# Zoho sync error log (for admin banner + error page)
# ---------------------------------------------------------------------------

@router.get("/errors")
async def admin_zoho_errors(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    include_resolved: bool = False,
):
    await require_admin(request, session_token)
    errors = await list_zoho_errors(include_resolved=include_resolved, limit=200)
    return {"errors": errors, "unresolved": await zoho_unresolved_count()}


@router.get("/errors/count")
async def admin_zoho_errors_count(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return {"unresolved": await zoho_unresolved_count()}


@router.post("/errors/{error_id}/resolve")
async def admin_zoho_resolve_error(
    error_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    ok = await resolve_zoho_error(error_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Error not found or already resolved")
    return {"resolved": True}
