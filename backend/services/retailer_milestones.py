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

    # Fire the celebration nudge for each freshly-earned milestone. Guarded
    # so a notification failure never rolls back the achievement.
    if newly_unlocked:
        try:
            await _notify_milestone_unlocked(db, retailer_id, newly_unlocked)
        except Exception as e:
            logger.warning(
                "Milestone unlock notification failed for %s: %s",
                retailer_id, e,
            )

    return newly_unlocked


async def _notify_milestone_unlocked(
    db, retailer_id: str, rows: list[dict],
) -> None:
    """Send retailer a 🎉 email + WhatsApp when they unlock a new patron tag."""
    from services.email_service import send_email, is_email_service_available

    retailer = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0}) or {}
    first_name = str(
        (retailer.get("spoc") or {}).get("name")
        or retailer.get("business_name") or "there"
    ).split(" ")[0].strip() or "there"

    for row in rows:
        tag = row.get("milestone_name_at_time", "a new patron tag")
        aroma = row.get("aroma_tag") or "sandalwood"

        # Email
        try:
            if is_email_service_available() and retailer.get("email"):
                await send_email(
                    to_email=retailer["email"],
                    subject=f"🎉 You just earned {tag} · Addrika Patron Journey",
                    html_content=_milestone_email_html(first_name, tag, aroma, row),
                )
        except Exception as e:
            logger.debug("milestone email failed: %s", e)

        # WhatsApp
        try:
            from services.b2b_restock_nudge import _e164, _send_whatsapp_impl
            to = _e164(
                retailer.get("whatsapp") or retailer.get("phone"),
                retailer.get("whatsapp_country_code"),
            )
            if to:
                await _send_whatsapp_impl(to, _milestone_whatsapp_body(first_name, tag))
        except Exception as e:
            logger.debug("milestone whatsapp failed: %s", e)


def _milestone_email_html(name: str, tag: str, aroma: str, row: dict) -> str:
    achieved_at = str(row.get("achieved_at", ""))[:10]
    return f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <div style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <div style='background:linear-gradient(135deg,#D4AF37,#B8860B);padding:32px;text-align:center;color:#1e3a52;'>
          <div style='font-size:44px;margin-bottom:6px;'>🎉</div>
          <div style='font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.75;'>Addrika Patron Journey</div>
          <div style='font-size:28px;font-weight:700;margin-top:6px;'>{tag}</div>
        </div>
        <div style='padding:26px;'>
          <p style='font-size:15px;margin:0 0 12px;'>Namaste {name},</p>
          <p style='font-size:14px;color:#333;margin:0 0 12px;'>
            You&apos;ve just unlocked <b>{tag}</b> — a permanent aroma-themed patron
            tag in your Addrika journey. Earned on {achieved_at} · this timestamp
            is set in stone, immutable in our audit history.
          </p>
          <p style='font-size:13px;color:#666;margin:16px 0 4px;'>
            Your tag now shows on your rewards page and in the admin&apos;s partner directory.
          </p>
          <a href='https://centraders.com/retailer/b2b/rewards' style='display:inline-block;
            background:#1e3a52;color:#D4AF37;padding:12px 22px;border-radius:6px;
            font-weight:600;text-decoration:none;margin-top:12px;'>
            See your Patron Journey
          </a>
          <p style='font-size:11px;color:#999;margin-top:20px;'>
            Aroma family: <b>{aroma}</b>. More tags await as you grow with us.
          </p>
        </div>
      </div>
    </body></html>
    """


def _milestone_whatsapp_body(name: str, tag: str) -> str:
    return (
        f"🎉 Congrats {name}! You just earned *{tag}* — a permanent patron tag on your Addrika journey.\n\n"
        f"Every tag you earn is dated the moment you crossed the threshold and stays with you forever.\n\n"
        f"See it 👉 https://centraders.com/retailer/b2b/rewards"
    )



async def get_retailer_patron_status(db, retailer_id: str) -> dict:
    """Assemble the retailer's full patron status: current tag(s),
    achievement history, honor badges, tier ring AND the next milestone."""
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
    tier = compute_tier(len(enriched))

    return {
        "retailer_id": retailer_id,
        "current_patron_tag": highest["name"] if highest else None,
        "current_aroma": highest["aroma_tag"] if highest else None,
        "tier": tier,
        "achievements": enriched,
        "honors": honors,
        "next_milestone": next_milestone,
    }


# ────────────────────────────────────────────────────────────────────────────
# Aroma Ranking Tiers — Bronze / Silver / Gold rings
# ────────────────────────────────────────────────────────────────────────────
TIER_BRONZE = {"id": "bronze", "label": "Bronze",   "min_achievements": 1, "color": "#CD7F32", "ring_class": "ring-orange-400"}
TIER_SILVER = {"id": "silver", "label": "Silver",   "min_achievements": 3, "color": "#C0C0C0", "ring_class": "ring-slate-400"}
TIER_GOLD   = {"id": "gold",   "label": "Gold",     "min_achievements": 5, "color": "#FFD700", "ring_class": "ring-amber-400"}
TIER_NEW    = {"id": "novice", "label": "Novice",   "min_achievements": 0, "color": "#94a3b8", "ring_class": "ring-slate-300"}
_TIERS = [TIER_GOLD, TIER_SILVER, TIER_BRONZE, TIER_NEW]


def compute_tier(achievement_count: int) -> dict:
    """Return the tier a retailer sits in based on how many tags they've earned.
    Tiers cascade — a retailer with 5+ achievements is Gold, 3-4 is Silver,
    1-2 is Bronze, 0 is Novice."""
    for tier in _TIERS:
        if achievement_count >= tier["min_achievements"]:
            # Enrich with progress-to-next-tier so the UI can hint at growth
            next_tier = None
            for candidate in reversed(_TIERS):
                if candidate["min_achievements"] > tier["min_achievements"]:
                    next_tier = candidate
                    break
            return {
                **tier,
                "achievements_count": achievement_count,
                "next_tier": ({
                    "id": next_tier["id"], "label": next_tier["label"],
                    "min_achievements": next_tier["min_achievements"],
                    "tags_to_go": max(0, next_tier["min_achievements"] - achievement_count),
                } if next_tier else None),
            }
    return {**TIER_NEW, "achievements_count": achievement_count, "next_tier": None}


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
