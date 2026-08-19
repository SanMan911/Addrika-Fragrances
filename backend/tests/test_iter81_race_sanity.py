"""Iter81 sanity check: rapid POST -> PUT -> DELETE on same slug must
leave ZERO rows in Supabase products_mirror (b2c + b2b variants).

Directly reproduces the fire-and-forget race that iteration_80 fixed via
per-entity asyncio.Lock keyed by f'{entity}:{entity_id}' in
services/supabase_sync.py::_run.
"""
from __future__ import annotations

import os
import time
import uuid

import psycopg2
import psycopg2.extras
import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def _sync_pg_url() -> str:
    raw = os.environ["SUPABASE_DB_URL"]
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://"):]
    return raw


def _pg():
    return psycopg2.connect(_sync_pg_url(), connect_timeout=15)


def _fetch_like(pattern: str):
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, channel FROM products_mirror WHERE id LIKE %s",
            (pattern,),
        )
        return cur.fetchall()


def _delete_mirror(pid: str):
    with _pg() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM products_mirror WHERE id = %s", (pid,))


@pytest_asyncio.fixture
async def dbc():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest_asyncio.fixture
async def admin_session(dbc):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"login initiate: {r.status_code} {r.text}"
    token_id = r.json()["token_id"]
    row = await dbc.admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    assert row and row.get("otp"), "OTP not stored"
    r = s.post(f"{BASE_URL}/api/admin/login/verify-otp",
               json={"token_id": token_id, "otp": row["otp"]}, timeout=30)
    assert r.status_code == 200, f"verify: {r.status_code} {r.text}"
    token = r.json().get("session_token")
    if token:
        s.cookies.set("session_token", token)
    return s


@pytest.mark.asyncio
async def test_rapid_post_put_delete_no_mirror_leak(admin_session, dbc):
    """Rapid POST -> PUT -> DELETE must not leave any orphan mirror rows."""
    suffix = uuid.uuid4().hex[:8]
    # Name must slugify to include 'race' + suffix so we can pattern-match
    name = f"race {suffix}"
    slug = f"race-{suffix}"
    ids_to_check = [slug, f"{slug}-50g-b2b", f"{slug}-200g-b2b"]

    payload = {
        "name": name,
        "tagline": "race sanity",
        "type": "agarbatti",
        "category": "agarbatti",
        "description": "race",
        "notes": [],
        "image": "https://example.com/x.png",
        "sizes": [
            {"size": "50g",  "mrp": 150, "price": 150, "opening_stock": 20, "images": []},
            {"size": "200g", "mrp": 400, "price": 400, "opening_stock": 8,  "images": []},
        ],
        "isActive": True,
    }
    update_payload = {
        **payload,
        "sizes": [
            {"size": "50g",  "mrp": 160, "price": 160, "opening_stock": 25, "images": []},
            {"size": "200g", "mrp": 420, "price": 420, "opening_stock": 10, "images": []},
        ],
    }

    try:
        # POST
        r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        # PUT immediately (no wait — trigger race)
        r = admin_session.put(f"{BASE_URL}/api/admin/products/{slug}", json=update_payload, timeout=30)
        assert r.status_code == 200, r.text
        # DELETE immediately
        r = admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
        assert r.status_code == 200, r.text

        # Wait 6s for fire-and-forget tasks to settle
        time.sleep(6)

        remaining = _fetch_like(f"{slug}%")
        assert remaining == [], f"race leaked mirror rows: {remaining}"

        # Mongo also clean
        assert await dbc.products.count_documents({"id": slug}) == 0
        assert await dbc.b2b_products.count_documents({"product_id": slug}) == 0

    finally:
        await dbc.products.delete_many({"id": slug})
        await dbc.b2b_products.delete_many({"product_id": slug})
        for pid in ids_to_check:
            try:
                _delete_mirror(pid)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_rapid_race_across_multiple_slugs(admin_session, dbc):
    """Repeat 3 independent POST->PUT->DELETE cycles to increase race chance."""
    slugs = []
    try:
        for _ in range(3):
            suffix = uuid.uuid4().hex[:8]
            name = f"race m {suffix}"
            slug = f"race-m-{suffix}"
            slugs.append(slug)
            payload = {
                "name": name,
                "tagline": "race sanity M",
                "type": "agarbatti",
                "category": "agarbatti",
                "description": "race",
                "notes": [],
                "image": "https://example.com/x.png",
                "sizes": [
                    {"size": "50g",  "mrp": 150, "price": 150, "opening_stock": 20, "images": []},
                    {"size": "200g", "mrp": 400, "price": 400, "opening_stock": 8,  "images": []},
                ],
                "isActive": True,
            }
            r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
            assert r.status_code == 200, r.text
            update_payload = {**payload}
            r = admin_session.put(f"{BASE_URL}/api/admin/products/{slug}", json=update_payload, timeout=30)
            assert r.status_code == 200, r.text
            r = admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
            assert r.status_code == 200, r.text

        time.sleep(4)

        for slug in slugs:
            remaining = _fetch_like(f"{slug}%")
            assert remaining == [], f"race leaked for {slug}: {remaining}"
    finally:
        for slug in slugs:
            await dbc.products.delete_many({"id": slug})
            await dbc.b2b_products.delete_many({"product_id": slug})
            for pid in (slug, f"{slug}-50g-b2b", f"{slug}-200g-b2b"):
                try:
                    _delete_mirror(pid)
                except Exception:
                    pass
