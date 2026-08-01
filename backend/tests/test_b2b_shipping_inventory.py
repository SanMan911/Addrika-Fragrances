"""Regression tests for B2B Inventory + Carton Math + Shipping Quote (Feb 2026)."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import b2b_inventory as inv  # noqa: E402
from services import b2b_shipping as ship  # noqa: E402
from services.b2b_catalog import (  # noqa: E402
    calculate_carton_price,
    calculate_half_carton_price,
    DEFAULT_PIECES_PER_CARTON,
    _enrich_carton_fields,
)


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    prefix = "INV-TEST-"
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{prefix}"}})
    await _db.b2b_inventory_log.delete_many({"product_id": {"$regex": f"^{prefix}"}})
    await _db.b2b_products.insert_one({
        "id": f"{prefix}KESAR",
        "product_id": "test-kesar",
        "name": "Test Kesar",
        "net_weight": "50g",
        "units_per_box": 12,
        "pieces_per_carton": 32,
        "mrp_per_unit": 110,
        "price_per_box": 1010,
        "price_per_half_box": 505,
        "gst_rate": 5,
        "hsn_code": "33074100",
        "is_active": True,
        "stock_pieces": 100,
    })
    yield _db
    await _db.b2b_products.delete_many({"id": {"$regex": f"^{prefix}"}})
    await _db.b2b_inventory_log.delete_many({"product_id": {"$regex": f"^{prefix}"}})
    client.close()


# ─────────────────────────────────────────────────────────────
# Carton math
# ─────────────────────────────────────────────────────────────

def test_default_carton_size_is_32():
    assert DEFAULT_PIECES_PER_CARTON == 32


def test_carton_price_at_7652_pct():
    # 32 pcs × ₹110 × 0.7652 = ₹2694 (rounded)
    assert calculate_carton_price(32, 110) == 2694


def test_half_carton_is_exactly_half():
    full = calculate_carton_price(32, 110)
    half = calculate_half_carton_price(32, 110)
    # half is 16 × 110 × 0.7652 = 1346.7 → 1347. Full/2 = 1346.5 → sanity: |diff| ≤ 1
    assert abs(full / 2 - half) <= 1


def test_enrich_carton_fields_backfills_missing():
    p = {"id": "x", "mrp_per_unit": 110}
    out = _enrich_carton_fields(dict(p))
    assert out["pieces_per_carton"] == DEFAULT_PIECES_PER_CARTON
    assert out["price_per_carton"] > 0
    assert out["price_per_half_carton"] > 0
    assert out["price_per_piece"] == round(110 * 0.7652, 2)
    assert out["stock_pieces"] == 0


def test_pieces_for_quantity_prefers_pieces_per_carton():
    prod = {"pieces_per_carton": 32, "units_per_box": 12}
    assert inv.pieces_for_quantity(prod, 1.0) == 32
    assert inv.pieces_for_quantity(prod, 0.5) == 16
    assert inv.pieces_for_quantity(prod, 2.5) == 80


def test_pieces_for_quantity_falls_back_to_units_per_box():
    prod = {"units_per_box": 12}
    assert inv.pieces_for_quantity(prod, 1.0) == 12
    assert inv.pieces_for_quantity(prod, 0.5) == 6


# ─────────────────────────────────────────────────────────────
# Inventory adjust + audit
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_adjust_stock_positive_delta(db):
    res = await inv.adjust_stock(
        db, product_id="INV-TEST-KESAR", delta_pieces=50,
        reason="restock", admin_email="admin@test",
    )
    assert res["before"] == 100
    assert res["after"] == 150
    log = await db.b2b_inventory_log.find_one({"product_id": "INV-TEST-KESAR"})
    assert log["delta_pieces"] == 50
    assert log["reason"] == "restock"


@pytest.mark.asyncio
async def test_adjust_stock_negative_delta_clamps_at_zero(db):
    res = await inv.adjust_stock(
        db, product_id="INV-TEST-KESAR", delta_pieces=-500,
        reason="damage",
    )
    assert res["after"] == 0  # clamped, not -400


@pytest.mark.asyncio
async def test_get_stock_reads_current_value(db):
    await inv.adjust_stock(db, product_id="INV-TEST-KESAR", delta_pieces=-40, reason="offline_sale")
    assert await inv.get_stock(db, "INV-TEST-KESAR") == 60


@pytest.mark.asyncio
async def test_adjust_stock_unknown_product_raises(db):
    with pytest.raises(ValueError):
        await inv.adjust_stock(db, product_id="INV-TEST-NOPE", delta_pieces=1, reason="restock")


@pytest.mark.asyncio
async def test_deduct_for_paid_order_uses_carton_size(db):
    order = {
        "order_id": "B2B-TEST-1",
        "items": [{"product_id": "INV-TEST-KESAR", "quantity_boxes": 1.0}],
    }
    results = await inv.deduct_for_paid_order(db, order)
    assert len(results) == 1
    # 1 carton × 32 pieces = -32 → 100 → 68
    assert results[0]["after"] == 68


@pytest.mark.asyncio
async def test_deduct_for_paid_order_is_idempotent(db):
    order = {
        "order_id": "B2B-TEST-2",
        "items": [{"product_id": "INV-TEST-KESAR", "quantity_boxes": 0.5}],
    }
    first = await inv.deduct_for_paid_order(db, order)
    second = await inv.deduct_for_paid_order(db, order)
    assert len(first) == 1
    assert len(second) == 0  # already deducted
    assert await inv.get_stock(db, "INV-TEST-KESAR") == 84  # 100 - 16


@pytest.mark.asyncio
async def test_get_log_filters_by_product(db):
    await inv.adjust_stock(db, product_id="INV-TEST-KESAR", delta_pieces=5, reason="restock")
    await inv.adjust_stock(db, product_id="INV-TEST-KESAR", delta_pieces=-3, reason="offline_sale")
    log = await inv.get_log(db, "INV-TEST-KESAR")
    assert len(log) == 2
    # Most-recent first
    assert log[0]["reason"] == "offline_sale"


# ─────────────────────────────────────────────────────────────
# Shipping quote
# ─────────────────────────────────────────────────────────────

def test_parse_weight_gm_gram_variants():
    assert ship._parse_weight_gm("50g") == 50
    assert ship._parse_weight_gm("200g") == 200
    assert ship._parse_weight_gm("1kg") == 1000
    assert ship._parse_weight_gm("bad") == 50  # graceful


def test_fallback_rate_scales_with_weight():
    r1 = ship._fallback_rate(0.5)
    r2 = ship._fallback_rate(5.0)
    assert r2 > r1


def test_compute_cart_weight_empty():
    # Empty cart → min billable weight (0.5 kg)
    assert ship.compute_cart_weight_kg([]) == 0.5


@pytest.mark.asyncio
async def test_shipping_quote_invalid_pincode_uses_fallback():
    quote = await ship.get_b2b_shipping_quote("invalid", [])
    assert quote["success"] is False
    assert quote["fallback"] is True
    assert quote["shipping_charges"] > 0


@pytest.mark.asyncio
async def test_shipping_quote_falls_back_on_shiprocket_error():
    # Force shiprocket to fail
    with patch(
        "services.shiprocket_service.get_domestic_shipping_rates",
        new=AsyncMock(return_value={"success": False, "error": "boom"}),
    ):
        quote = await ship.get_b2b_shipping_quote("400001", [])
        assert quote["fallback"] is True
        assert quote["shipping_charges"] > 0
        assert "shiprocket" in quote["reason"].lower() or "boom" in quote["reason"].lower()


@pytest.mark.asyncio
async def test_shipping_quote_happy_path_uses_shiprocket_rate():
    with patch(
        "services.shiprocket_service.get_domestic_shipping_rates",
        new=AsyncMock(return_value={
            "success": True,
            "couriers": [{"rate": 87.5, "courier_name": "Delhivery", "etd": "3-5 days",
                          "estimated_delivery_days": 4}],
        }),
    ):
        quote = await ship.get_b2b_shipping_quote("400001", [])
        assert quote["success"] is True
        assert quote["fallback"] is False
        assert quote["shipping_charges"] == 87.5
        assert quote["courier_name"] == "Delhivery"
