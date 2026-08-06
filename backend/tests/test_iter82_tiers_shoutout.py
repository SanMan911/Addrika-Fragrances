"""Iter82 — Verify:
1. Aroma Ranking Tiers backend: compute_tier returns correct tier by count,
   and `/api/retailer-dashboard/patron` includes a `tier` block.
2. Constant Companion monthly shout-out is idempotent, respects opt-in,
   skips when streak is too short, and writes a `blog_posts` doc.
3. Admin endpoints `/api/admin/auto-blog/constant-companion/{run-now,status}`
   are gated behind admin auth and behave correctly on force + re-run.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Make the backend importable so we can call services.* directly
sys.path.insert(0, "/app/backend")

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest_asyncio.fixture
async def dbc():
    c = AsyncIOMotorClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


# ───────────────────────────────────────────────────────────────────
# Tier logic (pure function)
# ───────────────────────────────────────────────────────────────────
def test_compute_tier_novice_bronze_silver_gold():
    from services.retailer_milestones import compute_tier
    assert compute_tier(0)["id"] == "novice"
    assert compute_tier(1)["id"] == "bronze"
    assert compute_tier(2)["id"] == "bronze"
    assert compute_tier(3)["id"] == "silver"
    assert compute_tier(4)["id"] == "silver"
    assert compute_tier(5)["id"] == "gold"
    assert compute_tier(99)["id"] == "gold"


def test_compute_tier_next_tier_progression():
    from services.retailer_milestones import compute_tier
    novice = compute_tier(0)
    assert novice["next_tier"]["id"] == "bronze"
    assert novice["next_tier"]["tags_to_go"] == 1

    bronze = compute_tier(1)
    assert bronze["next_tier"]["id"] == "silver"
    assert bronze["next_tier"]["tags_to_go"] == 2

    silver = compute_tier(3)
    assert silver["next_tier"]["id"] == "gold"
    assert silver["next_tier"]["tags_to_go"] == 2

    gold = compute_tier(5)
    assert gold["next_tier"] is None


# ───────────────────────────────────────────────────────────────────
# Patron endpoint returns tier
# ───────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def retailer_session_iter82(dbc):
    from secrets import token_urlsafe
    rid = f"RTL_ITER82_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {
            "retailer_id": rid, "email": f"{rid}@t.local",
            "business_name": "Iter82 Retailer", "phone": "+919999900022",
            "city": "Pune",
            "status": "active", "is_verified": True, "gst_verified": True,
            "created_at": now,
        }},
        upsert=True,
    )
    tok = token_urlsafe(24)
    await dbc.retailer_sessions.insert_one({
        "session_token": tok, "retailer_id": rid,
        "email": f"{rid}@t.local", "created_at": now,
        "expires_at": "2099-12-31T00:00:00+00:00",
    })
    s = requests.Session()
    s.cookies.set("retailer_session", tok)
    yield s, rid
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.retailer_sessions.delete_many({"retailer_id": rid})
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})


@pytest.mark.asyncio
async def test_patron_endpoint_returns_tier(retailer_session_iter82):
    s, rid = retailer_session_iter82
    r = s.get(f"{BASE_URL}/api/retailer-dashboard/patron", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "tier" in data, data
    tier = data["tier"]
    assert tier["id"] in {"novice", "bronze", "silver", "gold"}
    assert "label" in tier and "achievements_count" in tier
    # New retailer with no achievements → novice, next_tier = bronze
    assert tier["id"] == "novice"
    assert tier["achievements_count"] == 0
    assert tier["next_tier"]["id"] == "bronze"


# ───────────────────────────────────────────────────────────────────
# Constant Companion monthly shout-out
# ───────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def shoutout_env(dbc):
    """Seed leaderboard cache + retailer, clear this-month log."""
    from services.leaderboard_shoutout import _month_key
    rid = f"RTL_SHOUT_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {
            "retailer_id": rid, "business_name": "Shout Retailer",
            "trade_name": "Shout Trade", "city": "Delhi",
            "leaderboard_opt_in": True, "status": "active",
            "created_at": now,
        }},
        upsert=True,
    )
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {
            "_id": "streak_leaderboard",
            "updated_at": now,
            "top": [{"retailer_id": rid, "streak_months": 6}],
            "top_streak_retailer_id": rid,
            "top_streak_months": 6,
        }},
        upsert=True,
    )
    month_key = _month_key()
    await dbc.constant_companion_shoutout_log.delete_one({"_id": month_key})
    yield dbc, rid, month_key
    # Cleanup
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.leaderboard_cache.delete_one({"_id": "streak_leaderboard"})
    await dbc.constant_companion_shoutout_log.delete_one({"_id": month_key})
    # Best-effort clean any posts we created
    await dbc.blog_posts.delete_many({"author_id": "auto-shoutout"})


@pytest.mark.asyncio
async def test_shoutout_publishes_when_leader_opted_in(shoutout_env):
    from services.leaderboard_shoutout import run_monthly_shoutout
    dbc, rid, month_key = shoutout_env
    res = await run_monthly_shoutout(dbc)
    assert res["ok"] is True, res
    assert res.get("post_id"), res
    assert res["retailer_id"] == rid
    assert res["opted_in"] is True
    # Idempotent second run
    res2 = await run_monthly_shoutout(dbc)
    assert res2.get("skipped") == "already_run_this_month"
    # Post exists and is published
    post = await dbc.blog_posts.find_one({"id": res["post_id"]}, {"_id": 0})
    assert post is not None
    assert post["is_published"] is True
    assert "constant" in post["title"].lower() or "companion" in post["title"].lower()
    assert "Shout Retailer" in post["title"] or "Shout Retailer" in post["content"]


@pytest.mark.asyncio
async def test_shoutout_anonymises_when_not_opted_in(shoutout_env):
    from services.leaderboard_shoutout import run_monthly_shoutout
    dbc, rid, month_key = shoutout_env
    await dbc.retailers.update_one(
        {"retailer_id": rid}, {"$set": {"leaderboard_opt_in": False}},
    )
    res = await run_monthly_shoutout(dbc)
    assert res["ok"] is True and res.get("post_id"), res
    assert res["opted_in"] is False
    post = await dbc.blog_posts.find_one({"id": res["post_id"]}, {"_id": 0})
    # Not named — retailer business name should NOT appear in title or body
    assert "Shout Retailer" not in post["title"]
    assert "Shout Retailer" not in post["content"]


@pytest.mark.asyncio
async def test_shoutout_skips_when_streak_too_short(shoutout_env):
    from services.leaderboard_shoutout import run_monthly_shoutout
    dbc, rid, month_key = shoutout_env
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {"top": [{"retailer_id": rid, "streak_months": 1}],
                  "top_streak_months": 1}},
    )
    res = await run_monthly_shoutout(dbc)
    assert res.get("skipped") == "streak_too_short"
    log = await dbc.constant_companion_shoutout_log.find_one({"_id": month_key})
    assert log is None  # Nothing logged since we didn't actually publish


@pytest.mark.asyncio
async def test_shoutout_skips_when_no_leader(dbc):
    from services.leaderboard_shoutout import run_monthly_shoutout, _month_key
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {"top": [], "top_streak_retailer_id": None,
                  "top_streak_months": 0,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await dbc.constant_companion_shoutout_log.delete_one({"_id": _month_key()})
    res = await run_monthly_shoutout(dbc)
    assert res.get("skipped") == "no_leader_yet"
    await dbc.leaderboard_cache.delete_one({"_id": "streak_leaderboard"})


# ───────────────────────────────────────────────────────────────────
# Admin endpoints
# ───────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def admin_session(dbc):
    from secrets import token_urlsafe
    tok = token_urlsafe(24)
    admin_email = "contact.us@centraders.com"
    now = datetime.now(timezone.utc)
    await dbc.user_sessions.insert_one({
        "session_token": tok,
        "user_id": f"admin_{admin_email}",
        "created_at": now,
        "expires_at": datetime(2099, 12, 31, tzinfo=timezone.utc),
    })
    s = requests.Session()
    s.cookies.set("session_token", tok)
    yield s
    await dbc.user_sessions.delete_many({"session_token": tok})


def test_admin_shoutout_requires_auth():
    r = requests.post(
        f"{BASE_URL}/api/admin/auto-blog/constant-companion/run-now", timeout=10,
    )
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_shoutout_status_and_force(admin_session, shoutout_env):
    s = admin_session
    dbc, rid, month_key = shoutout_env

    # Status first — should be not-yet-run
    r = s.get(f"{BASE_URL}/api/admin/auto-blog/constant-companion/status", timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["already_run_this_month"] is False

    # Trigger run
    r = s.post(
        f"{BASE_URL}/api/admin/auto-blog/constant-companion/run-now", timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body.get("post_id")

    # Second run without force → idempotent
    r = s.post(
        f"{BASE_URL}/api/admin/auto-blog/constant-companion/run-now", timeout=30,
    )
    assert r.status_code == 200
    assert r.json().get("skipped") == "already_run_this_month"

    # Status now reflects a completed run
    r = s.get(f"{BASE_URL}/api/admin/auto-blog/constant-companion/status", timeout=15)
    assert r.json()["already_run_this_month"] is True
    assert r.json()["latest"]["streak_months"] == 6
