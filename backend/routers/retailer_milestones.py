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


# ── ADMIN: milestone CRUD ────────────────────────────────────────────────
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
