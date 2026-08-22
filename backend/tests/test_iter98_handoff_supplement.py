"""
Iter 98 supplementary backend tests (T1 review).

Covers surface NOT already asserted by tests/test_iter97_auth_handoff.py:
  * raw Set-Cookie header assertions on the retailer consume branch
    (`retailer_session` present, `session_token` absent)
  * /api/retailer-auth/login negative paths (wrong password, unknown user,
    legacy `{identifier, password}` body shape used by the web context)
  * /api/retailer-auth/me accepts both cookie and Bearer
  * /api/auth/login (customer) happy + 401 path
  * Iter 96 regression: mirror_order_snapshot importable
  * /track-order 308 redirect baked into the Next routes-manifest
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from services.auth_service import hash_password  # noqa: E402

BASE_URL = "http://localhost:8001"
FRONTEND_URL = "http://localhost:3000"


def _db_client():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def retailer():
    rid = f"RTL_T1_{uuid.uuid4().hex[:8]}"
    email = f"t1_{uuid.uuid4().hex[:8]}@e2e.test"
    password = "T1Retailer@123"

    async def seed():
        c = _db_client()
        db = c[os.environ["DB_NAME"]]
        await db.admin_settings.update_one({"_id": "singleton"}, {"$set": {"b2b_enabled": True}}, upsert=True)
        await db.retailers.insert_one({
            "retailer_id": rid, "email": email, "username": rid.lower(),
            "name": "T1 Retailer", "phone": "9876500011",
            "password_hash": hash_password(password), "status": "active",
            "city": "Delhi", "district": "Central Delhi", "state": "Delhi",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        c.close()

    asyncio.run(seed())
    r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"retailer login failed: {r.text}"
    yield {"retailer_id": rid, "email": email, "password": password, "token": r.json()["token"]}

    async def clean():
        c = _db_client()
        db = c[os.environ["DB_NAME"]]
        await db.retailers.delete_one({"retailer_id": rid})
        await db.retailer_sessions.delete_many({"retailer_id": rid})
        await db.auth_handoffs.delete_many({"retailer_id": rid})
        c.close()

    asyncio.run(clean())


@pytest.fixture(scope="module")
def customer():
    uid = f"user_t1_{uuid.uuid4().hex[:8]}"
    email = f"t1cust_{uuid.uuid4().hex[:8]}@e2e.test"
    password = "T1Customer@123"

    async def seed():
        c = _db_client()
        db = c[os.environ["DB_NAME"]]
        await db.users.insert_one({
            "user_id": uid, "email": email, "username": uid, "name": "T1 Customer",
            "phone": "9876500012", "country_code": "+91",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc), "auth_provider": "local",
            "email_verified": True,
        })
        c.close()

    asyncio.run(seed())
    yield {"user_id": uid, "email": email, "password": password}

    async def clean():
        c = _db_client()
        db = c[os.environ["DB_NAME"]]
        await db.users.delete_one({"user_id": uid})
        await db.user_sessions.delete_many({"user_id": uid})
        await db.auth_handoffs.delete_many({"user_id": uid})
        c.close()

    asyncio.run(clean())


# --------------------------------------------------------------------------
# Retailer login endpoint
# --------------------------------------------------------------------------
class TestRetailerLogin:
    def test_login_ok_returns_token_and_retailer(self, retailer):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"email": retailer["email"], "password": retailer["password"]}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["token"], str) and body["token"]
        assert body["retailer"]["retailer_id"] == retailer["retailer_id"]
        assert body["retailer"]["email"] == retailer["email"]
        assert "password_hash" not in json.dumps(body)
        # Mongo ObjectId must never leak (substring check would hit `retailer_id`)
        assert "_id" not in body["retailer"]
        assert "retailer_session" in r.headers.get("set-cookie", "")

    def test_login_wrong_password_401(self, retailer):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"email": retailer["email"], "password": "nope"}, timeout=15)
        assert r.status_code == 401

    def test_login_unknown_email_401(self):
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"email": "nobody_t1@e2e.test", "password": "x"}, timeout=15)
        assert r.status_code == 401

    def test_legacy_identifier_body_is_rejected(self, retailer):
        """The web RetailerAuthContext sends {identifier, password}. Document
        that this shape is NOT accepted by /api/retailer-auth/login."""
        r = requests.post(f"{BASE_URL}/api/retailer-auth/login",
                          json={"identifier": retailer["email"], "password": retailer["password"]}, timeout=15)
        assert r.status_code == 400

    def test_web_context_path_does_not_exist(self):
        """BUG: frontend-next/context/RetailerAuthContext.js posts to
        /api/retailer/login which is not a registered route."""
        r = requests.post(f"{BASE_URL}/api/retailer/login",
                          json={"identifier": "x@y.z", "password": "x"}, timeout=15)
        assert r.status_code == 404

    def test_me_accepts_cookie_and_bearer(self, retailer):
        tok = retailer["token"]
        by_cookie = requests.get(f"{BASE_URL}/api/retailer-auth/me",
                                 headers={"Cookie": f"retailer_session={tok}"}, timeout=15)
        by_bearer = requests.get(f"{BASE_URL}/api/retailer-auth/me",
                                 headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert by_cookie.status_code == 200
        assert by_bearer.status_code == 200
        assert by_cookie.json()["retailer"]["retailer_id"] == retailer["retailer_id"]

    def test_me_without_session_401(self):
        assert requests.get(f"{BASE_URL}/api/retailer-auth/me", timeout=15).status_code == 401


# --------------------------------------------------------------------------
# Customer login endpoint
# --------------------------------------------------------------------------
class TestCustomerLogin:
    def test_login_ok(self, customer):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": customer["email"], "password": customer["password"]}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["session_token"].startswith("sess_")
        assert body["user"]["email"] == customer["email"]

    def test_login_wrong_password_401(self, customer):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": customer["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401


# --------------------------------------------------------------------------
# Handoff — raw Set-Cookie assertions
# --------------------------------------------------------------------------
class TestHandoffCookies:
    def test_retailer_consume_sets_only_retailer_cookie(self, retailer):
        mint = requests.post(f"{BASE_URL}/api/auth/handoff/create",
                             headers={"Authorization": f"Bearer {retailer['token']}"}, timeout=15)
        assert mint.status_code == 200
        assert mint.json()["kind"] == "retailer"
        nonce = mint.json()["handoff_token"]

        r = requests.post(f"{BASE_URL}/api/auth/handoff/consume",
                          json={"handoff_token": nonce}, timeout=15)
        assert r.status_code == 200
        raw = "; ".join(r.raw.headers.get_all("Set-Cookie")) if hasattr(r.raw.headers, "get_all") else r.headers.get("set-cookie", "")
        assert "retailer_session=" in raw
        assert "session_token=" not in raw
        assert "HttpOnly" in raw
        body = r.json()
        assert body["kind"] == "retailer"
        assert body["retailer"]["retailer_id"] == retailer["retailer_id"]
        assert body["token"]
        # session must be usable
        me = requests.get(f"{BASE_URL}/api/retailer-auth/me",
                          headers={"Cookie": f"retailer_session={body['token']}"}, timeout=15)
        assert me.status_code == 200

    def test_customer_consume_sets_session_token_cookie(self, customer):
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"identifier": customer["email"], "password": customer["password"]}, timeout=15)
        tok = login.json()["session_token"]
        mint = requests.post(f"{BASE_URL}/api/auth/handoff/create",
                             headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert mint.status_code == 200
        assert mint.json()["kind"] == "customer"
        nonce = mint.json()["handoff_token"]

        r = requests.post(f"{BASE_URL}/api/auth/handoff/consume",
                          json={"handoff_token": nonce}, timeout=15)
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "")
        assert "session_token=" in raw
        assert "retailer_session=" not in raw
        assert r.json()["kind"] == "customer"
        assert r.json()["user"]["email"] == customer["email"]

    def test_create_unauthenticated_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/handoff/create",
                          headers={"Authorization": "Bearer garbage_token"}, timeout=15)
        assert r.status_code == 401

    @pytest.mark.parametrize("bad", ["", "sess_abc", "random", "hoff", "hoff_", "hoff_" + "0" * 32])
    def test_malformed_nonce_rejected(self, bad):
        r = requests.post(f"{BASE_URL}/api/auth/handoff/consume",
                          json={"handoff_token": bad}, timeout=15)
        assert r.status_code in (400, 401)


# --------------------------------------------------------------------------
# Iter 96 / mirror regressions
# --------------------------------------------------------------------------
class TestPriorIterationRegressions:
    def test_mirror_order_snapshot_importable(self):
        from services import supabase_sync
        assert callable(supabase_sync.mirror_order_snapshot)

    def test_auth_handoffs_blocklisted(self):
        from services import supabase_sync
        assert "auth_handoffs" in supabase_sync._MIRROR_BLOCKLIST

    def test_track_order_redirects_308(self):
        r = requests.get(f"{FRONTEND_URL}/track-order", allow_redirects=False, timeout=15)
        assert r.status_code == 308
        assert r.headers["location"] == "https://www.centraders.com/track-order"
