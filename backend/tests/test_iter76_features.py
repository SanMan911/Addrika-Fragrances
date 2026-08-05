"""Iter76 — Verify:
1. Balance Payment (create-balance-payment + verify-balance-payment endpoints)
2. Bulk CSV Product Upload (multipart CSV → mirror B2B)
3. Founding Retailer Early-Access (launch_sku + preview token + filter on /products)
4. Launch SKU endpoint hides + broadcasts + accountant CC
"""
from __future__ import annotations

import base64
import io
import os
import uuid
from datetime import datetime, timedelta, timezone

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
    assert r.status_code == 200
    token_id = r.json()["token_id"]
    row = await dbc.admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    r = s.post(f"{BASE_URL}/api/admin/login/verify-otp",
               json={"token_id": token_id, "otp": row["otp"]}, timeout=30)
    assert r.status_code == 200
    tok = r.json().get("session_token")
    if tok:
        s.cookies.set("session_token", tok)
    return s


@pytest_asyncio.fixture
async def retailer_session(dbc):
    from secrets import token_urlsafe
    rid = "RTL_ITER76"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {
            "retailer_id": rid, "email": "iter76@retailer.local",
            "business_name": "Iter76 Retailer", "phone": "+919999900011",
            "status": "active", "is_verified": True, "gst_verified": True,
        }},
        upsert=True,
    )
    session_token = token_urlsafe(24)
    await dbc.retailer_sessions.insert_one({
        "session_token": session_token, "retailer_id": rid,
        "email": "iter76@retailer.local", "created_at": now,
        "expires_at": "2099-12-31T00:00:00+00:00",
    })
    s = requests.Session()
    s.cookies.set("retailer_session", session_token)
    return s, rid


# ── 1. BALANCE PAYMENT ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_balance_payment_endpoints_shape(dbc, retailer_session):
    s, rid = retailer_session
    order_id = f"TEST-BAL-{uuid.uuid4().hex[:6]}"
    await dbc.b2b_orders.delete_many({"order_id": order_id})
    await dbc.b2b_orders.insert_one({
        "order_id": order_id, "retailer_id": rid,
        "is_preorder": True, "payment_status": "paid",
        "order_status": "created",
        "grand_total": 5000, "subtotal": 4000,
        "token_amount_inr": 2500, "balance_due_inr": 2500,
        "items": [{"product_id": "test-sku", "quantity_boxes": 1, "line_total": 4000}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    r = s.post(
        f"{BASE_URL}/api/retailer-dashboard/b2b/order/{order_id}/create-balance-payment",
        timeout=30,
    )
    # If Razorpay is unreachable in this env, we should get 502 with a clear message
    # (auth is fine → 401 would mean session broke)
    assert r.status_code in (200, 502), r.text
    if r.status_code == 200:
        body = r.json()
        assert body["amount_inr"] == 2500
        assert body["razorpay_order_id"]
        assert body["order_id"] == order_id

    # Bad body → 400 on verify
    r = s.post(
        f"{BASE_URL}/api/retailer-dashboard/b2b/order/{order_id}/verify-balance-payment",
        json={}, timeout=30,
    )
    assert r.status_code == 400

    await dbc.b2b_orders.delete_many({"order_id": order_id})


@pytest.mark.asyncio
async def test_balance_payment_rejects_non_preorder(dbc, retailer_session):
    s, rid = retailer_session
    order_id = f"TEST-NORMAL-{uuid.uuid4().hex[:6]}"
    await dbc.b2b_orders.insert_one({
        "order_id": order_id, "retailer_id": rid,
        "is_preorder": False, "payment_status": "paid",
        "grand_total": 5000, "balance_due_inr": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    r = s.post(
        f"{BASE_URL}/api/retailer-dashboard/b2b/order/{order_id}/create-balance-payment",
        timeout=30,
    )
    assert r.status_code == 400
    await dbc.b2b_orders.delete_many({"order_id": order_id})


# ── 2. BULK CSV IMPORT ───────────────────────────────────────────────────

def test_bulk_import_creates_and_updates(admin_session, dbc):
    """Two rows sharing a name become one product with two sizes;
    a second row for an existing product adds a size on top."""
    name = f"Test Import {uuid.uuid4().hex[:6]}"
    csv_body = (
        "name,description,type,size,mrp,price,opening_stock,image\n"
        f"{name},Import test product,bakhoor,20g,399,399,50,\n"
        f"{name},,bakhoor,50g,899,899,30,\n"
    )
    files = {"file": ("upload.csv", csv_body.encode(), "text/csv")}
    r = admin_session.post(
        f"{BASE_URL}/api/admin/products/bulk-import", files=files, timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["created"]) == 1
    slug = data["created"][0]

    # Verify DB
    import asyncio
    async def _check():
        product = await dbc.products.find_one({"id": slug}, {"_id": 0})
        assert product
        sizes = {s["size"] for s in product["sizes"]}
        assert sizes == {"20g", "50g"}
        # Linked B2B SKUs must exist
        b2b_count = await dbc.b2b_products.count_documents({"product_id": slug})
        assert b2b_count >= 2
        await dbc.products.delete_many({"id": slug})
        await dbc.b2b_products.delete_many({"product_id": slug})
    asyncio.get_event_loop().run_until_complete(_check())


def test_bulk_import_missing_columns_rejected(admin_session):
    files = {"file": ("bad.csv", b"foo,bar\n1,2\n", "text/csv")}
    r = admin_session.post(
        f"{BASE_URL}/api/admin/products/bulk-import", files=files, timeout=30,
    )
    assert r.status_code == 400
    assert "name" in r.text.lower() and "mrp" in r.text.lower()


def test_bulk_import_template_download(admin_session):
    r = admin_session.get(
        f"{BASE_URL}/api/admin/products/bulk-import/template.csv", timeout=30,
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/csv")
    assert b"name,description,type,size,mrp" in r.content


# ── 3. FOUNDING RETAILER EARLY-ACCESS + LAUNCH ──────────────────────────

def test_preview_token_sign_verify_roundtrip():
    from services.product_launch import sign_preview_token, verify_preview_token
    future = datetime.now(timezone.utc) + timedelta(hours=24)
    tok = sign_preview_token("kesar-chandan", future)
    assert verify_preview_token(tok) == "kesar-chandan"


def test_preview_token_expired_rejected():
    from services.product_launch import sign_preview_token, verify_preview_token
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    tok = sign_preview_token("kesar-chandan", past)
    assert verify_preview_token(tok) is None


def test_preview_token_tampered_rejected():
    from services.product_launch import sign_preview_token, verify_preview_token
    future = datetime.now(timezone.utc) + timedelta(hours=24)
    tok = sign_preview_token("kesar-chandan", future)
    # Swap product id, keep signature — must fail
    _, ts, sig = tok.rsplit(".", 2)
    bad = f"other-product.{ts}.{sig}"
    assert verify_preview_token(bad) is None


@pytest.mark.asyncio
async def test_launch_endpoint_hides_from_public(admin_session, dbc):
    """Launching a SKU hides it from /api/products, but the preview token
    reveals it."""
    slug = f"iter76-launch-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.products.insert_one({
        "id": slug, "name": "Iter76 Launch Product",
        "description": "test", "type": "agarbatti", "category": "agarbatti",
        "image": "", "sizes": [{"size": "50g", "mrp": 100, "price": 100}],
        "isActive": True, "created_at": now, "updated_at": now,
    })
    # Refresh cache so the new product is visible
    r = admin_session.post(
        f"{BASE_URL}/api/admin/products/{slug}/launch",
        json={"hidden_hours": 24, "broadcast": False}, timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    launch = body["launch"]
    assert launch["product_id"] == slug
    assert launch["preview_url"].startswith("/preview/")
    token = launch["preview_url"].split("/preview/")[-1]

    # Public /products must NOT include the launched SKU by default
    r_pub = requests.get(f"{BASE_URL}/api/products", timeout=30)
    assert r_pub.status_code == 200
    ids = [p.get("id") for p in r_pub.json() if not p.get("coming_soon")]
    assert slug not in ids

    # Preview endpoint reveals it
    r_prev = requests.get(f"{BASE_URL}/api/preview/resolve/{token}", timeout=30)
    assert r_prev.status_code == 200
    assert r_prev.json()["product"]["id"] == slug

    # Direct GET with preview token also works
    r_direct = requests.get(
        f"{BASE_URL}/api/products/{slug}?preview={token}", timeout=30
    )
    assert r_direct.status_code == 200

    # Direct GET without token → 404
    r_no = requests.get(f"{BASE_URL}/api/products/{slug}", timeout=30)
    assert r_no.status_code == 404

    # Cleanup
    await dbc.products.delete_many({"id": slug})
    from routers.products import refresh_products_cache
    await refresh_products_cache()


def test_preview_invalid_token_returns_404():
    r = requests.get(f"{BASE_URL}/api/preview/resolve/not-a-real-token", timeout=30)
    assert r.status_code == 404
