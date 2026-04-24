"""
Admin endpoints for B2B Loyalty Milestone configuration.
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field
from typing import Optional
import logging

from dependencies import db, require_admin
from services.b2b_loyalty import (
    list_active_milestones,
    create_milestone,
    update_milestone,
    delete_milestone,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/b2b-loyalty", tags=["Admin B2B Loyalty"])


class MilestoneCreate(BaseModel):
    min_purchase: float = Field(..., ge=0)
    discount_percent: float = Field(..., ge=0, le=50)
    label: Optional[str] = None


class MilestoneUpdate(BaseModel):
    min_purchase: Optional[float] = Field(None, ge=0)
    discount_percent: Optional[float] = Field(None, ge=0, le=50)
    label: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/milestones")
async def admin_list_milestones(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    # Return ALL milestones (active + inactive) for admin
    docs = await db.loyalty_milestones.find({}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda m: float(m.get("min_purchase", 0)))
    return {"milestones": docs}


@router.post("/milestones")
async def admin_create_milestone(
    data: MilestoneCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    try:
        doc = await create_milestone(
            db, data.min_purchase, data.discount_percent, data.label,
            admin.get("email", "admin"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # strip _id if present
    doc.pop("_id", None)
    return {"milestone": doc}


@router.put("/milestones/{milestone_id}")
async def admin_update_milestone(
    milestone_id: str,
    data: MilestoneUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    try:
        doc = await update_milestone(
            db, milestone_id, data.dict(exclude_unset=True), admin.get("email", "admin")
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Milestone not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"milestone": doc}


@router.delete("/milestones/{milestone_id}")
async def admin_delete_milestone(
    milestone_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    ok = await delete_milestone(db, milestone_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"deleted": True}
