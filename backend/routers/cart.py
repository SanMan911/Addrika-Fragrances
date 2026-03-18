"""
Cart API Routes for Addrika
Handles cart sync and abandoned cart management
"""
from fastapi import APIRouter, HTTPException, Request, Cookie, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

from dependencies import db, get_current_user, require_admin
from services.abandoned_cart_service import (
    save_user_cart,
    mark_cart_converted,
    get_abandoned_cart_stats,
    process_abandoned_carts
)

router = APIRouter(prefix="/cart", tags=["Cart"])


class CartItem(BaseModel):
    productId: str
    name: str
    size: str
    price: float
    mrp: float
    quantity: int
    image: Optional[str] = None
    subtitle: Optional[str] = None


class SyncCartRequest(BaseModel):
    items: List[CartItem]


@router.post("/sync")
async def sync_cart(
    request: SyncCartRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Sync user's cart to the backend for abandoned cart tracking.
    Only works for logged-in users.
    """
    if not current_user:
        # Not logged in - cart stays local only
        return {"status": "skipped", "reason": "not_authenticated"}
    
    user_id = current_user.get("user_id") or str(current_user.get("_id", ""))
    email = current_user.get("email")
    name = current_user.get("name", "Customer")
    phone = current_user.get("phone")
    
    if not email:
        return {"status": "skipped", "reason": "no_email"}
    
    # Convert items to dict format
    items = [item.dict() for item in request.items]
    
    result = await save_user_cart(
        user_id=user_id,
        email=email,
        name=name,
        cart_items=items,
        phone=phone
    )
    
    return result


@router.post("/converted")
async def mark_converted(
    current_user: dict = Depends(get_current_user)
):
    """
    Mark user's cart as converted (order placed).
    Called after successful order placement.
    """
    if not current_user:
        return {"status": "skipped", "reason": "not_authenticated"}
    
    user_id = current_user.get("user_id") or str(current_user.get("_id", ""))
    
    await mark_cart_converted(user_id)
    
    return {"status": "converted"}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/stats")
async def get_cart_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get abandoned cart statistics for admin dashboard"""
    stats = await get_abandoned_cart_stats()
    return stats


@router.post("/admin/process-abandoned")
async def trigger_abandoned_cart_processing(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Manually trigger abandoned cart processing"""
    result = await process_abandoned_carts()
    return {
        "message": "Abandoned cart processing completed",
        "processed": result["processed"],
        "failed": result["failed"],
        "skipped": result["skipped"],
        "admin_notified": result["admin_notified"]
    }


@router.get("/admin/abandoned")
async def get_abandoned_carts_list(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    skip: int = 0,
    limit: int = 50,
    admin: dict = Depends(require_admin)
):
    """Get list of abandoned carts for admin review"""
    from datetime import timedelta
    from services.abandoned_cart_service import ABANDONED_CART_THRESHOLD_HOURS
    
    threshold_time = datetime.now(timezone.utc) - timedelta(hours=ABANDONED_CART_THRESHOLD_HOURS)
    
    cursor = db.user_carts.find({
        "updated_at": {"$lt": threshold_time},
        "converted": False,
        "item_count": {"$gt": 0}
    }).sort("cart_total", -1).skip(skip).limit(limit)
    
    carts = []
    async for cart in cursor:
        carts.append({
            "user_id": cart.get("user_id"),
            "email": cart.get("email"),
            "name": cart.get("name"),
            "phone": cart.get("phone"),
            "cart_total": cart.get("cart_total"),
            "item_count": cart.get("item_count"),
            "items": cart.get("items", []),
            "updated_at": cart.get("updated_at").isoformat() if cart.get("updated_at") else None,
            "created_at": cart.get("created_at").isoformat() if cart.get("created_at") else None,
            "reminder_count": cart.get("reminder_count", 0),
            "last_reminder_at": cart.get("last_reminder_at").isoformat() if cart.get("last_reminder_at") else None
        })
    
    total = await db.user_carts.count_documents({
        "updated_at": {"$lt": threshold_time},
        "converted": False,
        "item_count": {"$gt": 0}
    })
    
    return {"carts": carts, "total": total}


@router.delete("/admin/abandoned/{user_id}")
async def clear_abandoned_cart(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Remove a cart from tracking (e.g., after manual follow-up)"""
    result = await db.user_carts.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    return {"message": "Cart removed from tracking"}
