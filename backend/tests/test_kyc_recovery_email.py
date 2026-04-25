"""Tests for the KYC recovery email service (rate-limited dispatcher)."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

import pytest
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture
def cleanup_log(mongo):
    """Wipe the rate-limit log for our test retailer before & after."""
    test_id = "RTL_TEST_KYC_EMAIL"
    mongo.kyc_email_log.delete_one({"retailer_id": test_id})
    yield test_id
    mongo.kyc_email_log.delete_one({"retailer_id": test_id})


# Pull in motor db for the async helper
import asyncio  # noqa: E402

from server import db as motor_db  # noqa: E402
from services.kyc_recovery_email import (  # noqa: E402
    maybe_send_kyc_recovery_email,
    _email_html,
)


def _run(coro):
    """Run an async coroutine in a fresh event loop (avoids motor's
    closed-loop issue when reusing the global db)."""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestEmailHtml:
    def test_renders_missing_items(self):
        html = _email_html(
            {"name": "Jane", "business_name": "Jane Inc"},
            ["PAN", "Aadhaar"],
            "https://example.com/retailer/b2b#kyc",
        )
        assert "Jane" in html
        assert "Jane Inc" in html
        assert "<b>PAN</b>" in html
        assert "<b>Aadhaar</b>" in html
        assert "https://example.com/retailer/b2b#kyc" in html

    def test_handles_missing_name(self):
        html = _email_html({}, ["GST"], "https://x")
        assert "there" in html  # default greeting


class TestMaybeSendKYCRecoveryEmail:
    def test_skip_when_no_missing(self, cleanup_log):
        retailer = {"retailer_id": cleanup_log, "email": "x@example.com"}
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            sent = _run(maybe_send_kyc_recovery_email(motor_db, retailer, []))
        assert sent is False
        mock_send.assert_not_called()

    def test_skip_when_no_email(self, cleanup_log):
        retailer = {"retailer_id": cleanup_log}
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            sent = _run(maybe_send_kyc_recovery_email(motor_db, retailer, ["PAN"]))
        assert sent is False
        mock_send.assert_not_called()

    def test_sends_first_time(self, cleanup_log, mongo):
        retailer = {
            "retailer_id": cleanup_log,
            "email": "test@addrika.local",
            "name": "Test Retailer",
            "business_name": "Test Inc",
        }
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True
            sent = _run(
                maybe_send_kyc_recovery_email(motor_db, retailer, ["PAN", "Aadhaar"])
            )
        assert sent is True
        assert mock_send.await_count == 1
        # Log persisted
        log = mongo.kyc_email_log.find_one({"retailer_id": cleanup_log})
        assert log is not None
        assert log["email"] == "test@addrika.local"
        assert log["missing"] == ["PAN", "Aadhaar"]
        assert log["send_count"] == 1

    def test_throttles_within_24h(self, cleanup_log, mongo):
        # Pre-seed a recent send
        mongo.kyc_email_log.insert_one(
            {
                "retailer_id": cleanup_log,
                "email": "test@addrika.local",
                "missing": ["PAN"],
                "last_sent_at": datetime.now(timezone.utc).isoformat(),
                "send_count": 1,
            }
        )
        retailer = {
            "retailer_id": cleanup_log,
            "email": "test@addrika.local",
            "name": "T",
        }
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            sent = _run(maybe_send_kyc_recovery_email(motor_db, retailer, ["PAN"]))
        assert sent is False
        mock_send.assert_not_called()

    def test_re_sends_after_24h(self, cleanup_log, mongo):
        # Seed an old send (25 hours ago)
        old = datetime.now(timezone.utc) - timedelta(hours=25)
        mongo.kyc_email_log.insert_one(
            {
                "retailer_id": cleanup_log,
                "email": "test@addrika.local",
                "missing": ["PAN"],
                "last_sent_at": old.isoformat(),
                "send_count": 1,
            }
        )
        retailer = {
            "retailer_id": cleanup_log,
            "email": "test@addrika.local",
            "name": "T",
        }
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True
            sent = _run(maybe_send_kyc_recovery_email(motor_db, retailer, ["PAN"]))
        assert sent is True
        assert mock_send.await_count == 1
        log = mongo.kyc_email_log.find_one({"retailer_id": cleanup_log})
        assert log["send_count"] == 2  # incremented

    def test_skip_when_send_email_fails(self, cleanup_log, mongo):
        retailer = {
            "retailer_id": cleanup_log,
            "email": "test@addrika.local",
            "name": "T",
        }
        with patch(
            "services.kyc_recovery_email.send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = False  # Resend not configured / errored
            sent = _run(maybe_send_kyc_recovery_email(motor_db, retailer, ["PAN"]))
        assert sent is False
        # No log written when send fails
        log = mongo.kyc_email_log.find_one({"retailer_id": cleanup_log})
        assert log is None
