"""Regression tests for Fragrance Rewards / B2B Trade Credit (Feb 2026)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from services import fragrance_rewards as fr  # noqa: E402


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    # clean slate per test
    await _db.rewards_ledger.delete_many({"retailer_id": {"$regex": "^FR-TEST-"}})
    await _db.rewards_profile.delete_many({"_id": {"$regex": "^FR-TEST-"}})
    await _db.retailers.delete_many({"retailer_id": {"$regex": "^FR-TEST-"}})
    # seed a retailer
    await _db.retailers.insert_one({
        "retailer_id": "FR-TEST-1",
        "business_name": "FR Test",
        "rewards_enabled": True,
    })
    yield _db
    await _db.rewards_ledger.delete_many({"retailer_id": {"$regex": "^FR-TEST-"}})
    await _db.rewards_profile.delete_many({"_id": {"$regex": "^FR-TEST-"}})
    await _db.retailers.delete_many({"retailer_id": {"$regex": "^FR-TEST-"}})
    client.close()


@pytest.mark.asyncio
async def test_below_threshold_earns_nothing(db):
    """Invoices under ₹1,000 must NOT earn credit."""
    r = await fr.maybe_credit_on_order(
        db, retailer_id="FR-TEST-1", order_id="ORD-1",
        subtotal_inr=800, shipping_inr=120,
    )
    assert r is None
    bal = await fr.get_balance(db, "FR-TEST-1")
    assert bal["balance_inr"] == 0


@pytest.mark.asyncio
async def test_first_qualifying_invoice_100_pct(db):
    r = await fr.maybe_credit_on_order(
        db, retailer_id="FR-TEST-1", order_id="ORD-A",
        subtotal_inr=1200, shipping_inr=150,
    )
    assert r["streak"] == 1
    assert r["multiplier"] == 1.0
    assert r["credited"] == 150
    bal = await fr.get_balance(db, "FR-TEST-1")
    assert bal["balance_inr"] == 150
    assert bal["next_multiplier_pct"] == 110


@pytest.mark.asyncio
async def test_consecutive_streak_progresses_to_125_pct(db):
    await fr.maybe_credit_on_order(db, "FR-TEST-1", "O1", 1200, 100)
    await fr.maybe_credit_on_order(db, "FR-TEST-1", "O2", 1200, 100)
    r3 = await fr.maybe_credit_on_order(db, "FR-TEST-1", "O3", 1200, 100)
    r4 = await fr.maybe_credit_on_order(db, "FR-TEST-1", "O4", 1200, 100)
    assert r3["multiplier"] == 1.25
    assert r4["multiplier"] == 1.25
    bal = await fr.get_balance(db, "FR-TEST-1")
    # 100 + 110 + 125 + 125 = 460
    assert abs(bal["balance_inr"] - 460) < 0.01


@pytest.mark.asyncio
async def test_streak_resets_after_45_days_gap(db):
    await fr.maybe_credit_on_order(db, "FR-TEST-1", "O1", 1200, 100)
    # Rewind profile by 46 days
    long_ago = (datetime.now(timezone.utc) - timedelta(days=46)).isoformat()
    await db.rewards_profile.update_one(
        {"_id": "FR-TEST-1"},
        {"$set": {"last_qualifying_at": long_ago}},
    )
    r2 = await fr.maybe_credit_on_order(db, "FR-TEST-1", "O2", 1200, 200)
    assert r2["streak"] == 1
    assert r2["multiplier"] == 1.0


@pytest.mark.asyncio
async def test_idempotent_credit(db):
    await fr.maybe_credit_on_order(db, "FR-TEST-1", "SAME", 1200, 150)
    dup = await fr.maybe_credit_on_order(db, "FR-TEST-1", "SAME", 1200, 150)
    assert dup is None


@pytest.mark.asyncio
async def test_redeem_blocked_below_thresholds(db):
    # First earn some credit but below ₹2500
    await fr.maybe_credit_on_order(db, "FR-TEST-1", "E1", 1200, 200)
    # Invoice too small
    r = await fr.apply_credit(db, "FR-TEST-1", "REDEEM-1", 2000, 200)
    assert r["applied"] == 0
    assert "at least" in r["error"].lower()
    # Balance too small
    r2 = await fr.apply_credit(db, "FR-TEST-1", "REDEEM-2", 3000, 100)
    assert r2["applied"] == 0
    assert "balance" in r2["error"].lower()


@pytest.mark.asyncio
async def test_redeem_happy_path(db):
    # Stack 3000 in credits
    for i, ship in enumerate([1000, 1500, 500], start=1):
        await fr.maybe_credit_on_order(
            db, "FR-TEST-1", f"E{i}", 1500, ship,
        )
    bal = await fr.get_balance(db, "FR-TEST-1")
    assert bal["balance_inr"] > 2500

    r = await fr.apply_credit(
        db, "FR-TEST-1", "REDEEM-OK",
        invoice_subtotal_inr=3000, requested_amount=2500,
    )
    assert r["applied"] == 2500
    assert r["remaining_balance"] < bal["balance_inr"]
