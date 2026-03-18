"""Orders Routes - With Razorpay Payment Gateway"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import uuid
import razorpay
import hmac
import hashlib
import logging

import re

from models.ecommerce import OrderCreate
from services.email_service import send_order_confirmation
from services.shiprocket_service import create_shiprocket_order, get_domestic_shipping_rates
from services.shipping_config import get_free_shipping_threshold, assign_retailer_for_shipping, RETAILERS, get_shipping_charge
from dependencies import db, get_current_user, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from routers.products import PRODUCTS, calculate_pricing

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Orders"])

# Initialize Razorpay client
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def generate_order_number():
    """Generate unique order number with DDMMMYYYY format"""
    ts = datetime.now(timezone.utc).strftime("%d%b%Y").upper()  # e.g., 18FEB2026
    time_part = datetime.now(timezone.utc).strftime("%H%M%S")
    uid = str(uuid.uuid4())[:4].upper()
    return f"ADD-{ts}-{time_part}-{uid}"


def validate_gst_number(gst: str) -> bool:
    """Validate Indian GST number format"""
    # GST format: 2 digit state code + 10 char PAN + 1 entity code + Z + 1 checksum
    # Example: 22AAAAA0000A1Z5
    if not gst:
        return False
    gst = gst.upper().strip()
    gst_pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(gst_pattern, gst))


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature"""
    if not RAZORPAY_KEY_SECRET:
        return False
    
    msg = f"{order_id}|{payment_id}"
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        msg.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(generated_signature, signature)


# Import package calculation from service (avoid duplication)
from services.order_pricing import calculate_package_details, validate_and_apply_coupon, get_order_status_for_delivery_mode, TOKEN_AMOUNT


def _calculate_shipping_weight_kg(order_items: list) -> float:
    """
    Calculate package weight in kg for ShipRocket rate calculation.
    Uses the same logic as calculate_package_details for consistency.
    
    Weight formula:
    - 50g packet = 0.08 kg (80g with packaging)
    - 200g jar = 0.35 kg (350g with packaging)
    - Minimum 0.25 kg
    """
    net_weight = 0
    for item in order_items:
        size = item.get("size", "50g")
        quantity = item.get("quantity", 1)
        
        if size == "50g":
            net_weight += 0.08 * quantity
        elif size == "200g":
            net_weight += 0.35 * quantity
        else:
            # Default fallback
            net_weight += 0.15 * quantity
    
    return max(net_weight, 0.25)  # Minimum 250g

# Default pickup pincode for ShipRocket rate calculation
DEFAULT_PICKUP_PINCODE = "110078"


async def _get_shiprocket_base_rate(delivery_pincode: str, weight_kg: float) -> Optional[float]:
    """
    Get the cheapest ShipRocket base rate for shipping calculation.
    Returns None if unavailable (will fallback to slab max).
    """
    if not delivery_pincode or len(delivery_pincode) != 6:
        return None
    
    try:
        from services.shipping_config import get_pickup_location_for_delivery
        
        # Get pickup pincode based on delivery location
        try:
            pickup_info = get_pickup_location_for_delivery(delivery_pincode, None)
            pickup_pincode = pickup_info.get("pincode", DEFAULT_PICKUP_PINCODE)
        except Exception:
            pickup_pincode = DEFAULT_PICKUP_PINCODE
        
        # Ensure minimum weight
        weight = max(weight_kg, 0.25)
        
        result = await get_domestic_shipping_rates(
            pickup_postcode=pickup_pincode,
            delivery_postcode=delivery_pincode,
            weight=weight
        )
        
        if result.get("success") and result.get("couriers"):
            cheapest = result["couriers"][0]
            return cheapest.get("rate", 0)
        
        return None
    except Exception as e:
        logger.warning(f"Failed to get ShipRocket rate for {delivery_pincode}: {e}")
        return None


async def push_order_to_shiprocket(order_doc: dict) -> dict:
    """
    Push an order to ShipRocket for fulfillment.
    Called after successful payment verification.
    """
    try:
        items = order_doc.get("items", [])
        shipping = order_doc.get("shipping", {})
        billing = order_doc.get("billing", shipping)
        pricing = order_doc.get("pricing", {})
        
        # Calculate package details with order subtotal for packaging weight
        order_subtotal = pricing.get("subtotal", 0)
        package = calculate_package_details(items, order_subtotal)
        
        shiprocket_data = {
            "order_number": order_doc.get("order_number"),
            "items": items,
            "shipping": shipping,
            "billing": billing,
            "shipping_is_billing": not order_doc.get("use_different_shipping", False),
            "shipping_charges": pricing.get("shipping", 0),
            "discount": pricing.get("coupon_discount", 0) + pricing.get("bulk_discount", 0),
            "subtotal": pricing.get("subtotal", 0),
            "weight": package["weight"],
            "length": package["length"],
            "breadth": package["breadth"],
            "height": package["height"]
        }
        
        result = await create_shiprocket_order(shiprocket_data)
        
        if result.get("success"):
            logger.info(f"ShipRocket order created for {order_doc.get('order_number')}: {result}")
        else:
            logger.warning(f"ShipRocket order creation failed for {order_doc.get('order_number')}: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error pushing order to ShipRocket: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/orders/create")
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks):
    """
    Initiate order payment - Creates Razorpay payment order but does NOT create the actual order.
    The actual order is only created after payment verification.
    """
    
    if not order_data.items or len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
    
    # Build order items
    order_items = []
    for item in order_data.items:
        product_id = item.get('productId') if isinstance(item, dict) else item.productId
        item_size = item.get('size') if isinstance(item, dict) else item.size
        item_quantity = item.get('quantity') if isinstance(item, dict) else item.quantity
        
        product = next((p for p in PRODUCTS if p["id"] == product_id), None)
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {product_id} not found")
        
        size_variant = next((s for s in product["sizes"] if s["size"] == item_size), None)
        if not size_variant:
            raise HTTPException(status_code=400, detail=f"Size {item_size} not available")
        
        order_items.append({
            "productId": product_id,
            "name": product["name"],
            "size": item_size,
            "quantity": item_quantity,
            "price": size_variant["price"],
            "mrp": size_variant["mrp"],
            "weight": size_variant.get("weight", 50 if item_size == "50g" else 200)
        })
    
    # Determine shipping address (use billing if shipping not provided or same)
    billing = order_data.billing
    if order_data.use_different_shipping and order_data.shipping:
        shipping_address = order_data.shipping
    else:
        shipping_address = billing
    
    # ============================================================================
    # DELIVERY MODE HANDLING
    # 'shipping' = deliver to address, 'self_pickup' = collect from store
    # ============================================================================
    delivery_mode = order_data.delivery_mode or 'shipping'
    is_self_pickup = delivery_mode == 'self_pickup'
    is_pay_at_store = is_self_pickup and order_data.pickup_payment_option == 'pay_at_store'
    pickup_store_info = None
    assigned_retailer = None
    
    if is_self_pickup:
        # Validate pickup store is selected
        if not order_data.pickup_store:
            raise HTTPException(status_code=400, detail="Please select a pickup store for self-collection")
        
        pickup_store_info = {
            "id": order_data.pickup_store.id,
            "name": order_data.pickup_store.name,
            "address": order_data.pickup_store.address,
            "city": order_data.pickup_store.city,
            "state": order_data.pickup_store.state,
            "pincode": order_data.pickup_store.pincode,
            "email": order_data.pickup_store.email,
            "phone": order_data.pickup_store.phone
        }
    
    # Calculate pricing with pincode for proper free shipping calculation
    shipping_pincode = shipping_address.pincode if shipping_address else ""
    pricing = calculate_pricing(order_items, shipping_address.state if shipping_address else "other", shipping_pincode)
    
    # Calculate MRP total
    mrp_total = sum(item["mrp"] * item["quantity"] for item in order_items)
    
    # Validate and apply discount code using service function
    coupon_result = await validate_and_apply_coupon(
        db, 
        order_data.discountCode or "", 
        mrp_total, 
        delivery_mode
    )
    coupon_discount = coupon_result["coupon_discount"]
    has_coupon_applied = coupon_result["has_coupon_applied"]
    
    # ============================================================================
    # COIN REDEMPTION HANDLING (only for shipping mode)
    # ============================================================================
    coin_discount = 0
    coins_redeemed = 0
    has_coins_applied = False
    coin_redemption_info = None
    
    if not is_self_pickup and order_data.coin_redemption and order_data.userId:
        from routers.rewards import MINIMUM_COINS_TO_REDEEM, COIN_REDEMPTION_VALUE
        from models.rewards import calculate_max_redeemable_coins
        
        coins_to_redeem = order_data.coin_redemption.get('coins_to_redeem', 0)
        # Note: requested_value from frontend is used for validation only
        
        if coins_to_redeem >= MINIMUM_COINS_TO_REDEEM:
            # Calculate cart value after coupon discount (for max redemption check)
            cart_value_after_coupon = mrp_total - coupon_discount
            
            # Validate max redemption (50% of cart value)
            max_check = calculate_max_redeemable_coins(cart_value_after_coupon, coins_to_redeem)
            
            if max_check['can_redeem']:
                # Cap at max allowed
                actual_coins = min(coins_to_redeem, max_check['max_coins'])
                coin_discount = round(actual_coins * COIN_REDEMPTION_VALUE, 2)
                coins_redeemed = actual_coins
                has_coins_applied = True
                
                coin_redemption_info = {
                    "coins_to_redeem": round(coins_redeemed, 2),
                    "redemption_value": round(coin_discount, 2),
                    "coin_rate": COIN_REDEMPTION_VALUE
                }
    
    # ============================================================================
    # PRICING LOGIC BASED ON DELIVERY MODE
    # Self-pickup: MRP only, no shipping, no discounts
    # Shipping: Full calculation with coupons, coins, and shipping charges
    # ============================================================================
    
    if is_self_pickup:
        # Self-pickup: MRP only, no shipping, no discounts
        bulk_discount = 0
        shipping = 0
        final_total = mrp_total
        value_for_shipping_calc = mrp_total
        shiprocket_base_rate = None
    elif has_coupon_applied:
        # Shipping with coupon: start from MRP, no bulk discount
        bulk_discount = 0
        value_for_shipping_calc = mrp_total - coupon_discount
        
        # Calculate package weight using consistent logic (in kg)
        package_weight_kg = _calculate_shipping_weight_kg(order_items)
        
        # Fetch ShipRocket rate for dynamic pricing (capped at slab max)
        shiprocket_base_rate = await _get_shiprocket_base_rate(
            shipping_address.pincode if shipping_address else "",
            package_weight_kg
        )
        shipping = get_shipping_charge(value_for_shipping_calc, shiprocket_base_rate)
        
        # Apply coin discount AFTER coupon and shipping calculation
        final_total = mrp_total - coupon_discount - coin_discount + shipping
    else:
        # Shipping without coupon: use normal subtotal (now equals MRP since no 5% discount)
        bulk_discount = pricing["bulk_discount"]
        value_for_shipping_calc = pricing["subtotal"] - bulk_discount
        
        # Calculate package weight using consistent logic (in kg)
        package_weight_kg = _calculate_shipping_weight_kg(order_items)
        
        # Fetch ShipRocket rate for dynamic pricing (capped at slab max)
        shiprocket_base_rate = await _get_shiprocket_base_rate(
            shipping_address.pincode if shipping_address else "",
            package_weight_kg
        )
        shipping = get_shipping_charge(value_for_shipping_calc, shiprocket_base_rate)
        
        # Apply coin discount AFTER shipping calculation
        final_total = pricing["subtotal"] - bulk_discount - coin_discount + shipping
    
    # Ensure final total is not negative
    final_total = max(0, final_total)
    
    # Get shipping threshold info (for reference)
    delivery_pincode = shipping_address.pincode if shipping_address else ""
    threshold_info = get_free_shipping_threshold(delivery_pincode)
    
    # For self-pickup with pay-at-store: only charge token amount
    amount_to_charge = TOKEN_AMOUNT if is_pay_at_store else final_total
    balance_at_store = (mrp_total - TOKEN_AMOUNT) if is_pay_at_store else 0
    
    # Validate GST if B2B order
    gst_info = None
    if order_data.gst_info and order_data.gst_info.is_b2b:
        if final_total < 10000:
            raise HTTPException(status_code=400, detail="B2B orders require minimum order value of ₹10,000")
        if order_data.gst_info.gst_number:
            if not validate_gst_number(order_data.gst_info.gst_number):
                raise HTTPException(status_code=400, detail="Invalid GST number format. Please enter a valid 15-character GSTIN")
            gst_info = {
                "is_b2b": True,
                "gst_number": order_data.gst_info.gst_number.upper().strip(),
                "business_name": order_data.gst_info.business_name
            }
    
    # Generate a temporary session ID (NOT an order number)
    ts = datetime.now(timezone.utc).strftime("%d%b%Y%H%M%S").upper()  # e.g., 18FEB2026120530
    session_id = f"SESSION-{ts}-{str(uuid.uuid4())[:8].upper()}"
    
    # Create Razorpay order for online payment
    # Use amount_to_charge (token for pay-at-store, full amount otherwise)
    razorpay_order = None
    payment_method = order_data.paymentMethod or 'razorpay'
    
    if payment_method == 'razorpay' and razorpay_client:
        try:
            razorpay_order = razorpay_client.order.create({
                "amount": int(amount_to_charge * 100),  # Amount in paise (token for pay-at-store)
                "currency": "INR",
                "receipt": session_id,
                "notes": {
                    "session_id": session_id,
                    "customer_email": billing.email if billing else "",
                    "delivery_mode": delivery_mode,
                    "is_token_payment": is_pay_at_store
                }
            })
        except Exception as e:
            print(f"Razorpay order creation failed: {e}")
            raise HTTPException(status_code=500, detail="Payment gateway error. Please try again.")
    
    # For shipping orders, assign a retailer for fulfillment
    if not is_self_pickup:
        try:
            assigned_retailer = await assign_retailer_for_shipping(db, delivery_pincode)
        except Exception as e:
            logger.error(f"Retailer assignment failed: {e}")
            # Fallback to Delhi warehouse
            assigned_retailer = {
                "retailer_id": "delhi_primary",
                "retailer_key": "delhi",
                "retailer_name": "M.G. Shoppie",
                "retailer_email": RETAILERS["delhi"]["email"],
                "retailer_phone": RETAILERS["delhi"]["phone"],
                "retailer_address": f"{RETAILERS['delhi']['address']}, {RETAILERS['delhi']['city']}, {RETAILERS['delhi']['state']} - {RETAILERS['delhi']['pincode']}",
                "assignment_reason": "Default warehouse (assignment error)",
                "is_fallback": True
            }
    
    # Store ONLY as a pending payment session - NOT an order
    # This data is temporary and will be used to create the actual order after payment
    payment_session = {
        "session_id": session_id,
        "razorpay_order_id": razorpay_order["id"] if razorpay_order else None,
        "items": order_items,
        "billing": {
            "salutation": billing.salutation if billing else "",
            "name": billing.name,
            "email": billing.email.lower(),
            "phone": billing.phone,
            "address": billing.address,
            "landmark": billing.landmark if billing and hasattr(billing, 'landmark') else None,
            "city": billing.city,
            "state": billing.state,
            "pincode": billing.pincode
        },
        "shipping": {
            "salutation": shipping_address.salutation if shipping_address else "",
            "name": shipping_address.name,
            "email": shipping_address.email.lower(),
            "phone": shipping_address.phone,
            "address": shipping_address.address,
            "landmark": shipping_address.landmark if shipping_address and hasattr(shipping_address, 'landmark') else None,
            "city": shipping_address.city,
            "state": shipping_address.state,
            "pincode": shipping_address.pincode
        },
        "use_different_shipping": order_data.use_different_shipping,
        # Delivery mode info
        "delivery_mode": delivery_mode,
        "pickup_store": pickup_store_info,
        "pickup_payment_option": order_data.pickup_payment_option if is_self_pickup else None,
        "pickup_time_slot": order_data.pickup_time_slot if is_self_pickup else None,
        "is_pay_at_store": is_pay_at_store,
        "amount_charged": round(amount_to_charge, 2),
        "balance_at_store": round(balance_at_store, 2),
        "assigned_retailer": assigned_retailer,
        "pricing": {
            "subtotal": pricing["subtotal"],
            "mrp_total": mrp_total,
            "bulk_discount": round(bulk_discount, 2),
            "shipping": round(shipping, 2),
            "coupon_discount": round(coupon_discount, 2),
            "coupon_code": order_data.discountCode.upper() if order_data.discountCode and not is_self_pickup else None,
            "has_coupon_applied": has_coupon_applied,
            "coin_discount": round(coin_discount, 2),
            "coins_redeemed": round(coins_redeemed, 2),
            "has_coins_applied": has_coins_applied,
            "free_shipping_threshold": threshold_info["threshold"],
            "zone_name": threshold_info.get("zone_name", ""),
            "final_total": round(final_total, 2)
        },
        "coin_redemption": coin_redemption_info,
        "coins_redeemed_value": round(coin_discount, 2),
        "discount_code": order_data.discountCode if not is_self_pickup else None,
        "voucher_type": coupon_result.get("voucher_type"),  # 'discount_code' or 'rto_voucher'
        "rto_voucher_id": coupon_result.get("rto_voucher_id"),  # For RTO voucher tracking
        "payment_method": payment_method,
        "gst_info": gst_info,
        "user_id": order_data.userId,
        "status": "awaiting_payment",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc).isoformat()  # Session expires if not paid
    }
    
    # Save payment session to a separate collection (NOT orders)
    await db.payment_sessions.insert_one(payment_session)
    
    # Build response - NO order number yet, only session info for payment
    response = {
        "message": "Payment initiated - complete payment to confirm order",
        "session_id": session_id,
        "payment_pending": True,
        "pricing": payment_session["pricing"]
    }
    
    # Add Razorpay details for payment
    if razorpay_order:
        response["razorpay"] = {
            "keyId": RAZORPAY_KEY_ID,
            "orderId": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "name": "Centsibl Traders Private Limited",
            "description": "Payment for Addrika Order",
            "prefill": {
                "name": billing.name if billing else "",
                "email": billing.email if billing else "",
                "contact": billing.phone if billing else ""
            }
        }
    
    return response


@router.post("/orders/verify-payment")
async def verify_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    session_id: str = None,  # New parameter - session ID
    order_number: str = None,  # Keep for backward compatibility
    background_tasks: BackgroundTasks = None
):
    """
    Verify Razorpay payment and CREATE the actual order.
    Order is ONLY created here after successful payment verification.
    """
    
    # Verify signature
    if not verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    # Find the payment session
    payment_session = await db.payment_sessions.find_one({
        "razorpay_order_id": razorpay_order_id,
        "status": "awaiting_payment"
    })
    
    if not payment_session:
        # Backward compatibility: check if old order exists
        if order_number:
            old_order = await db.orders.find_one({"order_number": order_number})
            if old_order:
                # Handle old flow (legacy support)
                return await _verify_legacy_payment(old_order, razorpay_payment_id, razorpay_signature, background_tasks)
        raise HTTPException(status_code=404, detail="Payment session not found or expired")
    
    # Fetch payment details from Razorpay to get payment method
    payment_mode = "Online"
    try:
        if razorpay_client:
            payment_details = razorpay_client.payment.fetch(razorpay_payment_id)
            method = payment_details.get("method", "").lower()
            if method == "card":
                payment_mode = "CC/DC [Card Payment]"
            elif method == "upi":
                payment_mode = "UPI"
            elif method == "netbanking":
                payment_mode = "Net Banking"
            elif method == "wallet":
                wallet_name = payment_details.get("wallet", "Wallet")
                payment_mode = f"Wallet ({wallet_name.title()})"
            elif method == "emi":
                payment_mode = "EMI"
            elif method == "paylater":
                payment_mode = "Pay Later"
            else:
                payment_mode = method.title() if method else "Online"
    except Exception as e:
        print(f"Failed to fetch payment details from Razorpay: {e}")
    
    # NOW create the actual order with order number
    order_number = generate_order_number()
    
    # Get delivery mode info from payment session
    delivery_mode = payment_session.get("delivery_mode", "shipping")
    is_pickup = delivery_mode == "self_pickup"
    is_pay_at_store = payment_session.get("is_pay_at_store", False)
    pickup_store = payment_session.get("pickup_store")
    assigned_retailer = payment_session.get("assigned_retailer")
    
    order = {
        "order_number": order_number,
        "items": payment_session.get("items", []),
        "billing": payment_session.get("billing", {}),
        "shipping": payment_session.get("shipping", {}),
        "use_different_shipping": payment_session.get("use_different_shipping", False),
        "pricing": payment_session.get("pricing", {}),
        "discount_code": payment_session.get("discount_code"),
        "payment_method": "razorpay",
        "payment_mode": payment_mode,
        "payment_status": "paid",
        "order_status": get_order_status_for_delivery_mode(delivery_mode, is_pay_at_store),
        "gst_info": payment_session.get("gst_info"),
        "razorpay_order_id": razorpay_order_id,
        "razorpay_payment_id": razorpay_payment_id,
        "razorpay_signature": razorpay_signature,
        # Delivery mode fields
        "delivery_mode": delivery_mode,
        "pickup_store": pickup_store,
        "pickup_payment_option": payment_session.get("pickup_payment_option"),
        "pickup_time_slot": payment_session.get("pickup_time_slot"),
        "is_pay_at_store": is_pay_at_store,
        "amount_charged": payment_session.get("amount_charged", 0),
        "balance_at_store": payment_session.get("balance_at_store", 0),
        "assigned_retailer": assigned_retailer,
        # Cart snapshot at payment completion - for admin reference
        "cart_snapshot": {
            "captured_at": datetime.now(timezone.utc).isoformat(),
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
                for item in payment_session.get("items", [])
            ],
            "pricing_breakdown": {
                "mrp_total": payment_session.get("pricing", {}).get("mrp_total", 0),
                "subtotal": payment_session.get("pricing", {}).get("subtotal", 0),
                "bulk_discount": payment_session.get("pricing", {}).get("bulk_discount", 0),
                "coupon_discount": payment_session.get("pricing", {}).get("coupon_discount", 0),
                "coupon_code": payment_session.get("pricing", {}).get("coupon_code"),
                "coin_discount": payment_session.get("pricing", {}).get("coin_discount", 0),
                "coins_redeemed": payment_session.get("pricing", {}).get("coins_redeemed", 0),
                "shipping_charge": payment_session.get("pricing", {}).get("shipping", 0),
                "final_total": payment_session.get("pricing", {}).get("final_total", 0)
            },
            "payment_info": {
                "method": "razorpay",
                "mode": payment_mode,
                "amount_charged": payment_session.get("amount_charged", 0),
                "balance_at_store": payment_session.get("balance_at_store", 0)
            }
        },
        # Coin redemption data
        "coin_redemption": payment_session.get("coin_redemption"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if payment_session.get("user_id"):
        order["user_id"] = payment_session["user_id"]
    
    # Insert the actual order into the orders collection
    result = await db.orders.insert_one(order)
    order["_id"] = result.inserted_id
    
    # Mark payment session as completed
    await db.payment_sessions.update_one(
        {"_id": payment_session["_id"]},
        {
            "$set": {
                "status": "completed",
                "order_number": order_number,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update discount code usage after successful payment
    if payment_session.get("discount_code"):
        await db.discount_codes.update_one(
            {"code": payment_session["discount_code"].upper()},
            {"$inc": {"times_used": 1}}
        )
    
    # ============================================================================
    # MARK RTO VOUCHER AS CLAIMED (if used)
    # ============================================================================
    if payment_session.get("rto_voucher_id") or payment_session.get("voucher_type") == "rto_voucher":
        try:
            rto_voucher_code = payment_session.get("discount_code", "").upper()
            if rto_voucher_code:
                update_result = await db.rto_vouchers.update_one(
                    {"voucher_code": rto_voucher_code, "status": "active"},
                    {
                        "$set": {
                            "status": "claimed",
                            "claimed_at": datetime.now(timezone.utc).isoformat(),
                            "claimed_order_number": order_number
                        }
                    }
                )
                if update_result.modified_count > 0:
                    logger.info(f"RTO voucher {rto_voucher_code} marked as claimed for order {order_number}")
        except Exception as e:
            logger.error(f"Error marking RTO voucher as claimed: {e}")
    
    # ============================================================================
    # DEBIT COINS IF USER REDEEMED COINS FOR THIS ORDER
    # ============================================================================
    coin_debit_result = None
    if payment_session.get("coin_redemption") and payment_session.get("user_id"):
        try:
            from routers.rewards import debit_coins_for_redemption
            
            coins_to_debit = payment_session["coin_redemption"].get("coins_to_redeem", 0)
            user_email = payment_session.get("billing", {}).get("email") or payment_session.get("shipping", {}).get("email")
            
            if coins_to_debit > 0 and user_email:
                coin_debit_result = await debit_coins_for_redemption(
                    user_id=payment_session["user_id"],
                    email=user_email,
                    order_number=order_number,
                    coins_to_debit=coins_to_debit
                )
                
                if coin_debit_result.get("success"):
                    logger.info(f"Debited {coins_to_debit} coins from user {payment_session['user_id']} for order {order_number}")
                else:
                    logger.error(f"Failed to debit coins for order {order_number}: {coin_debit_result.get('error')}")
        except Exception as e:
            logger.error(f"Error debiting coins for order {order_number}: {e}")
    
    # Send order confirmation email
    try:
        email_order = {
            "orderNumber": order_number,
            "items": order.get("items", []),
            "subtotal": order.get("pricing", {}).get("subtotal", 0),
            "bulkDiscount": order.get("pricing", {}).get("bulk_discount", 0),
            "codeDiscount": order.get("pricing", {}).get("coupon_discount", 0),
            "shippingCharge": order.get("pricing", {}).get("shipping", 0),
            "total": order.get("pricing", {}).get("final_total", 0),
            "shipping": order.get("shipping", {}),
            "paymentStatus": "paid",
            "paymentMode": payment_mode
        }
        if background_tasks:
            background_tasks.add_task(send_order_confirmation, email_order)
    except Exception as e:
        print(f"Failed to queue confirmation email: {e}")
    
    # ============================================================================
    # SEND RETAILER NOTIFICATION EMAIL
    # For self-pickup: notify pickup store to verify stock
    # For shipping: notify assigned retailer for fulfillment
    # ============================================================================
    try:
        from services.retailer_emails import send_retailer_order_notification, send_pickup_confirmation_to_customer
        
        pickup_time_slot = order.get("pickup_time_slot", "Not specified")
        
        retailer_order_data = {
            "orderNumber": order_number,
            "order_date": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M"),
            "shipping": order.get("shipping", {}),
            "billing": order.get("billing", {}),
            "total": order.get("pricing", {}).get("final_total", 0),
            "payment_type": "Fully Paid Online",  # Token payment disabled
            "balance_at_store": order.get("balance_at_store", 0),
            "pickup_time_slot": pickup_time_slot
        }
        items_list = order.get("items", [])
        
        if is_pickup and pickup_store:
            # DISABLED: Auto-email to retailers - handled manually by admin
            # retailer_email = pickup_store.get("email")
            # if retailer_email:
            #     if background_tasks:
            #         background_tasks.add_task(
            #             send_retailer_order_notification,
            #             retailer_email,
            #             retailer_order_data,
            #             True,  # is_pickup
            #             items_list
            #         )
            
            # Send pickup confirmation to customer (keep this)
            customer_email = order.get("billing", {}).get("email") or order.get("shipping", {}).get("email")
            if customer_email and background_tasks:
                background_tasks.add_task(
                    send_pickup_confirmation_to_customer,
                    customer_email,
                    retailer_order_data,
                    pickup_store
                )
            logger.info(f"Pickup order created. Retailer email DISABLED - admin will handle manually")
            
            # ============================================================
            # GENERATE STORE PICKUP OTP
            # Customer will receive OTP to show at store for pickup
            # ============================================================
            try:
                from routers.store_pickup import create_pickup_otp
                
                customer_email = order.get("billing", {}).get("email") or order.get("shipping", {}).get("email")
                customer_phone = order.get("billing", {}).get("phone") or order.get("shipping", {}).get("phone", "")
                retailer_id = pickup_store.get("id") or pickup_store.get("retailer_id", "")
                retailer_name = pickup_store.get("name", "Addrika Store")
                balance_amount = order.get("balance_at_store", 0)
                
                otp_result = await create_pickup_otp(
                    order_number=order_number,
                    customer_email=customer_email,
                    customer_phone=customer_phone,
                    retailer_id=str(retailer_id),
                    retailer_name=retailer_name,
                    balance_amount=balance_amount,
                    send_notification=True,
                    background_tasks=background_tasks
                )
                
                if otp_result.get("success"):
                    # Store OTP code in order for reference
                    await db.orders.update_one(
                        {"order_number": order_number},
                        {"$set": {"pickup_otp_code": otp_result.get("otp_code")}}
                    )
                    logger.info(f"Pickup OTP generated for order {order_number}")
                else:
                    logger.error(f"Failed to generate pickup OTP: {otp_result.get('error')}")
            except Exception as e:
                logger.error(f"Error generating pickup OTP for {order_number}: {e}")
        
        elif assigned_retailer:
            # DISABLED: Auto-email to retailers for shipping - handled manually by admin
            # retailer_email = assigned_retailer.get("retailer_email")
            # if retailer_email:
            #     if background_tasks:
            #         background_tasks.add_task(
            #             send_retailer_order_notification,
            #             retailer_email,
            #             retailer_order_data,
            #             False,  # is_pickup
            #             items_list
            #         )
            logger.info(f"Shipping order created. Retailer: {assigned_retailer.get('retailer_name')} - Email DISABLED, admin will handle manually")
        
        # ============================================================
        # SEND ADMIN NOTIFICATION - Order Routed to Retailer
        # Admin receives email with customer + retailer details
        # ============================================================
        try:
            from routers.store_pickup import send_admin_order_routed_email
            
            retailer_info = pickup_store if is_pickup else assigned_retailer
            if retailer_info and background_tasks:
                background_tasks.add_task(
                    send_admin_order_routed_email,
                    order,
                    retailer_info,
                    is_pickup
                )
                logger.info(f"Admin notification queued for order {order_number}")
        except Exception as e:
            logger.error(f"Failed to queue admin notification: {e}")
                
    except Exception as e:
        logger.error(f"Failed to send retailer notification: {e}")
    
    # Push order to ShipRocket for fulfillment
    shiprocket_result = None
    try:
        shiprocket_result = await push_order_to_shiprocket(order)
        
        if shiprocket_result and shiprocket_result.get("success"):
            await db.orders.update_one(
                {"order_number": order_number},
                {
                    "$set": {
                        "shiprocket_order_id": shiprocket_result.get("order_id"),
                        "shiprocket_shipment_id": shiprocket_result.get("shipment_id"),
                        "shiprocket_awb_code": shiprocket_result.get("awb_code"),
                        "shiprocket_courier": shiprocket_result.get("courier_name"),
                        "shiprocket_synced_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            logger.info(f"Order {order_number} synced to ShipRocket: order_id={shiprocket_result.get('order_id')}")
        else:
            logger.warning(f"ShipRocket sync failed for {order_number}: {shiprocket_result.get('error') if shiprocket_result else 'Unknown error'}")
    except Exception as e:
        logger.error(f"Failed to push order to ShipRocket: {e}")
    
    # ============================================================================
    # CREDIT REWARD COINS TO USER
    # Coins earned based on amount paid (excluding shipping and coins redeemed)
    # No coins for ₹11 token payments
    # ============================================================================
    coins_result = None
    try:
        from routers.rewards import credit_coins_for_order
        from services.email_service import send_coins_earned_email
        
        user_id = payment_session.get("user_id")
        user_email = order.get("billing", {}).get("email") or order.get("shipping", {}).get("email")
        amount_paid = payment_session.get("amount_charged", 0)
        shipping_charge = order.get("pricing", {}).get("shipping", 0)
        coins_redeemed_value = payment_session.get("coins_redeemed_value", 0)
        
        if user_id and user_email:
            coins_result = await credit_coins_for_order(
                user_id=user_id,
                email=user_email,
                order_number=order_number,
                amount_paid=amount_paid,
                shipping_charge=shipping_charge,
                coins_redeemed_value=coins_redeemed_value,
                is_token_payment=is_pay_at_store
            )
            
            # Send coins earned email if coins were credited
            if coins_result and coins_result.get("coins_earned", 0) > 0:
                customer_name = order.get("billing", {}).get("name") or order.get("shipping", {}).get("name") or "Customer"
                if background_tasks:
                    background_tasks.add_task(
                        send_coins_earned_email,
                        user_email,
                        customer_name,
                        coins_result["coins_earned"],
                        coins_result["new_balance"],
                        order_number
                    )
                logger.info(f"Credited {coins_result['coins_earned']} coins to user {user_id} for order {order_number}")
    except Exception as e:
        logger.error(f"Failed to credit coins for order {order_number}: {e}")
    
    response = {
        "success": True,
        "message": "Payment verified and order created successfully",
        "order_number": order_number,
        "payment_id": razorpay_payment_id,
        "payment_mode": payment_mode
    }
    
    if shiprocket_result:
        response["shiprocket"] = {
            "synced": shiprocket_result.get("success", False),
            "order_id": shiprocket_result.get("order_id"),
            "message": shiprocket_result.get("message") or shiprocket_result.get("error")
        }
    
    if coins_result and coins_result.get("coins_earned", 0) > 0:
        response["rewards"] = {
            "coins_earned": coins_result["coins_earned"],
            "new_balance": coins_result["new_balance"]
        }
    
    return response


async def _verify_legacy_payment(order: dict, razorpay_payment_id: str, razorpay_signature: str, background_tasks):
    """Handle legacy orders that were created before payment (backward compatibility)"""
    order_number = order.get("order_number")
    
    # Fetch payment mode
    payment_mode = "Online"
    try:
        if razorpay_client:
            payment_details = razorpay_client.payment.fetch(razorpay_payment_id)
            method = payment_details.get("method", "").lower()
            if method == "card":
                payment_mode = "CC/DC [Card Payment]"
            elif method == "upi":
                payment_mode = "UPI"
            elif method == "netbanking":
                payment_mode = "Net Banking"
            elif method == "wallet":
                payment_mode = f"Wallet ({payment_details.get('wallet', 'Wallet').title()})"
            else:
                payment_mode = method.title() if method else "Online"
    except Exception:
        pass
    
    await db.orders.update_one(
        {"order_number": order_number},
        {
            "$set": {
                "payment_status": "paid",
                "order_status": "confirmed",
                "payment_mode": payment_mode,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Payment verified successfully (legacy)",
        "order_number": order_number,
        "payment_id": razorpay_payment_id,
        "payment_mode": payment_mode
    }


@router.get("/orders/track")
async def track_order(order_number: str, email: str):
    """Track order by order number and email"""
    order = await db.orders.find_one({
        "order_number": order_number,
        "shipping.email": email.lower()
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    pricing = order.get("pricing", {})
    
    return {
        "order": {
            "orderNumber": order["order_number"],
            "order_number": order["order_number"],
            "orderStatus": order.get("order_status", "pending"),
            "order_status": order.get("order_status", "pending"),
            "paymentStatus": order.get("payment_status", "pending"),
            "payment_status": order.get("payment_status", "pending"),
            "paymentMethod": order.get("payment_method", "razorpay"),
            "paymentMode": order.get("payment_mode", "Online"),
            "items": order.get("items", []),
            "shipping": order.get("shipping", {}),
            "billing": order.get("billing", {}),
            "pricing": pricing,
            "total": pricing.get("final_total", 0),
            "subtotal": pricing.get("subtotal", 0),
            "shippingDetails": order.get("shipping_details"),  # Carrier & tracking info
            "shipping_details": order.get("shipping_details"),
            "rto_voucher_code": order.get("rto_voucher_code"),  # RTO voucher if applicable
            # Store pickup fields
            "delivery_mode": order.get("delivery_mode", "shipping"),
            "pickup_store": order.get("pickup_store"),
            "pickup_otp_code": order.get("pickup_otp_code"),
            "balance_at_store": order.get("balance_at_store", 0),
            "pickup_time_slot": order.get("pickup_time_slot"),
            "createdAt": order.get("created_at"),
            "created_at": order.get("created_at"),
            "updatedAt": order.get("updated_at"),
            "updated_at": order.get("updated_at")
        }
    }


@router.get("/user/orders")
async def get_user_orders(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get orders for authenticated user"""
    user = await get_current_user(request, session_token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    orders = await db.orders.find({
        "$or": [
            {"user_id": user['user_id']},
            {"shipping.email": user['email'].lower()}
        ]
    }).sort("created_at", -1).to_list(100)
    
    # Format orders with proper field mapping
    formatted_orders = []
    for o in orders:
        pricing = o.get("pricing", {})
        formatted_orders.append({
            "id": str(o.get("_id", "")),
            "orderNumber": o.get("order_number"),
            "order_number": o.get("order_number"),
            "orderStatus": o.get("order_status", "pending"),
            "order_status": o.get("order_status", "pending"),
            "paymentStatus": o.get("payment_status", "pending"),
            "payment_status": o.get("payment_status", "pending"),
            "paymentMode": o.get("payment_mode", "Online"),
            "items": o.get("items", []),
            "pricing": pricing,
            "subtotal": pricing.get("subtotal", 0),
            "bulkDiscount": pricing.get("bulk_discount", 0),
            "couponDiscount": pricing.get("coupon_discount", 0),
            "shippingCharge": pricing.get("shipping", 0),
            "total": pricing.get("final_total", 0),
            "discountCode": o.get("discount_code"),
            "shipping": o.get("shipping", {}),
            "billing": o.get("billing", {}),
            "shippingDetails": o.get("shipping_details"),  # Carrier & tracking
            "createdAt": o.get("created_at"),
            "created_at": o.get("created_at"),
            "updatedAt": o.get("updated_at"),
            "updated_at": o.get("updated_at")
        })
    
    return {"orders": formatted_orders}


@router.get("/user/saved-details")
async def get_user_saved_details(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get user's saved shipping details"""
    user = await get_current_user(request, session_token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    last_order = await db.orders.find_one(
        {
            "$or": [
                {"user_id": user['user_id']},
                {"shipping.email": user['email'].lower()}
            ],
            "shipping": {"$exists": True},
            "dont_use_for_prefill": {"$ne": True}
        },
        sort=[("created_at", -1)]
    )
    
    if not last_order or not last_order.get("shipping"):
        return {"saved_details": None}
    
    shipping = last_order["shipping"]
    return {
        "saved_details": {
            "salutation": shipping.get("salutation", ""),
            "name": shipping.get("name", ""),
            "email": shipping.get("email", user.get("email", "")),
            "phone": shipping.get("phone", ""),
            "address": shipping.get("address", ""),
            "city": shipping.get("city", ""),
            "state": shipping.get("state", ""),
            "pincode": shipping.get("pincode", "")
        }
    }


# ===================== Post-Order Address Update =====================

from pydantic import BaseModel as PydanticBaseModel, Field as PydanticField

class AddressUpdateRequest(PydanticBaseModel):
    name: str = PydanticField(..., min_length=2, max_length=100)
    phone: str = PydanticField(..., min_length=10, max_length=15)
    address: str = PydanticField(..., min_length=5, max_length=300)
    city: str = PydanticField(..., min_length=2, max_length=100)
    state: str = PydanticField(..., min_length=2, max_length=100)
    pincode: str = PydanticField(..., pattern=r'^\d{6}$')
    reason: Optional[str] = PydanticField(None, max_length=200, description="Reason for address change")


@router.put("/orders/{order_number}/update-address")
async def update_order_address(
    order_number: str,
    address_data: AddressUpdateRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Update shipping address for an order after placement.
    - Only allowed for shipping orders (not self-pickup)
    - Only allowed before order is shipped
    - Notifies assigned retailer of the change
    - Logs all changes for audit trail
    """
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find the order
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify ownership
    if order.get('user_id') != user['user_id'] and order.get('billing', {}).get('email', '').lower() != user.get('email', '').lower():
        raise HTTPException(status_code=403, detail="You don't have permission to modify this order")
    
    # Check if it's a self-pickup order
    if order.get('delivery_mode') == 'self-pickup':
        raise HTTPException(
            status_code=400, 
            detail="Address cannot be changed for self-pickup orders. Please contact the store directly."
        )
    
    # Check order status - only allow changes before shipping
    status = order.get('order_status', '').lower()
    if status in ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto', 'rto_delivered']:
        raise HTTPException(
            status_code=400, 
            detail=f"Address cannot be changed. Order is already '{status}'."
        )
    
    # Get old address for comparison
    old_shipping = order.get('shipping', {})
    now = datetime.now(timezone.utc).isoformat()
    
    # CRITICAL: PIN code cannot be changed (affects shipping charges and retailer assignment)
    old_pincode = old_shipping.get('pincode', '').strip()
    new_pincode = address_data.pincode.strip() if address_data.pincode else ''
    
    if old_pincode and new_pincode and old_pincode != new_pincode:
        raise HTTPException(
            status_code=400,
            detail="PIN code cannot be changed after order placement. Shipping charges and retailer assignment are based on the original delivery PIN code. Please contact support if you need to change the delivery area."
        )
    
    # If PIN code matches, use the original city and state (ignore any changes)
    final_city = old_shipping.get('city', address_data.city)
    final_state = old_shipping.get('state', address_data.state)
    final_pincode = old_pincode or new_pincode
    
    # Create address change log entry
    change_log = {
        "changed_at": now,
        "changed_by": user['user_id'],
        "changed_by_email": user.get('email'),
        "reason": address_data.reason or "Not specified",
        "old_address": {
            "name": old_shipping.get('name'),
            "phone": old_shipping.get('phone'),
            "address": old_shipping.get('address'),
            "city": old_shipping.get('city'),
            "state": old_shipping.get('state'),
            "pincode": old_shipping.get('pincode')
        },
        "new_address": {
            "name": address_data.name,
            "phone": address_data.phone,
            "address": address_data.address,
            "city": final_city,  # Use original city
            "state": final_state,  # Use original state
            "pincode": final_pincode  # Use original pincode
        }
    }
    
    # Update the shipping address
    update_result = await db.orders.update_one(
        {"order_number": order_number},
        {
            "$set": {
                "shipping.name": address_data.name,
                "shipping.phone": address_data.phone,
                "shipping.address": address_data.address,
                "shipping.city": final_city,  # Keep original city
                "shipping.state": final_state,  # Keep original state
                "shipping.pincode": final_pincode,  # Keep original pincode
                "updated_at": now,
                "address_modified": True,
                "address_modified_at": now
            },
            "$push": {
                "address_change_history": change_log
            }
        }
    )
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update address")
    
    # Get assigned retailer and send notification
    assigned_retailer = order.get('assigned_retailer')
    customer_email = user.get('email') or order.get('billing', {}).get('email')
    customer_name = user.get('name') or order.get('billing', {}).get('name') or 'Customer'
    
    # Send retailer notification
    if assigned_retailer:
        background_tasks.add_task(
            send_retailer_address_change_notification,
            order_number=order_number,
            retailer=assigned_retailer,
            old_address=old_shipping,
            new_address=address_data.dict(),
            customer_email=customer_email,
            items=order.get('items', [])
        )
    
    # Send admin notification
    background_tasks.add_task(
        send_admin_address_change_notification,
        order_number=order_number,
        old_address=old_shipping,
        new_address=address_data.dict(),
        customer_email=customer_email,
        customer_name=customer_name,
        assigned_retailer=assigned_retailer,
        items=order.get('items', []),
        reason=address_data.reason
    )
    
    # Send customer confirmation email
    background_tasks.add_task(
        send_customer_address_change_confirmation,
        order_number=order_number,
        old_address=old_shipping,
        new_address=address_data.dict(),
        customer_email=customer_email,
        customer_name=customer_name,
        assigned_retailer=assigned_retailer
    )
    
    # Log to admin events
    await db.admin_events.insert_one({
        "event_type": "order_address_change",
        "order_number": order_number,
        "user_id": user['user_id'],
        "user_email": user.get('email'),
        "change_log": change_log,
        "assigned_retailer": assigned_retailer.get('name') if assigned_retailer else None,
        "created_at": now,
        "notifications_sent": {
            "retailer": bool(assigned_retailer),
            "admin": True,
            "customer": bool(customer_email)
        }
    })
    
    return {
        "message": "Shipping address updated successfully",
        "order_number": order_number,
        "new_address": {
            "name": address_data.name,
            "phone": address_data.phone,
            "address": address_data.address,
            "city": address_data.city,
            "state": address_data.state,
            "pincode": address_data.pincode
        },
        "notifications": {
            "retailer_notified": bool(assigned_retailer),
            "admin_notified": True,
            "customer_notified": bool(customer_email)
        }
    }


async def send_retailer_address_change_notification(
    order_number: str,
    retailer: dict,
    old_address: dict,
    new_address: dict,
    customer_email: str,
    items: list
):
    """Send email to retailer about address change"""
    try:
        from services.email_service import resend_client
        
        if not resend_client:
            logger.warning("Resend client not available for retailer notification")
            return
        
        retailer_email = retailer.get('email')
        retailer_name = retailer.get('name', 'Retailer')
        
        if not retailer_email:
            logger.warning(f"No email found for retailer: {retailer_name}")
            return
        
        # Format items
        items_html = ""
        for item in items:
            items_html += f"<li>{item.get('name')} ({item.get('size')}) x {item.get('quantity')}</li>"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d, #2d3748); padding: 20px; text-align: center;">
                <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                <p style="color: #fff; margin: 5px 0 0;">Address Change Alert</p>
            </div>
            
            <div style="padding: 20px; background: #f7fafc;">
                <p>Dear {retailer_name},</p>
                
                <p><strong style="color: #e53e3e;">IMPORTANT:</strong> The shipping address for order <strong>#{order_number}</strong> has been updated by the customer.</p>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #e53e3e; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #e53e3e;">OLD ADDRESS (Do Not Use)</h3>
                    <p style="margin: 5px 0;">{old_address.get('name', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('city', '')}, {old_address.get('state', '')} - {old_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;">Phone: {old_address.get('phone', 'N/A')}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #38a169; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #38a169;">NEW ADDRESS (Use This)</h3>
                    <p style="margin: 5px 0;"><strong>{new_address.get('name', 'N/A')}</strong></p>
                    <p style="margin: 5px 0;">{new_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{new_address.get('city', '')}, {new_address.get('state', '')} - {new_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;"><strong>Phone: {new_address.get('phone', 'N/A')}</strong></p>
                </div>
                
                <div style="background: #fff; padding: 15px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">Order Items:</h4>
                    <ul>{items_html}</ul>
                </div>
                
                <p><strong>Please update your records immediately</strong> and ensure the order is shipped to the new address.</p>
                
                <p style="color: #718096; font-size: 12px;">
                    Customer: {customer_email}<br>
                    Changed at: {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')} UTC
                </p>
            </div>
            
            <div style="background: #1a365d; padding: 15px; text-align: center;">
                <p style="color: #d4af37; margin: 0; font-size: 12px;">Addrika - Elegance in Every Scent</p>
            </div>
        </div>
        """
        
        resend_client.emails.send({
            "from": "Addrika Orders <orders@addrika.in>",
            "to": [retailer_email],
            "subject": f"ADDRESS CHANGE - Order #{order_number}",
            "html": html_content
        })
        
        logger.info(f"Sent address change notification to retailer {retailer_name} for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send retailer address change notification: {str(e)}")


async def send_admin_address_change_notification(
    order_number: str,
    old_address: dict,
    new_address: dict,
    customer_email: str,
    customer_name: str,
    assigned_retailer: dict,
    items: list,
    reason: str
):
    """Send email to admin about address change"""
    try:
        from services.email_service import resend_client
        from dependencies import ADMIN_EMAIL
        
        if not resend_client:
            logger.warning("Resend client not available for admin notification")
            return
        
        retailer_name = assigned_retailer.get('name', 'Not Assigned') if assigned_retailer else 'Not Assigned'
        retailer_email = assigned_retailer.get('email', 'N/A') if assigned_retailer else 'N/A'
        
        # Format items
        items_html = ""
        for item in items:
            items_html += f"<li>{item.get('name')} ({item.get('size')}) x {item.get('quantity')}</li>"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d, #2d3748); padding: 20px; text-align: center;">
                <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                <p style="color: #fff; margin: 5px 0 0;">Admin Alert - Address Change</p>
            </div>
            
            <div style="padding: 20px; background: #f7fafc;">
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #c53030; font-weight: bold;">
                        ⚠️ ADDRESS CHANGE NOTIFICATION
                    </p>
                    <p style="margin: 5px 0 0; color: #742a2a;">
                        A customer has modified their shipping address for Order #{order_number}
                    </p>
                </div>
                
                <h3 style="margin-top: 0;">Customer Information</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> {customer_name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {customer_email}</p>
                <p style="margin: 5px 0;"><strong>Reason:</strong> {reason or 'Not specified'}</p>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #e53e3e; margin: 15px 0;">
                    <h4 style="margin-top: 0; color: #e53e3e;">PREVIOUS ADDRESS (At Payment)</h4>
                    <p style="margin: 5px 0;">{old_address.get('name', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('city', '')}, {old_address.get('state', '')} - {old_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;">Phone: {old_address.get('phone', 'N/A')}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #38a169; margin: 15px 0;">
                    <h4 style="margin-top: 0; color: #38a169;">NEW ADDRESS (Updated)</h4>
                    <p style="margin: 5px 0;"><strong>{new_address.get('name', 'N/A')}</strong></p>
                    <p style="margin: 5px 0;">{new_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{new_address.get('city', '')}, {new_address.get('state', '')} - {new_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;"><strong>Phone: {new_address.get('phone', 'N/A')}</strong></p>
                </div>
                
                <div style="background: #fff; padding: 15px; margin: 15px 0; border: 1px solid #e2e8f0;">
                    <h4 style="margin-top: 0;">Assigned Store</h4>
                    <p style="margin: 5px 0;"><strong>Name:</strong> {retailer_name}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> {retailer_email}</p>
                    <p style="margin: 5px 0; color: #38a169;">✓ Store has been notified of this change</p>
                </div>
                
                <div style="background: #fff; padding: 15px; margin: 15px 0;">
                    <h4 style="margin-top: 0;">Order Items:</h4>
                    <ul>{items_html}</ul>
                </div>
                
                <p style="color: #718096; font-size: 12px;">
                    Changed at: {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')} UTC
                </p>
            </div>
            
            <div style="background: #1a365d; padding: 15px; text-align: center;">
                <p style="color: #d4af37; margin: 0; font-size: 12px;">Addrika Admin Portal</p>
            </div>
        </div>
        """
        
        resend_client.emails.send({
            "from": "Addrika System <system@addrika.in>",
            "to": [ADMIN_EMAIL],
            "subject": f"⚠️ ADDRESS CHANGE - Order #{order_number}",
            "html": html_content
        })
        
        logger.info(f"Sent address change notification to admin for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send admin address change notification: {str(e)}")


async def send_customer_address_change_confirmation(
    order_number: str,
    old_address: dict,
    new_address: dict,
    customer_email: str,
    customer_name: str,
    assigned_retailer: dict
):
    """Send confirmation email to customer about their address change"""
    try:
        from services.email_service import resend_client
        
        if not resend_client:
            logger.warning("Resend client not available for customer notification")
            return
        
        if not customer_email:
            logger.warning(f"No customer email for order {order_number}")
            return
        
        retailer_name = assigned_retailer.get('name', 'Our Partner Store') if assigned_retailer else 'Our Partner Store'
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d, #2d3748); padding: 20px; text-align: center;">
                <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                <p style="color: #fff; margin: 5px 0 0;">Address Change Confirmation</p>
            </div>
            
            <div style="padding: 20px; background: #f7fafc;">
                <p>Dear {customer_name},</p>
                
                <p>This email confirms that your shipping address for <strong>Order #{order_number}</strong> has been successfully updated.</p>
                
                <div style="background: #c6f6d5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0; color: #276749; font-weight: bold;">
                        ✓ Address Updated Successfully
                    </p>
                </div>
                
                <h3 style="margin-bottom: 10px;">Address Details</h3>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #e53e3e; margin: 15px 0;">
                    <h4 style="margin-top: 0; color: #e53e3e;">Previous Address (Captured At Payment)</h4>
                    <p style="margin: 5px 0;">{old_address.get('name', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{old_address.get('city', '')}, {old_address.get('state', '')} - {old_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;">Phone: {old_address.get('phone', 'N/A')}</p>
                </div>
                
                <div style="background: #fff; padding: 15px; border-left: 4px solid #38a169; margin: 15px 0;">
                    <h4 style="margin-top: 0; color: #38a169;">New Address (Your Updated Address)</h4>
                    <p style="margin: 5px 0;"><strong>{new_address.get('name', 'N/A')}</strong></p>
                    <p style="margin: 5px 0;">{new_address.get('address', 'N/A')}</p>
                    <p style="margin: 5px 0;">{new_address.get('city', '')}, {new_address.get('state', '')} - {new_address.get('pincode', '')}</p>
                    <p style="margin: 5px 0;"><strong>Phone: {new_address.get('phone', 'N/A')}</strong></p>
                </div>
                
                <div style="background: #ebf8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #90cdf4;">
                    <h4 style="margin-top: 0; color: #2b6cb0;">📢 Notification Status</h4>
                    <p style="margin: 5px 0; color: #2c5282;">
                        The following parties have been notified of your address change:
                    </p>
                    <ul style="margin: 10px 0; color: #2c5282;">
                        <li>✓ <strong>Addrika Admin Team</strong> - For record keeping and quality assurance</li>
                        <li>✓ <strong>{retailer_name}</strong> - The store handling your order</li>
                    </ul>
                    <p style="margin: 5px 0; color: #2c5282; font-size: 13px;">
                        Your order will be shipped to your new address. No further action is required from your end.
                    </p>
                </div>
                
                <p style="color: #718096; font-size: 13px;">
                    If you did not make this change or have any concerns, please contact us immediately at 
                    <a href="mailto:support@addrika.in" style="color: #d4af37;">support@addrika.in</a>
                </p>
                
                <p style="color: #718096; font-size: 12px; margin-top: 20px;">
                    Changed at: {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')} UTC
                </p>
            </div>
            
            <div style="background: #1a365d; padding: 15px; text-align: center;">
                <p style="color: #d4af37; margin: 0; font-size: 12px;">Addrika - Elegance in Every Scent</p>
                <p style="color: #a0aec0; margin: 5px 0 0; font-size: 11px;">
                    Thank you for shopping with us!
                </p>
            </div>
        </div>
        """
        
        resend_client.emails.send({
            "from": "Addrika <orders@addrika.in>",
            "to": [customer_email],
            "subject": f"✓ Address Updated - Order #{order_number}",
            "html": html_content
        })
        
        logger.info(f"Sent address change confirmation to customer {customer_email} for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send customer address change confirmation: {str(e)}")
