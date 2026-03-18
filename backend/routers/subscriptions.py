"""Email subscription routes"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import uuid

from models.content import SubscriberCreate, InstagramNotification
from services.email_service import send_welcome_email, send_instagram_notification
from dependencies import db, require_admin

router = APIRouter(tags=["Subscriptions"])


@router.post("/subscribe")
async def subscribe_email(subscriber_data: SubscriberCreate, background_tasks: BackgroundTasks):
    """Subscribe to newsletter"""
    email = subscriber_data.email.lower()
    
    # Check if already subscribed
    existing = await db.subscribers.find_one({"email": email})
    if existing:
        if existing.get("is_active"):
            return {"message": "Already subscribed", "email": email}
        else:
            # Reactivate subscription
            await db.subscribers.update_one(
                {"email": email},
                {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"message": "Subscription reactivated", "email": email}
    
    # Set default preferences
    preferences = {
        "blog_posts": True,
        "new_retailers": True,
        "promotions": True,
        "instagram_updates": True
    }
    if subscriber_data.preferences:
        preferences = subscriber_data.preferences.model_dump()
    
    subscriber = {
        "subscriber_id": str(uuid.uuid4()),
        "email": email,
        "name": subscriber_data.name,
        "is_active": True,
        "preferences": preferences,
        # Fields for future push notifications
        "fcm_token": None,
        "web_push_subscription": None,
        "phone": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscribers.insert_one(subscriber)
    
    # Send welcome email
    try:
        background_tasks.add_task(
            send_welcome_email,
            email,
            subscriber_data.name or "Subscriber"
        )
    except Exception as e:
        print(f"Failed to queue welcome email: {e}")
    
    return {"message": "Successfully subscribed", "email": email}


@router.put("/subscribe/preferences")
async def update_preferences(email: str, preferences: dict):
    """Update subscriber notification preferences"""
    result = await db.subscribers.update_one(
        {"email": email.lower()},
        {"$set": {
            "preferences": preferences,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    
    return {"message": "Preferences updated", "email": email}


@router.post("/unsubscribe")
async def unsubscribe_email(email: str):
    """Unsubscribe from newsletter"""
    result = await db.subscribers.update_one(
        {"email": email.lower()},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Successfully unsubscribed"}


# Admin subscription routes
@router.get("/admin/subscribers")
async def admin_get_subscribers(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get all subscribers"""
    await require_admin(request, session_token)
    
    subscribers = await db.subscribers.find({}).sort("created_at", -1).to_list(1000)
    
    # Normalize field names for frontend
    normalized = []
    for sub in subscribers:
        normalized.append({
            "id": sub.get("subscriber_id", str(sub.get("_id", ""))),
            "email": sub.get("email"),
            "name": sub.get("name"),
            "isActive": sub.get("is_active", False),
            "subscribedAt": sub.get("created_at", sub.get("subscribed_at")),
            "preferences": sub.get("preferences", {})
        })
    
    active_count = len([s for s in normalized if s.get("isActive")])
    
    return {
        "subscribers": normalized,
        "total": len(normalized),
        "active": active_count
    }


@router.post("/admin/instagram/notify")
async def admin_notify_instagram_post(
    notification: InstagramNotification,
    background_tasks: BackgroundTasks,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Send Instagram post notification to subscribers"""
    await require_admin(request, session_token)
    
    # Get active subscribers
    subscribers = await db.subscribers.find({"is_active": True}).to_list(1000)
    
    if not subscribers:
        return {"message": "No active subscribers", "sent_count": 0}
    
    # Send notifications
    sent_count = 0
    for subscriber in subscribers:
        try:
            background_tasks.add_task(
                send_instagram_notification,
                subscriber["email"],
                subscriber.get("name", "Subscriber"),
                notification.post_url,
                notification.caption
            )
            sent_count += 1
        except Exception as e:
            print(f"Failed to queue Instagram notification for {subscriber['email']}: {e}")
    
    # Log notification
    await db.instagram_notifications.insert_one({
        "post_url": notification.post_url,
        "caption": notification.caption,
        "sent_count": sent_count,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Notifications queued", "sent_count": sent_count}


@router.get("/admin/instagram/notifications")
async def admin_get_instagram_notifications(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get Instagram notification history"""
    await require_admin(request, session_token)
    
    notifications = await db.instagram_notifications.find({}).sort("created_at", -1).to_list(50)
    for notif in notifications:
        notif.pop("_id", None)
    
    return {"notifications": notifications}
