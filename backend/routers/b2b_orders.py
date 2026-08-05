"""
B2B Wholesale Ordering System for Retailers
Handles bulk ordering with special retailer pricing
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from dependencies import db, NOTIFICATION_EMAIL  # noqa: F401
from services.b2b_settings import (
    get_b2b_enabled,
    get_cash_discount_percent,
    get_all_pricing_tiers,
    get_kyc_required_for_orders,
)
from services.b2b_loyalty import get_retailer_loyalty_state
from services.b2b_catalog import B2B_PRODUCTS
from services.b2b_emails import (
    send_b2b_admin_notification_email,
    send_b2b_order_confirmation_email,
)
from services.b2b_pricing import (
    calculate_b2b_order as calc_b2b_pricing,
)
from services.b2b_pricing_extras import (
    apply_preorder_terms,
    apply_shipping,
    apply_rewards_redemption,
    add_rewards_projection,
)
from services.b2b_payment_hooks import run_post_payment_hooks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-dashboard/b2b", tags=["B2B Orders"])


async def require_b2b_enabled():
    """Raise 403 if B2B portal is disabled."""
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="B2B portal is currently unavailable. Please contact Addrika for access.",
        )


async def require_kyc_complete(retailer: dict):
    """Block order placement when KYC gating is on and retailer has not completed
    GST + PAN + Aadhaar verification. Returns silently when gate is off.

    On block, fires a rate-limited recovery email (≤1/24h per retailer) with
    a deep link to the KYC self-service tab on /retailer/b2b."""
    if not await get_kyc_required_for_orders(db):
        return
    missing = []
    if not retailer.get("gst_verified"):
        missing.append("GST")
    if not retailer.get("pan_verified"):
        missing.append("PAN")
    if not retailer.get("aadhaar_verified"):
        missing.append("Aadhaar")
    if missing:
        # Fire recovery email asynchronously so the 403 isn't delayed by the
        # outbound Resend call. Throttling lives inside the helper.
        from services.kyc_recovery_email import (
            maybe_send_kyc_recovery_email,
            fire_and_forget,
        )
        fire_and_forget(maybe_send_kyc_recovery_email(db, retailer, missing))
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_incomplete",
                "missing": missing,
                "message": (
                    f"Complete your KYC ({', '.join(missing)}) before placing orders. "
                    "Visit your dashboard's KYC section to finish verification — "
                    "we've also emailed you a direct link."
                ),
            },
        )


# ============================================================================
# Helper Functions
# ============================================================================

async def get_current_retailer(request: Request, retailer_session: Optional[str] = None):
    """Get current authenticated retailer"""
    session_token = retailer_session or request.cookies.get("retailer_session")
    if not session_token:
        return None

    session = await db.retailer_sessions.find_one({"session_token": session_token})
    if not session:
        return None

    if datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
        return None

    retailer = await db.retailers.find_one(
        {"retailer_id": session["retailer_id"]},
        {"_id": 0, "password_hash": 0}
    )

    return retailer


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/catalog")
async def get_b2b_catalog(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get B2B product catalog with wholesale pricing"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Attach quantity-tier pricing (if configured per product)
    tiers_map = await get_all_pricing_tiers(db)
    products_with_tiers = []
    for p in B2B_PRODUCTS:
        p_copy = dict(p)
        p_copy["pricing_tiers"] = tiers_map.get(p["id"], [])
        products_with_tiers.append(p_copy)

    cash_discount_percent = await get_cash_discount_percent(db)

    return {
        "products": products_with_tiers,
        "cash_discount_percent": cash_discount_percent,
        "retailer_gst": retailer.get("gst_number"),
        "retailer_address": {
            "business_name": retailer.get("business_name") or retailer.get("trade_name"),
            "address": retailer.get("address"),
            "city": retailer.get("city"),
            "state": retailer.get("state"),
            "pincode": retailer.get("pincode")
        }
    }


class B2BOrderItem(BaseModel):
    product_id: str
    quantity_boxes: float = Field(..., ge=0, description="Quantity in boxes (multiples of 0.5)")


class B2BOrderCreate(BaseModel):
    items: List[B2BOrderItem]
    apply_cash_discount: bool = False
    voucher_code: Optional[str] = None  # Retailer voucher code
    credit_note_code: Optional[str] = None  # Credit note code
    notes: Optional[str] = None
    # New (Feb 2026): allow retailer to include distance-based shipping
    delivery_pincode: Optional[str] = None
    include_shipping: bool = True
    # Fragrance Rewards redemption (₹). Server clamps to eligible amount.
    redeem_rewards_inr: Optional[float] = None
    # Pre-order flow — retailer books an out-of-stock SKU with 50% token.
    # Server validates: at least one item is preorder-eligible + terms accepted.
    is_preorder: bool = False
    accept_preorder_terms: bool = False


class ShippingQuoteRequest(BaseModel):
    delivery_pincode: str = Field(..., min_length=6, max_length=6)
    items: List[B2BOrderItem]
    cod: bool = False


@router.post("/shipping-quote")
async def b2b_shipping_quote(
    body: ShippingQuoteRequest,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Distance-based shipping quote for a B2B cart. Reads Shiprocket
    creds from the DB-backed admin integrations panel."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from services.b2b_shipping import get_b2b_shipping_quote
    return await get_b2b_shipping_quote(
        body.delivery_pincode, body.items, cod=body.cod
    )


@router.post("/calculate")
async def calculate_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Calculate B2B order totals without placing the order"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Compute distance-based shipping when a delivery pincode is supplied.
    shipping_quote = None
    if order_data.include_shipping and order_data.delivery_pincode:
        from services.b2b_shipping import get_b2b_shipping_quote
        shipping_quote = await get_b2b_shipping_quote(
            order_data.delivery_pincode, order_data.items
        )

    calc = await calc_b2b_pricing(
        db,
        retailer=retailer,
        items=order_data.items,
        apply_cash_discount=order_data.apply_cash_discount,
        voucher_code=order_data.voucher_code,
        credit_note_code=order_data.credit_note_code,
        is_preorder=order_data.is_preorder,
    )

    # Layer pre-order token, shipping, rewards redemption and projection on top
    apply_preorder_terms(
        calc,
        is_preorder=order_data.is_preorder,
        accept_terms=order_data.accept_preorder_terms,
    )
    apply_shipping(calc, shipping_quote)
    await apply_rewards_redemption(
        db, calc, retailer, float(order_data.redeem_rewards_inr or 0)
    )
    await add_rewards_projection(db, calc, retailer)

    return calc


@router.post("/order")
async def create_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Place a B2B wholesale order"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await require_kyc_complete(retailer)
    
    # Calculate order first
    calculation = await calculate_b2b_order(order_data, request, retailer_session)
    
    now = datetime.now(timezone.utc)
    order_id = f"B2B-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    
    order = {
        "order_id": order_id,
        "retailer_id": retailer["retailer_id"],
        "retailer_email": retailer["email"],
        "retailer_phone": retailer.get("phone"),
        "retailer_gst": retailer.get("gst_number"),
        "billing_address": calculation["retailer_address"],
        "items": calculation["items"],
        "subtotal": calculation["subtotal"],
        "subtotal_after_loyalty": calculation.get("subtotal_after_loyalty", calculation["subtotal"]),
        "tier_discount_total": calculation.get("tier_discount_total", 0),
        "taxable_value": calculation.get("taxable_value", calculation["subtotal"]),
        "gst_total": calculation["gst_total"],
        "voucher_code": calculation.get("voucher_code"),
        "voucher_discount": calculation.get("voucher_discount", 0),
        "loyalty_discount": calculation.get("loyalty_discount", 0),
        "loyalty_discount_percent": calculation.get("loyalty_discount_percent", 0),
        "loyalty_milestone": calculation.get("loyalty_milestone"),
        "quarter_label": calculation.get("quarter_label"),
        "cash_discount": calculation.get("cash_discount", 0),
        "cash_discount_percent": calculation.get("cash_discount_percent", 0),
        "credit_note_code": calculation.get("credit_note_code"),
        "credit_note_discount": calculation.get("credit_note_discount", 0),
        "total_discount": calculation.get("total_discount", 0),
        "shipping_charges": float(calculation.get("shipping_charges") or 0),
        "shipping_quote": calculation.get("shipping_quote"),
        "delivery_pincode": order_data.delivery_pincode,
        "rewards_redeemed_inr": float(calculation.get("rewards_redeemed_inr") or 0),
        "rewards_redemption_preview": calculation.get("rewards_redemption"),
        "grand_total": calculation["grand_total"],
        # Pre-order fields (only meaningful if is_preorder=True)
        "is_preorder": bool(calculation.get("is_preorder")),
        "token_amount_inr": float(calculation.get("token_amount_inr") or 0),
        "balance_due_inr": float(calculation.get("balance_due_inr") or 0),
        "terms_version": calculation.get("terms_version"),
        "terms_text": calculation.get("terms_text"),
        "terms_accepted_at": now.isoformat() if calculation.get("is_preorder") else None,
        "payment_method": "online" if order_data.apply_cash_discount or order_data.voucher_code else "credit",
        "payment_status": "pending",
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "order_status": "ordered",
        "status_history": [{
            "status": "ordered",
            "timestamp": now.isoformat(),
            "note": "Order placed by retailer"
        }],
        "notes": order_data.notes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Create Razorpay order if payment required
    razorpay_order = None
    # For pre-orders we charge ONLY the 50% token, not the full grand_total.
    charge_amount = (
        float(order.get("token_amount_inr") or 0)
        if order.get("is_preorder")
        else float(calculation["grand_total"])
    )
    if charge_amount > 0 and (order["payment_method"] == "online" or order.get("is_preorder")):
        try:
            import razorpay
            import os

            client = razorpay.Client(auth=(
                os.environ.get("RAZORPAY_KEY_ID"),
                os.environ.get("RAZORPAY_KEY_SECRET")
            ))

            razorpay_order = client.order.create({
                "amount": int(round(charge_amount * 100)),  # Razorpay expects paise
                "currency": "INR",
                "receipt": order_id,
                "notes": {
                    "order_id": order_id,
                    "retailer_id": retailer["retailer_id"],
                    "order_type": "B2B-PREORDER" if order.get("is_preorder") else "B2B",
                    "charge_type": "token" if order.get("is_preorder") else "full",
                }
            })
            order["razorpay_order_id"] = razorpay_order["id"]
            order["razorpay_charge_amount"] = charge_amount
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {str(e)}")
            # Continue without online payment
    
    await db.b2b_orders.insert_one(order)

    # Send admin notification email for every B2B order placed
    try:
        await send_b2b_admin_notification_email(order, retailer)
    except Exception as e:
        logger.error(f"Failed to send B2B admin notification email: {str(e)}")

    # Best-effort sync to Zoho Books (no-op if env not configured)
    try:
        from services.zoho_books import push_sales_order, is_configured as _zoho_cfg
        zoho_so = await push_sales_order(order, retailer)
        if zoho_so:
            await db.b2b_orders.update_one(
                {"order_id": order["order_id"]},
                {"$set": {
                    "zoho_salesorder_id": zoho_so.get("salesorder_id"),
                    "zoho_synced_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        elif await _zoho_cfg():
            # configured but returned None → treat as a sync error
            from services.zoho_errors import record_error
            await record_error(
                "sales_order",
                order["order_id"],
                retailer["retailer_id"],
                "push_sales_order returned None (Zoho API likely rejected the payload — see server logs).",
            )
    except Exception as e:
        logger.error(f"Zoho sales-order sync failed for {order['order_id']}: {e}")
        try:
            from services.zoho_errors import record_error
            await record_error(
                "sales_order",
                order["order_id"],
                retailer["retailer_id"],
                str(e),
            )
        except Exception:
            pass

    # Mark voucher as used if applicable
    if order_data.voucher_code:
        await db.retailer_vouchers.update_one(
            {"code": order_data.voucher_code.upper()},
            {"$inc": {"used_count": 1}}
        )
    
    # Mark credit note as used if applicable
    if order_data.credit_note_code and calculation.get("credit_note_discount", 0) > 0:
        cn_used = calculation["credit_note_discount"]
        await db.credit_notes.update_one(
            {"code": order_data.credit_note_code.upper()},
            {
                "$inc": {"balance": -cn_used},
                "$set": {"status": "used" if cn_used >= calculation.get("credit_note_discount", 0) else "active"}
            }
        )
    
    logger.info(f"B2B order {order_id} created by retailer {retailer['retailer_id']}: ₹{calculation['grand_total']}")
    
    response = {
        "message": "B2B order placed successfully",
        "order_id": order_id,
        "grand_total": calculation["grand_total"],
        "status": "ordered"
    }
    
    if razorpay_order:
        response["razorpay_order_id"] = razorpay_order["id"]
        response["razorpay_key"] = os.environ.get("RAZORPAY_KEY_ID")
        response["next_steps"] = "Complete payment to confirm your order."
    else:
        response["next_steps"] = "Our team will contact you to confirm the order and arrange delivery/payment."
    
    return response





# ---------------------------------------------------------------------------
# Pre-Order Balance Payment
# ---------------------------------------------------------------------------
# When a pre-order SKU comes back into stock, the retailer receives a
# "Batch Ready" nudge with a link that lands at /retailer/b2b/orders/{id}?balance=1.
# That page calls these two endpoints:
#     ▸ POST /order/{id}/create-balance-payment → mint a Razorpay order for the
#       remaining 50%.
#     ▸ POST /order/{id}/verify-balance-payment → verify signature and mark the
#       pre-order fully paid.
# ---------------------------------------------------------------------------
@router.post("/order/{order_id}/create-balance-payment")
async def create_b2b_balance_payment(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")

    order = await db.b2b_orders.find_one(
        {"order_id": order_id, "retailer_id": retailer["retailer_id"]},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.get("is_preorder"):
        raise HTTPException(status_code=400, detail="This order is not a pre-order.")
    if order.get("balance_paid_at"):
        raise HTTPException(status_code=400, detail="Balance already paid.")
    balance = float(order.get("balance_due_inr") or 0)
    if balance <= 0:
        raise HTTPException(status_code=400, detail="No outstanding balance on this order.")

    try:
        import razorpay
        import os as _os
        client = razorpay.Client(auth=(
            _os.environ.get("RAZORPAY_KEY_ID"),
            _os.environ.get("RAZORPAY_KEY_SECRET"),
        ))
        razorpay_order = client.order.create({
            "amount": int(round(balance * 100)),
            "currency": "INR",
            "receipt": f"{order_id}-bal",
            "notes": {
                "order_id": order_id,
                "retailer_id": retailer["retailer_id"],
                "order_type": "B2B-PREORDER",
                "charge_type": "balance",
            },
        })
        await db.b2b_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "balance_razorpay_order_id": razorpay_order["id"],
                "balance_charge_amount": balance,
            }},
        )
        return {
            "razorpay_order_id": razorpay_order["id"],
            "razorpay_key": _os.environ.get("RAZORPAY_KEY_ID"),
            "amount_inr": balance,
            "currency": "INR",
            "order_id": order_id,
        }
    except Exception as e:
        logger.error(f"Balance Razorpay order creation failed for {order_id}: {e}")
        raise HTTPException(status_code=502, detail="Could not initiate balance payment. Please retry.")


@router.post("/order/{order_id}/verify-balance-payment")
async def verify_b2b_balance_payment(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    rpay_payment_id = body.get("razorpay_payment_id")
    rpay_order_id = body.get("razorpay_order_id")
    rpay_signature = body.get("razorpay_signature")
    if not all([rpay_payment_id, rpay_order_id, rpay_signature]):
        raise HTTPException(status_code=400, detail="Missing payment verification data")

    order = await db.b2b_orders.find_one(
        {"order_id": order_id, "retailer_id": retailer["retailer_id"]},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("balance_paid_at"):
        return {"message": "Balance already paid", "order_id": order_id}

    try:
        import razorpay
        import os as _os
        client = razorpay.Client(auth=(
            _os.environ.get("RAZORPAY_KEY_ID"),
            _os.environ.get("RAZORPAY_KEY_SECRET"),
        ))
        client.utility.verify_payment_signature({
            "razorpay_order_id": rpay_order_id,
            "razorpay_payment_id": rpay_payment_id,
            "razorpay_signature": rpay_signature,
        })
        now = datetime.now(timezone.utc)
        await db.b2b_orders.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "balance_paid_at": now.isoformat(),
                    "balance_razorpay_payment_id": rpay_payment_id,
                    "order_status": "confirmed",
                    "updated_at": now.isoformat(),
                },
                "$push": {
                    "status_history": {
                        "status": "confirmed",
                        "timestamp": now.isoformat(),
                        "note": f"Balance payment verified: {rpay_payment_id}",
                    }
                },
            },
        )
        fresh = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
        # Reuse post-payment hook pipeline (rewards + inventory + Zoho)
        await run_post_payment_hooks(db, fresh, retailer, rpay_payment_id)
        return {
            "message": "Balance payment verified — your batch will be dispatched shortly.",
            "order_id": order_id,
            "status": "confirmed",
        }
    except Exception as e:
        logger.error(f"Balance payment verification failed for {order_id}: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")



@router.post("/order/{order_id}/verify-payment")
async def verify_b2b_payment(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Verify Razorpay payment for B2B order"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_signature = body.get("razorpay_signature")
    
    if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
        raise HTTPException(status_code=400, detail="Missing payment verification data")
    
    order = await db.b2b_orders.find_one({
        "order_id": order_id,
        "retailer_id": retailer["retailer_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("payment_status") == "paid":
        return {"message": "Payment already verified", "order_id": order_id}
    
    try:
        import razorpay
        import os
        import hmac
        import hashlib
        
        # Verify signature
        client = razorpay.Client(auth=(
            os.environ.get("RAZORPAY_KEY_ID"),
            os.environ.get("RAZORPAY_KEY_SECRET")
        ))
        
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        
        client.utility.verify_payment_signature(params_dict)
        
        # Payment verified successfully
        now = datetime.now(timezone.utc)
        
        await db.b2b_orders.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "payment_status": "paid",
                    "razorpay_payment_id": razorpay_payment_id,
                    "order_status": "confirmed",
                    "updated_at": now.isoformat()
                },
                "$push": {
                    "status_history": {
                        "status": "confirmed",
                        "timestamp": now.isoformat(),
                        "note": f"Payment verified: {razorpay_payment_id}"
                    }
                }
            }
        )
        
        # Send confirmation email
        try:
            await send_b2b_order_confirmation_email(order, retailer)
        except Exception as e:
            logger.error(f"Failed to send B2B order confirmation email: {str(e)}")

        logger.info(f"B2B order {order_id} payment verified: {razorpay_payment_id}")

        # Run all post-payment side-effects (rewards accrual + redemption
        # consumption + inventory deduction + Zoho payment sync). Each hook
        # is independently guarded so partial failures don't cascade.
        fresh_order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
        await run_post_payment_hooks(db, fresh_order, retailer, razorpay_payment_id)

        return {
            "message": "Payment verified successfully",
            "order_id": order_id,
            "status": "confirmed"
        }
        
    except Exception as e:
        logger.error(f"Payment verification failed for {order_id}: {str(e)}")
        raise HTTPException(status_code=400, detail="Payment verification failed")


@router.get("/orders")
async def get_b2b_orders(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """Get retailer's B2B orders"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    
    query = {"retailer_id": retailer["retailer_id"]}
    if status:
        query["order_status"] = status
    
    orders = await db.b2b_orders.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.b2b_orders.count_documents(query)
    
    return {
        "orders": orders,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.get("/orders/{order_id}")
async def get_b2b_order_detail(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get B2B order details"""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    order = await db.b2b_orders.find_one(
        {
            "order_id": order_id,
            "retailer_id": retailer["retailer_id"]
        },
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"order": order}



@router.get("/loyalty")
async def get_retailer_loyalty(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Retailer's current quarter loyalty state for the progress bar UI."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    state = await get_retailer_loyalty_state(db, retailer["retailer_id"])
    return state


@router.get("/kyc-gate")
async def get_my_kyc_gate(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Retailer endpoint: returns whether the KYC gate is on and which
    fields the retailer still needs to verify before they can place orders."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    gate_on = await get_kyc_required_for_orders(db)
    missing = []
    if not retailer.get("gst_verified"):
        missing.append("GST")
    if not retailer.get("pan_verified"):
        missing.append("PAN")
    if not retailer.get("aadhaar_verified"):
        missing.append("Aadhaar")
    return {
        "gate_enabled": gate_on,
        "fully_kyc_verified": len(missing) == 0,
        "missing": missing,
        "can_order": (not gate_on) or (len(missing) == 0),
        "retailer_id": retailer["retailer_id"],
    }


@router.post("/tour-complete")
async def mark_retailer_tour_complete(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Persist that this retailer has completed (or dismissed) the
    first-login product tour, so it doesn't show again."""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {
            "tour_completed": True,
            "tour_completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True}


@router.get("/orders/{order_id}/invoice.pdf")
async def retailer_download_invoice(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Retailer self-service download of their B2B GST tax invoice."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    order = await db.b2b_orders.find_one(
        {"order_id": order_id, "retailer_id": retailer["retailer_id"]},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    from services.b2b_invoice_pdf import build_invoice_pdf

    pdf_bytes = build_invoice_pdf(order, retailer)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="invoice-{order_id}.pdf"'
        },
    )


@router.get("/orders/{order_id}/preorder-receipt.pdf")
async def retailer_download_preorder_receipt(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Downloadable Pre-Order receipt (token acknowledgement + legal terms
    + signature line). Only pre-orders qualify — regular invoices ship
    via `/invoice.pdf`."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    order = await db.b2b_orders.find_one(
        {"order_id": order_id, "retailer_id": retailer["retailer_id"]},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.get("is_preorder"):
        raise HTTPException(status_code=400, detail="This order is not a pre-order")

    from services.b2b_preorder_pdf import build_preorder_receipt_pdf
    pdf_bytes = build_preorder_receipt_pdf(order, retailer)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="preorder-receipt-{order_id}.pdf"'
        },
    )
