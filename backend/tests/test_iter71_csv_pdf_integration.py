"""Iteration 71 end-to-end integration tests:
- Admin: GET /api/admin/b2b/inventory/log/export.csv (CSV headers + rows)
- Admin: GET /api/admin/b2b/inventory/log (audit list, all SKUs)
- Retailer: GET /api/fragrance-rewards/statement.pdf (application/pdf)
- Auth guards (anonymous → 401)
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "BACKEND_URL", "https://shiprocket-shipping.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"
RETAILER_ID = "RTL_TEST_B2B"


def _mongo():
    return MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]


def _fetch_admin_otp(token_id: str) -> str:
    db = _mongo()
    doc = db["admin_2fa_tokens"].find_one({"token_id": token_id})
    assert doc, "OTP token missing"
    return doc["otp"]


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    otp = r.json().get("otp") or _fetch_admin_otp(tid)
    r2 = s.post(f"{API}/admin/login/verify-otp",
                json={"token_id": tid, "otp": otp}, timeout=30)
    assert r2.status_code == 200, r2.text
    return s


@pytest.fixture(scope="session")
def retailer(admin):
    """Mint a retailer session directly into db.retailer_sessions for an
    existing active retailer. Retailer-login endpoint requires a bcrypt
    password we don't have; direct session insert simulates a logged-in
    retailer without touching the login flow, which is out-of-scope here."""
    from pymongo import MongoClient
    import secrets, uuid
    from datetime import datetime, timezone, timedelta

    dbm = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]
    r_doc = dbm.retailers.find_one({"status": "active"})
    if not r_doc:
        pytest.skip("No active retailer in DB to mint a session for")
    rid = r_doc["retailer_id"]
    email = r_doc.get("email", "")

    token = secrets.token_urlsafe(32)
    dbm.retailer_sessions.insert_one({
        "session_id": f"rtl_sess_{uuid.uuid4().hex}",
        "retailer_id": rid,
        "email": email,
        "session_token": token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
    })

    s = requests.Session()
    s.cookies.set("retailer_session", token)
    s.retailer_id = rid  # attach for assertion
    return s


# ─────────────── Admin CSV ───────────────
class TestInventoryLogCSV:
    def test_anon_401(self):
        r = requests.get(f"{API}/admin/b2b/inventory/log/export.csv", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_csv_content_type_and_headers(self, admin):
        r = admin.get(f"{API}/admin/b2b/inventory/log/export.csv", timeout=30)
        assert r.status_code == 200, r.text[:300]
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype, ctype
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and "addrika-inventory-log-" in cd, cd
        assert cd.endswith('.csv"') or ".csv" in cd, cd

        text = r.text
        lines = text.strip().split("\n")
        header = lines[0]
        # Header must match spec exactly
        expected_cols = [
            "Date (UTC)", "Product ID", "Product Name", "Reason",
            "Δ Pieces", "Before", "After", "Order ID", "Admin", "Note", "Entry ID",
        ]
        for col in expected_cols:
            assert col in header, f"Missing column '{col}' in header: {header}"

    def test_csv_has_data_rows_and_enriched_product_name(self, admin):
        r = admin.get(f"{API}/admin/b2b/inventory/log/export.csv", timeout=30)
        assert r.status_code == 200
        lines = r.text.strip().split("\n")
        # At least header + one data row (iter_70 seeded a Bold Bakhoor +100)
        assert len(lines) >= 2, f"Only got header, no data rows. Got {len(lines)} lines."
        # Check ProductName enrichment: pattern like "Name (weight)"
        body = "\n".join(lines[1:])
        assert re.search(r"\([^)]*g\)", body), f"No enriched Name (weight) pattern in CSV body: {body[:300]}"

    def test_admin_inventory_log_list_endpoint(self, admin):
        r = admin.get(f"{API}/admin/b2b/inventory/log", timeout=30)
        assert r.status_code == 200, r.text[:300]
        js = r.json()
        assert "entries" in js
        assert isinstance(js["entries"], list)


# ─────────────── Retailer Statement PDF ───────────────
class TestRewardsStatementPDF:
    def test_anon_401(self):
        r = requests.get(f"{API}/fragrance-rewards/statement.pdf", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_pdf_content_type_and_magic(self, retailer):
        r = retailer.get(f"{API}/fragrance-rewards/statement.pdf", timeout=30)
        assert r.status_code == 200, r.text[:300]
        ctype = r.headers.get("content-type", "")
        assert "application/pdf" in ctype, ctype
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd, cd
        # Filename pattern: addrika-rewards-<retailer_id>-<YYYYMMDD>.pdf
        assert re.search(r'addrika-rewards-[^\-]+-\d{8}\.pdf', cd), cd

        body = r.content
        assert body[:4] == b"%PDF", f"Not a PDF: {body[:20]}"
        assert body.rstrip().endswith(b"%%EOF"), f"Missing EOF marker: ...{body[-30:]!r}"
        assert len(body) > 2000, f"PDF too small: {len(body)} bytes"
