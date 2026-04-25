"""
B2B Pricing Engine.

Pure pricing/discount logic extracted from `routers/b2b_orders.py` so the
router stays slim and the math is independently testable.

Discount cascade (Indian GST law):
    Subtotal (line totals after per-line bulk-tier discount)
        → Loyalty Bonus (highest matching milestone on subtotal)
        → Voucher OR Cash Discount (mutually exclusive)
        = Taxable Value
        → GST (per line, on taxable value)
        → Credit Note (post-supply financial credit, applied on taxable + GST)
        = Grand Total

Returns are plain dicts so the FastAPI route can return them as-is.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from services.b2b_catalog import B2B_PRODUCTS
from services.b2b_loyalty import (
    applicable_milestone,
    get_retailer_quarter_purchases,
    list_active_milestones,
)
from services.b2b_settings import (
    applicable_tier_discount,
    get_cash_discount_percent,
    get_pricing_tiers,
)
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def calculate_line_total(
    quantity_boxes: float,
    price_per_box: float,
    price_per_half_box: float,
) -> float:
    """Box price × full-box count + half-box price × half count."""
    full_boxes = int(quantity_boxes)
    half_boxes = (quantity_boxes - full_boxes) * 2
    total = (full_boxes * price_per_box) + (half_boxes * price_per_half_box)
    return round(total, 2)


# ---------------------------------------------------------------------------
# Voucher / Credit-Note validation (DB layer)
# ---------------------------------------------------------------------------

async def validate_retailer_voucher(
    db, voucher_code: str, retailer_id: str, order_subtotal: float
) -> tuple[Optional[dict], Optional[str]]:
    """Return (info, error). Either info is set, or error is set."""
    voucher = await db.retailer_vouchers.find_one(
        {
            "code": voucher_code.upper(),
            "is_active": True,
            "$or": [{"retailer_id": retailer_id}, {"retailer_id": None}],
        }
    )
    if not voucher:
        return None, "Invalid or expired voucher code"

    if voucher.get("expires_at"):
        expiry = datetime.fromisoformat(voucher["expires_at"])
        if expiry < datetime.now(timezone.utc):
            return None, "Voucher has expired"

    if voucher.get("max_uses") and voucher.get("used_count", 0) >= voucher["max_uses"]:
        return None, "Voucher usage limit reached"

    if voucher.get("min_order") and order_subtotal < voucher["min_order"]:
        return None, f"Minimum order of ₹{voucher['min_order']} required"

    discount_amount = 0.0
    if voucher.get("discount_type") == "percentage":
        discount_amount = order_subtotal * voucher["discount_value"] / 100
        if voucher.get("max_discount"):
            discount_amount = min(discount_amount, voucher["max_discount"])
    else:
        discount_amount = voucher["discount_value"]

    return (
        {
            "voucher_id": voucher.get("id"),
            "code": voucher["code"],
            "discount_type": voucher["discount_type"],
            "discount_value": voucher["discount_value"],
            "discount_amount": round(discount_amount, 2),
        },
        None,
    )


async def validate_credit_note(
    db, cn_code: str, retailer_id: str
) -> tuple[Optional[dict], Optional[str]]:
    credit_note = await db.credit_notes.find_one(
        {"code": cn_code.upper(), "retailer_id": retailer_id, "status": "active"}
    )
    if not credit_note:
        return None, "Invalid or already used credit note"
    expiry = datetime.fromisoformat(credit_note["expires_at"])
    if expiry < datetime.now(timezone.utc):
        return None, "Credit note has expired"
    return (
        {
            "cn_id": credit_note.get("id"),
            "code": credit_note["code"],
            "amount": credit_note["amount"],
            "balance": credit_note.get("balance", credit_note["amount"]),
        },
        None,
    )


# ---------------------------------------------------------------------------
# Main pricing engine
# ---------------------------------------------------------------------------

async def calculate_b2b_order(
    db,
    *,
    retailer: dict,
    items: list,
    apply_cash_discount: bool = False,
    voucher_code: Optional[str] = None,
    credit_note_code: Optional[str] = None,
) -> dict:
    """Compute the full price breakdown for a B2B order.

    `items` should be a sequence with `.product_id` and `.quantity_boxes`.
    Raises HTTPException on validation errors so the caller can surface 400s.
    """
    if not items:
        raise HTTPException(status_code=400, detail="No items in order")

    order_items: list[dict] = []
    subtotal = 0.0
    total_tier_discount = 0.0

    for item in items:
        if item.quantity_boxes <= 0:
            continue
        if (item.quantity_boxes * 2) % 1 != 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be in multiples of 0.5 boxes",
            )

        product = next(
            (p for p in B2B_PRODUCTS if p["id"] == item.product_id), None
        )
        if not product:
            raise HTTPException(
                status_code=404, detail=f"Product {item.product_id} not found"
            )

        line_total_base = calculate_line_total(
            item.quantity_boxes,
            product["price_per_box"],
            product["price_per_half_box"],
        )

        tiers = await get_pricing_tiers(db, product["id"])
        tier_pct = applicable_tier_discount(tiers, item.quantity_boxes)
        tier_discount_amount = (
            round(line_total_base * tier_pct / 100, 2) if tier_pct else 0
        )
        line_total = round(line_total_base - tier_discount_amount, 2)

        gst_rate = product.get("gst_rate", 18)
        line_gst = round(line_total * gst_rate / 100, 2)

        order_items.append(
            {
                "product_id": item.product_id,
                "name": product["name"],
                "net_weight": product["net_weight"],
                "image": product["image"],
                "quantity_boxes": item.quantity_boxes,
                "price_per_box": product["price_per_box"],
                "price_per_half_box": product["price_per_half_box"],
                "line_total_base": line_total_base,
                "tier_discount_percent": tier_pct,
                "tier_discount_amount": tier_discount_amount,
                "line_total": line_total,
                "gst_rate": gst_rate,
                "gst_amount": line_gst,
                "hsn_code": product.get("hsn_code"),
            }
        )

        subtotal += line_total
        total_tier_discount += tier_discount_amount

    if not order_items:
        raise HTTPException(status_code=400, detail="No valid items in order")

    # Live cash discount percent from admin settings
    cash_discount_percent_setting = await get_cash_discount_percent(db)

    # Loyalty: based on retailer's paid purchase total this quarter.
    loyalty_milestones_active = await list_active_milestones(db)
    loyalty_state_quarter = await get_retailer_quarter_purchases(
        db, retailer["retailer_id"]
    )
    applied_loyalty = applicable_milestone(
        loyalty_milestones_active, loyalty_state_quarter["purchases_total"]
    )
    loyalty_discount = 0.0
    loyalty_discount_percent = 0.0
    if applied_loyalty:
        loyalty_discount_percent = float(applied_loyalty.get("discount_percent", 0))
        loyalty_discount = round(subtotal * loyalty_discount_percent / 100, 2)

    subtotal_after_loyalty = round(subtotal - loyalty_discount, 2)

    # Voucher and Cash discount are mutually exclusive
    voucher_discount = 0.0
    voucher_info = None
    cash_discount = 0.0

    if voucher_code:
        voucher_info, error = await validate_retailer_voucher(
            db, voucher_code, retailer["retailer_id"], subtotal
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        voucher_discount = voucher_info["discount_amount"]
    elif apply_cash_discount:
        cash_discount = round(
            subtotal_after_loyalty * cash_discount_percent_setting / 100, 2
        )

    # GST calculated on taxable value (after all known-at-supply discounts)
    taxable_value = round(
        max(0.0, subtotal_after_loyalty - voucher_discount - cash_discount), 2
    )

    total_gst = 0.0
    if subtotal > 0 and taxable_value > 0:
        factor = taxable_value / subtotal
        for oi in order_items:
            new_line_taxable = round(oi["line_total"] * factor, 2)
            oi["line_total_after_loyalty"] = new_line_taxable
            oi["taxable_value"] = new_line_taxable
            oi["gst_amount"] = round(new_line_taxable * oi["gst_rate"] / 100, 2)
            total_gst += oi["gst_amount"]
        total_gst = round(total_gst, 2)
    else:
        for oi in order_items:
            oi["line_total_after_loyalty"] = 0
            oi["taxable_value"] = 0
            oi["gst_amount"] = 0

    # Credit note (post-supply financial credit)
    cn_discount = 0.0
    cn_info = None
    if credit_note_code:
        cn_info, error = await validate_credit_note(
            db, credit_note_code, retailer["retailer_id"]
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        cn_discount = min(cn_info["balance"], taxable_value + total_gst)

    total_discount = loyalty_discount + voucher_discount + cash_discount + cn_discount
    grand_total = round(taxable_value + total_gst - cn_discount, 2)
    grand_total = max(0, grand_total)

    return {
        "items": order_items,
        "subtotal": subtotal,
        "loyalty_discount": loyalty_discount,
        "loyalty_discount_percent": loyalty_discount_percent,
        "loyalty_milestone": applied_loyalty,
        "quarter_purchases_total": loyalty_state_quarter["purchases_total"],
        "quarter_label": loyalty_state_quarter["quarter_label"],
        "subtotal_after_loyalty": subtotal_after_loyalty,
        "taxable_value": taxable_value,
        "gst_total": total_gst,
        "tier_discount_total": round(total_tier_discount, 2),
        "voucher_discount": voucher_discount,
        "voucher_code": voucher_code if voucher_info else None,
        "cash_discount": cash_discount,
        "cash_discount_percent": cash_discount_percent_setting if cash_discount > 0 else 0,
        "credit_note_discount": cn_discount,
        "credit_note_code": credit_note_code if cn_info else None,
        "total_discount": total_discount,
        "grand_total": grand_total,
        "retailer_gst": retailer.get("gst_number"),
        "retailer_address": {
            "business_name": retailer.get("business_name") or retailer.get("trade_name"),
            "address": retailer.get("address"),
            "city": retailer.get("city"),
            "state": retailer.get("state"),
            "pincode": retailer.get("pincode"),
        },
    }
