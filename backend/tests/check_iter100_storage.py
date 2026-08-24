"""Round-trip check of Emergent object storage put/get + admin certificate stream."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv, dotenv_values
load_dotenv("/app/backend/.env")

import requests
from pymongo import MongoClient
from services.object_storage import init_storage, put_object, get_object, make_path

BASE = dotenv_values("/app/frontend-next/.env.local")["NEXT_PUBLIC_BACKEND_URL"].rstrip("/")
PDF = b"%PDF-1.4\niter100 qa roundtrip\n%%EOF\n"


async def main():
    try:
        await init_storage()
    except Exception as e:
        print("init_storage raised:", e)
    path = make_path("kyc/gst-cert", "RTL_ITER100UI", "pdf")
    res = await put_object(path, PDF, "application/pdf")
    print("put_object ->", res)
    if not res:
        print("FAIL: put_object returned falsy")
        return
    stored = res.get("path", path)
    got = await get_object(stored)
    print("get_object ->", (len(got[0]), got[1]) if got else None)
    assert got and got[0] == PDF, "round-trip mismatch"
    print("PASS storage round-trip")

    mc = MongoClient(os.environ["MONGO_URL"])
    mc[os.environ["DB_NAME"]].retailers.update_one(
        {"retailer_id": "RTL_ITER100UI"},
        {"$set": {"gst_certificate.storage_path": stored}},
    )
    mc.close()

    token = sys.argv[1]
    r = requests.get(
        f"{BASE}/api/admin/retailer-requests/RTL_ITER100UI/certificate",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    print("admin cert stream:", r.status_code, r.headers.get("content-type"), len(r.content))


asyncio.run(main())
