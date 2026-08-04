"""Nudge Composer audience resolution + broadcast tests (Feb 2026)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services.b2b_nudge_composer import (  # noqa: E402
    _resolve_audience,
    _e164,
    broadcast_custom_nudge,
)


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    pref = "NUD-COMP-"
    now = datetime.now(timezone.utc)
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.b2b_orders.delete_many({"order_id": {"$regex": f"^{pref}"}})
    await _db.custom_nudges_log.delete_many({"broadcast_id": {"$regex": "^NUD-"}})

    await _db.retailers.insert_many([
        {
            "retailer_id": f"{pref}R1", "email": "r1@x", "phone": "9111100001",
            "whatsapp_country_code": "+91", "is_verified": True,
            "business_name": "Store One", "pincode": "400001",
        },
        {
            "retailer_id": f"{pref}R2", "email": "r2@x", "phone": "9111100002",
            "is_verified": False, "business_name": "Store Two", "pincode": "560001",
        },
        {
            "retailer_id": f"{pref}R3", "email": "r3@x", "phone": "9111100003",
            "is_verified": True, "business_name": "Store Three", "pincode": "400002",
        },
    ])
    await _db.b2b_orders.insert_one({
        "order_id": f"{pref}O1", "retailer_id": f"{pref}R2",
        "payment_status": "paid",
        "created_at": (now - timedelta(days=10)).isoformat(),
        "items": [{"product_id": "SKU-A", "quantity_boxes": 1}],
    })
    yield _db, pref
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.b2b_orders.delete_many({"order_id": {"$regex": f"^{pref}"}})
    await _db.custom_nudges_log.delete_many({"broadcast_id": {"$regex": "^NUD-"}})
    client.close()


# ─────────────────────────────────────────────────────────────
# Audience resolution
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audience_all_returns_every_retailer(db):
    _db, pref = db
    out = await _resolve_audience(_db, audience="all", product_id=None, pincode_prefix=None, retailer_ids=None)
    ids = {r["retailer_id"] for r in out if r["retailer_id"].startswith(pref)}
    assert ids == {f"{pref}R1", f"{pref}R2", f"{pref}R3"}


@pytest.mark.asyncio
async def test_audience_verified_filters(db):
    _db, pref = db
    out = await _resolve_audience(_db, audience="verified", product_id=None, pincode_prefix=None, retailer_ids=None)
    ids = {r["retailer_id"] for r in out if r["retailer_id"].startswith(pref)}
    assert ids == {f"{pref}R1", f"{pref}R3"}


@pytest.mark.asyncio
async def test_audience_pincode_prefix_filters(db):
    _db, pref = db
    out = await _resolve_audience(_db, audience="pincode", product_id=None, pincode_prefix="400", retailer_ids=None)
    ids = {r["retailer_id"] for r in out if r["retailer_id"].startswith(pref)}
    assert ids == {f"{pref}R1", f"{pref}R3"}


@pytest.mark.asyncio
async def test_audience_product_returns_only_past_buyers(db):
    _db, pref = db
    out = await _resolve_audience(_db, audience="product", product_id="SKU-A", pincode_prefix=None, retailer_ids=None)
    ids = {r["retailer_id"] for r in out if r["retailer_id"].startswith(pref)}
    assert ids == {f"{pref}R2"}


@pytest.mark.asyncio
async def test_audience_explicit_retailer_ids(db):
    _db, pref = db
    out = await _resolve_audience(
        _db, audience="retailer_ids", product_id=None, pincode_prefix=None,
        retailer_ids=[f"{pref}R1", f"{pref}R3"],
    )
    ids = {r["retailer_id"] for r in out}
    assert ids == {f"{pref}R1", f"{pref}R3"}


# ─────────────────────────────────────────────────────────────
# Full broadcast — logs to custom_nudges_log with counters
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_broadcast_records_log_and_counters(db):
    _db, pref = db
    with patch(
        "services.email_service.send_email", new=AsyncMock(return_value=True),
    ), patch(
        "services.email_service.is_email_service_available", return_value=True,
    ):
        result = await broadcast_custom_nudge(
            _db,
            subject="New drop",
            body_html="<p>Fresh drop live now.</p>",
            whatsapp_body=None,
            channels=["email"],
            audience="retailer_ids",
            product_id=None, pincode_prefix=None,
            retailer_ids=[f"{pref}R1", f"{pref}R3"],
            kind="drop", admin_email="admin@x",
        )

    assert result["audience"] == "retailer_ids"
    # 2 explicit retailers → 2 emails sent
    assert result["email_sent"] == 2
    assert result["audience_size"] == 2
    assert result["whatsapp_sent"] == 0
    assert result["broadcast_id"].startswith("NUD-")
    log = await _db.custom_nudges_log.find_one({"broadcast_id": result["broadcast_id"]})
    assert log is not None
    assert log["audience_size"] == 2
    assert log["kind"] == "drop"


@pytest.mark.asyncio
async def test_broadcast_handles_empty_audience(db):
    _db, pref = db
    with patch(
        "services.email_service.send_email", new=AsyncMock(return_value=True),
    ), patch(
        "services.email_service.is_email_service_available", return_value=True,
    ):
        result = await broadcast_custom_nudge(
            _db,
            subject="Nobody home", body_html="<p>Test</p>",
            whatsapp_body=None,
            channels=["email"], audience="pincode",
            product_id=None, pincode_prefix="999999", retailer_ids=None,
            kind="promo", admin_email="admin@x",
        )
    assert result["audience_size"] == 0
    assert result["email_sent"] == 0


# ─────────────────────────────────────────────────────────────
# Phone normalisation
# ─────────────────────────────────────────────────────────────

def test_e164_various_inputs():
    assert _e164("9111100001", "+91") == "+919111100001"
    assert _e164("+919111100001", None) == "+919111100001"
    assert _e164("91 111 000 01", "91") == "+919111100001"
    assert _e164(None, "+91") is None
