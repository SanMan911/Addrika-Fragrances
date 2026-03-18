"""
Database Indexes Configuration
Run this script to ensure all necessary indexes are created for optimal performance
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Index definitions: {collection: [index_specs]}
# index_spec format: (fields, options)
# fields: list of (field_name, direction) tuples or just field_name for ascending
INDEXES = {
    # Orders - heavily queried
    "orders": [
        ([("order_number", 1)], {"unique": True}),
        ([("session_id", 1)], {}),
        ([("user_id", 1), ("created_at", -1)], {}),
        ([("order_status", 1), ("created_at", -1)], {}),
        ([("payment_status", 1)], {}),
        ([("shipping.email", 1)], {}),
        ([("pickup_store.id", 1)], {}),
        ([("assigned_retailer.retailer_id", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    
    # Users
    "users": [
        ([("email", 1)], {"unique": True}),
        ([("user_id", 1)], {"unique": True}),
        ([("username", 1)], {"unique": True, "sparse": True}),
    ],
    
    # Retailers
    "retailers": [
        ([("retailer_id", 1)], {"unique": True}),
        ([("email", 1)], {"unique": True}),
        ([("gst_number", 1)], {"unique": True}),
        ([("state", 1), ("district", 1)], {}),
        ([("status", 1)], {}),
        ([("pincode", 1)], {}),
    ],
    
    # User Rewards
    "user_rewards": [
        ([("user_id", 1)], {"unique": True}),
        ([("email", 1)], {}),
        ([("coins_expiry_date", 1)], {}),
    ],
    
    # Coin Transactions
    "coin_transactions": [
        ([("user_id", 1), ("created_at", -1)], {}),
        ([("order_number", 1)], {}),
    ],
    
    # Discount Codes
    "discount_codes": [
        ([("code", 1)], {"unique": True}),
        ([("is_active", 1)], {}),
    ],
    
    # Sessions
    "user_sessions": [
        ([("session_token", 1)], {"unique": True}),
        ([("user_id", 1)], {}),
        ([("expires_at", 1)], {"expireAfterSeconds": 0}),  # TTL index
    ],
    
    "admin_sessions": [
        ([("session_token", 1)], {"unique": True}),
        ([("expires_at", 1)], {"expireAfterSeconds": 0}),
    ],
    
    "retailer_sessions": [
        ([("session_token", 1)], {"unique": True}),
        ([("retailer_id", 1)], {}),
    ],
    
    # User Addresses
    "user_addresses": [
        ([("user_id", 1)], {}),
    ],
    
    # Wishlists
    "wishlists": [
        ([("user_id", 1)], {"unique": True}),
        ([("share_code", 1)], {"unique": True, "sparse": True}),
    ],
    
    # Reviews
    "reviews": [
        ([("product_id", 1), ("status", 1)], {}),
        ([("user_id", 1)], {}),
    ],
    
    # Blog Posts
    "blog_posts": [
        ([("slug", 1)], {"unique": True}),
        ([("is_published", 1), ("created_at", -1)], {}),
    ],
    
    # Subscribers
    "subscribers": [
        ([("email", 1)], {"unique": True}),
    ],
    
    # Retailer Messages
    "retailer_messages": [
        ([("to_retailer_id", 1), ("is_read", 1)], {}),
        ([("from_retailer_id", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    
    # Retailer Complaints
    "retailer_complaints": [
        ([("complaint_id", 1)], {"unique": True}),
        ([("retailer_id", 1)], {}),
        ([("status", 1)], {}),
    ],
    
    # Carts
    "carts": [
        ([("session_id", 1)], {"unique": True}),
        ([("updated_at", 1)], {}),
    ],
    
    # OTPs (with TTL)
    "otp_verifications": [
        ([("email", 1), ("purpose", 1)], {}),
        ([("created_at", 1)], {"expireAfterSeconds": 600}),  # 10 min TTL
    ],
    
    "store_pickup_otps": [
        ([("order_number", 1)], {"unique": True}),
        ([("retailer_id", 1)], {}),
    ],
}


async def create_indexes(db):
    """Create all indexes"""
    for collection_name, indexes in INDEXES.items():
        collection = db[collection_name]
        
        for index_spec in indexes:
            fields, options = index_spec
            try:
                await collection.create_index(fields, **options)
                logger.info(f"Created index on {collection_name}: {fields}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.debug(f"Index already exists on {collection_name}: {fields}")
                else:
                    logger.warning(f"Failed to create index on {collection_name}: {e}")


async def main():
    """Main function to create indexes"""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    
    if not mongo_url or not db_name:
        logger.error("MONGO_URL and DB_NAME must be set")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    logger.info(f"Creating indexes on database: {db_name}")
    await create_indexes(db)
    logger.info("Index creation complete")
    
    client.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
