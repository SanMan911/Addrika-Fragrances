"""Admin retailer management routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from dependencies import db, require_admin

router = APIRouter(tags=["Admin Retailers"])
logger = logging.getLogger(__name__)


@router.get("/retailers/performance")
async def admin_get_all_retailer_performance(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin view: Get performance metrics for all retailers"""
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    # Get all active retailers
    retailers = await db.retailers.find(
        {"status": "active"},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    performance_data = []
    
    for retailer in retailers:
        retailer_id = retailer['retailer_id']
        
        # Total orders
        total_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ]
        })
        
        # Completed orders
        completed_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ],
            "order_status": "delivered"
        })
        
        # Recent orders (30 days)
        recent_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ],
            "created_at": {"$gte": thirty_days_ago.isoformat()}
        })
        
        # Pending orders
        pending_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ],
            "order_status": {"$in": ["pending", "confirmed", "processing", "ready_for_pickup"]}
        })
        
        # Open grievances
        open_grievances = await db.retailer_complaints.count_documents({
            "retailer_id": retailer_id,
            "status": {"$in": ["open", "in_progress"]}
        })
        
        # Completion rate
        completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        
        performance_data.append({
            "retailer_id": retailer_id,
            "name": retailer['name'],
            "city": retailer.get('city'),
            "district": retailer.get('district'),
            "state": retailer.get('state'),
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "recent_orders_30d": recent_orders,
            "pending_orders": pending_orders,
            "completion_rate": round(completion_rate, 1),
            "open_grievances": open_grievances,
            "status": retailer.get('status'),
            "created_at": retailer.get('created_at')
        })
    
    # Sort by total orders descending
    performance_data.sort(key=lambda x: x['total_orders'], reverse=True)
    
    # Aggregate stats
    total_retailers = len(performance_data)
    total_all_orders = sum(p['total_orders'] for p in performance_data)
    total_completed = sum(p['completed_orders'] for p in performance_data)
    total_pending = sum(p['pending_orders'] for p in performance_data)
    
    return {
        "retailers": performance_data,
        "aggregate": {
            "total_retailers": total_retailers,
            "total_orders": total_all_orders,
            "total_completed": total_completed,
            "total_pending": total_pending,
            "overall_completion_rate": round((total_completed / total_all_orders * 100) if total_all_orders > 0 else 0, 1)
        }
    }


@router.get("/retailers/leaderboard")
async def admin_get_retailer_leaderboard(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "all_time"  # all_time, monthly, weekly
):
    """Admin view: Get retailer leaderboard - top performers by various metrics"""
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    
    # Determine date filter based on period
    date_filter = {}
    if period == "monthly":
        start_date = now - timedelta(days=30)
        date_filter = {"created_at": {"$gte": start_date.isoformat()}}
    elif period == "weekly":
        start_date = now - timedelta(days=7)
        date_filter = {"created_at": {"$gte": start_date.isoformat()}}
    
    # Get all active retailers
    retailers = await db.retailers.find(
        {"status": "active"},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    leaderboard_data = []
    
    for retailer in retailers:
        retailer_id = retailer['retailer_id']
        
        # Build order query with date filter
        order_query = {
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ]
        }
        if date_filter:
            order_query.update(date_filter)
        
        # Total orders
        total_orders = await db.orders.count_documents(order_query)
        
        # Completed orders
        completed_query = {**order_query, "order_status": "delivered"}
        completed_orders = await db.orders.count_documents(completed_query)
        
        # Revenue from completed orders
        revenue_pipeline = [
            {"$match": completed_query},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        
        # Completion rate
        completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        
        # Average order value
        avg_order_value = (total_revenue / completed_orders) if completed_orders > 0 else 0
        
        # Customer satisfaction score (from grievance resolution rate)
        total_grievances = await db.retailer_complaints.count_documents({"retailer_id": retailer_id})
        resolved_grievances = await db.retailer_complaints.count_documents({
            "retailer_id": retailer_id,
            "status": {"$in": ["resolved", "closed"]}
        })
        satisfaction_score = ((total_grievances - (total_grievances - resolved_grievances)) / total_grievances * 100) if total_grievances > 0 else 100
        
        # Calculate overall score (weighted)
        # 40% completion rate + 30% order volume + 20% revenue + 10% satisfaction
        volume_score = min(total_orders * 2, 100)  # Cap at 100
        revenue_score = min(total_revenue / 1000, 100)  # ₹100k = 100 score
        overall_score = (
            (completion_rate * 0.4) +
            (volume_score * 0.3) +
            (revenue_score * 0.2) +
            (satisfaction_score * 0.1)
        )
        
        leaderboard_data.append({
            "retailer_id": retailer_id,
            "name": retailer['name'],
            "city": retailer.get('city'),
            "district": retailer.get('district'),
            "state": retailer.get('state'),
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "completion_rate": round(completion_rate, 1),
            "total_revenue": round(total_revenue, 2),
            "avg_order_value": round(avg_order_value, 2),
            "satisfaction_score": round(satisfaction_score, 1),
            "overall_score": round(overall_score, 1)
        })
    
    # Sort by overall score (descending)
    leaderboard_data.sort(key=lambda x: x['overall_score'], reverse=True)
    
    # Add ranks
    for idx, item in enumerate(leaderboard_data):
        item['rank'] = idx + 1
    
    # Top performers
    top_by_orders = sorted(leaderboard_data, key=lambda x: x['total_orders'], reverse=True)[:5]
    top_by_revenue = sorted(leaderboard_data, key=lambda x: x['total_revenue'], reverse=True)[:5]
    top_by_completion = sorted([r for r in leaderboard_data if r['total_orders'] >= 5], 
                               key=lambda x: x['completion_rate'], reverse=True)[:5]
    
    return {
        "period": period,
        "leaderboard": leaderboard_data,
        "top_performers": {
            "by_orders": [{"rank": i+1, **r} for i, r in enumerate(top_by_orders)],
            "by_revenue": [{"rank": i+1, **r} for i, r in enumerate(top_by_revenue)],
            "by_completion_rate": [{"rank": i+1, **r} for i, r in enumerate(top_by_completion)]
        },
        "scoring_weights": {
            "completion_rate": "40%",
            "order_volume": "30%",
            "revenue": "20%",
            "satisfaction": "10%"
        }
    }


@router.get("/retailers/messages")
async def admin_get_retailer_messages(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    page: int = 1,
    limit: int = 50
):
    """Admin view: Get all inter-retailer message logs"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    
    messages = await db.retailer_messages.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_messages.count_documents({})
    
    # Get message stats by district
    pipeline = [
        {
            "$lookup": {
                "from": "retailers",
                "localField": "from_retailer_id",
                "foreignField": "retailer_id",
                "as": "sender"
            }
        },
        {
            "$unwind": {"path": "$sender", "preserveNullAndEmptyArrays": True}
        },
        {
            "$group": {
                "_id": "$sender.district",
                "message_count": {"$sum": 1}
            }
        },
        {"$sort": {"message_count": -1}}
    ]
    
    district_stats = await db.retailer_messages.aggregate(pipeline).to_list(50)
    
    return {
        "messages": messages,
        "district_stats": district_stats,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/retailers/grievances")
async def admin_get_all_grievances(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin view: Get all retailer grievances"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    
    if status:
        query["status"] = status
    
    grievances = await db.retailer_complaints.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_complaints.count_documents(query)
    
    # Status counts
    status_counts = {}
    for s in ['open', 'in_progress', 'resolved', 'closed']:
        status_counts[s] = await db.retailer_complaints.count_documents({"status": s})
    
    return {
        "grievances": grievances,
        "status_counts": status_counts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


class GrievanceStatusUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None


@router.put("/retailers/grievances/{complaint_id}")
async def admin_update_grievance_status(
    complaint_id: str,
    update_data: GrievanceStatusUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin: Update grievance status"""
    user = await require_admin(request, session_token)
    
    grievance = await db.retailer_complaints.find_one({"complaint_id": complaint_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    
    now = datetime.now(timezone.utc)
    
    update = {
        "status": update_data.status,
        "updated_at": now.isoformat()
    }
    
    if update_data.resolution_notes:
        update["resolution_notes"] = update_data.resolution_notes
    
    if update_data.status in ['resolved', 'closed']:
        update["resolved_at"] = now.isoformat()
        update["resolved_by"] = user.get('email')
    
    await db.retailer_complaints.update_one(
        {"complaint_id": complaint_id},
        {"$set": update}
    )
    
    logger.info(f"Admin updated grievance {complaint_id} to {update_data.status}")
    
    return {"message": "Grievance updated", "new_status": update_data.status}


# ============================================================================
# Retailer Activity Dashboard - Abandoned Carts & Self-Pickup Performance
# ============================================================================

@router.get("/retailers/activity-dashboard")
async def admin_get_retailer_activity_dashboard(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Admin view: Comprehensive retailer activity dashboard
    - Overview stats for all retailers
    - Abandoned cart summary by retailer
    - Self-pickup performance metrics
    - Star retailer identification
    """
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    ninety_days_ago = now - timedelta(days=90)
    
    # Get all retailers
    retailers = await db.retailers.find(
        {"status": {"$in": ["active", "pending_verification"]}},
        {"_id": 0, "password_hash": 0, "legal_documents": 0}
    ).to_list(500)
    
    retailer_map = {r['retailer_id']: r for r in retailers}
    
    # ========== ABANDONED CARTS BY RETAILER ==========
    # Carts where user selected a retailer for pickup but didn't complete
    abandoned_cart_pipeline = [
        {
            "$match": {
                "pickup_store.id": {"$exists": True, "$ne": None},
                "status": {"$in": ["abandoned", "expired"]},
                "updated_at": {"$gte": thirty_days_ago.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$pickup_store.id",
                "abandoned_count": {"$sum": 1},
                "total_value": {"$sum": "$total"},
                "latest_abandoned": {"$max": "$updated_at"}
            }
        },
        {"$sort": {"abandoned_count": -1}}
    ]
    
    abandoned_by_retailer = await db.carts.aggregate(abandoned_cart_pipeline).to_list(100)
    
    # ========== SELF-PICKUP PERFORMANCE ==========
    # Orders where delivery_method is store_pickup and status is delivered
    pickup_performance_pipeline = [
        {
            "$match": {
                "delivery_method": "store_pickup",
                "pickup_store.id": {"$exists": True}
            }
        },
        {
            "$group": {
                "_id": "$pickup_store.id",
                "total_pickups": {"$sum": 1},
                "completed_pickups": {
                    "$sum": {"$cond": [{"$eq": ["$order_status", "delivered"]}, 1, 0]}
                },
                "pending_pickups": {
                    "$sum": {"$cond": [{"$in": ["$order_status", ["confirmed", "ready_for_pickup"]]}, 1, 0]}
                },
                "total_items": {"$sum": {"$size": {"$ifNull": ["$items", []]}}},
                "total_revenue": {
                    "$sum": {"$cond": [{"$eq": ["$order_status", "delivered"]}, "$total", 0]}
                }
            }
        },
        {"$sort": {"completed_pickups": -1}}
    ]
    
    pickup_by_retailer = await db.orders.aggregate(pickup_performance_pipeline).to_list(100)
    
    # ========== 90-DAY SELF-PICKUP METRICS (For Star Retailer) ==========
    pickup_90d_pipeline = [
        {
            "$match": {
                "delivery_method": "store_pickup",
                "pickup_store.id": {"$exists": True},
                "order_status": "delivered",
                "created_at": {"$gte": ninety_days_ago.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$pickup_store.id",
                "pickups_90d": {"$sum": 1},
                "items_90d": {"$sum": {"$size": {"$ifNull": ["$items", []]}}},
                "revenue_90d": {"$sum": "$total"}
            }
        },
        {"$sort": {"items_90d": -1}}
    ]
    
    pickup_90d_by_retailer = await db.orders.aggregate(pickup_90d_pipeline).to_list(100)
    pickup_90d_map = {p['_id']: p for p in pickup_90d_by_retailer}
    
    # ========== BUILD COMBINED RETAILER ACTIVITY DATA ==========
    activity_data = []
    
    for retailer in retailers:
        retailer_id = retailer['retailer_id']
        
        # Find abandoned cart data for this retailer
        abandoned_data = next((a for a in abandoned_by_retailer if a['_id'] == retailer_id), None)
        
        # Find pickup performance data
        pickup_data = next((p for p in pickup_by_retailer if p['_id'] == retailer_id), None)
        
        # Find 90-day pickup data
        pickup_90d_data = pickup_90d_map.get(retailer_id, {})
        
        # Calculate Star Retailer eligibility (50+ items in 90 days)
        items_90d = pickup_90d_data.get('items_90d', 0)
        star_eligible = items_90d >= 50
        
        # Performance score for ranking
        pickup_score = (pickup_data.get('completed_pickups', 0) if pickup_data else 0) * 2
        abandoned_penalty = (abandoned_data.get('abandoned_count', 0) if abandoned_data else 0) * 0.5
        performance_score = max(0, pickup_score - abandoned_penalty + items_90d)
        
        activity_data.append({
            "retailer_id": retailer_id,
            "business_name": retailer.get('business_name') or retailer.get('trade_name'),
            "city": retailer.get('city'),
            "state": retailer.get('state'),
            "status": retailer.get('status'),
            "is_verified": retailer.get('is_verified', False),
            "is_addrika_verified_partner": retailer.get('is_addrika_verified_partner', False),
            "retailer_label": retailer.get('retailer_label'),
            # Abandoned Carts
            "abandoned_carts_30d": abandoned_data.get('abandoned_count', 0) if abandoned_data else 0,
            "abandoned_value_30d": round(abandoned_data.get('total_value', 0), 2) if abandoned_data else 0,
            # Self-Pickup Performance (All Time)
            "total_pickups": pickup_data.get('total_pickups', 0) if pickup_data else 0,
            "completed_pickups": pickup_data.get('completed_pickups', 0) if pickup_data else 0,
            "pending_pickups": pickup_data.get('pending_pickups', 0) if pickup_data else 0,
            "total_items_picked": pickup_data.get('total_items', 0) if pickup_data else 0,
            "pickup_revenue": round(pickup_data.get('total_revenue', 0), 2) if pickup_data else 0,
            # 90-Day Metrics (For Star Retailer)
            "pickups_90d": pickup_90d_data.get('pickups_90d', 0),
            "items_90d": items_90d,
            "revenue_90d": round(pickup_90d_data.get('revenue_90d', 0), 2),
            # Star Retailer
            "star_eligible": star_eligible,
            "performance_score": round(performance_score, 1)
        })
    
    # Sort by performance score
    activity_data.sort(key=lambda x: x['performance_score'], reverse=True)
    
    # Add ranks
    for idx, item in enumerate(activity_data):
        item['rank'] = idx + 1
    
    # ========== AGGREGATE STATS ==========
    total_abandoned_30d = sum(a.get('abandoned_count', 0) for a in abandoned_by_retailer)
    total_abandoned_value_30d = sum(a.get('total_value', 0) for a in abandoned_by_retailer)
    total_pickups_completed = sum(p.get('completed_pickups', 0) for p in pickup_by_retailer)
    total_pickups_pending = sum(p.get('pending_pickups', 0) for p in pickup_by_retailer)
    star_eligible_count = len([a for a in activity_data if a['star_eligible']])
    
    return {
        "retailers": activity_data,
        "summary": {
            "total_retailers": len(retailers),
            "active_retailers": len([r for r in retailers if r.get('status') == 'active']),
            "star_eligible_retailers": star_eligible_count,
            "abandoned_carts_30d": total_abandoned_30d,
            "abandoned_value_30d": round(total_abandoned_value_30d, 2),
            "total_pickups_completed": total_pickups_completed,
            "total_pickups_pending": total_pickups_pending
        },
        "star_retailer_criteria": {
            "min_items_90d": 50,
            "description": "Retailers who have fulfilled 50+ items via self-pickup in the last 90 days"
        },
        "period": {
            "abandoned_carts": "Last 30 days",
            "star_eligibility": "Last 90 days"
        }
    }


@router.get("/retailers/{retailer_id}/activity")
async def admin_get_retailer_activity_detail(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Admin view: Detailed activity for a specific retailer
    - Recent abandoned carts
    - Self-pickup order history
    - Performance trends
    """
    await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one(
        {"retailer_id": retailer_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    ninety_days_ago = now - timedelta(days=90)
    
    # Recent abandoned carts for this retailer
    abandoned_carts = await db.carts.find(
        {
            "pickup_store.id": retailer_id,
            "status": {"$in": ["abandoned", "expired"]}
        },
        {"_id": 0}
    ).sort("updated_at", -1).limit(20).to_list(20)
    
    # Self-pickup orders for this retailer
    pickup_orders = await db.orders.find(
        {
            "delivery_method": "store_pickup",
            "pickup_store.id": retailer_id
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Calculate monthly trends (last 6 months)
    monthly_trends = []
    for i in range(6):
        month_start = now.replace(day=1) - timedelta(days=30*i)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        
        pickups_in_month = await db.orders.count_documents({
            "delivery_method": "store_pickup",
            "pickup_store.id": retailer_id,
            "order_status": "delivered",
            "created_at": {
                "$gte": month_start.isoformat(),
                "$lt": month_end.isoformat()
            }
        })
        
        abandoned_in_month = await db.carts.count_documents({
            "pickup_store.id": retailer_id,
            "status": {"$in": ["abandoned", "expired"]},
            "updated_at": {
                "$gte": month_start.isoformat(),
                "$lt": month_end.isoformat()
            }
        })
        
        monthly_trends.append({
            "month": month_start.strftime("%b %Y"),
            "pickups_completed": pickups_in_month,
            "abandoned_carts": abandoned_in_month
        })
    
    monthly_trends.reverse()  # Oldest to newest
    
    # 90-day performance stats
    pickups_90d = await db.orders.count_documents({
        "delivery_method": "store_pickup",
        "pickup_store.id": retailer_id,
        "order_status": "delivered",
        "created_at": {"$gte": ninety_days_ago.isoformat()}
    })
    
    items_90d_pipeline = [
        {
            "$match": {
                "delivery_method": "store_pickup",
                "pickup_store.id": retailer_id,
                "order_status": "delivered",
                "created_at": {"$gte": ninety_days_ago.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_items": {"$sum": {"$size": {"$ifNull": ["$items", []]}}},
                "total_revenue": {"$sum": "$total"}
            }
        }
    ]
    
    items_90d_result = await db.orders.aggregate(items_90d_pipeline).to_list(1)
    items_90d = items_90d_result[0].get('total_items', 0) if items_90d_result else 0
    revenue_90d = items_90d_result[0].get('total_revenue', 0) if items_90d_result else 0
    
    return {
        "retailer": {
            "retailer_id": retailer.get('retailer_id'),
            "business_name": retailer.get('business_name') or retailer.get('trade_name'),
            "city": retailer.get('city'),
            "state": retailer.get('state'),
            "email": retailer.get('email'),
            "phone": retailer.get('phone'),
            "status": retailer.get('status'),
            "is_verified": retailer.get('is_verified'),
            "is_addrika_verified_partner": retailer.get('is_addrika_verified_partner'),
            "retailer_label": retailer.get('retailer_label'),
            "label_period": retailer.get('label_period')
        },
        "performance_90d": {
            "pickups_completed": pickups_90d,
            "items_fulfilled": items_90d,
            "revenue": round(revenue_90d, 2),
            "star_eligible": items_90d >= 50
        },
        "abandoned_carts": {
            "recent": abandoned_carts,
            "total_30d": len([c for c in abandoned_carts if c.get('updated_at', '') >= thirty_days_ago.isoformat()])
        },
        "pickup_orders": {
            "recent": pickup_orders[:20],
            "total": len(pickup_orders)
        },
        "monthly_trends": monthly_trends
    }


@router.get("/retailers/abandoned-carts")
async def admin_get_abandoned_carts_by_retailer(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    retailer_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """
    Admin view: All abandoned carts, optionally filtered by retailer
    """
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    
    query = {
        "pickup_store.id": {"$exists": True, "$ne": None},
        "status": {"$in": ["abandoned", "expired"]}
    }
    
    if retailer_id:
        query["pickup_store.id"] = retailer_id
    
    carts = await db.carts.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.carts.count_documents(query)
    
    # Summary stats
    total_value_pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total_value": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    
    summary_result = await db.carts.aggregate(total_value_pipeline).to_list(1)
    total_value = summary_result[0].get('total_value', 0) if summary_result else 0
    
    return {
        "carts": carts,
        "summary": {
            "total_abandoned": total,
            "total_value": round(total_value, 2)
        },
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.get("/retailers/self-pickup-report")
async def admin_get_self_pickup_report(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "quarter"  # month, quarter, year, all
):
    """
    Admin view: Self-pickup performance report for Star Retailer grading
    """
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    
    # Determine date filter
    if period == "month":
        start_date = now - timedelta(days=30)
        period_label = "This Month"
    elif period == "quarter":
        start_date = now - timedelta(days=90)
        period_label = "This Quarter (90 days)"
    elif period == "year":
        start_date = now - timedelta(days=365)
        period_label = "This Year"
    else:
        start_date = None
        period_label = "All Time"
    
    # Build match query
    match_query = {
        "delivery_method": "store_pickup",
        "pickup_store.id": {"$exists": True},
        "order_status": "delivered"
    }
    
    if start_date:
        match_query["created_at"] = {"$gte": start_date.isoformat()}
    
    # Aggregate self-pickup stats by retailer
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$pickup_store.id",
                "pickup_count": {"$sum": 1},
                "total_items": {"$sum": {"$size": {"$ifNull": ["$items", []]}}},
                "total_revenue": {"$sum": "$total"},
                "unique_customers": {"$addToSet": "$user_id"}
            }
        },
        {
            "$addFields": {
                "unique_customer_count": {"$size": "$unique_customers"}
            }
        },
        {"$sort": {"total_items": -1}}
    ]
    
    pickup_stats = await db.orders.aggregate(pipeline).to_list(500)
    
    # Get retailer details
    retailers = await db.retailers.find(
        {"status": {"$in": ["active", "pending_verification"]}},
        {"_id": 0, "retailer_id": 1, "business_name": 1, "trade_name": 1, "city": 1, "state": 1, 
         "is_verified": 1, "is_addrika_verified_partner": 1, "retailer_label": 1, "label_period": 1}
    ).to_list(500)
    
    retailer_map = {r['retailer_id']: r for r in retailers}
    
    # Build report data
    report_data = []
    for idx, stat in enumerate(pickup_stats):
        retailer_id = stat['_id']
        retailer = retailer_map.get(retailer_id, {})
        
        star_eligible = stat['total_items'] >= 50
        
        report_data.append({
            "rank": idx + 1,
            "retailer_id": retailer_id,
            "business_name": retailer.get('business_name') or retailer.get('trade_name') or 'Unknown',
            "city": retailer.get('city'),
            "state": retailer.get('state'),
            "is_verified": retailer.get('is_verified', False),
            "is_addrika_verified_partner": retailer.get('is_addrika_verified_partner', False),
            "current_label": retailer.get('retailer_label'),
            "label_period": retailer.get('label_period'),
            "pickup_count": stat['pickup_count'],
            "total_items": stat['total_items'],
            "total_revenue": round(stat['total_revenue'], 2),
            "unique_customers": stat['unique_customer_count'],
            "star_eligible": star_eligible
        })
    
    # Summary
    total_pickups = sum(r['pickup_count'] for r in report_data)
    total_items = sum(r['total_items'] for r in report_data)
    total_revenue = sum(r['total_revenue'] for r in report_data)
    star_eligible_count = len([r for r in report_data if r['star_eligible']])
    
    return {
        "period": period,
        "period_label": period_label,
        "report": report_data,
        "summary": {
            "total_retailers_with_pickups": len(report_data),
            "total_pickups": total_pickups,
            "total_items_fulfilled": total_items,
            "total_revenue": round(total_revenue, 2),
            "star_eligible_retailers": star_eligible_count
        },
        "star_retailer_criteria": {
            "min_items": 50,
            "description": f"Retailers who have fulfilled 50+ items via self-pickup in {period_label.lower()}"
        }
    }

