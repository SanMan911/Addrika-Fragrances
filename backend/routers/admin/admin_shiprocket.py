"""Admin ShipRocket integration routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import os
import logging

from dependencies import db, require_admin

router = APIRouter(tags=["Admin ShipRocket"])
logger = logging.getLogger(__name__)


@router.post("/orders/{order_number}/sync-shiprocket")
async def sync_order_to_shiprocket(order_number: str, request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Manually sync an order to ShipRocket.
    Useful for orders that failed automatic sync or restored orders.
    """
    await require_admin(request, session_token)
    
    from routers.orders import push_order_to_shiprocket
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already synced
    if order.get("shiprocket_order_id"):
        return {
            "message": "Order already synced to ShipRocket",
            "order_number": order_number,
            "shiprocket_order_id": order.get("shiprocket_order_id"),
            "shiprocket_shipment_id": order.get("shiprocket_shipment_id"),
            "shiprocket_awb_code": order.get("shiprocket_awb_code")
        }
    
    # Check if order is paid
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Only paid orders can be synced to ShipRocket")
    
    # Push to ShipRocket
    result = await push_order_to_shiprocket(order)
    
    if result.get("success"):
        # Update order with ShipRocket IDs
        await db.orders.update_one(
            {"order_number": order_number},
            {
                "$set": {
                    "shiprocket_order_id": result.get("order_id"),
                    "shiprocket_shipment_id": result.get("shipment_id"),
                    "shiprocket_awb_code": result.get("awb_code"),
                    "shiprocket_courier": result.get("courier_name"),
                    "shiprocket_synced_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "message": "Order synced to ShipRocket successfully",
            "order_number": order_number,
            "shiprocket_order_id": result.get("order_id"),
            "shiprocket_shipment_id": result.get("shipment_id"),
            "shiprocket_awb_code": result.get("awb_code"),
            "shiprocket_courier": result.get("courier_name")
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to sync to ShipRocket: {result.get('error', 'Unknown error')}"
        )


@router.get("/shiprocket/status")
async def get_shiprocket_status(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Check ShipRocket integration status and connection.
    """
    await require_admin(request, session_token)
    
    from services.shiprocket_service import get_shiprocket_token
    
    # Check if credentials are configured
    shiprocket_email = os.environ.get('SHIPROCKET_EMAIL')
    shiprocket_password = os.environ.get('SHIPROCKET_PASSWORD')
    
    if not shiprocket_email or not shiprocket_password:
        return {
            "configured": False,
            "connected": False,
            "message": "ShipRocket credentials not configured"
        }
    
    # Try to get token to verify connection
    try:
        token = await get_shiprocket_token()
        if token:
            # Count orders synced to ShipRocket
            synced_count = await db.orders.count_documents({"shiprocket_order_id": {"$exists": True, "$ne": None}})
            pending_count = await db.orders.count_documents({
                "payment_status": "paid",
                "shiprocket_order_id": {"$exists": False}
            })
            
            return {
                "configured": True,
                "connected": True,
                "email": shiprocket_email,
                "message": "ShipRocket connection active",
                "stats": {
                    "orders_synced": synced_count,
                    "orders_pending_sync": pending_count
                }
            }
        else:
            return {
                "configured": True,
                "connected": False,
                "message": "Failed to connect to ShipRocket - check credentials"
            }
    except Exception as e:
        logger.error(f"ShipRocket status check failed: {str(e)}")
        return {
            "configured": True,
            "connected": False,
            "message": f"Connection error: {str(e)}"
        }


@router.get("/shiprocket/track/{order_number}")
async def track_shiprocket_order(
    order_number: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Get real-time tracking information from ShipRocket for an order.
    Useful to cross-check/verify synced order status.
    """
    await require_admin(request, session_token)
    
    from services.shiprocket_service import track_shipment
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if synced to ShipRocket
    shiprocket_order_id = order.get("shiprocket_order_id")
    awb_code = order.get("shiprocket_awb_code")
    
    if not shiprocket_order_id:
        return {
            "success": False,
            "message": "Order not synced to ShipRocket",
            "order_number": order_number,
            "shiprocket_synced": False
        }
    
    if not awb_code:
        return {
            "success": True,
            "message": "Order synced but no AWB assigned yet (pickup may not be complete)",
            "order_number": order_number,
            "shiprocket_order_id": shiprocket_order_id,
            "shiprocket_synced": True,
            "tracking_available": False
        }
    
    # Get tracking info
    try:
        tracking = await track_shipment(awb_code)
        if tracking.get("success"):
            return {
                "success": True,
                "order_number": order_number,
                "shiprocket_order_id": shiprocket_order_id,
                "awb_code": awb_code,
                "shiprocket_synced": True,
                "tracking_available": True,
                "tracking": {
                    "current_status": tracking.get("current_status"),
                    "etd": tracking.get("etd"),
                    "track_url": tracking.get("track_url"),
                    "courier": order.get("shiprocket_courier"),
                    "activities": tracking.get("shipment_track_activities", [])[:10]  # Last 10 activities
                }
            }
        else:
            return {
                "success": True,
                "message": tracking.get("error", "Tracking info not available"),
                "order_number": order_number,
                "shiprocket_order_id": shiprocket_order_id,
                "awb_code": awb_code,
                "shiprocket_synced": True,
                "tracking_available": False
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error fetching tracking: {str(e)}",
            "order_number": order_number,
            "shiprocket_order_id": shiprocket_order_id,
            "awb_code": awb_code
        }


@router.post("/shiprocket/sync-pending")
async def sync_pending_orders_to_shiprocket(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Sync all pending paid orders to ShipRocket.
    Useful for batch syncing after a system issue.
    """
    await require_admin(request, session_token)
    
    from routers.orders import push_order_to_shiprocket
    
    # Find all paid orders not yet synced
    pending_orders = await db.orders.find({
        "payment_status": "paid",
        "shiprocket_order_id": {"$exists": False}
    }).to_list(100)  # Limit to 100 to prevent timeout
    
    results = {
        "total": len(pending_orders),
        "synced": 0,
        "failed": 0,
        "errors": []
    }
    
    for order in pending_orders:
        try:
            result = await push_order_to_shiprocket(order)
            
            if result.get("success"):
                await db.orders.update_one(
                    {"order_number": order.get("order_number")},
                    {
                        "$set": {
                            "shiprocket_order_id": result.get("order_id"),
                            "shiprocket_shipment_id": result.get("shipment_id"),
                            "shiprocket_awb_code": result.get("awb_code"),
                            "shiprocket_courier": result.get("courier_name"),
                            "shiprocket_synced_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                results["synced"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "order_number": order.get("order_number"),
                    "error": result.get("error")
                })
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "order_number": order.get("order_number"),
                "error": str(e)
            })
    
    return {
        "message": f"Batch sync completed: {results['synced']} synced, {results['failed']} failed",
        **results
    }


@router.get("/shipping-config")
async def get_shipping_config(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Get current shipping configuration including:
    - Free shipping thresholds
    - Premium options
    - RTO deduction percentage
    - Pickup locations
    """
    await require_admin(request, session_token)
    
    from services.shipping_config import (
        FREE_SHIPPING_THRESHOLDS,
        PREMIUM_OPTIONS,
        RTO_DEDUCTION_PERCENTAGE,
        get_all_pickup_locations
    )
    
    return {
        "free_shipping_thresholds": {
            "bhagalpur": FREE_SHIPPING_THRESHOLDS["bhagalpur"]["threshold"],
            "delhi_ncr": FREE_SHIPPING_THRESHOLDS["delhi_ncr"]["threshold"],
            "rest_of_india": FREE_SHIPPING_THRESHOLDS["default"]["threshold"]
        },
        "premium_options": {
            "priority_despatch": {
                "price": PREMIUM_OPTIONS["priority_despatch"]["price"],
                "description": PREMIUM_OPTIONS["priority_despatch"]["description"],
                "available_for": "Delhi-shipped orders only"
            },
            "same_day_delivery": {
                "price": PREMIUM_OPTIONS["same_day_delivery"]["price"],
                "description": PREMIUM_OPTIONS["same_day_delivery"]["description"],
                "cutoff_hour": PREMIUM_OPTIONS["same_day_delivery"]["cutoff_hour"],
                "available_for": "Delhi NCR delivery only"
            }
        },
        "rto_deduction_percentage": RTO_DEDUCTION_PERCENTAGE,
        "pickup_locations": get_all_pickup_locations()
    }


@router.put("/shipping-config/rto-percentage")
async def update_rto_percentage(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Update the RTO deduction percentage.
    This percentage is deducted from the order amount when generating RTO vouchers.
    Formula: Voucher = Order Amount - (RTO % of Order Amount) - Shipping Charges
    """
    await require_admin(request, session_token)
    
    body = await request.json()
    new_percentage = body.get("percentage")
    
    if new_percentage is None:
        raise HTTPException(status_code=400, detail="percentage is required")
    
    try:
        new_percentage = float(new_percentage)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="percentage must be a number")
    
    if new_percentage < 0 or new_percentage > 50:
        raise HTTPException(status_code=400, detail="percentage must be between 0 and 50")
    
    from services.shipping_config import update_rto_percentage
    
    # Get admin email from session
    admin_session = await db.admin_sessions.find_one({"session_token": session_token})
    admin_email = admin_session.get("email", "unknown") if admin_session else "unknown"
    
    result = await update_rto_percentage(db, new_percentage, admin_email)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to update"))
    
    return result


@router.post("/orders/{order_number}/override-pickup")
async def override_order_pickup_location(
    order_number: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Override the auto-selected pickup location for an order.
    Use this when you want to ship from a different warehouse than the auto-selected one.
    """
    await require_admin(request, session_token)
    
    body = await request.json()
    pickup_location_id = body.get("pickup_location_id")
    
    if not pickup_location_id:
        raise HTTPException(status_code=400, detail="pickup_location_id is required")
    
    from services.shipping_config import PICKUP_LOCATIONS
    
    # Validate pickup location
    valid_location = None
    for loc_key, loc_data in PICKUP_LOCATIONS.items():
        if loc_data["id"] == pickup_location_id:
            valid_location = loc_data
            break
    
    if not valid_location:
        raise HTTPException(status_code=400, detail="Invalid pickup location ID")
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order with override
    await db.orders.update_one(
        {"order_number": order_number},
        {
            "$set": {
                "pickup_location_override": {
                    "location_id": valid_location["id"],
                    "location_name": valid_location["name"],
                    "shiprocket_location": valid_location["shiprocket_location_name"],
                    "pincode": valid_location["pincode"],
                    "overridden_at": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Pickup location overridden to {valid_location['name']}",
        "order_number": order_number,
        "new_pickup_location": {
            "id": valid_location["id"],
            "name": valid_location["name"],
            "address": f"{valid_location['address']}, {valid_location['city']} - {valid_location['pincode']}"
        }
    }
