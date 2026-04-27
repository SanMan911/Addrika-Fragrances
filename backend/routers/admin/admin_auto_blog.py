"""Admin endpoints for the auto-blog scheduler."""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Request, HTTPException
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.auto_blog import (
    get_settings,
    update_settings,
    run_one_cycle,
    get_recent_log,
    DEFAULTS,
)

router = APIRouter(prefix="/admin/auto-blog", tags=["Admin Auto-Blog"])


class AutoBlogSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    cadence_min_days: Optional[float] = Field(None, ge=0.5, le=30)
    cadence_max_days: Optional[float] = Field(None, ge=0.5, le=30)
    publish_mode: Optional[str] = Field(None, pattern="^(auto|draft)$")


@router.get("/settings")
async def get_auto_blog_settings(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    cfg = await get_settings(db)
    return cfg


@router.put("/settings")
async def update_auto_blog_settings(
    data: AutoBlogSettingsUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "No fields to update")
    cfg = await update_settings(
        db, patch, admin_email=(admin.get("email") if isinstance(admin, dict) else "admin")
    )
    return cfg


@router.post("/run-now")
async def run_auto_blog_now(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """Force-run a cycle right now, regardless of next_due_at."""
    admin = await require_admin(request, session_token)
    res = await run_one_cycle(
        db, force=True,
        admin_email=(admin.get("email") if isinstance(admin, dict) else "admin"),
    )
    return res


@router.get("/log")
async def auto_blog_log(
    request: Request, session_token: Optional[str] = Cookie(None), limit: int = 20
):
    await require_admin(request, session_token)
    items = await get_recent_log(db, limit=max(1, min(limit, 100)))
    return {"items": items, "count": len(items)}
