"""Admin order management routes"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from services.zoho_sheets_service import sync_delivered_order, is_zoho_authorized
from dependencies import db, require_admin

router = APIRouter(tags=["Admin Orders"])
logger = logging.getLogger(__name__)


@router.get("/orders/{order_number}/cart-snapshot")
async def get_order_cart_snapshot(
    order_number: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get detailed cart snapshot for an order - shows exact items and pricing at payment time"""
    await require_admin(request, session_token)
    
    order = await db.orders.find_one({"order_number": order_number})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # If cart_snapshot exists (new orders), return it
    cart_snapshot = order.get("cart_snapshot")
    
    if cart_snapshot:
        return {
            "order_number": order_number,
            "cart_snapshot": cart_snapshot,
            "snapshot_available": True
        }
    
    # For older orders without cart_snapshot, reconstruct from existing data
    items = order.get("items", [])
    pricing = order.get("pricing", {})
    
    reconstructed_snapshot = {
        "captured_at": order.get("paid_at") or order.get("created_at"),
        "items_detail": [
            {
                "product_id": item.get("productId"),
                "product_name": item.get("name"),
                "size": item.get("size"),
                "quantity": item.get("quantity"),
                "unit_price": item.get("price"),
                "unit_mrp": item.get("mrp"),
                "line_total": item.get("price", 0) * item.get("quantity", 1),
                "hsn": item.get("hsn", "33074100")
            }
            for item in items
        ],
        "pricing_breakdown": {
            "mrp_total": pricing.get("mrp_total", 0),
            "subtotal": pricing.get("subtotal", 0),
            "bulk_discount": pricing.get("bulk_discount", 0),
            "coupon_discount": pricing.get("coupon_discount", 0),
            "coupon_code": pricing.get("coupon_code"),
            "shipping_charge": pricing.get("shipping", 0),
            "final_total": pricing.get("final_total", 0)
        },
        "payment_info": {
            "method": order.get("payment_method"),
            "mode": order.get("payment_mode"),
            "amount_charged": order.get("amount_charged", 0),
            "balance_at_store": order.get("balance_at_store", 0)
        },
        "note": "Reconstructed from order data (no original snapshot)"
    }
    
    return {
        "order_number": order_number,
        "cart_snapshot": reconstructed_snapshot,
        "snapshot_available": False
    }


@router.get("/orders")
async def admin_get_orders(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None
):
    """Get all orders for admin"""
    await require_admin(request, session_token)
    
    query = {}
    if status:
        query["order_status"] = status
    
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Normalize orders for frontend
    normalized_orders = []
    for order in orders:
        pricing = order.get("pricing", {})
        normalized_orders.append({
            "_id": str(order["_id"]),
            "id": str(order["_id"]),
            "orderNumber": order.get("order_number"),
            "order_number": order.get("order_number"),
            "items": order.get("items", []),
            "shipping": order.get("shipping", {}),
            "billing": order.get("billing", {}),
            "pricing": pricing,
            "total": pricing.get("final_total", 0),
            "subtotal": pricing.get("subtotal", 0),
            "bulkDiscount": pricing.get("bulk_discount", 0),
            "couponDiscount": pricing.get("coupon_discount", 0),
            "shippingCharge": pricing.get("shipping", 0),
            "discountCode": order.get("discount_code"),
            "paymentMethod": order.get("payment_method", "razorpay"),
            "paymentStatus": order.get("payment_status", "pending"),
            "payment_status": order.get("payment_status", "pending"),
            "paymentMode": order.get("payment_mode", "Online"),
            "orderStatus": order.get("order_status", "pending"),
            "order_status": order.get("order_status", "pending"),
            "shippingDetails": order.get("shipping_details"),  # Carrier & tracking
            "gstInfo": order.get("gst_info"),
            "createdAt": order.get("created_at"),
            "created_at": order.get("created_at"),
            "updatedAt": order.get("updated_at"),
            "updated_at": order.get("updated_at"),
            "paidAt": order.get("paid_at"),
            "razorpayPaymentId": order.get("razorpay_payment_id"),
            # ShipRocket sync status
            "shiprocket_order_id": order.get("shiprocket_order_id"),
            "shiprocket_shipment_id": order.get("shiprocket_shipment_id"),
            "shiprocket_awb_code": order.get("shiprocket_awb_code"),
            "shiprocket_courier": order.get("shiprocket_courier"),
            "shiprocket_synced_at": order.get("shiprocket_synced_at"),
            # RTO voucher data
            "rto_voucher_code": order.get("rto_voucher_code"),
            "rto_voucher_value": order.get("rto_voucher_value"),
            "rto_voucher_generated": order.get("rto_voucher_generated", False),
            "rto_voucher_pending": order.get("rto_voucher_pending", False)
        })
    
    total = await db.orders.count_documents(query)
    
    return {"orders": normalized_orders, "total": total}


@router.patch("/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str,
    status: str,
    background_tasks: BackgroundTasks,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    carrier_name: Optional[str] = None,
    tracking_number: Optional[str] = None
):
    """Update order status with optional shipping details for 'shipped' status"""
    await require_admin(request, session_token)
    
    # Standard statuses + self-pickup specific statuses
    valid_statuses = [
        "pending", "confirmed", "processing", "shipped", "delivered", "rto", "cancelled",
        # Self-pickup statuses
        "pending_pickup", "ready_for_pickup", "collected",
        # Manual delivery status
        "handed_over"
    ]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Find order by order_number
    order = await db.orders.find_one({"order_number": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Build update data
    update_data = {
        "order_status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add collected timestamp for self-pickup orders
    if status == "collected":
        update_data["collected_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add ready for pickup timestamp
    if status == "ready_for_pickup":
        update_data["ready_for_pickup_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add delivered timestamp
    if status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add handed over timestamp
    if status == "handed_over":
        update_data["handed_over_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add shipping details if status is 'shipped' and carrier info provided
    if status == "shipped" and (carrier_name or tracking_number):
        update_data["shipping_details"] = {
            "carrier_name": carrier_name,
            "tracking_number": tracking_number,
            "shipped_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Handle RTO - DO NOT auto-generate voucher, mark as pending for admin to generate
    if status == "rto":
        update_data["rto_voucher_pending"] = True
        update_data["rto_voucher_generated"] = False
    
    # Auto-void RTO voucher if order is delivered or handed over
    voided_voucher = None
    if status in ["delivered", "handed_over"]:
        from .admin_rto_vouchers import auto_void_rto_voucher_on_delivery
        voided_voucher = await auto_void_rto_voucher_on_delivery(order_id, status)
    
    # Update status
    await db.orders.update_one(
        {"order_number": order_id},
        {"$set": update_data}
    )
    
    # Refresh order for email
    updated_order = await db.orders.find_one({"order_number": order_id}, {"_id": 0})
    
    # Send status update email with shipping details
    # For RTO, send "voucher coming soon" email (no voucher yet)
    if updated_order and updated_order.get("shipping", {}).get("email"):
        try:
            from services.email_service import send_order_status_update_v2
            background_tasks.add_task(
                send_order_status_update_v2,
                updated_order,
                status,
                None  # No voucher passed - email will say "voucher coming soon"
            )
        except Exception as e:
            logger.error(f"Failed to queue status update email: {e}")
        
        # Send push notification (if Firebase configured)
        try:
            from services.push_service import send_order_status_push
            background_tasks.add_task(
                send_order_status_push,
                db,
                updated_order,
                status
            )
        except Exception as e:
            logger.error(f"Failed to queue push notification: {e}")
    
    response = {"message": "Order status updated", "order_number": order_id, "new_status": status}
    if status == "rto":
        response["rto_voucher_pending"] = True
        response["message"] = "Order marked as RTO. Use 'Generate RTO Voucher' to create voucher with custom percentage."
    if status == "shipped" and carrier_name:
        response["shipping_details"] = update_data.get("shipping_details")
    
    # Include voided voucher info if applicable
    if voided_voucher:
        response["rto_voucher_voided"] = voided_voucher
        response["message"] = f"Order status updated to {status}. RTO voucher {voided_voucher} has been automatically voided."
    
    # Sync to Zoho Sheets when order is marked as delivered
    if status == "delivered" and await is_zoho_authorized():
        try:
            background_tasks.add_task(sync_delivered_order, updated_order)
            response["zoho_sync"] = "queued"
            logger.info(f"Queued Zoho sync for delivered order {order_id}")
        except Exception as e:
            logger.error(f"Failed to queue Zoho sync: {e}")
            response["zoho_sync"] = "failed"
    
    return response


@router.post("/orders/{order_id}/generate-rto-voucher")
async def generate_rto_voucher_manual(
    order_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Generate RTO voucher with custom percentage (admin only).
    
    Request body:
    {
        "percentage": 50|60|70|80|90|100  // % of order value to refund
    }
    
    Voucher value = (order_value * percentage / 100)
    Customer receives email with VALUE only (not percentage)
    """
    await require_admin(request, session_token)
    
    logger.info(f"[RTO VOUCHER] Starting voucher generation for order {order_id}")
    
    # Get percentage from request body
    try:
        body = await request.json()
        percentage = body.get('percentage', 100)
    except:
        percentage = 100
    
    logger.info(f"[RTO VOUCHER] Percentage requested: {percentage}%")
    
    # Validate percentage
    valid_percentages = [50, 60, 70, 80, 90, 100]
    if percentage not in valid_percentages:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid percentage. Must be one of: {valid_percentages}"
        )
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_id})
    if not order:
        logger.error(f"[RTO VOUCHER] Order {order_id} not found")
        raise HTTPException(status_code=404, detail="Order not found")
    
    logger.info(f"[RTO VOUCHER] Order found: status={order.get('order_status')}, rto_voucher_generated={order.get('rto_voucher_generated')}")
    
    # Verify it's an RTO order
    if order.get("order_status") != "rto":
        raise HTTPException(
            status_code=400, 
            detail="Can only generate vouchers for RTO orders"
        )
    
    # Check if voucher already generated
    if order.get("rto_voucher_generated"):
        raise HTTPException(
            status_code=400, 
            detail=f"RTO voucher already generated for this order: {order.get('rto_voucher_code')}"
        )
    
    # Calculate voucher value
    pricing = order.get("pricing", {})
    original_amount = pricing.get("final_total", 0)
    
    if original_amount <= 0:
        logger.error(f"[RTO VOUCHER] Invalid order amount: {original_amount}")
        raise HTTPException(status_code=400, detail="Invalid order amount")
    
    # Calculate voucher value based on percentage
    voucher_value = round(original_amount * percentage / 100, 2)
    
    logger.info(f"[RTO VOUCHER] Calculated voucher value: {voucher_value} ({percentage}% of {original_amount})")
    
    # Generate voucher
    from services.voucher_service import generate_voucher_code
    
    voucher_code = generate_voucher_code()
    expires_at = datetime.now(timezone.utc) + timedelta(days=15)
    
    user_email = order.get("shipping", {}).get("email", "").lower() or order.get("billing", {}).get("email", "").lower()
    user_id = order.get("user_id")
    
    voucher = {
        "id": str(uuid.uuid4()),
        "voucher_code": voucher_code,
        "order_number": order_id,
        "user_email": user_email,
        "user_id": user_id,
        "original_amount": original_amount,
        "refund_percentage": percentage,  # Store for admin reference only
        "voucher_value": voucher_value,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "claimed_at": None,
        "claimed_order_number": None,
        "generated_by": "admin_manual"
    }
    
    logger.info(f"[RTO VOUCHER] Voucher document created: code={voucher_code}, value={voucher_value}")
    
    # Save voucher to database with error handling
    try:
        insert_result = await db.rto_vouchers.insert_one(voucher)
        logger.info(f"[RTO VOUCHER] Voucher saved to database. Inserted ID: {insert_result.inserted_id}")
        
        # Verify the voucher was saved
        saved_voucher = await db.rto_vouchers.find_one({"voucher_code": voucher_code})
        if saved_voucher:
            logger.info(f"[RTO VOUCHER] Verification: Voucher {voucher_code} confirmed in database")
        else:
            logger.error(f"[RTO VOUCHER] CRITICAL: Voucher {voucher_code} NOT found after insert!")
            raise HTTPException(status_code=500, detail="Failed to save voucher - verification failed")
    except Exception as e:
        logger.error(f"[RTO VOUCHER] Database error while saving voucher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save voucher: {str(e)}")
    
    voucher.pop('_id', None)
    
    # Update order
    try:
        update_result = await db.orders.update_one(
            {"order_number": order_id},
            {
                "$set": {
                    "rto_voucher_code": voucher_code,
                    "rto_voucher_value": voucher_value,
                    "rto_voucher_percentage": percentage,
                    "rto_voucher_generated": True,
                    "rto_voucher_pending": False,
                    "rto_voucher_generated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        logger.info(f"[RTO VOUCHER] Order updated. Matched: {update_result.matched_count}, Modified: {update_result.modified_count}")
    except Exception as e:
        logger.error(f"[RTO VOUCHER] Error updating order: {str(e)}")
        # Voucher was saved, so don't fail completely
    
    # Send email to customer with voucher VALUE (not percentage)
    if user_email:
        try:
            from services.email_service import send_rto_voucher_email
            background_tasks.add_task(
                send_rto_voucher_email,
                user_email,
                order.get("shipping", {}).get("name") or order.get("billing", {}).get("name") or "Valued Customer",
                order_id,
                voucher_code,
                voucher_value,
                expires_at.isoformat()
            )
            logger.info(f"[RTO VOUCHER] Email queued for {user_email}")
        except Exception as e:
            logger.error(f"[RTO VOUCHER] Error queueing email: {str(e)}")
    
    logger.info(f"[RTO VOUCHER] SUCCESS: Generated voucher {voucher_code} for order {order_id}: ₹{voucher_value} ({percentage}% of ₹{original_amount})")
    
    return {
        "message": "RTO voucher generated successfully",
        "voucher_code": voucher_code,
        "voucher_value": voucher_value,
        "original_amount": original_amount,
        "percentage_applied": percentage,
        "expires_at": expires_at.isoformat(),
        "customer_email": user_email,
        "email_sent": bool(user_email)
    }


# NOTE: Specific routes MUST come before parameterized routes in FastAPI
@router.delete("/orders/purge/all")
async def purge_all_orders(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    DANGER: Delete ALL orders from the database (admin only).
    Requires confirmation in the request body.
    """
    await require_admin(request, session_token)
    
    try:
        body = await request.json()
        confirm = body.get('confirm')
    except:
        confirm = None
    
    if confirm != 'PURGE_ALL_ORDERS':
        raise HTTPException(
            status_code=400, 
            detail="Please send {\"confirm\": \"PURGE_ALL_ORDERS\"} to confirm this action"
        )
    
    # Delete all orders
    result = await db.orders.delete_many({})
    
    return {
        "message": "All orders purged successfully",
        "deleted_count": result.deleted_count
    }


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, request: Request, session_token: Optional[str] = Cookie(None), force: bool = False):
    """Delete an order (admin only). Use force=true to delete non-cancelled orders."""
    await require_admin(request, session_token)
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only allow deletion of cancelled orders unless force=True
    if not force and order.get("order_status") != "cancelled":
        raise HTTPException(status_code=400, detail="Only cancelled orders can be deleted. Use force=true to override.")
    
    # Delete the order
    result = await db.orders.delete_one({"order_number": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete order")
    
    return {"message": "Order deleted successfully", "order_number": order_id, "forced": force}


@router.post("/orders/restore")
async def restore_order(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Restore a saved order for a user (admin only)
    Use this to manually add back an order after data wipeout
    
    Request body should contain the full order document to restore
    """
    await require_admin(request, session_token)
    
    try:
        order_data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid order data")
    
    # Required fields
    required = ['order_number', 'items', 'shipping', 'pricing']
    for field in required:
        if field not in order_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Check if order already exists
    existing = await db.orders.find_one({"order_number": order_data['order_number']})
    if existing:
        raise HTTPException(status_code=400, detail="Order with this number already exists")
    
    # Set default values
    order_data.setdefault('order_status', 'delivered')
    order_data.setdefault('payment_status', 'paid')
    order_data.setdefault('created_at', datetime.now(timezone.utc).isoformat())
    order_data.setdefault('updated_at', datetime.now(timezone.utc).isoformat())
    order_data['restored_by_admin'] = True
    order_data['restored_at'] = datetime.now(timezone.utc).isoformat()
    
    # Insert order
    result = await db.orders.insert_one(order_data)
    
    return {
        "message": "Order restored successfully",
        "order_number": order_data['order_number'],
        "id": str(result.inserted_id)
    }


@router.post("/wipe-data")
async def wipe_all_data(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    DANGER: Wipe all user data from database (admin only)
    
    This will delete:
    - All users
    - All orders
    - All sessions
    - All OTP records
    - All reviews
    - All subscriptions
    
    Admin data and discount codes are preserved.
    """
    await require_admin(request, session_token)
    
    try:
        body = await request.json()
        confirm = body.get('confirm')
    except:
        confirm = None
    
    if confirm != 'WIPE_ALL_DATA':
        raise HTTPException(
            status_code=400, 
            detail="Please send {\"confirm\": \"WIPE_ALL_DATA\"} to confirm this action"
        )
    
    # Collections to wipe
    collections_to_wipe = [
        'users',
        'orders', 
        'user_sessions',
        'otp_verifications',
        'email_change_otps',
        'reviews',
        'subscribers',
        'inquiries'
    ]
    
    results = {}
    for coll_name in collections_to_wipe:
        try:
            result = await db[coll_name].delete_many({})
            results[coll_name] = result.deleted_count
        except Exception as e:
            results[coll_name] = f"Error: {str(e)}"
    
    return {
        "message": "Data wipe completed",
        "deleted_counts": results,
        "preserved": ["admin_settings", "discount_codes", "blog_posts", "product_stock"]
    }
