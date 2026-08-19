"""Iter80 regression: DELETE /api/admin/products/{id} must cascade
Mongo b2b_products + Supabase products_mirror b2b SKU rows.

Also re-verifies:
- test_iter74_unified_products.py::test_unified_product_create_and_update
  leaves zero rows with name ILIKE '%TEST Iter%' in the mirror.
- All active B2C mirror rows still have non-null price_inr + stock_pieces.
"""
from __future__ import annotations

import os
import subprocess
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


def _fetch_mirror(pid: str):
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM products_mirror WHERE id = %s", (pid,))
        return cur.fetchone()


def _fetch_mirror_like(pattern: str):
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, channel FROM products_mirror WHERE id LIKE %s OR name ILIKE %s",
            (pattern, pattern),
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


# ================== 1. Cascade DELETE regression guard ==================
@pytest.mark.asyncio
async def test_delete_cascades_b2b_products_and_mirror(admin_session, dbc):
    suffix = uuid.uuid4().hex[:8]
    slug = f"test-cascade-{suffix}"
    payload = {
        "name": f"TEST Cascade {suffix}",
        "tagline": "cascade regress",
        "type": "agarbatti",
        "category": "agarbatti",
        "description": "cascade",
        "notes": [],
        "image": "https://example.com/x.png",
        "sizes": [
            {"size": "50g",  "mrp": 150, "price": 150, "opening_stock": 20, "images": []},
            {"size": "200g", "mrp": 400, "price": 400, "opening_stock": 8,  "images": []},
        ],
        "isActive": True,
    }
    b2b_50 = f"{slug}-50g-b2b"
    b2b_200 = f"{slug}-200g-b2b"

    try:
        # CREATE
        r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("b2b_skus_created") == 2

        # Precondition: 2 b2b rows in Mongo
        b2b_count = await dbc.b2b_products.count_documents({"product_id": slug})
        assert b2b_count == 2, f"expected 2 b2b rows pre-delete, got {b2b_count}"

        # Wait for mirror (b2c + 2 b2b SKUs)
        deadline = time.time() + 8
        while time.time() < deadline:
            b2c_row = _fetch_mirror(slug)
            r50 = _fetch_mirror(b2b_50)
            r200 = _fetch_mirror(b2b_200)
            if b2c_row and r50 and r200:
                break
            time.sleep(0.5)
        assert b2c_row is not None, "b2c mirror row missing pre-delete"
        assert r50 is not None, f"{b2b_50} mirror missing pre-delete"
        assert r200 is not None, f"{b2b_200} mirror missing pre-delete"

        # DELETE
        r = admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # Response shape check
        assert body.get("message") == "Product deleted", body
        assert body.get("id") == slug, body
        assert body.get("b2b_skus_deleted") == 2, f"expected b2b_skus_deleted=2, got {body}"

        # (a) Mongo products has 0 with this id
        assert await dbc.products.count_documents({"id": slug}) == 0

        # (b) Mongo b2b_products has 0 rows with product_id
        assert await dbc.b2b_products.count_documents({"product_id": slug}) == 0

        # (c) Supabase mirror has 0 rows for b2c AND both b2b SKU ids
        # Allow ~2s for best-effort mirror deletes
        deadline = time.time() + 5
        remaining = None
        while time.time() < deadline:
            remaining = _fetch_mirror_like(f"{slug}%")
            if not remaining:
                break
            time.sleep(0.5)
        assert remaining == [], f"Supabase mirror still has {slug}* rows: {remaining}"

    finally:
        # Safety net cleanup regardless of pass/fail
        await dbc.products.delete_many({"id": slug})
        await dbc.b2b_products.delete_many({"product_id": slug})
        for pid in (slug, b2b_50, b2b_200):
            try:
                _delete_mirror(pid)
            except Exception:
                pass


# ================== 2. Re-run iter74 test → no TEST Iter leftover ==================
def test_iter74_run_leaves_no_mirror_orphans():
    """Execute the iter74 create/update test and assert no 'TEST Iter' rows survive."""
    # Pre-purge any leftovers so we measure only what this run leaves behind
    with _pg() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM products_mirror WHERE id LIKE %s OR name ILIKE %s",
            ("test-iter74-product%", "%TEST Iter%"),
        )

    result = subprocess.run(
        [
            "python", "-m", "pytest",
            "/app/backend/tests/test_iter74_unified_products.py::test_unified_product_create_and_update",
            "-v", "--tb=short",
        ],
        cwd="/app/backend",
        capture_output=True,
        text=True,
        timeout=180,
    )
    print("STDOUT:", result.stdout[-2000:])
    print("STDERR:", result.stderr[-1000:])
    assert result.returncode == 0, f"iter74 test failed: {result.stdout}\n{result.stderr}"

    # Give mirror best-effort deletes a moment to settle
    time.sleep(2)

    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, channel FROM products_mirror WHERE name ILIKE %s OR id LIKE %s",
            ("%TEST Iter%", "test-iter74-product%"),
        )
        rows = cur.fetchall()
    assert rows == [], f"iter74 run leaked mirror rows: {rows}"


# ================== 3. Regression — active B2C mirror still healthy ==================
def test_active_b2c_rows_have_price_and_stock():
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, price_inr, stock_pieces "
            "FROM products_mirror WHERE channel='b2c' AND is_active=true"
        )
        rows = cur.fetchall()
    assert len(rows) >= 1, "no active b2c mirror rows"
    bad = [
        r for r in rows
        if r["price_inr"] is None or r["stock_pieces"] is None
    ]
    assert not bad, f"active b2c rows with null price/stock: {bad}"
    print(f"OK: {len(rows)} active B2C mirror rows all healthy")
