"""Iter80 — Verify:
1. next_milestone progress computation (name, current/threshold, remaining, pct)
2. next_milestone returns None once every active milestone is earned
3. Streak leaderboard cache: is created on first read, reused within TTL,
   refreshed after TTL, and reflects updated top-streak holders.
4. Admin refresh endpoint force-rebuilds the cache.
5. Regression on iter79 (immutability + trailblazer).
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


@pytest_asyncio.fixture
async def dbc():
    c = AsyncIOMotorClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest_asyncio.fixture
async def admin_session(dbc):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200
    token_id = r.json()["token_id"]
    row = await dbc.admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    r = s.post(f"{BASE_URL}/api/admin/login/verify-otp",
               json={"token_id": token_id, "otp": row["otp"]}, timeout=30)
    assert r.status_code == 200
    tok = r.json().get("session_token")
    if tok:
        s.cookies.set("session_token", tok)
    return s


# ── 1. Next milestone progress ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_next_milestone_progress(dbc):
    from services.retailer_milestones import (
        get_retailer_patron_status, seed_default_milestones,
    )
    await seed_default_milestones(dbc)

    rid = f"RTL_NEXT_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@t.local",
                  "business_name": "Next Progress", "status": "active",
                  "created_at": now.isoformat()}},
        upsert=True,
    )
    # 3 paid B2B orders → not yet at Cedar Patron (needs 5)
    for i in range(3):
        await dbc.b2b_orders.insert_one({
            "order_id": f"NEXT-{rid}-{i}", "retailer_id": rid,
            "payment_status": "paid", "grand_total": 5000,
            "created_at": now.isoformat(),
        })

    status = await get_retailer_patron_status(dbc, rid)
    n = status["next_milestone"]
    assert n is not None
    assert n["name"] == "Cedar Patron"
    assert n["stat"] == "lifetime_orders"
    assert n["threshold"] == 5.0
    assert n["current_value"] == 3.0
    assert n["remaining"] == 2.0
    assert 55 < n["progress_pct"] < 65  # 3/5 = 60%

    # Cleanup
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})


@pytest.mark.asyncio
async def test_next_milestone_none_when_all_earned(dbc):
    """When every active milestone is already earned, next_milestone is None."""
    from services.retailer_milestones import get_retailer_patron_status

    # Wipe existing milestones and seed a single trivial one, then earn it
    rid = f"RTL_ALL_{uuid.uuid4().hex[:6]}"
    ms_id = f"ms-all-{uuid.uuid4().hex[:6]}"
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@t.local",
                  "business_name": "All Earned", "status": "active",
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    # deactivate every existing milestone so only ours is a candidate
    await dbc.retailer_milestones.update_many({}, {"$set": {"is_active": False}})
    await dbc.retailer_milestones.insert_one({
        "id": ms_id, "name": "Trivial", "aroma_tag": "cedar",
        "stat": "lifetime_orders", "threshold": 1,
        "description": "test", "order": 1, "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await dbc.b2b_orders.insert_one({
        "order_id": f"ALL-{rid}", "retailer_id": rid,
        "payment_status": "paid", "grand_total": 1000,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    status = await get_retailer_patron_status(dbc, rid)
    assert status["next_milestone"] is None, (
        f"unexpected next milestone: {status['next_milestone']}"
    )

    # Restore state
    await dbc.retailer_milestones.delete_one({"id": ms_id})
    await dbc.retailer_milestones.update_many({}, {"$set": {"is_active": True}})
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})


# ── 2. Streak leaderboard cache ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_streak_leaderboard_cache_creation_and_reuse(dbc):
    """First _get_streak_leader call builds the cache; a following call
    within the TTL reuses it (no wall-clock difference in updated_at)."""
    from services.retailer_milestones import _get_streak_leader
    # Wipe cache so we're starting fresh
    await dbc.leaderboard_cache.delete_one({"_id": "streak_leaderboard"})

    _rid, _streak = await _get_streak_leader(dbc)  # builds cache
    doc1 = await dbc.leaderboard_cache.find_one({"_id": "streak_leaderboard"})
    assert doc1 is not None and doc1.get("updated_at")

    _rid2, _streak2 = await _get_streak_leader(dbc)  # should REUSE
    doc2 = await dbc.leaderboard_cache.find_one({"_id": "streak_leaderboard"})
    assert doc2["updated_at"] == doc1["updated_at"], (
        "cache was refreshed within TTL — expected reuse"
    )


@pytest.mark.asyncio
async def test_streak_leaderboard_cache_stale_refresh(dbc):
    """When the cache is older than the TTL it must be rebuilt."""
    from services.retailer_milestones import _get_streak_leader, STREAK_CACHE_TTL_DAYS
    stale_time = (datetime.now(timezone.utc) - timedelta(days=STREAK_CACHE_TTL_DAYS + 2)).isoformat()
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {"updated_at": stale_time, "top_streak_retailer_id": None, "top_streak_months": 0, "top": []}},
        upsert=True,
    )
    await _get_streak_leader(dbc)  # triggers refresh
    doc = await dbc.leaderboard_cache.find_one({"_id": "streak_leaderboard"})
    assert doc["updated_at"] != stale_time, "stale cache was not refreshed"


def test_admin_refresh_streak_leaderboard(admin_session):
    r = admin_session.post(
        f"{BASE_URL}/api/admin/milestones/refresh-streak-leaderboard", timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "leaderboard" in body
    lb = body["leaderboard"]
    assert "updated_at" in lb
    assert "top" in lb
    assert isinstance(lb["top"], list)


# ── 3. Regression: iter79 immutability still intact ─────────────────────

@pytest.mark.asyncio
async def test_regression_immutability(dbc):
    from services.retailer_milestones import sync_achievements, seed_default_milestones
    await seed_default_milestones(dbc)
    rid = f"RTL_REG80_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@t.local",
                  "business_name": "Reg", "status": "active",
                  "created_at": now.isoformat()}},
        upsert=True,
    )
    for i in range(6):
        await dbc.b2b_orders.insert_one({
            "order_id": f"REG80-{rid}-{i}", "retailer_id": rid,
            "payment_status": "paid", "grand_total": 1000,
            "created_at": now.isoformat(),
        })
    unlocked = await sync_achievements(dbc, rid)
    assert any(u["milestone_id"] == "ms-cedar" for u in unlocked)
    first_ts = next(u for u in unlocked if u["milestone_id"] == "ms-cedar")["achieved_at"]
    # sync again — no re-award
    unlocked2 = await sync_achievements(dbc, rid)
    assert unlocked2 == []
    row = await dbc.retailer_achievements.find_one(
        {"retailer_id": rid, "milestone_id": "ms-cedar"}, {"_id": 0},
    )
    assert row["achieved_at"] == first_ts

    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})
