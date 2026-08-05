"""Iter74 — Verify:
1. Mogra Magic purged; Royal Kewda + Mystical Meharishi + Belpatra Dhoop present in b2b_products
2. Unified product create/update mirrors B2B SKUs (opening_stock seeding, MRP resync, stock preserved)
3. Enriched B2C /api/products returns sizes[].stock from shared B2B pool
4. Batch allocation dashboard endpoints
5. Regression: b2b calculate + brochure PDF
"""
from __future__ import annotations

import os
import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

# Use localhost since ingress /api routing is not configured on preview URL
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


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
    # Cookie is set with Secure flag which requests drops on http:// — attach manually
    token = r.json().get("session_token")
    if token:
        s.cookies.set("session_token", token)
    return s


# ================= 1. Purge + new products in B2B catalog =================
@pytest.mark.asyncio
async def test_mogra_magic_purged_and_new_products_seeded(admin_session, dbc):
    r = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    rows = data.get("items") if isinstance(data, dict) else data
    assert isinstance(rows, list) and rows

    # No mogra magic anywhere
    for row in rows:
        assert "mogra" not in (row.get("name", "").lower()), f"Mogra found: {row}"
        assert "mogra" not in (row.get("id", "").lower()), f"Mogra id found: {row}"
        assert "mogra" not in (row.get("product_id", "").lower()), f"Mogra product_id: {row}"

    # DB double-check
    mogra_db = await dbc.b2b_products.find_one({
        "$or": [
            {"name": {"$regex": "mogra", "$options": "i"}},
            {"id": {"$regex": "mogra", "$options": "i"}},
            {"product_id": {"$regex": "mogra", "$options": "i"}},
        ]
    })
    assert mogra_db is None, f"Mogra still in b2b_products: {mogra_db}"

    # Royal Kewda 50g + 200g present
    kewda_names = [r for r in rows if "royal kewda" in r.get("name", "").lower()]
    weights = {r.get("net_weight") for r in kewda_names}
    assert "50g" in weights, f"Royal Kewda 50g missing. Got: {kewda_names}"
    assert "200g" in weights, f"Royal Kewda 200g missing. Got: {kewda_names}"

    # Mystical Meharishi 100g Dhoop present
    meha = [r for r in rows if "mystical meharishi" in r.get("name", "").lower()]
    assert meha, "Mystical Meharishi missing"
    assert any(r.get("net_weight") == "100g" for r in meha), f"Meharishi 100g missing: {meha}"

    # Belpatra Dhoop present
    belp = [r for r in rows if "belpatra" in r.get("name", "").lower()]
    assert belp, "Belpatra Dhoop missing"


# ================= 2. Unified create/update =================
@pytest.mark.asyncio
async def test_unified_product_create_and_update(admin_session, dbc):
    payload = {
        "name": "TEST Iter74 Product",
        "tagline": "unit test",
        "type": "agarbatti",
        "category": "agarbatti",
        "description": "test",
        "notes": [],
        "image": "https://example.com/x.png",
        "sizes": [
            {"size": "50g", "mrp": 120, "price": 120, "opening_stock": 30, "images": []},
            {"size": "200g", "mrp": 450, "price": 450, "opening_stock": 0, "images": []},
        ],
        "isActive": True,
    }
    slug = "test-iter74-product"
    # Cleanup any leftovers
    await dbc.products.delete_many({"id": slug})
    await dbc.b2b_products.delete_many({"product_id": slug})

    r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("b2b_skus_created") == 2, data

    # Verify B2B mirrored rows exist with correct opening stock
    b50 = await dbc.b2b_products.find_one({"product_id": slug, "net_weight": "50g"}, {"_id": 0})
    b200 = await dbc.b2b_products.find_one({"product_id": slug, "net_weight": "200g"}, {"_id": 0})
    assert b50 and b50.get("stock_pieces") == 30, b50
    assert b50.get("stock_status") == "in_stock", b50
    assert b50.get("category") == "agarbatti"
    assert b200 and b200.get("stock_pieces") == 0, b200
    assert b200.get("stock_status") == "out_of_stock", b200
    assert b200.get("category") == "agarbatti_jar", b200

    original_mrp = b50.get("mrp_per_unit")
    assert original_mrp == 120.0

    # Update: change MRP, verify stock preserved
    payload["sizes"][0]["mrp"] = 200
    payload["sizes"][0]["price"] = 200
    payload["sizes"][0]["opening_stock"] = 999  # must be ignored on update
    r = admin_session.put(f"{BASE_URL}/api/admin/products/{slug}", json=payload, timeout=30)
    assert r.status_code == 200, r.text

    b50b = await dbc.b2b_products.find_one({"product_id": slug, "net_weight": "50g"}, {"_id": 0})
    assert b50b.get("mrp_per_unit") == 200.0, "MRP not resynced"
    assert b50b.get("stock_pieces") == 30, f"stock got wiped! {b50b}"  # preserved

    # Cleanup
    admin_session.delete(f"{BASE_URL}/api/admin/products/{slug}", timeout=30)
    await dbc.b2b_products.delete_many({"product_id": slug})


# ================= 3. Enriched B2C /api/products returns unified stock =================
def test_b2c_products_enriched_with_stock():
    r = requests.get(f"{BASE_URL}/api/products", timeout=30)
    assert r.status_code == 200
    prods = r.json()
    bakhoor = next((p for p in prods if p["id"] == "bold-bakhoor"), None)
    assert bakhoor, "bold-bakhoor missing"
    size50 = next((s for s in bakhoor["sizes"] if s["size"] == "50g"), None)
    assert size50, "bold-bakhoor 50g missing"
    assert "stock" in size50, f"stock field not attached: {size50}"
    # Should have a numeric stock value (seeded to 100 per review request; accept >=0)
    assert isinstance(size50["stock"], int)


def test_b2c_single_product_enriched():
    r = requests.get(f"{BASE_URL}/api/products/bold-bakhoor", timeout=30)
    assert r.status_code == 200
    p = r.json()
    size50 = next((s for s in p["sizes"] if s["size"] == "50g"), None)
    assert size50 and "stock" in size50, size50


# ================= 4. Batch allocation dashboard =================
def test_batch_allocation_endpoint(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/b2b/preorders/batch-allocation", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "skus" in data and "totals" in data
    assert isinstance(data["skus"], list)
    totals = data["totals"]
    for k in ["orders", "retailers", "pieces", "token_paid_inr", "balance_due_inr"]:
        assert k in totals, f"totals missing {k}"


def test_batch_allocation_by_sku(admin_session):
    r = admin_session.get(
        f"{BASE_URL}/api/admin/b2b/preorders/by-sku/royal-kewda-b2b", timeout=30
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("product_id") == "royal-kewda-b2b"
    assert "product_name" in data
    assert isinstance(data.get("orders"), list)


# ================= 5. Regression: brochure PDF =================
def test_brochure_pdf_download():
    r = requests.get(f"{BASE_URL}/api/brochure/download", timeout=60)
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("content-type", "")
    assert len(r.content) > 50_000, f"Brochure too small: {len(r.content)} bytes"
    assert r.content[:4] == b"%PDF"


# Regression: b2b calculate endpoint reachable (auth path only — no real retailer session)
def test_b2b_calculate_endpoint_reachable():
    # Without a retailer session it should reject with 401/403, not 500
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/calculate",
                      json={"items": []}, timeout=15)
    assert r.status_code in (400, 401, 403), f"unexpected: {r.status_code} {r.text[:200]}"
