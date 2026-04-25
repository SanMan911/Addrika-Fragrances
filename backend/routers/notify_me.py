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



@router.post("/admin/notify-me/{product_id}/blast")
async def admin_send_blast(product_id: str, admin=Depends(require_admin)):
    """Admin-triggered blast: emails everyone subscribed for a product that is
    now Available. Marks each entry as `notified_at` so the same email is not
    re-blasted. Idempotent.
    """
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.get("comingSoon"):
        raise HTTPException(
            status_code=400,
            detail="Product is still marked Coming Soon; flip availability first.",
        )

    cursor = db.notify_me.find(
        {"product_id": product_id, "notified_at": {"$exists": False}},
        {"_id": 0},
    )

    from services.email_service import send_email
    sent, failed = 0, 0
    name = product.get("name", "your product")
    image = product.get("image") or (product.get("images") or [None])[0]
    img_html = (
        f'<img src="{image}" alt="{name}" '
        f'style="width:100%;max-width:480px;border-radius:8px;display:block;margin:0 auto 18px;" />'
        if image
        else ""
    )
    async for sub in cursor:
        try:
            html = f"""
            <!DOCTYPE html>
            <html><body style="font-family:Arial,sans-serif;background:#f9f7f4;padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
                    <tr><td style="background:#1e3a52;padding:24px;text-align:center;">
                        <h1 style="color:#d4af37;margin:0;letter-spacing:2px;">ADDRIKA</h1>
                        <p style="color:#fff;margin:6px 0 0;font-size:13px;">It's available!</p>
                    </td></tr>
                    <tr><td style="padding:24px;">
                        {img_html}
                        <h2 style="color:#1e3a52;margin:0 0 8px;">{name} is now in stock</h2>
                        <p style="color:#444;line-height:1.6;">
                            You asked us to let you know — and we kept our word.
                            <strong>{name}</strong> just landed on our shelf and is ready to ship.
                        </p>
                        <p style="text-align:center;margin:24px 0;">
                            <a href="https://addrika.com/products/{product_id}"
                               style="background:#d4af37;color:#1e3a52;padding:12px 28px;border-radius:8px;
                                      text-decoration:none;font-weight:bold;">
                                Shop now
                            </a>
                        </p>
                        <p style="color:#666;font-size:12px;margin-top:24px;">
                            You're receiving this because you subscribed to a launch alert
                            on addrika.com. Reply if you'd rather not hear from us again.
                        </p>
                    </td></tr>
                </table>
            </body></html>
            """
            await send_email(
                to_email=sub["email"],
                subject=f"It's here · {name} just dropped",
                html_content=html,
            )
            await db.notify_me.update_one(
                {"email": sub["email"], "product_id": product_id},
                {"$set": {"notified_at": datetime.now(timezone.utc).isoformat()}},
            )
            sent += 1
        except Exception:
            failed += 1
    return {"product_id": product_id, "sent": sent, "failed": failed}
