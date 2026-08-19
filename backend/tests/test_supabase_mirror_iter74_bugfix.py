"""Regression tests for iter74 mirror-sync bug.

Uses SYNC psycopg2 for Supabase reads to avoid the pytest-asyncio
event-loop-vs-shared-async-engine mismatch (the app's async engine is
bound to the first loop that used it).

Verifies:
1. No leftover 'TEST Iter' rows in products_mirror
2. All active B2C rows have non-null price_inr and stock_pieces
3. POST /api/admin/products populates mirror with price + stock
4. PUT  /api/admin/products/{id} keeps price accurate in mirror
"""
from __future__ import annotations

import os
import uuid
import time
import pytest
import pytest_asyncio
import psycopg2
import psycopg2.extras
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


# =========== 1. No leftover TEST Iter rows =============
def test_no_leftover_test_iter_rows_in_mirror():
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, name, channel FROM products_mirror WHERE name ILIKE %s",
                    ("%TEST Iter%",))
        rows = cur.fetchall()
    assert rows == [], f"Leftover TEST Iter rows in mirror: {rows}"


# =========== 2. All active B2C rows have price + stock =============
def test_all_active_b2c_have_price_and_stock():
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, price_inr, stock_pieces "
            "FROM products_mirror WHERE channel='b2c' AND is_active=true "
            "ORDER BY name LIMIT 50"
        )
        rows = cur.fetchall()
    assert len(rows) >= 1, "Expected at least 1 active B2C mirror row"
    bad = [r for r in rows
           if r["price_inr"] is None
           or r["stock_pieces"] is None
           or int(r["stock_pieces"]) < 0]
    assert not bad, f"Active B2C rows missing price/stock: {bad}"
    print(f"Verified {len(rows)} active B2C mirror rows (all with price + stock >= 0)")


# =========== 3. POST /api/admin/products populates mirror =============
def _wait_for_mirror(pid: str, tries: int = 12, need_price: bool = True):
    row = None
    for _ in range(tries):
        row = _fetch_mirror(pid)
        if row and (not need_price or row["price_inr"] is not None):
            return row
        time.sleep(0.5)
    return row


@pytest.mark.asyncio
async def test_admin_product_create_populates_mirror(admin_session, dbc):
    suffix = uuid.uuid4().hex[:8]
    slug = f"mirror-regress-{suffix}"
    payload = {
        "name": f"Mirror Regress {suffix}",
        "tagline": "regress",
        "type": "agarbatti",
        "category": "agarbatti",
        "description": "regression",
        "notes": [],
        "image": "https://example.com/x.png",
        "sizes": [
            {"size": "50g", "mrp": 199, "price": 199, "opening_stock": 42, "images": []},
            {"size": "200g", "mrp": 599, "price": 599, "opening_stock": 10, "images": []},
        ],
        "isActive": True,
    }

    try:
        r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text

        row = _wait_for_mirror(slug)
        assert row is not None, f"B2C mirror row {slug} missing"
        assert row["channel"] == "b2c"
        assert row["is_active"] is True
        assert row["price_inr"] is not None, f"price_inr NULL: {row}"
        assert float(row["price_inr"]) == 199.0, f"expected 199, got {row['price_inr']}"
        assert row["stock_pieces"] is not None, f"stock_pieces NULL: {row}"
        assert int(row["stock_pieces"]) == 52, f"expected 52 (42+10), got {row['stock_pieces']}"

        # B2B SKU mirrors present
        b50 = _wait_for_mirror(f"{slug}-50g-b2b", need_price=False)
        b200 = _wait_for_mirror(f"{slug}-200g-b2b", need_price=False)
        assert b50 is not None and b50["channel"] == "b2b"
        assert b200 is not None and b200["channel"] == "b2b"

    finally:
        admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
        await dbc.products.delete_many({"id": slug})
        await dbc.b2b_products.delete_many({"product_id": slug})
        for pid in (slug, f"{slug}-50g-b2b", f"{slug}-200g-b2b"):
            try:
                _delete_mirror(pid)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_admin_product_update_keeps_price_in_mirror(admin_session, dbc):
    suffix = uuid.uuid4().hex[:8]
    slug = f"mirror-update-{suffix}"
    payload = {
        "name": f"Mirror Update {suffix}",
        "tagline": "regress",
        "type": "agarbatti",
        "category": "agarbatti",
        "description": "regression",
        "notes": [],
        "image": "https://example.com/x.png",
        "sizes": [
            {"size": "50g", "mrp": 100, "price": 100, "opening_stock": 5, "images": []},
            {"size": "200g", "mrp": 300, "price": 300, "opening_stock": 3, "images": []},
        ],
        "isActive": True,
    }
    try:
        r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
        assert r.status_code == 200, r.text

        payload["sizes"][0]["mrp"] = 250
        payload["sizes"][0]["price"] = 250
        r = admin_session.put(f"{BASE_URL}/api/admin/products/{slug}", json=payload, timeout=30)
        assert r.status_code == 200, r.text

        row = None
        for _ in range(12):
            row = _fetch_mirror(slug)
            if row and row["price_inr"] is not None and float(row["price_inr"]) == 250.0:
                break
            time.sleep(0.5)
        assert row is not None
        assert float(row["price_inr"]) == 250.0, f"expected 250 after PUT, got {row['price_inr']}"
        assert row["stock_pieces"] is not None and int(row["stock_pieces"]) >= 0
    finally:
        admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
        await dbc.products.delete_many({"id": slug})
        await dbc.b2b_products.delete_many({"product_id": slug})
        for pid in (slug, f"{slug}-50g-b2b", f"{slug}-200g-b2b"):
            try:
                _delete_mirror(pid)
            except Exception:
                pass
