"""Redeem-at-checkout + restock-nudge unit tests (Feb 2026)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import fragrance_rewards as fr  # noqa: E402
from services import b2b_restock_nudge as nudge  # noqa: E402


# ─────────────────────────────────────────────────────────────
# Fixture: isolated retailer + ledger rows
# ─────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    rid = "REDEEM-TEST-1"
    await _db.rewards_ledger.delete_many({"retailer_id": rid})
    await _db.rewards_profile.delete_many({"_id": rid})
    await _db.retailers.delete_many({"retailer_id": rid})
    await _db.retailers.insert_one({
        "retailer_id": rid, "email": "r@test", "business_name": "Redeem Store",
        "rewards_enabled": True,
    })
    # Seed 3 credit entries totalling ₹3,000 (well over ₹2,500 threshold)
    now = datetime.now(timezone.utc)
    await _db.rewards_ledger.insert_many([
        {"id": "E1", "retailer_id": rid, "kind": "earn", "amount": 1200.0,
         "status": "active", "earned_at": now.isoformat(),
         "expires_at": (now + timedelta(days=90)).isoformat()},
        {"id": "E2", "retailer_id": rid, "kind": "earn", "amount": 1000.0,
         "status": "active", "earned_at": now.isoformat(),
         "expires_at": (now + timedelta(days=60)).isoformat()},
        {"id": "E3", "retailer_id": rid, "kind": "earn", "amount": 800.0,
         "status": "active", "earned_at": now.isoformat(),
         "expires_at": (now + timedelta(days=30)).isoformat()},
    ])
    yield _db, rid
    await _db.rewards_ledger.delete_many({"retailer_id": rid})
    await _db.rewards_profile.delete_many({"_id": rid})
    await _db.retailers.delete_many({"retailer_id": rid})
    client.close()


# ─────────────────────────────────────────────────────────────
# preview_credit (dry-run)
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_preview_credit_returns_applicable_amount(db):
    _db, rid = db
    result = await fr.preview_credit(_db, rid, 4000.0, 2000.0)
    assert result["eligible"] is True
    assert result["applicable"] == 2000.0
    assert result["balance_inr"] == 3000.0
    assert result["remaining_balance_after"] == 1000.0


@pytest.mark.asyncio
async def test_preview_credit_caps_at_balance(db):
    _db, rid = db
    result = await fr.preview_credit(_db, rid, 5000.0, 9999.0)
    assert result["eligible"] is True
    assert result["applicable"] == 3000.0  # capped at balance


@pytest.mark.asyncio
async def test_preview_credit_caps_at_invoice_subtotal(db):
    _db, rid = db
    result = await fr.preview_credit(_db, rid, 2700.0, 3000.0)
    assert result["applicable"] == 2700.0  # capped at subtotal


@pytest.mark.asyncio
async def test_preview_credit_blocks_below_threshold_invoice(db):
    _db, rid = db
    result = await fr.preview_credit(_db, rid, 2000.0, 1500.0)
    assert result["eligible"] is False
    assert "₹2500" in result["reason"] or "2500" in result["reason"]


@pytest.mark.asyncio
async def test_preview_credit_blocks_below_threshold_balance(db):
    _db, rid = db
    # Drain to just under threshold
    await _db.rewards_ledger.update_one({"id": "E1"}, {"$set": {"amount": 500.0}})
    await _db.rewards_ledger.update_one({"id": "E2"}, {"$set": {"amount": 400.0}})
    await _db.rewards_ledger.update_one({"id": "E3"}, {"$set": {"amount": 200.0}})
    result = await fr.preview_credit(_db, rid, 5000.0, 1000.0)
    assert result["eligible"] is False


@pytest.mark.asyncio
async def test_preview_is_read_only_leaves_ledger_untouched(db):
    _db, rid = db
    await fr.preview_credit(_db, rid, 5000.0, 2500.0)
    balance = await fr.get_balance(_db, rid)
    assert balance["balance_inr"] == 3000.0  # unchanged


# ─────────────────────────────────────────────────────────────
# apply_credit (actual FIFO burn)
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_apply_credit_fifo_burn(db):
    _db, rid = db
    result = await fr.apply_credit(_db, rid, "B2B-ORD-1", 5000.0, 2200.0)
    assert result["applied"] == 2200.0
    assert result["remaining_balance"] == 800.0
    # Oldest-expiry-first (E3 → 30d → drained), E2 partially drained
    e3 = await _db.rewards_ledger.find_one({"id": "E3"})
    assert e3["status"] == "consumed"
    e2 = await _db.rewards_ledger.find_one({"id": "E2"})
    assert e2["amount"] < 1000.0
    # Redeem ledger row created
    r = await _db.rewards_ledger.find_one({"kind": "redeem", "source_order_id": "B2B-ORD-1"})
    assert r is not None
    assert r["amount"] == -2200.0


@pytest.mark.asyncio
async def test_apply_credit_rejects_below_threshold(db):
    _db, rid = db
    result = await fr.apply_credit(_db, rid, "B2B-ORD-BAD", 1500.0, 500.0)
    assert result["applied"] == 0
    assert "2500" in result["error"]


# ─────────────────────────────────────────────────────────────
# Restock nudge — SKU selection + cooldown
# ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def nudge_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    pref = "NUDGE-TEST-"
    now = datetime.now(timezone.utc)
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{pref}"}})
    await _db.b2b_orders.delete_many({"order_id": {"$regex": f"^{pref}"}})
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.restock_nudges.delete_many({"product_id": {"$regex": f"^{pref}"}})

    # SKU 1 — due (ETA 15d, updated 14d ago → 1 day remaining)
    await _db.b2b_products.insert_many([
        {
            "id": f"{pref}A", "name": "Nudge A", "category": "bakhoor",
            "is_active": True, "stock_status": "restocking",
            "restock_eta_days": 15,
            "stock_status_updated_at": (now - timedelta(days=14)).isoformat(),
        },
        # SKU 2 — NOT due (updated today, 15 days remaining)
        {
            "id": f"{pref}B", "name": "Nudge B", "category": "agarbatti",
            "is_active": True, "stock_status": "manufacturing",
            "restock_eta_days": 15,
            "stock_status_updated_at": now.isoformat(),
        },
        # SKU 3 — NOT due (in_stock)
        {
            "id": f"{pref}C", "name": "Nudge C", "category": "agarbatti",
            "is_active": True, "stock_status": "in_stock",
        },
    ])

    # Retailer + order for SKU 1
    await _db.retailers.insert_one({
        "retailer_id": f"{pref}R1", "email": "buyer@test", "phone": "9999900000",
        "whatsapp_country_code": "+91", "business_name": "Buyer Shop",
        "spoc": {"name": "Ravi Kumar"},
    })
    await _db.b2b_orders.insert_one({
        "order_id": f"{pref}O1", "retailer_id": f"{pref}R1",
        "payment_status": "paid",
        "created_at": (now - timedelta(days=30)).isoformat(),
        "items": [{"product_id": f"{pref}A", "quantity_boxes": 1}],
    })
    yield _db, pref
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{pref}"}})
    await _db.b2b_orders.delete_many({"order_id": {"$regex": f"^{pref}"}})
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.restock_nudges.delete_many({"product_id": {"$regex": f"^{pref}"}})
    client.close()


@pytest.mark.asyncio
async def test_due_skus_selects_only_within_window(nudge_db):
    _db, pref = nudge_db
    due = await nudge._due_skus(_db)
    ids = {d["id"] for d in due}
    assert f"{pref}A" in ids     # 1 day remaining → in window
    assert f"{pref}B" not in ids  # 15 days remaining
    assert f"{pref}C" not in ids  # in stock


@pytest.mark.asyncio
async def test_past_buyers_returns_recent_buyers(nudge_db):
    _db, pref = nudge_db
    buyers = await nudge._past_buyers(_db, f"{pref}A")
    ids = {b["retailer_id"] for b in buyers}
    assert f"{pref}R1" in ids


@pytest.mark.asyncio
async def test_cooldown_prevents_duplicate_nudges(nudge_db):
    _db, pref = nudge_db
    await _db.restock_nudges.insert_one({
        "product_id": f"{pref}A", "retailer_id": f"{pref}R1",
        "channel": "email",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })
    dup = await nudge._already_nudged_recently(_db, f"{pref}A", f"{pref}R1")
    assert dup is True


def test_e164_normalises_correctly():
    assert nudge._e164("9999900000", "+91") == "+919999900000"
    assert nudge._e164("+919999900000", None) == "+919999900000"
    assert nudge._e164("999 999 0000", "91") == "+919999990000"
    assert nudge._e164(None, "+91") is None


@pytest.mark.asyncio
async def test_run_restock_nudges_records_nudge(nudge_db):
    _db, pref = nudge_db
    # Mock email send to always succeed
    with patch(
        "services.email_service.send_email", new=AsyncMock(return_value=True)
    ), patch(
        "services.email_service.is_email_service_available", return_value=True,
    ):
        stats = await nudge.run_restock_nudges(_db)
    assert stats["skus_scanned"] == 1
    assert stats["retailers_reached"] >= 1
    logged = await _db.restock_nudges.find_one({
        "product_id": f"{pref}A", "retailer_id": f"{pref}R1", "channel": "email",
    })
    assert logged is not None
