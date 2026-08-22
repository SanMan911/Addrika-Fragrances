"""Seed a deterministic retailer for Iter 98 E2E testing (idempotent)."""
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from services.auth_service import hash_password  # noqa: E402

RETAILER_ID = "RTL_ITER98_E2E"
EMAIL = "iter98_e2e_retailer@e2e.test"
USERNAME = "iter98_e2e"
PASSWORD = "Iter98@E2E1"


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    await db.admin_settings.update_one(
        {"_id": "singleton"}, {"$set": {"b2b_enabled": True}}, upsert=True
    )
    await db.retailers.update_one(
        {"retailer_id": RETAILER_ID},
        {
            "$set": {
                "retailer_id": RETAILER_ID,
                "email": EMAIL,
                "username": USERNAME,
                "name": "Iter98 E2E Retailer",
                "business_name": "Iter98 E2E Store",
                "phone": "9876500098",
                "password_hash": hash_password(PASSWORD),
                "status": "active",
                "city": "Delhi",
                "district": "Central Delhi",
                "state": "Delhi",
                "kyc_status": "verified",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    print("seeded", RETAILER_ID, EMAIL, PASSWORD)
    client.close()


asyncio.run(main())
