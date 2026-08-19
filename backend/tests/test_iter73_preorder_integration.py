"""Iter73 — Integration tests hitting the running backend for:
  1. Pre-Order flow (calculate → order → preorder-receipt.pdf)
  2. CSV filter endpoint (product_id + from_date + to_date)
  3. Monthly rewards digest manual trigger + accountant_email slot
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone

import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://fragrance-rewards.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
RETAILER_ID = os.environ.get("ITER73_RETAILER_ID", "RTL_DELHI001")


# ─────────────────────────── Fixtures ────────────────────────────
@pytest_asyncio.fixture
async def dbc():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest_asyncio.fixture
async def admin_cookie(dbc):
    """Log in as admin via 2FA (OTP pulled from DB)."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate",
               json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"initiate failed: {r.status_code} {r.text}"
    token_id = r.json()["token_id"]
    row = await dbc.admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    assert row and row.get("otp"), "OTP not found in DB"
    otp = row["otp"]
    r = s.post(f"{BASE_URL}/api/admin/login/verify-otp",
               json={"token_id": token_id, "otp": otp}, timeout=30)
    assert r.status_code == 200, f"verify failed: {r.status_code} {r.text}"
    return s


@pytest_asyncio.fixture
async def retailer_cookie(dbc):
    """Mint a retailer session cookie by inserting into db.retailer_sessions."""
    # Ensure the retailer exists
    r = await dbc.retailers.find_one({"retailer_id": RETAILER_ID})
    if not r:
        pytest.skip(f"seeded retailer {RETAILER_ID} not present — cannot run e2e")
    token = "iter73_" + secrets.token_urlsafe(24)
    await dbc.retailer_sessions.insert_one({
        "session_token": token,
        "retailer_id": RETAILER_ID,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc).replace(year=2030).isoformat(),
        "active": True,
    })
    sess = requests.Session()
    sess.cookies.set("retailer_session", token,
                     domain=BASE_URL.split("://")[1].split("/")[0])
    yield sess, token
    await dbc.retailer_sessions.delete_many({"session_token": token})


# ─────────────────────────── Feature 1: Pre-Order ────────────────
@pytest.mark.asyncio
async def test_preorder_flow_calculate_and_receipt(admin_cookie, retailer_cookie, dbc):
    admin = admin_cookie
    retailer, _tok = retailer_cookie

    # Pick a real b2b product
    prod = await dbc.b2b_products.find_one({"active": {"$ne": False}}, {"_id": 0, "id": 1})
    if not prod:
        pytest.skip("no b2b_products in DB")
    pid = prod["id"]

    # Capture original stock state to restore later
    orig = await dbc.b2b_products.find_one({"id": pid},
                                            {"_id": 0, "stock_status": 1, "stock_pieces": 1,
                                             "eta_days": 1})

    try:
        # Mark out_of_stock via admin
        r = admin.post(f"{BASE_URL}/api/admin/b2b/inventory/{pid}/status",
                       json={"status": "out_of_stock", "eta_days": 15}, timeout=30)
        assert r.status_code == 200, f"set stock: {r.status_code} {r.text}"

        # ─── /calculate WITHOUT is_preorder — must reject
        r = retailer.post(f"{BASE_URL}/api/retailer-dashboard/b2b/calculate",
                          json={"items": [{"product_id": pid, "quantity_boxes": 1}]},
                          timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

        # ─── /calculate WITH is_preorder=true — must accept + return terms
        r = retailer.post(f"{BASE_URL}/api/retailer-dashboard/b2b/calculate",
                          json={"items": [{"product_id": pid, "quantity_boxes": 1}],
                                "is_preorder": True, "accept_preorder_terms": True},
                          timeout=30)
        assert r.status_code == 200, f"preorder calc: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("is_preorder") is True
        assert "token_amount_inr" in data
        assert "balance_due_inr" in data
        # 50% of grand_total
        gt = float(data["grand_total"])
        assert abs(data["token_amount_inr"] - round(gt * 0.5, 2)) < 0.02
        assert data.get("terms_version") == "PRE-ORDER-V1-2026-02"
        terms = (data.get("terms_text") or "").lower()
        for phrase in ["non-refundable", "non-cancellable", "manufacturing defect",
                       "seal", "damage"]:
            assert phrase in terms, f"missing '{phrase}' in terms_text"

        # ─── /calculate is_preorder=true but no terms — must 400
        r = retailer.post(f"{BASE_URL}/api/retailer-dashboard/b2b/calculate",
                          json={"items": [{"product_id": pid, "quantity_boxes": 1}],
                                "is_preorder": True, "accept_preorder_terms": False},
                          timeout=30)
        assert r.status_code == 400

        # ─── /order — create the pre-order
        r = retailer.post(f"{BASE_URL}/api/retailer-dashboard/b2b/order",
                          json={"items": [{"product_id": pid, "quantity_boxes": 1}],
                                "is_preorder": True, "accept_preorder_terms": True},
                          timeout=30)
        assert r.status_code == 200, f"preorder /order: {r.status_code} {r.text[:400]}"
        order_resp = r.json()
        order_id = (order_resp.get("order", {}).get("order_id")
                    or order_resp.get("order_id")
                    or order_resp.get("id"))
        assert order_id, f"order_id missing in response: {order_resp}"

        # Verify DB order marked as preorder + Razorpay charge is token amount
        odoc = await dbc.b2b_orders.find_one({"order_id": order_id})
        assert odoc is not None
        assert odoc.get("is_preorder") is True
        assert odoc.get("terms_version") == "PRE-ORDER-V1-2026-02"
        assert odoc.get("token_amount_inr") is not None
        assert abs(float(odoc["token_amount_inr"]) - round(float(odoc["grand_total"]) * 0.5, 2)) < 0.02

        # ─── Download preorder receipt PDF
        r = retailer.get(f"{BASE_URL}/api/retailer-dashboard/b2b/orders/{order_id}/preorder-receipt.pdf",
                         timeout=30)
        assert r.status_code == 200, f"receipt pdf: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        body = r.content
        assert body[:4] == b"%PDF", "not a PDF"
        assert body.rstrip().endswith(b"%%EOF"), "PDF not terminated"
        assert len(body) > 3000, f"PDF too small: {len(body)} bytes"

        # ─── Regression: an in-stock order still works. Try a different SKU
        # that is currently in stock (stock_status='in_stock' and stock_pieces>0).
        instock_prod = await dbc.b2b_products.find_one(
            {"id": {"$ne": pid}, "stock_status": "in_stock", "stock_pieces": {"$gt": 32}},
            {"_id": 0, "id": 1},
        )
        if instock_prod:
            r = retailer.post(f"{BASE_URL}/api/retailer-dashboard/b2b/calculate",
                              json={"items": [{"product_id": instock_prod["id"], "quantity_boxes": 1}]},
                              timeout=30)
            assert r.status_code == 200, f"in-stock calc broken: {r.status_code} {r.text[:200]}"
            instock_calc = r.json()
            assert instock_calc.get("is_preorder") is not True

        # ─── preorder-receipt.pdf on a NON-preorder order must 400
        # Look up any recent non-preorder order for this retailer, else skip.
        non_pre = await dbc.b2b_orders.find_one(
            {"retailer_id": RETAILER_ID, "is_preorder": {"$ne": True}},
            {"_id": 0, "order_id": 1},
            sort=[("created_at", -1)],
        )
        if non_pre:
            r = retailer.get(
                f"{BASE_URL}/api/retailer-dashboard/b2b/orders/{non_pre['order_id']}/preorder-receipt.pdf",
                timeout=30)
            assert r.status_code == 400, f"expected 400 on non-preorder receipt, got {r.status_code}"

        # Cleanup — delete the test preorder so it doesn't pollute retailer history
        await dbc.b2b_orders.delete_one({"order_id": order_id})

    finally:
        # Restore original stock state
        status = (orig or {}).get("stock_status") or "in_stock"
        eta = (orig or {}).get("eta_days")
        admin.post(f"{BASE_URL}/api/admin/b2b/inventory/{pid}/status",
                   json={"status": status, "eta_days": eta}, timeout=30)


# ─────────────────────────── Feature 2: CSV filter ────────────────
@pytest.mark.asyncio
async def test_csv_export_respects_filters(admin_cookie, dbc):
    admin = admin_cookie

    # Insert two synthetic log rows — one Feb 10 + one Mar 05
    pid = "iter73_prod_" + secrets.token_hex(4)
    rows = [
        {"id": f"iter73_log_{secrets.token_hex(3)}", "product_id": pid, "reason": "adjust",
         "delta_pieces": -5, "before": 100, "after": 95, "created_at": "2026-02-10T09:00:00+00:00"},
        {"id": f"iter73_log_{secrets.token_hex(3)}", "product_id": pid, "reason": "adjust",
         "delta_pieces": -3, "before": 95, "after": 92, "created_at": "2026-03-05T09:00:00+00:00"},
        # different product — should be filtered OUT when product_id=pid is passed
        {"id": f"iter73_log_{secrets.token_hex(3)}", "product_id": "other_" + secrets.token_hex(3),
         "reason": "adjust", "delta_pieces": -1, "before": 10, "after": 9,
         "created_at": "2026-02-11T09:00:00+00:00"},
    ]
    await dbc.b2b_inventory_log.insert_many(rows)

    try:
        # Filter by product_id
        r = admin.get(f"{BASE_URL}/api/admin/b2b/inventory/log/export.csv",
                      params={"product_id": pid}, timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        csv_body = r.text
        assert csv_body.count(pid) >= 2
        assert rows[2]["product_id"] not in csv_body

        # Filter by date range — Feb only
        r = admin.get(f"{BASE_URL}/api/admin/b2b/inventory/log/export.csv",
                      params={"product_id": pid,
                              "from_date": "2026-02-01",
                              "to_date": "2026-02-28"},
                      timeout=30)
        assert r.status_code == 200
        csv_body = r.text
        assert "2026-02-10" in csv_body
        assert "2026-03-05" not in csv_body

        # No filters — all rows present
        r = admin.get(f"{BASE_URL}/api/admin/b2b/inventory/log/export.csv", timeout=30)
        assert r.status_code == 200
        assert pid in r.text
    finally:
        await dbc.b2b_inventory_log.delete_many(
            {"id": {"$in": [row["id"] for row in rows]}})


# ─────────────── Feature 3: accountant_email + digest send-now ────
@pytest.mark.asyncio
async def test_accountant_email_slot_and_digest_send_now(admin_cookie, dbc):
    admin = admin_cookie

    # Config endpoint lists accountant_email slot
    r = admin.get(f"{BASE_URL}/api/admin/settings/integrations/config", timeout=30)
    assert r.status_code == 200
    slots = {s["key"] for s in r.json()["slots"]}
    assert "accountant_email" in slots, f"accountant_email missing from slots: {slots}"

    # Set accountant_email
    r = admin.put(f"{BASE_URL}/api/admin/settings/integrations/config/accountant_email",
                  json={"value": "iter73_accountant@example.com"}, timeout=30)
    assert r.status_code == 200

    try:
        # Reset monthly digest state so send-now isn't skipped
        await dbc.settings.delete_one({"_id": "rewards_monthly_digest_state"})

        # Trigger send-now
        r = admin.post(f"{BASE_URL}/api/admin/b2b/inventory/rewards-digest/send-now",
                       timeout=120)
        assert r.status_code == 200, f"digest send: {r.status_code} {r.text[:200]}"
        payload = r.json()
        assert "sent" in payload and "failed" in payload and "month" in payload, payload
    finally:
        # Clear accountant slot
        admin.put(f"{BASE_URL}/api/admin/settings/integrations/config/accountant_email",
                  json={"value": ""}, timeout=30)


# ─────────────── Scheduler boot log check ────
def test_monthly_rewards_scheduler_boot_log():
    hit = False
    for p in ("/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"):
        try:
            with open(p) as f:
                if "Monthly rewards digest scheduler started" in f.read():
                    hit = True
                    break
        except FileNotFoundError:
            continue
    assert hit, "scheduler boot log line not found"
