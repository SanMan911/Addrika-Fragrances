"""Iteration 72 retest: verify iter71 action items are fixed.

1. CSV export survives non-ISO created_at (no 'T' separator) without IndexError.
2. Retailer statement PDF endpoint still returns valid PDF (regression).
3. Admin CSV endpoint still returns 200 with correct headers (regression).
4. /log full-list endpoint still returns entries (regression - route order fix).
"""
import os
import re
import uuid
import secrets
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("BACKEND_URL", "https://incense-rewards.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def _db():
    return MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]


def _fetch_admin_otp(token_id):
    doc = _db()["admin_2fa_tokens"].find_one({"token_id": token_id})
    assert doc, "OTP token missing"
    return doc["otp"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    otp = r.json().get("otp") or _fetch_admin_otp(tid)
    r2 = s.post(f"{API}/admin/login/verify-otp", json={"token_id": tid, "otp": otp}, timeout=30)
    assert r2.status_code == 200, r2.text
    return s


@pytest.fixture(scope="module")
def malformed_log_row():
    """Insert a synthetic b2b_inventory_log row with a non-ISO created_at."""
    dbm = _db()
    entry_id = f"iter72_test_{uuid.uuid4().hex[:8]}"
    dbm.b2b_inventory_log.insert_one({
        "id": entry_id,
        "product_id": "test_product",
        "reason": "test",
        "delta_pieces": 1,
        "before": 0,
        "after": 1,
        "created_at": "2026-02-11",  # date-only, no 'T'
        "admin_email": "iter72_test@example.com",
        "note": "iter72 non-ISO ts test",
    })
    yield entry_id
    dbm.b2b_inventory_log.delete_one({"id": entry_id})


class TestCSVMalformedTimestamp:
    def test_csv_export_survives_non_iso_created_at(self, admin, malformed_log_row):
        r = admin.get(f"{API}/admin/b2b/inventory/log/export.csv", timeout=30)
        assert r.status_code == 200, f"Status={r.status_code}, body={r.text[:300]}"
        assert "text/csv" in r.headers.get("content-type", "")
        # Confirm our malformed row is present in output
        assert malformed_log_row in r.text, f"Malformed entry id {malformed_log_row} missing from CSV"
        # Confirm the raw date-only timestamp is preserved
        assert "2026-02-11" in r.text


class TestRegressionIter71:
    def test_csv_headers_intact(self, admin):
        r = admin.get(f"{API}/admin/b2b/inventory/log/export.csv", timeout=30)
        assert r.status_code == 200
        header = r.text.strip().split("\n")[0]
        for col in ["Date (UTC)", "Product ID", "Product Name", "Reason",
                    "Δ Pieces", "Before", "After", "Order ID", "Admin", "Note", "Entry ID"]:
            assert col in header, f"Missing col {col}"

    def test_admin_log_list_still_200(self, admin):
        r = admin.get(f"{API}/admin/b2b/inventory/log", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "entries" in r.json()

    def test_retailer_statement_pdf_still_works(self):
        # Mint retailer session directly
        dbm = _db()
        r_doc = dbm.retailers.find_one({"status": "active"})
        if not r_doc:
            pytest.skip("No active retailer available")
        token = secrets.token_urlsafe(32)
        sess_id = f"rtl_sess_{uuid.uuid4().hex}"
        dbm.retailer_sessions.insert_one({
            "session_id": sess_id,
            "retailer_id": r_doc["retailer_id"],
            "email": r_doc.get("email", ""),
            "session_token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        })
        try:
            s = requests.Session()
            s.cookies.set("retailer_session", token)
            r = s.get(f"{API}/fragrance-rewards/statement.pdf", timeout=30)
            assert r.status_code == 200, r.text[:200]
            assert "application/pdf" in r.headers.get("content-type", "")
            assert r.content[:4] == b"%PDF"
            assert r.content.rstrip().endswith(b"%%EOF")
            assert len(r.content) > 500
        finally:
            dbm.retailer_sessions.delete_one({"session_id": sess_id})

    def test_empty_ledger_retailer_still_gets_valid_pdf(self):
        """Simulate empty ledger case: mint a retailer session for a retailer
        with zero ledger entries and verify PDF still generates."""
        dbm = _db()
        # Find a retailer with no ledger entries, or use a temp retailer
        all_retailers = list(dbm.retailers.find({"status": "active"}, {"retailer_id": 1, "email": 1}))
        empty_retailer = None
        for r_doc in all_retailers:
            count = dbm.rewards_ledger.count_documents({"retailer_id": r_doc["retailer_id"]})
            if count == 0:
                empty_retailer = r_doc
                break

        if not empty_retailer:
            pytest.skip("No retailer with empty ledger available")

        token = secrets.token_urlsafe(32)
        sess_id = f"rtl_sess_{uuid.uuid4().hex}"
        dbm.retailer_sessions.insert_one({
            "session_id": sess_id,
            "retailer_id": empty_retailer["retailer_id"],
            "email": empty_retailer.get("email", ""),
            "session_token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        })
        try:
            s = requests.Session()
            s.cookies.set("retailer_session", token)
            r = s.get(f"{API}/fragrance-rewards/statement.pdf", timeout=30)
            assert r.status_code == 200, r.text[:200]
            assert r.content[:4] == b"%PDF"
            assert r.content.rstrip().endswith(b"%%EOF")
            assert len(r.content) > 500, f"PDF too small for empty ledger: {len(r.content)}"
        finally:
            dbm.retailer_sessions.delete_one({"session_id": sess_id})
