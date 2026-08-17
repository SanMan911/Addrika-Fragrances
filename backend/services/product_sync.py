"""
Unified product sync: mirror the master B2C `products` collection into
the B2B `b2b_products` collection so a single admin action creates
storefront + wholesale + brochure listings in one shot.

Concept:
    ▸ `products` (B2C) is the SOURCE OF TRUTH for name/images/description/MRP.
    ▸ Every B2C size ⇒ one matching B2B SKU:
          id = f"{product.id}-{slug(size)}-b2b"
          product_id = product.id      # link back to B2C
    ▸ `stock_pieces` on the B2B row is the AUTHORITATIVE inventory —
      shared across both channels. A B2C sale of 1 unit deducts 1 piece
      from the same B2B row.
    ▸ MRP → automatic B2B price at `B2B_DISCOUNT_RATE` × MRP × pack size.
    ▸ Category derived from B2C product `type` / `category`:
          agarbatti + size ≥ 200g → agarbatti_jar
          dhoop / bakhoor  → dhoop / bakhoor
          else → agarbatti

Used by:
    ▸ `admin_products.py` on POST/PUT (unified add/edit form)
    ▸ `orders.py` verify-payment on B2C paid orders (stock deduction)
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from services.b2b_catalog import (
    B2B_DISCOUNT_RATE,
    CATEGORY_PACK_SIZE,
    calculate_carton_price,
    calculate_half_carton_price,
    refresh_b2b_catalog,
)
from services.b2b_inventory import adjust_stock

logger = logging.getLogger(__name__)


def _slug_size(size: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (size or "").lower()).strip("-")


def _size_grams(size: str) -> int:
    """Best-effort extraction of grams from labels like '50g', '200g', '125g'."""
    m = re.search(r"(\d+)\s*g", (size or "").lower())
    return int(m.group(1)) if m else 0


def _category_and_pack(product: dict, size: str) -> tuple[str, int]:
    """Decide B2B category + pieces_per_carton for a B2C product+size pair.

    Rules (per user spec, Feb 2026):
        ▸ product.type in ('dhoop','bakhoor')  → same category, 32/carton
        ▸ agarbatti 200g+                       → agarbatti_jar, 16/carton
        ▸ everything else agarbatti-like        → agarbatti, 12/packet
    """
    ptype = (product.get("type") or product.get("category") or "").lower()
    if ptype in ("dhoop", "bakhoor"):
        return ptype, CATEGORY_PACK_SIZE.get(ptype, 32)
    grams = _size_grams(size)
    if grams >= 200:
        return "agarbatti_jar", CATEGORY_PACK_SIZE["agarbatti_jar"]
    return "agarbatti", CATEGORY_PACK_SIZE["agarbatti"]


def _b2b_id_for(product_id: str, size: str) -> str:
    return f"{product_id}-{_slug_size(size)}-b2b"


def build_b2b_sku(product: dict, size_dict: dict) -> dict:
    """Return the b2b_products row for a single (product, size) pair.
    Does not persist — caller decides insert vs. update."""
    pid = product["id"]
    size_label = size_dict.get("size") or ""
    mrp = float(size_dict.get("mrp") or size_dict.get("price") or 0)
    category, ppc = _category_and_pack(product, size_label)
    # Image priority: size images[0] → product.image
    imgs = size_dict.get("images") or []
    image = imgs[0] if imgs else (product.get("image") or "")
    gst_rate = 18 if category in ("dhoop", "bakhoor") else 5
    hsn = "33074900" if category in ("dhoop", "bakhoor") else "33074100"
    return {
        "id": _b2b_id_for(pid, size_label),
        "product_id": pid,
        "name": product.get("name") or pid,
        "category": category,
        "image": image,
        "net_weight": size_label,
        "units_per_box": ppc,
        "mrp_per_unit": mrp,
        "pieces_per_carton": ppc,
        "price_per_box": calculate_carton_price(ppc, mrp),
        "price_per_half_box": calculate_half_carton_price(ppc, mrp),
        "price_per_carton": calculate_carton_price(ppc, mrp),
        "price_per_half_carton": calculate_half_carton_price(ppc, mrp),
        "min_order": 0.5,
        "gst_rate": gst_rate,
        "hsn_code": hsn,
        "is_active": True,
        "restock_eta_days": 15,
        "includes": size_dict.get("includes"),
        "ready_to_use": bool(size_dict.get("includes")),
    }


async def mirror_b2c_product(db, product: dict) -> list[dict]:
    """Upsert one B2B SKU per B2C size. Preserves existing stock so a
    product re-save never nukes inventory. Returns the persisted rows.

    Reuses any legacy `b2b_products` row already keyed to this
    `product_id + net_weight` so we never create duplicate SKUs for the
    same physical variant.
    """
    saved: list[dict] = []
    for size_dict in product.get("sizes") or []:
        sku = build_b2b_sku(product, size_dict)

        # Reuse legacy SKU id if one already exists for this variant
        legacy = await db.b2b_products.find_one(
            {"product_id": product["id"], "net_weight": size_dict.get("size")},
            {"_id": 0},
        )
        if legacy and legacy.get("id") != sku["id"]:
            sku["id"] = legacy["id"]
        existing = legacy or await db.b2b_products.find_one({"id": sku["id"]}, {"_id": 0})

        # Opening stock: only applied when the row is brand-new AND admin
        # explicitly passed a positive `opening_stock` on this size.
        opening_stock = int(size_dict.get("opening_stock") or 0)

        if existing:
            # Preserve stock and stock_status on updates; overwrite everything else
            sku["stock_pieces"] = int(existing.get("stock_pieces") or 0)
            sku["stock_status"] = existing.get("stock_status") or (
                "in_stock" if sku["stock_pieces"] > 0 else "out_of_stock"
            )
            await db.b2b_products.update_one(
                {"id": sku["id"]}, {"$set": sku}, upsert=False
            )
        else:
            sku["stock_pieces"] = opening_stock
            sku["stock_status"] = "in_stock" if opening_stock > 0 else "out_of_stock"
            await db.b2b_products.insert_one(dict(sku))

        saved.append(sku)

    await refresh_b2b_catalog(db)
    logger.info(
        "Unified sync: mirrored %d B2B SKUs for B2C product '%s'",
        len(saved), product.get("id"),
    )

    # Best-effort Supabase mirror for each B2B SKU (non-blocking)
    try:
        from services.supabase_sync import mirror_product_upsert
        for sku in saved:
            mirror_product_upsert(sku, channel="b2b")
    except Exception:
        pass

    return saved


async def deduct_stock_for_b2c_order(db, order: dict) -> list[dict]:
    """Deduct pieces from `b2b_products.stock_pieces` for every B2C paid
    order line. Idempotent — an `order_paid` log row per order+SKU acts
    as the guard.

    SKU lookup: primary match by `product_id + net_weight`. Falls back to
    the canonical `{pid}-{slug(size)}-b2b` id so newly-mirrored SKUs work
    even when legacy ids don't exist.
    """
    order_number = order.get("order_number") or order.get("id")
    if not order_number:
        return []
    results: list[dict] = []
    for item in order.get("items") or []:
        pid = item.get("productId") or item.get("product_id")
        size = item.get("size")
        qty = int(item.get("quantity") or 0)
        if not pid or not size or qty <= 0:
            continue
        # 1) match by product_id + net_weight (works with legacy ids)
        prod = await db.b2b_products.find_one(
            {"product_id": pid, "net_weight": size}, {"_id": 0}
        )
        # 2) fall back to canonical mirrored id
        if not prod:
            prod = await db.b2b_products.find_one(
                {"id": _b2b_id_for(pid, size)}, {"_id": 0}
            )
        if not prod:
            logger.debug("No mirrored B2B SKU for B2C order line %s/%s", pid, size)
            continue
        sku_id = prod["id"]
        already = await db.b2b_inventory_log.find_one({
            "source_order_id": order_number,
            "product_id": sku_id,
            "reason": "order_paid",
        })
        if already:
            continue
        try:
            res = await adjust_stock(
                db,
                product_id=sku_id,
                delta_pieces=-qty,
                reason="order_paid",
                admin_email="system-b2c",
                note=f"B2C order {order_number} auto-deduct",
                source_order_id=order_number,
            )
            results.append(res)
        except Exception as e:
            logger.warning("Unified deduction failed for %s/%s: %s", order_number, sku_id, e)
    return results


def enrich_b2c_products_with_stock(products: list[dict], b2b_rows: list[dict]) -> list[dict]:
    """Attach the shared stock number onto B2C product sizes so the
    storefront can show "Only X left" from the same source of truth.

    Match is done via `product_id + net_weight` (case-insensitive) so
    legacy B2B rows with non-standard ids (`kesar-chandan-200-b2b`)
    still bind correctly to the new mirrored SKUs.
    """
    def key(pid: str, size: str) -> str:
        return f"{(pid or '').lower()}|{(size or '').lower().strip()}"

    stock_map: dict[str, int] = {}
    for r in b2b_rows:
        stock_map[key(r.get("product_id"), r.get("net_weight"))] = int(r.get("stock_pieces") or 0)

    for p in products:
        for size in p.get("sizes") or []:
            k = key(p["id"], size.get("size") or "")
            if k in stock_map:
                size["stock"] = stock_map[k]
    return products
