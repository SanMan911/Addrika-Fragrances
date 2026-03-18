"""
Abandoned Cart Service for Addrika
Handles cart tracking and abandoned cart reminder emails
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# Collections
CARTS_COLLECTION = "user_carts"
ABANDONED_CART_REMINDERS = "abandoned_cart_reminders"

# Configuration
ABANDONED_CART_THRESHOLD_HOURS = 24  # Consider cart abandoned after 24 hours
REMINDER_COOLDOWN_HOURS = 72  # Don't send another reminder within 72 hours


async def get_db():
    """Get database connection"""
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'addrika_db')
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


async def save_user_cart(user_id: str, email: str, name: str, cart_items: List[Dict], phone: Optional[str] = None):
    """
    Save or update a user's cart for tracking.
    Called when a logged-in user updates their cart.
    """
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    if not cart_items:
        # If cart is empty, delete the saved cart
        await db[CARTS_COLLECTION].delete_one({"user_id": user_id})
        return {"status": "cleared"}
    
    # Calculate cart total
    cart_total = sum(item.get('price', 0) * item.get('quantity', 1) for item in cart_items)
    
    cart_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "phone": phone,
        "items": cart_items,
        "item_count": sum(item.get('quantity', 1) for item in cart_items),
        "cart_total": round(cart_total, 2),
        "updated_at": now,
        "is_abandoned": False,
        "converted": False
    }
    
    # Upsert the cart
    await db[CARTS_COLLECTION].update_one(
        {"user_id": user_id},
        {
            "$set": cart_doc,
            "$setOnInsert": {"created_at": now}
        },
        upsert=True
    )
    
    return {"status": "saved", "item_count": cart_doc["item_count"], "cart_total": cart_doc["cart_total"]}


async def mark_cart_converted(user_id: str):
    """Mark a cart as converted (order placed)"""
    db = await get_db()
    
    await db[CARTS_COLLECTION].update_one(
        {"user_id": user_id},
        {
            "$set": {
                "converted": True,
                "converted_at": datetime.now(timezone.utc)
            }
        }
    )


async def get_abandoned_carts(hours_threshold: int = ABANDONED_CART_THRESHOLD_HOURS) -> List[Dict]:
    """
    Get all carts that have been inactive for the specified threshold.
    """
    db = await get_db()
    threshold_time = datetime.now(timezone.utc) - timedelta(hours=hours_threshold)
    
    cursor = db[CARTS_COLLECTION].find({
        "updated_at": {"$lt": threshold_time},
        "converted": False,
        "item_count": {"$gt": 0}
    }).sort("updated_at", 1)
    
    abandoned = []
    async for cart in cursor:
        cart["_id"] = str(cart["_id"])
        abandoned.append(cart)
    
    return abandoned


async def should_send_reminder(user_id: str, email: str) -> bool:
    """Check if we should send a reminder (cooldown check)"""
    db = await get_db()
    cooldown_time = datetime.now(timezone.utc) - timedelta(hours=REMINDER_COOLDOWN_HOURS)
    
    recent_reminder = await db[ABANDONED_CART_REMINDERS].find_one({
        "$or": [
            {"user_id": user_id},
            {"email": email}
        ],
        "sent_at": {"$gt": cooldown_time}
    })
    
    return recent_reminder is None


async def record_reminder_sent(user_id: str, email: str, cart_total: float, item_count: int):
    """Record that a reminder was sent"""
    db = await get_db()
    
    await db[ABANDONED_CART_REMINDERS].insert_one({
        "user_id": user_id,
        "email": email,
        "cart_total": cart_total,
        "item_count": item_count,
        "sent_at": datetime.now(timezone.utc),
        "type": "email"
    })


async def process_abandoned_carts():
    """
    Process all abandoned carts and send reminder emails.
    This should be called periodically (e.g., every hour).
    """
    from services.email_service import send_abandoned_cart_email, send_admin_abandoned_cart_notification
    
    db = await get_db()
    abandoned_carts = await get_abandoned_carts()
    
    processed = 0
    failed = 0
    skipped = 0
    admin_notified = []
    
    for cart in abandoned_carts:
        user_id = cart.get("user_id")
        email = cart.get("email")
        name = cart.get("name", "Customer")
        items = cart.get("items", [])
        cart_total = cart.get("cart_total", 0)
        item_count = cart.get("item_count", 0)
        
        # Check cooldown
        if not await should_send_reminder(user_id, email):
            skipped += 1
            continue
        
        try:
            # Send customer reminder email
            success = await send_abandoned_cart_email(
                email=email,
                name=name,
                items=items,
                cart_total=cart_total
            )
            
            if success:
                await record_reminder_sent(user_id, email, cart_total, item_count)
                
                # Mark cart as reminder sent
                await db[CARTS_COLLECTION].update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "is_abandoned": True,
                            "last_reminder_at": datetime.now(timezone.utc)
                        },
                        "$inc": {"reminder_count": 1}
                    }
                )
                
                processed += 1
                
                # Add to admin notification list
                admin_notified.append({
                    "email": email,
                    "name": name,
                    "phone": cart.get("phone"),
                    "cart_total": cart_total,
                    "item_count": item_count,
                    "items": items[:3]  # First 3 items
                })
            else:
                failed += 1
                
        except Exception as e:
            logger.error(f"Error processing abandoned cart for {email}: {str(e)}")
            failed += 1
    
    # Send admin notification if there are abandoned carts
    if admin_notified:
        try:
            await send_admin_abandoned_cart_notification(admin_notified)
        except Exception as e:
            logger.error(f"Failed to send admin notification: {str(e)}")
    
    return {
        "processed": processed,
        "failed": failed,
        "skipped": skipped,
        "admin_notified": len(admin_notified)
    }


async def get_abandoned_cart_stats():
    """Get statistics about abandoned carts for admin dashboard"""
    db = await get_db()
    now = datetime.now(timezone.utc)
    threshold_time = now - timedelta(hours=ABANDONED_CART_THRESHOLD_HOURS)
    
    # Count stats
    total_carts = await db[CARTS_COLLECTION].count_documents({})
    abandoned_count = await db[CARTS_COLLECTION].count_documents({
        "updated_at": {"$lt": threshold_time},
        "converted": False,
        "item_count": {"$gt": 0}
    })
    converted_count = await db[CARTS_COLLECTION].count_documents({"converted": True})
    
    # Calculate abandoned value
    pipeline = [
        {
            "$match": {
                "updated_at": {"$lt": threshold_time},
                "converted": False,
                "item_count": {"$gt": 0}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_value": {"$sum": "$cart_total"},
                "total_items": {"$sum": "$item_count"}
            }
        }
    ]
    
    result = await db[CARTS_COLLECTION].aggregate(pipeline).to_list(1)
    abandoned_value = result[0]["total_value"] if result else 0
    abandoned_items = result[0]["total_items"] if result else 0
    
    # Get reminders sent in last 30 days
    thirty_days_ago = now - timedelta(days=30)
    reminders_sent = await db[ABANDONED_CART_REMINDERS].count_documents({
        "sent_at": {"$gt": thirty_days_ago}
    })
    
    # Get recent abandoned carts for display
    recent_abandoned = []
    cursor = db[CARTS_COLLECTION].find({
        "updated_at": {"$lt": threshold_time},
        "converted": False,
        "item_count": {"$gt": 0}
    }).sort("updated_at", -1).limit(10)
    
    async for cart in cursor:
        recent_abandoned.append({
            "user_id": cart.get("user_id"),
            "email": cart.get("email"),
            "name": cart.get("name"),
            "phone": cart.get("phone"),
            "cart_total": cart.get("cart_total"),
            "item_count": cart.get("item_count"),
            "updated_at": cart.get("updated_at").isoformat() if cart.get("updated_at") else None,
            "reminder_count": cart.get("reminder_count", 0)
        })
    
    return {
        "total_tracked_carts": total_carts,
        "abandoned_carts": abandoned_count,
        "converted_carts": converted_count,
        "abandoned_value": round(abandoned_value, 2),
        "abandoned_items": abandoned_items,
        "reminders_sent_30d": reminders_sent,
        "recent_abandoned": recent_abandoned
    }


# Background task runner
async def abandoned_cart_scheduler_loop():
    """
    Background loop that processes abandoned carts.
    Runs every hour.
    """
    while True:
        try:
            result = await process_abandoned_carts()
            if result["processed"] > 0 or result["admin_notified"] > 0:
                logger.info(f"Abandoned cart scheduler: Processed {result['processed']}, Admin notified for {result['admin_notified']} carts")
        except Exception as e:
            logger.error(f"Abandoned cart scheduler error: {str(e)}")
        
        # Wait 1 hour before next check
        await asyncio.sleep(3600)
