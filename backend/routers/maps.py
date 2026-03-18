"""Maps and location services routes - Simplified (OpenStreetMap only)"""
from fastapi import APIRouter
from services.shipping_config import get_all_retailers, get_retailers_for_self_pickup

router = APIRouter(prefix="/maps", tags=["Maps"])


@router.get("/retailers")
async def get_retailers():
    """Get list of retailers with their locations, WhatsApp, and email"""
    retailers = get_all_retailers()
    return {"retailers": retailers}


@router.get("/retailers/self-pickup")
async def get_self_pickup_retailers(pincode: str = None):
    """Get retailers available for self-pickup, optionally sorted by distance to pincode"""
    retailers = get_retailers_for_self_pickup(pincode)
    return {"retailers": retailers}

