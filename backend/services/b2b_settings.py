"""
B2B Feature Settings - DB-backed configuration
Controls:
- b2b_enabled: Global kill-switch for B2B retailer portal
- b2b_cash_discount_percent: Online payment discount %
- b2b_pricing_tiers: Per-product quantity-tier discounts
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Default values (used when DB not yet seeded)
DEFAULT_B2B_ENABLED = False
DEFAULT_CASH_DISCOUNT_PERCENT = 1.5


async def get_b2b_enabled(db) -> bool:
    """Check whether B2B portal is globally enabled."""
    setting = await db.admin_settings.find_one({"setting_key": "b2b_enabled"})
    if setting and "setting_value" in setting:
        return bool(setting["setting_value"])
    return DEFAULT_B2B_ENABLED


async def set_b2b_enabled(db, enabled: bool, admin_email: str) -> bool:
    await db.admin_settings.update_one(
        {"setting_key": "b2b_enabled"},
        {
            "$set": {
                "setting_value": bool(enabled),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin_email,
            }
        },
        upsert=True,
    )
    logger.info(f"B2B portal enabled={enabled} by {admin_email}")
    return bool(enabled)


async def get_cash_discount_percent(db) -> float:
    """Get configured B2B cash/online discount percent."""
    setting = await db.admin_settings.find_one(
        {"setting_key": "b2b_cash_discount_percent"}
    )
    if setting and "setting_value" in setting:
        try:
            return float(setting["setting_value"])
        except (TypeError, ValueError):
            pass
    return DEFAULT_CASH_DISCOUNT_PERCENT


async def set_cash_discount_percent(db, percent: float, admin_email: str) -> float:
    if percent < 0 or percent > 20:
        raise ValueError("Cash discount must be between 0 and 20 percent")
    await db.admin_settings.update_one(
        {"setting_key": "b2b_cash_discount_percent"},
        {
            "$set": {
                "setting_value": float(percent),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin_email,
            }
        },
        upsert=True,
    )
    logger.info(f"B2B cash discount set to {percent}% by {admin_email}")
    return float(percent)


async def init_b2b_settings(db):
    """Ensure default B2B settings exist in DB (seed once, don't override)."""
    for key, default in (
        ("b2b_enabled", DEFAULT_B2B_ENABLED),
        ("b2b_cash_discount_percent", DEFAULT_CASH_DISCOUNT_PERCENT),
    ):
        existing = await db.admin_settings.find_one({"setting_key": key})
        if not existing:
            await db.admin_settings.insert_one(
                {
                    "setting_key": key,
                    "setting_value": default,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": "system:init",
                }
            )
            logger.info(f"Initialized B2B setting {key}={default}")


# ============================================================================
# Quantity-Tiered Pricing
# ============================================================================
# Stored as a single document per b2b_product_id in collection `b2b_pricing_tiers`
# { b2b_product_id: "kesar-chandan-b2b", tiers: [{min_boxes: 1, discount_percent: 0}, ...] }

async def get_pricing_tiers(db, b2b_product_id: str) -> list:
    """Get sorted tiers for a product. Returns empty list if none configured."""
    doc = await db.b2b_pricing_tiers.find_one(
        {"b2b_product_id": b2b_product_id}, {"_id": 0}
    )
    tiers = (doc or {}).get("tiers", []) or []
    # Sort by min_boxes ascending
    tiers = sorted(tiers, key=lambda t: float(t.get("min_boxes", 0)))
    return tiers


async def get_all_pricing_tiers(db) -> dict:
    """Return {b2b_product_id: [tiers]} for all products."""
    result = {}
    async for doc in db.b2b_pricing_tiers.find({}, {"_id": 0}):
        pid = doc.get("b2b_product_id")
        if pid:
            result[pid] = sorted(
                doc.get("tiers", []) or [],
                key=lambda t: float(t.get("min_boxes", 0)),
            )
    return result


async def set_pricing_tiers(db, b2b_product_id: str, tiers: list, admin_email: str):
    """Replace tiers for a product. Tiers: [{min_boxes: float, discount_percent: float}]"""
    # Validate
    clean_tiers = []
    for t in tiers:
        mb = float(t.get("min_boxes", 0))
        dp = float(t.get("discount_percent", 0))
        if mb < 0 or dp < 0 or dp > 100:
            raise ValueError("Invalid tier: min_boxes >= 0 and discount_percent in [0,100]")
        clean_tiers.append({"min_boxes": mb, "discount_percent": dp})
    clean_tiers.sort(key=lambda t: t["min_boxes"])

    await db.b2b_pricing_tiers.update_one(
        {"b2b_product_id": b2b_product_id},
        {
            "$set": {
                "b2b_product_id": b2b_product_id,
                "tiers": clean_tiers,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin_email,
            }
        },
        upsert=True,
    )
    logger.info(
        f"B2B pricing tiers updated for {b2b_product_id} ({len(clean_tiers)} tiers) by {admin_email}"
    )
    return clean_tiers


def applicable_tier_discount(tiers: list, quantity_boxes: float) -> float:
    """Return the highest-min_boxes tier discount_percent whose min_boxes <= quantity_boxes.

    Returns 0 if no tiers apply.
    """
    applied = 0.0
    for t in tiers:
        if quantity_boxes + 1e-9 >= float(t.get("min_boxes", 0)):
            applied = float(t.get("discount_percent", 0))
    return applied
