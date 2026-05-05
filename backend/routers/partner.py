"""Partner cross-site coupon router.

Exposes `POST /api/partner/coupons/issue` — the endpoint Amardeep Saanan
calls whenever one of their orders ≥ ₹499 qualifies the customer for a
free Mystical Meharishi Dhoop on Addrika. Incoming requests are
HMAC-SHA256 verified against `PARTNER_SHARED_SECRET` over the raw body.

Also exposes a small admin convenience (`GET /partner/coupons/list`,
`POST /partner/coupons/suspend/{code}`) so the Addrika admin can inspect
and suspend partner-issued coupons from the existing admin discount UI.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request

from dependencies import db, require_admin
from services.partner_coupons import (
    persist_partner_coupon_mirror,
    verify_partner_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Partner"])


@router.post("/partner/coupons/issue")
async def partner_coupons_issue(request: Request):
    """Receive an incoming partner-issued coupon (e.g. AMD-GIFT-*).

    HMAC-SHA256(shared_secret, raw_body) must match `X-Partner-Signature`.
    """
    body = await request.body()
    sig = request.headers.get("X-Partner-Signature", "")
    if not verify_partner_signature(sig, body):
        logger.warning(
            "partner_coupons_issue: bad signature from %s len(body)=%d",
            request.client.host if request.client else "unknown",
            len(body),
        )
        raise HTTPException(status_code=401, detail="Bad signature")

    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not isinstance(payload, dict) or not payload.get("code"):
        raise HTTPException(status_code=400, detail="Missing coupon code")

    coupon = await persist_partner_coupon_mirror(db, payload)
    return {"ok": True, "coupon": coupon}


@router.get("/admin/partner/coupons")
async def list_partner_coupons(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin-only: list all partner-issued or outbound partner coupons,
    regardless of site. Useful for the admin dashboard "Partner" tab."""
    await require_admin(request, session_token)
    cursor = db.discount_codes.find(
        {"partner_source": {"$exists": True}},
        {"_id": 0},
    ).sort("created_at", -1)
    coupons = await cursor.to_list(500)
    return {"coupons": coupons}


@router.post("/admin/partner/coupons/{code}/suspend")
async def suspend_partner_coupon(
    code: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin-only: suspend (deactivate) a partner coupon on Addrika's side."""
    await require_admin(request, session_token)
    res = await db.discount_codes.update_one(
        {"code": code.upper(), "partner_source": {"$exists": True}},
        {"$set": {"is_active": False}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner coupon not found")
    return {"ok": True, "code": code.upper(), "suspended": True}


@router.post("/admin/partner/coupons/{code}/reactivate")
async def reactivate_partner_coupon(
    code: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin-only: re-activate a suspended partner coupon."""
    await require_admin(request, session_token)
    res = await db.discount_codes.update_one(
        {"code": code.upper(), "partner_source": {"$exists": True}},
        {"$set": {"is_active": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner coupon not found")
    return {"ok": True, "code": code.upper(), "reactivated": True}


# ============================================================================
# Reconciliation: sync-log inspection + manual replay
# ============================================================================
@router.get("/admin/partner/sync-log")
async def admin_partner_sync_log(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    limit: int = 100,
):
    """Admin-only: list recent outbound partner calls + their status."""
    await require_admin(request, session_token)
    query: dict = {}
    if status in ("sent", "failed", "abandoned"):
        query["status"] = status
    cursor = db.partner_sync_log.find(query, {"_id": 0}).sort("last_attempt_at", -1)
    rows = await cursor.to_list(max(1, min(limit, 500)))
    counts = {}
    for s in ("sent", "failed", "abandoned"):
        counts[s] = await db.partner_sync_log.count_documents({"status": s})
    return {"counts": counts, "rows": rows}


@router.post("/admin/partner/reconcile-now")
async def admin_partner_reconcile_now(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin-only: trigger a partner reconciliation sweep on-demand
    (instead of waiting for the nightly cron)."""
    await require_admin(request, session_token)
    from services.partner_reconcile import reconcile_partner_coupons

    return await reconcile_partner_coupons(db)


@router.post("/admin/partner/sync-log/{op}/{code}/retry")
async def admin_partner_retry_row(
    op: str, code: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin-only: manually retry a single abandoned / failed sync-log row."""
    await require_admin(request, session_token)
    row = await db.partner_sync_log.find_one({"op": op, "code": code.upper()})
    if not row:
        raise HTTPException(status_code=404, detail="sync-log row not found")
    # Reset status so the replay path treats it as a fresh attempt
    await db.partner_sync_log.update_one(
        {"_id": row["_id"]},
        {"$set": {"status": "failed", "next_retry_at": None}},
    )
    row = await db.partner_sync_log.find_one({"_id": row["_id"]})
    from services.partner_reconcile import _replay_one
    ok = await _replay_one(db, row)
    return {"ok": ok, "code": code.upper(), "op": op}
