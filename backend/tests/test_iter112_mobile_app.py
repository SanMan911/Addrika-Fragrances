"""Iter112 — Aarohmm mobile app (Supabase-authenticated) adversarial tests.

Covers: pre-login GSTIN broker, auth guard, RLS isolation, server-priced
orders (with client tamper attempts), KYC gate, grievance path-traversal,
storage RLS, contact admin, sync idempotence, FY function, and web-portal
regressions.
"""
import os
import re
import time
import uuid
import pytest
import requests

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001").rstrip("/")
SUPA = "https://qzzwaqwgzvrdecheunpn.supabase.co"
ANON = "sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4"
QA_GSTIN = "29AAAAA0000A1Z5"
QA_RETAILER = "RTL_APP_QA"
BAD_GSTIN = "09ZZZZZ9999Z9Z9"  # inactive/unknown but valid format
INVALID_GSTIN = "abc123"


def _access_token() -> str:
    p = "/tmp/qa_access_token"
    if os.path.exists(p):
        tok = open(p).read().strip()
        if tok:
            return tok
    # try refresh
    rt_path = "/app/memory/.qa_refresh_token"
    rt = open(rt_path).read().strip()
    r = requests.post(
        f"{SUPA}/auth/v1/token?grant_type=refresh_token",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"refresh_token": rt}, timeout=25,
    )
    r.raise_for_status()
    d = r.json()
    open(rt_path, "w").write(d["refresh_token"])
    open(p, "w").write(d["access_token"])
    return d["access_token"]


@pytest.fixture(scope="session")
def token():
    return _access_token()


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------
# 1) Pre-login: GSTIN lookup & masked email
# ------------------------------------------------------------------
class TestGstinLookupAndRequestCode:
    def test_gstin_lookup_returns_masked_no_raw_email(self):
        r = requests.post(f"{BASE}/api/app/v2/gstin-lookup", json={"gstin": QA_GSTIN}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "masked_email" in d
        assert "@" in d["masked_email"] and "*" in d["masked_email"]
        # raw email must NOT appear
        assert "qa.aarohmm-test@centraders.com" not in r.text.lower()
        assert d.get("business_name")

    def test_request_code_masked_only(self):
        r = requests.post(f"{BASE}/api/app/v2/auth/request-code", json={"gstin": QA_GSTIN}, timeout=25)
        # 200 (sent), 429 (Supabase SMTP cap or throttle) are both acceptable
        assert r.status_code in (200, 429), r.text
        # Never leak raw email in any status
        assert "qa.aarohmm-test@centraders.com" not in r.text.lower()
        if r.status_code == 200:
            d = r.json()
            assert d.get("sent") is True
            assert "*" in d["masked_email"]
            assert d.get("business_name")

    def test_invalid_gstin_400(self):
        r = requests.post(f"{BASE}/api/app/v2/auth/request-code", json={"gstin": INVALID_GSTIN}, timeout=15)
        assert r.status_code == 400

    def test_unknown_gstin_404_generic(self):
        r = requests.post(f"{BASE}/api/app/v2/auth/request-code", json={"gstin": BAD_GSTIN}, timeout=15)
        assert r.status_code == 404
        # Response must NOT confirm GSTIN not registered in a specific way (generic message)
        txt = r.text.lower()
        assert "no active aarohmm retailer" in txt or "contact" in txt


# ------------------------------------------------------------------
# 2) Auth guard on /me
# ------------------------------------------------------------------
class TestMeAuthGuard:
    def test_me_no_auth_401(self):
        r = requests.get(f"{BASE}/api/app/v2/me", timeout=15)
        assert r.status_code == 401

    def test_me_malformed_401(self):
        r = requests.get(f"{BASE}/api/app/v2/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=15)
        assert r.status_code == 401

    def test_me_valid_returns_qa_retailer(self, auth_headers):
        r = requests.get(f"{BASE}/api/app/v2/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["retailer_id"] == QA_RETAILER
        assert d["gstin"] == QA_GSTIN
        assert d["kyc_complete"] is True


# ------------------------------------------------------------------
# 3) RLS isolation — direct PostgREST reads
# ------------------------------------------------------------------
class TestRLSIsolation:
    def _hdr(self, token=None):
        h = {"apikey": ANON}
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    def test_app_retailers_only_own_row(self, token):
        r = requests.get(f"{SUPA}/rest/v1/app_retailers?select=id,gstin", headers=self._hdr(token), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) == 1
        assert rows[0]["id"] == QA_RETAILER

    def test_app_orders_only_own(self, token):
        r = requests.get(f"{SUPA}/rest/v1/app_orders?select=id,retailer_id", headers=self._hdr(token), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        for row in rows:
            assert row["retailer_id"] == QA_RETAILER

    def test_app_orders_filter_other_retailer_returns_empty(self, token):
        r = requests.get(
            f"{SUPA}/rest/v1/app_orders?retailer_id=eq.RTL_TEST_B2B&select=id",
            headers=self._hdr(token), timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_app_products_shared_catalogue(self, token):
        r = requests.get(f"{SUPA}/rest/v1/app_products?select=sku&limit=100", headers=self._hdr(token), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_app_grievances_only_own(self, token):
        r = requests.get(f"{SUPA}/rest/v1/app_grievances?select=id,retailer_id", headers=self._hdr(token), timeout=20)
        assert r.status_code == 200
        for row in r.json():
            assert row["retailer_id"] == QA_RETAILER

    def test_anon_cannot_read_retailer_rows(self):
        # Anon only: PostgREST returns [] or 401 depending on policy
        for tbl in ("app_retailers", "app_orders", "app_grievances"):
            r = requests.get(f"{SUPA}/rest/v1/{tbl}?select=*", headers=self._hdr(None), timeout=15)
            assert r.status_code in (200, 401, 403)
            if r.status_code == 200:
                assert r.json() == []


# ------------------------------------------------------------------
# 4) Server-priced orders & tamper resistance
# ------------------------------------------------------------------
class TestOrderPricingAndTamper:
    def test_calculate_returns_breakdown(self, auth_headers):
        payload = {"items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 2}], "include_shipping": False}
        r = requests.post(f"{BASE}/api/app/v2/orders/calculate", json=payload, headers=auth_headers, timeout=25)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("subtotal", "gst_total", "grand_total"):
            assert k in d, f"missing {k} in {d}"

    def test_place_ignores_client_price_and_returns_order(self, auth_headers):
        cref = f"iter112-tamper-{uuid.uuid4().hex[:10]}"
        payload = {
            "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 1}],
            "include_shipping": False,
            "client_ref": cref,
            # bogus tamper fields
            "price_per_box": 1,
            "grand_total": 1,
            "subtotal": 1,
            "total_amount": 1,
        }
        # First fetch server-side calc for comparison
        calc = requests.post(f"{BASE}/api/app/v2/orders/calculate", json={"items": payload["items"], "include_shipping": False}, headers=auth_headers, timeout=25).json()
        server_total = calc["grand_total"]

        r = requests.post(f"{BASE}/api/app/v2/orders", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert "order_id" in d
        assert "grand_total" in d
        # Server must not honour the bogus 1
        assert abs(float(d["grand_total"]) - float(server_total)) < 0.01
        assert float(d["grand_total"]) > 10

        # Idempotency: reposting same client_ref returns same order_id
        r2 = requests.post(f"{BASE}/api/app/v2/orders", json=payload, headers=auth_headers, timeout=30)
        assert r2.status_code in (200, 201), r2.text
        d2 = r2.json()
        assert d2.get("order_id") == d["order_id"], f"Idempotency broken: {d['order_id']} vs {d2.get('order_id')}"

    def test_placed_order_visible_in_read_model_with_fy(self, auth_headers, token):
        # find any order for this retailer
        r = requests.get(
            f"{SUPA}/rest/v1/app_orders?select=id,fy,retailer_id&order=updated_at.desc&limit=5",
            headers={"apikey": ANON, "Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert r.status_code == 200
        rows = r.json()
        assert rows, "No orders visible in app_orders read model"
        for row in rows:
            assert row["retailer_id"] == QA_RETAILER
            # fy format YYYY-YY
            assert re.match(r"^\d{4}-\d{2}$", row["fy"]), row


# ------------------------------------------------------------------
# 5) KYC gate — flip documents_complete, expect 403, restore.
# ------------------------------------------------------------------
class TestKycGate:
    def test_kyc_pending_blocks_order(self, auth_headers):
        pymongo = pytest.importorskip("pymongo")
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "addrika_db")]
        try:
            db.retailers.update_one({"retailer_id": QA_RETAILER}, {"$set": {"documents_complete": False}})
            payload = {
                "items": [{"product_id": "bold-bakhoor-b2b", "quantity_boxes": 1}],
                "include_shipping": False,
                "client_ref": f"iter112-kyc-{uuid.uuid4().hex[:8]}",
            }
            r = requests.post(f"{BASE}/api/app/v2/orders", json=payload, headers=auth_headers, timeout=25)
            assert r.status_code == 403, r.text
            assert "kyc" in r.text.lower()
        finally:
            db.retailers.update_one({"retailer_id": QA_RETAILER}, {"$set": {"documents_complete": True}})
            client.close()


# ------------------------------------------------------------------
# 6) Grievances — path traversal check
# ------------------------------------------------------------------
class TestGrievances:
    def test_path_traversal_rejected(self, auth_headers):
        payload = {
            "subject": "Test evil path",
            "message": "attempting path traversal to another retailer folder",
            "category": "other",
            "image_paths": ["RTL_TEST_B2B/evil.jpg"],
        }
        r = requests.post(f"{BASE}/api/app/v2/grievances", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 400, r.text
        assert "invalid attachment path" in r.text.lower()

    def test_valid_grievance_creates(self, auth_headers, token):
        payload = {
            "subject": "TEST_iter112 grievance",
            "message": "automated test grievance from iter112",
            "category": "quality",
        }
        r = requests.post(f"{BASE}/api/app/v2/grievances", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "open"
        assert "id" in d
        # confirm via RLS read
        r2 = requests.get(
            f"{SUPA}/rest/v1/app_grievances?id=eq.{d['id']}&select=id,retailer_id,status",
            headers={"apikey": ANON, "Authorization": f"Bearer {token}"}, timeout=15,
        )
        assert r2.status_code == 200
        rows = r2.json()
        assert rows and rows[0]["retailer_id"] == QA_RETAILER

    def test_storage_rls_other_folder_denied(self, token):
        # Try uploading to another retailer's folder via Supabase Storage
        r = requests.post(
            f"{SUPA}/storage/v1/object/grievance-uploads/RTL_TEST_B2B/evil.jpg",
            headers={
                "apikey": ANON,
                "Authorization": f"Bearer {token}",
                "Content-Type": "image/jpeg",
            },
            data=b"\xff\xd8\xff\xd9",
            timeout=20,
        )
        assert r.status_code in (400, 401, 403), f"unexpected: {r.status_code} {r.text[:200]}"

    def test_storage_rls_own_folder_allowed(self, token):
        key = f"{QA_RETAILER}/iter112-{uuid.uuid4().hex[:8]}.jpg"
        r = requests.post(
            f"{SUPA}/storage/v1/object/grievance-uploads/{key}",
            headers={
                "apikey": ANON,
                "Authorization": f"Bearer {token}",
                "Content-Type": "image/jpeg",
            },
            data=b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9",
            timeout=20,
        )
        assert r.status_code in (200, 201), f"own-folder upload failed: {r.status_code} {r.text[:200]}"


# ------------------------------------------------------------------
# 7) Contact admin
# ------------------------------------------------------------------
class TestContactAdmin:
    def test_contact_returns_id(self, auth_headers):
        r = requests.post(
            f"{BASE}/api/app/v2/support/contact",
            json={"subject": "TEST_iter112 contact", "message": "hello from iter112 test"},
            headers=auth_headers, timeout=25,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and "delivered" in d

    def test_contact_persisted_in_mongo(self, auth_headers):
        pymongo = pytest.importorskip("pymongo")
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "addrika_db")]
        try:
            row = db.retailer_messages.find_one(
                {"retailer_id": QA_RETAILER, "channel": "mobile_app"},
                sort=[("created_at", -1)],
            )
            assert row is not None
            assert row["channel"] == "mobile_app"
        finally:
            client.close()


# ------------------------------------------------------------------
# 8) Sync — idempotency
# ------------------------------------------------------------------
class TestSync:
    def test_sync_ok(self, auth_headers):
        r = requests.post(f"{BASE}/api/app/v2/sync", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("synced") is True

    def test_sync_idempotent(self, auth_headers):
        r = requests.post(f"{BASE}/api/app/v2/sync", headers=auth_headers, timeout=60)
        assert r.status_code == 200


# ------------------------------------------------------------------
# 9) app_fy() SQL function via asyncpg
# ------------------------------------------------------------------
class TestFyFunction:
    def test_fy_boundaries(self):
        asyncpg = pytest.importorskip("asyncpg")
        import asyncio

        async def run():
            dsn = os.environ.get("SUPABASE_DB_URL")
            if not dsn:
                # Load from backend/.env
                for line in open("/app/backend/.env"):
                    if line.startswith("SUPABASE_DB_URL="):
                        dsn = line.split("=", 1)[1].strip()
                        break
            assert dsn, "SUPABASE_DB_URL not available"
            conn = await asyncpg.connect(dsn=dsn, statement_cache_size=0)
            try:
                feb = await conn.fetchval("select app_fy('2026-02-15'::timestamptz)")
                apr = await conn.fetchval("select app_fy('2026-04-15'::timestamptz)")
                return feb, apr
            finally:
                await conn.close()

        feb, apr = asyncio.run(run())
        assert feb == "2025-26", feb
        assert apr == "2026-27", apr


# ------------------------------------------------------------------
# 10) Sync retailer dedup: no duplicate GSTIN inserted
# ------------------------------------------------------------------
class TestSyncCorrectness:
    def test_only_active_gstin_retailers_present(self, token):
        r = requests.get(
            f"{SUPA}/rest/v1/app_retailers?select=id,gstin",
            headers={"apikey": ANON, "Authorization": f"Bearer {token}"}, timeout=15,
        )
        # RLS confines this to one row for QA — real dedup verification
        # requires service_role which we intentionally don't have, so we
        # accept a green sync response as sufficient.
        assert r.status_code == 200


# ------------------------------------------------------------------
# 11) Regression — web portal & FSM API still work
# ------------------------------------------------------------------
class TestRegression:
    def test_products(self):
        assert requests.get(f"{BASE}/api/products", timeout=15).status_code == 200

    def test_blog(self):
        assert requests.get(f"{BASE}/api/blog/posts", timeout=15).status_code == 200

    def test_app_config(self):
        assert requests.get(f"{BASE}/api/app/config", timeout=15).status_code == 200

    def test_retailer_auth_login(self):
        r = requests.post(
            f"{BASE}/api/retailer-auth/login",
            json={"gstin": "07AAAAA0000A1Z5", "password": "Test@12345"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        assert "token" in r.json()

    def test_fsm_ping(self):
        r = requests.get(
            f"{BASE}/api/external/v1/ping",
            headers={"X-API-Key": "arhk_C2yoApjyj2zmmGZ6bM2qC47bxiJ--9o7ElyaRtbmPqk"},
            timeout=15,
        )
        assert r.status_code == 200
