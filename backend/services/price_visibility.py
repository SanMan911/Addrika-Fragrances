"""
Price Visibility Control — admin-managed show/hide of prices across surfaces.

Scope flags (stored as `admin_settings` documents):
  - price_visible_b2c   : public storefront (D2C catalogue, cart, checkout)
  - price_visible_b2b   : retailer-facing B2B surfaces (web portal + Aarohmm app)

Per-product overrides:
  - D2C: `hide_price: true` on the product document (products collection)
  - B2B: `hide_price: true` on the SKU document (b2b_products collection)

Money safety: visibility is enforced server-side. When a scope is hidden the
public product payload is stripped of prices, and order endpoints that would
persist a priced record (cart add, B2B order create, checkout intent) are
refused with 409. Authenticated admin/retailer UIs still RECEIVE prices so
they can manage/edit them — hiding is applied in the UI layer there.
"""
import logging
from datetime import datetime, timezone
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_DEFAULTS = {
    "price_visible_b2c": True,
    "price_visible_b2b": True,
}


async def get_price_visibility(db) -> dict:
    """Return {price_visible_b2c, price_visible_b2b} with defaults applied."""
    result = dict(_DEFAULTS)
    cursor = db.admin_settings.find(
        {"setting_key": {"$in": list(_DEFAULTS)}}, {"_id": 0}
    )
    async for doc in cursor:
        key = doc.get("setting_key")
        if key in _DEFAULTS and "setting_value" in doc:
            result[key] = bool(doc["setting_value"])
    return result


async def set_price_visibility(db, scope: str, visible: bool, admin_email: str) -> bool:
    if scope not in _DEFAULTS:
        raise ValueError(f"Unknown price visibility scope: {scope}")
    await db.admin_settings.update_one(
        {"setting_key": scope},
        {
            "$set": {
                "setting_value": bool(visible),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin_email,
            }
        },
        upsert=True,
    )
    logger.info(f"Price visibility {scope}={visible} by {admin_email}")
    return bool(visible)


async def is_b2c_price_visible(db) -> bool:
    return (await get_price_visibility(db))["price_visible_b2c"]


async def is_b2b_price_visible(db) -> bool:
    return (await get_price_visibility(db))["price_visible_b2b"]


def strip_d2c_prices(products: list, visible: bool) -> list:
    """In-place: blank mrp/price on every size when prices are hidden.
    Per-product hide_price always hides, even when the global flag is ON."""
    for p in products:
        hidden = (not visible) or bool(p.get("hide_price"))
        p["price_hidden"] = hidden
        if hidden:
            p.pop("mrp", None)
            for s in p.get("sizes") or []:
                s.pop("mrp", None)
                s.pop("price", None)
    return products


def b2b_hide_map(db_docs: list, visible: bool) -> dict:
    """Return {product_id: hidden_bool} for B2B SKUs."""
    result = {}
    for d in db_docs:
        pid = d.get("id")
        if pid:
            result[pid] = (not visible) or bool(d.get("hide_price"))
    return result
