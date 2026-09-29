"""Razorpay payments for the Aarohmm B2B app.

Expo-friendly by design: we create a Razorpay **Payment Link** and open it in
the system browser, so no native SDK and no ejecting from the managed workflow.

Money rules that matter:
  * The amount ALWAYS comes from the order stored server-side — never from the
    client. A phone cannot ask to pay less than it owes.
  * An order is marked paid only after Razorpay's webhook signature verifies,
    or after a signed callback is confirmed against Razorpay's API.
  * Keys are read from the environment. While they are placeholders the API
    returns a clear 503 instead of pretending a payment succeeded.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)

PLACEHOLDER_HINTS = ("your_", "placeholder", "changeme", "xxx", "todo", "rzp_test_key")


def _key_id() -> str:
    return (os.environ.get("RAZORPAY_KEY_ID") or "").strip()


def _key_secret() -> str:
    return (os.environ.get("RAZORPAY_KEY_SECRET") or "").strip()


def _webhook_secret() -> str:
    return (os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "").strip()


def is_configured() -> bool:
    """True only when both keys look like real credentials."""
    kid, secret = _key_id(), _key_secret()
    if not kid or not secret:
        return False
    low = f"{kid}{secret}".lower()
    return not any(h in low for h in PLACEHOLDER_HINTS)


def _looks_placeholder(value: str) -> bool:
    low = (value or "").lower()
    return not low or any(h in low for h in PLACEHOLDER_HINTS)


def webhook_ready() -> bool:
    return not _looks_placeholder(_webhook_secret())


def can_collect() -> bool:
    """Never take money we cannot confirm: a placeholder webhook secret means
    no payment can ever be verified, so collection stays switched off."""
    return is_configured() and webhook_ready()


def config_status() -> dict:
    webhook_ready_flag = webhook_ready()
    return {
        "configured": is_configured(),
        "ready_for_payments": can_collect(),
        "key_id_present": bool(_key_id()),
        "key_secret_present": bool(_key_secret()),
        # Distinguish "a value exists" from "a real secret exists": while this
        # is a placeholder, every incoming webhook will fail signature checks
        # and orders will never be marked paid.
        "webhook_secret_present": bool(_webhook_secret()),
        "webhook_verification_ready": webhook_ready_flag,
        "mode": "live" if _key_id().startswith("rzp_live_") else "test",
        "warnings": (
            []
            if webhook_ready_flag
            else [
                "RAZORPAY_WEBHOOK_SECRET is still a placeholder — payment "
                "confirmations cannot be verified until a real secret is set."
            ]
        ),
    }


def _client():
    import razorpay

    client = razorpay.Client(auth=(_key_id(), _key_secret()))
    client.set_app_details({"title": "Aarohmm B2B", "version": "1.0"})
    return client


async def create_payment_link(db, order: dict, retailer: dict) -> dict:
    """Create a Razorpay Payment Link for an order's outstanding amount."""
    amount_inr = float(order.get("grand_total") or 0)
    if amount_inr <= 0:
        raise ValueError("Order has no payable amount")

    import asyncio

    # Receipt/reference must be <= 40 chars for Razorpay.
    reference = f"AARO-{order['order_id']}"[:40]

    def _create():
        return _client().payment_link.create(
            {
                "amount": int(round(amount_inr * 100)),  # paise
                "currency": "INR",
                "accept_partial": False,
                "description": f"Aarohmm wholesale order {order['order_id']}",
                "reference_id": reference,
                "customer": {
                    "name": (retailer.get("business_name") or "Aarohmm Retailer")[:100],
                    "email": retailer.get("email") or "",
                    "contact": str(retailer.get("phone") or ""),
                },
                "notify": {"sms": False, "email": False},
                "reminder_enable": False,
                "notes": {
                    "order_id": order["order_id"],
                    "retailer_id": retailer["retailer_id"],
                    "channel": "mobile_app",
                },
            }
        )

    link = await asyncio.to_thread(_create)

    conn = await _connect()
    if conn is not None:
        try:
            await conn.execute(
                """
                insert into public.app_payments
                  (order_id, retailer_id, provider, provider_order_id, amount, status)
                values ($1,$2,'razorpay',$3,$4,'created')
                """,
                order["order_id"],
                retailer["retailer_id"],
                link.get("id"),
                amount_inr,
            )
        finally:
            await conn.close()

    await db.b2b_orders.update_one(
        {"order_id": order["order_id"]},
        {
            "$set": {
                "razorpay_payment_link_id": link.get("id"),
                "payment_link_url": link.get("short_url"),
                "payment_mode": "razorpay_link",
                "payment_link_created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "payment_link_id": link.get("id"),
        "payment_url": link.get("short_url"),
        "amount": amount_inr,
        "currency": "INR",
        "order_id": order["order_id"],
    }


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = _webhook_secret()
    # A placeholder secret must never be treated as valid, or anyone who
    # guesses it could mark orders paid.
    if _looks_placeholder(secret) or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def mark_paid(db, order_id: str, payment_id: str, provider_order_id: Optional[str] = None) -> bool:
    """Record a verified payment and run the shared post-payment hooks."""
    order = await db.b2b_orders.find_one({"order_id": order_id})
    if not order:
        logger.warning(f"razorpay: unknown order {order_id}")
        return False
    if order.get("payment_status") == "paid":
        return True  # idempotent: webhooks retry

    now = datetime.now(timezone.utc).isoformat()
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "payment_status": "paid",
                "razorpay_payment_id": payment_id,
                "paid_at": now,
                "updated_at": now,
            }
        },
    )

    conn = await _connect()
    if conn is not None:
        try:
            await conn.execute(
                """
                update public.app_payments
                   set status = 'paid', provider_payment_id = $2, updated_at = now()
                 where order_id = $1
                """,
                order_id,
                payment_id,
            )
        finally:
            await conn.close()

    retailer = await db.retailers.find_one({"retailer_id": order.get("retailer_id")}) or {}
    try:
        from services.b2b_payment_hooks import run_post_payment_hooks

        await run_post_payment_hooks(db, order, retailer, payment_id)
    except Exception as e:
        logger.error(f"post-payment hooks failed for {order_id}: {e}")

    try:
        from services.supabase_app_sync import sync_one_order

        await sync_one_order(db, order_id)
    except Exception as e:
        logger.warning(f"read-model sync after payment {order_id} failed: {e}")

    return True


async def payment_for_order(order_id: str, retailer_id: str) -> Optional[dict]:
    conn = await _connect()
    if conn is None:
        return None
    try:
        row = await conn.fetchrow(
            """
            select order_id, provider, provider_order_id, provider_payment_id,
                   amount, currency, status, created_at, updated_at
            from public.app_payments
            where order_id = $1 and retailer_id = $2
            order by created_at desc
            limit 1
            """,
            order_id,
            retailer_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()
