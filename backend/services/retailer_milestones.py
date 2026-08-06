"""
Retailer Patron Milestones.

Concept
-------
A milestone is a numeric threshold on a *stat* (e.g. lifetime orders,
lifetime GMV, months active, orders in the current month) that unlocks
an aroma-themed "patron" title on the retailer's profile.

    Examples (default seed):
        "Cedar Patron"      → 5 lifetime orders
        "Sandalwood Sage"   → 20 lifetime orders
        "Oudh Master"       → 50 lifetime orders
        "Musk Maven"        → ₹1,00,000 lifetime GMV
        "Amber Guardian"    → 12 consecutive active months

Design principles
-----------------
▸ **Admin-editable**: milestone name, aroma tag, threshold, description
  and display order all live in `retailer_milestones` and are CRUD'd
  from the admin panel.
▸ **Immutable achievement stamp**: once a retailer crosses a threshold,
  `retailer_achievements` gets a row with `achieved_at` (UTC ISO). That
  row is **never updated** — even if admin later raises the threshold,
  the retailer keeps their earned patronage.
▸ **Two honorary badges** computed live (not stored — always up-to-date):
    ▸ Aroma Trailblazer      → retailer who reached the top milestone fastest
    ▸ Constant Companion     → retailer with the longest unbroken monthly
                               ordering streak
▸ **Zero-touch background sync**: `sync_achievements()` runs after any
  paid order (B2B or B2C) so tags appear the moment they're earned.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Threshold types
# ────────────────────────────────────────────────────────────────────────────
STAT_LIFETIME_ORDERS = "lifetime_orders"
STAT_LIFETIME_GMV = "lifetime_gmv_inr"
STAT_MONTHLY_STREAK = "monthly_order_streak"
STAT_ACTIVE_MONTHS = "active_months"

VALID_STATS = {
    STAT_LIFETIME_ORDERS,
    STAT_LIFETIME_GMV,
    STAT_MONTHLY_STREAK,
    STAT_ACTIVE_MONTHS,
}

DEFAULT_MILESTONES = [
    {"name": "Cedar Patron",       "aroma_tag": "cedar",       "stat": STAT_LIFETIME_ORDERS, "threshold": 5,      "order": 10,
     "description": "Awarded on your fifth lifetime order — welcome to the Addrika inner circle."},
    {"name": "Sandalwood Sage",    "aroma_tag": "sandalwood",  "stat": STAT_LIFETIME_ORDERS, "threshold": 20,     "order": 20,
     "description": "Twenty orders in — a true sage of our sandalwood lineage."},
    {"name": "Oudh Master",        "aroma_tag": "oudh",        "stat": STAT_LIFETIME_ORDERS, "threshold": 50,     "order": 30,
     "description": "Fifty orders across our catalog — mastery of the Addrika range."},
    {"name": "Musk Maven",         "aroma_tag": "musk",        "stat": STAT_LIFETIME_GMV,    "threshold": 100000, "order": 40,
     "description": "₹1,00,000 lifetime purchases — a maven of our finest fragrances."},
    {"name": "Amber Guardian",     "aroma_tag": "amber",       "stat": STAT_ACTIVE_MONTHS,   "threshold": 12,     "order": 50,
     "description": "A full year of active partnership — you guard the Addrika flame."},
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ────────────────────────────────────────────────────────────────────────────
# Seeding
# ────────────────────────────────────────────────────────────────────────────
async def seed_default_milestones(db) -> int:
    """Insert the default milestones if none exist. Idempotent."""
    count = await db.retailer_milestones.count_documents({})
    if count > 0:
        return 0
    for i, m in enumerate(DEFAULT_MILESTONES):
        await db.retailer_milestones.insert_one({
            **m,
            "id": f"ms-{m['aroma_tag']}",
            "is_active": True,
            "created_at": _now().isoformat(),
        })
    return len(DEFAULT_MILESTONES)


# ────────────────────────────────────────────────────────────────────────────
# Stat computation — pull per-retailer numbers used to evaluate thresholds
# ────────────────────────────────────────────────────────────────────────────
async def _retailer_stats(db, retailer_id: str) -> dict[str, Any]:
    """Return the four canonical stats for a retailer."""
    # Lifetime orders + GMV: sum of paid B2B + paid B2C orders
    b2b_cursor = db.b2b_orders.find(
        {"retailer_id": retailer_id, "payment_status": "paid"},
        {"_id": 0, "grand_total": 1, "created_at": 1},
    )
    b2b_rows = await b2b_cursor.to_list(10000)

    # Some retailers also have a linked B2C customer_id — best-effort join
    retailer = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0}) or {}
    linked_email = retailer.get("email")
    b2c_rows: list[dict] = []
    if linked_email:
        b2c_cursor = db.orders.find(
            {"customer_email": linked_email, "payment_status": "paid"},
            {"_id": 0, "grand_total": 1, "created_at": 1},
        )
        b2c_rows = await b2c_cursor.to_list(10000)

    all_orders = b2b_rows + b2c_rows
    lifetime_orders = len(all_orders)
    lifetime_gmv = sum(float(o.get("grand_total") or 0) for o in all_orders)

    # Active months = distinct YYYY-MM buckets in which the retailer ordered
    months: set[str] = set()
    for o in all_orders:
        ts = o.get("created_at")
        if ts:
            try:
                dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                months.add(dt.strftime("%Y-%m"))
            except (ValueError, TypeError):
                pass
    active_months = len(months)

    # Monthly streak: count backwards from the current month, break on any gap
    now = _now()
    streak = 0
    cursor_year, cursor_month = now.year, now.month
    while True:
        key = f"{cursor_year:04d}-{cursor_month:02d}"
        if key in months:
            streak += 1
            # step back one month
            if cursor_month == 1:
                cursor_year -= 1
                cursor_month = 12
            else:
                cursor_month -= 1
        else:
            break

    return {
        STAT_LIFETIME_ORDERS: lifetime_orders,
        STAT_LIFETIME_GMV: lifetime_gmv,
        STAT_MONTHLY_STREAK: streak,
        STAT_ACTIVE_MONTHS: active_months,
    }


# ────────────────────────────────────────────────────────────────────────────
# Achievement detection — the core "did they earn it yet?" loop
# ────────────────────────────────────────────────────────────────────────────
async def sync_achievements(db, retailer_id: str) -> list[dict]:
    """Evaluate every active milestone against the retailer's current stats.
    Insert a fresh `retailer_achievements` row for each newly crossed
    threshold. Never mutates or deletes existing rows — the timestamp
    is immutable audit history.
    Returns the list of NEW achievements unlocked in this run.
    """
    stats = await _retailer_stats(db, retailer_id)
    active_milestones = await db.retailer_milestones.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(200)

    existing = await db.retailer_achievements.find(
        {"retailer_id": retailer_id}, {"_id": 0, "milestone_id": 1},
    ).to_list(500)
    already_have = {a["milestone_id"] for a in existing}

    newly_unlocked = []
    for m in active_milestones:
        if m["id"] in already_have:
            continue
        current = stats.get(m["stat"], 0)
        if current >= m["threshold"]:
            row = {
                "retailer_id": retailer_id,
                "milestone_id": m["id"],
                "aroma_tag": m.get("aroma_tag"),
                "milestone_name_at_time": m["name"],  # snapshot in case admin renames later
                "stat": m["stat"],
                "threshold_at_time": m["threshold"],
                "stat_value_at_time": current,
                "achieved_at": _now().isoformat(),   # ← IMMUTABLE from here on
            }
            await db.retailer_achievements.insert_one(dict(row))
            newly_unlocked.append(row)

    return newly_unlocked


async def get_retailer_patron_status(db, retailer_id: str) -> dict:
    """Assemble the retailer's full patron status: current tag(s),
    achievement history, honor badges, AND the next milestone in progress."""
    await seed_default_milestones(db)
    await sync_achievements(db, retailer_id)

    achievements = await db.retailer_achievements.find(
        {"retailer_id": retailer_id}, {"_id": 0},
    ).sort("achieved_at", 1).to_list(500)

    # Current milestones (join with milestone doc for latest name/description)
    milestone_ids = {a["milestone_id"] for a in achievements}
    milestones = await db.retailer_milestones.find(
        {"id": {"$in": list(milestone_ids)}}, {"_id": 0}
    ).to_list(200)
    ms_map = {m["id"]: m for m in milestones}

    enriched = []
    for a in achievements:
        m = ms_map.get(a["milestone_id"]) or {}
        enriched.append({
            "milestone_id": a["milestone_id"],
            "name": m.get("name") or a.get("milestone_name_at_time"),
            "aroma_tag": a.get("aroma_tag") or m.get("aroma_tag"),
            "description": m.get("description"),
            "stat": a["stat"],
            "threshold": m.get("threshold") or a.get("threshold_at_time"),
            "achieved_at": a["achieved_at"],
            "stat_value_at_time": a.get("stat_value_at_time"),
        })

    highest = enriched[-1] if enriched else None

    honors = await _compute_honors(db, retailer_id)
    next_milestone = await _compute_next_milestone(db, retailer_id, milestone_ids)

    return {
        "retailer_id": retailer_id,
        "current_patron_tag": highest["name"] if highest else None,
        "current_aroma": highest["aroma_tag"] if highest else None,
        "achievements": enriched,
        "honors": honors,
        "next_milestone": next_milestone,
    }


async def _compute_next_milestone(
    db, retailer_id: str, earned_ids: set[str]
) -> Optional[dict]:
    """Return the closest un-earned active milestone with the retailer's
    current progress + delta so the UI can render a motivational
    "N more orders to X" progress bar."""
    stats = await _retailer_stats(db, retailer_id)
    candidates = await db.retailer_milestones.find(
        {"is_active": True, "id": {"$nin": list(earned_ids)}}, {"_id": 0},
    ).to_list(200)
    if not candidates:
        return None

    def _remaining(m: dict) -> float:
        current = float(stats.get(m["stat"], 0))
        return max(0.0, float(m["threshold"]) - current)

    # Sort by absolute distance to threshold. If a stat is uncomparable
    # to another (orders vs GMV), pick the "closest to 100%" normalised.
    def _pct(m: dict) -> float:
        current = float(stats.get(m["stat"], 0))
        return min(1.0, current / float(m["threshold"])) if m["threshold"] else 0.0

    candidates.sort(key=lambda m: (-_pct(m), m.get("order") or 100))
    closest = candidates[0]
    current = float(stats.get(closest["stat"], 0))
    threshold = float(closest["threshold"])
    return {
        "milestone_id": closest["id"],
        "name": closest["name"],
        "aroma_tag": closest.get("aroma_tag"),
        "description": closest.get("description"),
        "stat": closest["stat"],
        "threshold": threshold,
        "current_value": current,
        "remaining": max(0.0, threshold - current),
        "progress_pct": round(_pct(closest) * 100, 1),
    }


# ────────────────────────────────────────────────────────────────────────────
# Streak leaderboard cache
# ────────────────────────────────────────────────────────────────────────────
#
# The `Constant Companion` honor needs to know which retailer holds the
# longest active monthly streak. A naive live scan is O(N-retailers) and
# was flagged by the testing agent as a scale concern at iter79. Solution:
# recompute the leaderboard on a slow cadence (weekly by default, easily
# bumped to fortnightly/monthly) and cache the result. Live reads become
# O(1). If the cache is missing or stale, `_compute_honors` falls back to
# a scan the FIRST time — subsequent reads use the cache.
STREAK_CACHE_ID = "streak_leaderboard"
STREAK_CACHE_TTL_DAYS = 7  # weekly refresh; bump to 14 or 30 if scans get costly


async def refresh_streak_leaderboard(db, top_n: int = 3) -> dict:
    """Recompute the top-N streak leaderboard and cache it. Safe to call
    from a scheduler, an admin endpoint, or on-demand from `_compute_honors`
    when the cache is stale."""
    all_retailers = await db.retailers.find(
        {"status": {"$ne": "suspended"}}, {"_id": 0, "retailer_id": 1},
    ).to_list(50000)
    scores: list[dict] = []
    for r in all_retailers:
        stats = await _retailer_stats(db, r["retailer_id"])
        streak = stats.get(STAT_MONTHLY_STREAK, 0)
        if streak > 0:
            scores.append({"retailer_id": r["retailer_id"], "streak_months": streak})
    scores.sort(key=lambda s: s["streak_months"], reverse=True)
    top = scores[:top_n]
    doc = {
        "_id": STREAK_CACHE_ID,
        "updated_at": _now().isoformat(),
        "top": top,
        "top_streak_retailer_id": top[0]["retailer_id"] if top else None,
        "top_streak_months": top[0]["streak_months"] if top else 0,
    }
    await db.leaderboard_cache.update_one(
        {"_id": STREAK_CACHE_ID}, {"$set": doc}, upsert=True,
    )
    return doc


async def _get_streak_leader(db) -> tuple[Optional[str], int]:
    """Read the current Constant Companion holder from the cache. Refreshes
    the cache lazily if it's missing or older than STREAK_CACHE_TTL_DAYS."""
    from datetime import timedelta
    doc = await db.leaderboard_cache.find_one({"_id": STREAK_CACHE_ID}, {"_id": 0})
    now = _now()
    is_fresh = False
    if doc and doc.get("updated_at"):
        try:
            age = now - datetime.fromisoformat(str(doc["updated_at"]).replace("Z", "+00:00"))
            is_fresh = age < timedelta(days=STREAK_CACHE_TTL_DAYS)
        except (ValueError, TypeError):
            is_fresh = False
    if not is_fresh:
        doc = await refresh_streak_leaderboard(db)
    return doc.get("top_streak_retailer_id"), int(doc.get("top_streak_months") or 0)


# ────────────────────────────────────────────────────────────────────────────
# Honor badges — computed live, never stored
# ────────────────────────────────────────────────────────────────────────────
async def _compute_honors(db, retailer_id: str) -> list[dict]:
    """Return the honorary badges (Trailblazer / Constant Companion) this
    retailer currently holds. Trailblazer is fully live (small set), streak
    leader reads from the weekly-refreshed cache above."""
    honors: list[dict] = []

    # Trailblazer: whoever hit the highest-order milestone fastest.
    top_ms = await db.retailer_milestones.find_one(
        {"is_active": True}, {"_id": 0}, sort=[("order", -1)],
    )
    if top_ms:
        rows = await db.retailer_achievements.find(
            {"milestone_id": top_ms["id"]}, {"_id": 0},
        ).to_list(1000)
        best_id, best_days = None, None
        for r in rows:
            rt = await db.retailers.find_one(
                {"retailer_id": r["retailer_id"]},
                {"_id": 0, "created_at": 1},
            )
            if not rt or not rt.get("created_at"):
                continue
            try:
                joined = datetime.fromisoformat(str(rt["created_at"]).replace("Z", "+00:00"))
                achieved = datetime.fromisoformat(str(r["achieved_at"]).replace("Z", "+00:00"))
                days = (achieved - joined).total_seconds() / 86400
                if best_days is None or days < best_days:
                    best_days, best_id = days, r["retailer_id"]
            except (ValueError, TypeError):
                continue
        if best_id == retailer_id:
            honors.append({
                "id": "aroma_trailblazer",
                "name": "Aroma Trailblazer",
                "reason": f"Reached {top_ms['name']} the fastest of any retailer",
                "days_to_earn": round(best_days, 1) if best_days is not None else None,
            })

    # Constant Companion: cache-backed, refreshed weekly.
    top_id, top_streak = await _get_streak_leader(db)
    if top_id == retailer_id and top_streak >= 3:
        honors.append({
            "id": "constant_companion",
            "name": "Constant Companion",
            "reason": f"Longest unbroken monthly ordering streak ({top_streak} months)",
            "streak_months": top_streak,
        })

    return honors


# ────────────────────────────────────────────────────────────────────────────
# Admin CRUD helpers
# ────────────────────────────────────────────────────────────────────────────
async def create_milestone(db, payload: dict) -> dict:
    from uuid import uuid4
    mid = payload.get("id") or f"ms-{uuid4().hex[:8]}"
    doc = {
        "id": mid,
        "name": payload["name"],
        "aroma_tag": payload.get("aroma_tag") or "sandalwood",
        "stat": payload["stat"],
        "threshold": float(payload["threshold"]),
        "description": payload.get("description") or "",
        "order": int(payload.get("order") or 100),
        "is_active": bool(payload.get("is_active", True)),
        "created_at": _now().isoformat(),
    }
    if doc["stat"] not in VALID_STATS:
        raise ValueError(f"stat must be one of {sorted(VALID_STATS)}")
    await db.retailer_milestones.insert_one(dict(doc))
    return doc


async def update_milestone(db, milestone_id: str, payload: dict) -> Optional[dict]:
    allowed = {"name", "aroma_tag", "stat", "threshold", "description", "order", "is_active"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if "stat" in update and update["stat"] not in VALID_STATS:
        raise ValueError(f"stat must be one of {sorted(VALID_STATS)}")
    if "threshold" in update:
        update["threshold"] = float(update["threshold"])
    if not update:
        return None
    result = await db.retailer_milestones.update_one(
        {"id": milestone_id}, {"$set": update},
    )
    if result.matched_count == 0:
        return None
    return await db.retailer_milestones.find_one({"id": milestone_id}, {"_id": 0})


async def delete_milestone(db, milestone_id: str) -> bool:
    """Soft-delete: flip is_active=False. Never hard-deletes because
    achievement rows reference this id (audit history must survive)."""
    result = await db.retailer_milestones.update_one(
        {"id": milestone_id}, {"$set": {"is_active": False}},
    )
    return result.matched_count > 0


async def list_milestones(db, include_inactive: bool = True) -> list[dict]:
    q = {} if include_inactive else {"is_active": True}
    return await db.retailer_milestones.find(q, {"_id": 0}).sort("order", 1).to_list(500)
