"""Admin database maintenance routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta

from dependencies import db, require_admin

router = APIRouter(tags=["Admin Maintenance"])


@router.post("/maintenance/run")
async def run_database_maintenance(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Run database maintenance tasks:
    - Clean expired user sessions
    - Clean old OTP verifications
    - Clean abandoned payment sessions
    """
    await require_admin(request, session_token)
    
    from services.db_maintenance import run_full_maintenance
    
    results = await run_full_maintenance(db)
    return {
        "success": True,
        "maintenance_results": results
    }


@router.get("/database/stats")
async def get_database_statistics(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get database statistics for monitoring"""
    await require_admin(request, session_token)
    
    from services.db_maintenance import get_database_stats
    
    stats = await get_database_stats(db)
    return {
        "success": True,
        "statistics": stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/events/address-changes")
async def get_address_change_events(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 50
):
    """Get recent address change events for orders"""
    await require_admin(request, session_token)
    
    events = await db.admin_events.find(
        {"event_type": "order_address_change"}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Clean ObjectIds
    for event in events:
        event.pop("_id", None)
    
    return {
        "success": True,
        "events": events,
        "count": len(events)
    }


@router.get("/events/account-deletions")
async def get_account_deletion_events(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 50
):
    """Get recent account deletion logs (GDPR compliance)"""
    await require_admin(request, session_token)
    
    deletions = await db.account_deletions.find({}).sort("deleted_at", -1).limit(limit).to_list(limit)
    
    # Clean ObjectIds
    for deletion in deletions:
        deletion.pop("_id", None)
    
    return {
        "success": True,
        "deletions": deletions,
        "count": len(deletions)
    }


@router.get("/activity-summary")
async def get_admin_activity_summary(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get summary of recent admin-relevant activities"""
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    last_7_days = (now - timedelta(days=7)).isoformat()
    last_30_days = (now - timedelta(days=30)).isoformat()
    
    # Count address changes in last 7 days
    address_changes_7d = await db.admin_events.count_documents({
        "event_type": "order_address_change",
        "created_at": {"$gte": last_7_days}
    })
    
    # Count account deletions in last 30 days
    account_deletions_30d = await db.account_deletions.count_documents({
        "deleted_at": {"$gte": last_30_days}
    })
    
    # Count orders with modified addresses
    orders_with_address_changes = await db.orders.count_documents({
        "address_modified": True
    })
    
    # Count new user registrations in last 7 days
    new_users_7d = await db.users.count_documents({
        "created_at": {"$gte": last_7_days}
    })
    
    return {
        "success": True,
        "summary": {
            "address_changes_7d": address_changes_7d,
            "account_deletions_30d": account_deletions_30d,
            "orders_with_address_changes": orders_with_address_changes,
            "new_users_7d": new_users_7d
        },
        "timestamp": now.isoformat()
    }
