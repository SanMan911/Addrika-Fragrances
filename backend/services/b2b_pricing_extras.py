"""
B2B Pricing Augmentations.

The core price math lives in `b2b_pricing.calculate_b2b_order`. This module
layers on the "extras" the /calculate route stitches in — pre-order tokens,
distance-based shipping, Fragrance Rewards redemption and reward projections.

Each helper mutates the passed-in `calc` dict in place and returns it, so
callers can chain them naturally.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def apply_preorder_terms(calc: dict, *, is_preorder: bool, accept_terms: bool) -> dict:
    """Attach pre-order token/balance/terms to `calc` when the cart is a
    pre-order. Raises 400 if terms weren't accepted."""
    if not is_preorder:
        return calc
    if not accept_terms:
        raise HTTPException(
            status_code=400,
            detail=(
                "Pre-Order terms must be accepted (non-refundable, "
                "non-cancellable, no CNs, seal-intact exchange only, "
                "damage-at-delivery-only)."
            ),
        )
    from services.b2b_preorder import token_amount_for, TERMS_VERSION, TERMS_TEXT

    grand = float(calc.get("grand_total", 0))
    calc["is_preorder"] = True
    calc["token_amount_inr"] = token_amount_for(grand)
    calc["balance_due_inr"] = round(grand - calc["token_amount_inr"], 2)
    calc["terms_version"] = TERMS_VERSION
    calc["terms_text"] = TERMS_TEXT
    return calc


def apply_shipping(calc: dict, shipping_quote: Optional[dict]) -> dict:
    """Fold shipping charges into grand_total; keep the raw quote for UI."""
    if shipping_quote:
        ship = float(shipping_quote.get("shipping_charges") or 0)
        calc["shipping_charges"] = ship
        calc["shipping_quote"] = shipping_quote
        calc["grand_total"] = round(float(calc.get("grand_total", 0)) + ship, 2)
    else:
        calc["shipping_charges"] = 0.0
    return calc


async def apply_rewards_redemption(
    db, calc: dict, retailer: dict, redeem_requested: float
) -> dict:
    """Preview + optionally apply Fragrance Rewards redemption against the
    invoice subtotal. Server clamps requested amount via `preview_credit`."""
    if redeem_requested and redeem_requested > 0:
        try:
            from services.fragrance_rewards import preview_credit
            preview = await preview_credit(
                db,
                retailer["retailer_id"],
                float(calc.get("subtotal") or 0),
                redeem_requested,
            )
            calc["rewards_redemption"] = preview
            if preview.get("eligible") and preview.get("applicable"):
                rewards_applied = float(preview["applicable"])
                calc["rewards_redeemed_inr"] = rewards_applied
                calc["grand_total"] = round(
                    max(float(calc.get("grand_total", 0)) - rewards_applied, 0.0), 2,
                )
                return calc
        except Exception as e:
            logger.warning(f"rewards preview_credit failed: {e}")
            calc["rewards_redemption"] = {
                "applicable": 0, "eligible": False, "reason": "internal_error",
            }
    calc["rewards_redeemed_inr"] = 0.0
    return calc


async def add_rewards_projection(db, calc: dict, retailer: dict) -> dict:
    """Compute the "You'll earn ₹X" projection shown at checkout."""
    try:
        from services.fragrance_rewards import (
            QUALIFYING_INVOICE_MIN,
            _multiplier,
        )
        subtotal_for_reward = float(calc.get("subtotal") or 0)
        shipping_for_reward = float(calc.get("shipping_charges") or 0)
        profile = await db.rewards_profile.find_one(
            {"_id": retailer["retailer_id"]}
        ) or {}
        streak = int(profile.get("streak", 0)) + 1
        mult = _multiplier(streak)
        will_earn = 0.0
        if subtotal_for_reward >= QUALIFYING_INVOICE_MIN and shipping_for_reward > 0:
            will_earn = round(shipping_for_reward * mult, 2)
        calc["rewards_projection"] = {
            "will_earn_inr": will_earn,
            "multiplier_pct": int(mult * 100),
            "streak_after": streak,
            "qualifying_min_inr": QUALIFYING_INVOICE_MIN,
        }
    except Exception:
        pass
    return calc
