"""
Tests for the Supabase dual-write mirror.

These tests exercise the pure sync helpers (row mapping, JSON coercion,
datetime parsing) and the dead-letter replay flow WITHOUT hitting Supabase.
We stub the session_factory so the tests are hermetic.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import supabase_sync  # noqa: E402


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def test_extract_id_prefers_business_key():
    assert supabase_sync._extract_id({"id": "abc", "_id": "obj"}) == "abc"
    assert supabase_sync._extract_id({"product_id": "kesar-chandan"}) == "kesar-chandan"
    assert supabase_sync._extract_id({"retailer_id": "R100"}) == "R100"
    assert supabase_sync._extract_id({}) is None


def test_as_datetime_normalises_iso_strings():
    dt = supabase_sync._as_datetime("2026-02-01T10:20:30+00:00")
    assert dt is not None and dt.tzinfo is not None
    # Z-suffix
    dt2 = supabase_sync._as_datetime("2026-02-01T10:20:30Z")
    assert dt2 is not None and dt2.tzinfo is not None
    # naive datetime -> stamped UTC
    naive = datetime(2026, 2, 1, 12, 0, 0)
    stamped = supabase_sync._as_datetime(naive)
    assert stamped.tzinfo is not None
    # garbage returns None (never raises)
    assert supabase_sync._as_datetime("not-a-date") is None
    assert supabase_sync._as_datetime(None) is None


def test_user_row_maps_b2b_retailer_fields():
    doc = {
        "retailer_id": "R123",
        "email": "ops@example.com",
        "phone": "9876543210",
        "business_name": "M.G. Shoppie",
        "gst_number": "27AAACR5055K1Z7",
        "status": "active",
        "is_verified": True,
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "created_at": "2026-01-15T10:00:00+00:00",
        "updated_at": "2026-02-01T10:00:00+00:00",
        "password_hash": "should-not-leak-into-raw",  # still ends up in raw — that's expected for mirror
    }
    # Simulate the standalone-id normalisation the backfill does
    doc["id"] = doc["retailer_id"]
    row = supabase_sync._user_row(doc, kind="b2b")
    assert row["id"] == "R123"
    assert row["kind"] == "b2b"
    assert row["email"] == "ops@example.com"
    assert row["business_name"] == "M.G. Shoppie"
    assert row["gst_number"] == "27AAACR5055K1Z7"
    assert row["city"] == "Mumbai"
    assert isinstance(row["mongo_created_at"], datetime)
    assert row["mongo_created_at"].tzinfo is not None


def test_product_row_maps_prices_and_channel():
    doc = {
        "id": "kesar-chandan",
        "name": "Kesar Chandan",
        "category": "agarbatti",
        "price": 350,
        "mrp": 400,
        "gst_pct": 12,
        "stock_pieces": 240,
        "is_active": True,
        "ready_to_use": False,
        "updated_at": "2026-02-01T10:00:00+00:00",
    }
    row = supabase_sync._product_row(doc, channel="b2c")
    assert row["id"] == "kesar-chandan"
    assert row["channel"] == "b2c"
    assert row["price_inr"] == 350
    assert row["mrp_inr"] == 400
    assert row["stock_pieces"] == 240
    assert row["is_active"] is True
    assert isinstance(row["mongo_updated_at"], datetime)


def test_jsonable_stringifies_datetime():
    now = datetime(2026, 2, 1, tzinfo=timezone.utc)
    out = supabase_sync._jsonable({"a": now, "b": [now, {"c": now}]})
    assert isinstance(out["a"], str)
    assert isinstance(out["b"][0], str)
    assert isinstance(out["b"][1]["c"], str)


# ---------------------------------------------------------------------------
# Public helpers do not raise when the mirror is disabled
# ---------------------------------------------------------------------------

def test_public_helpers_are_noop_when_disabled():
    with patch.object(supabase_sync, "is_enabled", return_value=False):
        # None of these should touch a loop or raise
        supabase_sync.mirror_user_upsert({"id": "u1"}, kind="b2c")
        supabase_sync.mirror_user_delete("u1")
        supabase_sync.mirror_product_upsert({"id": "p1"}, channel="b2c")
        supabase_sync.mirror_product_delete("p1")


def test_public_helpers_swallow_no_running_loop():
    """When called from a sync context (no running loop) they must NOT raise."""
    with patch.object(supabase_sync, "is_enabled", return_value=True), \
         patch.object(supabase_sync, "session_factory", return_value=MagicMock()):
        # No running loop => RuntimeError inside get_running_loop => swallowed
        supabase_sync.mirror_user_upsert({"id": "u1"}, kind="b2c")
        supabase_sync.mirror_product_upsert({"id": "p1"}, channel="b2c")


# ---------------------------------------------------------------------------
# Dead-letter replay flow — with a fake session factory
# ---------------------------------------------------------------------------

class _FakeRow:
    def __init__(self, entity, op, entity_id, payload, attempts=0):
        self.id = 1
        self.entity = entity
        self.op = op
        self.entity_id = entity_id
        self.payload = payload
        self.attempts = attempts
        self.next_retry_at = datetime.now(timezone.utc)
        self.status = "pending"
        self.error = None


class _FakeSession:
    def __init__(self, rows):
        self._rows = rows
        self.added = []
        self.committed = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, stmt):
        # Return an object with .scalars().__iter__() over our rows
        result = MagicMock()
        result.scalars.return_value = iter(self._rows)
        return result

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.committed += 1


@pytest.mark.asyncio
async def test_replay_dead_letter_marks_sent_on_success():
    rows = [_FakeRow("user", "upsert", "u1", {"id": "u1", "kind": "b2c", "email": "x@y.z"})]
    fake_session = _FakeSession(rows)
    fake_factory = MagicMock(return_value=fake_session)

    with patch.object(supabase_sync, "session_factory", return_value=fake_factory), \
         patch.object(supabase_sync, "_upsert_user", new=AsyncMock(return_value=None)):
        result = await supabase_sync.replay_dead_letter(limit=10)

    assert result["checked"] == 1
    assert result["sent"] == 1
    assert result["failed"] == 0
    assert rows[0].status == "sent"


@pytest.mark.asyncio
async def test_replay_dead_letter_reschedules_on_failure():
    rows = [_FakeRow("product", "upsert", "p1", {"id": "p1", "channel": "b2c", "name": "X"}, attempts=0)]
    fake_session = _FakeSession(rows)
    fake_factory = MagicMock(return_value=fake_session)

    async def boom(_session, _row):
        raise RuntimeError("supabase down")

    with patch.object(supabase_sync, "session_factory", return_value=fake_factory), \
         patch.object(supabase_sync, "_upsert_product", new=AsyncMock(side_effect=boom)):
        result = await supabase_sync.replay_dead_letter(limit=10)

    assert result["failed"] == 1
    assert result["sent"] == 0
    assert rows[0].status == "pending"
    assert rows[0].attempts == 1


@pytest.mark.asyncio
async def test_replay_abandons_after_max_attempts():
    rows = [
        _FakeRow(
            "product", "upsert", "p1", {"id": "p1", "channel": "b2c", "name": "X"},
            attempts=supabase_sync._MAX_ATTEMPTS - 1,
        )
    ]
    fake_session = _FakeSession(rows)
    fake_factory = MagicMock(return_value=fake_session)

    async def boom(_session, _row):
        raise RuntimeError("still down")

    with patch.object(supabase_sync, "session_factory", return_value=fake_factory), \
         patch.object(supabase_sync, "_upsert_product", new=AsyncMock(side_effect=boom)):
        result = await supabase_sync.replay_dead_letter(limit=10)

    assert result["abandoned"] == 1
    assert rows[0].status == "abandoned"


@pytest.mark.asyncio
async def test_dead_letter_summary_returns_disabled_when_off():
    with patch.object(supabase_sync, "session_factory", return_value=None):
        out = await supabase_sync.dead_letter_summary()
    assert out == {"enabled": False}


# ---------------------------------------------------------------------------
# Generic collection mirror + sensitive-key stripping
# ---------------------------------------------------------------------------

def test_sanitize_strips_sensitive_keys_recursively():
    doc = {
        "id": "u1",
        "email": "x@y.z",
        "password_hash": "$2b$secret",
        "session_token": "abc",
        "nested": {
            "api_key": "leak",
            "safe_field": "ok",
            "child": {"otp": "999999", "note": "keep"},
        },
        "items": [
            {"reset_token": "gone", "kept": True},
            {"secret": "gone", "plain": 42},
        ],
    }
    cleaned = supabase_sync._sanitize(doc)
    assert "password_hash" not in cleaned
    assert "session_token" not in cleaned
    assert "api_key" not in cleaned["nested"]
    assert cleaned["nested"]["safe_field"] == "ok"
    assert "otp" not in cleaned["nested"]["child"]
    assert cleaned["nested"]["child"]["note"] == "keep"
    assert cleaned["items"][0] == {"kept": True}
    assert cleaned["items"][1] == {"plain": 42}


def test_collection_row_uses_business_id_and_sanitises():
    doc = {
        "id": "order-42",
        "customer_id": "u1",
        "total": 999,
        "password": "leak",
        "created_at": "2026-02-01T10:00:00Z",
    }
    row = supabase_sync._collection_row("orders", doc)
    assert row["collection"] == "orders"
    assert row["doc_id"] == "order-42"
    assert row["raw"]["total"] == 999
    assert "password" not in row["raw"]
    assert isinstance(row["mongo_updated_at"], datetime)


def test_collection_row_falls_back_to_mongo_oid_string():
    doc = {"_id": "abc123", "note": "no business key"}
    row = supabase_sync._collection_row("misc", doc)
    assert row["doc_id"] == "abc123"


def test_collection_row_none_when_no_id():
    assert supabase_sync._collection_row("orders", {"only": "data"}) is None


def test_mirror_collection_upsert_skips_blocklist():
    """Blocklisted + typed collections must NOT enter the generic mirror path."""
    with patch.object(supabase_sync, "is_enabled", return_value=True), \
         patch.object(supabase_sync, "session_factory", return_value=MagicMock()), \
         patch("asyncio.get_running_loop") as gl:
        fake_loop = MagicMock()
        gl.return_value = fake_loop
        # Blocklisted
        supabase_sync.mirror_collection_upsert("user_sessions", {"id": "s1", "token": "x"})
        supabase_sync.mirror_collection_upsert("admin_credentials", {"id": "a1"})
        supabase_sync.mirror_collection_upsert("payment_sessions", {"id": "p1"})
        # Typed (owned by dedicated tables)
        supabase_sync.mirror_collection_upsert("users", {"id": "u1"})
        supabase_sync.mirror_collection_upsert("products", {"id": "p1"})
        # None of these should have scheduled a task
        fake_loop.create_task.assert_not_called()

        # A non-blocklisted collection DOES schedule
        supabase_sync.mirror_collection_upsert("orders", {"id": "o1", "total": 100})
        fake_loop.create_task.assert_called_once()


def test_mirror_collection_delete_skips_blocklist():
    with patch.object(supabase_sync, "is_enabled", return_value=True), \
         patch.object(supabase_sync, "session_factory", return_value=MagicMock()), \
         patch("asyncio.get_running_loop") as gl:
        fake_loop = MagicMock()
        gl.return_value = fake_loop
        supabase_sync.mirror_collection_delete("user_sessions", "s1")
        supabase_sync.mirror_collection_delete("users", "u1")
        fake_loop.create_task.assert_not_called()
        supabase_sync.mirror_collection_delete("orders", "o1")
        fake_loop.create_task.assert_called_once()
