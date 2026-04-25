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


def calculate_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B box price at 76.52% of MRP."""
    return round(units_per_box * mrp_per_unit * B2B_DISCOUNT_RATE)


def calculate_half_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B half-box price at 76.52% of MRP."""
    return round((units_per_box / 2) * mrp_per_unit * B2B_DISCOUNT_RATE)


# ---------------------------------------------------------------------------
# Seed data — used only when the MongoDB collection is empty
# ---------------------------------------------------------------------------
_SEED_PRODUCTS = [
    {
        "id": "kesar-chandan-b2b", "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "kesar-chandan-200-b2b", "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "regal-rose-b2b", "product_id": "regal-rose", "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "regal-rose-200-b2b", "product_id": "regal-rose", "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "oriental-oudh-b2b", "product_id": "oriental-oudh", "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "oriental-oudh-200-b2b", "product_id": "oriental-oudh", "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "bold-bakhoor-b2b", "product_id": "bold-bakhoor", "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
    },
    {
        "id": "bold-bakhoor-200-b2b", "product_id": "bold-bakhoor", "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 18, "hsn_code": "33074900",
    },
    {
        "id": "mogra-magic-b2b", "product_id": "mogra-magic", "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "50g", "units_per_box": 12, "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
    {
        "id": "mogra-magic-200-b2b", "product_id": "mogra-magic", "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "200g", "units_per_box": 16, "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5, "gst_rate": 5, "hsn_code": "33074100",
    },
]


# ---------------------------------------------------------------------------
# Cache (warmed at backend startup; used in pricing hot paths)
# ---------------------------------------------------------------------------
B2B_PRODUCTS: list[dict] = list(_SEED_PRODUCTS)


def find_b2b_product(b2b_product_id: str) -> Optional[dict]:
    """Return the B2B product dict by id, or None. Uses the cache."""
    for p in B2B_PRODUCTS:
        if p["id"] == b2b_product_id:
            return p
    return None


def get_b2b_catalog() -> list[dict]:
    """Public list of B2B products from the cache."""
    return list(B2B_PRODUCTS)


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
    """Idempotent first-run seed of the b2b_products collection."""
    count = await db.b2b_products.count_documents({})
    if count > 0:
        logger.info(f"B2B catalog already seeded ({count} products)")
        return 0
    if not _SEED_PRODUCTS:
        return 0
    await db.b2b_products.insert_many([dict(p) for p in _SEED_PRODUCTS])
    logger.info(f"Seeded {len(_SEED_PRODUCTS)} B2B products into MongoDB")
    return len(_SEED_PRODUCTS)


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
