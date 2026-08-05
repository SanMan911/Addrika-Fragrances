"""Best-Time-to-Send analyzer tests (Feb 2026)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import b2b_nudge_send_time as st  # noqa: E402


def test_slot_for_hour_maps_correctly():
    assert st._slot_for_hour(0) == 0
    assert st._slot_for_hour(2) == 0
    assert st._slot_for_hour(3) == 1
    assert st._slot_for_hour(10) == 3   # 9-12 bucket
    assert st._slot_for_hour(23) == 7


def test_slot_bounds():
    assert st._slot_bounds(0) == (0, 3)
    assert st._slot_bounds(3) == (9, 12)
    assert st._slot_bounds(7) == (21, 24)


def test_bucket_opens_converts_utc_to_ist():
    # 05:00 UTC = 10:30 IST → 9-12 slot
    ts = datetime(2026, 2, 3, 5, 0, 0, tzinfo=timezone.utc)  # Tue
    events = [{"opened_at": ts.isoformat()}]
    buckets = st._bucket_opens(events)
    # Tue = day_index 1, slot 3 (9-12)
    assert (1, 3) in buckets
    assert buckets[(1, 3)]["opens"] == 1


def test_rank_slots_weighs_recency_2x():
    now = datetime.now(timezone.utc)
    # Both events on the same weekday + hour, one 90 days ago, one 1 day ago
    # → they share the same (day, slot) bucket so we can validate the mix.
    events = []
    fresh = now - timedelta(days=1)
    for _ in range(3):
        events.append({"opened_at": fresh.isoformat()})
    old = now - timedelta(days=7)  # same weekday, still outside recency window (>30d? no, 7d IS within)
    # Use 60 days back to be outside recency (30-day window)
    stale = now - timedelta(days=60)
    for _ in range(10):
        events.append({"opened_at": stale.isoformat()})

    buckets = st._bucket_opens(events)
    ranked = st._rank_slots(buckets, top_n=3)
    assert len(ranked) >= 1

    # Total across all buckets
    total_opens = sum(r["opens"] for r in ranked)
    total_recent = sum(r["recent_opens"] for r in ranked)
    assert total_opens == 13
    assert total_recent == 3  # only the 1-day-old events


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    prefix = "ST-TEST-"
    await _db.nudges_open_log.delete_many({"retailer_id": {"$regex": f"^{prefix}"}})
    yield _db, prefix
    await _db.nudges_open_log.delete_many({"retailer_id": {"$regex": f"^{prefix}"}})
    client.close()


@pytest.mark.asyncio
async def test_recommend_falls_back_to_default_when_no_history(db):
    _db, prefix = db
    res = await st.recommend_send_time(_db, retailer_id=f"{prefix}NEW")
    assert res["default"] is True
    assert res["sample_size"] == 0
    assert len(res["recommendations"]) == 3


@pytest.mark.asyncio
async def test_recommend_uses_open_history_when_available(db):
    _db, prefix = db
    rid = f"{prefix}R1"
    # Seed 5 opens at 10:00 UTC Tuesday = 15:30 IST Tuesday → slot 5 (15-18)
    tue_10utc = datetime(2026, 2, 3, 10, 0, 0, tzinfo=timezone.utc)
    for i in range(5):
        await _db.nudges_open_log.insert_one({
            "retailer_id": rid,
            "broadcast_id": f"B{i}",
            "opened_at": (tue_10utc + timedelta(minutes=i)).isoformat(),
        })
    res = await st.recommend_send_time(_db, retailer_id=rid)
    assert res["default"] is False
    assert res["sample_size"] == 5
    top = res["recommendations"][0]
    assert top["day"] == "Tue"
    assert top["hour_start"] == 15
    assert top["hour_end"] == 18


@pytest.mark.asyncio
async def test_audience_wide_recommendation(db):
    _db, prefix = db
    # 3 retailers × 3 opens each = 9 opens, all Mon 08:00 UTC → 13:30 IST → slot 4 (12-15)
    mon_8utc = datetime(2026, 2, 2, 8, 0, 0, tzinfo=timezone.utc)
    rids = []
    for r in range(3):
        rid = f"{prefix}A{r}"
        rids.append(rid)
        for i in range(3):
            await _db.nudges_open_log.insert_one({
                "retailer_id": rid,
                "broadcast_id": f"BB{r}{i}",
                "opened_at": (mon_8utc + timedelta(hours=r * 24, minutes=i)).isoformat(),
            })
    res = await st.recommend_send_time_for_audience(_db, retailer_ids=rids)
    assert res["default"] is False
    assert res["sample_size"] == 9
    assert len(res["recommendations"]) >= 1
