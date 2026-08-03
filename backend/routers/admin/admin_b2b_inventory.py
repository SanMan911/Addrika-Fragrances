"""Admin: B2B piece-level inventory management.

Endpoints:
    GET    /admin/b2b/inventory              — full list with stock counts
    GET    /admin/b2b/inventory/{product_id} — single-product snapshot
    POST   /admin/b2b/inventory/{product_id}/adjust — inc/dec with reason
    GET    /admin/b2b/inventory/{product_id}/log    — recent audit trail
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.b2b_inventory import (
    adjust_stock,
    get_log,
    get_stock,
    list_stock,
    DEFAULT_PIECES_PER_CARTON,
)

router = APIRouter(prefix="/admin/b2b/inventory", tags=["Admin B2B Inventory"])


@router.get("")
async def admin_list_inventory(
    request: Request, session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return {
        "default_pieces_per_carton": DEFAULT_PIECES_PER_CARTON,
        "items": await list_stock(db),
    }


@router.get("/{product_id}")
async def admin_get_inventory(
    product_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    prod = await db.b2b_products.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    ppc = int(
        prod.get("pieces_per_carton")
        or prod.get("units_per_box")
        or DEFAULT_PIECES_PER_CARTON
    )
    stock_pieces = await get_stock(db, product_id)
    return {
        "id": prod["id"],
        "name": prod.get("name"),
        "net_weight": prod.get("net_weight"),
        "pieces_per_carton": ppc,
        "stock_pieces": stock_pieces,
        "stock_cartons": round(stock_pieces / ppc, 2) if ppc else 0,
    }


ADJUST_REASONS = {
    "restock",         # Received a new production batch
    "damage",          # Damaged / spoilt goods
    "return",          # Retailer return credited back
    "offline_sale",    # Sold off-platform, deduct
    "correction",      # General correction
    "manual_adjust",   # Fallback
}


class AdjustBody(BaseModel):
    delta_pieces: int = Field(..., description="Signed (+ adds, - removes)")
    reason: str = Field("manual_adjust", description="One of the audit reasons")
    note: Optional[str] = None


@router.post("/{product_id}/adjust")
async def admin_adjust_inventory(
    product_id: str,
    body: AdjustBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    reason = body.reason if body.reason in ADJUST_REASONS else "manual_adjust"
    try:
        result = await adjust_stock(
            db,
            product_id=product_id,
            delta_pieces=int(body.delta_pieces),
            reason=reason,
            admin_email=(admin or {}).get("email"),
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.get("/{product_id}/log")
async def admin_inventory_log(
    product_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 50,
):
    await require_admin(request, session_token)
    return {
        "product_id": product_id,
        "entries": await get_log(db, product_id, limit=limit),
    }


class StockStatusBody(BaseModel):
    status: str = Field(..., description="in_stock | out_of_stock | restocking | manufacturing | delayed")
    eta_days: Optional[int] = Field(None, ge=0, le=365)
    note: Optional[str] = None


@router.post("/low-stock/send-digest")
async def admin_trigger_low_stock_digest(
    request: Request, session_token: Optional[str] = Cookie(None),
):
    """Manually trigger the low-stock digest email to Addrika ops (bypasses
    the 20h throttle). Useful when a batch just finished production and
    admin wants a fresh view."""
    await require_admin(request, session_token)
    from services.b2b_low_stock import send_low_stock_digest
    return await send_low_stock_digest(db, force=True)


@router.get("/low-stock/preview")
async def admin_preview_low_stock(
    request: Request, session_token: Optional[str] = Cookie(None),
):
    """List SKUs below one carton — for the admin inventory dashboard."""
    await require_admin(request, session_token)
    from services.b2b_inventory import find_low_stock
    return {"items": await find_low_stock(db)}


@router.post("/{product_id}/status")
async def admin_set_stock_status(
    product_id: str,
    body: StockStatusBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Update a SKU's stock status + ETA + admin note. Shown as a pill
    on the storefront ("Out of Stock · ETA 15 days") and controls order
    eligibility server-side."""
    admin = await require_admin(request, session_token)
    from services.b2b_inventory import set_stock_status
    from services.b2b_catalog import refresh_b2b_catalog
    try:
        result = await set_stock_status(
            db,
            product_id=product_id,
            status=body.status,
            eta_days=body.eta_days,
            note=body.note,
            admin_email=(admin or {}).get("email"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Refresh the in-memory cache so the next catalog read reflects the change
    await refresh_b2b_catalog(db)
    return result
