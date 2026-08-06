"""Iter79 — Verify:
1. Milestone CRUD (admin) + soft-delete preserves achievements
2. Achievement timestamps are IMMUTABLE (never overwritten)
3. sync_achievements unlocks a milestone the moment the threshold is crossed
4. Fastest-achiever honor (Aroma Trailblazer) awarded to the correct retailer
5. Retailer patron status endpoint works
6. Standalone app manifest lists cart + checkout endpoints
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


# ── 1. Admin milestone CRUD ─────────────────────────────────────────────

def test_milestone_crud_flow(admin_session):
    # Seed / list
    r = admin_session.get(f"{BASE_URL}/api/admin/milestones", timeout=15)
    assert r.status_code == 200
    initial = r.json()["milestones"]
    assert len(initial) >= 5  # defaults should have been seeded

    # Create
    payload = {
        "name": f"Kewda Guardian {uuid.uuid4().hex[:6]}",
        "aroma_tag": "kewda",
        "stat": "lifetime_orders",
        "threshold": 3,
        "description": "test milestone",
        "order": 15,
        "is_active": True,
    }
    r = admin_session.post(f"{BASE_URL}/api/admin/milestones", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    mid = r.json()["milestone"]["id"]

    # Update
    r = admin_session.put(f"{BASE_URL}/api/admin/milestones/{mid}",
                          json={"threshold": 5, "description": "updated"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["milestone"]["threshold"] == 5

    # Reject invalid stat
    r = admin_session.post(f"{BASE_URL}/api/admin/milestones",
                           json={**payload, "stat": "nonsense"}, timeout=15)
    assert r.status_code == 400

    # Soft-delete
    r = admin_session.delete(f"{BASE_URL}/api/admin/milestones/{mid}", timeout=15)
    assert r.status_code == 200
    # Deactivated but still returned when include_inactive=true
    r = admin_session.get(f"{BASE_URL}/api/admin/milestones?include_inactive=true", timeout=15)
    all_ms = r.json()["milestones"]
    row = next((m for m in all_ms if m["id"] == mid), None)
    assert row is not None
    assert row["is_active"] is False


# ── 2. Achievement IMMUTABILITY ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_achievement_timestamp_is_immutable(dbc):
    """After a retailer earns a milestone, calling sync_achievements
    twice must NOT change the achievement's achieved_at timestamp."""
    from services.retailer_milestones import sync_achievements, seed_default_milestones

    await seed_default_milestones(dbc)

    rid = f"RTL_IMMUT_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@test.local",
                  "business_name": "Immutable Test",
                  "status": "active", "created_at": now}},
        upsert=True,
    )
    # Fabricate 6 paid B2B orders → crosses "Cedar Patron" (5 orders)
    for i in range(6):
        await dbc.b2b_orders.insert_one({
            "order_id": f"IMMUT-{rid}-{i}",
            "retailer_id": rid,
            "payment_status": "paid",
            "grand_total": 1000,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=30 - i * 5)).isoformat(),
        })

    unlocked1 = await sync_achievements(dbc, rid)
    cedar = next((u for u in unlocked1 if u["milestone_id"] == "ms-cedar"), None)
    assert cedar, "Cedar Patron should have unlocked"
    first_ts = cedar["achieved_at"]

    # Second run: nothing new, timestamp untouched
    unlocked2 = await sync_achievements(dbc, rid)
    assert unlocked2 == [], f"unexpected re-award: {unlocked2}"
    row = await dbc.retailer_achievements.find_one(
        {"retailer_id": rid, "milestone_id": "ms-cedar"}, {"_id": 0}
    )
    assert row["achieved_at"] == first_ts, "achieved_at was overwritten — immutability broken"

    # Even if admin RAISES the threshold, the already-earned row stays put
    await dbc.retailer_milestones.update_one(
        {"id": "ms-cedar"}, {"$set": {"threshold": 999}}
    )
    unlocked3 = await sync_achievements(dbc, rid)
    row = await dbc.retailer_achievements.find_one(
        {"retailer_id": rid, "milestone_id": "ms-cedar"}, {"_id": 0}
    )
    assert row is not None
    assert row["achieved_at"] == first_ts

    # Cleanup
    await dbc.retailer_milestones.update_one({"id": "ms-cedar"}, {"$set": {"threshold": 5}})
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})


# ── 3. Fastest-achiever honor ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_trailblazer_honor_goes_to_fastest(dbc):
    """Two retailers earn the top milestone. The one who did it faster
    should hold the Aroma Trailblazer honor."""
    from services.retailer_milestones import (
        sync_achievements, seed_default_milestones, get_retailer_patron_status,
    )
    await seed_default_milestones(dbc)

    # Create a test-owned top milestone (order=9999) with a tiny lifetime_orders
    # threshold so the fixture can guarantee both retailers cross it.
    test_ms_id = f"ms-test-tb-{uuid.uuid4().hex[:6]}"
    await dbc.retailer_milestones.insert_one({
        "id": test_ms_id, "name": "Test Trailblazer Peak",
        "aroma_tag": "kewda", "stat": "lifetime_orders", "threshold": 2,
        "description": "test", "order": 9999, "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Retailer A: joined 100 days ago
    rid_a = f"RTL_A_{uuid.uuid4().hex[:6]}"
    joined_a = datetime.now(timezone.utc) - timedelta(days=100)
    await dbc.retailers.update_one(
        {"retailer_id": rid_a},
        {"$set": {"retailer_id": rid_a, "email": f"{rid_a}@t.local",
                  "business_name": "Fast A", "status": "active",
                  "created_at": joined_a.isoformat()}},
        upsert=True,
    )
    # Retailer B: joined 10 days ago (will hit threshold today = faster)
    rid_b = f"RTL_B_{uuid.uuid4().hex[:6]}"
    joined_b = datetime.now(timezone.utc) - timedelta(days=10)
    await dbc.retailers.update_one(
        {"retailer_id": rid_b},
        {"$set": {"retailer_id": rid_b, "email": f"{rid_b}@t.local",
                  "business_name": "Fast B", "status": "active",
                  "created_at": joined_b.isoformat()}},
        upsert=True,
    )

    # Give each retailer 3 paid orders (crosses threshold of 2)
    for r_id in (rid_a, rid_b):
        for i in range(3):
            await dbc.b2b_orders.insert_one({
                "order_id": f"TB-{r_id}-{i}", "retailer_id": r_id,
                "payment_status": "paid", "grand_total": 5000,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    await sync_achievements(dbc, rid_a)
    await sync_achievements(dbc, rid_b)

    status_b = await get_retailer_patron_status(dbc, rid_b)
    status_a = await get_retailer_patron_status(dbc, rid_a)

    b_has = any(h["id"] == "aroma_trailblazer" for h in status_b["honors"])
    a_has = any(h["id"] == "aroma_trailblazer" for h in status_a["honors"])
    assert b_has, "Faster retailer B should hold the Trailblazer honor"
    assert not a_has, "Slower retailer A must NOT hold Trailblazer"

    # Cleanup
    await dbc.retailer_milestones.delete_one({"id": test_ms_id})
    for r_id in (rid_a, rid_b):
        await dbc.retailer_achievements.delete_many({"retailer_id": r_id})
        await dbc.retailers.delete_many({"retailer_id": r_id})
        await dbc.b2b_orders.delete_many({"retailer_id": r_id})


# ── 4. Manifest lists standalone e-commerce endpoints ──────────────────

def test_manifest_lists_ecommerce_endpoints():
    r = requests.get(f"{BASE_URL}/api/app/manifest", timeout=15)
    assert r.status_code == 200
    endpoints = r.json()["stable_endpoints"]
    # Mobile e-commerce app needs to hit these — must be discoverable
    for key in ("cart_add", "checkout_create_order", "checkout_verify_payment",
                "customer_orders", "product_asset", "retailer_patron"):
        assert key in endpoints, f"manifest missing '{key}'"


# ── 5. Admin can read any retailer's patron status ─────────────────────

@pytest.mark.asyncio
async def test_admin_read_retailer_patron(admin_session, dbc):
    from services.retailer_milestones import seed_default_milestones
    await seed_default_milestones(dbc)
    rid = "RTL_TEST_ITER75"  # created by iter75 fixture, still around
    r = admin_session.get(
        f"{BASE_URL}/api/admin/retailers/{rid}/patron", timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["retailer_id"] == rid
    assert "achievements" in body and "honors" in body
