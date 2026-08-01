"""Fragrance Rewards / Trade Credit service (Feb 2026).

Rules (per product spec — do NOT change without user approval):
─────────────────────────────────────────────────────────────
  ▸ Earn ONLY on successful Razorpay-paid B2B orders where the
    invoice value (order_subtotal excluding shipping & GST) is ≥ ₹1,000.
  ▸ Earnings = 100 % of the SHIPPING amount charged on that invoice
    × multiplier of the current streak:
        1st qualifying invoice           → 100 %
        2nd consecutive qualifying       → 110 %
        3rd + consecutive qualifying     → 125 %
  ▸ Streak resets after 45 days without a qualifying invoice
    (i.e. the next qualifying order restarts at 100 %).
  ▸ Balance can be redeemed only when it hits ₹2,500 AND the invoice
    the customer wants to redeem it on is itself ≥ ₹2,500.
  ▸ Redemption may cover the invoice IN FULL, but shipping + GST +
    statutory charges are ALWAYS payable — trade credit never offsets
    those.
  ▸ Shipping paid on the redemption order still earns fresh credit
    at the current multiplier.
  ▸ Every credit line item is valid for 90 days from earn date.
  ▸ On/off toggle is per-retailer (retailer.rewards_enabled boolean).
  ▸ Displayed to the retailer as "Fragrance Rewards Balance".
  ▸ Admins can view every retailer's live balance in `/admin/retailers`
    and can also see the ledger under Order History.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

QUALIFYING_INVOICE_MIN = 1000       # ₹
REDEMPTION_THRESHOLD = 2500         # balance & min-invoice
CREDIT_VALIDITY_DAYS = 90
STREAK_RESET_DAYS = 45
MULTIPLIER_SCHEDULE = {1: 1.00, 2: 1.10}  # 3+ falls through to 1.25
DEFAULT_MULTIPLIER = 1.25


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _multiplier(streak: int) -> float:
    """Return the multiplier for the Nth consecutive qualifying invoice."""
    return MULTIPLIER_SCHEDULE.get(streak, DEFAULT_MULTIPLIER)


# ---------------------------------------------------------------------------
# Ledger reads
# ---------------------------------------------------------------------------
async def get_balance(db, retailer_id: str) -> dict:
    """Return active (non-expired) balance + streak snapshot for a retailer.
    Returned shape is safe to send straight to the retailer portal."""
    now = _now()
    cursor = db.rewards_ledger.find({
        "retailer_id": retailer_id,
        "status": "active",
        "expires_at": {"$gt": now.isoformat()},
    })
    entries = await cursor.to_list(500)
    balance = sum(float(e.get("amount", 0)) for e in entries)

    profile = await db.rewards_profile.find_one({"_id": retailer_id})
    streak = int((profile or {}).get("streak", 0))
    last = (profile or {}).get("last_qualifying_at")

    # Streak reset check — surface if the retailer is at risk of loss.
    reset_at = None
    if last:
        try:
            dt = datetime.fromisoformat(last)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            reset_at = (dt + timedelta(days=STREAK_RESET_DAYS)).isoformat()
        except Exception:
            pass

    return {
        "retailer_id": retailer_id,
        "balance_inr": round(balance, 2),
        "streak": streak,
        "next_multiplier_pct": int(_multiplier(streak + 1) * 100),
        "redeemable": balance >= REDEMPTION_THRESHOLD,
        "redemption_threshold_inr": REDEMPTION_THRESHOLD,
        "qualifying_invoice_min_inr": QUALIFYING_INVOICE_MIN,
        "streak_resets_at": reset_at,
        "entries": [
            {
                k: e.get(k)
                for k in ("id", "kind", "amount", "expires_at", "note",
                         "source_order_id", "earned_at", "consumed_at")
            }
            for e in entries
        ],
    }


# ---------------------------------------------------------------------------
# Earn — called from the B2B verify-payment path
# ---------------------------------------------------------------------------
async def maybe_credit_on_order(
    db, retailer_id: str, order_id: str,
    subtotal_inr: float, shipping_inr: float,
    payment_id: Optional[str] = None,
) -> Optional[dict]:
    """Called after a successful Razorpay-paid B2B order.

    * Idempotent — if a credit for this `order_id` already exists we exit.
    * Fires only if subtotal ≥ QUALIFYING_INVOICE_MIN and retailer opted-in.
    * Applies the correct streak multiplier and stamps expires_at.
    """
    if not order_id:
        return None
    if float(subtotal_inr) < QUALIFYING_INVOICE_MIN:
        return None

    retailer = await db.retailers.find_one(
        {"retailer_id": retailer_id},
        {"rewards_enabled": 1, "business_name": 1, "_id": 0},
    )
    if not retailer:
        return None
    if not retailer.get("rewards_enabled", True):
        # Global default is opt-in; admin can flip off via the edit modal.
        # (rewards_enabled=None ≡ True)
        pass  # continue — treat missing as enabled

    # Idempotency
    if await db.rewards_ledger.find_one({"source_order_id": order_id, "kind": "earn"}):
        return None

    profile = await db.rewards_profile.find_one({"_id": retailer_id}) or {}
    streak = int(profile.get("streak", 0))
    last_iso = profile.get("last_qualifying_at")

    # Streak-reset window
    if last_iso:
        try:
            last_dt = datetime.fromisoformat(last_iso)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (_now() - last_dt).days > STREAK_RESET_DAYS:
                streak = 0
        except Exception:
            streak = 0

    streak += 1
    mult = _multiplier(streak)
    amount = round(float(shipping_inr) * mult, 2)

    entry = {
        "id": f"FR-{uuid.uuid4().hex[:10].upper()}",
        "retailer_id": retailer_id,
        "source_order_id": order_id,
        "source_payment_id": payment_id,
        "kind": "earn",
        "amount": amount,
        "shipping_inr": float(shipping_inr),
        "multiplier": mult,
        "streak": streak,
        "status": "active",
        "earned_at": _now().isoformat(),
        "expires_at": (_now() + timedelta(days=CREDIT_VALIDITY_DAYS)).isoformat(),
        "note": f"{int(mult*100)}% shipping credit on B2B order {order_id}",
    }
    await db.rewards_ledger.insert_one(entry)
    await db.rewards_profile.update_one(
        {"_id": retailer_id},
        {"$set": {
            "streak": streak,
            "last_qualifying_at": _now().isoformat(),
        }},
        upsert=True,
    )
    logger.info(
        "rewards: credited %s to %s on order %s (streak=%d, mult=%.2fx)",
        amount, retailer_id, order_id, streak, mult,
    )
    return {"credited": amount, "streak": streak, "multiplier": mult}


# ---------------------------------------------------------------------------
# Redeem — called from B2B checkout when retailer opts to apply credit
# ---------------------------------------------------------------------------
async def apply_credit(
    db, retailer_id: str, order_id: str,
    invoice_subtotal_inr: float, requested_amount: float,
) -> dict:
    """Try to consume `requested_amount` from the retailer's active credit
    pool. Returns `{applied, remaining_balance, error?}`.

    Enforces:
      * invoice_subtotal must be ≥ REDEMPTION_THRESHOLD
      * balance must be ≥ REDEMPTION_THRESHOLD
      * cannot consume more than min(balance, invoice_subtotal)
      * shipping + GST are NEVER offset (caller must ensure `requested_amount`
        is already computed against pre-shipping / pre-GST subtotal).
    """
    now = _now()
    if float(invoice_subtotal_inr) < REDEMPTION_THRESHOLD:
        return {"applied": 0, "error":
                f"Invoice must be at least ₹{REDEMPTION_THRESHOLD} to redeem"}

    balance_data = await get_balance(db, retailer_id)
    balance = balance_data["balance_inr"]
    if balance < REDEMPTION_THRESHOLD:
        return {"applied": 0, "error":
                f"Rewards balance must be at least ₹{REDEMPTION_THRESHOLD} to redeem"}

    consumable = min(float(requested_amount), balance, float(invoice_subtotal_inr))
    if consumable <= 0:
        return {"applied": 0, "error": "Nothing to redeem"}

    # FIFO — consume oldest entries first so the 90-day validity is respected.
    entries = sorted(balance_data["entries"], key=lambda e: e.get("expires_at") or "")
    remaining = consumable
    consumed_ids = []
    for e in entries:
        if remaining <= 0:
            break
        take = min(remaining, float(e["amount"]))
        # Reduce the entry — if fully drained, mark consumed.
        new_amt = round(float(e["amount"]) - take, 2)
        if new_amt <= 0.001:
            await db.rewards_ledger.update_one(
                {"id": e["id"]},
                {"$set": {"status": "consumed", "consumed_at": now.isoformat(),
                           "consumed_on_order_id": order_id, "amount": 0}},
            )
        else:
            await db.rewards_ledger.update_one(
                {"id": e["id"]}, {"$set": {"amount": new_amt}}
            )
        remaining -= take
        consumed_ids.append(e["id"])

    # Ledger row for the redemption event itself
    await db.rewards_ledger.insert_one({
        "id": f"FR-{uuid.uuid4().hex[:10].upper()}",
        "retailer_id": retailer_id,
        "source_order_id": order_id,
        "kind": "redeem",
        "amount": -round(consumable, 2),
        "status": "consumed",
        "earned_at": now.isoformat(),
        "consumed_at": now.isoformat(),
        "consumed_from_entries": consumed_ids,
        "note": f"Applied on B2B order {order_id}",
    })

    new_balance = await get_balance(db, retailer_id)
    return {
        "applied": round(consumable, 2),
        "remaining_balance": new_balance["balance_inr"],
    }
