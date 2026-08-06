"""E2E test for admin B2B inventory + best-time endpoints."""
import os
import asyncio
import requests
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://incense-rewards.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


async def _get_otp_from_db(token_id: str) -> str:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    doc = await db["admin_2fa_tokens"].find_one({"token_id": token_id})
    client.close()
    return doc["otp"] if doc else None


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"initiate failed: {r.status_code} {r.text}"
    token_id = r.json()["token_id"]
    otp = asyncio.run(_get_otp_from_db(token_id))
    assert otp, "OTP not found in DB"
    r = s.post(f"{BASE_URL}/api/admin/login/verify-otp", json={"token_id": token_id, "otp": otp}, timeout=30)
    assert r.status_code == 200, f"verify failed: {r.status_code} {r.text}"
    return s


def test_admin_inventory_lists_all_products(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("items", data if isinstance(data, list) else [])
    assert len(items) >= 10, f"Expected >=10 products, got {len(items)}: {items}"
    # Assert required fields on every row
    required = {"id", "name", "net_weight", "is_active", "pieces_per_carton", "stock_pieces", "stock_cartons"}
    missing = required - set(items[0].keys())
    assert not missing, f"Missing fields: {missing} in item: {items[0]}"
    print(f"Products: {[(i['name'], i.get('pieces_per_carton'), i.get('stock_pieces')) for i in items]}")


def test_admin_inventory_adjust_updates_stock(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
    items = r.json().get("items", [])
    assert items
    target = items[0]
    pid = target["id"]
    before_pieces = target.get("stock_pieces", 0)

    adj = admin_session.post(
        f"{BASE_URL}/api/admin/b2b/inventory/{pid}/adjust",
        json={"delta_pieces": 100, "reason": "restock"},
        timeout=30,
    )
    assert adj.status_code in (200, 201), f"adjust failed: {adj.status_code} {adj.text}"

    r2 = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
    items2 = r2.json().get("items", [])
    updated = next((i for i in items2 if i["id"] == pid), None)
    assert updated is not None
    assert updated["stock_pieces"] == before_pieces + 100, f"Expected {before_pieces + 100}, got {updated['stock_pieces']}"


def test_best_time_default_for_no_history(admin_session):
    r = admin_session.get(
        f"{BASE_URL}/api/admin/b2b/inventory/nudges/best-time/ST-TEST-NOHISTORY?top_n=3", timeout=30
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["default"] is True
    assert data["sample_size"] == 0
    assert len(data["recommendations"]) == 3


def test_best_time_audience(admin_session):
    r = admin_session.post(
        f"{BASE_URL}/api/admin/b2b/inventory/nudges/best-time-for-audience",
        json={"audience": "all", "top_n": 3},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "recommendations" in data
    assert "audience_size" in data
    assert len(data["recommendations"]) >= 1
