"""
B2B Iteration 63 tests:
- Waitlist: GST required (422 missing, 400 invalid, 200 valid with title-case + country_code default)
- B2B calculate: GST now computed on taxable_value (after all discounts)
- Admin top-5 retailers widget data
- Admin sales report (quarter / fy / custom periods; group_by retailer/quarter/month)
- Email refactor import check
"""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "BACKEND_URL", "https://incense-retail.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"
RETAILER_ID = "RTL_TEST_B2B"
PRODUCT_ID = "kesar-chandan-b2b"

# Valid GST for Maharashtra: 27AAPFU0939F1ZV (standard sample)
VALID_GST = "27AAPFU0939F1ZV"


def _fetch_admin_otp(token_id: str) -> str:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    doc = client[DB_NAME]["admin_2fa_tokens"].find_one({"token_id": token_id})
    client.close()
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


@pytest.fixture(scope="session", autouse=True)
def portal_teardown(admin):
    # Enable portal for all tests in this session
    admin.put(f"{API}/admin/b2b-settings", json={"enabled": True, "cash_discount_percent": 1.5}, timeout=30)
    yield
    # Cleanup waitlist test rows
    try:
        client = MongoClient(MONGO_URL)
        client[DB_NAME]["retailer_waitlist"].delete_many({"email": {"$regex": "^pytest_it63_"}})
        client.close()
    except Exception:
        pass
    # Restore portal DISABLED
    try:
        admin.put(f"{API}/admin/b2b-settings", json={"enabled": False}, timeout=30)
    except Exception:
        pass


@pytest.fixture(scope="session")
def retailer_session():
    s = requests.Session()
    r = s.post(f"{API}/retailer-auth/login", json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"retailer login failed: {r.status_code} {r.text}")
    return s


# ------------------------------------------------------------ Waitlist (iter 63)
class TestWaitlistGstRequired:
    def test_missing_gst_returns_422(self):
        """gst_number is now a required field."""
        r = requests.post(
            f"{API}/retailer-auth/waitlist",
            json={
                "business_name": "No Gst Store",
                "contact_name": "Bot",
                "email": f"pytest_it63_nogst_{uuid.uuid4().hex[:6]}@example.com",
                "phone": "9999999999",
            },
            timeout=30,
        )
        assert r.status_code == 422, r.text

    def test_invalid_gst_returns_400(self):
        r = requests.post(
            f"{API}/retailer-auth/waitlist",
            json={
                "business_name": "Bad Gst",
                "contact_name": "Bot",
                "email": f"pytest_it63_badgst_{uuid.uuid4().hex[:6]}@example.com",
                "phone": "9999999999",
                "gst_number": "INVALIDGSTABCDE",  # 15 chars but wrong format
            },
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "Invalid GST" in r.json().get("detail", "")

    def test_valid_gst_persists_country_code_and_titlecase(self):
        email = f"pytest_it63_ok_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(
            f"{API}/retailer-auth/waitlist",
            json={
                "business_name": "acme stores",  # lowercase -> should become "Acme Stores"
                "contact_name": "jane doe",
                "email": email.upper(),  # upper -> should be lowercased
                "phone": "9876543210",
                "gst_number": VALID_GST.lower(),  # lowercase -> should be uppercased
                # country_code omitted -> default +91
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == email.lower()

        client = MongoClient(MONGO_URL)
        doc = client[DB_NAME]["retailer_waitlist"].find_one({"email": email.lower()})
        client.close()
        assert doc is not None
        assert doc["business_name"] == "Acme Stores"
        assert doc["contact_name"] == "Jane Doe"
        assert doc["email"] == email.lower()
        assert doc["gst_number"] == VALID_GST
        assert doc["country_code"] == "+91"  # default
        assert doc["whatsapp_full"] == "+919876543210"

    def test_explicit_country_code(self):
        email = f"pytest_it63_cc_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(
            f"{API}/retailer-auth/waitlist",
            json={
                "business_name": "UK Shop",
                "contact_name": "Bot",
                "email": email,
                "phone": "2012345678",
                "country_code": "+44",
                "gst_number": VALID_GST,
            },
            timeout=30,
        )
        assert r.status_code == 200
        client = MongoClient(MONGO_URL)
        doc = client[DB_NAME]["retailer_waitlist"].find_one({"email": email})
        client.close()
        assert doc["country_code"] == "+44"
        assert doc["whatsapp_full"] == "+442012345678"


# ------------------------------------------------------------ B2B Calculate GST-after-discount
class TestCalculateGstAfterDiscount:
    def test_gst_computed_on_taxable_value(self, retailer_session):
        # Clean any seeded paid loyalty orders for this retailer
        client = MongoClient(MONGO_URL)
        client[DB_NAME]["b2b_orders"].delete_many(
            {"retailer_id": RETAILER_ID, "notes": {"$regex": "^TEST_IT6"}}
        )
        client.close()

        r = retailer_session.post(
            f"{API}/retailer-dashboard/b2b/calculate",
            json={
                "items": [{"product_id": PRODUCT_ID, "quantity_boxes": 1}],
                "apply_cash_discount": True,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        # Keys required
        for k in ("subtotal", "subtotal_after_loyalty", "taxable_value", "gst_total", "grand_total", "cash_discount"):
            assert k in b, f"missing {k} in calc response"

        subtotal = b["subtotal"]
        # Base price = 1010 (Kesar Chandan 50g 1 box) – tolerate small drift
        assert 1000 <= subtotal <= 1050, f"unexpected subtotal {subtotal}"

        # cash = subtotal_after_loyalty * 1.5%
        expected_cash = round(b["subtotal_after_loyalty"] * 1.5 / 100, 2)
        assert abs(b["cash_discount"] - expected_cash) < 0.05

        # taxable = subtotal_after_loyalty - voucher - cash
        expected_taxable = round(b["subtotal_after_loyalty"] - b.get("voucher_discount", 0) - b["cash_discount"], 2)
        assert abs(b["taxable_value"] - expected_taxable) < 0.05

        # GST computed on taxable_value (NOT on raw subtotal). Agarbattis
        # now taxed at 5% per product catalog (Bakhoor remains 18%).
        GST_RATE = 5
        expected_gst = round(b["taxable_value"] * GST_RATE / 100, 2)
        assert abs(b["gst_total"] - expected_gst) < 0.5, (
            f"gst_total={b['gst_total']} expected≈{expected_gst} (on taxable_value, not subtotal)"
        )

        # Sanity: gst on raw subtotal at same rate should still differ from final
        gst_on_subtotal = round(subtotal * GST_RATE / 100, 2)
        assert abs(b["gst_total"] - gst_on_subtotal) > 0.2, (
            "gst_total appears to be computed on raw subtotal — regression!"
        )


# ------------------------------------------------------------ Admin Reports: Top retailers
class TestTopRetailers:
    def test_unauth_returns_401(self):
        r = requests.get(f"{API}/admin/b2b/reports/top-retailers", timeout=30)
        assert r.status_code == 401

    def test_quarter_shape(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/top-retailers?period=quarter", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("period", "period_label", "from", "to", "top_retailers"):
            assert k in body
        assert body["period"] == "quarter"
        assert isinstance(body["top_retailers"], list)
        # Each row shape (if any)
        for row in body["top_retailers"]:
            for k in ("retailer_id", "retailer_name", "purchases_total", "order_count",
                      "applied_milestone", "next_milestone", "gap_to_next", "is_close_to_next"):
                assert k in row, f"missing {k} in top retailer row"

    def test_fy_label_format(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/top-retailers?period=fy", timeout=30)
        assert r.status_code == 200
        body = r.json()
        # FY26-27 or similar 5-char numeric
        label = body["period_label"]
        assert label.startswith("FY"), f"got FY label: {label}"
        # should be FY + YY-YY (7 chars total)
        assert len(label) == 7, label


# ------------------------------------------------------------ Admin Sales Report
class TestAdminSalesReport:
    def test_fy_retailer_group_shape(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/sales?period=fy&group_by=retailer", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("period", "period_label", "combined", "breakdown", "group_by"):
            assert k in body
        for k in ("purchases_total", "gst_total", "order_count", "unique_retailer_count"):
            assert k in body["combined"]
        assert body["group_by"] == "retailer"
        # Sorted desc
        totals = [row["purchases_total"] for row in body["breakdown"]]
        assert totals == sorted(totals, reverse=True)

    def test_custom_range_month_grouping(self, admin):
        r = admin.get(
            f"{API}/admin/b2b/reports/sales?period=custom&from_date=2026-04-01&to_date=2026-05-01&group_by=month",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["group_by"] == "month"
        for row in body["breakdown"]:
            # YYYY-MM (7 chars)
            assert len(row["key"]) == 7 and row["key"][4] == "-", f"bad month key {row['key']}"

    def test_custom_without_dates_returns_400(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/sales?period=custom", timeout=30)
        assert r.status_code == 400

    def test_quarter_group_key_format(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/sales?period=fy&group_by=quarter", timeout=30)
        assert r.status_code == 200
        for row in r.json()["breakdown"]:
            # YYYY-Q#
            k = row["key"]
            assert "-Q" in k and k.index("-Q") == 4, f"bad quarter key {k}"

    def test_invalid_group_by_returns_400(self, admin):
        r = admin.get(f"{API}/admin/b2b/reports/sales?period=fy&group_by=weekly", timeout=30)
        assert r.status_code == 400


# ------------------------------------------------------------ Email refactor import check
class TestEmailRefactor:
    def test_import_works_from_services(self):
        from services.b2b_emails import send_b2b_admin_notification_email  # noqa: F401
        assert callable(send_b2b_admin_notification_email)

    def test_b2b_orders_imports_from_services(self):
        # Make sure routers/b2b_orders.py still imports the function (no broken refs)
        import routers.b2b_orders as mod  # noqa: F401
        assert hasattr(mod, "send_b2b_admin_notification_email")
