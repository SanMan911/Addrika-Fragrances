"""Admin CRUD for social-platform cross-posting credentials.

Every field is admin-editable via `/admin/settings/social` — no code
changes required to add a new bot token, enable/disable a platform, or
rotate an access token.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel

from dependencies import db, require_admin
from services.social_crosspost import (
    PLATFORMS,
    cross_post_blog,
    get_social_config,
    update_social_platform,
)

router = APIRouter(prefix="/admin/settings/social", tags=["Admin Social"])

class PlatformPatch(BaseModel):
    enabled: Optional[bool] = None
    # All connector-specific credential fields; we accept the whole dict.
    # Frontend sends whichever fields are relevant for the platform.
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    access_token_secret: Optional[str] = None
    bot_token: Optional[str] = None
    channel_id: Optional[str] = None
    page_id: Optional[str] = None
    page_access_token: Optional[str] = None
    ig_business_account_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    owner_id: Optional[str] = None
    endpoint: Optional[str] = None
    broadcast_list: Optional[list[str]] = None


@router.get("/config")
async def read_social_config(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    cfg = await get_social_config(db)
    cfg.pop("_id", None)
    return {"platforms": PLATFORMS, "config": cfg}


@router.put("/config/{platform}")
async def write_social_platform(
    platform: str,
    patch: PlatformPatch,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if platform not in PLATFORMS:
        raise HTTPException(status_code=404, detail=f"unknown platform: {platform}")
    updates = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="no fields to update")
    updated = await update_social_platform(db, platform, updates)
    return {"ok": True, "platform": platform, "config": updated}


@router.post("/test-post/{platform}")
async def test_social_post(
    platform: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Admin-only: send a canned test post to a single platform.
    Useful to smoke-test creds without publishing a real blog."""
    await require_admin(request, session_token)
    if platform not in PLATFORMS:
        raise HTTPException(status_code=404, detail=f"unknown platform: {platform}")
    cfg = await get_social_config(db)
    from services.social_crosspost import POSTER
    r = await POSTER[platform](
        cfg[platform],
        text="🧪 Test post from Addrika admin — safe to ignore.",
        image_url=None,
        link_url="https://centraders.com",
    )
    return r


@router.post("/cross-post-latest-blog")
async def admin_cross_post_latest(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """Admin manual trigger — fan out the most recent published post."""
    await require_admin(request, session_token)
    post = await db.blog_posts.find_one(
        {"is_published": True},
        sort=[("published_at", -1)],
    )
    if not post:
        raise HTTPException(status_code=404, detail="no published blog posts yet")
    results = await cross_post_blog(db, post)
    return {"post_slug": post.get("slug"), "results": results}
