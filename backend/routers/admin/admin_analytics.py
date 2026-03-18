"""Admin analytics routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from dependencies import db, require_admin

router = APIRouter(tags=["Admin Analytics"])
logger = logging.getLogger(__name__)


@router.get("/revenue-trends")
async def get_revenue_trends(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "daily",  # daily, weekly, monthly
    days: int = 30  # Number of days to look back
):
    """
    Get revenue trends over time for dashboard analytics.
    
    Args:
        period: 'daily', 'weekly', or 'monthly' aggregation
        days: Number of days to look back (default 30, max 365)
    
    Returns:
        List of revenue data points with date and amount
    """
    await require_admin(request, session_token)
    
    # Limit days for performance
    days = min(days, 365)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Build aggregation based on period
    if period == "monthly":
        group_id = {
            "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
            "month": {"$month": {"$dateFromString": {"dateString": "$created_at"}}}
        }
    elif period == "weekly":
        group_id = {
            "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
            "week": {"$isoWeek": {"$dateFromString": {"dateString": "$created_at"}}}
        }
    else:  # daily
        group_id = {
            "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
            "month": {"$month": {"$dateFromString": {"dateString": "$created_at"}}},
            "day": {"$dayOfMonth": {"$dateFromString": {"dateString": "$created_at"}}}
        }
    
    pipeline = [
        # Match paid orders within date range
        {"$match": {
            "payment_status": {"$in": ["paid", "completed"]},
            "created_at": {"$gte": start_date.isoformat()}
        }},
        # Group by period
        {"$group": {
            "_id": group_id,
            "revenue": {"$sum": "$pricing.final_total"},
            "order_count": {"$sum": 1},
            "avg_order_value": {"$avg": "$pricing.final_total"}
        }},
        # Sort by date
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1}}
    ]
    
    results = await db.orders.aggregate(pipeline).to_list(365)
    
    # Format results for frontend chart
    formatted_data = []
    for item in results:
        _id = item["_id"]
        
        if period == "monthly":
            date_label = f"{_id['year']}-{str(_id['month']).zfill(2)}"
            display_label = datetime(_id['year'], _id['month'], 1).strftime("%b %Y")
        elif period == "weekly":
            date_label = f"{_id['year']}-W{str(_id['week']).zfill(2)}"
            display_label = f"Week {_id['week']}, {_id['year']}"
        else:  # daily
            date_label = f"{_id['year']}-{str(_id['month']).zfill(2)}-{str(_id['day']).zfill(2)}"
            display_label = datetime(_id['year'], _id['month'], _id['day']).strftime("%d %b")
        
        formatted_data.append({
            "date": date_label,
            "label": display_label,
            "revenue": round(item["revenue"] or 0, 2),
            "orders": item["order_count"] or 0,
            "avg_order": round(item["avg_order_value"] or 0, 2)
        })
    
    # Calculate summary stats
    total_revenue = sum(d["revenue"] for d in formatted_data)
    total_orders = sum(d["orders"] for d in formatted_data)
    
    # Calculate growth percentage (compare last period to previous)
    growth_percentage = 0
    if len(formatted_data) >= 2:
        current = formatted_data[-1]["revenue"]
        previous = formatted_data[-2]["revenue"]
        if previous > 0:
            growth_percentage = round(((current - previous) / previous) * 100, 1)
    
    return {
        "data": formatted_data,
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "avg_order_value": round(total_revenue / total_orders, 2) if total_orders > 0 else 0,
            "growth_percentage": growth_percentage,
            "period": period,
            "days_analyzed": days
        }
    }


@router.get("/order-stats")
async def get_order_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    days: int = 30
):
    """
    Get order status distribution and trends.
    """
    await require_admin(request, session_token)
    
    days = min(days, 365)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Status distribution
    status_pipeline = [
        {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$order_status",
            "count": {"$sum": 1},
            "revenue": {"$sum": "$pricing.final_total"}
        }}
    ]
    
    status_results = await db.orders.aggregate(status_pipeline).to_list(20)
    
    status_distribution = {}
    for item in status_results:
        status = item["_id"] or "unknown"
        status_distribution[status] = {
            "count": item["count"],
            "revenue": round(item["revenue"], 2)
        }
    
    # Payment method distribution
    payment_pipeline = [
        {"$match": {
            "created_at": {"$gte": start_date.isoformat()},
            "payment_status": {"$in": ["paid", "completed"]}
        }},
        {"$group": {
            "_id": "$payment_mode",
            "count": {"$sum": 1},
            "revenue": {"$sum": "$pricing.final_total"}
        }}
    ]
    
    payment_results = await db.orders.aggregate(payment_pipeline).to_list(20)
    
    payment_distribution = {}
    for item in payment_results:
        mode = item["_id"] or "Unknown"
        payment_distribution[mode] = {
            "count": item["count"],
            "revenue": round(item["revenue"], 2)
        }
    
    return {
        "status_distribution": status_distribution,
        "payment_distribution": payment_distribution,
        "period_days": days
    }


@router.get("/scheduled-reviews")
async def get_scheduled_reviews(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get statistics and upcoming scheduled review emails"""
    await require_admin(request, session_token)
    
    from services.scheduler_service import get_scheduled_reviews_stats
    
    try:
        stats = await get_scheduled_reviews_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get scheduled reviews stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduled-reviews/process")
async def process_scheduled_reviews(request: Request, session_token: Optional[str] = Cookie(None)):
    """Manually trigger processing of pending review emails"""
    await require_admin(request, session_token)
    
    from services.scheduler_service import process_pending_review_emails
    
    try:
        result = await process_pending_review_emails()
        return {
            "message": "Review emails processed",
            "processed": result["processed"],
            "failed": result["failed"]
        }
    except Exception as e:
        logger.error(f"Failed to process review emails: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scheduled-reviews/{order_number}")
async def cancel_scheduled_review(order_number: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """Cancel a scheduled review email"""
    await require_admin(request, session_token)
    
    from services.scheduler_service import cancel_scheduled_review
    
    try:
        cancelled = await cancel_scheduled_review(order_number)
        if cancelled:
            return {"message": f"Scheduled review for {order_number} cancelled"}
        else:
            raise HTTPException(status_code=404, detail="No pending review found for this order")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel review: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
