"""
Tests for the mobile → web session-handoff endpoints.

Flow:
  1. Register + login a customer → get session_token
  2. POST /api/auth/handoff/create (Bearer)   → get handoff_token (60s TTL)
  3. POST /api/auth/handoff/consume            → sets session cookie, returns user

Covers:
  * Bearer-authenticated caller can mint a handoff
  * Unauthenticated caller gets 401 on create
  * Handoff is single-use (second consume returns 401)
  * Expired handoff is rejected
  * Malformed handoff token is rejected
  * `auth_handoffs` collection is in the Supabase mirror blocklist
"""
from __future__ import annotations

import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

BASE_URL = "http://localhost:8001"


def _rand_email() -> str:
    return f"handoff_{uuid.uuid4().hex[:12]}@e2e.test"


@pytest.fixture(scope="module")
def logged_in_customer():
    """Register a fresh customer via the internal test-only bypass, then
    login and return {email, password, session_token}."""
    email = _rand_email()
    password = "Handoff@12345"
    name = "Handoff Tester"
    # Direct-insert path: use the users collection through the seed helper
    # to avoid the OTP flow. If your project doesn't expose one, fall back
    # to the register-with-otp path — but for these tests we rely on the
    # /api/auth/create-test-user endpoint if present, else the OTP-less path.
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    import os as _os
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")

    async def _seed():
        client = AsyncIOMotorClient(_os.environ["MONGO_URL"])
        db = client[_os.environ["DB_NAME"]]
        from services.auth_service import hash_password
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "username": user_id,
            "name": name,
            "phone": "9876500000",
            "country_code": "+91",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc),
            "auth_provider": "local",
            "email_verified": True,
        })
        client.close()
        return user_id

    user_id = asyncio.run(_seed())

    # Now login
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": email, "password": password},
        timeout=10,
    )
    assert r.status_code == 200, f"login failed: {r.text}"
    data = r.json()
    session_token = data["session_token"]
    yield {"email": email, "password": password, "user_id": user_id, "session_token": session_token}

    # Cleanup
    async def _cleanup():
        client = AsyncIOMotorClient(_os.environ["MONGO_URL"])
        db = client[_os.environ["DB_NAME"]]
        await db.users.delete_one({"user_id": user_id})
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.auth_handoffs.delete_many({"user_id": user_id})
        client.close()
    asyncio.run(_cleanup())


def test_handoff_create_requires_auth():
    r = requests.post(f"{BASE_URL}/api/auth/handoff/create", timeout=10)
    assert r.status_code == 401


def test_handoff_create_and_consume_happy_path(logged_in_customer):
    token = logged_in_customer["session_token"]
    r = requests.post(
        f"{BASE_URL}/api/auth/handoff/create",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["handoff_token"].startswith("hoff_")
    assert body["expires_in"] == 60

    # Consume
    r2 = requests.post(
        f"{BASE_URL}/api/auth/handoff/consume",
        json={"handoff_token": body["handoff_token"]},
        timeout=10,
    )
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["user"]["email"] == logged_in_customer["email"]
    assert data["session_token"].startswith("sess_")
    # Cookie must be set for the web domain
    assert "session_token" in r2.cookies


def test_handoff_is_single_use(logged_in_customer):
    token = logged_in_customer["session_token"]
    minted = requests.post(
        f"{BASE_URL}/api/auth/handoff/create",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    ).json()
    ho = minted["handoff_token"]

    r1 = requests.post(
        f"{BASE_URL}/api/auth/handoff/consume",
        json={"handoff_token": ho},
        timeout=10,
    )
    assert r1.status_code == 200

    # Second consume of the same nonce is rejected
    r2 = requests.post(
        f"{BASE_URL}/api/auth/handoff/consume",
        json={"handoff_token": ho},
        timeout=10,
    )
    assert r2.status_code == 401
    assert "already used" in r2.json()["detail"].lower() or "invalid" in r2.json()["detail"].lower()


def test_handoff_rejects_malformed_token():
    for bad in ["", "sess_abc", "random_string", "hoff", "hoff_"]:
        r = requests.post(
            f"{BASE_URL}/api/auth/handoff/consume",
            json={"handoff_token": bad},
            timeout=10,
        )
        # Empty / non-hoff prefix → 400; unknown hoff_ → 401
        assert r.status_code in (400, 401), f"{bad!r} returned {r.status_code}"


def test_handoff_rejects_expired_nonce(logged_in_customer):
    """Manually poison expires_at into the past and confirm consume 401s."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    import os as _os
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")

    token = logged_in_customer["session_token"]
    minted = requests.post(
        f"{BASE_URL}/api/auth/handoff/create",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    ).json()
    ho = minted["handoff_token"]

    async def _expire():
        client = AsyncIOMotorClient(_os.environ["MONGO_URL"])
        db = client[_os.environ["DB_NAME"]]
        await db.auth_handoffs.update_one(
            {"handoff_token": ho},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
        )
        client.close()
    asyncio.run(_expire())

    r = requests.post(
        f"{BASE_URL}/api/auth/handoff/consume",
        json={"handoff_token": ho},
        timeout=10,
    )
    assert r.status_code == 401


def test_auth_handoffs_is_supabase_mirror_blocklisted():
    """The nonce collection must NEVER travel to Supabase."""
    from services import supabase_sync
    assert "auth_handoffs" in supabase_sync._MIRROR_BLOCKLIST
