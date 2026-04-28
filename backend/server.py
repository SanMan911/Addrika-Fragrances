"""
Addrika Backend API Server
Refactored with modular routers for maintainability
"""
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables FIRST, before importing other modules
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os

from services.auth_service import init_admin_settings

# Import routers
from routers.auth import router as auth_router
from routers.products import router as products_router
from routers.orders import router as orders_router
from routers.admin import router as admin_router
from routers.blog import router as blog_router
from routers.reviews import router as reviews_router
from routers.inventory import router as inventory_router
from routers.subscriptions import router as subscriptions_router
from routers.inquiries import router as inquiries_router
from routers.discounts import router as discounts_router
from routers.maps import router as maps_router
from routers.zoho import router as zoho_router
from routers.shipping import router as shipping_router
from routers.instagram import router as instagram_router
from routers.cart import router as cart_router
from routers.gift_codes import router as gift_codes_router
from routers.wishlist import router as wishlist_router
from routers.user_profile import router as user_profile_router
from routers.rewards import router as rewards_router
from routers.retailers import router as retailers_router
from routers.store_pickup import router as store_pickup_router
from routers.retailer_auth import router as retailer_auth_router
from routers.retailer_dashboard import router as retailer_dashboard_router
from routers.b2b_orders import router as b2b_orders_router
from routers.admin.admin_b2b import router as admin_b2b_router
from routers.admin.admin_b2b_settings import router as admin_b2b_settings_router
from routers.admin.admin_b2b_loyalty import router as admin_b2b_loyalty_router
from routers.admin.admin_b2b_reports import router as admin_b2b_reports_router
from routers.admin.admin_zoho import router as admin_zoho_router, public_router as zoho_oauth_public_router
from routers.b2b_waitlist import router as b2b_waitlist_router, admin_router as admin_b2b_waitlist_router
from routers.b2b_bills_messages import admin_router as admin_b2b_bills_msgs_router, retailer_router as retailer_b2b_bills_msgs_router
from routers.notify_me import router as notify_me_router
from routers.kyc import retailer_router as kyc_retailer_router, admin_router as kyc_admin_router
from routers.admin.admin_auto_blog import router as admin_auto_blog_router

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the FastAPI app
app = FastAPI(
    title="Addrika API",
    description="Premium Incense Brand E-commerce Backend",
    version="2.0.0"
)


# Root endpoint
@app.get("/")
async def root():
    return {"message": "Addrika API v2.0 - Premium Incense Brand"}


# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(blog_router, prefix="/api")
app.include_router(reviews_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(subscriptions_router, prefix="/api")
app.include_router(inquiries_router, prefix="/api")
app.include_router(discounts_router, prefix="/api")
app.include_router(maps_router, prefix="/api")
app.include_router(zoho_router, prefix="/api")
app.include_router(shipping_router, prefix="/api")
app.include_router(instagram_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(gift_codes_router, prefix="/api")
app.include_router(wishlist_router, prefix="/api")
app.include_router(user_profile_router, prefix="/api")
app.include_router(rewards_router, prefix="/api")
app.include_router(retailers_router, prefix="/api")
app.include_router(store_pickup_router, prefix="/api")
app.include_router(retailer_auth_router, prefix="/api")
app.include_router(retailer_dashboard_router, prefix="/api")
app.include_router(b2b_orders_router, prefix="/api")
app.include_router(admin_b2b_router, prefix="/api")
app.include_router(admin_b2b_settings_router, prefix="/api")
app.include_router(admin_b2b_loyalty_router, prefix="/api")
app.include_router(admin_b2b_reports_router, prefix="/api")
app.include_router(admin_zoho_router, prefix="/api")
app.include_router(zoho_oauth_public_router, prefix="/api")
app.include_router(b2b_waitlist_router, prefix="/api")
app.include_router(admin_b2b_waitlist_router, prefix="/api")
app.include_router(admin_b2b_bills_msgs_router, prefix="/api")
app.include_router(retailer_b2b_bills_msgs_router, prefix="/api")
app.include_router(notify_me_router, prefix="/api")
app.include_router(kyc_retailer_router, prefix="/api")
app.include_router(kyc_admin_router, prefix="/api")
app.include_router(admin_auto_blog_router, prefix="/api")


# Startup event
@app.on_event("startup")
async def startup_db_client():
    """Initialize database and background tasks on startup"""
    import asyncio
    from services.scheduler_service import review_email_scheduler_loop, coin_expiry_scheduler_loop
    from services.abandoned_cart_service import abandoned_cart_scheduler_loop
    from services.gift_code_service import gift_code_scheduler_loop
    
    await init_admin_settings(db)
    print("Admin settings initialized")

    # Initialize B2B feature settings (kill-switch + discount)
    from services.b2b_settings import init_b2b_settings
    from services.b2b_loyalty import seed_default_milestones_if_empty
    from services.b2b_catalog import seed_b2b_catalog, refresh_b2b_catalog
    await init_b2b_settings(db)
    await seed_default_milestones_if_empty(db)
    await seed_b2b_catalog(db)
    await refresh_b2b_catalog(db)
    print("B2B settings + loyalty milestones + catalog initialized")

    # Auto-purge bills older than 15 months / 5 quarters
    try:
        from routers.b2b_bills_messages import purge_old_bills
        purged = await purge_old_bills(db)
        if purged:
            print(f"Purged {purged} bills older than 15 months")
    except Exception as e:
        print(f"Bill purge skipped: {e}")

    # Auto-archive admin-retailer message threads idle > 90 days
    try:
        from services.b2b_thread_archive import archive_idle_threads, thread_archive_scheduler_loop
        archived = await archive_idle_threads(db)
        if archived:
            print(f"Archived {archived} admin-retailer threads idle > 90 days")
        asyncio.create_task(thread_archive_scheduler_loop(db))
        print("Thread archive scheduler started")
    except Exception as e:
        print(f"Thread archive skipped: {e}")
    
    # Start background scheduler for review emails
    asyncio.create_task(review_email_scheduler_loop())
    print("Review email scheduler started")
    
    # Start background scheduler for abandoned cart reminders
    asyncio.create_task(abandoned_cart_scheduler_loop())
    print("Abandoned cart scheduler started")
    
    # Start background scheduler for birthday/anniversary gift codes
    asyncio.create_task(gift_code_scheduler_loop())
    print("Gift code scheduler started")
    
    # Start background scheduler for coin expiry and reminders
    asyncio.create_task(coin_expiry_scheduler_loop())
    print("Coin expiry scheduler started")
    
    # Populate products cache from MongoDB
    from routers.products import refresh_products_cache
    await refresh_products_cache()
    print("Products cache loaded from MongoDB")

    # Seed blog posts if empty
    from scripts.seed_blog import seed_blog_posts
    await seed_blog_posts(db)
    print("Blog posts check complete")

    # Start auto-blog scheduler (twice/week by default, configurable from admin)
    from services.auto_blog import scheduler_loop as auto_blog_scheduler
    asyncio.create_task(auto_blog_scheduler(db))
    print("Auto-blog scheduler started")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_db_client():
    """Close database connection on shutdown"""
    client.close()


# CORS middleware - must be added last
# When using credentials, we need to specify exact origins (not wildcard)
# Read additional origins from environment
env_cors = os.environ.get('CORS_ORIGINS', '')
extra_origins = [o.strip() for o in env_cors.split(',') if o.strip() and o.strip() != '*']

CORS_ORIGINS = [
    "http://localhost:3000",
    "https://incense-retail.preview.emergentagent.com",
    "https://fragrant-incense.emergent.host",
    "https://centraders.com",
    "https://www.centraders.com",
    "http://centraders.com",
    "http://www.centraders.com",
    # Subdomains for admin and retailer portals
    "https://admin.centraders.com",
    "https://retailer.centraders.com",
    "http://admin.centraders.com",
    "http://retailer.centraders.com",
] + extra_origins

# Remove duplicates while preserving order
CORS_ORIGINS = list(dict.fromkeys(CORS_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
