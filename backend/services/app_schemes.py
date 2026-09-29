"""Scheme auto-pricing.

Admins publish trade schemes in the dashboard; this decides which one a cart
qualifies for and how much it saves. It runs inside the pricing engine, so the
order pad, the order preview and the placed order all agree — a scheme can
never be applied by the phone alone.

Rules, kept deliberately predictable for a trade desk:
  * A scheme can be scoped to everything, to categories, or to specific SKUs.
  * `min_boxes` is measured in BOXES — the unit the retailer types.
  * The discount applies only to the QUALIFYING lines, not the whole cart.
  * Schemes do NOT stack: the highest `priority` wins, ties broken by the
    bigger saving, so the retailer always gets the better of two equals.
"""
from __future__ import annotations

import logging
from typing import Iterable, Optional

from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)


async def active_schemes() -> list[dict]:
    """Published schemes that are live today."""
    conn = await _connect()
    if conn is None:
        return []
    try:
        rows = await conn.fetch(
            """
            select id, title, description, discount_pct, min_boxes, min_order_value,
                   max_discount_inr, applies_to, categories, skus, priority,
                   valid_from, valid_to
            from public.app_schemes
            where is_active
              and coalesce(discount_pct, 0) > 0
              and (valid_from is null or valid_from <= current_date)
              and (valid_to   is null or valid_to   >= current_date)
            order by priority desc, discount_pct desc
            """
        )
        return [dict(r) for r in rows]
    except Exception as e:
        # Pricing must never break because the scheme table is unreachable.
        logger.error(f"could not load schemes: {e}")
        return []
    finally:
        await conn.close()


def _line_qualifies(scheme: dict, line: dict) -> bool:
    applies_to = scheme.get("applies_to") or "all"
    if applies_to == "all":
        return True
    if applies_to == "category":
        cats = {c.lower() for c in (scheme.get("categories") or [])}
        return bool(cats) and (line.get("category") or "").lower() in cats
    if applies_to == "sku":
        return line.get("product_id") in set(scheme.get("skus") or [])
    return False


def evaluate(schemes: Iterable[dict], lines: list[dict]) -> Optional[dict]:
    """Best applicable scheme for these cart lines, or None.

    `lines` need `product_id`, `category`, `quantity_boxes` and `line_total`.
    """
    best: Optional[dict] = None

    for scheme in schemes:
        qualifying = [ln for ln in lines if _line_qualifies(scheme, ln)]
        if not qualifying:
            continue

        boxes = sum(float(ln.get("quantity_boxes") or 0) for ln in qualifying)
        eligible_value = round(
            sum(float(ln.get("line_total") or 0) for ln in qualifying), 2
        )
        if eligible_value <= 0:
            continue

        min_boxes = scheme.get("min_boxes")
        if min_boxes is not None and boxes < float(min_boxes):
            continue
        min_value = scheme.get("min_order_value")
        if min_value is not None and eligible_value < float(min_value):
            continue

        pct = float(scheme.get("discount_pct") or 0)
        discount = round(eligible_value * pct / 100, 2)
        cap = scheme.get("max_discount_inr")
        if cap is not None:
            discount = min(discount, float(cap))
        discount = round(min(discount, eligible_value), 2)
        if discount <= 0:
            continue

        candidate = {
            "scheme_id": str(scheme["id"]),
            "title": scheme["title"],
            "discount_percent": pct,
            "discount_amount": discount,
            "eligible_value": eligible_value,
            "eligible_boxes": boxes,
            "applies_to": scheme.get("applies_to") or "all",
            "priority": int(scheme.get("priority") or 100),
            "capped": cap is not None and discount >= float(cap),
        }

        if best is None or (candidate["priority"], candidate["discount_amount"]) > (
            best["priority"],
            best["discount_amount"],
        ):
            best = candidate

    return best


def next_threshold(schemes: Iterable[dict], lines: list[dict]) -> Optional[dict]:
    """The nearest scheme the retailer has NOT yet unlocked.

    Powers the "add 2 more boxes to save ₹X" nudge on the order pad.
    """
    nearest: Optional[dict] = None

    for scheme in schemes:
        min_boxes = scheme.get("min_boxes")
        if min_boxes is None:
            continue
        qualifying = [ln for ln in lines if _line_qualifies(scheme, ln)]
        boxes = sum(float(ln.get("quantity_boxes") or 0) for ln in qualifying)
        shortfall = float(min_boxes) - boxes
        # Only nudge when they've started on the right products.
        if shortfall <= 0 or not qualifying:
            continue
        candidate = {
            "scheme_id": str(scheme["id"]),
            "title": scheme["title"],
            "discount_percent": float(scheme.get("discount_pct") or 0),
            "boxes_needed": round(shortfall, 2),
        }
        if nearest is None or candidate["boxes_needed"] < nearest["boxes_needed"]:
            nearest = candidate

    return nearest


async def apply_to_lines(lines: list[dict]) -> dict:
    """Convenience wrapper used by the pricing engine."""
    schemes = await active_schemes()
    if not schemes:
        return {"scheme": None, "next_scheme": None}
    return {
        "scheme": evaluate(schemes, lines),
        "next_scheme": next_threshold(schemes, lines),
    }
