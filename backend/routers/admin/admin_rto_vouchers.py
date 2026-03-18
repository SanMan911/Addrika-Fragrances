"""Admin RTO Voucher Management Routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
import logging

from dependencies import db, require_admin

router = APIRouter(tags=["Admin - RTO Vouchers"])
logger = logging.getLogger(__name__)


@router.get("/rto-vouchers")
async def list_rto_vouchers(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """
    List all RTO vouchers with optional filtering.
    
    Query params:
    - status: 'active', 'used', 'cancelled', 'expired', 'voided'
    - limit: max results (default 50)
    - skip: pagination offset
    """
    await require_admin(request, session_token)
    
    query = {}
    if status:
        query["status"] = status
    
    vouchers = await db.rto_vouchers.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)
    
    # Get total count for pagination
    total = await db.rto_vouchers.count_documents(query)
    
    # Enrich with order details
    for voucher in vouchers:
        order_number = voucher.get("order_number")
        if order_number:
            order = await db.orders.find_one(
                {"order_number": order_number},
                {"order_status": 1, "shipping.name": 1, "_id": 0}
            )
            if order:
                voucher["current_order_status"] = order.get("order_status")
                voucher["customer_name"] = order.get("shipping", {}).get("name")
    
    return {
        "vouchers": vouchers,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/rto-vouchers/{voucher_code}")
async def get_rto_voucher(
    voucher_code: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get details of a specific RTO voucher"""
    await require_admin(request, session_token)
    
    voucher = await db.rto_vouchers.find_one(
        {"voucher_code": voucher_code.upper()},
        {"_id": 0}
    )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    # Get associated order
    order_number = voucher.get("order_number")
    if order_number:
        order = await db.orders.find_one(
            {"order_number": order_number},
            {"_id": 0, "order_status": 1, "shipping": 1, "pricing": 1, "items": 1}
        )
        if order:
            voucher["order_details"] = {
                "status": order.get("order_status"),
                "customer_name": order.get("shipping", {}).get("name"),
                "customer_email": order.get("shipping", {}).get("email"),
                "order_total": order.get("pricing", {}).get("final_total")
            }
    
    return voucher


@router.post("/rto-vouchers/{voucher_code}/cancel")
async def cancel_rto_voucher(
    voucher_code: str,
    request: Request,
    background_tasks: BackgroundTasks,
    session_token: Optional[str] = Cookie(None)
):
    """
    Cancel an RTO voucher when the order issue is resolved 
    (e.g., product delivered by hand after RTO).
    
    Request body (optional):
    {
        "reason": "Product delivered by hand",
        "new_order_status": "delivered" | "handed_over"  // Optional: update order status
    }
    """
    await require_admin(request, session_token)
    
    voucher = await db.rto_vouchers.find_one({"voucher_code": voucher_code.upper()})
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    if voucher.get("status") == "used":
        raise HTTPException(
            status_code=400, 
            detail="Cannot cancel a voucher that has already been used"
        )
    
    if voucher.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Voucher is already cancelled")
    
    # Get reason from request body
    try:
        body = await request.json()
        reason = body.get("reason", "Cancelled by admin")
        new_order_status = body.get("new_order_status")
    except Exception:
        reason = "Cancelled by admin"
        new_order_status = None
    
    # Update voucher status
    await db.rto_vouchers.update_one(
        {"voucher_code": voucher_code.upper()},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancellation_reason": reason
            }
        }
    )
    
    # Update the order's voucher status
    order_number = voucher.get("order_number")
    if order_number:
        order_update = {
            "rto_voucher_status": "cancelled",
            "rto_voucher_cancelled_at": datetime.now(timezone.utc).isoformat(),
            "rto_voucher_cancellation_reason": reason
        }
        
        # Optionally update order status if product was delivered
        if new_order_status in ["delivered", "handed_over"]:
            order_update["order_status"] = new_order_status
            order_update["updated_at"] = datetime.now(timezone.utc).isoformat()
            if new_order_status == "handed_over":
                order_update["handed_over_at"] = datetime.now(timezone.utc).isoformat()
            elif new_order_status == "delivered":
                order_update["delivered_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.orders.update_one(
            {"order_number": order_number},
            {"$set": order_update}
        )
    
    logger.info(f"[RTO VOUCHER] Cancelled voucher {voucher_code} for order {order_number}. Reason: {reason}")
    
    return {
        "message": "RTO voucher cancelled successfully",
        "voucher_code": voucher_code.upper(),
        "reason": reason,
        "order_status_updated": new_order_status if new_order_status else "unchanged"
    }


@router.post("/rto-vouchers/{voucher_code}/void")
async def void_rto_voucher(
    voucher_code: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Void an RTO voucher (mark as used/invalid) without it being redeemed.
    Use this when an order originally marked as RTO is later delivered.
    
    Request body (optional):
    {
        "reason": "Order delivered after RTO resolution"
    }
    """
    await require_admin(request, session_token)
    
    voucher = await db.rto_vouchers.find_one({"voucher_code": voucher_code.upper()})
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    if voucher.get("status") == "used":
        raise HTTPException(status_code=400, detail="Voucher has already been used")
    
    if voucher.get("status") in ["voided", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Voucher is already {voucher.get('status')}")
    
    try:
        body = await request.json()
        reason = body.get("reason", "Voided by admin - order delivered")
    except Exception:
        reason = "Voided by admin - order delivered"
    
    await db.rto_vouchers.update_one(
        {"voucher_code": voucher_code.upper()},
        {
            "$set": {
                "status": "voided",
                "voided_at": datetime.now(timezone.utc).isoformat(),
                "void_reason": reason
            }
        }
    )
    
    logger.info(f"[RTO VOUCHER] Voided voucher {voucher_code}. Reason: {reason}")
    
    return {
        "message": "RTO voucher voided successfully",
        "voucher_code": voucher_code.upper(),
        "reason": reason
    }


@router.get("/rto-vouchers/stats/summary")
async def get_rto_voucher_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get summary statistics for RTO vouchers"""
    await require_admin(request, session_token)
    
    # Aggregate stats
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_value": {"$sum": "$voucher_value"}
            }
        }
    ]
    
    stats_cursor = db.rto_vouchers.aggregate(pipeline)
    stats = await stats_cursor.to_list(100)
    
    # Format stats
    summary = {
        "active": {"count": 0, "total_value": 0},
        "used": {"count": 0, "total_value": 0},
        "cancelled": {"count": 0, "total_value": 0},
        "voided": {"count": 0, "total_value": 0},
        "expired": {"count": 0, "total_value": 0}
    }
    
    for stat in stats:
        status = stat["_id"]
        if status in summary:
            summary[status] = {
                "count": stat["count"],
                "total_value": round(stat["total_value"], 2)
            }
    
    # Calculate totals
    total_issued = sum(s["count"] for s in summary.values())
    total_value_issued = sum(s["total_value"] for s in summary.values())
    
    return {
        "by_status": summary,
        "total_issued": total_issued,
        "total_value_issued": round(total_value_issued, 2),
        "active_liability": round(summary["active"]["total_value"], 2)
    }


async def auto_void_rto_voucher_on_delivery(order_number: str, new_status: str):
    """
    Automatically void any active RTO voucher when order is delivered/handed over.
    Call this function when order status changes to 'delivered' or 'handed_over'.
    """
    if new_status not in ["delivered", "handed_over"]:
        return None
    
    # Find active voucher for this order
    voucher = await db.rto_vouchers.find_one({
        "order_number": order_number,
        "status": "active"
    })
    
    if not voucher:
        return None
    
    voucher_code = voucher.get("voucher_code")
    
    # Void the voucher
    await db.rto_vouchers.update_one(
        {"voucher_code": voucher_code},
        {
            "$set": {
                "status": "voided",
                "voided_at": datetime.now(timezone.utc).isoformat(),
                "void_reason": f"Auto-voided: Order status changed to {new_status}",
                "auto_voided": True
            }
        }
    )
    
    # Update order
    await db.orders.update_one(
        {"order_number": order_number},
        {
            "$set": {
                "rto_voucher_status": "voided",
                "rto_voucher_voided_at": datetime.now(timezone.utc).isoformat(),
                "rto_voucher_void_reason": f"Auto-voided on {new_status}"
            }
        }
    )
    
    logger.info(f"[RTO VOUCHER] Auto-voided voucher {voucher_code} for order {order_number} (status: {new_status})")
    
    return voucher_code
