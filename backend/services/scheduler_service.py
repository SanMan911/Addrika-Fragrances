"""
Background Task Scheduler for Addrika
Handles scheduled tasks like review request emails
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Scheduled review emails collection
REVIEW_SCHEDULE_COLLECTION = "scheduled_review_emails"


async def get_db():
    """Get database connection"""
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'addrika')
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


async def schedule_review_email(order: dict, days_after_delivery: int = 3):
    """
    Schedule a review request email to be sent after delivery.
    
    Args:
        order: The order document
        days_after_delivery: Number of days after delivery to send email (default: 3)
    """
    db = await get_db()
    
    order_number = order.get('orderNumber')
    customer_email = order.get('shipping', {}).get('email')
    
    if not customer_email:
        logger.warning(f"Cannot schedule review email - no email for order {order_number}")
        return False
    
    # Calculate send time (3 days from now, at 10 AM IST)
    now = datetime.now(timezone.utc)
    send_at = now + timedelta(days=days_after_delivery)
    # Adjust to 10 AM IST (4:30 AM UTC)
    send_at = send_at.replace(hour=4, minute=30, second=0, microsecond=0)
    
    schedule_doc = {
        "order_number": order_number,
        "customer_email": customer_email,
        "customer_name": order.get('shipping', {}).get('name', 'Customer'),
        "order_data": order,
        "scheduled_at": now,
        "send_at": send_at,
        "status": "pending",  # pending, sent, failed, cancelled
        "attempts": 0,
        "last_attempt": None,
        "sent_at": None
    }
    
    # Check if already scheduled
    existing = await db[REVIEW_SCHEDULE_COLLECTION].find_one({
        "order_number": order_number,
        "status": "pending"
    })
    
    if existing:
        logger.info(f"Review email already scheduled for order {order_number}")
        return True
    
    result = await db[REVIEW_SCHEDULE_COLLECTION].insert_one(schedule_doc)
    logger.info(f"Scheduled review email for order {order_number}, will send at {send_at}")
    
    return bool(result.inserted_id)


async def process_pending_review_emails():
    """
    Process all pending review emails that are due.
    This should be called periodically (e.g., every hour).
    """
    from services.email_service import send_review_request_email
    
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    # Find all pending emails that are due
    cursor = db[REVIEW_SCHEDULE_COLLECTION].find({
        "status": "pending",
        "send_at": {"$lte": now},
        "attempts": {"$lt": 3}  # Max 3 attempts
    })
    
    processed = 0
    failed = 0
    
    async for doc in cursor:
        order_number = doc.get("order_number")
        order_data = doc.get("order_data", {})
        
        try:
            # Send the review email
            success = await send_review_request_email(order_data)
            
            if success:
                # Mark as sent
                await db[REVIEW_SCHEDULE_COLLECTION].update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {
                            "status": "sent",
                            "sent_at": now,
                            "last_attempt": now
                        },
                        "$inc": {"attempts": 1}
                    }
                )
                processed += 1
                logger.info(f"Sent review email for order {order_number}")
            else:
                # Mark attempt failed
                await db[REVIEW_SCHEDULE_COLLECTION].update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {"last_attempt": now},
                        "$inc": {"attempts": 1}
                    }
                )
                failed += 1
                
        except Exception as e:
            logger.error(f"Error sending review email for {order_number}: {str(e)}")
            await db[REVIEW_SCHEDULE_COLLECTION].update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "last_attempt": now,
                        "error": str(e)
                    },
                    "$inc": {"attempts": 1}
                }
            )
            failed += 1
    
    # Mark emails with 3+ failed attempts as failed
    await db[REVIEW_SCHEDULE_COLLECTION].update_many(
        {"status": "pending", "attempts": {"$gte": 3}},
        {"$set": {"status": "failed"}}
    )
    
    return {"processed": processed, "failed": failed}


async def cancel_scheduled_review(order_number: str):
    """Cancel a scheduled review email (e.g., if order is cancelled/returned)"""
    db = await get_db()
    
    result = await db[REVIEW_SCHEDULE_COLLECTION].update_many(
        {"order_number": order_number, "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return result.modified_count > 0


async def get_scheduled_reviews_stats():
    """Get statistics about scheduled review emails"""
    db = await get_db()
    
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]
    
    cursor = db[REVIEW_SCHEDULE_COLLECTION].aggregate(pipeline)
    stats = {doc["_id"]: doc["count"] async for doc in cursor}
    
    # Get next 5 pending emails
    pending_cursor = db[REVIEW_SCHEDULE_COLLECTION].find(
        {"status": "pending"}
    ).sort("send_at", 1).limit(5)
    
    upcoming = []
    async for doc in pending_cursor:
        upcoming.append({
            "order_number": doc.get("order_number"),
            "customer_email": doc.get("customer_email"),
            "send_at": doc.get("send_at").isoformat() if doc.get("send_at") else None
        })
    
    return {
        "stats": stats,
        "upcoming": upcoming
    }


# Background task runner
async def review_email_scheduler_loop():
    """
    Background loop that processes pending review emails.
    Runs every hour.
    """
    while True:
        try:
            result = await process_pending_review_emails()
            if result["processed"] > 0 or result["failed"] > 0:
                logger.info(f"Review email scheduler: Processed {result['processed']}, Failed {result['failed']}")
        except Exception as e:
            logger.error(f"Review email scheduler error: {str(e)}")
        
        # Wait 1 hour before next check
        await asyncio.sleep(3600)


# ===================== Rewards/Coins Expiry Scheduler =====================

async def process_coin_expiry_and_reminders():
    """
    Process coin expiry and send reminder emails.
    - Expire coins for users past their expiry date
    - Send reminder emails 7 days before expiry
    """
    from services.email_service import send_coin_expiry_reminder_email
    from config.rewards_config import EXPIRY_REMINDER_DAYS
    
    db = await get_db()
    now = datetime.now(timezone.utc)
    reminder_threshold = now + timedelta(days=EXPIRY_REMINDER_DAYS)
    
    expired_count = 0
    reminders_sent = 0
    
    # Find users with coins that need processing
    cursor = db.user_rewards.find({
        "coins_balance": {"$gt": 0}
    })
    
    async for reward in cursor:
        user_id = reward.get('user_id')
        email = reward.get('email')
        coins_balance = reward.get('coins_balance', 0)
        expiry_date = reward.get('coins_expiry_date')
        reminder_sent = reward.get('expiry_reminder_sent', False)
        
        if not expiry_date:
            continue
            
        # Parse expiry date
        if isinstance(expiry_date, str):
            try:
                expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
            except:
                continue
        
        # Check if expired
        if expiry_date < now:
            # Expire the coins
            try:
                from routers.rewards import expire_user_coins
                result = await expire_user_coins(user_id, email)
                if result.get('expired', 0) > 0:
                    expired_count += 1
                    logger.info(f"Expired {result['expired']} coins for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to expire coins for user {user_id}: {e}")
            continue
        
        # Check if reminder should be sent
        if not reminder_sent and now >= (expiry_date - timedelta(days=EXPIRY_REMINDER_DAYS)):
            try:
                # Get user details
                user = await db.users.find_one({"user_id": user_id}, {"name": 1, "_id": 0})
                user_name = user.get('name', 'Valued Customer') if user else 'Valued Customer'
                
                # Send reminder email
                success = await send_coin_expiry_reminder_email(
                    email=email,
                    name=user_name,
                    coins_balance=coins_balance,
                    expiry_date=expiry_date
                )
                
                if success:
                    # Mark reminder as sent
                    await db.user_rewards.update_one(
                        {"user_id": user_id},
                        {"$set": {"expiry_reminder_sent": True}}
                    )
                    reminders_sent += 1
                    logger.info(f"Sent coin expiry reminder to {email}")
            except Exception as e:
                logger.error(f"Failed to send expiry reminder to {email}: {e}")
    
    return {"expired": expired_count, "reminders_sent": reminders_sent}


async def coin_expiry_scheduler_loop():
    """
    Background loop that processes coin expiry and reminders.
    Runs every 6 hours.
    """
    # Wait 5 minutes after startup before first run
    await asyncio.sleep(300)
    
    while True:
        try:
            result = await process_coin_expiry_and_reminders()
            if result["expired"] > 0 or result["reminders_sent"] > 0:
                logger.info(f"Coin expiry scheduler: Expired {result['expired']}, Reminders sent {result['reminders_sent']}")
        except Exception as e:
            logger.error(f"Coin expiry scheduler error: {str(e)}")
        
        # Wait 6 hours before next check
        await asyncio.sleep(6 * 3600)
