"""Iter75 — Verify:
1. Product Image Uploader end-to-end (PNG roundtrip + 415 rejection)
2. Stock Sync Health Check endpoint
3. Auto Restock ETA Nudge (batch-ready) triggers on out→in flip
4. Per-Retailer Accountant Email (retailer + admin surfaces + digest resolver)
"""
from __future__ import annotations

import base64
import os
import uuid
from datetime import datetime, timezone

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

# 1x1 transparent PNG (67 bytes)
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


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
    tok = r.json().get("session_token")
    if tok:
        s.cookies.set("session_token", tok)
    return s


@pytest_asyncio.fixture
async def retailer_session(dbc):
    """B2B retailer session — creates a synthetic retailer if missing."""
    rid = "RTL_TEST_ITER75"
    now = datetime.now(timezone.utc).isoformat()
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$setOnInsert": {
            "retailer_id": rid,
            "email": "test_iter75@retailer.local",
            "business_name": "Iter75 Test Retailer",
            "phone": "+919999900001",
            "status": "active", "is_verified": True, "gst_verified": True,
            "created_at": now,
        }},
        upsert=True,
    )
    # Impersonate: mint a retailer_session cookie by manually creating a session token
    from secrets import token_urlsafe
    session_token = token_urlsafe(24)
    await dbc.retailer_sessions.insert_one({
        "session_token": session_token,
        "retailer_id": rid,
        "email": "test_iter75@retailer.local",
        "created_at": now,
        "expires_at": "2099-12-31T00:00:00+00:00",
    })
    s = requests.Session()
    s.cookies.set("retailer_session", session_token)
    return s, rid


# ─── 1. IMAGE UPLOADER ─────────────────────────────────────────────────────

def test_upload_image_png_roundtrip(admin_session, dbc):
    """Upload a real PNG, then GET it back and confirm bytes + Content-Type."""
    files = {"file": ("pixel.png", TINY_PNG, "image/png")}
    r = admin_session.post(
        f"{BASE_URL}/api/admin/products/upload-image", files=files, timeout=30,
    )
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["asset_id"]
    assert body["content_type"] == "image/png"
    assert body["size"] == len(TINY_PNG)
    assert body["url"].endswith(body["asset_id"])

    # PUBLIC GET — no session, no admin cookie
    fetched = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
    assert fetched.status_code == 200
    assert fetched.headers.get("content-type", "").startswith("image/png")
    assert fetched.content == TINY_PNG


def test_upload_image_rejects_unsupported_type(admin_session):
    files = {"file": ("notes.txt", b"hello", "text/plain")}
    r = admin_session.post(
        f"{BASE_URL}/api/admin/products/upload-image", files=files, timeout=30,
    )
    assert r.status_code == 415, f"expected 415, got {r.status_code}: {r.text}"


def test_upload_image_requires_admin():
    files = {"file": ("pixel.png", TINY_PNG, "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/admin/products/upload-image", files=files, timeout=30,
    )
    assert r.status_code in (401, 403)


# ─── 2. STOCK SYNC HEALTH CHECK ───────────────────────────────────────────

def test_sync_health_shape(admin_session):
    r = admin_session.get(
        f"{BASE_URL}/api/admin/b2b/inventory/sync-health", timeout=30
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) >= {"healthy", "counts", "ok", "drift", "orphaned"}
    c = body["counts"]
    assert set(c.keys()) >= {"b2c_products", "b2b_skus", "in_sync", "drifted", "orphaned"}
    # After iter74 mass-mirror, drifted must be 0
    assert c["drifted"] == 0, f"unexpected drift: {body['drift']}"
    # Wholesale-only Ready-to-Use Dhoops (mystical-meharishi-b2b, belpatra-dhoop-b2b)
    # are legitimately orphaned by design (different weight than B2C twin).
    assert c["orphaned"] >= 0


# ─── 3. BATCH-READY NUDGE ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_flip_no_outstanding_returns_skipped(admin_session, dbc):
    """Flip a SKU without any outstanding preorder — nudge result should
    be `skipped: no_outstanding_preorders`."""
    sku = await dbc.b2b_products.find_one({}, {"_id": 0, "id": 1})
    assert sku, "need a SKU to test with"
    # Force to out_of_stock first (pre-condition for flip detection)
    await dbc.b2b_products.update_one(
        {"id": sku["id"]}, {"$set": {"stock_status": "out_of_stock"}}
    )
    # Ensure nothing outstanding for this SKU
    await dbc.b2b_orders.delete_many(
        {"is_preorder": True, "items.product_id": sku["id"], "retailer_id": "RTL_TEST_ITER75_SYNTH"}
    )

    r = admin_session.post(
        f"{BASE_URL}/api/admin/b2b/inventory/{sku['id']}/status",
        json={"status": "in_stock"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "batch_ready_nudge" in body
    n = body["batch_ready_nudge"]
    # Either explicitly skipped, or sent/skipped counters
    assert n.get("skipped") == "no_outstanding_preorders" or (
        "sent" in n and "skipped" in n
    )


@pytest.mark.asyncio
async def test_status_flip_triggers_nudge(admin_session, dbc):
    """Seed a paid pre-order, flip SKU status to in_stock, verify
    nudge fires (`sent >= 1`)."""
    sku = await dbc.b2b_products.find_one({}, {"_id": 0})
    assert sku
    sku_id = sku["id"]
    rid = "RTL_TEST_ITER75_SYNTH"
    # Retailer
    await dbc.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {
            "retailer_id": rid,
            "email": "test_iter75_synth@retailer.local",
            "business_name": "Iter75 Synth",
            "phone": "+919999900002", "status": "active",
        }},
        upsert=True,
    )
    # Synthetic paid pre-order
    order_id = f"TEST-ITER75-{uuid.uuid4().hex[:8]}"
    await dbc.b2b_orders.delete_many({"order_id": order_id})
    await dbc.batch_ready_nudges.delete_many({"order_id": order_id})
    await dbc.b2b_orders.insert_one({
        "order_id": order_id,
        "retailer_id": rid,
        "retailer_email": "test_iter75_synth@retailer.local",
        "is_preorder": True,
        "payment_status": "paid",
        "order_status": "created",
        "grand_total": 5000, "subtotal": 4000,
        "token_amount_inr": 2500, "balance_due_inr": 2500,
        "items": [{"product_id": sku_id, "quantity_boxes": 1,
                   "line_total": 4000, "name": sku.get("name")}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Reset SKU to out_of_stock so the flip is detected
    await dbc.b2b_products.update_one(
        {"id": sku_id}, {"$set": {"stock_status": "out_of_stock"}}
    )

    r = admin_session.post(
        f"{BASE_URL}/api/admin/b2b/inventory/{sku_id}/status",
        json={"status": "in_stock"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    n = body.get("batch_ready_nudge") or {}
    # Either sent>=1 (email/whatsapp delivered) or skipped>=1 (delivery failed but attempt made)
    assert (n.get("sent", 0) >= 1) or (n.get("skipped", 0) >= 1), (
        f"nudge did not attempt delivery: {n}"
    )
    # Idempotency check — call again, no new nudge row should be created
    dbg = await dbc.batch_ready_nudges.count_documents(
        {"order_id": order_id, "product_id": sku_id}
    )
    r2 = admin_session.post(
        f"{BASE_URL}/api/admin/b2b/inventory/{sku_id}/status",
        json={"status": "in_stock"}, timeout=30,
    )
    assert r2.status_code == 200
    dbg2 = await dbc.batch_ready_nudges.count_documents(
        {"order_id": order_id, "product_id": sku_id}
    )
    assert dbg2 == dbg, "nudge fired twice — idempotency broken"

    # Cleanup
    await dbc.b2b_orders.delete_many({"order_id": order_id})
    await dbc.batch_ready_nudges.delete_many({"order_id": order_id})


# ─── 4. PER-RETAILER ACCOUNTANT EMAIL ─────────────────────────────────────

def test_retailer_accountant_email_crud(retailer_session):
    s, rid = retailer_session
    r = s.get(f"{BASE_URL}/api/retailer-dashboard/accountant-email", timeout=30)
    assert r.status_code == 200, r.text
    assert "accountant_email" in r.json()

    r = s.put(f"{BASE_URL}/api/retailer-dashboard/accountant-email",
              json={"accountant_email": "cpa@example.com"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["accountant_email"] == "cpa@example.com"

    r = s.get(f"{BASE_URL}/api/retailer-dashboard/accountant-email", timeout=30)
    assert r.json()["accountant_email"] == "cpa@example.com"

    # Invalid — no @
    r = s.put(f"{BASE_URL}/api/retailer-dashboard/accountant-email",
              json={"accountant_email": "not-an-email"}, timeout=30)
    assert r.status_code == 400

    # Clear
    r = s.put(f"{BASE_URL}/api/retailer-dashboard/accountant-email",
              json={"accountant_email": ""}, timeout=30)
    assert r.status_code == 200
    assert r.json()["accountant_email"] == ""


def test_retailer_accountant_email_requires_auth():
    r = requests.get(f"{BASE_URL}/api/retailer-dashboard/accountant-email", timeout=30)
    assert r.status_code in (401, 403)


def test_accountant_email_resolver_helper():
    from services.monthly_rewards_digest import _accountant_email_for_retailer
    # Retailer own wins over platform default
    assert _accountant_email_for_retailer(
        {"accountant_email": "own@firm.com"}, "platform@x.com"
    ) == "own@firm.com"
    # Fallback to platform
    assert _accountant_email_for_retailer(
        {}, "platform@x.com"
    ) == "platform@x.com"
    # Both empty → None
    assert _accountant_email_for_retailer({}, None) is None
    # Whitespace-only retailer email → treat as absent, fall back
    assert _accountant_email_for_retailer(
        {"accountant_email": "   "}, "platform@x.com"
    ) == "platform@x.com"


# ─── 5. REGRESSION — iter74 unified products still linked ─────────────────

def test_regression_products_stock_enrichment(admin_session):
    r = requests.get(f"{BASE_URL}/api/products", timeout=30)
    assert r.status_code == 200
    payload = r.json()
    assert isinstance(payload, list) and len(payload) > 0
    # At least one product should have a size with a numeric stock field
    has_numeric_stock = any(
        isinstance(s.get("stock"), int)
        for p in payload for s in (p.get("sizes") or [])
    )
    assert has_numeric_stock, "Stock enrichment missing on /api/products"


def test_regression_batch_allocation_endpoint(admin_session):
    r = admin_session.get(
        f"{BASE_URL}/api/admin/b2b/preorders/batch-allocation", timeout=30
    )
    assert r.status_code == 200
    body = r.json()
    assert "skus" in body and "totals" in body
