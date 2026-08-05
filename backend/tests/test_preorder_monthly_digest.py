"""Pre-Order flow + monthly rewards digest tests (Feb 2026)."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from services import b2b_preorder as pre  # noqa: E402
from services.b2b_preorder_pdf import build_preorder_receipt_pdf  # noqa: E402


# ─────────────────────────────────────────────────────────────
# Token math + eligibility
# ─────────────────────────────────────────────────────────────

def test_token_amount_is_exactly_half():
    assert pre.token_amount_for(1000) == 500.0
    assert pre.token_amount_for(2499) == 1249.5
    assert pre.token_amount_for(0) == 0.0


def test_token_amount_none_safe():
    assert pre.token_amount_for(None) == 0.0


def test_is_preorder_eligible_out_of_stock():
    assert pre.is_preorder_eligible({"stock_status": "out_of_stock"}) is True
    assert pre.is_preorder_eligible({"stock_status": "restocking"}) is True
    assert pre.is_preorder_eligible({"stock_status": "manufacturing"}) is True
    assert pre.is_preorder_eligible({"stock_status": "delayed"}) is True


def test_is_preorder_eligible_zero_stock_regardless_of_status():
    assert pre.is_preorder_eligible({"stock_status": "in_stock", "stock_pieces": 0}) is True


def test_is_preorder_not_eligible_when_in_stock():
    assert pre.is_preorder_eligible({"stock_status": "in_stock", "stock_pieces": 100}) is False


def test_stamp_terms_acceptance_sets_all_fields():
    order = pre.stamp_terms_acceptance({"order_id": "X"})
    assert order["is_preorder"] is True
    assert order["terms_version"] == pre.TERMS_VERSION
    assert "terms_accepted_at" in order
    assert order["terms_text"] == pre.TERMS_TEXT


def test_terms_text_contains_all_six_clauses():
    """User-mandated clauses — must remain in the legal block verbatim."""
    t = pre.TERMS_TEXT.lower()
    assert "non-refundable" in t
    assert "non-cancellable" in t
    assert "credit notes" in t or "cns" in t
    assert "amended" in t
    assert "manufacturing defect" in t
    assert "seal" in t and "intact" in t
    assert "damage" in t and "delivery" in t
    assert "signature" in t


# ─────────────────────────────────────────────────────────────
# Pre-Order receipt PDF
# ─────────────────────────────────────────────────────────────

def test_preorder_receipt_pdf_renders():
    order = {
        "order_id": "B2B-PRE-1",
        "grand_total": 4000.0,
        "token_amount_inr": 2000.0,
        "balance_due_inr": 2000.0,
        "is_preorder": True,
        "terms_version": pre.TERMS_VERSION,
        "terms_accepted_at": "2026-02-11T10:00:00+00:00",
        "razorpay_payment_id": "pay_test123",
        "items": [
            {"name": "Bold Bakhoor", "net_weight": "50g",
             "quantity_boxes": 1, "unit_label": "carton",
             "price_per_box": 2000, "line_total": 2000},
        ],
    }
    retailer = {
        "retailer_id": "R1", "business_name": "Test Shop",
        "gst_number": "27AABCU9603R1ZM", "email": "r@x", "phone": "9999900000",
        "city": "Mumbai", "state": "Maharashtra", "pincode": "400001",
    }
    pdf = build_preorder_receipt_pdf(order, retailer)
    assert pdf[:4] == b"%PDF"
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pdf) > 3000  # meaningful content


def test_preorder_receipt_pdf_handles_empty_items():
    """Even a zero-item pre-order (should never happen but defensive) renders."""
    order = {"order_id": "B2B-PRE-EMPTY", "grand_total": 0, "is_preorder": True, "items": []}
    retailer = {"retailer_id": "R2"}
    pdf = build_preorder_receipt_pdf(order, retailer)
    assert pdf[:4] == b"%PDF"


# ─────────────────────────────────────────────────────────────
# Monthly rewards digest
# ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = client[os.environ["DB_NAME"]]
    pref = "DIG-TEST-"
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.rewards_ledger.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.rewards_monthly_digest_log.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.settings.delete_many({"_id": "rewards_monthly_digest_state"})
    await _db.retailers.insert_many([
        {"retailer_id": f"{pref}R1", "email": "r1@x", "business_name": "R1 Shop"},
        {"retailer_id": f"{pref}R2", "email": "r2@x", "business_name": "R2 Shop"},
        {"retailer_id": f"{pref}R3", "email": None, "business_name": "No-Email Shop"},
    ])
    yield _db, pref
    await _db.retailers.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.rewards_ledger.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.rewards_monthly_digest_log.delete_many({"retailer_id": {"$regex": f"^{pref}"}})
    await _db.settings.delete_many({"_id": "rewards_monthly_digest_state"})
    client.close()


@pytest.mark.asyncio
async def test_send_statement_to_retailer_skips_no_email(db):
    _db, pref = db
    from services.monthly_rewards_digest import send_statement_to_retailer
    r = await _db.retailers.find_one({"retailer_id": f"{pref}R3"})
    with patch("services.email_service.is_email_service_available", return_value=True):
        res = await send_statement_to_retailer(_db, r)
    assert res["sent"] is False
    assert res["reason"] == "no_email"


@pytest.mark.asyncio
async def test_monthly_digest_emails_every_retailer_with_email(db):
    _db, pref = db
    from services.monthly_rewards_digest import run_monthly_digest

    with patch("services.email_service.send_email", new=AsyncMock(return_value=True)), \
         patch("services.email_service.is_email_service_available", return_value=True):
        result = await run_monthly_digest(_db, force=True)

    # We look for at least our two prefixed retailers in the digest log
    rows = await _db.rewards_monthly_digest_log.find(
        {"retailer_id": {"$regex": f"^{pref}"}}
    ).to_list(10)
    prefixed_ok = [r for r in rows if r.get("ok")]
    assert len(prefixed_ok) >= 2
    # Global counters at least reflect our two retailers
    assert result["sent"] >= 2


@pytest.mark.asyncio
async def test_monthly_digest_dedupes_per_calendar_month(db):
    _db, pref = db
    from services.monthly_rewards_digest import run_monthly_digest

    with patch("services.email_service.send_email", new=AsyncMock(return_value=True)), \
         patch("services.email_service.is_email_service_available", return_value=True):
        r1 = await run_monthly_digest(_db, force=True)
        r2 = await run_monthly_digest(_db, force=False)   # not forced this time

    assert r1.get("sent", 0) >= 2
    assert r2.get("skipped_reason") == "already_sent_this_month"
