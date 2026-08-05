"""
Shared B2B product catalog.

Backed by MongoDB collection `b2b_products` (April 2026). The original
hard-coded `B2B_PRODUCTS` list now serves as a one-time seed if the
collection is empty. An in-memory cache is kept warm to avoid hitting
the DB inside the pricing engine.

Public API (sync, cache-backed — used in hot paths):
    B2B_PRODUCTS               # list[dict]
    find_b2b_product(id)       # dict | None
    get_b2b_catalog()          # list[dict]

Async helpers:
    refresh_b2b_catalog(db)    # repopulate cache from DB
    seed_b2b_catalog(db)       # idempotent first-run seed
    upsert_b2b_product(db, p)  # admin update
    delete_b2b_product(db, id) # admin delete
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# B2B Price is 76.52% of MRP
B2B_DISCOUNT_RATE = 0.7652

# User spec (Feb 2026): pack size varies by category.
#   ▸ Dhoop, Bakhoor            → 1 carton  = 32 pieces (half = 16)
#   ▸ Agarbatti Jar (200g)      → 1 carton  = 16 pieces (half = 8)
#   ▸ Agarbatti (50g / 100g)    → 1 packet  = 12 pieces (half = 6)
# Backwards-compat: existing rows without `category` fall back to
# `units_per_box` so historical pricing math is unchanged.
DEFAULT_PIECES_PER_CARTON = 32

CATEGORY_PACK_SIZE = {
    "dhoop": 32,
    "bakhoor": 32,
    "agarbatti_jar": 16,   # 200g jars
    "agarbatti": 12,       # 50g / 100g dozen packets
}

CATEGORY_UNIT_LABEL = {
    "dhoop": "carton",
    "bakhoor": "carton",
    "agarbatti_jar": "carton",
    "agarbatti": "packet",
}


def pack_size_for(product: dict) -> int:
    """Return pieces per selling unit (carton/packet) for a b2b_product.

    Order of precedence: explicit `pieces_per_carton` → category default →
    legacy `units_per_box` → 32 (system default). Never returns 0.
    """
    ppc = product.get("pieces_per_carton")
    if ppc:
        return int(ppc)
    cat = (product.get("category") or "").lower()
    if cat in CATEGORY_PACK_SIZE:
        return CATEGORY_PACK_SIZE[cat]
    if product.get("units_per_box"):
        return int(product["units_per_box"])
    return DEFAULT_PIECES_PER_CARTON


def unit_label_for(product: dict) -> str:
    cat = (product.get("category") or "").lower()
    return CATEGORY_UNIT_LABEL.get(cat, "carton")


def calculate_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B box price at 76.52% of MRP."""
    return round(units_per_box * mrp_per_unit * B2B_DISCOUNT_RATE)


def calculate_half_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B half-box price at 76.52% of MRP."""
    return round((units_per_box / 2) * mrp_per_unit * B2B_DISCOUNT_RATE)


def calculate_carton_price(pieces_per_carton: int, mrp_per_unit: float) -> int:
    """Carton-level B2B price at 76.52% of MRP × pieces_per_carton."""
    return round(pieces_per_carton * mrp_per_unit * B2B_DISCOUNT_RATE)


def calculate_half_carton_price(pieces_per_carton: int, mrp_per_unit: float) -> int:
    """Half-carton price = pieces_per_carton / 2 × MRP × discount."""
    return round((pieces_per_carton / 2) * mrp_per_unit * B2B_DISCOUNT_RATE)


# ---------------------------------------------------------------------------
# Seed data — used only when the MongoDB collection is empty
# ---------------------------------------------------------------------------
_SEED_PRODUCTS = [
    {
        "id": "kesar-chandan-b2b", "product_id": "kesar-chandan",
        "name": "Kesar Chandan", "category": "agarbatti",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "pieces_per_carton": 12,  # agarbatti dozen packet
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "kesar-chandan-200-b2b", "product_id": "kesar-chandan",
        "name": "Kesar Chandan", "category": "agarbatti_jar",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "pieces_per_carton": 16,  # jars, 16/carton
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "regal-rose-b2b", "product_id": "regal-rose", "name": "Regal Rose",
        "category": "agarbatti",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "pieces_per_carton": 12,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "regal-rose-200-b2b", "product_id": "regal-rose", "name": "Regal Rose",
        "category": "agarbatti_jar",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "pieces_per_carton": 16,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "oriental-oudh-b2b", "product_id": "oriental-oudh", "name": "Oriental Oudh",
        "category": "agarbatti",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "pieces_per_carton": 12,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "oriental-oudh-200-b2b", "product_id": "oriental-oudh", "name": "Oriental Oudh",
        "category": "agarbatti_jar",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "pieces_per_carton": 16,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "bold-bakhoor-b2b", "product_id": "bold-bakhoor", "name": "Bold Bakhoor",
        "category": "bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "pieces_per_carton": 32,  # bakhoor cartons — 32/pcs
        "price_per_box": calculate_carton_price(32, 110),
        "price_per_half_box": calculate_half_carton_price(32, 110),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "bold-bakhoor-200-b2b", "product_id": "bold-bakhoor", "name": "Bold Bakhoor",
        "category": "bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "pieces_per_carton": 32,
        "price_per_box": calculate_carton_price(32, 402),
        "price_per_half_box": calculate_half_carton_price(32, 402),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "royal-kewda-b2b", "product_id": "royal-kewda", "name": "Royal Kewda",
        "category": "agarbatti",
        "image": "https://images.unsplash.com/photo-1627769916425-74c2344a3439?w=800&q=80",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "pieces_per_carton": 12,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    {
        "id": "royal-kewda-200-b2b", "product_id": "royal-kewda", "name": "Royal Kewda",
        "category": "agarbatti_jar",
        "image": "https://images.unsplash.com/photo-1627769916425-74c2344a3439?w=800&q=80",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "pieces_per_carton": 16,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
    },
    # ── Ready-to-Use Dhoop (Dhoop + Ceramic Stand + Matchbox in every pack) ──
    {
        "id": "mystical-meharishi-b2b", "product_id": "mystical-meharishi",
        "name": "Mystical Meharishi",
        "category": "dhoop",
        "image": "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg",
        "net_weight": "100g", "units_per_box": 32, "mrp_per_unit": 149,
        "pieces_per_carton": 32,
        "price_per_box": calculate_carton_price(32, 149),
        "price_per_half_box": calculate_half_carton_price(32, 149),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
        "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"],
        "ready_to_use": True,
    },
    {
        "id": "belpatra-dhoop-b2b", "product_id": "bilvapatra-fragrance",
        "name": "Belpatra Dhoop",
        "category": "dhoop",
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/82eb095d8e73cc34f8daa37d10cebfc02578fa81cd77d69238cc06a2fa3c22c6.png",
        "net_weight": "100g", "units_per_box": 32, "mrp_per_unit": 149,
        "pieces_per_carton": 32,
        "price_per_box": calculate_carton_price(32, 149),
        "price_per_half_box": calculate_half_carton_price(32, 149),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
        "stock_pieces": 0, "stock_status": "out_of_stock", "restock_eta_days": 15,
        "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"],
        "ready_to_use": True,
    },
]


# ---------------------------------------------------------------------------
# Cache (warmed at backend startup; used in pricing hot paths)
# ---------------------------------------------------------------------------
B2B_PRODUCTS: list[dict] = list(_SEED_PRODUCTS)


def _enrich_carton_fields(p: dict) -> dict:
    """Backfill carton view + stock status fields onto a product dict.

    Adds `pieces_per_carton` (category-aware), `unit_label`
    (carton|packet), `price_per_carton`, `price_per_half_carton`,
    `price_per_piece`, and a `stock_status_display` block the frontend
    can render as an "Out of Stock — ETA 15 days" pill.
    """
    ppc = pack_size_for(p)
    mrp = float(p.get("mrp_per_unit") or 0)
    p["pieces_per_carton"] = ppc
    p["unit_label"] = unit_label_for(p)
    p["price_per_carton"] = p.get("price_per_carton") or calculate_carton_price(ppc, mrp)
    p["price_per_half_carton"] = p.get("price_per_half_carton") or calculate_half_carton_price(ppc, mrp)
    p["price_per_piece"] = round(mrp * B2B_DISCOUNT_RATE, 2)
    p["mrp_per_piece"] = round(mrp, 2)
    stock_pieces = int(p.get("stock_pieces") or 0)
    p["stock_pieces"] = stock_pieces
    p["stock_cartons"] = round(stock_pieces / ppc, 2) if ppc else 0
    p["max_order_boxes"] = round(stock_pieces / ppc, 2) if ppc else 0
    # Compose stock status display for the storefront
    status = (p.get("stock_status") or "").lower() or ("in_stock" if stock_pieces > 0 else "out_of_stock")
    eta_days = int(p.get("restock_eta_days") or 15)
    note = p.get("restock_note") or ""
    p["stock_status"] = status
    p["stock_status_display"] = _stock_status_message(status, eta_days, note, stock_pieces, ppc)
    return p


def _stock_status_message(status: str, eta_days: int, note: str, stock_pieces: int, ppc: int) -> dict:
    """Return `{label, tone, is_orderable, subtext}` for UI rendering."""
    if status == "in_stock" and stock_pieces > 0:
        low = stock_pieces < ppc
        return {
            "label": "Low Stock" if low else "In Stock",
            "tone": "amber" if low else "emerald",
            "is_orderable": True,
            "subtext": (f"Only {stock_pieces} pieces left" if low else None),
        }
    # Any non-in-stock status blocks orders and surfaces the ETA
    map_ = {
        "out_of_stock":  ("Out of Stock", "Restocking in Progress"),
        "restocking":    ("Restocking",   "Restocking in Progress"),
        "manufacturing": ("Manufacturing", "Manufacturing in Progress"),
        "delayed":       ("Delayed",      "Delay in production/shipment"),
    }
    label, reason = map_.get(status, ("Out of Stock", "Restocking in Progress"))
    return {
        "label": label,
        "tone": "rose",
        "is_orderable": False,
        "subtext": f"{reason} · Available ETA {eta_days} days" + (f" · {note}" if note else ""),
    }


def find_b2b_product(b2b_product_id: str) -> Optional[dict]:
    """Return the B2B product dict by id, or None. Uses the cache."""
    for p in B2B_PRODUCTS:
        if p["id"] == b2b_product_id:
            return _enrich_carton_fields(dict(p))
    return None


def get_b2b_catalog() -> list[dict]:
    """Public list of B2B products from the cache (carton view enriched)."""
    return [_enrich_carton_fields(dict(p)) for p in B2B_PRODUCTS]


# ---------------------------------------------------------------------------
# DB-backed accessors
# ---------------------------------------------------------------------------

async def refresh_b2b_catalog(db) -> int:
    """Repopulate the in-memory cache from MongoDB. Returns size."""
    global B2B_PRODUCTS
    docs = await db.b2b_products.find(
        {"$or": [{"is_active": {"$ne": False}}, {"is_active": {"$exists": False}}]},
        {"_id": 0},
    ).sort("id", 1).to_list(500)
    if docs:
        B2B_PRODUCTS = docs
    else:
        B2B_PRODUCTS = list(_SEED_PRODUCTS)
    logger.info(f"B2B catalog cache refreshed: {len(B2B_PRODUCTS)} products")
    return len(B2B_PRODUCTS)


async def seed_b2b_catalog(db) -> int:
    """Idempotent first-run seed of the b2b_products collection.

    Also backfills newly-introduced fields (`category`, `stock_pieces`,
    `stock_status`, `pieces_per_carton`) on rows that were seeded before
    the carton-math + stock-status model existed — so existing deployments
    show up correctly in the admin inventory dashboard after an upgrade.
    """
    count = await db.b2b_products.count_documents({})
    if count == 0 and _SEED_PRODUCTS:
        await db.b2b_products.insert_many([dict(p) for p in _SEED_PRODUCTS])
        logger.info(f"Seeded {len(_SEED_PRODUCTS)} B2B products into MongoDB")
        return len(_SEED_PRODUCTS)

    # Backfill missing fields on existing rows (idempotent — sets only if unset)
    backfilled = 0
    for seed in _SEED_PRODUCTS:
        updates: dict = {}
        existing = await db.b2b_products.find_one({"id": seed["id"]}, {"_id": 0})
        if not existing:
            # Row not in DB — insert the whole seed row
            await db.b2b_products.insert_one(dict(seed))
            backfilled += 1
            continue
        # Fields that must exist for the admin inventory list + stock guards
        for field in ("category", "pieces_per_carton", "stock_pieces",
                      "stock_status", "restock_eta_days", "is_active"):
            if existing.get(field) in (None, ""):
                updates[field] = seed.get(field, 0 if field == "stock_pieces"
                                         else "out_of_stock" if field == "stock_status"
                                         else 15 if field == "restock_eta_days"
                                         else True if field == "is_active"
                                         else None)
        if updates:
            await db.b2b_products.update_one({"id": seed["id"]}, {"$set": updates})
            backfilled += 1

    if backfilled:
        logger.info(f"Backfilled {backfilled} B2B products with carton/stock fields")
    else:
        logger.info(f"B2B catalog already fully seeded ({count} products)")
    return backfilled


async def upsert_b2b_product(db, product: dict) -> dict:
    """Admin: create or update a B2B product. Refreshes the cache."""
    pid = product.get("id")
    if not pid:
        raise ValueError("product.id is required")
    await db.b2b_products.update_one(
        {"id": pid}, {"$set": product}, upsert=True
    )
    await refresh_b2b_catalog(db)
    return product


async def delete_b2b_product(db, product_id: str) -> bool:
    """Admin: hard-delete a B2B product. Refreshes the cache."""
    res = await db.b2b_products.delete_one({"id": product_id})
    if res.deleted_count:
        await refresh_b2b_catalog(db)
        return True
    return False
