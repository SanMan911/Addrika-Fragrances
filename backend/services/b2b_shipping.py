"""B2B distance-based shipping quotes via Shiprocket serviceability API.

Turns the retailer's cart (in cartons/half-cartons) into a real weight,
calls Shiprocket for available couriers → cheapest rate is used as the
canonical `shipping_charges`. A graceful fallback flat-rate is applied
if Shiprocket is unavailable, so the checkout flow never breaks.

The Shiprocket credentials + default pickup pincode are pulled through
`admin_integrations.get_effective` so admins can rotate them from the
UI without a redeploy.
"""
from __future__ import annotations

import logging
from typing import Optional

from services.b2b_catalog import find_b2b_product
from services.b2b_inventory import pieces_for_quantity

logger = logging.getLogger(__name__)

DEFAULT_PICKUP_PIN = "110089"          # Delhi (SELLER_ADDRESS default)
FALLBACK_BASE_INR = 120.0              # 1st kg
FALLBACK_PER_KG_INR = 25.0             # each additional kg
MIN_BILLABLE_KG = 0.5


def _parse_weight_gm(net_weight: str) -> int:
    """`"50g"` → 50, `"200g"` → 200, `"1kg"` → 1000. Defaults 50g."""
    if not net_weight:
        return 50
    s = str(net_weight).strip().lower().replace(" ", "")
    try:
        if s.endswith("kg"):
            return int(round(float(s[:-2]) * 1000))
        if s.endswith("g"):
            return int(float(s[:-1]))
        # bare number
        return int(float(s))
    except Exception:
        return 50


def compute_cart_weight_kg(items: list) -> float:
    """Estimate the total shipping weight (kg) from an in-cart items list.

    `items` may be either a list of dicts (from the order doc) or a list
    of B2BOrderItem-like objects with `.product_id`/`.quantity_boxes`.
    Adds a 15% packaging overhead so the courier weight is realistic.
    """
    grams = 0
    for it in items or []:
        if hasattr(it, "product_id"):
            pid = it.product_id
            qty = float(it.quantity_boxes or 0)
        elif isinstance(it, dict):
            pid = it.get("product_id")
            qty = float(it.get("quantity_boxes") or 0)
        else:
            continue
        prod = find_b2b_product(pid)
        if not prod or qty <= 0:
            continue
        pieces = pieces_for_quantity(prod, qty)
        gm_per_piece = _parse_weight_gm(prod.get("net_weight"))
        grams += pieces * gm_per_piece
    kg = grams / 1000.0
    kg = kg * 1.15  # 15% packaging overhead
    return max(round(kg, 2), MIN_BILLABLE_KG)


def _fallback_rate(weight_kg: float) -> float:
    """When Shiprocket is offline. Simple linear model, transparent to the retailer."""
    kg = max(weight_kg, MIN_BILLABLE_KG)
    extra = max(0.0, kg - 1.0)
    return round(FALLBACK_BASE_INR + extra * FALLBACK_PER_KG_INR, 2)


async def _resolve_pickup_pin() -> str:
    """Read the pickup pin from DB integrations (admin-editable) with env fallback."""
    try:
        from routers.admin.admin_integrations import get_effective
        pin = await get_effective("shiprocket_pickup_pin")
        if pin and len(pin) == 6 and pin.isdigit():
            return pin
    except Exception:
        pass
    return DEFAULT_PICKUP_PIN


async def get_b2b_shipping_quote(
    delivery_pincode: str,
    items: list,
    *,
    cod: bool = False,
) -> dict:
    """Return `{shipping_charges, courier_name, etd, weight_kg, fallback, ...}`
    for a B2B order. Never raises — safe to call from the pricing engine."""
    weight_kg = compute_cart_weight_kg(items)

    if not delivery_pincode or len(delivery_pincode) != 6 or not delivery_pincode.isdigit():
        rate = _fallback_rate(weight_kg)
        return {
            "success": False,
            "fallback": True,
            "reason": "invalid_pincode",
            "weight_kg": weight_kg,
            "shipping_charges": rate,
            "courier_name": "Standard (Fallback)",
            "etd": "5-7 days",
            "estimated_delivery_days": 7,
        }

    try:
        pickup = await _resolve_pickup_pin()
        from services.shiprocket_service import get_domestic_shipping_rates
        result = await get_domestic_shipping_rates(
            pickup_postcode=pickup,
            delivery_postcode=delivery_pincode,
            weight=weight_kg,
            cod=cod,
        )
    except Exception as e:
        logger.warning("Shiprocket rate lookup failed: %s", e)
        result = {"success": False, "error": str(e), "couriers": []}

    if result.get("success") and result.get("couriers"):
        cheapest = result["couriers"][0]
        return {
            "success": True,
            "fallback": False,
            "weight_kg": weight_kg,
            "pickup_pincode": await _resolve_pickup_pin(),
            "delivery_pincode": delivery_pincode,
            "shipping_charges": round(float(cheapest["rate"]), 2),
            "courier_name": cheapest.get("courier_name") or "Shiprocket",
            "etd": cheapest.get("etd") or "3-5 days",
            "estimated_delivery_days": cheapest.get("estimated_delivery_days") or 5,
            "options": result.get("couriers", [])[:5],
        }

    # Shiprocket errored or returned empty — use fallback but still return usable data
    rate = _fallback_rate(weight_kg)
    return {
        "success": False,
        "fallback": True,
        "reason": result.get("error", "shiprocket_unavailable"),
        "weight_kg": weight_kg,
        "shipping_charges": rate,
        "courier_name": "Standard (Fallback)",
        "etd": "5-7 days",
        "estimated_delivery_days": 7,
    }
