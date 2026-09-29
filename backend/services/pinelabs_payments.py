"""PineLabs online payments for the Aarohmm B2B app.

Wired alongside Razorpay so the desk can choose a provider per order. Uses
PineLabs' **hosted checkout** (Plural) — the app opens the returned URL in the
system browser, so nothing native is required in the Expo managed workflow.

Same money rules as Razorpay:
  * The amount ALWAYS comes from the order stored server-side.
  * An order is marked paid only after a verified webhook.
  * While the keys are placeholders every entry point fails loudly rather
    than pretending a payment succeeded.

Credentials (add to backend/.env when PineLabs onboarding completes):
    PINELABS_MERCHANT_ID
    PINELABS_ACCESS_CODE
    PINELABS_SECRET
    PINELABS_WEBHOOK_SECRET
    PINELABS_BASE_URL   (defaults to the UAT host)
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone

from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)

PLACEHOLDER_HINTS = ("your_", "placeholder", "changeme", "xxx", "todo")

UAT_BASE_URL = "https://uat.pinepg.in"


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _looks_placeholder(value: str) -> bool:
    low = (value or "").lower()
    return not low or any(h in low for h in PLACEHOLDER_HINTS)


def base_url() -> str:
    return _env("PINELABS_BASE_URL") or UAT_BASE_URL


def is_configured() -> bool:
    return not any(
        _looks_placeholder(_env(k))
        for k in ("PINELABS_MERCHANT_ID", "PINELABS_ACCESS_CODE", "PINELABS_SECRET")
    )


def webhook_ready() -> bool:
    return not _looks_placeholder(_env("PINELABS_WEBHOOK_SECRET"))


def can_collect() -> bool:
    """Same rule as Razorpay: no verifiable webhook, no collection."""
    return is_configured() and webhook_ready()


def config_status() -> dict:
    webhook_ready_flag = webhook_ready()
    return {
        "provider": "pinelabs",
        "configured": is_configured(),
        "ready_for_payments": can_collect(),
        "merchant_id_present": bool(_env("PINELABS_MERCHANT_ID")),
        "access_code_present": bool(_env("PINELABS_ACCESS_CODE")),
        "secret_present": bool(_env("PINELABS_SECRET")),
        "webhook_verification_ready": webhook_ready_flag,
        "mode": "live" if "uat" not in base_url() else "uat",
        "warnings": (
            []
            if can_collect()
            else [
                "PineLabs credentials are still placeholders — online payment "
                "via PineLabs is switched off and no payment can be confirmed."
            ]
        ),
    }


async def create_checkout(db, order: dict, retailer: dict) -> dict:
    """Create a PineLabs hosted-checkout session for an order."""
    if not is_configured():
        raise RuntimeError("PineLabs is not configured")

    amount_inr = float(order.get("grand_total") or 0)
    if amount_inr <= 0:
        raise ValueError("Order has no payable amount")

    import asyncio

    import requests

    payload = {
        "merchant_id": _env("PINELABS_MERCHANT_ID"),
        "access_code": _env("PINELABS_ACCESS_CODE"),
        "merchant_order_reference": order["order_id"],
        "order_amount": {
            "value": int(round(amount_inr * 100)),  # paise
            "currency": "INR",
        },
        "pre_auth": False,
        "customer": {
            "customer_id": retailer["retailer_id"],
            "email_id": retailer.get("email") or "",
            "mobile_number": str(retailer.get("phone") or ""),
        },
        "notes": f"Aarohmm wholesale order {order['order_id']}",
        "callback_url": f"{_env('PUBLIC_BACKEND_URL') or ''}/api/app/v2/payments/pinelabs/webhook",
    }

    def _post():
        return requests.post(
            f"{base_url()}/api/v2/payments/create-order",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

    resp = await asyncio.to_thread(_post)
    if resp.status_code >= 400:
        logger.error(f"pinelabs create-order failed {resp.status_code}: {resp.text[:300]}")
        raise RuntimeError("PineLabs rejected the payment request")

    data = resp.json()
    checkout_url = data.get("redirect_url") or data.get("payment_url")
    provider_order_id = data.get("plural_order_id") or data.get("order_id")
    if not checkout_url:
        raise RuntimeError("PineLabs did not return a checkout URL")

    conn = await _connect()
    if conn is not None:
        try:
            await conn.execute(
                """
                insert into public.app_payments
                  (order_id, retailer_id, provider, provider_order_id, amount, status)
                values ($1,$2,'pinelabs',$3,$4,'created')
                """,
                order["order_id"],
                retailer["retailer_id"],
                provider_order_id,
                amount_inr,
            )
        finally:
            await conn.close()

    await db.b2b_orders.update_one(
        {"order_id": order["order_id"]},
        {
            "$set": {
                "pinelabs_order_id": provider_order_id,
                "payment_link_url": checkout_url,
                "payment_mode": "pinelabs_checkout",
                "payment_link_created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "provider": "pinelabs",
        "payment_url": checkout_url,
        "provider_order_id": provider_order_id,
        "amount": amount_inr,
        "currency": "INR",
        "order_id": order["order_id"],
    }


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = _env("PINELABS_WEBHOOK_SECRET")
    # A placeholder secret must never verify, or anyone who guesses it could
    # mark orders paid.
    if _looks_placeholder(secret) or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def mark_paid(db, order_id: str, payment_id: str) -> bool:
    """Record a verified PineLabs payment, reusing the shared payment hooks."""
    from services.app_payments import mark_paid as shared_mark_paid

    ok = await shared_mark_paid(db, order_id, payment_id)
    if ok:
        conn = await _connect()
        if conn is not None:
            try:
                await conn.execute(
                    "update public.app_payments set provider = 'pinelabs', "
                    "status = 'paid', provider_payment_id = $2, updated_at = now() "
                    "where order_id = $1",
                    order_id,
                    payment_id,
                )
            finally:
                await conn.close()
    return ok
