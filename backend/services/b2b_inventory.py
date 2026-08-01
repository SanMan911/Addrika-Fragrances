"""B2B inventory management — piece-level stock with carton math.

Concepts (per user spec, Feb 2026):
    ▸ 1 carton = `pieces_per_carton` pieces (default 32).
    ▸ 1 half-carton = pieces_per_carton / 2 pieces.
    ▸ Stock is tracked in PIECES on b2b_products.stock_pieces.
    ▸ Deductions are automatic on paid B2B orders.
    ▸ Admin can quick-adjust (increment/decrement) with a reason,
      logged to `b2b_inventory_log` for audit.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_PIECES_PER_CARTON = 32


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def pieces_for_quantity(product: dict, quantity_boxes: float) -> int:
    """Given a b2b_product doc + quantity_boxes (0.5 increments), return pieces.

    Preference order:
      1. product.pieces_per_carton × quantity_boxes  (new carton model)
      2. product.units_per_box × quantity_boxes      (legacy box model)
    """
    ppc = int(
        product.get("pieces_per_carton")
        or product.get("units_per_box")
        or DEFAULT_PIECES_PER_CARTON
    )
    return int(round(float(quantity_boxes) * ppc))


async def get_stock(db, product_id: str) -> int:
    doc = await db.b2b_products.find_one(
        {"id": product_id}, {"stock_pieces": 1, "_id": 0}
    )
    return int((doc or {}).get("stock_pieces") or 0)


async def list_stock(db) -> list[dict]:
    """Return full stock view: product name + stock pieces + carton equivalent."""
    docs = await db.b2b_products.find(
        {}, {"_id": 0, "id": 1, "name": 1, "net_weight": 1,
             "pieces_per_carton": 1, "units_per_box": 1,
             "stock_pieces": 1, "is_active": 1}
    ).sort("name", 1).to_list(500)
    out = []
    for d in docs:
        ppc = int(d.get("pieces_per_carton") or d.get("units_per_box") or DEFAULT_PIECES_PER_CARTON)
        pieces = int(d.get("stock_pieces") or 0)
        out.append({
            "id": d["id"],
            "name": d.get("name"),
            "net_weight": d.get("net_weight"),
            "is_active": d.get("is_active", True),
            "pieces_per_carton": ppc,
            "stock_pieces": pieces,
            "stock_cartons": round(pieces / ppc, 2) if ppc else 0,
        })
    return out


async def adjust_stock(
    db,
    *,
    product_id: str,
    delta_pieces: int,
    reason: str,
    admin_email: Optional[str] = None,
    note: Optional[str] = None,
    source_order_id: Optional[str] = None,
) -> dict:
    """Apply a delta (positive=in, negative=out). Persists to b2b_products +
    writes an audit row to b2b_inventory_log. Returns the new stock.

    Reasons commonly used: `manual_adjust`, `order_paid`, `restock`, `damage`,
    `return`, `offline_sale`, `correction`.
    """
    prod = await db.b2b_products.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise ValueError(f"Product {product_id} not found")

    before = int(prod.get("stock_pieces") or 0)
    after = before + int(delta_pieces)
    if after < 0:
        # Never let stock go negative — clamp to 0 but log the shortfall
        after = 0

    await db.b2b_products.update_one(
        {"id": product_id},
        {"$set": {"stock_pieces": after, "stock_updated_at": _now()}},
    )
    entry = {
        "id": f"INV-{uuid.uuid4().hex[:10].upper()}",
        "product_id": product_id,
        "delta_pieces": int(delta_pieces),
        "before": before,
        "after": after,
        "reason": reason,
        "note": note,
        "admin_email": admin_email,
        "source_order_id": source_order_id,
        "created_at": _now(),
    }
    await db.b2b_inventory_log.insert_one(dict(entry))
    entry.pop("_id", None)
    logger.info(
        "b2b-inventory: %s %+d pieces (was %d → %d) reason=%s",
        product_id, delta_pieces, before, after, reason,
    )
    return {"product_id": product_id, "before": before, "after": after, "entry": entry}


async def deduct_for_paid_order(db, order: dict) -> list[dict]:
    """Deduct pieces from stock for every item in a paid B2B order.
    Idempotent — skips if an `order_paid` log row already exists for this
    order_id + product_id combination.
    """
    order_id = order.get("order_id")
    if not order_id:
        return []
    results: list[dict] = []
    for item in order.get("items", []):
        pid = item.get("product_id")
        if not pid:
            continue
        # Idempotency guard
        existing = await db.b2b_inventory_log.find_one({
            "source_order_id": order_id,
            "product_id": pid,
            "reason": "order_paid",
        })
        if existing:
            continue

        prod = await db.b2b_products.find_one({"id": pid}, {"_id": 0})
        if not prod:
            continue
        qty_boxes = float(item.get("quantity_boxes") or 0)
        if qty_boxes <= 0:
            continue
        pieces = pieces_for_quantity(prod, qty_boxes)
        if pieces <= 0:
            continue
        try:
            res = await adjust_stock(
                db,
                product_id=pid,
                delta_pieces=-pieces,
                reason="order_paid",
                admin_email="system",
                note=f"Auto-deduct on paid B2B order",
                source_order_id=order_id,
            )
            results.append(res)
        except Exception as e:
            logger.warning("Stock deduction failed for %s / %s: %s", order_id, pid, e)
    return results


async def get_log(db, product_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    query = {"product_id": product_id} if product_id else {}
    return await db.b2b_inventory_log.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
