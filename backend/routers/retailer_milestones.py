"""
Retailer Milestones — public + admin endpoints.

Public:
    GET  /api/retailers/{retailer_id}/patron           (retailer self)
    GET  /api/retailer-dashboard/patron                (retailer self via session)

Admin:
    GET    /api/admin/milestones
    POST   /api/admin/milestones
    PUT    /api/admin/milestones/{milestone_id}
    DELETE /api/admin/milestones/{milestone_id}     (soft: is_active=False)
    GET    /api/admin/retailers/{retailer_id}/patron  (any retailer)
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.retailer_milestones import (
    STAT_LIFETIME_ORDERS, STAT_LIFETIME_GMV, STAT_ACTIVE_MONTHS,
    STAT_MONTHLY_STREAK, VALID_STATS,
    create_milestone, delete_milestone, get_retailer_patron_status,
    list_milestones, seed_default_milestones, update_milestone,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Retailer Milestones"])


class MilestoneIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    aroma_tag: str = Field(..., min_length=1, max_length=40, description="e.g. cedar, sandalwood, oudh, musk, amber, kewda")
    stat: str = Field(..., description=f"One of {sorted(VALID_STATS)}")
    threshold: float = Field(..., gt=0)
    description: Optional[str] = Field(default="", max_length=500)
    order: int = Field(default=100, ge=0, le=10000)
    is_active: bool = True


class MilestoneUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    aroma_tag: Optional[str] = Field(default=None, max_length=40)
    stat: Optional[str] = None
    threshold: Optional[float] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, max_length=500)
    order: Optional[int] = Field(default=None, ge=0, le=10000)
    is_active: Optional[bool] = None


@router.get("/community/leaderboard",
            summary="Public top-streak retailers (opt-in only)")
async def public_leaderboard():
    """Marketing surface for `/community` — returns the top-3 opted-in
    retailers by monthly ordering streak. Reads from the streak cache so
    it's O(1) even under heavy traffic."""
    from services.retailer_milestones import _get_streak_leader  # ensures cache
    await _get_streak_leader(db)
    cache = await db.leaderboard_cache.find_one(
        {"_id": "streak_leaderboard"}, {"_id": 0}
    ) or {}
    entries = []
    for row in (cache.get("top") or []):
        retailer = await db.retailers.find_one(
            {"retailer_id": row["retailer_id"],
             "leaderboard_opt_in": True,
             "status": {"$ne": "suspended"}},
            {"_id": 0, "business_name": 1, "city": 1, "trade_name": 1},
        )
        if not retailer:
            continue
        entries.append({
            "display_name": retailer.get("business_name") or retailer.get("trade_name"),
            "city": retailer.get("city"),
            "streak_months": int(row.get("streak_months") or 0),
        })
        if len(entries) >= 3:
            break
    return {
        "top": entries,
        "as_of": cache.get("updated_at"),
        "note": "Only retailers who have opted in appear here. Toggle from your rewards page.",
    }


class LeaderboardOptIn(BaseModel):
    opt_in: bool


@router.put("/retailer-dashboard/leaderboard-opt-in",
            summary="Retailer opts in/out of the public community leaderboard")
async def retailer_leaderboard_opt_in(
    body: LeaderboardOptIn,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    from routers.retailer_dashboard import get_current_retailer
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from datetime import datetime as _dt, timezone as _tz
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {
            "leaderboard_opt_in": bool(body.opt_in),
            "leaderboard_opt_in_at": _dt.now(_tz.utc).isoformat(),
        }},
    )
    return {"opt_in": bool(body.opt_in),
            "message": ("You'll now appear on the Community Leaderboard when you're in the top 3."
                        if body.opt_in
                        else "You've been removed from the public Community Leaderboard.")}


@router.get("/retailer-dashboard/leaderboard-opt-in",
            summary="Retailer reads current opt-in flag")
async def retailer_get_leaderboard_opt_in(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    from routers.retailer_dashboard import get_current_retailer
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"opt_in": bool(retailer.get("leaderboard_opt_in", False))}


# ── Admin: milestone CRUD ────────────────────────────────────────────────
@router.post("/admin/milestones/refresh-streak-leaderboard",
             summary="Force-refresh the streak leaderboard cache (admin, ops-only)")
async def admin_refresh_streak_leaderboard(admin=Depends(require_admin)):
    """Manual override for the weekly Constant Companion cache. Useful when
    ops need to see an immediate leader change after major data corrections."""
    from services.retailer_milestones import refresh_streak_leaderboard
    doc = await refresh_streak_leaderboard(db)
    doc.pop("_id", None)
    return {"leaderboard": doc}


@router.get("/admin/milestones", summary="List all patron milestones (admin)")
async def admin_list_milestones(
    include_inactive: bool = True,
    admin=Depends(require_admin),
):
    await seed_default_milestones(db)
    return {"milestones": await list_milestones(db, include_inactive=include_inactive)}


@router.post("/admin/milestones", summary="Create a new patron milestone (admin)")
async def admin_create_milestone(payload: MilestoneIn, admin=Depends(require_admin)):
    try:
        return {"milestone": await create_milestone(db, payload.model_dump())}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/milestones/{milestone_id}", summary="Edit a patron milestone (admin)")
async def admin_update_milestone(
    milestone_id: str, payload: MilestoneUpdate, admin=Depends(require_admin),
):
    try:
        m = await update_milestone(
            db, milestone_id,
            payload.model_dump(exclude_none=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"milestone": m}


@router.delete("/admin/milestones/{milestone_id}", summary="Deactivate a patron milestone (admin, soft-delete)")
async def admin_delete_milestone(milestone_id: str, admin=Depends(require_admin)):
    ok = await delete_milestone(db, milestone_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"message": "Milestone deactivated. Existing retailer achievements are preserved (audit history is immutable)."}


@router.get("/admin/retailers/{retailer_id}/patron", summary="Read a retailer's patron status (admin)")
async def admin_get_retailer_patron(retailer_id: str, admin=Depends(require_admin)):
    return await get_retailer_patron_status(db, retailer_id)


# ── RETAILER: read your own patron status ────────────────────────────────
@router.get("/retailer-dashboard/patron", summary="Retailer's own patron status")
async def retailer_patron_status(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    from routers.retailer_dashboard import get_current_retailer
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await get_retailer_patron_status(db, retailer["retailer_id"])
