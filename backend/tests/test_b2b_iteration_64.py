"""
B2B Iteration 64 tests:
- Top retailers widget exposes retailer_phone & retailer_country_code (nudge button data)
- Zoho Books admin endpoints (status, resync) — no-op when ZOHO_* unset
- Magic-number sniffing on bills + messages attachments
- Coming-Soon -> Available email blast endpoint (auth, validation, idempotency)
- Pure-function regression for services.zoho_books._distribute_discount
"""
import os
import base64
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "BACKEND_URL", "https://addrika-kyc-onboard.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"
RETAILER_ID = "RTL_TEST_B2B"


# ---------- helpers ----------
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
    r = s.post(f"{API}/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    otp = r.json().get("otp") or _fetch_admin_otp(tid)
    r2 = s.post(f"{API}/admin/login/verify-otp", json={"token_id": tid, "otp": otp}, timeout=30)
    assert r2.status_code == 200, r2.text
    return s


@pytest.fixture(scope="session")
def anon():
    return requests.Session()


# ====================================================================
# 1. Top retailers widget exposes phone + country_code (Nudge data)
# ====================================================================
class TestTopRetailers:
    def test_top_retailers_has_phone_and_cc(self, admin):
        # Seed one paid B2B order so we always have at least 1 row in top-retailers
        db = _mongo()
        seed_id = f"TEST_IT64_TOP_{uuid.uuid4().hex[:8]}"
        db.b2b_orders.insert_one({
            "order_id": seed_id,
            "retailer_id": RETAILER_ID,
            "items": [],
            "subtotal": 1000.0,
            "grand_total": 1180.0,
            "payment_status": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = admin.get(f"{API}/admin/b2b/reports/top-retailers?period=fy", timeout=30)
            assert r.status_code == 200, r.text
            rows = r.json().get("top_retailers") or []
            assert rows, "expected at least 1 row after seeding"
            for row in rows:
                assert "retailer_phone" in row, f"missing retailer_phone in {row}"
                assert "retailer_country_code" in row, f"missing retailer_country_code in {row}"
                # country_code falls back to '+91' if retailer doc lacks the field
                assert row["retailer_country_code"], row
        finally:
            db.b2b_orders.delete_many({"order_id": {"$regex": "^TEST_IT64_TOP_"}})


# ====================================================================
# 2. Zoho admin endpoints
# ====================================================================
class TestZohoAdmin:
    def test_status_unauth_401(self, anon):
        r = anon.get(f"{API}/admin/zoho/status", timeout=30)
        assert r.status_code == 401, r.text

    def test_status_admin_returns_state(self, admin):
        """Status endpoint always returns a {configured: bool} payload.
        Once OAuth is completed (via /api/admin/zoho/oauth-init flow),
        configured flips to True. Both states are valid — we just assert
        the contract."""
        r = admin.get(f"{API}/admin/zoho/status", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "configured" in data
        if data["configured"]:
            # When live, ok must also be True
            assert data.get("ok") in (True, False)
            assert data.get("org_id")
            assert data.get("region")

    def test_resync_nonexistent_404(self, admin):
        r = admin.post(f"{API}/admin/zoho/resync/NO_SUCH_ORDER_XYZ", timeout=30)
        assert r.status_code == 404, r.text

    def test_resync_existing_order_noop(self, admin):
        # Find any existing b2b order for the test retailer (or seed one)
        db = _mongo()
        order = db.b2b_orders.find_one({"retailer_id": RETAILER_ID})
        if not order:
            order_id = f"TEST_IT64_RESYNC_{uuid.uuid4().hex[:8]}"
            db.b2b_orders.insert_one({
                "order_id": order_id,
                "retailer_id": RETAILER_ID,
                "items": [],
                "subtotal": 1000,
                "grand_total": 1180,
                "payment_status": "paid",
                "razorpay_payment_id": "pay_test_iter64",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            order_id = order["order_id"]

        r = admin.post(f"{API}/admin/zoho/resync/{order_id}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("salesorder_pushed") is False, data
        assert data.get("payment_pushed") is False, data

        # Cleanup if we seeded
        db.b2b_orders.delete_many({"order_id": {"$regex": "^TEST_IT64_RESYNC_"}})


# ====================================================================
# 3. Magic-number sniffing on bill upload (and messages helper)
# ====================================================================
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
PDF_BYTES = b"%PDF-1.4\n" + b"\x00" * 100
JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 100


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


class TestBillsMagicNumber:
    def test_pdf_claim_jpeg_bytes_400(self, admin):
        # Claim PDF, send JPEG bytes -> mismatch
        payload = {
            "title": "Mismatch test",
            "file_base64": _b64(JPEG_BYTES),
            "file_name": "fake.pdf",
            "file_type": "application/pdf",
        }
        r = admin.post(f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills", json=payload, timeout=30)
        assert r.status_code == 400, r.text
        assert "does not match" in r.text.lower() or "content" in r.text.lower()

    def test_real_png_succeeds(self, admin):
        payload = {
            "title": f"PNG ok {uuid.uuid4().hex[:6]}",
            "file_base64": _b64(PNG_BYTES),
            "file_name": "real.png",
            "file_type": "image/png",
        }
        r = admin.post(f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        bid = r.json()["bill"]["bill_id"]
        # cleanup
        admin.delete(f"{API}/admin/b2b/bills/{bid}", timeout=30)

    def test_real_pdf_succeeds(self, admin):
        payload = {
            "title": f"PDF ok {uuid.uuid4().hex[:6]}",
            "file_base64": _b64(PDF_BYTES),
            "file_name": "real.pdf",
            "file_type": "application/pdf",
        }
        r = admin.post(f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        bid = r.json()["bill"]["bill_id"]
        admin.delete(f"{API}/admin/b2b/bills/{bid}", timeout=30)

    def test_zip_blocked_400(self, admin):
        zip_bytes = b"PK\x03\x04" + b"\x00" * 100
        payload = {
            "title": "ZIP",
            "file_base64": _b64(zip_bytes),
            "file_name": "x.zip",
            "file_type": "application/zip",
        }
        r = admin.post(f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills", json=payload, timeout=30)
        assert r.status_code == 400, r.text


class TestMessagesMagicNumber:
    def test_admin_message_mismatch_400(self, admin):
        payload = {
            "message": "test attachment",
            "attachments": [{
                "file_base64": _b64(JPEG_BYTES),
                "file_name": "fake.pdf",
                "file_type": "application/pdf",
            }],
        }
        r = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/messages",
            json=payload,
            timeout=30,
        )
        assert r.status_code == 400, r.text


# ====================================================================
# 4. Notify-me blast endpoint
# ====================================================================
class TestNotifyMeBlast:
    def test_blast_unauth_401(self, anon):
        r = anon.post(f"{API}/admin/notify-me/some_product/blast", timeout=30)
        assert r.status_code == 401, r.text

    def test_blast_unknown_product_404(self, admin):
        r = admin.post(f"{API}/admin/notify-me/__no_such_product_xyz__/blast", timeout=30)
        assert r.status_code == 404, r.text

    def test_blast_coming_soon_400(self, admin):
        # Find or create a coming-soon product
        db = _mongo()
        cs = db.products.find_one({"comingSoon": True})
        if not cs:
            pid = f"TEST_IT64_CS_{uuid.uuid4().hex[:8]}"
            db.products.insert_one({"id": pid, "name": "Test CS", "comingSoon": True})
        else:
            pid = cs["id"]
        try:
            r = admin.post(f"{API}/admin/notify-me/{pid}/blast", timeout=30)
            assert r.status_code == 400, r.text
        finally:
            db.products.delete_many({"id": {"$regex": "^TEST_IT64_CS_"}})

    def test_blast_available_idempotent(self, admin):
        db = _mongo()
        pid = f"TEST_IT64_AVAIL_{uuid.uuid4().hex[:8]}"
        db.products.insert_one({"id": pid, "name": "Test Available", "comingSoon": False})
        # seed two notify_me subscribers
        sub_emails = [f"pytest_it64_a_{uuid.uuid4().hex[:6]}@example.com",
                      f"pytest_it64_b_{uuid.uuid4().hex[:6]}@example.com"]
        for em in sub_emails:
            db.notify_me.insert_one({
                "email": em, "product_id": pid,
                "product_name": "Test Available",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        try:
            r1 = admin.post(f"{API}/admin/notify-me/{pid}/blast", timeout=60)
            assert r1.status_code == 200, r1.text
            d1 = r1.json()
            assert "sent" in d1 and "failed" in d1
            # Each subscriber processed exactly once (sent OR failed)
            assert (d1["sent"] + d1["failed"]) == 2, d1
            # Verify notified_at written for processed ones
            notified = db.notify_me.count_documents({
                "product_id": pid, "notified_at": {"$exists": True}
            })
            assert notified == d1["sent"], (notified, d1)

            # Second call must be idempotent: 0 sent/failed (only un-notified processed)
            r2 = admin.post(f"{API}/admin/notify-me/{pid}/blast", timeout=60)
            assert r2.status_code == 200, r2.text
            d2 = r2.json()
            assert (d2["sent"] + d2["failed"]) == 0, d2
        finally:
            db.products.delete_many({"id": {"$regex": "^TEST_IT64_AVAIL_"}})
            db.notify_me.delete_many({"email": {"$regex": "^pytest_it64_"}})


# ====================================================================
# 5. _distribute_discount pure function regression
# ====================================================================
class TestDistributeDiscount:
    def test_sums_to_subtotal_minus_discounts(self):
        from services.zoho_books import _distribute_discount

        order = {
            "subtotal": 10000.0,
            "loyalty_discount": 500.0,
            "voucher_discount": 200.0,
            "cash_discount": 150.0,
            "items": [
                {"name": "Item A", "net_weight": "100g", "quantity_boxes": 2,
                 "line_total": 4000.0, "gst_rate": 18, "hsn_code": "3303"},
                {"name": "Item B", "net_weight": "50g", "quantity_boxes": 3,
                 "line_total": 6000.0, "gst_rate": 18, "hsn_code": "3303"},
            ],
        }
        lines = _distribute_discount(order)
        total_after = sum(line["item_total"] for line in lines)
        expected = 10000.0 - 500.0 - 200.0 - 150.0  # 9150
        assert abs(total_after - expected) <= 0.5, (total_after, expected, lines)

    def test_no_discount_returns_subtotal(self):
        from services.zoho_books import _distribute_discount
        order = {
            "subtotal": 1000.0,
            "items": [
                {"name": "X", "net_weight": "10g", "quantity_boxes": 1,
                 "line_total": 1000.0, "gst_rate": 18, "hsn_code": "3303"},
            ],
        }
        lines = _distribute_discount(order)
        assert abs(sum(l["item_total"] for l in lines) - 1000.0) <= 0.5

    def test_is_configured_returns_bool(self):
        """is_configured() now reads env *and* admin_settings.zoho_oauth, so
        it returns True after OAuth completes. We just assert a clean bool."""
        import asyncio
        from services.zoho_books import is_configured
        result = asyncio.get_event_loop().run_until_complete(is_configured())
        assert isinstance(result, bool)
