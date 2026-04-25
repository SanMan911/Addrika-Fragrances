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
)
from services.b2b_loyalty import get_retailer_loyalty_state
from services.b2b_catalog import B2B_PRODUCTS
from services.b2b_emails import send_b2b_admin_notification_email
from services.b2b_pricing import (
    calculate_b2b_order as calc_b2b_pricing,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-dashboard/b2b", tags=["B2B Orders"])


async def require_b2b_enabled():
    """Raise 403 if B2B portal is disabled."""
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="B2B portal is currently unavailable. Please contact Addrika for access.",
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

    return await calc_b2b_pricing(
        db,
        retailer=retailer,
        items=order_data.items,
        apply_cash_discount=order_data.apply_cash_discount,
        voucher_code=order_data.voucher_code,
        credit_note_code=order_data.credit_note_code,
    )


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
            from services.email_service import send_email
            await send_b2b_order_confirmation_email(order, retailer)
        except Exception as e:
            logger.error(f"Failed to send B2B order confirmation email: {str(e)}")
        
        logger.info(f"B2B order {order_id} payment verified: {razorpay_payment_id}")

        # Best-effort: record payment in Zoho Books
        try:
            from services.zoho_books import push_payment, is_configured as _zoho_cfg
            zoho_pmt = await push_payment(
                order, retailer, float(order.get("grand_total", 0)), razorpay_payment_id
            )
            if zoho_pmt:
                await db.b2b_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "zoho_payment_id": zoho_pmt.get("payment_id"),
                        "zoho_payment_synced_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
            elif await _zoho_cfg():
                from services.zoho_errors import record_error
                await record_error(
                    "payment",
                    order_id,
                    retailer["retailer_id"],
                    "push_payment returned None (Zoho API likely rejected the payload — see server logs).",
                )
        except Exception as e:
            logger.error(f"Zoho payment sync failed for {order_id}: {e}")
            try:
                from services.zoho_errors import record_error
                await record_error(
                    "payment", order_id, retailer["retailer_id"], str(e)
                )
            except Exception:
                pass

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
