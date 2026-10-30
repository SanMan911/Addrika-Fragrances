"""Checkout intents — the cart that is waiting for its upfront payment.

A B2B order is only written to `b2b_orders` once the chosen share of the
total has been verified. Until then the priced cart sits here, in
`b2b_order_intents`, holding no stock and carrying no order number.

    create_intent(...)   → price the cart, store it, open a payment session
    confirm_intent(...)  → payment verified → place the real order
    expire_stale(...)    → housekeeping for abandoned intents
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from services import b2b_payment_gate as gate
from services import b2b_order_engine as order_engine

logger = logging.getLogger(__name__)

INTENT_TTL_MINUTES = 60


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


async def create_intent(
    db,
    retailer: dict,
    order_data,
    *,
    payment_percent: int,
    channel: str = "web",
    provider: str = "razorpay",
) -> dict:
    """Price the cart and open a payment session for the chosen share."""
    block = await gate.ordering_block(db, retailer)
    if block:
        raise PermissionError(block["reason"])

    allowed = await gate.allowed_percents(db)
    if int(payment_percent) not in allowed:
        raise ValueError(
            "Choose how much to pay now: "
            + ", ".join(f"{p}%" for p in allowed)
        )

    # Paying in full earns the cash discount — the ladder IS the nudge.
    order_data.apply_cash_discount = int(payment_percent) == gate.CASH_DISCOUNT_PERCENT_THRESHOLD
    calculation = await order_engine.calculate(db, retailer, order_data)

    grand_total = float(calculation["grand_total"] or 0)
    if grand_total <= 0:
        raise ValueError("This cart has nothing payable in it")
    amount_now = round(grand_total * int(payment_percent) / 100, 2)

    intent = {
        "intent_id": f"INT-{uuid.uuid4().hex[:12].upper()}",
        "retailer_id": retailer["retailer_id"],
        "channel": channel,
        "payment_percent": int(payment_percent),
        "grand_total": grand_total,
        "amount_due_now": amount_now,
        "balance_after_payment": round(grand_total - amount_now, 2),
        "cash_discount": float(calculation.get("cash_discount") or 0),
        "order_payload": order_data.dict(),
        "calculation": {
            "subtotal": calculation.get("subtotal"),
            "gst_total": calculation.get("gst_total"),
            "grand_total": grand_total,
            "cash_discount": calculation.get("cash_discount"),
            "total_discount": calculation.get("total_discount"),
            "shipping_charges": calculation.get("shipping_charges"),
        },
        "provider": provider,
        "status": "awaiting_payment",
        "order_id": None,
        "created_at": _now_iso(),
        "expires_at": (_now() + timedelta(minutes=INTENT_TTL_MINUTES)).isoformat(),
    }
    await db.b2b_order_intents.insert_one(intent)
    intent.pop("_id", None)
    logger.info(
        "Checkout intent %s opened for %s: %s%% of ₹%s = ₹%s",
        intent["intent_id"],
        retailer["retailer_id"],
        payment_percent,
        grand_total,
        amount_now,
    )
    return intent


async def open_payment_session(db, intent: dict, retailer: dict) -> dict:
    """Create the hosted payment session for an intent's upfront amount."""
    from services import app_payments as razorpay_pay
    from services import pinelabs_payments as pinelabs

    provider = (intent.get("provider") or "razorpay").lower()
    handler = pinelabs if provider == "pinelabs" else razorpay_pay
    if not handler.can_collect():
        raise ConnectionError(
            "Online payment is not switched on yet, so we cannot confirm an order right now. "
            "Our wholesale desk will share payment details and confirm your order manually."
        )

    # Both providers price from a stored order document, so hand them a
    # shim carrying ONLY the verified upfront amount.
    shim = {
        "order_id": intent["intent_id"],
        "grand_total": intent["amount_due_now"],
        "retailer_id": intent["retailer_id"],
        "is_intent": True,
    }
    if provider == "pinelabs":
        session = await pinelabs.create_checkout(db, shim, retailer)
    else:
        session = await razorpay_pay.create_payment_link(db, shim, retailer)

    await db.b2b_order_intents.update_one(
        {"intent_id": intent["intent_id"]},
        {
            "$set": {
                "payment_url": session.get("payment_url"),
                "payment_session_id": session.get("payment_link_id") or session.get("order_id"),
                "updated_at": _now_iso(),
            }
        },
    )
    return session


async def confirm_intent(
    db, intent_id: str, *, payment_reference: str, verified_by: str, amount: Optional[float] = None
) -> dict:
    """A verified payment landed → place the real order. Idempotent."""
    intent = await db.b2b_order_intents.find_one({"intent_id": intent_id}, {"_id": 0})
    if not intent:
        raise ValueError("Checkout session not found")
    if intent["status"] == "confirmed" and intent.get("order_id"):
        existing = await db.b2b_orders.find_one({"order_id": intent["order_id"]}, {"_id": 0})
        return {"order_id": intent["order_id"], "already_confirmed": True, "order": existing}

    retailer = await db.retailers.find_one({"retailer_id": intent["retailer_id"]})
    if not retailer:
        raise ValueError("Retailer not found")

    from routers.b2b_orders import B2BOrderCreate

    order_data = B2BOrderCreate(**intent["order_payload"])
    paid_now = round(float(amount if amount is not None else intent["amount_due_now"]), 2)

    order, response = await order_engine.place_order(
        db,
        retailer,
        order_data,
        channel=intent.get("channel", "web"),
        payment_mode="pay_later",
        client_ref=intent["intent_id"],
        prepaid_amount=paid_now,
        payment_percent=intent["payment_percent"],
        payment_reference=payment_reference,
    )

    await db.b2b_order_intents.update_one(
        {"intent_id": intent_id},
        {
            "$set": {
                "status": "confirmed",
                "order_id": order["order_id"],
                "confirmed_at": _now_iso(),
                "confirmed_by": verified_by,
                "payment_reference": payment_reference,
            }
        },
    )
    logger.info(
        "Checkout intent %s confirmed by %s → order %s (₹%s upfront)",
        intent_id,
        verified_by,
        order["order_id"],
        paid_now,
    )
    response["intent_id"] = intent_id
    return response


async def find_intent_by_session(db, session_id: str) -> Optional[dict]:
    if not session_id:
        return None
    return await db.b2b_order_intents.find_one({"payment_session_id": session_id}, {"_id": 0})


async def list_intents(db, *, status: Optional[str] = None, retailer_id: Optional[str] = None, limit: int = 100):
    query: dict = {}
    if status:
        query["status"] = status
    if retailer_id:
        query["retailer_id"] = retailer_id
    cursor = db.b2b_order_intents.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [doc async for doc in cursor]
