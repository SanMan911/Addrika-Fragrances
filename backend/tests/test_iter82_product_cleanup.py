"""Iter82 verification: '8" Bambooless Dhoop' (bambooless-dhoop-8inch) removed
everywhere and 'bilvapatra-fragrance' display name renamed to 'Belpatra'.

Covers:
- Public storefront GET /api/products + detail endpoint
- MongoDB `products` / `b2b_products`
- Supabase `products_mirror` (b2c rows + linked b2b SKUs)
- B2B catalog SKU 'belpatra-dhoop-b2b' still exposed
- Regression (iter79/80/81): b2c mirror rows keep non-null price_inr/stock_pieces
"""
from __future__ import annotations

import os

import psycopg2
import psycopg2.extras
import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

# Public preview ingress does not proxy /api (frontend rewrite points back at
# itself -> 404 loop), so backend is exercised on its supervisor-managed port.
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

BAMBOO = "bambooless-dhoop-8inch"
EXPECTED_IDS = {
    "kesar-chandan", "regal-rose", "oriental-oudh", "bold-bakhoor",
    "mystical-meharishi", "grated-omani-bakhoor", "yemeni-bakhoor-chips",
    "bilvapatra-fragrance", "royal-kewda",
}


def _sync_pg_url() -> str:
    raw = os.environ["SUPABASE_DB_URL"]
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://"):]
    return raw


def _pg():
    return psycopg2.connect(_sync_pg_url(), connect_timeout=20)


def _query(sql, args=()):
    with _pg() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, args)
        return cur.fetchall()


@pytest_asyncio.fixture
async def dbc():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def products():
    r = requests.get(f"{BASE_URL}/api/products", timeout=60)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    if isinstance(data, dict):
        data = data.get("products") or data.get("items") or data.get("data")
    assert isinstance(data, list)
    return data


# --- Public storefront endpoint ---------------------------------------------
class TestPublicProducts:
    def test_real_catalog_is_nine_products(self, products):
        real = [p for p in products if not str(p.get("id", "")).startswith("test-")]
        ids = sorted(p.get("id") for p in real)
        assert len(real) == 9, f"expected 9 real products, got {len(real)}: {ids}"
        assert set(ids) == EXPECTED_IDS, f"unexpected catalog: {ids}"

    def test_no_leftover_test_products(self, products):
        leftovers = [p.get("id") for p in products if str(p.get("id", "")).startswith("test-")]
        assert not leftovers, f"leftover test products polluting storefront: {leftovers}"

    def test_no_bambooless_product(self, products):
        assert not [p for p in products if p.get("id") == BAMBOO], "bambooless id still present"
        bad = [p.get("name") for p in products if "bambooless dhoop" in str(p.get("name", "")).lower()]
        assert not bad, f"product name still references Bambooless Dhoop: {bad}"

    def test_belpatra_renamed(self, products):
        match = [p for p in products if p.get("id") == "bilvapatra-fragrance"]
        assert match, "bilvapatra-fragrance missing from /api/products"
        p = match[0]
        assert p["name"] == "Belpatra", f"name is {p['name']!r}"
        assert "Bilvapatra" not in (p.get("description") or "")

    def test_detail_endpoint_belpatra(self):
        r = requests.get(f"{BASE_URL}/api/products/bilvapatra-fragrance", timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        assert r.json().get("name") == "Belpatra"

    def test_detail_endpoint_bambooless_404(self):
        r = requests.get(f"{BASE_URL}/api/products/{BAMBOO}", timeout=30)
        assert r.status_code == 404, f"expected 404 for deleted product, got {r.status_code}"


# --- MongoDB ----------------------------------------------------------------
class TestMongo:
    @pytest.mark.asyncio
    async def test_bambooless_purged(self, dbc):
        assert await dbc.products.find_one({"id": BAMBOO}) is None
        b2b = await dbc.b2b_products.find({"product_id": BAMBOO}, {"_id": 0, "id": 1}).to_list(20)
        assert b2b == [], f"linked b2b SKUs still present: {b2b}"

    @pytest.mark.asyncio
    async def test_belpatra_doc(self, dbc):
        doc = await dbc.products.find_one({"id": "bilvapatra-fragrance"}, {"_id": 0})
        assert doc is not None
        assert doc["name"] == "Belpatra"
        assert "Bilvapatra" not in doc.get("description", "")

    @pytest.mark.asyncio
    async def test_real_product_count(self, dbc):
        docs = await dbc.products.find({}, {"_id": 0, "id": 1}).to_list(100)
        real = [d["id"] for d in docs if not d["id"].startswith("test-")]
        assert set(real) == EXPECTED_IDS, f"mongo catalog mismatch: {sorted(real)}"

    @pytest.mark.asyncio
    async def test_all_linked_b2b_skus_renamed(self, dbc):
        """Rename must apply to EVERY b2b SKU linked to bilvapatra-fragrance."""
        skus = await dbc.b2b_products.find(
            {"product_id": "bilvapatra-fragrance"}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(20)
        stale = [s for s in skus if "Bilvapatra" in (s.get("name") or "")]
        assert not stale, f"b2b SKUs still using old name 'Bilvapatra': {stale}"

    @pytest.mark.asyncio
    async def test_b2b_sku_intact(self, dbc):
        sku = await dbc.b2b_products.find_one({"id": "belpatra-dhoop-b2b"}, {"_id": 0})
        assert sku is not None, "belpatra-dhoop-b2b SKU missing from b2b_products"
        assert sku["name"] == "Belpatra Dhoop"
        assert sku["product_id"] == "bilvapatra-fragrance"


# --- Supabase mirror --------------------------------------------------------
class TestSupabaseMirror:
    def test_b2c_mirror_rows(self):
        rows = _query("SELECT id, name, channel, price_inr, stock_pieces FROM products_mirror WHERE channel = 'b2c'")
        real = [r for r in rows if not r["id"].startswith("test-")]
        assert set(r["id"] for r in real) == EXPECTED_IDS, f"b2c mirror ids: {sorted(r['id'] for r in real)}"
        bel = [r for r in real if r["id"] == "bilvapatra-fragrance"]
        assert bel and bel[0]["name"] == "Belpatra", f"mirror name: {bel and bel[0]['name']}"

    def test_no_bambooless_mirror_rows(self):
        rows = _query("SELECT id, name, channel FROM products_mirror WHERE id LIKE %s", (f"{BAMBOO}%",))
        assert rows == [], f"bambooless mirror rows remain: {rows}"
        named = _query("SELECT id, name FROM products_mirror WHERE lower(name) LIKE %s", ("%bambooless dhoop%",))
        assert named == [], f"mirror rows named Bambooless Dhoop: {named}"

    def test_b2b_sku_mirrored(self):
        rows = _query("SELECT id, name, channel FROM products_mirror WHERE id = %s", ("belpatra-dhoop-b2b",))
        assert rows, "belpatra-dhoop-b2b missing from products_mirror"
        assert rows[0]["name"] == "Belpatra Dhoop"

    def test_no_stale_bilvapatra_name_in_mirror(self):
        rows = _query("SELECT id, name, channel FROM products_mirror WHERE lower(name) LIKE %s", ("%bilvapatra%",))
        assert rows == [], f"mirror rows still named 'Bilvapatra ...': {rows}"

    @pytest.mark.asyncio
    async def test_no_orphan_b2b_mirror_rows(self, dbc):
        mongo_ids = {d["id"] for d in await dbc.b2b_products.find({}, {"_id": 0, "id": 1}).to_list(200)}
        pg_ids = {r["id"] for r in _query("SELECT id FROM products_mirror WHERE channel = 'b2b'")}
        orphans = sorted(pg_ids - mongo_ids)
        assert not orphans, f"b2b mirror rows with no MongoDB parent: {orphans}"

    def test_regression_price_and_stock_hydrated(self):
        rows = _query(
            "SELECT id, price_inr, stock_pieces FROM products_mirror "
            "WHERE channel = 'b2c' AND (price_inr IS NULL OR stock_pieces IS NULL)"
        )
        assert rows == [], f"b2c mirror rows with null price_inr/stock_pieces: {rows}"


# --- B2B catalog endpoint ---------------------------------------------------
class TestB2BCatalog:
    def test_catalog_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/catalog", timeout=30)
        assert r.status_code in (401, 403), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_catalog_lists_belpatra_and_no_bambooless(self):
        s = requests.Session()
        creds = {"email": "test_b2b_retailer@example.com", "password": "Test@12345"}
        login = None
        for path, payload in (
            ("/api/retailer-auth/login", creds),
            ("/api/retailer/login", creds),
            ("/api/retailers/login", creds),
            ("/api/retailer-dashboard/login", creds),
            ("/api/retailer-dashboard/auth/login", creds),
        ):
            resp = s.post(f"{BASE_URL}{path}", json=payload, timeout=30)
            if resp.status_code == 200:
                login = resp
                break
        if login is None:
            pytest.skip("Could not authenticate test B2B retailer; SKU verified via Mongo/mirror")
        r = s.get(f"{BASE_URL}/api/retailer-dashboard/b2b/catalog", timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        prods = r.json().get("products", [])
        ids = [p.get("id") for p in prods]
        assert "belpatra-dhoop-b2b" in ids, ids
        assert not [p for p in prods if p.get("product_id") == BAMBOO], "bambooless b2b SKU exposed"
        bel = next(p for p in prods if p["id"] == "belpatra-dhoop-b2b")
        assert bel["name"] == "Belpatra Dhoop"
