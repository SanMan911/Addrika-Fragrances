"""Iter81 — Verify:
1. Milestone unlock notification: helpers exist + email/whatsapp bodies render
2. Public leaderboard endpoint respects opt-in flag
3. Retailer leaderboard opt-in CRUD works
4. Weekly refresh loop function exists and updates the cache
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest_asyncio.fixture
async def dbc():
    c = AsyncIOMotorClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest_asyncio.fixture
async def retailer_session(dbc):
    from secrets import token_urlsafe
    rid = f"RTL_ITER81_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {
            "retailer_id": rid, "email": f"{rid}@t.local",
            "business_name": "Iter81 Retailer", "phone": "+919999900021",
            "city": "Mumbai",
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
    # Cleanup
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.retailer_sessions.delete_many({"retailer_id": rid})


# ── 1. Unlock notification helpers ───────────────────────────────────────

def test_milestone_email_html_contains_tag_and_name():
    from services.retailer_milestones import _milestone_email_html
    html = _milestone_email_html("Priya", "Cedar Patron", "cedar",
                                 {"achieved_at": "2026-02-06T12:00:00+00:00"})
    assert "Priya" in html
    assert "Cedar Patron" in html
    assert "cedar" in html
    assert "2026-02-06" in html


def test_milestone_whatsapp_body_matches_shape():
    from services.retailer_milestones import _milestone_whatsapp_body
    body = _milestone_whatsapp_body("Ravi", "Musk Maven")
    assert "Ravi" in body
    assert "*Musk Maven*" in body
    assert "https://" in body


# ── 2. Public leaderboard respects opt-in ────────────────────────────────

@pytest.mark.asyncio
async def test_public_leaderboard_hides_non_opted_in(dbc):
    """Retailers with opt_in=False are absent from /api/community/leaderboard
    even if they're in the streak cache top-3."""
    # Force a cache entry pointing at a synthetic non-opted-in retailer
    fake_rid = f"RTL_HIDDEN_{uuid.uuid4().hex[:6]}"
    await dbc.retailers.update_one(
        {"retailer_id": fake_rid},
        {"$set": {"retailer_id": fake_rid, "business_name": "Hidden Test Co",
                  "leaderboard_opt_in": False, "status": "active"}},
        upsert=True,
    )
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "top": [{"retailer_id": fake_rid, "streak_months": 12}],
            "top_streak_retailer_id": fake_rid, "top_streak_months": 12,
        }},
        upsert=True,
    )
    r = requests.get(f"{BASE_URL}/api/community/leaderboard", timeout=15)
    assert r.status_code == 200
    names = [e.get("display_name") for e in r.json().get("top", [])]
    assert "Hidden Test Co" not in names, "opted-out retailer leaked onto public page"

    await dbc.retailers.delete_many({"retailer_id": fake_rid})


@pytest.mark.asyncio
async def test_public_leaderboard_includes_opted_in(dbc):
    rid = f"RTL_SHOWN_{uuid.uuid4().hex[:6]}"
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "business_name": "Shown Test Co",
                  "city": "Delhi", "leaderboard_opt_in": True,
                  "status": "active"}},
        upsert=True,
    )
    await dbc.leaderboard_cache.update_one(
        {"_id": "streak_leaderboard"},
        {"$set": {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "top": [{"retailer_id": rid, "streak_months": 8}],
            "top_streak_retailer_id": rid, "top_streak_months": 8,
        }},
        upsert=True,
    )
    r = requests.get(f"{BASE_URL}/api/community/leaderboard", timeout=15)
    body = r.json()
    names = [e.get("display_name") for e in body.get("top", [])]
    assert "Shown Test Co" in names
    row = next(e for e in body["top"] if e["display_name"] == "Shown Test Co")
    assert row["city"] == "Delhi"
    assert row["streak_months"] == 8

    await dbc.retailers.delete_many({"retailer_id": rid})


# ── 3. Retailer opt-in CRUD ──────────────────────────────────────────────

def test_retailer_optin_crud(retailer_session):
    s, _rid = retailer_session
    r = s.get(f"{BASE_URL}/api/retailer-dashboard/leaderboard-opt-in", timeout=15)
    assert r.status_code == 200
    assert r.json()["opt_in"] is False

    r = s.put(f"{BASE_URL}/api/retailer-dashboard/leaderboard-opt-in",
              json={"opt_in": True}, timeout=15)
    assert r.status_code == 200
    assert r.json()["opt_in"] is True

    r = s.get(f"{BASE_URL}/api/retailer-dashboard/leaderboard-opt-in", timeout=15)
    assert r.json()["opt_in"] is True

    # Opt out again
    r = s.put(f"{BASE_URL}/api/retailer-dashboard/leaderboard-opt-in",
              json={"opt_in": False}, timeout=15)
    assert r.status_code == 200
    assert r.json()["opt_in"] is False


def test_retailer_optin_requires_auth():
    r = requests.get(f"{BASE_URL}/api/retailer-dashboard/leaderboard-opt-in", timeout=15)
    assert r.status_code in (401, 403)


# ── 4. Weekly refresh loop is importable and runs one iteration ─────────

def test_weekly_refresh_loop_exists():
    from services.monthly_rewards_digest import streak_leaderboard_weekly_loop
    assert callable(streak_leaderboard_weekly_loop)


@pytest.mark.asyncio
async def test_refresh_streak_leaderboard_updates_timestamp(dbc):
    """refresh_streak_leaderboard() writes a fresh updated_at every time."""
    from services.retailer_milestones import refresh_streak_leaderboard
    doc1 = await refresh_streak_leaderboard(dbc)
    import asyncio
    await asyncio.sleep(0.05)
    doc2 = await refresh_streak_leaderboard(dbc)
    assert doc2["updated_at"] > doc1["updated_at"]


# ── 5. Retailer catalog progress widget: endpoint returns next_milestone ─

def test_retailer_patron_endpoint_carries_next_milestone(retailer_session):
    s, _ = retailer_session
    r = s.get(f"{BASE_URL}/api/retailer-dashboard/patron", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "next_milestone" in body  # may be None if all earned; key must exist
