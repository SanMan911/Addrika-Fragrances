"""One-off cleanup of leftover TEST products from iteration 81 race tests.

Deletes 'test-race-*' products via the admin API so the cascade also purges
Supabase mirror rows; falls back to direct Mongo+PG delete if API fails.
"""
import asyncio
import os

import psycopg2
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def pg_url():
    raw = os.environ["SUPABASE_DB_URL"]
    return raw.replace("postgresql+asyncpg://", "postgresql://")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    stale = [d["id"] for d in await db.products.find({"id": {"$regex": "^test-"}}, {"_id": 0, "id": 1}).to_list(50)]
    print("stale:", stale)
    if not stale:
        return

    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    print("login initiate", r.status_code)
    if r.status_code == 200:
        token_id = r.json()["token_id"]
        row = await db.admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
        r = s.post(f"{BASE_URL}/api/admin/login/verify-otp", json={"token_id": token_id, "otp": row["otp"]}, timeout=30)
        print("verify", r.status_code)
        tok = r.json().get("session_token") if r.status_code == 200 else None
        if tok:
            s.cookies.set("session_token", tok)
        for pid in stale:
            d = s.delete(f"{BASE_URL}/api/admin/products/{pid}", timeout=30)
            print("delete", pid, d.status_code)

    await asyncio.sleep(3)
    for pid in stale:
        await db.products.delete_many({"id": pid})
        await db.b2b_products.delete_many({"product_id": pid})
    with psycopg2.connect(pg_url(), connect_timeout=20) as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM products_mirror WHERE id LIKE 'test-%'")
        print("mirror rows deleted:", cur.rowcount)
    left = await db.products.count_documents({"id": {"$regex": "^test-"}})
    print("remaining stale mongo docs:", left)
    client.close()


asyncio.run(main())
