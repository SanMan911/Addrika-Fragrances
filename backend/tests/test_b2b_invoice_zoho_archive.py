"""
Regression tests for the B2B batch:
- Server-side PDF invoice generation (admin + retailer)
- Zoho sync error log (record / list / count / resolve)
- Admin message thread auto-archive after 90 days idle (and list filter)

Mirrors the requests + pymongo pattern used by tests/test_b2b_iteration_64.py.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ.get(
    "BACKEND_URL", "http://localhost:8001"
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"


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
    r = s.post(
        f"{API}/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    otp = r.json().get("otp") or _fetch_admin_otp(tid)
    r2 = s.post(
        f"{API}/admin/login/verify-otp",
        json={"token_id": tid, "otp": otp},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    # Ensure auth works over plain HTTP too (cookie has secure=True so not
    # set on http://localhost) by also sending Bearer token on every call.
    s.headers["Authorization"] = f"Bearer {r2.json()['session_token']}"
    return s


@pytest.fixture(scope="session")
def retailer():
    """Login as retailer (b2b portal must be enabled in admin_settings)."""
    db = _mongo()
    db.admin_settings.update_one(
        {"setting_key": "b2b_enabled"},
        {"$set": {"setting_value": True}},
        upsert=True,
    )
    s = requests.Session()
    r = s.post(
        f"{API}/retailer-auth/login",
        json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    token = body.get("token") or body.get("session_token") or body.get("retailer_session")
    if token:
        # belt-and-braces: send retailer cookie via cookies dict on each request
        s.cookies.set("retailer_session", token)
    return s


# ====================================================================
# 1. PDF invoice — pure-function smoke test
# ====================================================================
class TestPdfPureFunction:
    def test_build_invoice_pdf_starts_with_pdf_magic(self):
        from services.b2b_invoice_pdf import build_invoice_pdf

        order = {
            "order_id": "B2B-PDF-UNIT-1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payment_method": "online", "payment_status": "paid",
            "billing_address": {
                "address": "Shop 4", "city": "Mumbai",
                "state": "Maharashtra", "pincode": "400001",
            },
            "items": [
                {
                    "name": "Kesar Chandan", "net_weight": "50g",
                    "quantity_boxes": 2, "price_per_box": 1010,
                    "line_total": 2020, "line_total_base": 2020,
                    "taxable_value": 2000, "gst_rate": 5,
                    "hsn_code": "33074100",
                },
                {
                    "name": "Bold Bakhoor", "net_weight": "50g",
                    "quantity_boxes": 1, "price_per_box": 1010,
                    "line_total": 1010, "line_total_base": 1010,
                    "taxable_value": 1000, "gst_rate": 18,
                    "hsn_code": "33074900",
                },
            ],
            "subtotal": 3030, "taxable_value": 3000,
            "tier_discount_total": 0, "loyalty_discount": 30.3,
            "loyalty_discount_percent": 1, "voucher_discount": 0,
            "cash_discount": 15, "cash_discount_percent": 1.5,
            "credit_note_discount": 0, "gst_total": 280, "grand_total": 3280,
        }
        retailer = {
            "business_name": "Mumbai Shop",
            "gst_number": "27ABCDE1234F1Z5",
            "state": "Maharashtra", "city": "Mumbai",
            "email": "x@y.com", "phone": "+91",
        }
        pdf = build_invoice_pdf(order, retailer)
        assert pdf.startswith(b"%PDF")
        assert len(pdf) > 2000


# ====================================================================
# 2. PDF invoice — admin endpoint
# ====================================================================
class TestAdminInvoicePdfEndpoint:
    def test_admin_invoice_unknown_order_returns_404(self, admin):
        r = admin.get(
            f"{API}/admin/b2b/orders/NO-SUCH/invoice.pdf",
            timeout=30,
        )
        assert r.status_code == 404

    def test_admin_invoice_unauthenticated_returns_401(self):
        r = requests.get(f"{API}/admin/b2b/orders/X/invoice.pdf", timeout=30)
        assert r.status_code == 401

    def test_admin_invoice_returns_pdf(self, admin):
        db = _mongo()
        order = db.b2b_orders.find_one({}, {"_id": 0})
        if not order:
            pytest.skip("No B2B order present for endpoint smoke test")
        r = admin.get(
            f"{API}/admin/b2b/orders/{order['order_id']}/invoice.pdf",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content.startswith(b"%PDF")


# ====================================================================
# 3. PDF invoice — retailer endpoint
# ====================================================================
class TestRetailerInvoicePdfEndpoint:
    def test_retailer_invoice_returns_pdf_for_own_order(self, retailer):
        db = _mongo()
        order = db.b2b_orders.find_one({"retailer_id": "RTL_TEST_B2B"}, {"_id": 0})
        if not order:
            pytest.skip("No B2B order for RTL_TEST_B2B")
        r = retailer.get(
            f"{API}/retailer-dashboard/b2b/orders/{order['order_id']}/invoice.pdf",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.content.startswith(b"%PDF")

    def test_retailer_invoice_404_for_other_retailer(self, retailer):
        r = retailer.get(
            f"{API}/retailer-dashboard/b2b/orders/B2B-NOT-MINE/invoice.pdf",
            timeout=30,
        )
        assert r.status_code == 404


# ====================================================================
# 4. Zoho sync error log
# ====================================================================
class TestZohoErrors:
    def setup_method(self, _):
        db = _mongo()
        db.zoho_sync_errors.delete_many({"order_id": {"$regex": "^TEST-IT-"}})

    def teardown_method(self, _):
        db = _mongo()
        db.zoho_sync_errors.delete_many({"order_id": {"$regex": "^TEST-IT-"}})

    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{API}/admin/zoho/errors", timeout=30)
        assert r.status_code == 401

    def test_record_list_count_resolve(self, admin):
        db = _mongo()
        eid = str(uuid.uuid4())
        db.zoho_sync_errors.insert_one(
            {
                "id": eid,
                "op": "sales_order",
                "order_id": "TEST-IT-ZOHO-1",
                "retailer_id": "RTL_TEST",
                "error_message": "boom",
                "resolved": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        # list
        r = admin.get(f"{API}/admin/zoho/errors", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["unresolved"] >= 1
        ids = {e["id"] for e in body["errors"]}
        assert eid in ids
        # count
        c = admin.get(f"{API}/admin/zoho/errors/count", timeout=30).json()
        assert c["unresolved"] >= 1
        # resolve
        rr = admin.post(f"{API}/admin/zoho/errors/{eid}/resolve", timeout=30)
        assert rr.status_code == 200 and rr.json()["resolved"] is True
        # already resolved → 404
        rr2 = admin.post(f"{API}/admin/zoho/errors/{eid}/resolve", timeout=30)
        assert rr2.status_code == 404


# ====================================================================
# 5. Thread auto-archive
# ====================================================================
class TestThreadArchive:
    def setup_method(self, _):
        db = _mongo()
        db.retailer_admin_threads.delete_many(
            {"thread_id": {"$regex": "^thr_ARCH_"}}
        )

    def teardown_method(self, _):
        db = _mongo()
        db.retailer_admin_threads.delete_many(
            {"thread_id": {"$regex": "^thr_ARCH_"}}
        )

    def test_idle_thread_flagged_archived(self, admin):
        from services.b2b_thread_archive import archive_idle_threads
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio

        db_sync = _mongo()
        old = (datetime.now(timezone.utc) - timedelta(days=95)).isoformat()
        fresh = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
        db_sync.retailer_admin_threads.update_one(
            {"thread_id": "thr_ARCH_OLD"},
            {"$set": {
                "thread_id": "thr_ARCH_OLD",
                "retailer_id": "RTL_X",
                "last_message_at": old,
                "archived": False,
            }},
            upsert=True,
        )
        db_sync.retailer_admin_threads.update_one(
            {"thread_id": "thr_ARCH_FRESH"},
            {"$set": {
                "thread_id": "thr_ARCH_FRESH",
                "retailer_id": "RTL_Y",
                "last_message_at": fresh,
                "archived": False,
            }},
            upsert=True,
        )

        async def run():
            mc = AsyncIOMotorClient(MONGO_URL)
            return await archive_idle_threads(mc[DB_NAME])

        archived_count = asyncio.new_event_loop().run_until_complete(run())
        assert archived_count >= 1

        old_doc = db_sync.retailer_admin_threads.find_one(
            {"thread_id": "thr_ARCH_OLD"}, {"_id": 0}
        )
        fresh_doc = db_sync.retailer_admin_threads.find_one(
            {"thread_id": "thr_ARCH_FRESH"}, {"_id": 0}
        )
        assert old_doc["archived"] is True
        assert fresh_doc.get("archived") in (False, None)

        # Admin list filter
        default = admin.get(f"{API}/admin/b2b/threads", timeout=30).json()
        with_arch = admin.get(
            f"{API}/admin/b2b/threads?include_archived=true", timeout=30
        ).json()
        ids_default = {t["thread_id"] for t in default["threads"]}
        ids_with_arch = {t["thread_id"] for t in with_arch["threads"]}
        assert "thr_ARCH_OLD" not in ids_default
        assert "thr_ARCH_OLD" in ids_with_arch
