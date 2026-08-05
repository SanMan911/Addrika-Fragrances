"""
Post-payment side-effects for B2B orders.

When a Razorpay payment is verified, several downstream systems need to run:

    1. Fragrance Rewards accrual (shipping → 90-day trade credit).
    2. Fragrance Rewards redemption consumption (the amount the retailer
       elected to apply at checkout is now permanently deducted).
    3. B2B inventory deduction (pieces per SKU reduced by the paid order).
    4. Zoho Books payment sync (best-effort — Zoho errors are recorded).

Each hook is independently guarded and idempotent so a single failure
never blocks the rest.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def run_post_payment_hooks(
    db, order: dict, retailer: dict, razorpay_payment_id: str
) -> None:
    """Runs every post-payment side-effect for a verified B2B order.
    Guarded per-hook so partial failures don't cascade."""
    order_id = order["order_id"]
    await _accrue_rewards(db, order, retailer, razorpay_payment_id)
    await _consume_rewards_redemption(db, order, retailer)
    await _deduct_inventory(db, order_id)
    await _push_zoho_payment(db, order, retailer, razorpay_payment_id)


async def _accrue_rewards(
    db, order: dict, retailer: dict, razorpay_payment_id: str
) -> None:
    try:
        from services.fragrance_rewards import maybe_credit_on_order
        subtotal = float(
            order.get("subtotal")
            or order.get("items_subtotal")
            or (float(order.get("grand_total", 0)) - float(order.get("shipping_charges", 0)))
        )
        shipping = float(order.get("shipping_charges", 0))
        await maybe_credit_on_order(
            db,
            retailer_id=retailer["retailer_id"],
            order_id=order["order_id"],
            subtotal_inr=subtotal,
            shipping_inr=shipping,
            payment_id=razorpay_payment_id,
        )
    except Exception as e:
        logger.warning(f"Fragrance rewards accrual failed for {order['order_id']}: {e}")


async def _consume_rewards_redemption(db, order: dict, retailer: dict) -> None:
    """Consume the redemption ledger entries for the amount the retailer
    opted to apply at checkout. Idempotent — guarded by a `redeem`
    ledger row for this order_id."""
    try:
        redeem_amt = float(order.get("rewards_redeemed_inr") or 0)
        if redeem_amt <= 0:
            return
        already = await db.rewards_ledger.find_one(
            {"source_order_id": order["order_id"], "kind": "redeem"}
        )
        if already:
            return
        from services.fragrance_rewards import apply_credit
        subtotal = float(order.get("subtotal") or 0)
        result = await apply_credit(
            db,
            retailer_id=retailer["retailer_id"],
            order_id=order["order_id"],
            invoice_subtotal_inr=subtotal,
            requested_amount=redeem_amt,
        )
        if result.get("error"):
            logger.warning(
                f"Rewards redemption for {order['order_id']} failed: {result['error']}"
            )
        else:
            logger.info(
                f"Rewards redemption for {order['order_id']}: applied ₹{result['applied']}, "
                f"remaining ₹{result['remaining_balance']}"
            )
    except Exception as e:
        logger.warning(f"Fragrance rewards redemption failed for {order['order_id']}: {e}")


async def _deduct_inventory(db, order_id: str) -> None:
    try:
        from services.b2b_inventory import deduct_for_paid_order
        fresh_order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
        if fresh_order:
            await deduct_for_paid_order(db, fresh_order)
    except Exception as e:
        logger.warning(f"B2B inventory deduction failed for {order_id}: {e}")


async def _push_zoho_payment(
    db, order: dict, retailer: dict, razorpay_payment_id: str
) -> None:
    order_id = order["order_id"]
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
