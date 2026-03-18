"""
B2B Wholesale Ordering System for Retailers
Handles bulk ordering with special retailer pricing
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import uuid
import logging

from dependencies import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-dashboard/b2b", tags=["B2B Orders"])

# ============================================================================
# B2B Product Catalog with Wholesale Pricing
# ============================================================================

# B2B Price is 76.52% of MRP
B2B_DISCOUNT_RATE = 0.7652

# B2B Products with box pricing
# Each box contains a fixed number of units
# Prices calculated as: units_per_box * mrp_per_unit * 0.7652

def calculate_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B box price at 76.52% of MRP"""
    return round(units_per_box * mrp_per_unit * B2B_DISCOUNT_RATE)

def calculate_half_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B half-box price at 76.52% of MRP"""
    return round((units_per_box / 2) * mrp_per_unit * B2B_DISCOUNT_RATE)

B2B_PRODUCTS = [
    {
        "id": "kesar-chandan-b2b",
        "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),  # 12 * 110 * 0.7652 = 1010
        "price_per_half_box": calculate_half_box_price(12, 110),  # 6 * 110 * 0.7652 = 505
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "kesar-chandan-200-b2b",
        "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),  # 16 * 402 * 0.7652 = 4922
        "price_per_half_box": calculate_half_box_price(16, 402),  # 8 * 402 * 0.7652 = 2461
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "regal-rose-b2b",
        "product_id": "regal-rose",
        "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "regal-rose-200-b2b",
        "product_id": "regal-rose",
        "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "oriental-oudh-b2b",
        "product_id": "oriental-oudh",
        "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "oriental-oudh-200-b2b",
        "product_id": "oriental-oudh",
        "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "bold-bakhoor-b2b",
        "product_id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "bold-bakhoor-200-b2b",
        "product_id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "mogra-magic-b2b",
        "product_id": "mogra-magic",
        "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    },
    {
        "id": "mogra-magic-200-b2b",
        "product_id": "mogra-magic",
        "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900"
    }
]

# Cash discount percentage for online payment
CASH_DISCOUNT_PERCENT = 2

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


def calculate_line_total(quantity_boxes: float, price_per_box: float, price_per_half_box: float) -> float:
    """Calculate line total for a given quantity of boxes"""
    full_boxes = int(quantity_boxes)
    half_boxes = (quantity_boxes - full_boxes) * 2  # 0.5 becomes 1 half box
    
    total = (full_boxes * price_per_box) + (half_boxes * price_per_half_box)
    return round(total, 2)


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/catalog")
async def get_b2b_catalog(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get B2B product catalog with wholesale pricing"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "products": B2B_PRODUCTS,
        "cash_discount_percent": CASH_DISCOUNT_PERCENT,
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


async def validate_retailer_voucher(voucher_code: str, retailer_id: str, order_subtotal: float):
    """Validate and get retailer voucher details"""
    voucher = await db.retailer_vouchers.find_one({
        "code": voucher_code.upper(),
        "is_active": True,
        "$or": [
            {"retailer_id": retailer_id},
            {"retailer_id": None}  # Global retailer vouchers
        ]
    })
    
    if not voucher:
        return None, "Invalid or expired voucher code"
    
    # Check expiry
    if voucher.get("expires_at"):
        expiry = datetime.fromisoformat(voucher["expires_at"])
        if expiry < datetime.now(timezone.utc):
            return None, "Voucher has expired"
    
    # Check usage limit
    if voucher.get("max_uses") and voucher.get("used_count", 0) >= voucher["max_uses"]:
        return None, "Voucher usage limit reached"
    
    # Check minimum order
    if voucher.get("min_order") and order_subtotal < voucher["min_order"]:
        return None, f"Minimum order of ₹{voucher['min_order']} required"
    
    # Calculate discount
    discount_amount = 0
    if voucher.get("discount_type") == "percentage":
        discount_amount = order_subtotal * voucher["discount_value"] / 100
        if voucher.get("max_discount"):
            discount_amount = min(discount_amount, voucher["max_discount"])
    else:  # fixed
        discount_amount = voucher["discount_value"]
    
    return {
        "voucher_id": voucher.get("id"),
        "code": voucher["code"],
        "discount_type": voucher["discount_type"],
        "discount_value": voucher["discount_value"],
        "discount_amount": round(discount_amount, 2)
    }, None


async def validate_credit_note(cn_code: str, retailer_id: str):
    """Validate and get credit note details"""
    credit_note = await db.credit_notes.find_one({
        "code": cn_code.upper(),
        "retailer_id": retailer_id,
        "status": "active"
    })
    
    if not credit_note:
        return None, "Invalid or already used credit note"
    
    # Check expiry (45 days from creation, excluding creation date)
    expiry = datetime.fromisoformat(credit_note["expires_at"])
    if expiry < datetime.now(timezone.utc):
        return None, "Credit note has expired"
    
    return {
        "cn_id": credit_note.get("id"),
        "code": credit_note["code"],
        "amount": credit_note["amount"],
        "balance": credit_note.get("balance", credit_note["amount"])
    }, None


@router.post("/calculate")
async def calculate_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Calculate B2B order totals without placing the order"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not order_data.items or len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="No items in order")
    
    # Build order items
    order_items = []
    subtotal = 0
    total_gst = 0
    
    for item in order_data.items:
        if item.quantity_boxes <= 0:
            continue
        
        # Validate quantity is in 0.5 increments
        if (item.quantity_boxes * 2) % 1 != 0:
            raise HTTPException(
                status_code=400, 
                detail="Quantity must be in multiples of 0.5 boxes"
            )
        
        # Find product
        product = next((p for p in B2B_PRODUCTS if p["id"] == item.product_id), None)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Calculate line total
        line_total = calculate_line_total(
            item.quantity_boxes,
            product["price_per_box"],
            product["price_per_half_box"]
        )
        
        # Calculate GST for this line
        gst_rate = product.get("gst_rate", 18)
        line_gst = round(line_total * gst_rate / 100, 2)
        
        order_items.append({
            "product_id": item.product_id,
            "name": product["name"],
            "net_weight": product["net_weight"],
            "image": product["image"],
            "quantity_boxes": item.quantity_boxes,
            "price_per_box": product["price_per_box"],
            "price_per_half_box": product["price_per_half_box"],
            "line_total": line_total,
            "gst_rate": gst_rate,
            "gst_amount": line_gst,
            "hsn_code": product.get("hsn_code")
        })
        
        subtotal += line_total
        total_gst += line_gst
    
    if not order_items:
        raise HTTPException(status_code=400, detail="No valid items in order")
    
    # Voucher and Cash discount are mutually exclusive
    voucher_discount = 0
    voucher_info = None
    cash_discount = 0
    
    if order_data.voucher_code:
        # Validate voucher - if voucher is used, no cash discount
        voucher_info, error = await validate_retailer_voucher(
            order_data.voucher_code, 
            retailer["retailer_id"], 
            subtotal
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        voucher_discount = voucher_info["discount_amount"]
    elif order_data.apply_cash_discount:
        # Only apply cash discount if no voucher
        cash_discount = round(subtotal * CASH_DISCOUNT_PERCENT / 100, 2)
    
    # Credit note
    cn_discount = 0
    cn_info = None
    if order_data.credit_note_code:
        cn_info, error = await validate_credit_note(
            order_data.credit_note_code,
            retailer["retailer_id"]
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        # CN can be partially used
        cn_discount = min(cn_info["balance"], subtotal + total_gst - voucher_discount - cash_discount)
    
    # Grand total
    total_discount = voucher_discount + cash_discount + cn_discount
    grand_total = round(subtotal + total_gst - total_discount, 2)
    grand_total = max(0, grand_total)  # Ensure non-negative
    
    return {
        "items": order_items,
        "subtotal": subtotal,
        "gst_total": total_gst,
        "voucher_discount": voucher_discount,
        "voucher_code": order_data.voucher_code if voucher_info else None,
        "cash_discount": cash_discount,
        "cash_discount_percent": CASH_DISCOUNT_PERCENT if cash_discount > 0 else 0,
        "credit_note_discount": cn_discount,
        "credit_note_code": order_data.credit_note_code if cn_info else None,
        "total_discount": total_discount,
        "grand_total": grand_total,
        "retailer_gst": retailer.get("gst_number"),
        "retailer_address": {
            "business_name": retailer.get("business_name") or retailer.get("trade_name"),
            "address": retailer.get("address"),
            "city": retailer.get("city"),
            "state": retailer.get("state"),
            "pincode": retailer.get("pincode")
        }
    }


@router.post("/order")
async def create_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Place a B2B wholesale order"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
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
        "gst_total": calculation["gst_total"],
        "voucher_code": calculation.get("voucher_code"),
        "voucher_discount": calculation.get("voucher_discount", 0),
        "cash_discount": calculation.get("cash_discount", 0),
        "cash_discount_percent": calculation.get("cash_discount_percent", 0),
        "credit_note_code": calculation.get("credit_note_code"),
        "credit_note_discount": calculation.get("credit_note_discount", 0),
        "total_discount": calculation.get("total_discount", 0),
        "grand_total": calculation["grand_total"],
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
    if calculation["grand_total"] > 0 and order["payment_method"] == "online":
        try:
            import razorpay
            import os
            
            client = razorpay.Client(auth=(
                os.environ.get("RAZORPAY_KEY_ID"),
                os.environ.get("RAZORPAY_KEY_SECRET")
            ))
            
            razorpay_order = client.order.create({
                "amount": int(calculation["grand_total"] * 100),  # Razorpay expects paise
                "currency": "INR",
                "receipt": order_id,
                "notes": {
                    "order_id": order_id,
                    "retailer_id": retailer["retailer_id"],
                    "order_type": "B2B"
                }
            })
            order["razorpay_order_id"] = razorpay_order["id"]
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {str(e)}")
            # Continue without online payment
    
    await db.b2b_orders.insert_one(order)
    
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


@router.post("/order/{order_id}/verify-payment")
async def verify_b2b_payment(
    order_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Verify Razorpay payment for B2B order"""
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
            from services.email_service import send_email
            await send_b2b_order_confirmation_email(order, retailer)
        except Exception as e:
            logger.error(f"Failed to send B2B order confirmation email: {str(e)}")
        
        logger.info(f"B2B order {order_id} payment verified: {razorpay_payment_id}")
        
        return {
            "message": "Payment verified successfully",
            "order_id": order_id,
            "status": "confirmed"
        }
        
    except Exception as e:
        logger.error(f"Payment verification failed for {order_id}: {str(e)}")
        raise HTTPException(status_code=400, detail="Payment verification failed")


async def send_b2b_order_confirmation_email(order: dict, retailer: dict):
    """Send B2B order confirmation email"""
    from services.email_service import send_email
    
    items_html = ""
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{item['name']} ({item['net_weight']})</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item['quantity_boxes']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{item['line_total']:,.2f}</td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0;">B2B Order Confirmation</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 60px; height: 60px; background-color: #16a34a; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 30px;">✓</span>
                        </div>
                        <h2 style="color: #1e3a52; margin: 0;">Payment Successful!</h2>
                        <p style="color: #666; margin-top: 10px;">Order ID: <strong>{order['order_id']}</strong></p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px;">
                        <thead>
                            <tr style="background-color: #f9f7f4;">
                                <th style="padding: 12px; text-align: left;">Product</th>
                                <th style="padding: 12px; text-align: center;">Boxes</th>
                                <th style="padding: 12px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>{items_html}</tbody>
                    </table>
                    
                    <div style="margin-top: 20px; padding: 15px; background-color: #f9f7f4; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Subtotal:</span><span>₹{order['subtotal']:,.2f}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>GST (18%):</span><span>₹{order['gst_total']:,.2f}</span>
                        </div>
                        {"<div style='display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;'><span>Discount:</span><span>-₹" + f"{order.get('total_discount', 0):,.2f}" + "</span></div>" if order.get('total_discount', 0) > 0 else ""}
                        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #1e3a52; padding-top: 10px; border-top: 2px solid #d4af37;">
                            <span>Total Paid:</span><span style="color: #d4af37;">₹{order['grand_total']:,.2f}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                        <p style="margin: 0; color: #1e40af; font-size: 14px;">
                            <strong>What's Next?</strong><br>
                            Our team will process your order and arrange delivery. You will receive updates via email and SMS.
                        </p>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0;">ADDRIKA - Premium Agarbattis</p>
                    <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">Questions? Contact contact.us@centraders.com</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email(
        to_email=retailer["email"],
        subject=f"B2B Order Confirmed: {order['order_id']} | Addrika",
        html_content=html
    )


@router.get("/orders")
async def get_b2b_orders(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """Get retailer's B2B orders"""
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
