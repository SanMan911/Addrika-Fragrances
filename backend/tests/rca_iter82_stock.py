"""One-off RCA helper: why is bilvapatra-fragrance b2c mirror stock_pieces NULL?"""
import asyncio
import os

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")


def _pg_url():
    raw = os.environ["SUPABASE_DB_URL"]
    return raw.replace("postgresql+asyncpg://", "postgresql://", 1)


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    doc = await db.products.find_one({"id": "bilvapatra-fragrance"}, {"_id": 0})
    print("MONGO name:", doc.get("name"))
    print("MONGO sizes:", doc.get("sizes"))
    print("MONGO top-level stock_pieces:", doc.get("stock_pieces"))
    b2b = await db.b2b_products.find({"product_id": "bilvapatra-fragrance"}, {"_id": 0, "id": 1, "name": 1, "stock_pieces": 1, "net_weight": 1}).to_list(20)
    print("B2B SKUs:", b2b)
    client.close()

    with psycopg2.connect(_pg_url(), connect_timeout=20) as conn, conn.cursor(
        cursor_factory=psycopg2.extras.RealDictCursor
    ) as cur:
        cur.execute(
            "SELECT id, name, price_inr, stock_pieces, mongo_updated_at FROM products_mirror WHERE channel='b2c' ORDER BY id"
        )
        for r in cur.fetchall():
            print("B2C MIRROR", dict(r))
        cur.execute("SELECT id, name, stock_pieces FROM products_mirror WHERE channel='b2b' ORDER BY id")
        for r in cur.fetchall():
            print("B2B MIRROR", dict(r))
        cur.execute("SELECT id, name FROM products_mirror WHERE name ILIKE '%bilvapatra%' OR id LIKE 'mogra%'")
        print("SANITY bilvapatra/mogra rows:", cur.fetchall())


asyncio.run(main())
