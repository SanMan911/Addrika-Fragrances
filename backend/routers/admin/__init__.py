"""Admin routers package - Split from monolithic admin.py for maintainability"""
from fastapi import APIRouter
from .admin_auth import router as auth_router
from .admin_orders import router as orders_router
from .admin_discounts import router as discounts_router
from .admin_users import router as users_router
from .admin_analytics import router as analytics_router
from .admin_shiprocket import router as shiprocket_router
from .admin_retailers import router as retailers_router
from .admin_maintenance import router as maintenance_router
from .admin_rto_vouchers import router as rto_vouchers_router

# Create main admin router
router = APIRouter(prefix="/admin", tags=["Admin"])

# Include all sub-routers (they don't have prefixes since we're mounting under /admin)
router.include_router(auth_router)
router.include_router(orders_router)
router.include_router(discounts_router)
router.include_router(users_router)
router.include_router(analytics_router)
router.include_router(shiprocket_router)
router.include_router(retailers_router)
router.include_router(maintenance_router)
router.include_router(rto_vouchers_router)
