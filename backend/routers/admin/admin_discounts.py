"""Admin discount code management routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import secrets
import string
import uuid

from models.ecommerce import DiscountCodeCreate
from dependencies import db, require_admin

router = APIRouter(tags=["Admin Discounts"])


def generate_discount_code(length: int = 8) -> str:
    """Generate a random discount code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.get("/discount-codes")
async def list_discount_codes(request: Request, session_token: Optional[str] = Cookie(None)):
    """List all discount codes"""
    await require_admin(request, session_token)
    
    codes = await db.discount_codes.find({}).to_list(100)
    
    # Normalize field names for frontend
    normalized_codes = []
    for code in codes:
        normalized = {
            "_id": str(code["_id"]),
            "code": code.get("code"),
            "discount_type": code.get("discount_type") or code.get("discountType") or "percentage",
            "discount_value": code.get("discount_value") or code.get("discountValue") or 0,
            "usage_type": code.get("usage_type") or code.get("usageType") or "universal",
            "min_order_value": code.get("min_order_value") or code.get("minOrderValue") or 0,
            "max_uses": code.get("max_uses") or code.get("maxUses"),
            "max_discount": code.get("max_discount") or code.get("maxDiscount"),
            "times_used": code.get("times_used") or code.get("timesUsed") or 0,
            "is_active": code.get("is_active") if code.get("is_active") is not None else code.get("isActive", True),
            "expires_at": code.get("expires_at") or code.get("expiresAt"),
            "description": code.get("description"),
            "created_at": code.get("created_at") or code.get("createdAt")
        }
        normalized_codes.append(normalized)
    
    return {"codes": normalized_codes}


@router.post("/discount-codes")
async def admin_create_discount_code(code_data: DiscountCodeCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    """Create a new discount code"""
    await require_admin(request, session_token)
    
    # Check if code already exists
    existing = await db.discount_codes.find_one({"code": code_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    code = {
        "code": code_data.code.upper(),
        "discount_type": code_data.discountType,
        "discount_value": code_data.discountValue,
        "min_order_value": code_data.minOrderValue,
        "max_discount": code_data.maxDiscount,
        "max_uses": code_data.maxUses,
        "usage_type": code_data.usageType,
        "times_used": 0,
        "is_active": True,
        "expires_at": code_data.expiresAt.isoformat() if code_data.expiresAt else None,
        "description": code_data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.discount_codes.insert_one(code)
    code["_id"] = str(result.inserted_id)
    
    return {"message": "Discount code created", "code": code}


@router.post("/discount-codes/generate")
async def generate_new_discount_code(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    discount_type: str = "percentage",
    discount_value: float = 10,
    min_order_value: float = 0,
    max_discount: Optional[float] = None,
    max_uses: Optional[int] = None,
    usage_type: str = "universal",
    description: str = ""
):
    """Generate a new random discount code"""
    await require_admin(request, session_token)
    
    # Generate unique code
    code_str = generate_discount_code()
    while await db.discount_codes.find_one({"code": code_str}):
        code_str = generate_discount_code()
    
    code = {
        "code": code_str,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "min_order_value": min_order_value,
        "max_discount": max_discount,
        "max_uses": max_uses,
        "usage_type": usage_type,
        "times_used": 0,
        "is_active": True,
        "expires_at": None,
        "description": description or f"{discount_value}% discount code",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.discount_codes.insert_one(code)
    code["_id"] = str(result.inserted_id)
    
    return {"message": "Discount code generated", "code": code}


@router.delete("/discount-codes/{code_id}")
async def delete_discount_code(code_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """Delete a discount code"""
    await require_admin(request, session_token)
    
    from bson import ObjectId
    
    # Try to find by _id first, then by code
    try:
        result = await db.discount_codes.delete_one({"_id": ObjectId(code_id)})
    except:
        result = await db.discount_codes.delete_one({"code": code_id.upper()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    return {"message": "Discount code deleted"}


@router.put("/discount-codes/{code_id}")
async def update_discount_code(code_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """Update/Edit a discount code - creates new version for tracking"""
    await require_admin(request, session_token)
    
    from bson import ObjectId
    
    body = await request.json()
    
    # Find existing code
    try:
        existing = await db.discount_codes.find_one({"_id": ObjectId(code_id)})
    except:
        existing = await db.discount_codes.find_one({"code": code_id.upper()})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    # Check if significant changes are made (affecting discount calculation)
    significant_change = False
    old_values = {}
    
    # Map camelCase to snake_case for checking
    field_to_camel = {
        'discount_type': 'discountType',
        'discount_value': 'discountValue', 
        'min_order_value': 'minOrderValue',
        'max_discount': 'maxDiscount'
    }
    
    for db_field, camel_field in field_to_camel.items():
        old_val = existing.get(db_field)
        # Check both camelCase and snake_case in body
        new_val = body.get(camel_field)
        if new_val is None:
            new_val = body.get(db_field)
        
        if new_val is not None and old_val != new_val:
            significant_change = True
            old_values[db_field] = old_val
    
    # If significant changes, archive old usage stats with version
    if significant_change and existing.get('times_used', 0) > 0:
        version_id = str(uuid.uuid4())[:8]
        
        # Archive the old version's usage statistics
        archive_entry = {
            "code": existing.get("code"),
            "version_id": version_id,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "previous_settings": {
                "discount_type": existing.get("discount_type"),
                "discount_value": existing.get("discount_value"),
                "min_order_value": existing.get("min_order_value"),
                "max_discount": existing.get("max_discount"),
            },
            "usage_stats": {
                "times_used": existing.get("times_used", 0),
            },
            "reason": "Code settings modified"
        }
        await db.discount_code_archives.insert_one(archive_entry)
        
        # Update usage logs to mark them as belonging to old version
        await db.discount_code_usage.update_many(
            {"code": existing.get("code"), "version_id": {"$exists": False}},
            {"$set": {"version_id": version_id, "version_archived": True}}
        )
    
    # Prepare update data
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Map incoming fields to database fields
    field_mapping = {
        "discountType": "discount_type",
        "discountValue": "discount_value", 
        "minOrderValue": "min_order_value",
        "maxDiscount": "max_discount",
        "maxUses": "max_uses",
        "usageType": "usage_type",
        "expiresAt": "expires_at",
        "description": "description",
        "isActive": "is_active"
    }
    
    for input_field, db_field in field_mapping.items():
        if input_field in body:
            update_data[db_field] = body[input_field]
    
    # Also accept snake_case directly
    for field in ['discount_type', 'discount_value', 'min_order_value', 'max_discount', 'max_uses', 'usage_type', 'expires_at', 'description', 'is_active']:
        if field in body:
            update_data[field] = body[field]
    
    # Reset times_used if significant change
    if significant_change:
        update_data["times_used"] = 0
        update_data["version_started_at"] = datetime.now(timezone.utc).isoformat()
    
    # Perform update
    try:
        result = await db.discount_codes.update_one(
            {"_id": ObjectId(code_id)},
            {"$set": update_data}
        )
    except:
        result = await db.discount_codes.update_one(
            {"code": code_id.upper()},
            {"$set": update_data}
        )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    # Fetch updated code
    try:
        updated = await db.discount_codes.find_one({"_id": ObjectId(code_id)})
    except:
        updated = await db.discount_codes.find_one({"code": code_id.upper()})
    
    if updated:
        updated["_id"] = str(updated["_id"])
    
    return {
        "message": "Discount code updated" + (" (usage stats archived)" if significant_change else ""),
        "code": updated,
        "stats_archived": significant_change
    }


@router.patch("/discount-codes/{code_id}/toggle")
async def toggle_discount_code(code_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """Toggle discount code active/blocked status"""
    await require_admin(request, session_token)
    
    from bson import ObjectId
    
    # Find existing code
    try:
        existing = await db.discount_codes.find_one({"_id": ObjectId(code_id)})
    except:
        existing = await db.discount_codes.find_one({"code": code_id.upper()})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    # Toggle status
    new_status = not existing.get("is_active", True)
    
    try:
        await db.discount_codes.update_one(
            {"_id": ObjectId(code_id)},
            {"$set": {
                "is_active": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "blocked_at": datetime.now(timezone.utc).isoformat() if not new_status else None
            }}
        )
    except:
        await db.discount_codes.update_one(
            {"code": code_id.upper()},
            {"$set": {
                "is_active": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "blocked_at": datetime.now(timezone.utc).isoformat() if not new_status else None
            }}
        )
    
    return {
        "message": f"Discount code {'activated' if new_status else 'blocked'}",
        "code": existing.get("code"),
        "is_active": new_status
    }


@router.get("/discount-code-archives")
async def get_discount_code_archives(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    code: Optional[str] = None
):
    """Get archived discount code versions and their usage stats"""
    await require_admin(request, session_token)
    
    query = {}
    if code:
        query["code"] = code.upper()
    
    archives = await db.discount_code_archives.find(query).sort("archived_at", -1).to_list(100)
    
    for archive in archives:
        archive["_id"] = str(archive["_id"])
    
    return {"archives": archives}


@router.get("/discount-code-usage")
async def get_discount_code_usage(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    skip: int = 0,
    limit: int = 50,
    code: Optional[str] = None
):
    """Get discount code usage logs"""
    await require_admin(request, session_token)
    
    query = {}
    if code:
        query["code"] = code.upper()
    
    usage_logs = await db.discount_code_usage.find(query).sort("used_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Clean up MongoDB _id
    for log in usage_logs:
        log["_id"] = str(log["_id"])
    
    total = await db.discount_code_usage.count_documents(query)
    
    # Get summary stats
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {
            "_id": None,
            "total_discount_amount": {"$sum": "$discount_amount"},
            "total_uses": {"$sum": 1},
            "unique_users": {"$addToSet": "$email"}
        }}
    ]
    stats_result = await db.discount_code_usage.aggregate(pipeline).to_list(1)
    
    stats = {
        "total_discount_amount": round(stats_result[0]["total_discount_amount"], 2) if stats_result else 0,
        "total_uses": stats_result[0]["total_uses"] if stats_result else 0,
        "unique_users": len(stats_result[0]["unique_users"]) if stats_result else 0
    }
    
    return {"usage_logs": usage_logs, "total": total, "stats": stats}


@router.get("/discount-code-performance")
async def get_discount_code_performance(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get discount code performance report - which codes drive the most sales"""
    await require_admin(request, session_token)
    
    # Aggregate performance by discount code
    pipeline = [
        {"$group": {
            "_id": "$code",
            "total_uses": {"$sum": 1},
            "total_discount_given": {"$sum": "$discount_amount"},
            "total_cart_value": {"$sum": "$cart_total"},
            "unique_customers": {"$addToSet": "$email"},
            "avg_cart_value": {"$avg": "$cart_total"},
            "avg_discount": {"$avg": "$discount_amount"},
            "first_used": {"$min": "$used_at"},
            "last_used": {"$max": "$used_at"}
        }},
        {"$project": {
            "_id": 0,
            "code": "$_id",
            "total_uses": 1,
            "total_discount_given": {"$round": ["$total_discount_given", 2]},
            "total_cart_value": {"$round": ["$total_cart_value", 2]},
            "unique_customers": {"$size": "$unique_customers"},
            "avg_cart_value": {"$round": ["$avg_cart_value", 2]},
            "avg_discount": {"$round": ["$avg_discount", 2]},
            "first_used": 1,
            "last_used": 1,
            # Revenue after discount (cart value - discount)
            "net_revenue": {"$round": [{"$subtract": ["$total_cart_value", "$total_discount_given"]}, 2]}
        }},
        {"$sort": {"total_uses": -1}}
    ]
    
    performance = await db.discount_code_usage.aggregate(pipeline).to_list(100)
    
    # Get discount code details for each code
    for item in performance:
        code_doc = await db.discount_codes.find_one({"code": item["code"]})
        if code_doc:
            item["discount_type"] = code_doc.get("discount_type", "percentage")
            item["discount_value"] = code_doc.get("discount_value", 0)
            item["usage_type"] = code_doc.get("usage_type", "universal")
            item["is_active"] = code_doc.get("is_active", False)
        
        # Calculate effectiveness: how much revenue per discount rupee
        if item["total_discount_given"] > 0:
            item["roi"] = round(item["net_revenue"] / item["total_discount_given"], 2)
        else:
            item["roi"] = 0
    
    # Overall summary
    summary_pipeline = [
        {"$group": {
            "_id": None,
            "total_codes_used": {"$addToSet": "$code"},
            "total_orders_with_discount": {"$sum": 1},
            "total_discount_given": {"$sum": "$discount_amount"},
            "total_cart_value": {"$sum": "$cart_total"},
            "all_customers": {"$addToSet": "$email"}
        }}
    ]
    summary_result = await db.discount_code_usage.aggregate(summary_pipeline).to_list(1)
    
    summary = {
        "total_codes_used": len(summary_result[0]["total_codes_used"]) if summary_result else 0,
        "total_orders_with_discount": summary_result[0]["total_orders_with_discount"] if summary_result else 0,
        "total_discount_given": round(summary_result[0]["total_discount_given"], 2) if summary_result else 0,
        "total_cart_value": round(summary_result[0]["total_cart_value"], 2) if summary_result else 0,
        "total_customers": len(summary_result[0]["all_customers"]) if summary_result else 0,
        "net_revenue": round(summary_result[0]["total_cart_value"] - summary_result[0]["total_discount_given"], 2) if summary_result else 0
    }
    
    # Calculate average discount percentage
    if summary["total_cart_value"] > 0:
        summary["avg_discount_percentage"] = round((summary["total_discount_given"] / summary["total_cart_value"]) * 100, 1)
    else:
        summary["avg_discount_percentage"] = 0
    
    return {"performance": performance, "summary": summary}


@router.delete("/discount-codes/purge/all")
async def purge_all_discount_codes(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    DANGER: Delete ALL discount codes from the database (admin only).
    Requires confirmation in the request body.
    """
    await require_admin(request, session_token)
    
    try:
        body = await request.json()
        confirm = body.get('confirm')
    except:
        confirm = None
    
    if confirm != 'PURGE_ALL_DISCOUNTS':
        raise HTTPException(
            status_code=400, 
            detail="Please send {\"confirm\": \"PURGE_ALL_DISCOUNTS\"} to confirm this action"
        )
    
    # Delete all discount codes
    result = await db.discount_codes.delete_many({})
    
    # Also delete all discount code archives
    archives_result = await db.discount_code_archives.delete_many({})
    
    return {
        "message": "All discount codes purged successfully",
        "deleted_codes": result.deleted_count,
        "deleted_archives": archives_result.deleted_count
    }


@router.delete("/discount-code-usage/purge/all")
async def purge_all_coupon_usage(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    DANGER: Delete ALL coupon usage logs from the database (admin only).
    Requires confirmation in the request body.
    """
    await require_admin(request, session_token)
    
    try:
        body = await request.json()
        confirm = body.get('confirm')
    except:
        confirm = None
    
    if confirm != 'PURGE_ALL_USAGE':
        raise HTTPException(
            status_code=400, 
            detail="Please send {\"confirm\": \"PURGE_ALL_USAGE\"} to confirm this action"
        )
    
    # Delete all coupon usage logs
    result = await db.discount_code_usage.delete_many({})
    
    # Also reset times_used counter on all discount codes
    await db.discount_codes.update_many(
        {},
        {"$set": {"times_used": 0}}
    )
    
    return {
        "message": "All coupon usage data purged successfully",
        "deleted_usage_logs": result.deleted_count,
        "all_codes_usage_reset": True
    }
