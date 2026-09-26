"""
External API for related apps — Field Sales Manager (FSM), analytics, etc.

Authenticated with an API key via the `X-API-Key` header (or
`Authorization: Bearer <key>`). Keys are minted in Admin → API Keys and carry
scopes:

    stock:read      live per-SKU stock                      GET  /stock, /stock/{id}
    catalog:read    wholesale catalogue (prices + pack math) GET  /catalog
    retailers:read  look up onboarded retailers             GET  /retailers
    orders:write    place / cancel B2B orders for a retailer POST /orders, /orders/preview, /orders/{id}/cancel
    orders:read     read order status + payment state        GET  /orders, /orders/{id}

Every order placed here goes through the SAME engine as the web portal and
the AAROHMM app (`services/b2b_order_engine.py`), so stock is reserved in
MongoDB at once, pushed to the Supabase mirror, and `stock.changed` webhooks
fire — all channels see the new availability within seconds.

All routes are mounted under /api/external/v1.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

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
        raise HTTPException(status_code=401, detail=f"Invalid or missing API key (needs scope '{scope}')")
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
        "stock_updated_at": d.get("stock_updated_at"),
    }


def _retailer_row(r: dict) -> dict:
    kyc_ok = bool(r.get("gst_verified") and r.get("pan_verified") and r.get("aadhaar_verified"))
    return {
        "retailer_id": r.get("retailer_id"),
        "business_name": r.get("business_name") or r.get("trade_name"),
        "contact_name": r.get("name") or r.get("contact_name"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "gstin": r.get("gst_number"),
        "city": r.get("city"),
        "state": r.get("state"),
        "pincode": r.get("pincode"),
        "is_active": bool(r.get("is_active", True)),
        "kyc_complete": kyc_ok,
        "kyc": {
            "gst_verified": bool(r.get("gst_verified")),
            "pan_verified": bool(r.get("pan_verified")),
            "aadhaar_verified": bool(r.get("aadhaar_verified")),
        },
    }


def _order_row(o: dict) -> dict:
    return {
        "order_id": o.get("order_id"),
        "client_ref": o.get("client_ref"),
        "channel": o.get("channel", "web"),
        "placed_by": o.get("placed_by"),
        "retailer_id": o.get("retailer_id"),
        "items": [
            {
                "product_id": i.get("product_id"),
                "name": i.get("name") or i.get("product_name"),
                "quantity_boxes": i.get("quantity_boxes"),
                "line_total": i.get("line_total") or i.get("total"),
            }
            for i in (o.get("items") or [])
        ],
        "subtotal": o.get("subtotal"),
        "gst_total": o.get("gst_total"),
        "shipping_charges": o.get("shipping_charges"),
        "total_discount": o.get("total_discount"),
        "grand_total": o.get("grand_total"),
        "order_status": o.get("order_status"),
        "payment_status": o.get("payment_status"),
        "payment_method": o.get("payment_method"),
        "payment_link_url": o.get("payment_link_url"),
        "payment_link_status": o.get("payment_link_status"),
        "paid_at": o.get("paid_at"),
        "stock_reserved": bool(o.get("stock_reserved")),
        "notes": o.get("notes"),
        "created_at": o.get("created_at"),
        "updated_at": o.get("updated_at"),
    }


# ─────────────────────────── health ───────────────────────────

@router.get("/ping")
async def ping(request: Request, x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    raw = x_api_key or (request.headers.get("Authorization") or "")[7:]
    key_doc = await verify_key(raw or "")
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return {"ok": True, "key_name": key_doc.get("name"), "scopes": key_doc.get("scopes")}


# ─────────────────────────── stock ───────────────────────────

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
    rows = [_stock_row(d) async for d in db.b2b_products.find({"product_id": product_id}, {"_id": 0})]
    if not rows:
        raise HTTPException(status_code=404, detail="No SKU found for this id")
    return {"product_id": product_id, "skus": rows}


# ─────────────────────────── catalogue ───────────────────────────

@router.get("/catalog")
async def get_catalog(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    orderable_only: bool = Query(False),
):
    """Wholesale catalogue with carton math, prices and live stock — what a
    field rep needs to build an order on the spot."""
    await _require_key(request, x_api_key, scope="catalog:read")
    from services.b2b_catalog import _enrich_carton_fields
    from services.b2b_settings import get_all_pricing_tiers, get_cash_discount_percent
    tiers_map = await get_all_pricing_tiers(db)
    items = []
    async for d in db.b2b_products.find({"is_active": {"$ne": False}}, {"_id": 0}).sort("name", 1):
        p = _enrich_carton_fields(dict(d))
        row = {
            "id": p["id"],
            "product_id": p.get("product_id"),
            "name": p.get("name"),
            "category": p.get("category"),
            "net_weight": p.get("net_weight"),
            "image": p.get("image"),
            "hsn_code": p.get("hsn_code"),
            "gst_rate": p.get("gst_rate"),
            "unit_label": p.get("unit_label"),
            "pieces_per_carton": p.get("pieces_per_carton"),
            "mrp_per_piece": p.get("mrp_per_piece"),
            "price_per_piece": p.get("price_per_piece"),
            "price_per_carton": p.get("price_per_carton"),
            "price_per_half_carton": p.get("price_per_half_carton"),
            "min_order_boxes": p.get("min_order"),
            "stock_pieces": p.get("stock_pieces"),
            "stock_cartons": p.get("stock_cartons"),
            "max_order_boxes": p.get("max_order_boxes"),
            "stock_status": p.get("stock_status"),
            "stock_status_display": p.get("stock_status_display"),
            "pricing_tiers": tiers_map.get(p["id"], []),
        }
        if orderable_only and not (row["stock_status_display"] or {}).get("is_orderable"):
            continue
        items.append(row)
    return {
        "items": items,
        "cash_discount_percent": await get_cash_discount_percent(db),
        "quantity_rule": "quantity_boxes must be a multiple of 0.5 (half cartons allowed)",
    }


# ─────────────────────────── retailers ───────────────────────────

@router.get("/retailers")
async def list_retailers(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    gstin: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="business name / city search"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Find onboarded retailers so the FSM app can attach an order to one."""
    await _require_key(request, x_api_key, scope="retailers:read")
    query: dict = {"is_active": {"$ne": False}}
    if gstin:
        query["gst_number"] = gstin.strip().upper()
    if phone:
        digits = "".join(ch for ch in phone if ch.isdigit())[-10:]
        query["phone"] = {"$regex": f"{digits}$"}
    if q:
        query["$or"] = [
            {"business_name": {"$regex": q, "$options": "i"}},
            {"trade_name": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    cursor = db.retailers.find(query, {"_id": 0, "password_hash": 0}).sort("business_name", 1).skip(skip).limit(limit)
    items = [_retailer_row(r) async for r in cursor]
    total = await db.retailers.count_documents(query)
    return {"items": items, "pagination": {"page": page, "limit": limit, "total": total}}


# ─────────────────────────── orders ───────────────────────────

class ExtOrderItem(BaseModel):
    product_id: str = Field(..., description="B2B SKU id, e.g. 'bold-bakhoor-b2b'")
    quantity_boxes: float = Field(..., gt=0, description="Cartons — multiples of 0.5")


class PlacedBy(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


class ExtOrderCreate(BaseModel):
    retailer_id: Optional[str] = None
    gstin: Optional[str] = None
    items: list[ExtOrderItem] = Field(..., min_length=1)
    payment_mode: str = Field("pay_later", pattern="^(pay_later|razorpay_link)$")
    delivery_pincode: Optional[str] = Field(None, min_length=6, max_length=6)
    include_shipping: bool = True
    apply_cash_discount: bool = False
    voucher_code: Optional[str] = None
    credit_note_code: Optional[str] = None
    redeem_rewards_inr: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=500)
    placed_by: Optional[PlacedBy] = None
    client_ref: Optional[str] = Field(None, max_length=80, description="Idempotency key — retries return the same order")

    # engine compatibility (mirrors the web B2BOrderCreate shape)
    is_preorder: bool = False
    accept_preorder_terms: bool = False


async def _resolve_retailer(body: ExtOrderCreate) -> dict:
    if not body.retailer_id and not body.gstin:
        raise HTTPException(status_code=422, detail="Provide retailer_id or gstin")
    q = {"retailer_id": body.retailer_id} if body.retailer_id else {"gst_number": body.gstin.strip().upper()}
    retailer = await db.retailers.find_one(q, {"_id": 0, "password_hash": 0})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found — onboard them first")
    if retailer.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Retailer account is inactive")
    return retailer


@router.post("/orders/preview")
async def preview_order(
    body: ExtOrderCreate,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Price a cart for a retailer WITHOUT placing it (totals, GST, discounts, shipping)."""
    await _require_key(request, x_api_key, scope="orders:write")
    from routers.b2b_orders import require_b2b_enabled
    from services import b2b_order_engine as engine
    await require_b2b_enabled()
    retailer = await _resolve_retailer(body)
    return await engine.calculate(db, retailer, body)


@router.post("/orders", status_code=201)
async def place_order(
    body: ExtOrderCreate,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Place a wholesale order on behalf of a retailer (Field Sales flow).

    payment_mode
        pay_later      → admin confirms cash/UPI/bank payment offline (Admin → B2B Orders → Mark Paid)
        razorpay_link  → Razorpay SMSes/e-mails a hosted payment link to the retailer;
                         order auto-confirms when paid (webhook or on next status poll)

    Stock is reserved immediately in both modes; cancelling releases it.
    """
    key_doc = await _require_key(request, x_api_key, scope="orders:write")
    from routers.b2b_orders import require_b2b_enabled, require_kyc_complete
    from services import b2b_order_engine as engine
    await require_b2b_enabled()
    retailer = await _resolve_retailer(body)
    await require_kyc_complete(retailer)

    placed_by = (body.placed_by.model_dump() if body.placed_by else {}) | {"api_key": key_doc.get("name")}
    order, response = await engine.place_order(
        db, retailer, body,
        channel="fsm", payment_mode=body.payment_mode, placed_by=placed_by, client_ref=body.client_ref,
    )
    return {**response, "order": _order_row(order)}


@router.get("/orders")
async def list_orders(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    retailer_id: Optional[str] = Query(None),
    channel: Optional[str] = Query(None, description="web | mobile | fsm"),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    since: Optional[str] = Query(None, description="ISO timestamp — only orders updated after this"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    await _require_key(request, x_api_key, scope="orders:read")
    q: dict = {}
    if retailer_id:
        q["retailer_id"] = retailer_id
    if channel:
        q["channel"] = channel
    if status:
        q["order_status"] = status
    if payment_status:
        q["payment_status"] = payment_status
    if since:
        q["updated_at"] = {"$gte": since}
    skip = (page - 1) * limit
    cursor = db.b2b_orders.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = [_order_row(o) async for o in cursor]
    total = await db.b2b_orders.count_documents(q)
    return {"items": items, "pagination": {"page": page, "limit": limit, "total": total}}


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Order status. Pending payment-link orders are re-checked against Razorpay on every read."""
    await _require_key(request, x_api_key, scope="orders:read")
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_link_id") and order.get("payment_status") != "paid":
        from services import b2b_order_engine as engine
        order = await engine.refresh_payment_link_status(db, order)
    return _order_row(order)


class CancelBody(BaseModel):
    reason: str = Field("Cancelled by field sales", max_length=300)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    body: CancelBody,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Cancel an unpaid, unshipped order and release its reserved stock."""
    key_doc = await _require_key(request, x_api_key, scope="orders:write")
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=409, detail="Paid orders can only be cancelled by admin")
    from services import b2b_order_engine as engine
    try:
        fresh = await engine.cancel_order(db, order, reason=body.reason, actor=f"api-key:{key_doc.get('name')}")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _order_row(fresh)
