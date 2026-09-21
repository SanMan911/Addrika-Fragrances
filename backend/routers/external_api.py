"""
External read-only API for related apps (Field Sales Manager, etc.).

Authenticated with an API key via the `X-API-Key` header (or
`Authorization: Bearer <key>`). Reads live stock from MongoDB — the
source of truth. Supabase carries the same data for apps that prefer to
read the mirror directly.

All routes are mounted under /api/external/v1.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request

from dependencies import db
from services.api_keys import verify_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/external/v1", tags=["External API"])


async def _require_key(request: Request, x_api_key: Optional[str], scope: str) -> dict:
    raw = x_api_key
    if not raw:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            raw = auth[7:]
    key_doc = await verify_key(raw or "", required_scope=scope)
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return key_doc


def _stock_row(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "product_id": d.get("product_id"),
        "name": d.get("name"),
        "category": d.get("category"),
        "net_weight": d.get("net_weight"),
        "stock_pieces": int(d.get("stock_pieces") or 0),
        "stock_status": d.get("stock_status")
        or ("in_stock" if int(d.get("stock_pieces") or 0) > 0 else "out_of_stock"),
        "price_per_unit": d.get("mrp_per_unit"),
        "price_per_carton": d.get("price_per_carton"),
        "is_active": bool(d.get("is_active", True)),
    }


@router.get("/ping")
async def ping(request: Request, x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    key_doc = await _require_key(request, x_api_key, scope="stock:read")
    return {"ok": True, "key_name": key_doc.get("name"), "scopes": key_doc.get("scopes")}


@router.get("/stock")
async def list_stock(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    category: Optional[str] = Query(None),
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=500),
):
    """Live per-SKU stock. Optional filters: category, active_only."""
    await _require_key(request, x_api_key, scope="stock:read")
    q: dict = {}
    if category:
        q["category"] = category
    if active_only:
        q["is_active"] = True
    skip = (page - 1) * limit
    cursor = db.b2b_products.find(q, {"_id": 0}).sort("name", 1).skip(skip).limit(limit)
    items = [_stock_row(d) async for d in cursor]
    total = await db.b2b_products.count_documents(q)
    return {"items": items, "pagination": {"page": page, "limit": limit, "total": total}}


@router.get("/stock/{product_id}")
async def get_stock(
    product_id: str,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Stock for a single SKU id, or all SKUs of a parent B2C product id."""
    await _require_key(request, x_api_key, scope="stock:read")
    doc = await db.b2b_products.find_one({"id": product_id}, {"_id": 0})
    if doc:
        return _stock_row(doc)
    # Fall back to parent product_id → return all its SKUs
    rows = [_stock_row(d) async for d in db.b2b_products.find({"product_id": product_id}, {"_id": 0})]
    if not rows:
        raise HTTPException(status_code=404, detail="No SKU found for this id")
    return {"product_id": product_id, "skus": rows}
