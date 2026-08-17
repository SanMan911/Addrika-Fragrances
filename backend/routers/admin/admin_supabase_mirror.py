"""
Admin endpoints for the Supabase dual-write mirror.

- GET  /api/admin/supabase-mirror/status                — health + dead-letter counters
- POST /api/admin/supabase-mirror/replay-dead-letter    — drain due retries now
- POST /api/admin/supabase-mirror/backfill              — force-run full backfill
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import db, require_admin
from services.supabase_sync import dead_letter_summary, replay_dead_letter
from supabase_db import is_enabled

router = APIRouter(prefix="/admin/supabase-mirror", tags=["admin", "supabase-mirror"])


@router.get("/status")
async def mirror_status(admin=Depends(require_admin)):
    if not is_enabled():
        return {"enabled": False, "reason": "SUPABASE_MIRROR_ENABLED is false or SUPABASE_DB_URL missing"}
    summary = await dead_letter_summary()
    return summary


@router.post("/replay-dead-letter")
async def mirror_replay(
    limit: int = Query(default=100, ge=1, le=1000),
    admin=Depends(require_admin),
):
    if not is_enabled():
        raise HTTPException(status_code=503, detail="Supabase mirror disabled")
    return await replay_dead_letter(limit=limit)


@router.post("/backfill")
async def mirror_backfill(
    kind: str = Query(default="all", pattern="^(all|users|retailers|products|b2b_products)$"),
    admin=Depends(require_admin),
):
    if not is_enabled():
        raise HTTPException(status_code=503, detail="Supabase mirror disabled")
    from scripts.backfill_supabase_mirror import run_backfill
    return await run_backfill(db, kind=kind)
