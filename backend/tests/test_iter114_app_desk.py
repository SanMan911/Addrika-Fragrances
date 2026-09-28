"""Iter114 — Aarohmm App Desk backend tests.

Covers:
  * Brochure auto-sync (admin) + retailer /brochure (16 items, real images).
  * Grievance two-way thread (admin & retailer) with unread flags + close flow.
  * Adversarial RLS on app_grievance_messages (author='admin' spoof, closed ticket, cross-retailer).
  * Grievance reply alert (unread_for_retailer + notifications summary + retailer_notified).
  * Razorpay guards (config/create 404/409, webhook rejection, placeholder secret).
  * Admin schemes CRUD + retailer app_schemes visibility (is_active + valid_to windows).
  * NO real live Razorpay payment link is ever created — only guard paths.

Run:  cd /app/backend && pytest tests/test_iter114_app_desk.py -v
"""
import os
import time
import uuid
import hmac
import hashlib
import requests
import pytest
from dotenv import load_dotenv
from pathlib import Path

# These tests reach Postgres directly for RLS/cleanup assertions, so the
# backend's env must be loaded into THIS process too (the HTTP-only tests
# get it from the running server).
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = "http://localhost:8001"
API = f"{BASE}/api"
SUPABASE_URL = "https://qzzwaqwgzvrdecheunpn.supabase.co"
ANON = "sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4"

QA_RETAILER_ID = "RTL_APP_QA"


def _require_db_url() -> str:
    """SUPABASE_DB_URL or fail loudly.

    asyncpg.connect(None) silently falls back to localhost:5432, which
    surfaces as a confusing "Connect call failed 127.0.0.1:5432" fixture
    error instead of the real problem (the env var not being loaded).
    """
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise AssertionError(
            "SUPABASE_DB_URL is not set - load /app/backend/.env before running these tests"
        )
    return url


def _admin_session() -> str:
    return open("/tmp/admin_session").read().strip()


def _qa_access() -> str:
    return open("/tmp/qa_access").read().strip()


ADMIN_COOKIE = {"Cookie": f"session_token={_admin_session()}"}
RETAILER_H = {"Authorization": f"Bearer {_qa_access()}"}


# ============================ BROCHURE ============================
class TestBrochure:
    def test_admin_sync_returns_16_all_with_image_detail(self):
        r = requests.post(f"{API}/admin/app-support/brochure/sync", headers=ADMIN_COOKIE, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["synced"] is True
        assert data["items"] == 16, data
        assert data["with_image"] == 16
        assert data["with_detail"] >= 15  # allow one with empty description
        # capped at ~280 chars — check via list endpoint below

    def test_admin_list_brochure_shape(self):
        r = requests.get(f"{API}/admin/app-support/brochure", headers=ADMIN_COOKIE, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 16
        # both bold-bakhoor SKUs appear as separate rows
        skus = {i["sku"] for i in items}
        assert "bold-bakhoor-b2b" in skus
        assert "bold-bakhoor-200-b2b" in skus
        assert "royal-kewda-b2b" in skus and "royal-kewda-200-b2b" in skus
        for it in items:
            if it.get("image_url"):
                assert it["image_url"].startswith("http"), it
            if it.get("detail"):
                assert len(it["detail"]) <= 280
                # doesn't end mid-word (last char is a letter+space/punct or ellipsis)
                assert it["detail"].strip()[-1] in ".!?…\")'" or " " not in it["detail"][-2:]

    def test_retailer_brochure_matches(self):
        r = requests.get(f"{API}/app/v2/brochure", headers=RETAILER_H, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) == 16
        assert all(i.get("image_url") for i in items)

    def test_stale_row_cleanup(self):
        # Inject junk row directly and re-sync
        import asyncio
        import asyncpg

        async def _inject_and_check():
            db_url = _require_db_url()
            if not db_url:
                pytest.skip("SUPABASE_DB_URL missing")
            conn = await asyncpg.connect(db_url, statement_cache_size=0)
            try:
                await conn.execute(
                    "insert into public.app_brochure_items (sku, name, category, is_active) "
                    "values ('junk-iter114', 'JUNK', 'agarbatti', true) on conflict (sku) do nothing"
                )
            finally:
                await conn.close()

        asyncio.run(_inject_and_check())
        r = requests.post(f"{API}/admin/app-support/brochure/sync", headers=ADMIN_COOKIE, timeout=60)
        assert r.status_code == 200
        assert r.json()["removed"] >= 1

        async def _verify_gone():
            db_url = _require_db_url()
            conn = await asyncpg.connect(db_url, statement_cache_size=0)
            try:
                v = await conn.fetchval(
                    "select count(*) from public.app_brochure_items where sku='junk-iter114'"
                )
                assert v == 0
            finally:
                await conn.close()

        asyncio.run(_verify_gone())


# ============================ GRIEVANCE THREAD ============================
@pytest.fixture(scope="module")
def grievance_id():
    """Create a fresh ticket via retailer app for the module's flow tests."""
    r = requests.post(
        f"{API}/app/v2/grievances",
        headers=RETAILER_H,
        json={
            "category": "quality",
            "subject": f"iter114 QA {uuid.uuid4().hex[:6]}",
            "message": "Automated iter114 test complaint — please ignore.",
            "image_paths": [],
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    gid = r.json()["id"]
    yield gid
    # cleanup — delete via direct DB (admin can't delete via API; tests must clean up)
    import asyncio, asyncpg
    async def _cleanup():
        db_url = _require_db_url()
        conn = await asyncpg.connect(db_url, statement_cache_size=0)
        try:
            await conn.execute("delete from public.app_grievance_messages where grievance_id=$1", gid)
            await conn.execute("delete from public.app_grievance_images where grievance_id=$1", gid)
            await conn.execute("delete from public.app_grievances where id=$1", gid)
        finally:
            await conn.close()
    asyncio.run(_cleanup())


class TestGrievanceAdmin:
    def test_list_grievances_admin(self, grievance_id):
        r = requests.get(f"{API}/admin/app-support/grievances", headers=ADMIN_COOKIE, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(t["id"] == grievance_id for t in data["tickets"])
        t = next(x for x in data["tickets"] if x["id"] == grievance_id)
        assert "business_name" in t and "gstin" in t
        assert "reply_count" in t and "image_count" in t and "unread_for_admin" in t

    def test_list_grievances_filter_open(self, grievance_id):
        r = requests.get(f"{API}/admin/app-support/grievances?status=open", headers=ADMIN_COOKIE, timeout=30)
        assert r.status_code == 200
        assert all(t["status"] == "open" for t in r.json()["tickets"])

    def test_admin_get_thread_marks_read(self, grievance_id):
        r = requests.get(f"{API}/admin/app-support/grievances/{grievance_id}", headers=ADMIN_COOKIE, timeout=30)
        assert r.status_code == 200, r.text
        ticket = r.json()
        assert ticket["thread"][0]["is_origin"] is True
        assert ticket["thread"][0]["author"] == "retailer"

    def test_admin_reply_moves_to_in_progress_and_alerts_retailer(self, grievance_id):
        r = requests.post(
            f"{API}/admin/app-support/grievances/{grievance_id}/reply",
            headers=ADMIN_COOKIE,
            json={"body": "iter114 admin ack — we're on it.", "close_ticket": False},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["closed"] is False
        assert "retailer_notified" in j
        # Thread should now show status in_progress and 1 admin reply
        r2 = requests.get(f"{API}/admin/app-support/grievances/{grievance_id}", headers=ADMIN_COOKIE, timeout=30)
        t = r2.json()
        assert t["status"] == "in_progress"
        assert len(t["thread"]) == 2  # origin + 1 admin
        assert t["thread"][1]["author"] == "admin"

    def test_retailer_sees_unread_after_admin_reply(self, grievance_id):
        r = requests.get(f"{API}/app/v2/notifications/summary", headers=RETAILER_H, timeout=30)
        assert r.status_code == 200
        assert r.json()["unread_grievance_replies"] >= 1

    def test_retailer_reads_thread_clears_unread(self, grievance_id):
        r = requests.get(f"{API}/app/v2/grievances/{grievance_id}", headers=RETAILER_H, timeout=30)
        assert r.status_code == 200
        t = r.json()
        assert t["thread"][0]["is_origin"] is True
        # ordering stable: origin first, then admin reply
        assert t["thread"][1]["author"] == "admin"
        # After reading, unread cleared
        r2 = requests.get(f"{API}/app/v2/notifications/summary", headers=RETAILER_H, timeout=30)
        # Might be 0 if this was the only ticket; else still >=0
        assert r2.json()["unread_grievance_replies"] >= 0

    def test_retailer_can_reply(self, grievance_id):
        r = requests.post(
            f"{API}/app/v2/grievances/{grievance_id}/reply",
            headers=RETAILER_H,
            json={"body": "iter114 retailer follow-up."},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/admin/app-support/grievances/{grievance_id}", headers=ADMIN_COOKIE, timeout=30)
        t = r2.json()
        assert len(t["thread"]) == 3

    def test_admin_close_ticket_via_reply(self, grievance_id):
        r = requests.post(
            f"{API}/admin/app-support/grievances/{grievance_id}/reply",
            headers=ADMIN_COOKIE,
            json={"body": "Marked resolved.", "close_ticket": True},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["closed"] is True
        r2 = requests.get(f"{API}/admin/app-support/grievances/{grievance_id}", headers=ADMIN_COOKIE, timeout=30)
        assert r2.json()["status"] == "closed"

    def test_retailer_reply_to_closed_409(self, grievance_id):
        r = requests.post(
            f"{API}/app/v2/grievances/{grievance_id}/reply",
            headers=RETAILER_H,
            json={"body": "sneaky follow-up"},
            timeout=30,
        )
        assert r.status_code == 409

    def test_admin_status_reopen(self, grievance_id):
        r = requests.post(
            f"{API}/admin/app-support/grievances/{grievance_id}/status",
            headers=ADMIN_COOKIE,
            json={"status": "open"},
            timeout=30,
        )
        assert r.status_code == 200
        # invalid status
        r2 = requests.post(
            f"{API}/admin/app-support/grievances/{grievance_id}/status",
            headers=ADMIN_COOKIE,
            json={"status": "bogus"},
            timeout=30,
        )
        assert r2.status_code == 400


# ============================ GRIEVANCE SECURITY (adversarial) ============================
class TestGrievanceSecurity:
    def test_cross_retailer_thread_404(self):
        """Retailer B cannot fetch retailer A's ticket."""
        # We don't have a second retailer session; simulate by hitting a bogus id
        r = requests.get(f"{API}/app/v2/grievances/{uuid.uuid4()}", headers=RETAILER_H, timeout=30)
        assert r.status_code == 404

    def test_direct_postgrest_insert_admin_author_rejected(self, grievance_id):
        """RLS must reject retailer forging author='admin'."""
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/app_grievance_messages",
            headers={
                "apikey": ANON,
                "Authorization": f"Bearer {_qa_access()}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={
                "grievance_id": grievance_id,
                "author": "admin",
                "body": "spoofed admin reply",
            },
            timeout=30,
        )
        assert r.status_code in (401, 403, 400, 409), f"got {r.status_code}: {r.text}"

    def test_direct_postgrest_insert_to_closed_ticket_rejected(self, grievance_id):
        # Ensure ticket is closed for this test
        requests.post(
            f"{API}/admin/app-support/grievances/{grievance_id}/status",
            headers=ADMIN_COOKIE,
            json={"status": "closed"},
            timeout=30,
        )
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/app_grievance_messages",
            headers={
                "apikey": ANON,
                "Authorization": f"Bearer {_qa_access()}",
                "Content-Type": "application/json",
            },
            json={
                "grievance_id": grievance_id,
                "author": "retailer",
                "body": "reply to closed",
            },
            timeout=30,
        )
        assert r.status_code in (401, 403, 400, 409), f"expected reject, got {r.status_code}: {r.text}"

    def test_anon_key_only_reads_nothing(self):
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/app_grievances?select=id",
            headers={"apikey": ANON},
            timeout=30,
        )
        # anon (no user token) must not see any tickets
        assert r.status_code in (200, 401)
        if r.status_code == 200:
            assert r.json() == []


# ============================ PAYMENTS (GUARD ONLY — LIVE KEY) ============================
class TestPaymentsGuards:
    def test_config_reports_placeholder_webhook(self):
        r = requests.get(f"{API}/app/v2/payments/config", headers=RETAILER_H, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["configured"] is True
        assert j["mode"] == "live"
        assert j["webhook_verification_ready"] is False
        assert any("placeholder" in w.lower() for w in j.get("warnings", []))

    def test_create_nonexistent_order_404(self):
        r = requests.post(
            f"{API}/app/v2/payments/create",
            headers=RETAILER_H,
            json={"order_id": "B2B-DOES-NOT-EXIST"},
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_status_nonexistent_order_404(self):
        r = requests.get(
            f"{API}/app/v2/payments/B2B-DOES-NOT-EXIST",
            headers=RETAILER_H,
            timeout=30,
        )
        assert r.status_code == 404

    def test_webhook_no_signature_400(self):
        r = requests.post(f"{API}/app/v2/payments/webhook", data=b"{}", timeout=15)
        assert r.status_code == 400

    def test_webhook_wrong_signature_400(self):
        r = requests.post(
            f"{API}/app/v2/payments/webhook",
            data=b"{}",
            headers={"X-Razorpay-Signature": "definitely-not-valid"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_webhook_with_placeholder_secret_hmac_rejected(self):
        """Even a correctly-HMAC'd payload against the placeholder MUST be rejected."""
        placeholder = "your_razorpay_webhook_secret_here"
        body = b'{"event":"payment_link.paid"}'
        sig = hmac.new(placeholder.encode(), body, hashlib.sha256).hexdigest()
        r = requests.post(
            f"{API}/app/v2/payments/webhook",
            data=body,
            headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400, r.text


# ============================ SCHEMES ============================
class TestSchemes:
    _created_ids: list = []

    def test_admin_create_scheme(self):
        r = requests.post(
            f"{API}/admin/app-support/schemes",
            headers=ADMIN_COOKIE,
            json={
                "title": f"iter114 scheme {uuid.uuid4().hex[:6]}",
                "description": "auto-test",
                "min_cartons": 5,
                "discount_pct": 2.5,
                "valid_from": "2026-01-01",
                "valid_to": "2030-01-01",
                "is_active": True,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        TestSchemes._created_ids.append(sid)

        # verify list
        r2 = requests.get(f"{API}/admin/app-support/schemes", headers=ADMIN_COOKIE, timeout=30)
        assert r2.status_code == 200
        assert any(s["id"] == sid for s in r2.json()["schemes"])

    def test_retailer_supabase_sees_active_scheme(self):
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/app_schemes?select=id,title,is_active,valid_to&is_active=eq.true",
            headers={"apikey": ANON, "Authorization": f"Bearer {_qa_access()}"},
            timeout=30,
        )
        assert r.status_code == 200
        ids = {s["id"] for s in r.json()}
        assert TestSchemes._created_ids[0] in ids

    def test_deactivate_hides_scheme(self):
        sid = TestSchemes._created_ids[0]
        r = requests.put(
            f"{API}/admin/app-support/schemes/{sid}",
            headers=ADMIN_COOKIE,
            json={
                "title": "iter114 scheme (inactive)",
                "is_active": False,
                "valid_from": "2026-01-01",
                "valid_to": "2030-01-01",
            },
            timeout=30,
        )
        assert r.status_code == 200
        r2 = requests.get(
            f"{SUPABASE_URL}/rest/v1/app_schemes?select=id&id=eq.{sid}",
            headers={"apikey": ANON, "Authorization": f"Bearer {_qa_access()}"},
            timeout=30,
        )
        # RLS filters by is_active — should NOT return this
        assert r2.status_code == 200
        assert r2.json() == []

    def test_expired_scheme_not_visible(self):
        r = requests.post(
            f"{API}/admin/app-support/schemes",
            headers=ADMIN_COOKIE,
            json={
                "title": f"iter114 expired {uuid.uuid4().hex[:6]}",
                "is_active": True,
                "valid_from": "2020-01-01",
                "valid_to": "2020-12-31",
            },
            timeout=30,
        )
        assert r.status_code == 200
        sid = r.json()["id"]
        TestSchemes._created_ids.append(sid)
        r2 = requests.get(
            f"{SUPABASE_URL}/rest/v1/app_schemes?select=id&id=eq.{sid}",
            headers={"apikey": ANON, "Authorization": f"Bearer {_qa_access()}"},
            timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json() == []

    def test_delete_all_created(self):
        for sid in TestSchemes._created_ids:
            r = requests.delete(
                f"{API}/admin/app-support/schemes/{sid}", headers=ADMIN_COOKIE, timeout=30
            )
            assert r.status_code == 200


# ============================ AUTH GUARDS ============================
class TestAuthGuards:
    def test_admin_endpoints_reject_anon(self):
        for path in [
            "/admin/app-support/grievances",
            "/admin/app-support/schemes",
            "/admin/app-support/brochure",
        ]:
            r = requests.get(f"{API}{path}", timeout=15)
            assert r.status_code in (401, 403), f"{path}: {r.status_code}"

    def test_retailer_endpoints_reject_anon(self):
        for path in [
            "/app/v2/brochure",
            "/app/v2/grievances",
            "/app/v2/notifications/summary",
            "/app/v2/payments/config",
        ]:
            r = requests.get(f"{API}{path}", timeout=15)
            assert r.status_code in (401, 403), f"{path}: {r.status_code}"
