"""Scan MongoDB for a brand string in text fields. Usage: python scan_brand_db.py [needle]"""
import asyncio
import os
import re
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SKIP = {"admin_sessions", "retailer_sessions", "user_sessions", "sessions", "admin_credentials"}


async def main(needle: str):
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    pat = re.compile(needle, re.I)

    def scan(v, path, out):
        if isinstance(v, str):
            if pat.search(v):
                out.add(path)
        elif isinstance(v, dict):
            for k, x in v.items():
                scan(x, f"{path}.{k}" if path else k, out)
        elif isinstance(v, list):
            for x in v[:50]:
                scan(x, path + "[]", out)

    for n in sorted(await db.list_collection_names()):
        if n in SKIP:
            continue
        cnt = await db[n].count_documents({})
        if not cnt:
            continue
        fields, hits = set(), 0
        async for d in db[n].find({}, {"_id": 0}).limit(1000):
            f = set()
            scan(d, "", f)
            if f:
                hits += 1
                fields |= f
        if hits:
            print(f"{n} ({cnt} docs): {hits} hit docs -> {sorted(fields)[:15]}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "addrika"))
