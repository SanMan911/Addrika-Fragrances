"""Notify Me endpoint — collect emails for coming-soon products"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone

from dependencies import db, require_admin

router = APIRouter(tags=["Notify Me"])


class NotifyMeRequest(BaseModel):
    email: EmailStr
    product_id: str


@router.post("/notify-me")
async def subscribe_notify(payload: NotifyMeRequest):
    """Subscribe to notifications for a coming-soon product."""
    # Verify product exists and is actually coming soon
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0, "comingSoon": 1, "name": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.get("comingSoon"):
        raise HTTPException(status_code=400, detail="Product is already available")

    # Upsert — one entry per email+product combo
    await db.notify_me.update_one(
        {"email": payload.email.lower(), "product_id": payload.product_id},
        {"$set": {
            "email": payload.email.lower(),
            "product_id": payload.product_id,
            "product_name": product.get("name", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        "$setOnInsert": {
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )

    return {"message": "You'll be notified when this product launches!"}


@router.get("/admin/notify-me")
async def admin_list_notify(admin=Depends(require_admin)):
    """Admin: list all notify-me signups grouped by product."""
    pipeline = [
        {"$group": {
            "_id": "$product_id",
            "product_name": {"$first": "$product_name"},
            "count": {"$sum": 1},
            "emails": {"$push": "$email"},
            "latest": {"$max": "$created_at"},
        }},
        {"$sort": {"count": -1}}
    ]
    results = await db.notify_me.aggregate(pipeline).to_list(100)
    for r in results:
        r["product_id"] = r.pop("_id")
    return results


@router.get("/admin/notify-me/{product_id}")
async def admin_notify_detail(product_id: str, admin=Depends(require_admin)):
    """Admin: list all emails for a specific product."""
    entries = await db.notify_me.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return entries
