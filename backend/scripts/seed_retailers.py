"""
Seed correct retailers for Find Retailers page
Run: python -m scripts.seed_retailers
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika")

# Correct retailer data
RETAILERS = [
    {
        "id": "delhi_primary",
        "retailer_id": "RTL_DELHI001",
        "business_name": "M.G. Shoppie",
        "name": "M.G. Shoppie",
        "trade_name": "M.G. Shoppie",
        "email": "amitkumar.911@proton.me",
        "phone": "6202311736",
        "gst_number": "07AADCM1234A1Z5",
        "address": "745, Sector 17 Pocket A Phase II, Dwarka",
        "city": "Dwarka",
        "district": "South West Delhi",
        "state": "Delhi",
        "pincode": "110078",
        "coordinates": {
            "lat": 28.5921,
            "lng": 77.0460
        },
        "status": "active",
        "is_verified": True,
        "is_addrika_verified_partner": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    },
    {
        "id": "bhagalpur_mela",
        "retailer_id": "RTL_BHAG001",
        "business_name": "Mela Stores",
        "name": "Mela Stores",
        "trade_name": "Mela Stores",
        "email": "mr.amitbgp@gmail.com",
        "phone": "7061483566",
        "gst_number": "10AABCM5678B1Z3",
        "address": "D.N. Singh Road, Variety Chowk",
        "city": "Bhagalpur",
        "district": "Bhagalpur",
        "state": "Bihar",
        "pincode": "812002",
        "coordinates": {
            "lat": 25.2425,
            "lng": 86.9842
        },
        "status": "active",
        "is_verified": True,
        "is_addrika_verified_partner": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
]

async def seed_retailers():
    """Replace all retailers with the correct ones"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Delete all existing retailers
    result = await db.retailers.delete_many({})
    print(f"Deleted {result.deleted_count} existing retailers")
    
    # Insert correct retailers
    for retailer in RETAILERS:
        await db.retailers.update_one(
            {"id": retailer["id"]},
            {"$set": retailer},
            upsert=True
        )
        print(f"Added retailer: {retailer['business_name']} ({retailer['district']}, {retailer['state']})")
    
    # Verify
    count = await db.retailers.count_documents({"status": "active", "is_verified": True})
    print(f"\nTotal active verified retailers: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_retailers())
