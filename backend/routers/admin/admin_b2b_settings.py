"""
Admin B2B Settings Management
- Global kill-switch (b2b_enabled)
- Cash discount percent (online payment bonus)
- Quantity-tiered pricing per B2B product
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from dependencies import db, require_admin
from services.b2b_settings import (
    get_b2b_enabled,
    set_b2b_enabled,
    get_cash_discount_percent,
    set_cash_discount_percent,
    get_all_pricing_tiers,
    get_pricing_tiers,
    set_pricing_tiers,
)
from routers.b2b_orders import B2B_PRODUCTS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/b2b-settings", tags=["Admin B2B Settings"])


class B2BSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    cash_discount_percent: Optional[float] = Field(None, ge=0, le=20)


class PricingTier(BaseModel):
    min_boxes: float = Field(..., ge=0)
    discount_percent: float = Field(..., ge=0, le=100)


class PricingTiersUpdate(BaseModel):
    tiers: List[PricingTier]


@router.get("")
async def admin_get_b2b_settings(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Return current B2B settings, catalog, and per-product pricing tiers."""
    await require_admin(request, session_token)
    enabled = await get_b2b_enabled(db)
    cash_pct = await get_cash_discount_percent(db)
    tiers_map = await get_all_pricing_tiers(db)

    products = []
    for p in B2B_PRODUCTS:
        products.append(
            {
                "id": p["id"],
                "name": p["name"],
                "net_weight": p["net_weight"],
                "units_per_box": p["units_per_box"],
                "price_per_box": p["price_per_box"],
                "pricing_tiers": tiers_map.get(p["id"], []),
            }
        )

    return {
        "enabled": enabled,
        "cash_discount_percent": cash_pct,
        "products": products,
    }


@router.put("")
async def admin_update_b2b_settings(
    data: B2BSettingsUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Toggle B2B portal and/or update the cash discount percent."""
    admin = await require_admin(request, session_token)
    admin_email = admin.get("email", "admin")

    if data.enabled is not None:
        await set_b2b_enabled(db, data.enabled, admin_email)

    if data.cash_discount_percent is not None:
        try:
            await set_cash_discount_percent(
                db, data.cash_discount_percent, admin_email
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return {
        "enabled": await get_b2b_enabled(db),
        "cash_discount_percent": await get_cash_discount_percent(db),
    }


@router.get("/pricing-tiers/{b2b_product_id}")
async def admin_get_pricing_tiers(
    b2b_product_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if not any(p["id"] == b2b_product_id for p in B2B_PRODUCTS):
        raise HTTPException(status_code=404, detail="B2B product not found")
    tiers = await get_pricing_tiers(db, b2b_product_id)
    return {"b2b_product_id": b2b_product_id, "tiers": tiers}


@router.put("/pricing-tiers/{b2b_product_id}")
async def admin_update_pricing_tiers(
    b2b_product_id: str,
    data: PricingTiersUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Replace the quantity-tier list for a B2B product."""
    admin = await require_admin(request, session_token)
    if not any(p["id"] == b2b_product_id for p in B2B_PRODUCTS):
        raise HTTPException(status_code=404, detail="B2B product not found")
    try:
        tiers = await set_pricing_tiers(
            db,
            b2b_product_id,
            [t.dict() for t in data.tiers],
            admin.get("email", "admin"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"b2b_product_id": b2b_product_id, "tiers": tiers}
