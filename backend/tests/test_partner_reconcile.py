"""Regression tests for the nightly partner-coupon reconciliation cron."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from services import partner_coupons, partner_reconcile  # noqa: E402


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    # Clean slate per test
    await _db.partner_sync_log.delete_many({"code": {"$regex": "^RECON-TEST-"}})
    yield _db
    await _db.partner_sync_log.delete_many({"code": {"$regex": "^RECON-TEST-"}})
    client.close()


# ---------------------------------------------------------------------------
# record_outbound_attempt
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_record_success_marks_sent(db):
    await partner_reconcile.record_outbound_attempt(
        db, op="issue", code="RECON-TEST-OK1",
        payload={"code": "RECON-TEST-OK1"}, success=True, http_status=200,
    )
    row = await db.partner_sync_log.find_one({"code": "RECON-TEST-OK1"})
    assert row["status"] == "sent"
    assert row["last_error"] is None
    assert row["http_status"] == 200
    assert row["attempts"] == 0


@pytest.mark.asyncio
async def test_record_failure_schedules_exponential_backoff(db):
    # 1st failure → 5min backoff
    await partner_reconcile.record_outbound_attempt(
        db, op="issue", code="RECON-TEST-F1",
        payload={"code": "RECON-TEST-F1"}, success=False,
        error="boom", http_status=500,
    )
    row1 = await db.partner_sync_log.find_one({"code": "RECON-TEST-F1"})
    assert row1["status"] == "failed"
    assert row1["attempts"] == 1
    assert row1["last_error"] == "boom"
    # 2nd failure → 30min backoff
    await partner_reconcile.record_outbound_attempt(
        db, op="issue", code="RECON-TEST-F1",
        payload={"code": "RECON-TEST-F1"}, success=False, error="boom again",
    )
    row2 = await db.partner_sync_log.find_one({"code": "RECON-TEST-F1"})
    assert row2["attempts"] == 2
    assert row2["last_error"] == "boom again"
    # next_retry_at must be in the future
    assert row2["next_retry_at"] > datetime.now(timezone.utc).isoformat()


@pytest.mark.asyncio
async def test_record_abandons_after_max_attempts(db):
    for i in range(partner_reconcile.MAX_ATTEMPTS):
        await partner_reconcile.record_outbound_attempt(
            db, op="redeem", code="RECON-TEST-ABANDON",
            payload={"code": "RECON-TEST-ABANDON", "order_ref": "X"},
            success=False, error=f"attempt {i+1}",
        )
    row = await db.partner_sync_log.find_one({"code": "RECON-TEST-ABANDON"})
    assert row["status"] == "abandoned"
    assert row["attempts"] == partner_reconcile.MAX_ATTEMPTS
    assert row["next_retry_at"] is None


# ---------------------------------------------------------------------------
# reconcile_partner_coupons sweep
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_reconcile_sweeps_due_failures_and_marks_sent(db):
    # Seed one failed-but-due row
    past = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    await db.partner_sync_log.insert_one({
        "op": "issue",
        "code": "RECON-TEST-REPLAY",
        "payload": {"code": "RECON-TEST-REPLAY", "value_inr": 99},
        "status": "failed",
        "attempts": 1,
        "next_retry_at": past,
        "created_at": past,
        "last_attempt_at": past,
    })

    # Mock `_replay_one` by mocking httpx inside the call
    class _Resp:
        status_code = 200
        text = "{}"
    class _FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **kw): return _Resp()

    with patch("services.partner_reconcile.httpx.AsyncClient",
               return_value=_FakeClient()):
        stats = await partner_reconcile.reconcile_partner_coupons(db)

    assert stats["scanned"] == 1
    assert stats["sent"] == 1
    row = await db.partner_sync_log.find_one({"code": "RECON-TEST-REPLAY"})
    assert row["status"] == "sent"


@pytest.mark.asyncio
async def test_reconcile_skips_future_retries(db):
    future = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    await db.partner_sync_log.insert_one({
        "op": "issue",
        "code": "RECON-TEST-FUTURE",
        "payload": {"code": "RECON-TEST-FUTURE"},
        "status": "failed",
        "attempts": 2,
        "next_retry_at": future,
        "created_at": future,
        "last_attempt_at": future,
    })
    stats = await partner_reconcile.reconcile_partner_coupons(db)
    # Nothing due yet
    assert stats["scanned"] == 0


@pytest.mark.asyncio
async def test_reconcile_re_fails_and_re_schedules(db):
    past = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    await db.partner_sync_log.insert_one({
        "op": "redeem",
        "code": "RECON-TEST-REFAIL",
        "payload": {"code": "RECON-TEST-REFAIL", "order_ref": "ORD-1"},
        "status": "failed",
        "attempts": 2,
        "next_retry_at": past,
        "created_at": past,
        "last_attempt_at": past,
    })

    class _Resp:
        status_code = 500
        text = "upstream down"
    class _FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **kw): return _Resp()

    with patch("services.partner_reconcile.httpx.AsyncClient",
               return_value=_FakeClient()):
        stats = await partner_reconcile.reconcile_partner_coupons(db)

    assert stats["sent"] == 0
    assert stats["still_failing"] == 1
    row = await db.partner_sync_log.find_one({"code": "RECON-TEST-REFAIL"})
    assert row["status"] == "failed"
    assert row["attempts"] == 3  # incremented
    # new next_retry_at is in the future
    assert row["next_retry_at"] > datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# issue_amardeep_voucher + redeem_amardeep_coupon write log rows
# ---------------------------------------------------------------------------
class _Resp200:
    status_code = 200
    text = "{}"

class _Resp500:
    status_code = 500
    text = "partner kaput"

class _FakeClient:
    def __init__(self, resp):
        self._resp = resp
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False
    async def post(self, *a, **kw): return self._resp


@pytest.mark.asyncio
async def test_issue_voucher_logs_success_row(db):
    await db.partner_sync_log.delete_many({"op": "issue"})
    with patch("services.partner_coupons.httpx.AsyncClient",
               return_value=_FakeClient(_Resp200())):
        out = await partner_coupons.issue_amardeep_voucher(
            customer_email="x@y.com",
            source_order_ref="ORD-LOGTEST-1",
            amount_inr=1200,
            db=db,
        )
    assert out is not None
    row = await db.partner_sync_log.find_one({"code": out["code"]})
    assert row is not None
    assert row["status"] == "sent"
    assert row["op"] == "issue"
    # cleanup
    await db.partner_sync_log.delete_one({"_id": row["_id"]})


@pytest.mark.asyncio
async def test_redeem_coupon_logs_failure_row(db):
    await db.partner_sync_log.delete_many({"code": "RECON-TEST-REDEEM"})
    with patch("services.partner_coupons.httpx.AsyncClient",
               return_value=_FakeClient(_Resp500())):
        ok = await partner_coupons.redeem_amardeep_coupon(
            "RECON-TEST-REDEEM", "ORD-R1", db=db,
        )
    assert ok is False
    row = await db.partner_sync_log.find_one({"code": "RECON-TEST-REDEEM"})
    assert row is not None
    assert row["status"] == "failed"
    assert row["op"] == "redeem"
    assert row["attempts"] == 1
    assert "partner kaput" in row["last_error"]
