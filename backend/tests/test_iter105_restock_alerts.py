"""Iteration 105 — Low-stock / Notify-Me expansion + Restock-alert approval flow."""
import os
import sys
import time
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aaroviah-retail.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
TEST_EMAIL = f"iter105_{int(time.time())}@centraders.com"

sys.path.insert(0, "/app/backend")


def run_async(func):
    """Create motor client + run coro inside a brand-new event loop.

    `func` is a callable that receives `db` and returns a coroutine.
    """
    async def _wrapper():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            return await func(client[DB_NAME])
        finally:
            client.close()
    return asyncio.run(_wrapper())


def adjust_stock_sync(product_id, delta, reason="restock"):
    async def _run(db):
        from services.b2b_inventory import adjust_stock
        b2b = await db.b2b_products.find_one({"product_id": product_id})
        assert b2b, f"No B2B row for {product_id}"
        return await adjust_stock(db, product_id=b2b["id"], delta_pieces=delta, reason=reason, admin_email="iter105_test")
    return run_async(_run)


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=15)
    assert r.status_code == 200, f"initiate failed: {r.status_code} {r.text}"
    token_id = r.json()["token_id"]

    async def fetch_otp(db):
        for _ in range(12):
            row = await db.admin_2fa_tokens.find_one({"token_id": token_id})
            if row and row.get("otp"):
                return row["otp"]
            await asyncio.sleep(0.5)
        return None

    otp = run_async(fetch_otp)
    assert otp, "No OTP found for admin login"
    r2 = s.post(f"{BASE_URL}/api/admin/login/verify-otp",
                json={"token_id": token_id, "otp": otp}, timeout=15)
    assert r2.status_code == 200, f"verify failed: {r2.status_code} {r2.text}"
    return s


# ---------- Notify-Me endpoint expansion ----------
class TestNotifyMe:
    def test_out_of_stock_now_accepted(self):
        r = requests.post(f"{BASE_URL}/api/notify-me",
                          json={"email": TEST_EMAIL, "product_id": "kesar-chandan"}, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"

    def test_in_stock_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/notify-me",
                          json={"email": TEST_EMAIL, "product_id": "bold-bakhoor"}, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "already available" in r.json().get("detail", "").lower()

    def test_unknown_product_404(self):
        r = requests.post(f"{BASE_URL}/api/notify-me",
                          json={"email": TEST_EMAIL, "product_id": "no-such-product-xyz"}, timeout=15)
        assert r.status_code == 404

    def test_zzz_cleanup(self):
        async def _run(db):
            await db.notify_me.delete_many({"email": TEST_EMAIL})
        run_async(_run)


# ---------- Admin restock-alerts auth ----------
class TestRestockAlertsAuth:
    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        assert r.status_code == 401

    def test_approve_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/restock-alerts/FAKE-ID/approve", timeout=15)
        assert r.status_code == 401

    def test_dismiss_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/restock-alerts/FAKE-ID/dismiss", timeout=15)
        assert r.status_code == 401


# ---------- Admin restock-alerts list ----------
class TestRestockAlertsList:
    def test_list_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "pending" in body and "history" in body
        assert isinstance(body["pending"], list)
        assert isinstance(body["history"], list)


# ---------- Dismiss lifecycle (regal-rose) ----------
class TestRestockAlertDismiss:
    PRODUCT_ID = "regal-rose"
    state = {}

    def test_01_seed(self):
        async def _run(db):
            b2b = await db.b2b_products.find_one({"product_id": self.PRODUCT_ID}, {"_id": 0})
            return b2b
        b2b = run_async(_run)
        assert b2b, "regal-rose missing"
        self.state["b2b_id"] = b2b["id"]
        self.state["original_stock"] = int(b2b.get("stock_pieces") or 0)
        # clear any orphan pending alert so we can assert count == 1
        async def _clear(db):
            await db.restock_alerts.delete_many({"product_id": self.PRODUCT_ID, "status": "pending"})
        run_async(_clear)

        self.state["email"] = f"iter105_regal_{int(time.time())}@centraders.com"
        r = requests.post(f"{BASE_URL}/api/notify-me",
                          json={"email": self.state["email"], "product_id": self.PRODUCT_ID}, timeout=15)
        assert r.status_code == 200, r.text

    def test_02_restock_creates_pending(self, admin_session):
        # ensure it's 0 first
        async def _reset(db):
            await db.b2b_products.update_one(
                {"id": self.state["b2b_id"]}, {"$set": {"stock_pieces": 0}}
            )
        run_async(_reset)
        adjust_stock_sync(self.PRODUCT_ID, 20, reason="restock")
        time.sleep(1.0)
        r = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        pending = [a for a in r.json()["pending"] if a["product_id"] == self.PRODUCT_ID]
        assert len(pending) == 1, f"expected 1 pending, got {len(pending)}"
        assert pending[0]["pending_recipients"] >= 1
        self.state["alert_id"] = pending[0]["id"]

    def test_03_second_restock_no_duplicate(self, admin_session):
        adjust_stock_sync(self.PRODUCT_ID, 5, reason="restock")
        time.sleep(0.5)
        r = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        pending = [a for a in r.json()["pending"] if a["product_id"] == self.PRODUCT_ID]
        assert len(pending) == 1

    def test_04_dismiss(self, admin_session):
        aid = self.state["alert_id"]
        r = admin_session.post(f"{BASE_URL}/api/admin/restock-alerts/{aid}/dismiss", timeout=15)
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        found = [a for a in r2.json()["history"] if a["id"] == aid]
        assert found and found[0]["status"] == "dismissed"

    def test_05_dismiss_non_pending_404(self, admin_session):
        aid = self.state["alert_id"]
        r = admin_session.post(f"{BASE_URL}/api/admin/restock-alerts/{aid}/dismiss", timeout=15)
        assert r.status_code == 404

    def test_zz_cleanup(self):
        async def _run(db):
            await db.b2b_products.update_one(
                {"id": self.state["b2b_id"]},
                {"$set": {"stock_pieces": self.state["original_stock"]}},
            )
            await db.notify_me.delete_many({"email": self.state["email"]})
        run_async(_run)


# ---------- Approve lifecycle (oriental-oudh) ----------
class TestRestockAlertApprove:
    PRODUCT_ID = "oriental-oudh"
    state = {}

    def test_01_seed(self):
        async def _run(db):
            return await db.b2b_products.find_one({"product_id": self.PRODUCT_ID}, {"_id": 0})
        b2b = run_async(_run)
        assert b2b, "oriental-oudh missing"
        self.state["b2b_id"] = b2b["id"]
        self.state["original_stock"] = int(b2b.get("stock_pieces") or 0)
        async def _clear(db):
            await db.restock_alerts.delete_many({"product_id": self.PRODUCT_ID, "status": "pending"})
        run_async(_clear)
        self.state["email"] = f"iter105_oud_{int(time.time())}@centraders.com"
        r = requests.post(f"{BASE_URL}/api/notify-me",
                          json={"email": self.state["email"], "product_id": self.PRODUCT_ID}, timeout=15)
        assert r.status_code == 200, r.text

    def test_02_restock_and_approve(self, admin_session):
        async def _reset(db):
            await db.b2b_products.update_one(
                {"id": self.state["b2b_id"]}, {"$set": {"stock_pieces": 0}}
            )
        run_async(_reset)
        adjust_stock_sync(self.PRODUCT_ID, 15, reason="restock")
        time.sleep(1.0)
        r = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        matches = [a for a in r.json()["pending"] if a["product_id"] == self.PRODUCT_ID]
        assert matches, "no pending alert"
        aid = matches[0]["id"]
        self.state["alert_id"] = aid

        r2 = admin_session.post(f"{BASE_URL}/api/admin/restock-alerts/{aid}/approve", timeout=45)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert "sent" in body and "failed" in body
        assert body["sent"] + body["failed"] >= 1

        r3 = admin_session.get(f"{BASE_URL}/api/admin/restock-alerts", timeout=15)
        found = [a for a in r3.json()["history"] if a["id"] == aid]
        assert found and found[0]["status"] == "sent"

    def test_03_reapprove_400(self, admin_session):
        aid = self.state["alert_id"]
        r = admin_session.post(f"{BASE_URL}/api/admin/restock-alerts/{aid}/approve", timeout=15)
        assert r.status_code == 400
        assert "already" in r.json().get("detail", "").lower()

    def test_04_notified_at_stamped(self):
        async def _run(db):
            return await db.notify_me.find_one(
                {"email": self.state["email"], "product_id": self.PRODUCT_ID}, {"_id": 0}
            )
        row = run_async(_run)
        assert row and row.get("notified_at"), f"notified_at missing: {row}"

    def test_zz_cleanup(self):
        async def _run(db):
            await db.b2b_products.update_one(
                {"id": self.state["b2b_id"]},
                {"$set": {"stock_pieces": self.state["original_stock"]}},
            )
            await db.notify_me.delete_many({"email": self.state["email"]})
        run_async(_run)


# ---------- Newsletter (/api/subscribe) ----------
class TestNewsletter:
    NL_EMAIL = f"iter105_nl_{int(time.time())}@centraders.com"

    def test_subscribe_success(self):
        r = requests.post(f"{BASE_URL}/api/subscribe",
                          json={"email": self.NL_EMAIL}, timeout=15)
        assert r.status_code in (200, 201), r.text

    def test_resubscribe_still_ok(self):
        r = requests.post(f"{BASE_URL}/api/subscribe",
                          json={"email": self.NL_EMAIL}, timeout=15)
        assert r.status_code in (200, 201), r.text

    def test_appears_in_admin_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/subscribers", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        emails = []
        if isinstance(body, list):
            emails = [row.get("email") for row in body]
        elif isinstance(body, dict) and "subscribers" in body:
            emails = [row.get("email") for row in body["subscribers"]]
        assert self.NL_EMAIL.lower() in [e.lower() for e in emails if e]

    def test_zz_cleanup(self):
        async def _run(db):
            await db.subscribers.delete_many({"email": self.NL_EMAIL.lower()})
        run_async(_run)


# ---------- Products endpoint stock states for the D2C grid ----------
class TestProductStockStates:
    def test_stock_shape(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        by_id = {p["id"]: p for p in products}
        for pid in ("royal-kewda", "bold-bakhoor", "kesar-chandan", "bilvapatra-fragrance"):
            assert pid in by_id, f"missing product {pid}"

        rk_stock = sum(int(s.get("stock") or 0) for s in by_id["royal-kewda"].get("sizes") or [])
        assert 0 < rk_stock <= 12, f"royal-kewda expected 1..12, got {rk_stock}"

        bb_stock = sum(int(s.get("stock") or 0) for s in by_id["bold-bakhoor"].get("sizes") or [])
        assert bb_stock > 12, f"bold-bakhoor expected >12, got {bb_stock}"

        kc_stock = sum(int(s.get("stock") or 0) for s in by_id["kesar-chandan"].get("sizes") or [])
        assert kc_stock == 0, f"kesar-chandan expected 0, got {kc_stock}"

        assert by_id["bilvapatra-fragrance"].get("comingSoon") is True
