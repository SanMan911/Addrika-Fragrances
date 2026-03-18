"""
Database Maintenance Service for Addrika
Provides utilities for database optimization and cleanup
"""
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


async def cleanup_expired_sessions(db) -> dict:
    """Remove expired user sessions"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = await db.user_sessions.delete_many({
            "expires_at": {"$lt": now}
        })
        return {"deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Session cleanup failed: {e}")
        return {"error": str(e)}


async def cleanup_old_otps(db, hours: int = 1) -> dict:
    """Remove OTP verifications older than specified hours"""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await db.otp_verifications.delete_many({
            "created_at": {"$lt": cutoff.isoformat()}
        })
        return {"deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"OTP cleanup failed: {e}")
        return {"error": str(e)}


async def cleanup_abandoned_payment_sessions(db, hours: int = 24) -> dict:
    """Remove payment sessions that were never completed"""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await db.payment_sessions.delete_many({
            "status": "awaiting_payment",
            "created_at": {"$lt": cutoff.isoformat()}
        })
        return {"deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Payment session cleanup failed: {e}")
        return {"error": str(e)}


async def run_full_maintenance(db) -> dict:
    """Run all maintenance tasks"""
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sessions": await cleanup_expired_sessions(db),
        "otps": await cleanup_old_otps(db),
        "payment_sessions": await cleanup_abandoned_payment_sessions(db)
    }
    logger.info(f"Maintenance completed: {results}")
    return results


async def get_database_stats(db) -> dict:
    """Get database statistics for monitoring"""
    stats = {}
    collections = await db.list_collection_names()
    
    for coll in collections:
        try:
            count = await db[coll].estimated_document_count()
            stats[coll] = {"documents": count}
        except Exception as e:
            stats[coll] = {"error": str(e)}
    
    return stats
