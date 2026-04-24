"""
B2B Iteration 61 regression — waitlist, loyalty milestones, bills, messages,
and loyalty-before-cash-discount calculate flow.

Uses admin 2FA, enables the portal, runs verifications, restores portal to
DISABLED at end of session.
"""
import os
import base64
import uuid
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "BACKEND_URL", "https://incense-retailer-hub.preview.emergentagent.com"
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

# 1x1 PNG base64
TINY_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


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
    yield
    # Clean up seeded paid orders so other suites aren't polluted
    try:
        client = MongoClient(MONGO_URL)
        client[DB_NAME]["b2b_orders"].delete_many({"notes": {"$regex": "^TEST_IT61"}})
        client.close()
    except Exception:
        pass
    try:
        admin.put(f"{API}/admin/b2b-settings", json={"enabled": False}, timeout=30)
    except Exception:
        pass


@pytest.fixture(scope="session")
def enabled_portal(admin):
    admin.put(f"{API}/admin/b2b-settings", json={"enabled": True, "cash_discount_percent": 1.5}, timeout=30)
    yield
    # leave enabled for other tests in this session


@pytest.fixture(scope="session")
def retailer_session(enabled_portal):
    s = requests.Session()
    r = s.post(f"{API}/retailer-auth/login", json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"retailer login failed: {r.status_code} {r.text}")
    return s


# ------------------------------------------------------------------ Waitlist
class TestWaitlist:
    def test_missing_body_422(self):
        r = requests.post(f"{API}/retailer-auth/waitlist", json={}, timeout=30)
        assert r.status_code == 422

    def test_valid_upsert_persists(self):
        email = f"pytest_it61_{uuid.uuid4().hex[:6]}@example.com"
        payload = {
            "business_name": "Iter61 Store",
            "contact_name": "Iter61 Bot",
            "email": email,
            "phone": "9999999999",
            "city": "Testville",
            "message": "iteration 61",
        }
        r = requests.post(f"{API}/retailer-auth/waitlist", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        # Upsert: second call same email still 200
        r2 = requests.post(f"{API}/retailer-auth/waitlist", json=payload, timeout=30)
        assert r2.status_code == 200

        client = MongoClient(MONGO_URL)
        doc = client[DB_NAME]["retailer_waitlist"].find_one({"email": email})
        client.close()
        assert doc and doc["business_name"] == "Iter61 Store"

    def test_invalid_gst_returns_400(self):
        r = requests.post(
            f"{API}/retailer-auth/waitlist",
            json={
                "business_name": "GstBad",
                "contact_name": "Tester",
                "email": f"gstbad_{uuid.uuid4().hex[:6]}@example.com",
                "phone": "9999999999",
                "gst_number": "INVALIDGST",
            },
            timeout=30,
        )
        assert r.status_code == 400

    def test_admin_list_and_status_update(self, admin):
        r_unauth = requests.get(f"{API}/admin/b2b-waitlist", timeout=30)
        assert r_unauth.status_code == 401

        r = admin.get(f"{API}/admin/b2b-waitlist", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "status_counts" in body
        for k in ("new", "contacted", "onboarded", "archived"):
            assert k in body["status_counts"]
        assert len(body["items"]) > 0
        sid = body["items"][0]["id"]
        r2 = admin.put(
            f"{API}/admin/b2b-waitlist/{sid}/status",
            json={"status": "contacted"},
            timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "contacted"


# ---------------------------------------------------------------- Loyalty
class TestLoyaltyMilestones:
    def test_defaults_present(self, admin):
        r = admin.get(f"{API}/admin/b2b-loyalty/milestones", timeout=30)
        assert r.status_code == 200
        ms = r.json()["milestones"]
        # Expect the 3 defaults among active
        active = [m for m in ms if m.get("is_active")]
        mins = sorted([float(m["min_purchase"]) for m in active])
        assert 10000.0 in mins and 25000.0 in mins and 50000.0 in mins

    def test_create_update_delete_and_bad_percent(self, admin):
        # Invalid discount > 50
        bad = admin.post(
            f"{API}/admin/b2b-loyalty/milestones",
            json={"min_purchase": 5000, "discount_percent": 99},
            timeout=30,
        )
        assert bad.status_code in (400, 422)

        r = admin.post(
            f"{API}/admin/b2b-loyalty/milestones",
            json={"min_purchase": 70000, "discount_percent": 3.0, "label": "TEST_it61"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        mid = r.json()["milestone"]["id"]

        up = admin.put(
            f"{API}/admin/b2b-loyalty/milestones/{mid}",
            json={"discount_percent": 3.5},
            timeout=30,
        )
        assert up.status_code == 200
        assert up.json()["milestone"]["discount_percent"] == 3.5

        nf = admin.put(
            f"{API}/admin/b2b-loyalty/milestones/nonexistent",
            json={"discount_percent": 1},
            timeout=30,
        )
        assert nf.status_code == 404

        d = admin.delete(f"{API}/admin/b2b-loyalty/milestones/{mid}", timeout=30)
        assert d.status_code == 200
        d2 = admin.delete(f"{API}/admin/b2b-loyalty/milestones/{mid}", timeout=30)
        assert d2.status_code == 404


# ---------------------------------------------------------------- Loyalty dashboard + calculate
class TestLoyaltyCalculate:
    def test_dashboard_shape_zero_purchases(self, retailer_session):
        # Wipe any previous paid orders for this retailer in current quarter to start clean
        client = MongoClient(MONGO_URL)
        client[DB_NAME]["b2b_orders"].delete_many({"retailer_id": RETAILER_ID, "notes": {"$regex": "^TEST_IT61"}})
        client.close()

        r = retailer_session.get(f"{API}/retailer-dashboard/b2b/loyalty", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("quarter_label", "purchases_total", "milestones", "applied_milestone",
                  "next_milestone", "gap_to_next", "progress_percent"):
            assert k in body, f"missing {k} in loyalty response"

    def test_loyalty_applies_before_cash_discount(self, retailer_session):
        # Seed paid order in current quarter >= 10000 to cross first milestone
        client = MongoClient(MONGO_URL)
        now = datetime.now(timezone.utc).isoformat()
        seed_id = f"B2B-SEED-{uuid.uuid4().hex[:8].upper()}"
        client[DB_NAME]["b2b_orders"].insert_one({
            "order_id": seed_id,
            "retailer_id": RETAILER_ID,
            "payment_status": "paid",
            "grand_total": 15000.0,
            "created_at": now,
            "notes": "TEST_IT61_SEED",
        })
        client.close()

        # Calculate WITHOUT cash discount first
        r = retailer_session.post(
            f"{API}/retailer-dashboard/b2b/calculate",
            json={"items": [{"product_id": PRODUCT_ID, "quantity_boxes": 5}], "apply_cash_discount": False},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "loyalty_discount" in body
        assert body.get("loyalty_discount_percent", 0) == 0.5
        assert body["loyalty_discount"] > 0
        assert "subtotal_after_loyalty" in body
        assert body.get("quarter_label")
        assert body.get("loyalty_milestone") is not None
        # loyalty = subtotal * 0.5%
        expected_loyalty = round(body["subtotal"] * 0.5 / 100, 2)
        assert abs(body["loyalty_discount"] - expected_loyalty) < 0.05

        # Calculate WITH cash discount — cash_discount must be from subtotal_after_loyalty
        r2 = retailer_session.post(
            f"{API}/retailer-dashboard/b2b/calculate",
            json={"items": [{"product_id": PRODUCT_ID, "quantity_boxes": 5}], "apply_cash_discount": True},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        expected_cash = round(b2["subtotal_after_loyalty"] * 1.5 / 100, 2)
        assert abs(b2["cash_discount"] - expected_cash) < 0.05, \
            f"cash_discount={b2['cash_discount']} expected={expected_cash} (from subtotal_after_loyalty)"

        # Cleanup seeded order immediately so subsequent suites see a clean quarter
        client = MongoClient(MONGO_URL)
        client[DB_NAME]["b2b_orders"].delete_many({"notes": {"$regex": "^TEST_IT61"}})
        client.close()


# ---------------------------------------------------------------- Bills
class TestBills:
    def test_upload_list_download_with_size_and_type_rules(self, admin, retailer_session):
        # Upload tiny PNG
        r = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills",
            json={
                "title": "TEST_IT61 Bill",
                "amount": 100.0,
                "bill_date": "2026-01-10",
                "file_base64": TINY_PNG,
                "file_name": "tiny.png",
                "file_type": "image/png",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        bill = r.json()["bill"]
        assert "file_base64" not in bill  # stripped in response
        bill_id = bill["bill_id"]

        # Admin list (stripped)
        lst = admin.get(f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills", timeout=30)
        assert lst.status_code == 200
        for b in lst.json()["bills"]:
            assert "file_base64" not in b

        # Admin download (full file)
        dl = admin.get(f"{API}/admin/b2b/bills/{bill_id}/download", timeout=30)
        assert dl.status_code == 200
        assert "file_base64" in dl.json()

        # Retailer list only returns this retailer's bills and strips file_base64
        rlst = retailer_session.get(f"{API}/retailer-dashboard/bills", timeout=30)
        assert rlst.status_code == 200
        items = rlst.json()["bills"]
        assert all(b["retailer_id"] == RETAILER_ID for b in items)
        for b in items:
            assert "file_base64" not in b

        # Invalid type (zip) rejected
        bad = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills",
            json={
                "title": "bad",
                "file_base64": TINY_PNG,
                "file_name": "x.zip",
                "file_type": "application/zip",
            },
            timeout=30,
        )
        assert bad.status_code == 400

        # File > 5MB rejected
        big = base64.b64encode(b"A" * (5 * 1024 * 1024 + 10)).decode()
        oversized = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/bills",
            json={
                "title": "big",
                "file_base64": big,
                "file_name": "big.png",
                "file_type": "image/png",
            },
            timeout=60,
        )
        assert oversized.status_code == 400

        # cleanup
        admin.delete(f"{API}/admin/b2b/bills/{bill_id}/download".replace("/download", ""), timeout=30)


# ---------------------------------------------------------------- Messages
class TestMessages:
    def test_retailer_send_admin_list_thread(self, admin, retailer_session):
        # Retailer sends a message via NEW admin-chat endpoint
        r = retailer_session.post(
            f"{API}/retailer-dashboard/admin-chat",
            json={"message": "TEST_IT61 hello from retailer"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sender_type") == "retailer"
        assert "_id" not in body

        # Retailer lists own messages
        rlist = retailer_session.get(f"{API}/retailer-dashboard/admin-chat", timeout=30)
        assert rlist.status_code == 200, rlist.text
        rmsgs = rlist.json()["messages"]
        assert any("TEST_IT61 hello from retailer" in m.get("message", "") for m in rmsgs)

        # Admin sends back with an attachment
        r2 = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/messages",
            json={
                "message": "TEST_IT61 reply from admin",
                "attachments": [{"file_base64": TINY_PNG, "file_name": "t.png", "file_type": "image/png"}],
            },
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        admin_send_body = r2.json()
        assert "_id" not in admin_send_body

        # Admin listing for this retailer returns attachments WITHOUT file_base64
        lst = admin.get(f"{API}/admin/b2b/retailers/{RETAILER_ID}/messages", timeout=30)
        assert lst.status_code == 200
        msgs = lst.json()["messages"]
        admin_msg = next((m for m in msgs if m.get("sender_type") == "admin" and "TEST_IT61 reply" in m.get("message", "")), None)
        assert admin_msg is not None
        for a in admin_msg.get("attachments", []) or []:
            assert "file_base64" not in a

        # Admin attachment-download returns full base64
        dl = admin.get(f"{API}/admin/b2b/messages/attachment/{admin_msg['id']}/0", timeout=30)
        assert dl.status_code == 200
        assert "file_base64" in dl.json()

        # Threads endpoint: sorted by last_message_at desc with retailer enrichment
        th = admin.get(f"{API}/admin/b2b/threads", timeout=30)
        assert th.status_code == 200
        threads = th.json()["threads"]
        assert len(threads) > 0
        t0 = next((t for t in threads if t.get("retailer_id") == RETAILER_ID), None)
        assert t0 is not None
        assert "retailer_name" in t0 and "retailer_email" in t0
        assert "unread_admin_count" in t0
        # sort desc
        times = [t.get("last_message_at") for t in threads if t.get("last_message_at")]
        assert times == sorted(times, reverse=True)

    def test_invalid_attachment_type_rejected(self, retailer_session):
        r = retailer_session.post(
            f"{API}/retailer-dashboard/admin-chat",
            json={
                "message": "bad attach",
                "attachments": [{"file_base64": TINY_PNG, "file_name": "bad.zip", "file_type": "application/zip"}],
            },
            timeout=30,
        )
        assert r.status_code == 400

    def test_retailer_attachment_download_full_base64(self, admin, retailer_session):
        # Admin sends message with attachment
        r = admin.post(
            f"{API}/admin/b2b/retailers/{RETAILER_ID}/messages",
            json={
                "message": "TEST_IT61 attach test",
                "attachments": [{"file_base64": TINY_PNG, "file_name": "dl.png", "file_type": "image/png"}],
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # Retailer lists (to get message id without file_base64)
        lst = retailer_session.get(f"{API}/retailer-dashboard/admin-chat", timeout=30)
        assert lst.status_code == 200
        msgs = lst.json()["messages"]
        target = next((m for m in msgs if m.get("sender_type") == "admin" and "TEST_IT61 attach test" in m.get("message", "")), None)
        assert target is not None
        # attachments should be stripped of file_base64 in listing
        for a in target.get("attachments", []) or []:
            assert "file_base64" not in a

        # Retailer downloads full attachment
        dl = retailer_session.get(
            f"{API}/retailer-dashboard/admin-chat/attachment/{target['id']}/0", timeout=30
        )
        assert dl.status_code == 200, dl.text
        payload = dl.json()
        assert "file_base64" in payload
        assert payload["file_base64"] == TINY_PNG

    def test_legacy_retailer_to_retailer_messages_not_shadowed(self, retailer_session):
        # POST /retailer-dashboard/messages must still go to legacy handler
        # (expects to_retailer_id + subject). Sending only `message` should 422.
        r = retailer_session.post(
            f"{API}/retailer-dashboard/messages",
            json={"message": "should hit legacy handler"},
            timeout=30,
        )
        assert r.status_code == 422, f"Legacy retailer-to-retailer messages is shadowed! got {r.status_code}: {r.text}"
