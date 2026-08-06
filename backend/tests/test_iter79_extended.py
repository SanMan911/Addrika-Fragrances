"""Iter79 extended verification (independent of main iter79 file).

Covers:
- sync_achievements return snapshot shape (achieved_at, milestone_name_at_time,
  stat, threshold_at_time, stat_value_at_time)
- 401 on /api/retailer-dashboard/patron without session
- run_post_payment_hooks triggers milestone unlock on a synthetic paid order
- DEFAULT_MILESTONES names + thresholds match the PRD documentation
- Soft-delete keeps the row when include_inactive=true (already covered)
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


@pytest_asyncio.fixture
async def dbc():
    c = AsyncIOMotorClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


# ── DEFAULT_MILESTONES not drifted ─────────────────────────────────────
def test_default_milestones_match_prd():
    from services.retailer_milestones import DEFAULT_MILESTONES
    by_name = {m["name"]: m for m in DEFAULT_MILESTONES}
    assert set(by_name.keys()) == {
        "Cedar Patron", "Sandalwood Sage", "Oudh Master",
        "Musk Maven", "Amber Guardian",
    }
    assert by_name["Cedar Patron"]["threshold"] == 5
    assert by_name["Cedar Patron"]["stat"] == "lifetime_orders"
    assert by_name["Sandalwood Sage"]["threshold"] == 20
    assert by_name["Oudh Master"]["threshold"] == 50
    assert by_name["Musk Maven"]["threshold"] == 100000
    assert by_name["Musk Maven"]["stat"] == "lifetime_gmv_inr"
    assert by_name["Amber Guardian"]["threshold"] == 12
    assert by_name["Amber Guardian"]["stat"] == "active_months"


# ── 401 without session ─────────────────────────────────────────────────
def test_retailer_dashboard_patron_requires_session():
    r = requests.get(f"{BASE_URL}/api/retailer-dashboard/patron", timeout=10)
    assert r.status_code == 401


# ── sync_achievements return shape ──────────────────────────────────────
@pytest.mark.asyncio
async def test_sync_achievements_return_shape(dbc):
    from services.retailer_milestones import sync_achievements, seed_default_milestones
    await seed_default_milestones(dbc)

    rid = f"RTL_SHAPE_{uuid.uuid4().hex[:6]}"
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@t.local",
                  "business_name": "Shape Test", "status": "active",
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    for i in range(6):
        await dbc.b2b_orders.insert_one({
            "order_id": f"SHAPE-{rid}-{i}", "retailer_id": rid,
            "payment_status": "paid", "grand_total": 500,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    unlocked = await sync_achievements(dbc, rid)
    assert len(unlocked) >= 1
    cedar = next((u for u in unlocked if u["milestone_id"] == "ms-cedar"), None)
    assert cedar is not None
    for k in ("retailer_id", "milestone_id", "aroma_tag",
              "milestone_name_at_time", "stat", "threshold_at_time",
              "stat_value_at_time", "achieved_at"):
        assert k in cedar, f"missing '{k}' in unlocked payload"
    # ISO 8601 parses cleanly
    datetime.fromisoformat(cedar["achieved_at"].replace("Z", "+00:00"))
    assert cedar["stat"] == "lifetime_orders"
    assert cedar["threshold_at_time"] == 5
    assert cedar["stat_value_at_time"] >= 5
    assert cedar["milestone_name_at_time"] == "Cedar Patron"

    # cleanup
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})


# ── run_post_payment_hooks triggers milestone sync ─────────────────────
@pytest.mark.asyncio
async def test_post_payment_hook_syncs_milestones(dbc):
    from services.b2b_payment_hooks import run_post_payment_hooks
    from services.retailer_milestones import seed_default_milestones
    await seed_default_milestones(dbc)

    rid = f"RTL_HOOK_{uuid.uuid4().hex[:6]}"
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {"retailer_id": rid, "email": f"{rid}@t.local",
                  "business_name": "Hook Test", "status": "active",
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    # Pre-seed 5 paid orders (== Cedar Patron threshold)
    for i in range(5):
        await dbc.b2b_orders.insert_one({
            "order_id": f"HOOK-{rid}-{i}", "retailer_id": rid,
            "payment_status": "paid", "grand_total": 1000,
            "subtotal": 900, "shipping_charges": 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Nothing yet unlocked
    pre = await dbc.retailer_achievements.count_documents(
        {"retailer_id": rid, "milestone_id": "ms-cedar"}
    )
    assert pre == 0

    fake_order = {
        "order_id": f"HOOK-{rid}-trigger", "retailer_id": rid,
        "payment_status": "paid", "grand_total": 1000,
        "subtotal": 900, "shipping_charges": 100,
        "rewards_redeemed_inr": 0,
    }
    retailer = {"retailer_id": rid, "email": f"{rid}@t.local",
                "business_name": "Hook Test"}

    # Insert the trigger order (so lifetime_orders becomes 6 ≥ 5)
    await dbc.b2b_orders.insert_one({**fake_order,
        "created_at": datetime.now(timezone.utc).isoformat()})

    # Hook is guarded; even if sub-hooks throw, milestone sync must still run
    try:
        await run_post_payment_hooks(dbc, fake_order, retailer, "pay_test_xyz")
    except Exception as e:
        pytest.fail(f"post-payment hook unexpectedly raised: {e}")

    post = await dbc.retailer_achievements.find_one(
        {"retailer_id": rid, "milestone_id": "ms-cedar"}, {"_id": 0}
    )
    assert post is not None, "post-payment hook did not sync milestones"
    assert post["milestone_name_at_time"] == "Cedar Patron"

    # cleanup
    await dbc.retailer_achievements.delete_many({"retailer_id": rid})
    await dbc.retailers.delete_many({"retailer_id": rid})
    await dbc.b2b_orders.delete_many({"retailer_id": rid})
