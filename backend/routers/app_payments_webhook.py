"""Razorpay webhook for Aarohmm B2B app payments.

Kept out of the authenticated app router because Razorpay calls it directly.
Trust comes from the HMAC signature, not from a session — an unsigned or
badly-signed payload is rejected before we look at its contents.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request

from dependencies import db
from services import app_payments as pay

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/app/v2/payments", tags=["Mobile App v2 · Payments"])


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
):
    raw = await request.body()

    if not pay.verify_webhook_signature(raw, x_razorpay_signature or ""):
        logger.warning("razorpay webhook rejected: bad or missing signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    event = payload.get("event", "")
    entities = payload.get("payload", {})

    # Payment links and direct payments carry the order reference in notes.
    entity = (
        entities.get("payment", {}).get("entity")
        or entities.get("payment_link", {}).get("entity")
        or {}
    )
    notes = entity.get("notes") or {}
    order_id = notes.get("order_id") or (entity.get("reference_id") or "").replace("AARO-", "")
    payment_id = entity.get("id") or ""

    if event in ("payment.captured", "payment_link.paid", "order.paid"):
        if not order_id:
            logger.error(f"razorpay webhook {event} had no order reference")
            return {"status": "ignored", "reason": "no order reference"}
        ok = await pay.mark_paid(db, order_id, payment_id)
        logger.info(f"razorpay webhook {event} for {order_id}: marked_paid={ok}")
        return {"status": "processed", "order_id": order_id, "paid": ok}

    logger.info(f"razorpay webhook {event} ignored")
    return {"status": "ignored", "event": event}


@router.post("/pinelabs/webhook")
async def pinelabs_webhook(
    request: Request,
    x_pinelabs_signature: str = Header(None, alias="X-Pinelabs-Signature"),
):
    raw = await request.body()

    from services import pinelabs_payments as pinelabs

    if not pinelabs.verify_webhook_signature(raw, x_pinelabs_signature or ""):
        logger.warning("pinelabs webhook rejected: bad or missing signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    status = (payload.get("status") or payload.get("payment_status") or "").lower()
    order_id = payload.get("merchant_order_reference") or payload.get("order_id") or ""
    payment_id = payload.get("plural_payment_id") or payload.get("payment_id") or ""

    if status in ("success", "captured", "paid", "processed"):
        if not order_id:
            logger.error("pinelabs webhook success had no order reference")
            return {"status": "ignored", "reason": "no order reference"}
        ok = await pinelabs.mark_paid(db, order_id, payment_id)
        logger.info(f"pinelabs webhook for {order_id}: marked_paid={ok}")
        return {"status": "processed", "order_id": order_id, "paid": ok}

    logger.info(f"pinelabs webhook status '{status}' ignored")
    return {"status": "ignored", "payment_status": status}
