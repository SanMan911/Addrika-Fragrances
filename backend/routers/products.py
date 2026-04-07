"""Products and cart routes — reads from MongoDB with in-memory cache"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from models.ecommerce import CartItem
from dependencies import db

router = APIRouter(tags=["Products"])

# In-memory product cache — populated from MongoDB on startup and after admin CRUD
PRODUCTS: list[dict] = []


async def refresh_products_cache():
    """Reload products from MongoDB into the module-level cache."""
    global PRODUCTS
    cursor = db.products.find({}, {"_id": 0})
    PRODUCTS[:] = await cursor.to_list(length=500)


async def ensure_products_loaded():
    """Ensure cache is populated (lazy init for first request)."""
    if not PRODUCTS:
        await refresh_products_cache()


@router.get("/products")
async def get_products():
    """Get all active products"""
    await ensure_products_loaded()
    return [p for p in PRODUCTS if p.get("isActive", True)]


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get a single product by ID"""
    await ensure_products_loaded()
    for product in PRODUCTS:
        if product["id"] == product_id:
            return product
    raise HTTPException(status_code=404, detail="Product not found")


def calculate_pricing(items: list, city: str = None, pincode: str = None):
    """Calculate order pricing with weight-based shipping and zone-based free shipping"""
    from services.shipping_config import get_free_shipping_threshold

    subtotal = 0
    mrp_total = 0
    total_weight = 0  # in grams

    for item in items:
        product = next((p for p in PRODUCTS if p["id"] == item.get("productId")), None)
        if product:
            size_info = next((s for s in product["sizes"] if s["size"] == item.get("size")), None)
            if size_info:
                quantity = item.get("quantity", 1)
                subtotal += size_info["price"] * quantity
                mrp_total += size_info["mrp"] * quantity

                # Weight calculation
                if "weight" in size_info:
                    item_weight = size_info["weight"]
                elif item.get("size") == "50g":
                    item_weight = 70
                elif item.get("size") == "125g":
                    item_weight = 175
                else:
                    item_weight = 270
                total_weight += item_weight * quantity

    # Bulk discount
    bulk_discount = 0
    bulk_discount_percent = 0
    if subtotal > 4999:
        bulk_discount_percent = 10
        bulk_discount = subtotal * 0.10
    elif subtotal > 2499:
        bulk_discount_percent = 5
        bulk_discount = subtotal * 0.05

    # Shipping
    if pincode:
        threshold_info = get_free_shipping_threshold(pincode)
        free_shipping_threshold = threshold_info.get("threshold")
        free_shipping_available = threshold_info.get("free_shipping_available", False)

        if free_shipping_available and free_shipping_threshold is not None and subtotal >= free_shipping_threshold:
            shipping = 0
        else:
            shipping_units = -(-total_weight // 250)
            shipping = shipping_units * 30
    else:
        if subtotal >= 2999:
            shipping = 0
        else:
            shipping_units = -(-total_weight // 250)
            shipping = shipping_units * 30

    discount_from_mrp = mrp_total - subtotal
    final_total = subtotal - bulk_discount + shipping

    return {
        "mrp_total": round(mrp_total, 2),
        "subtotal": round(subtotal, 2),
        "discount_from_mrp": round(discount_from_mrp, 2),
        "bulk_discount": round(bulk_discount, 2),
        "bulk_discount_percent": bulk_discount_percent,
        "shipping": round(shipping, 2),
        "total_weight_grams": total_weight,
        "total": round(final_total, 2)
    }


# ===================== Cart Routes =====================

@router.get("/cart/{session_id}")
async def get_cart(session_id: str):
    """Get cart for a session"""
    await ensure_products_loaded()
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        return {
            "session_id": session_id,
            "items": [],
            "pricing": calculate_pricing([])
        }

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart.get("items", []))
    return cart


@router.post("/cart/{session_id}/add")
async def add_to_cart(session_id: str, item: CartItem):
    """Add item to cart"""
    await ensure_products_loaded()

    product = next((p for p in PRODUCTS if p["id"] == item.productId), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.get("comingSoon"):
        raise HTTPException(status_code=400, detail="This product is coming soon and cannot be added to cart yet")

    size_info = next((s for s in product["sizes"] if s["size"] == item.size), None)
    if not size_info:
        raise HTTPException(status_code=400, detail="Invalid size")

    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        cart = {
            "session_id": session_id,
            "items": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

    existing_item = None
    for i, cart_item in enumerate(cart.get("items", [])):
        if cart_item["productId"] == item.productId and cart_item["size"] == item.size:
            existing_item = i
            break

    if existing_item is not None:
        cart["items"][existing_item]["quantity"] += item.quantity
    else:
        cart["items"].append({
            "productId": item.productId,
            "name": product["name"],
            "size": item.size,
            "price": size_info["price"],
            "mrp": size_info["mrp"],
            "quantity": item.quantity,
            "image": product["image"]
        })

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart},
        upsert=True
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.put("/cart/{session_id}/item/{productId}/{size}")
async def update_cart_item(session_id: str, productId: str, size: str, quantity: int):
    """Update cart item quantity"""
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item_found = False
    for i, item in enumerate(cart.get("items", [])):
        if item["productId"] == productId and item["size"] == size:
            if quantity <= 0:
                cart["items"].pop(i)
            else:
                cart["items"][i]["quantity"] = quantity
            item_found = True
            break

    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart}
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.delete("/cart/{session_id}/item/{productId}/{size}")
async def remove_from_cart(session_id: str, productId: str, size: str):
    """Remove item from cart"""
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    original_length = len(cart.get("items", []))
    cart["items"] = [
        item for item in cart.get("items", [])
        if not (item["productId"] == productId and item["size"] == size)
    ]

    if len(cart["items"]) == original_length:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart}
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.delete("/cart/{session_id}")
async def clear_cart(session_id: str):
    """Clear all items from cart"""
    await db.carts.delete_one({"session_id": session_id})

    return {
        "session_id": session_id,
        "items": [],
        "pricing": calculate_pricing([]),
        "message": "Cart cleared"
    }
