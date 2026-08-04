"""Broadcast Analytics — open + click tracking (Feb 2026)."""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import b2b_nudge_analytics as ana  # noqa: E402


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    bid = "NUD-ANAL-TEST-1"
    await _db.custom_nudges_log.delete_many({"broadcast_id": bid})
    await _db.nudges_open_log.delete_many({"broadcast_id": bid})
    await _db.nudges_click_log.delete_many({"broadcast_id": bid})
    await _db.custom_nudges_log.insert_one({
        "broadcast_id": bid,
        "audience_size": 100, "email_sent": 100,
        "opens": 0, "unique_opens": 0, "clicks": 0, "unique_clicks": 0,
        "sent_at": "2026-02-01T00:00:00+00:00",
        "subject": "Test", "kind": "drop", "audience": "all",
    })
    yield _db, bid
    await _db.custom_nudges_log.delete_many({"broadcast_id": bid})
    await _db.nudges_open_log.delete_many({"broadcast_id": bid})
    await _db.nudges_click_log.delete_many({"broadcast_id": bid})
    client.close()


# ─────────────────────────────────────────────────────────────
# HTML rewriting
# ─────────────────────────────────────────────────────────────

def test_pixel_bytes_is_a_valid_gif():
    data = ana.pixel_bytes()
    # GIF89a magic
    assert data[:6] == b"GIF89a"


def test_append_open_pixel_uses_broadcast_and_retailer_ids():
    html = "<html><body><p>Hi</p></body></html>"
    out = ana.append_open_pixel(
        html, api_base="https://x.co", broadcast_id="B1", retailer_id="R9",
    )
    assert "/api/nudges/track/open/B1/R9.gif" in out
    assert out.endswith("</body></html>")   # pixel injected before </body>


def test_append_pixel_when_no_body_tag():
    html = "<p>No body wrapper</p>"
    out = ana.append_open_pixel(
        html, api_base="https://x.co", broadcast_id="B1", retailer_id="R9",
    )
    assert "/api/nudges/track/open/B1/R9.gif" in out


def test_rewrite_links_rewrites_http_links():
    html = '<a href="https://centraders.com/products">Shop</a>'
    out = ana.rewrite_links_for_tracking(
        html, api_base="https://x.co", broadcast_id="B1", retailer_id="R9",
    )
    assert "https://x.co/api/nudges/track/click/B1/R9" in out
    assert "url=https%3A%2F%2Fcentraders.com%2Fproducts" in out


def test_rewrite_links_leaves_non_http_links_alone():
    html = '<a href="mailto:x@y.z">Email</a><a href="#section">Anchor</a>'
    out = ana.rewrite_links_for_tracking(
        html, api_base="https://x.co", broadcast_id="B1", retailer_id="R9",
    )
    assert 'mailto:x@y.z' in out
    assert '#section' in out
    assert "track/click" not in out


# ─────────────────────────────────────────────────────────────
# Persistence — record_open / record_click
# ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_first_open_increments_unique_and_total(db):
    _db, bid = db
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R1")
    row = await _db.custom_nudges_log.find_one({"broadcast_id": bid})
    assert row["opens"] == 1
    assert row["unique_opens"] == 1


@pytest.mark.asyncio
async def test_repeat_open_bumps_total_only(db):
    _db, bid = db
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R1")
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R1")
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R1")
    row = await _db.custom_nudges_log.find_one({"broadcast_id": bid})
    assert row["opens"] == 3
    assert row["unique_opens"] == 1


@pytest.mark.asyncio
async def test_multiple_retailers_open(db):
    _db, bid = db
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R1")
    await ana.record_open(_db, broadcast_id=bid, retailer_id="R2")
    row = await _db.custom_nudges_log.find_one({"broadcast_id": bid})
    assert row["unique_opens"] == 2


@pytest.mark.asyncio
async def test_click_recording_and_dedupe(db):
    _db, bid = db
    await ana.record_click(_db, broadcast_id=bid, retailer_id="R1",
                           url="https://centraders.com/p")
    await ana.record_click(_db, broadcast_id=bid, retailer_id="R1",
                           url="https://centraders.com/p")  # dup
    await ana.record_click(_db, broadcast_id=bid, retailer_id="R2",
                           url="https://centraders.com/p")
    row = await _db.custom_nudges_log.find_one({"broadcast_id": bid})
    assert row["clicks"] == 3
    assert row["unique_clicks"] == 2


@pytest.mark.asyncio
async def test_summarise_broadcast_computes_rates(db):
    _db, bid = db
    for rid in ("R1", "R2", "R3", "R4", "R5"):
        await ana.record_open(_db, broadcast_id=bid, retailer_id=rid)
    for rid in ("R1", "R2"):
        await ana.record_click(
            _db, broadcast_id=bid, retailer_id=rid,
            url="https://centraders.com/products",
        )
    summary = await ana.summarise_broadcast(_db, bid)
    assert summary["unique_opens"] == 5
    assert summary["unique_clicks"] == 2
    # 5 opens / 100 sent = 5.0%
    assert summary["open_rate_pct"] == 5.0
    # 2 clicks / 100 sent = 2.0%
    assert summary["click_rate_pct"] == 2.0
    # CTR = 2 clicks / 5 opens = 40.0%
    assert summary["ctr_pct"] == 40.0


@pytest.mark.asyncio
async def test_summarise_unknown_broadcast_returns_empty(db):
    _db, _ = db
    summary = await ana.summarise_broadcast(_db, "NOPE")
    assert summary == {}
