"""Iteration 102 backend audit: AAROHMM rename, external API, admin B2B, D2C+B2B flows, handoff rate limit."""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE = "https://aaroviah-retail.preview.emergentagent.com"
API = f"{BASE}/api"
EXT = f"{API}/external/v1"
API_KEY = "arhk_C2yoApjyj2zmmGZ6bM2qC47bxiJ--9o7ElyaRtbmPqk"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")


@pytest.fixture(scope="session")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def retailer_cookie():
    r = requests.post(f"{API}/retailer-auth/login",
                      json={"email": "test_b2b_retailer@example.com", "password": "Test@12345"},
                      timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return f"retailer_session={tok}"


@pytest.fixture(scope="session")
def admin_session(db):
    ini = requests.post(f"{API}/admin/login/initiate",
                        json={"email": "contact.us@centraders.com", "pin": "050499"},
                        timeout=15)
    assert ini.status_code == 200, ini.text
    token_id = ini.json()["token_id"]
    time.sleep(1)
    rec = db.admin_2fa_tokens.find_one({"token_id": token_id})
    assert rec, "OTP not in DB"
    otp = rec["otp"]
    v = requests.post(f"{API}/admin/login/verify-otp",
                      json={"token_id": token_id, "otp": otp}, timeout=15)
    assert v.status_code == 200, v.text
    tok = v.json().get("session_token") or v.cookies.get("session_token")
    assert tok
    return f"session_token={tok}"


# ============ RENAME (backend) ============
class TestRenameBackend:
    def test_app_config_brand(self):
        r = requests.get(f"{API}/app/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        b = d.get("brand", {})
        assert b.get("name") == "AAROHMM", b
        assert "Where Fragrance Becomes Atmosphere" in b.get("tagline", "")
        assert b.get("logo_url", "").endswith("aarohmm-emblem-gold.png"), b.get("logo_url")
        assert "aarohmm.fragrances" in d.get("social", {}).get("instagram", "")
        assert d.get("deep_link_scheme") == "aaroviah"

    def test_blog_no_addrika(self):
        r = requests.get(f"{API}/blog/posts", timeout=10)
        assert r.status_code == 200
        assert "Addrika" not in r.text, "Blog contains 'Addrika'"


# ============ B2B RETAILER FLOW ============
class TestB2BRetailer:
    def test_catalog(self, retailer_cookie):
        r = requests.get(f"{API}/retailer-dashboard/b2b/catalog",
                         headers={"Cookie": retailer_cookie}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        prods = d.get("products", [])
        assert len(prods) == 16, f"Expected 16, got {len(prods)}"
        bb = next((p for p in prods if p.get("id") == "bold-bakhoor-b2b"), None)
        assert bb, "bold-bakhoor-b2b missing"
        assert bb.get("stock_pieces") == 100, bb.get("stock_pieces")
        assert bb.get("stock_status_display", {}).get("is_orderable") is True

    def test_place_web_order_and_verify_stock(self, retailer_cookie):
        # place
        r = requests.post(f"{API}/retailer-dashboard/b2b/order",
                          headers={"Cookie": retailer_cookie, "Content-Type": "application/json"},
                          json={"items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 0.5}]},
                          timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("payment_method") == "credit"
        assert d.get("stock_reserved") is True
        order_id = d.get("order_id")
        assert order_id

        # verify stock dropped by 6 (0.5 * 12)
        s = requests.get(f"{EXT}/stock/bold-bakhoor-b2b",
                         headers={"X-API-Key": API_KEY}, timeout=10)
        assert s.status_code == 200, s.text
        stock = s.json()
        # accept either shape
        pieces = stock.get("stock_pieces") if isinstance(stock, dict) else None
        if pieces is None and isinstance(stock, dict):
            pieces = stock.get("data", {}).get("stock_pieces")
        assert pieces == 94, f"expected 94, got {pieces}"

        # cancel to restore
        c = requests.post(f"{EXT}/orders/{order_id}/cancel",
                          headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
                          json={"reason": "test cleanup"}, timeout=15)
        assert c.status_code in (200, 201), c.text
        time.sleep(0.5)
        s2 = requests.get(f"{EXT}/stock/bold-bakhoor-b2b",
                          headers={"X-API-Key": API_KEY}, timeout=10)
        assert s2.status_code == 200
        p2 = s2.json().get("stock_pieces")
        assert p2 == 100, f"stock not restored: {p2}"


# ============ EXTERNAL API (FSM) ============
class TestExternalAPI:
    H = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

    def test_ping(self):
        r = requests.get(f"{EXT}/ping", headers=self.H, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        scopes = d.get("scopes", [])
        assert len(scopes) == 5, scopes

    def test_missing_key(self):
        r = requests.get(f"{EXT}/ping", timeout=10)
        assert r.status_code == 401

    def test_retailers_search(self):
        r = requests.get(f"{EXT}/retailers?q=test", headers=self.H, timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        arr = j.get("items") or j.get("retailers") or (j if isinstance(j, list) else [])
        ids = [x.get("retailer_id") for x in arr]
        assert "RTL_TEST_B2B" in ids, ids

    def test_catalog_orderable(self):
        r = requests.get(f"{EXT}/catalog?orderable_only=true", headers=self.H, timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        prods = j.get("items") or j.get("products") or (j if isinstance(j, list) else [])
        pids = [p.get("id") or p.get("product_id") for p in prods]
        assert pids == ["bold-bakhoor-b2b"], pids

    def test_orders_preview(self):
        r = requests.post(f"{EXT}/orders/preview", headers=self.H,
                          json={"retailer_id": "RTL_TEST_B2B",
                                "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 1}]},
                          timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        gt = d.get("grand_total") or d.get("totals", {}).get("grand_total")
        assert gt == 1060.5, f"grand_total={gt}"

    def test_fsm_order_lifecycle(self):
        client_ref = f"QA-{uuid.uuid4().hex[:10]}"
        body = {
            "retailer_id": "RTL_TEST_B2B",
            "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 1}],
            "payment_mode": "pay_later",
            "placed_by": {"name": "QA Rep"},
            "client_ref": client_ref,
        }
        r = requests.post(f"{EXT}/orders", headers=self.H, json=body, timeout=15)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        order = d.get("order", d)
        order_id = d.get("order_id") or order.get("order_id")
        assert order_id
        assert order.get("channel") == "fsm"
        assert d.get("stock_reserved") is True or order.get("stock_reserved") is True

        # stock dropped by 12
        s = requests.get(f"{EXT}/stock/bold-bakhoor-b2b", headers=self.H, timeout=10).json()
        assert s.get("stock_pieces") == 88, s

        # idempotency
        r2 = requests.post(f"{EXT}/orders", headers=self.H, json=body, timeout=15)
        assert r2.status_code in (200, 201), r2.text
        assert r2.json().get("order_id") == order_id

        # list
        lst = requests.get(f"{EXT}/orders?channel=fsm", headers=self.H, timeout=10)
        assert lst.status_code == 200
        # get
        g = requests.get(f"{EXT}/orders/{order_id}", headers=self.H, timeout=10)
        assert g.status_code == 200
        ps = g.json().get("payment_status")
        assert ps in ("pending", "unpaid"), ps

        # cancel
        c = requests.post(f"{EXT}/orders/{order_id}/cancel", headers=self.H,
                         json={"reason": "qa"}, timeout=10)
        assert c.status_code in (200, 201), c.text
        # idempotent
        c2 = requests.post(f"{EXT}/orders/{order_id}/cancel", headers=self.H,
                           json={"reason": "qa"}, timeout=10)
        assert c2.status_code in (200, 201, 409), c2.text

        # stock restored
        s2 = requests.get(f"{EXT}/stock/bold-bakhoor-b2b", headers=self.H, timeout=10).json()
        assert s2.get("stock_pieces") == 100, s2

    def test_fractional_lt_half_rejected(self):
        r = requests.post(f"{EXT}/orders", headers=self.H,
                          json={"retailer_id": "RTL_TEST_B2B",
                                "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 0.3}],
                                "payment_mode": "pay_later",
                                "placed_by": {"name": "QA"}, "client_ref": f"QA-{uuid.uuid4().hex[:8]}"},
                          timeout=10)
        assert r.status_code == 400, r.text

    def test_oos_rejected(self):
        r = requests.post(f"{EXT}/orders", headers=self.H,
                          json={"retailer_id": "RTL_TEST_B2B",
                                "items": [{"product_id": "kesar-chandan-b2b", "quantity_boxes": 1}],
                                "payment_mode": "pay_later",
                                "placed_by": {"name": "QA"}, "client_ref": f"QA-{uuid.uuid4().hex[:8]}"},
                          timeout=10)
        assert r.status_code == 400, r.text

    def test_razorpay_link_null(self):
        client_ref = f"QA-RZP-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{EXT}/orders", headers=self.H,
                          json={"retailer_id": "RTL_TEST_B2B",
                                "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 0.5}],
                                "payment_mode": "razorpay_link",
                                "placed_by": {"name": "QA"}, "client_ref": client_ref},
                          timeout=15)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        order_id = d.get("order_id")
        assert d.get("payment_link_url") in (None, ""), d.get("payment_link_url")
        # cancel to restore
        requests.post(f"{EXT}/orders/{order_id}/cancel", headers=self.H, json={"reason":"qa"}, timeout=10)


# ============ D2C ============
class TestD2C:
    def test_oos_line_returns_409(self):
        r = requests.post(f"{API}/orders/create",
                          json={"sessionId": f"s-{uuid.uuid4().hex[:8]}",
                                "billing": {"name": "Test", "email": "t@example.com", "phone": "9999999999",
                                            "address": "123 Test Street", "city": "City", "state": "State", "pincode": "560001"},
                                "items": [{"productId": "kesar-chandan", "size": "50g", "quantity": 1}],
                                "use_different_shipping": False},
                          timeout=15)
        assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text}"
        d = r.json()
        det = d.get("detail", d)
        err = det.get("error") if isinstance(det, dict) else None
        assert err == "out_of_stock", d


# ============ HANDOFF RATE LIMIT ============
class TestHandoffRateLimit:
    def test_5_per_min(self, retailer_cookie):
        statuses = []
        for _ in range(6):
            r = requests.post(f"{API}/auth/handoff/create",
                              headers={"Cookie": retailer_cookie}, timeout=10)
            statuses.append(r.status_code)
            last = r
        assert statuses[:5] == [200]*5, statuses
        assert statuses[5] == 429, statuses
        assert last.headers.get("Retry-After") is not None


# ============ ADMIN B2B ============
class TestAdminB2B:
    def test_list_orders(self, admin_session):
        r = requests.get(f"{API}/admin/b2b/orders",
                         headers={"Cookie": admin_session}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        orders = data.get("orders", data if isinstance(data, list) else [])
        # at least the ones from prior tests, if any
        if orders:
            assert "retailer_name" in orders[0], orders[0]

    def test_mark_paid_no_double_deduct(self, admin_session, retailer_cookie, db):
        # place a fresh credit order
        r = requests.post(f"{API}/retailer-dashboard/b2b/order",
                          headers={"Cookie": retailer_cookie, "Content-Type": "application/json"},
                          json={"items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 0.5}]},
                          timeout=15)
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        # stock now 94
        s = requests.get(f"{EXT}/stock/bold-bakhoor-b2b", headers={"X-API-Key": API_KEY}).json()
        assert s.get("stock_pieces") == 94

        # mark paid
        mp = requests.post(f"{API}/admin/b2b/orders/{order_id}/mark-paid",
                           headers={"Cookie": admin_session, "Content-Type": "application/json"},
                           json={"method": "upi", "reference": "UTR-QA-1"}, timeout=15)
        assert mp.status_code == 200, mp.text

        # stock should still be 94 (no double deduction)
        s2 = requests.get(f"{EXT}/stock/bold-bakhoor-b2b", headers={"X-API-Key": API_KEY}).json()
        assert s2.get("stock_pieces") == 94, f"stock double-deducted: {s2}"

        # inventory log: exactly one order_placed row for this order, no order_paid row
        logs = list(db.b2b_inventory_log.find({"source_order_id": order_id}))
        reasons = [l.get("reason") for l in logs]
        placed = [r for r in reasons if r and "placed" in str(r).lower()]
        paid = [r for r in reasons if r and "paid" in str(r).lower()]
        assert len(placed) == 1, reasons
        assert len(paid) == 0, reasons

        # cancel via admin to restore
        st = requests.put(f"{API}/admin/b2b/orders/{order_id}/status",
                         headers={"Cookie": admin_session, "Content-Type": "application/json"},
                         json={"status": "cancelled", "note": "qa cleanup"}, timeout=15)
        assert st.status_code == 200, st.text
        s3 = requests.get(f"{EXT}/stock/bold-bakhoor-b2b", headers={"X-API-Key": API_KEY}).json()
        # cancelled-after-paid may or may not restore, but a paid order might not restore.
        # We marked paid; if engine does not restore stock on cancel-after-paid, that is correct.
        # Just log the value.
        print("stock after cancel (was marked paid):", s3.get("stock_pieces"))
