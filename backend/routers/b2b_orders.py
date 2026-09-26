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
from services.b2b_catalog import B2B_PRODUCTS, _enrich_carton_fields
from services import b2b_order_engine as order_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-dashboard/b2b", tags=["B2B Orders"])


async def require_b2b_enabled():
    """Raise 403 if B2B portal is disabled."""
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="B2B portal is currently unavailable. Please contact AAROHMM for access.",
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
    # Live stock straight from Mongo so every channel sees the same number
    live_stock = {
        d["id"]: d async for d in db.b2b_products.find(
            {}, {"_id": 0, "id": 1, "stock_pieces": 1, "stock_status": 1, "restock_eta_days": 1, "restock_note": 1}
        )
    }
    products_with_tiers = []
    for p in B2B_PRODUCTS:
        p_copy = dict(p)
        p_copy.update(live_stock.get(p["id"], {}))
        p_copy = _enrich_carton_fields(p_copy)
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
    # Optional idempotency key from clients that may retry (mobile / FSM)
    client_ref: Optional[str] = Field(None, max_length=80)


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
    return await order_engine.calculate(db, retailer, order_data)


@router.post("/order")
async def create_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Place a B2B wholesale order (web portal + AAROHMM app handoff share this path)."""
    await require_b2b_enabled()
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await require_kyc_complete(retailer)
    channel = "mobile" if (request.headers.get("X-Client-Channel") or "").lower() == "mobile" else "web"
    _order, response = await order_engine.place_order(
        db, retailer, order_data, channel=channel, client_ref=order_data.client_ref
    )
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
        try:
            from services.supabase_sync import mirror_order_snapshot
            await mirror_order_snapshot(db, order_id=order_id, collection="b2b_orders")
        except Exception:
            pass
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
        from services.b2b_payment_hooks import run_post_payment_hooks
        await run_post_payment_hooks(db, fresh, retailer, rpay_payment_id)
        try:
            from services.supabase_sync import mirror_order_snapshot
            await mirror_order_snapshot(db, order_id=order_id, collection="b2b_orders")
        except Exception:
            pass
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

        # Shared "payment landed" transition: marks paid/confirmed, e-mails the
        # retailer, deducts stock (idempotent vs. placement reservation), accrues
        # rewards, syncs Zoho and refreshes the Supabase mirror.
        await order_engine.mark_order_paid(
            db, order, retailer,
            payment_ref=razorpay_payment_id, method="razorpay",
            note=f"Payment verified: {razorpay_payment_id}", actor="retailer",
        )
        logger.info(f"B2B order {order_id} payment verified: {razorpay_payment_id}")

        return {
            "message": "Payment verified successfully",
            "order_id": order_id,
            "status": "confirmed"
        }
        
    except Exception as e:
        logger.error(f"Payment verification failed for {order_id}: {str(e)}")
        raise HTTPException(status_code=400, detail="Payment verification failed")


@router.post("/razorpay/webhook", include_in_schema=False)
async def razorpay_b2b_webhook(request: Request):
    """Razorpay → us. Configure in the Razorpay dashboard with the URL
    `<backend>/api/retailer-dashboard/b2b/razorpay/webhook` and the secret from
    `RAZORPAY_WEBHOOK_SECRET`. Handles `payment_link.paid` so FSM payment-link
    orders confirm the instant the retailer pays (polling on read is the fallback)."""
    import hashlib
    import hmac
    import json
    import os

    raw = await request.body()
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="RAZORPAY_WEBHOOK_SECRET not configured")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-Razorpay-Signature", "")):
        raise HTTPException(status_code=401, detail="Bad signature")
    payload = json.loads(raw or b"{}")
    event = payload.get("event")
    if event != "payment_link.paid":
        return {"ignored": event}
    link = ((payload.get("payload") or {}).get("payment_link") or {}).get("entity") or {}
    payment = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    order_id = link.get("reference_id") or (link.get("notes") or {}).get("order_id")
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0}) if order_id else None
    if not order:
        return {"ignored": "unknown order", "order_id": order_id}
    retailer = await db.retailers.find_one({"retailer_id": order["retailer_id"]}, {"_id": 0, "password_hash": 0}) or {}
    await order_engine.mark_order_paid(
        db, order, retailer,
        payment_ref=payment.get("id") or link.get("id"), method="razorpay_link",
        note=f"Payment link paid: {payment.get('id')}", actor="razorpay-webhook",
    )
    return {"ok": True, "order_id": order_id}


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


@router.post("/walkthrough-seen")
async def mark_walkthrough_seen(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    """Persist that this retailer has watched (or skipped) the 60-second
    AAROHMM app onboarding walkthrough, so it only auto-opens once."""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {
            "walkthrough_seen": True,
            "walkthrough_seen_at": datetime.now(timezone.utc).isoformat(),
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
