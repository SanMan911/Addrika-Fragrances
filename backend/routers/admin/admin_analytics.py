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


@router.get("/tree-donations")
async def get_tree_donation_metrics(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days: int = 30
):
    """
    Get tree donation metrics with date range filtering.
    
    Args:
        start_date: Start date in ISO format (optional)
        end_date: End date in ISO format (optional)
        days: Number of days to look back if dates not provided (default 30)
    
    Returns:
        Tree donation statistics, daily breakdown, and order details
    """
    await require_admin(request, session_token)
    
    # Build date filter
    if start_date and end_date:
        date_filter = {
            "$gte": start_date,
            "$lte": end_date
        }
    else:
        days = min(days, 365)
        start = datetime.now(timezone.utc) - timedelta(days=days)
        date_filter = {"$gte": start.isoformat()}
    
    # Aggregate tree donations
    pipeline = [
        # Match orders with tree donations
        {"$match": {
            "created_at": date_filter,
            "payment_status": {"$in": ["paid", "completed"]},
            "pricing.tree_donation": {"$gt": 0}
        }},
        {"$group": {
            "_id": None,
            "total_customer_donations": {"$sum": "$pricing.tree_donation"},
            "total_orders_with_donation": {"$sum": 1},
            "donation_amounts": {"$push": "$pricing.tree_donation"}
        }}
    ]
    
    results = await db.orders.aggregate(pipeline).to_list(1)
    
    summary = {
        "total_customer_donations": 0,
        "total_addrika_match": 0,
        "total_combined": 0,
        "total_trees_funded": 0,
        "total_orders_with_donation": 0,
        "average_donation": 0,
        "tree_cost": 10  # ₹5 customer + ₹5 Addrika = ₹10 per tree
    }
    
    if results and results[0]:
        data = results[0]
        customer_total = data.get("total_customer_donations", 0)
        summary["total_customer_donations"] = customer_total
        summary["total_addrika_match"] = customer_total  # Addrika matches 1:1
        summary["total_combined"] = customer_total * 2
        summary["total_trees_funded"] = int(summary["total_combined"] / 10)  # ₹10 per tree
        summary["total_orders_with_donation"] = data.get("total_orders_with_donation", 0)
        if summary["total_orders_with_donation"] > 0:
            summary["average_donation"] = round(customer_total / summary["total_orders_with_donation"], 2)
    
    # Daily breakdown
    daily_pipeline = [
        {"$match": {
            "created_at": date_filter,
            "payment_status": {"$in": ["paid", "completed"]},
            "pricing.tree_donation": {"$gt": 0}
        }},
        {"$group": {
            "_id": {
                "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
                "month": {"$month": {"$dateFromString": {"dateString": "$created_at"}}},
                "day": {"$dayOfMonth": {"$dateFromString": {"dateString": "$created_at"}}}
            },
            "donations": {"$sum": "$pricing.tree_donation"},
            "order_count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}}
    ]
    
    daily_results = await db.orders.aggregate(daily_pipeline).to_list(365)
    
    daily_breakdown = []
    for item in daily_results:
        _id = item["_id"]
        date_str = f"{_id['year']}-{str(_id['month']).zfill(2)}-{str(_id['day']).zfill(2)}"
        display_date = datetime(_id['year'], _id['month'], _id['day']).strftime("%d %b %Y")
        
        daily_breakdown.append({
            "date": date_str,
            "display_date": display_date,
            "customer_donations": item["donations"],
            "addrika_match": item["donations"],
            "total": item["donations"] * 2,
            "trees": int(item["donations"] * 2 / 10),
            "orders": item["order_count"]
        })
    
    # Get recent orders with donations (for invoice details)
    recent_orders = await db.orders.find(
        {
            "created_at": date_filter,
            "payment_status": {"$in": ["paid", "completed"]},
            "pricing.tree_donation": {"$gt": 0}
        },
        {
            "_id": 0,
            "order_number": 1,
            "created_at": 1,
            "billing.name": 1,
            "billing.email": 1,
            "pricing.tree_donation": 1,
            "pricing.final_total": 1
        }
    ).sort("created_at", -1).limit(100).to_list(100)
    
    order_details = []
    for order in recent_orders:
        order_details.append({
            "order_number": order.get("order_number"),
            "date": order.get("created_at"),
            "customer_name": order.get("billing", {}).get("name", "N/A"),
            "customer_email": order.get("billing", {}).get("email", "N/A"),
            "donation_amount": order.get("pricing", {}).get("tree_donation", 0),
            "order_total": order.get("pricing", {}).get("final_total", 0)
        })
    
    return {
        "summary": summary,
        "daily_breakdown": daily_breakdown,
        "order_details": order_details,
        "date_range": {
            "start": start_date or (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(),
            "end": end_date or datetime.now(timezone.utc).isoformat()
        }
    }
