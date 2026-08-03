"""Regression tests for category-based carton math + stock status + pincode lookup."""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import b2b_inventory as inv  # noqa: E402
from services.b2b_catalog import (  # noqa: E402
    pack_size_for,
    unit_label_for,
    _enrich_carton_fields,
    _stock_status_message,
    CATEGORY_PACK_SIZE,
)
from services.pincode_lookup import state_from_pincode  # noqa: E402


# ─────────────────────────────────────────────────────────────
# Category → pack size math
# ─────────────────────────────────────────────────────────────

def test_dhoop_and_bakhoor_are_32_per_carton():
    assert CATEGORY_PACK_SIZE["dhoop"] == 32
    assert CATEGORY_PACK_SIZE["bakhoor"] == 32


def test_agarbatti_jar_is_16_per_carton():
    assert CATEGORY_PACK_SIZE["agarbatti_jar"] == 16


def test_agarbatti_is_12_per_packet_dozen():
    assert CATEGORY_PACK_SIZE["agarbatti"] == 12


def test_pack_size_agarbatti_100g_returns_12():
    prod = {"category": "agarbatti", "net_weight": "100g"}
    assert pack_size_for(prod) == 12


def test_pack_size_agarbatti_jar_200g_returns_16():
    prod = {"category": "agarbatti_jar", "net_weight": "200g"}
    assert pack_size_for(prod) == 16


def test_pack_size_bakhoor_returns_32():
    prod = {"category": "bakhoor"}
    assert pack_size_for(prod) == 32


def test_pack_size_explicit_pieces_per_carton_wins():
    prod = {"category": "bakhoor", "pieces_per_carton": 24}
    assert pack_size_for(prod) == 24


def test_unit_label_agarbatti_is_packet():
    assert unit_label_for({"category": "agarbatti"}) == "packet"
    assert unit_label_for({"category": "bakhoor"}) == "carton"
    assert unit_label_for({"category": "agarbatti_jar"}) == "carton"


def test_pieces_for_quantity_uses_category_pack_size():
    agar = {"category": "agarbatti"}
    jar = {"category": "agarbatti_jar"}
    bakh = {"category": "bakhoor"}
    assert inv.pieces_for_quantity(agar, 1.0) == 12
    assert inv.pieces_for_quantity(agar, 0.5) == 6
    assert inv.pieces_for_quantity(jar, 1.0) == 16
    assert inv.pieces_for_quantity(jar, 0.5) == 8
    assert inv.pieces_for_quantity(bakh, 1.0) == 32
    assert inv.pieces_for_quantity(bakh, 0.5) == 16


# ─────────────────────────────────────────────────────────────
# Stock status display
# ─────────────────────────────────────────────────────────────

def test_stock_status_message_in_stock():
    msg = _stock_status_message("in_stock", 15, "", 200, 32)
    assert msg["is_orderable"] is True
    assert msg["tone"] == "emerald"


def test_stock_status_message_low_stock_amber():
    msg = _stock_status_message("in_stock", 15, "", 5, 32)  # < carton
    assert msg["is_orderable"] is True
    assert msg["tone"] == "amber"
    assert "5 pieces" in msg["subtext"]


def test_stock_status_message_out_of_stock_shows_eta():
    msg = _stock_status_message("out_of_stock", 15, "", 0, 32)
    assert msg["is_orderable"] is False
    assert msg["tone"] == "rose"
    assert "15 days" in msg["subtext"]
    assert "Restocking" in msg["label"] or "Out of Stock" in msg["label"]


def test_stock_status_message_manufacturing():
    msg = _stock_status_message("manufacturing", 7, "New batch in press", 0, 32)
    assert msg["is_orderable"] is False
    assert "Manufacturing" in msg["subtext"]
    assert "7 days" in msg["subtext"]
    assert "New batch in press" in msg["subtext"]


def test_stock_status_message_delayed():
    msg = _stock_status_message("delayed", 21, "Courier strike", 0, 16)
    assert msg["is_orderable"] is False
    assert "Delay" in msg["subtext"]
    assert "21 days" in msg["subtext"]


def test_enrich_fields_out_of_stock_uses_category_eta_default():
    p = _enrich_carton_fields({"category": "bakhoor", "mrp_per_unit": 110, "stock_pieces": 0})
    assert p["stock_status_display"]["is_orderable"] is False
    assert p["pieces_per_carton"] == 32


# ─────────────────────────────────────────────────────────────
# Pincode lookup (offline state fallback)
# ─────────────────────────────────────────────────────────────

def test_state_from_pincode_delhi():
    assert state_from_pincode("110089") == "Delhi"


def test_state_from_pincode_maharashtra():
    assert state_from_pincode("400001") == "Maharashtra"


def test_state_from_pincode_bihar():
    assert state_from_pincode("800001") == "Bihar"


def test_state_from_pincode_karnataka():
    assert state_from_pincode("560001") == "Karnataka"


def test_state_from_pincode_invalid_returns_none():
    assert state_from_pincode("abcxyz") is None
    assert state_from_pincode(None) is None
    assert state_from_pincode("") is None


# ─────────────────────────────────────────────────────────────
# Low-stock scan
# ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    prefix = "LS-TEST-"
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{prefix}"}})
    await _db.b2b_products.insert_many([
        {"id": f"{prefix}A", "name": "A", "category": "bakhoor",
         "mrp_per_unit": 110, "stock_pieces": 200, "is_active": True},
        {"id": f"{prefix}B", "name": "B", "category": "agarbatti",
         "mrp_per_unit": 110, "stock_pieces": 6, "is_active": True},  # < 12
        {"id": f"{prefix}C", "name": "C", "category": "agarbatti_jar",
         "mrp_per_unit": 400, "stock_pieces": 0, "is_active": True},
        {"id": f"{prefix}D", "name": "D-inactive", "category": "bakhoor",
         "mrp_per_unit": 110, "stock_pieces": 0, "is_active": False},  # should be skipped
    ])
    yield _db
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{prefix}"}})
    client.close()


@pytest.mark.asyncio
async def test_find_low_stock_returns_only_below_one_carton(db):
    low = await inv.find_low_stock(db)
    ids = {r["id"] for r in low}
    assert "LS-TEST-B" in ids  # 6 < 12
    assert "LS-TEST-C" in ids  # 0 < 16
    assert "LS-TEST-A" not in ids  # 200 > 32
    assert "LS-TEST-D" not in ids  # inactive


@pytest.mark.asyncio
async def test_set_stock_status_persists_and_audits(db):
    await inv.set_stock_status(
        db, product_id="LS-TEST-C", status="manufacturing",
        eta_days=10, note="Big batch scheduled", admin_email="admin@x",
    )
    p = await db.b2b_products.find_one({"id": "LS-TEST-C"})
    assert p["stock_status"] == "manufacturing"
    assert p["restock_eta_days"] == 10
    assert p["restock_note"] == "Big batch scheduled"
    log = await db.b2b_inventory_log.find_one({
        "product_id": "LS-TEST-C", "reason": "status_change",
    })
    assert log is not None


@pytest.mark.asyncio
async def test_set_stock_status_rejects_bad_value(db):
    with pytest.raises(ValueError):
        await inv.set_stock_status(db, product_id="LS-TEST-C", status="bogus")
