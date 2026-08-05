"""Nudge Best-Time-to-Send analyzer.

Uses `nudges_open_log` (populated by the open-pixel endpoint) to learn
each retailer's preferred open window across the ISO week.

Algorithm:
    ▸ For every open event, extract the local hour-of-day (IST) and
      day-of-week (0=Mon … 6=Sun).
    ▸ Bucket into 3-hour slots (0-3, 3-6, 6-9, 9-12, 12-15, 15-18,
      18-21, 21-24) so we get 56 buckets across the week.
    ▸ Rank buckets by total opens and by recency (last-30-day opens
      count 2×). Return the top 3 buckets per retailer as
      `[{day, hour_start, hour_end, confidence}]`.

If the retailer has fewer than 3 open events, we fall back to the
platform-wide default window (Tue-Thu, 10:00-13:00 IST) — a well-
known B2B engagement peak.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

IST_OFFSET = timedelta(hours=5, minutes=30)

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# 3-hour slot boundaries
SLOT_STARTS = [0, 3, 6, 9, 12, 15, 18, 21]

DEFAULT_RECOMMENDATIONS = [
    {"day": "Tue", "day_index": 1, "hour_start": 10, "hour_end": 13, "confidence": 0.0, "opens": 0, "default": True},
    {"day": "Wed", "day_index": 2, "hour_start": 10, "hour_end": 13, "confidence": 0.0, "opens": 0, "default": True},
    {"day": "Thu", "day_index": 3, "hour_start": 10, "hour_end": 13, "confidence": 0.0, "opens": 0, "default": True},
]

RECENCY_BOOST_DAYS = 30


def _slot_for_hour(hour: int) -> int:
    """Map 0-23 hour to slot index 0-7 (3-hour buckets)."""
    return min(hour // 3, 7)


def _slot_bounds(slot_index: int) -> tuple[int, int]:
    start = SLOT_STARTS[slot_index]
    end = start + 3
    return start, end


def _bucket_opens(events: list[dict]) -> dict[tuple[int, int], dict]:
    """Return `{(day_index, slot_index): {opens, recent_opens}}`."""
    now = datetime.now(timezone.utc)
    buckets: dict[tuple[int, int], dict] = defaultdict(lambda: {"opens": 0, "recent_opens": 0})
    for ev in events:
        try:
            ts_raw = ev.get("opened_at") or ev.get("created_at")
            if not ts_raw:
                continue
            ts = datetime.fromisoformat(ts_raw)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        local = ts + IST_OFFSET
        day_idx = local.weekday()  # 0=Mon
        slot = _slot_for_hour(local.hour)
        key = (day_idx, slot)
        buckets[key]["opens"] += 1
        if (now - ts) <= timedelta(days=RECENCY_BOOST_DAYS):
            buckets[key]["recent_opens"] += 1
    return buckets


def _rank_slots(buckets: dict[tuple[int, int], dict], top_n: int = 3) -> list[dict]:
    """Rank by weighted score = opens + 2 × recent_opens, then by recency."""
    scored = []
    for (day, slot), stats in buckets.items():
        score = stats["opens"] + 2 * stats["recent_opens"]
        if score <= 0:
            continue
        h0, h1 = _slot_bounds(slot)
        scored.append({
            "day": DAYS[day],
            "day_index": day,
            "hour_start": h0,
            "hour_end": h1,
            "opens": stats["opens"],
            "recent_opens": stats["recent_opens"],
            "score": score,
        })
    scored.sort(key=lambda s: (s["score"], s["recent_opens"], s["opens"]), reverse=True)
    top = scored[:top_n]
    if top:
        top_score = float(top[0]["score"]) or 1.0
        for row in top:
            row["confidence"] = round(min(row["score"] / top_score, 1.0), 2)
    return top


async def recommend_send_time(
    db, *, retailer_id: str, top_n: int = 3,
) -> dict:
    """Public API — returns `{retailer_id, recommendations, sample_size, default}`."""
    cursor = db.nudges_open_log.find(
        {"retailer_id": retailer_id},
        {"_id": 0, "opened_at": 1},
    ).sort("opened_at", -1).limit(500)
    events = await cursor.to_list(500)
    sample_size = len(events)

    if sample_size < 3:
        return {
            "retailer_id": retailer_id,
            "sample_size": sample_size,
            "default": True,
            "recommendations": DEFAULT_RECOMMENDATIONS[:top_n],
            "reason": "Not enough open history yet — using B2B platform default (Tue-Thu, 10-13 IST).",
        }

    buckets = _bucket_opens(events)
    top = _rank_slots(buckets, top_n=top_n)
    if not top:
        return {
            "retailer_id": retailer_id,
            "sample_size": sample_size,
            "default": True,
            "recommendations": DEFAULT_RECOMMENDATIONS[:top_n],
        }
    return {
        "retailer_id": retailer_id,
        "sample_size": sample_size,
        "default": False,
        "recommendations": top,
    }


async def recommend_send_time_for_audience(
    db, *, retailer_ids: list[str], top_n: int = 3,
) -> dict:
    """Aggregate best-time across a specific audience of retailers so the
    composer can suggest a single send-slot for a broadcast."""
    if not retailer_ids:
        return {"sample_size": 0, "default": True, "recommendations": DEFAULT_RECOMMENDATIONS[:top_n]}

    cursor = db.nudges_open_log.find(
        {"retailer_id": {"$in": list(retailer_ids)[:2000]}},
        {"_id": 0, "opened_at": 1},
    ).sort("opened_at", -1).limit(5000)
    events = await cursor.to_list(5000)
    if len(events) < 5:
        return {
            "sample_size": len(events),
            "default": True,
            "recommendations": DEFAULT_RECOMMENDATIONS[:top_n],
            "reason": "Not enough audience-wide open history yet.",
        }
    buckets = _bucket_opens(events)
    return {
        "sample_size": len(events),
        "default": False,
        "recommendations": _rank_slots(buckets, top_n=top_n),
    }
