"""Inventory management routes"""
from fastapi import APIRouter, Request, Cookie
from typing import Optional
from datetime import datetime, timezone

from models.users import InventoryUpdate
from dependencies import db, require_admin
from routers.products import PRODUCTS

router = APIRouter(tags=["Inventory"])


@router.get("/products/{product_id}/stock")
async def get_product_stock(product_id: str):
    """Get stock info for a product"""
    stock_items = await db.product_stock.find({"product_id": product_id}).to_list(10)
    
    stock_info = {}
    for item in stock_items:
        stock_info[item["size"]] = {
            "stock": item["stock"],
            "low_stock_threshold": item.get("low_stock_threshold", 10),
            "is_low_stock": item["stock"] <= item.get("low_stock_threshold", 10),
            "is_out_of_stock": item["stock"] <= 0
        }
    
    return {"product_id": product_id, "stock": stock_info}


# Admin inventory routes
@router.get("/admin/inventory")
async def admin_get_inventory(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get all inventory"""
    await require_admin(request, session_token)
    
    inventory = await db.product_stock.find({}).to_list(100)
    
    # Organize by product
    inventory_by_product = {}
    for item in inventory:
        product_id = item["product_id"]
        if product_id not in inventory_by_product:
            product = next((p for p in PRODUCTS if p["id"] == product_id), None)
            inventory_by_product[product_id] = {
                "product_id": product_id,
                "product_name": product["name"] if product else product_id,
                "sizes": {}
            }
        inventory_by_product[product_id]["sizes"][item["size"]] = {
            "stock": item["stock"],
            "low_stock_threshold": item.get("low_stock_threshold", 10),
            "is_low_stock": item["stock"] <= item.get("low_stock_threshold", 10)
        }
    
    return {"inventory": list(inventory_by_product.values())}


@router.post("/admin/inventory/init")
async def admin_init_inventory(request: Request, session_token: Optional[str] = Cookie(None)):
    """Initialize inventory for all products"""
    await require_admin(request, session_token)
    
    initialized = []
    for product in PRODUCTS:
        for size in product["sizes"]:
            existing = await db.product_stock.find_one({
                "product_id": product["id"],
                "size": size["size"]
            })
            
            if not existing:
                stock_item = {
                    "product_id": product["id"],
                    "size": size["size"],
                    "stock": 100,  # Default stock
                    "low_stock_threshold": 10,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.product_stock.insert_one(stock_item)
                initialized.append(f"{product['id']} - {size['size']}")
    
    return {"message": "Inventory initialized", "initialized": initialized}


@router.put("/admin/inventory/{product_id}/{size}")
async def admin_update_inventory(
    product_id: str,
    size: str,
    update_data: InventoryUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Update inventory for a product size"""
    await require_admin(request, session_token)
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.stock is not None:
        update_fields["stock"] = update_data.stock
    if update_data.low_stock_threshold is not None:
        update_fields["low_stock_threshold"] = update_data.low_stock_threshold
    
    result = await db.product_stock.update_one(
        {"product_id": product_id, "size": size},
        {"$set": update_fields},
        upsert=True
    )
    
    updated = await db.product_stock.find_one({"product_id": product_id, "size": size})
    updated.pop("_id", None)
    
    return {"message": "Inventory updated", "item": updated}
