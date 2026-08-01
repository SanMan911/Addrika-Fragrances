"""Impact metrics (tree-plantation counter etc.) publicly readable, admin-tunable.

Design
------
Rather than tick up a database counter on every visit (which invites
fraud and reset headaches), we compute the running total *from a start
date + rate + admin-set boost*. This makes the value idempotent,
auditable, and impossible to game by refreshing the page.

Formula:
  total = base_trees + floor((now - start_date_utc) / (7 days / trees_per_week))

An admin can set a `manual_boost` from `/admin/settings/impact` when
Addrika actually plants a bigger batch (e.g. Miyawaki drive).

Config is kept in `db.settings.tree_counter`:
  {
    _id: "tree_counter",
    start_date: "2026-02-01T00:00:00+00:00",
    trees_per_week: 1.5,     # slow-and-steady default
    base_trees: 0,
    manual_boost: 0,
  }
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import floor
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin

router = APIRouter(prefix="/impact", tags=["Impact"])


DEFAULT_CONFIG = {
    "_id": "tree_counter",
    "start_date": "2026-02-01T00:00:00+00:00",
    "trees_per_week": 1.5,
    "base_trees": 0,
    "manual_boost": 0,
    "unit": "trees",
    "cta_href": "/csr",
}


async def _get_config() -> dict:
    doc = await db.settings.find_one({"_id": "tree_counter"})
    if not doc:
        # Seed on first read so admin edits always have a row to update.
        await db.settings.insert_one(DEFAULT_CONFIG.copy())
        return DEFAULT_CONFIG.copy()
    # Fill any missing keys with defaults (forward-compat).
    for k, v in DEFAULT_CONFIG.items():
        doc.setdefault(k, v)
    return doc


def _compute_trees(cfg: dict) -> int:
    try:
        start = datetime.fromisoformat(cfg["start_date"])
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
    except Exception:
        start = datetime.now(timezone.utc)
    now = datetime.now(timezone.utc)
    elapsed_weeks = max(0.0, (now - start).total_seconds() / (7 * 24 * 3600))
    grown = elapsed_weeks * float(cfg.get("trees_per_week") or 0)
    return int(cfg.get("base_trees", 0) + cfg.get("manual_boost", 0) + floor(grown))


# ---------------------------------------------------------------------------
# Public read
# ---------------------------------------------------------------------------
@router.get("/trees")
async def get_trees_planted():
    """Public: the current tree count + rate + start date for the counter widget."""
    cfg = await _get_config()
    return {
        "trees": _compute_trees(cfg),
        "trees_per_week": cfg["trees_per_week"],
        "start_date": cfg["start_date"],
        "unit": cfg.get("unit", "trees"),
        "cta_href": cfg.get("cta_href", "/csr"),
        "note": "Estimated average rate of tree-plantation. Updated live.",
    }


# ---------------------------------------------------------------------------
# Admin controls — tunable from the admin panel, no code / DevTools needed
# ---------------------------------------------------------------------------
class TreeCounterUpdate(BaseModel):
    start_date: Optional[str] = None
    trees_per_week: Optional[float] = Field(default=None, ge=0)
    base_trees: Optional[int] = Field(default=None, ge=0)
    manual_boost: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = None
    cta_href: Optional[str] = None


@router.get("/admin/trees")
async def admin_get_tree_config(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    cfg = await _get_config()
    cfg.pop("_id", None)
    return {"config": cfg, "trees_now": _compute_trees(cfg)}


@router.put("/admin/trees")
async def admin_update_tree_config(
    body: TreeCounterUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"_id": "tree_counter"}, {"$set": updates}, upsert=True
    )
    cfg = await _get_config()
    cfg.pop("_id", None)
    return {"ok": True, "config": cfg, "trees_now": _compute_trees(cfg)}
