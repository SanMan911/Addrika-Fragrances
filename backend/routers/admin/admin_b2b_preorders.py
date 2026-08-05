"""Admin: Pre-Order Batch Allocation dashboard.

Groups every paid B2B pre-order by SKU so the production team can decide
what to manufacture next based on the aggregate demand (pieces booked
and token INR received).

Data source: `b2b_orders` where `is_preorder=True` and `payment_status="paid"`.
An order is considered "outstanding" until it hits a fulfilled/shipped/
delivered/cancelled state — those drop off the batch queue.
"""
from __future__ import annotations

from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Cookie, Request

from dependencies import db, require_admin
from services.b2b_catalog import B2B_PRODUCTS, pack_size_for


router = APIRouter(prefix="/admin/b2b/preorders", tags=["Admin B2B Pre-Orders"])


FULFILLED_STATES = {"fulfilled", "shipped", "delivered", "cancelled", "closed"}


@router.get("/batch-allocation")
async def batch_allocation(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Aggregate outstanding paid pre-orders per SKU.

    Returns:
        skus: [{
            product_id, name, category, pieces_per_carton,
            preorders_count, retailers_count,
            pieces_booked, boxes_booked,
            token_paid_inr, balance_due_inr, grand_total_inr,
            first_booked_at, last_booked_at,
            current_stock_pieces, stock_status
        }]
        totals: {orders, retailers, pieces, token_paid_inr, balance_due_inr}
    """
    await require_admin(request, session_token)

    # Only paid pre-orders that haven't been fulfilled yet.
    cursor = db.b2b_orders.find(
        {
            "is_preorder": True,
            "payment_status": "paid",
            "order_status": {"$nin": list(FULFILLED_STATES)},
        },
        {"_id": 0},
    )
    orders = await cursor.to_list(length=5000)

    products_by_id = {p["id"]: p for p in B2B_PRODUCTS}

    per_sku: dict[str, dict] = defaultdict(lambda: {
        "preorders_count": 0,
        "retailer_ids": set(),
        "pieces_booked": 0,
        "boxes_booked": 0.0,
        "token_paid_inr": 0.0,
        "balance_due_inr": 0.0,
        "grand_total_inr": 0.0,
        "first_booked_at": None,
        "last_booked_at": None,
    })
    total_retailers: set[str] = set()
    total_orders = 0
    total_pieces = 0
    total_token = 0.0
    total_balance = 0.0

    for order in orders:
        total_orders += 1
        retailer_id = order.get("retailer_id")
        if retailer_id:
            total_retailers.add(retailer_id)
        # Distribute this order's token/balance proportional to each line's
        # value relative to the invoice subtotal, so per-SKU token totals
        # add up to the order-level token.
        subtotal = float(order.get("subtotal") or 0)
        order_token = float(order.get("token_amount_inr") or 0)
        order_balance = float(order.get("balance_due_inr") or 0)
        created_at = order.get("created_at")

        for item in order.get("items", []):
            pid = item.get("product_id")
            if not pid:
                continue
            product = products_by_id.get(pid, {})
            ppc = pack_size_for(product) if product else 1
            qty_boxes = float(item.get("quantity_boxes") or 0)
            pieces = int(round(qty_boxes * ppc))
            line_total = float(item.get("line_total") or 0)
            weight = (line_total / subtotal) if subtotal > 0 else 0

            bucket = per_sku[pid]
            bucket["preorders_count"] += 1
            bucket["retailer_ids"].add(retailer_id)
            bucket["pieces_booked"] += pieces
            bucket["boxes_booked"] = round(bucket["boxes_booked"] + qty_boxes, 2)
            bucket["token_paid_inr"] = round(
                bucket["token_paid_inr"] + order_token * weight, 2
            )
            bucket["balance_due_inr"] = round(
                bucket["balance_due_inr"] + order_balance * weight, 2
            )
            bucket["grand_total_inr"] = round(
                bucket["grand_total_inr"] + line_total, 2
            )
            if created_at:
                if not bucket["first_booked_at"] or created_at < bucket["first_booked_at"]:
                    bucket["first_booked_at"] = created_at
                if not bucket["last_booked_at"] or created_at > bucket["last_booked_at"]:
                    bucket["last_booked_at"] = created_at

            total_pieces += pieces

    for bucket in per_sku.values():
        total_token += bucket["token_paid_inr"]
        total_balance += bucket["balance_due_inr"]

    # Materialize the per-SKU rows sorted by pieces booked (production priority).
    skus = []
    for pid, bucket in per_sku.items():
        product = products_by_id.get(pid, {})
        skus.append({
            "product_id": pid,
            "name": product.get("name") or pid,
            "category": product.get("category"),
            "pieces_per_carton": pack_size_for(product) if product else None,
            "preorders_count": bucket["preorders_count"],
            "retailers_count": len(bucket["retailer_ids"]),
            "pieces_booked": bucket["pieces_booked"],
            "boxes_booked": bucket["boxes_booked"],
            "token_paid_inr": bucket["token_paid_inr"],
            "balance_due_inr": bucket["balance_due_inr"],
            "grand_total_inr": bucket["grand_total_inr"],
            "first_booked_at": bucket["first_booked_at"],
            "last_booked_at": bucket["last_booked_at"],
            "current_stock_pieces": int(product.get("stock_pieces") or 0),
            "stock_status": product.get("stock_status") or "unknown",
        })
    skus.sort(key=lambda s: s["pieces_booked"], reverse=True)

    return {
        "skus": skus,
        "totals": {
            "orders": total_orders,
            "retailers": len(total_retailers),
            "pieces": total_pieces,
            "token_paid_inr": round(total_token, 2),
            "balance_due_inr": round(total_balance, 2),
        },
    }


@router.get("/by-sku/{product_id}")
async def preorders_for_sku(
    product_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Drill-down: every outstanding pre-order for a specific SKU with
    retailer contact info so production can start dispatch calls."""
    await require_admin(request, session_token)

    products_by_id = {p["id"]: p for p in B2B_PRODUCTS}
    product = products_by_id.get(product_id) or {}
    ppc = pack_size_for(product) if product else 1

    cursor = db.b2b_orders.find(
        {
            "is_preorder": True,
            "payment_status": "paid",
            "order_status": {"$nin": list(FULFILLED_STATES)},
            "items.product_id": product_id,
        },
        {"_id": 0},
    ).sort("created_at", 1)
    orders = await cursor.to_list(length=2000)

    rows = []
    for order in orders:
        item = next(
            (it for it in order.get("items", []) if it.get("product_id") == product_id),
            None,
        )
        if not item:
            continue
        qty_boxes = float(item.get("quantity_boxes") or 0)
        rows.append({
            "order_id": order.get("order_id"),
            "retailer_id": order.get("retailer_id"),
            "retailer_email": order.get("retailer_email"),
            "retailer_phone": order.get("retailer_phone"),
            "business_name": (order.get("billing_address") or {}).get("business_name"),
            "quantity_boxes": qty_boxes,
            "pieces": int(round(qty_boxes * ppc)),
            "line_total_inr": float(item.get("line_total") or 0),
            "order_token_inr": float(order.get("token_amount_inr") or 0),
            "order_balance_due_inr": float(order.get("balance_due_inr") or 0),
            "order_grand_total_inr": float(order.get("grand_total") or 0),
            "created_at": order.get("created_at"),
            "order_status": order.get("order_status"),
        })

    return {
        "product_id": product_id,
        "product_name": product.get("name") or product_id,
        "pieces_per_carton": ppc,
        "current_stock_pieces": int(product.get("stock_pieces") or 0),
        "stock_status": product.get("stock_status") or "unknown",
        "orders": rows,
    }
