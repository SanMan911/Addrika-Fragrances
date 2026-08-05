"""Admin: B2B piece-level inventory management.

Endpoints:
    GET    /admin/b2b/inventory              — full list with stock counts
    GET    /admin/b2b/inventory/{product_id} — single-product snapshot
    POST   /admin/b2b/inventory/{product_id}/adjust — inc/dec with reason
    GET    /admin/b2b/inventory/{product_id}/log    — recent audit trail
"""
from __future__ import annotations

from typing import Optional, List

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


@router.get("/log")
async def admin_inventory_log_all(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 500,
):
    """Full audit log across every SKU — for the export CSV."""
    await require_admin(request, session_token)
    return {"entries": await get_log(db, None, limit=min(limit, 2000))}


@router.get("/log/export.csv")
async def admin_inventory_log_csv(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    product_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Downloadable CSV of the b2b_inventory_log for accountants + physical
    stock audits. Filterable by product_id and ISO-8601 date range."""
    from datetime import datetime
    from fastapi.responses import StreamingResponse
    from io import StringIO
    import csv

    await require_admin(request, session_token)

    query: dict = {}
    if product_id:
        query["product_id"] = product_id
    if from_date or to_date:
        rng: dict = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date
        query["created_at"] = rng

    cursor = db.b2b_inventory_log.find(query, {"_id": 0}).sort("created_at", -1).limit(10000)
    rows = await cursor.to_list(10000)

    # Enrich with product name for the accountant view
    product_names: dict = {}
    if rows:
        pids = list({r["product_id"] for r in rows if r.get("product_id")})
        async for p in db.b2b_products.find(
            {"id": {"$in": pids}}, {"_id": 0, "id": 1, "name": 1, "net_weight": 1}
        ):
            product_names[p["id"]] = f"{p.get('name')} ({p.get('net_weight')})"

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Date (UTC)", "Product ID", "Product Name", "Reason",
        "Δ Pieces", "Before", "After", "Order ID", "Admin", "Note", "Entry ID",
    ])
    for r in rows:
        w.writerow([
            (r.get("created_at") or "").split("T")[0] + " " + (r.get("created_at") or "").split("T")[1][:8] if r.get("created_at") else "",
            r.get("product_id") or "",
            product_names.get(r.get("product_id"), ""),
            r.get("reason") or "",
            r.get("delta_pieces") or 0,
            r.get("before") or 0,
            r.get("after") or 0,
            r.get("source_order_id") or "",
            r.get("admin_email") or "",
            (r.get("note") or "").replace("\n", " ").replace("\r", " "),
            r.get("id") or "",
        ])

    csv_bytes = buf.getvalue().encode("utf-8")
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"addrika-inventory-log-{stamp}.csv"
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(csv_bytes)),
        },
    )


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


@router.post("/restock-nudges/run")
async def admin_run_restock_nudges(
    request: Request, session_token: Optional[str] = Cookie(None),
):
    """Trigger the restock ETA nudge cycle now (email + optional WhatsApp)
    to every historical buyer whose favourite SKU is 1-2 days from
    coming back. Cooldown-guarded so retailers are never spammed."""
    await require_admin(request, session_token)
    from services.b2b_restock_nudge import run_restock_nudges
    return await run_restock_nudges(db)


class CustomNudgeBody(BaseModel):
    subject: str = Field(..., min_length=3, max_length=140)
    body_html: str = Field(..., min_length=10, max_length=8000)
    whatsapp_body: Optional[str] = Field(None, max_length=1024)
    channels: List[str] = Field(default_factory=lambda: ["email"])
    audience: str = Field("all", description="all | verified | product | pincode | retailer_ids")
    product_id: Optional[str] = None
    pincode_prefix: Optional[str] = None
    retailer_ids: Optional[List[str]] = None
    kind: str = Field("promo", description="promo | drop | price_drop | festive | announcement")


@router.post("/nudges/broadcast")
async def admin_broadcast_nudge(
    body: CustomNudgeBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Admin composer — pushes a custom Email + optional WhatsApp message
    to a targeted retailer audience for special drops, festive re-launches,
    price drops, or promotional schemes. Every send is logged to
    `db.custom_nudges_log` for audit + de-dupe."""
    admin = await require_admin(request, session_token)
    from services.b2b_nudge_composer import broadcast_custom_nudge
    return await broadcast_custom_nudge(
        db,
        subject=body.subject,
        body_html=body.body_html,
        whatsapp_body=body.whatsapp_body,
        channels=body.channels,
        audience=body.audience,
        product_id=body.product_id,
        pincode_prefix=body.pincode_prefix,
        retailer_ids=body.retailer_ids,
        kind=body.kind,
        admin_email=(admin or {}).get("email"),
    )


@router.get("/nudges/history")
async def admin_nudge_history(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 50,
):
    """Recent custom-nudge broadcasts with open/click funnel metrics for
    the admin dashboard."""
    await require_admin(request, session_token)
    rows = await db.custom_nudges_log.find({}, {"_id": 0}) \
        .sort("sent_at", -1).limit(min(limit, 200)).to_list(min(limit, 200))
    # Enrich each row with open/click rates
    enriched = []
    for row in rows:
        audience = int(row.get("audience_size") or 0)
        email_sent = int(row.get("email_sent") or 0)
        opens = int(row.get("opens") or 0)
        unique_opens = int(row.get("unique_opens") or 0)
        clicks = int(row.get("clicks") or 0)
        unique_clicks = int(row.get("unique_clicks") or 0)
        denom = email_sent or audience
        row["open_rate_pct"] = round((unique_opens / denom) * 100, 1) if denom else 0.0
        row["click_rate_pct"] = round((unique_clicks / denom) * 100, 1) if denom else 0.0
        row["ctr_pct"] = round((unique_clicks / unique_opens) * 100, 1) if unique_opens else 0.0
        row["opens"] = opens
        row["unique_opens"] = unique_opens
        row["clicks"] = clicks
        row["unique_clicks"] = unique_clicks
        enriched.append(row)
    return {"entries": enriched, "count": len(enriched)}


@router.get("/nudges/{broadcast_id}/analytics")
async def admin_nudge_analytics(
    broadcast_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Per-broadcast open + click funnel drilldown."""
    await require_admin(request, session_token)
    from services.b2b_nudge_analytics import summarise_broadcast
    summary = await summarise_broadcast(db, broadcast_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    # Top-clicked URLs for this broadcast
    pipeline = [
        {"$match": {"broadcast_id": broadcast_id}},
        {"$group": {"_id": "$url", "clicks": {"$sum": 1},
                    "unique_retailers": {"$addToSet": "$retailer_id"}}},
        {"$project": {"_id": 0, "url": "$_id", "clicks": 1,
                      "unique_retailers": {"$size": "$unique_retailers"}}},
        {"$sort": {"clicks": -1}},
        {"$limit": 20},
    ]
    top_urls = await db.nudges_click_log.aggregate(pipeline).to_list(20)
    return {"summary": summary, "top_urls": top_urls}


@router.get("/nudges/best-time/{retailer_id}")
async def admin_best_send_time(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    top_n: int = 3,
):
    """Recommend send-time slots for a single retailer based on their
    open-history pattern (IST-aware). Falls back to the platform default
    (Tue-Thu 10-13 IST) when the retailer hasn't opened enough emails yet."""
    await require_admin(request, session_token)
    from services.b2b_nudge_send_time import recommend_send_time
    return await recommend_send_time(db, retailer_id=retailer_id, top_n=top_n)


class BestTimeAudienceBody(BaseModel):
    audience: str = Field("all", description="all | verified | product | pincode | retailer_ids")
    product_id: Optional[str] = None
    pincode_prefix: Optional[str] = None
    retailer_ids: Optional[List[str]] = None
    top_n: int = Field(3, ge=1, le=8)


@router.post("/nudges/best-time-for-audience")
async def admin_best_send_time_for_audience(
    body: BestTimeAudienceBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Composer helper — for the exact audience the admin is about to
    broadcast to, recommend the top send-slots so the campaign lands
    when this cohort actually reads their mail."""
    await require_admin(request, session_token)
    from services.b2b_nudge_composer import _resolve_audience
    from services.b2b_nudge_send_time import recommend_send_time_for_audience

    retailers = await _resolve_audience(
        db,
        audience=body.audience,
        product_id=body.product_id,
        pincode_prefix=body.pincode_prefix,
        retailer_ids=body.retailer_ids,
    )
    rids = [r["retailer_id"] for r in retailers if r.get("retailer_id")]
    result = await recommend_send_time_for_audience(
        db, retailer_ids=rids, top_n=body.top_n,
    )
    result["audience_size"] = len(rids)
    return result


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
