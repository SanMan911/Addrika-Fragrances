"""Products and cart routes — reads from MongoDB with in-memory cache"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from models.ecommerce import CartItem
from dependencies import db

router = APIRouter(tags=["Products"])

# In-memory product cache — populated from MongoDB on startup and after admin CRUD
PRODUCTS: list[dict] = []

# Default product catalog — used to auto-seed an empty database
_DEFAULT_PRODUCTS = [
    {
        "id": "kesar-chandan", "name": "Kesar Chandan", "tagline": "Sacred Luxury Blend",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "A sacred luxury blend combining the divine warmth of saffron and nutmeg with pure sandalwood. This natural incense promotes tranquility, enhancing focus during mindfulness practices while creating an authentic aromatic ambiance.",
        "notes": ["Saffron", "Sandalwood", "Nutmeg"],
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0q2xrv3z_KC_200%20gms_2.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/e3twm0ue_KC_200%20gms_3.jpg"
            ]}
        ],
        "rating": 4.4, "reviews": 124,
    },
    {
        "id": "regal-rose", "name": "Regal Rose", "tagline": "Enchanting Floral Essence",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "An exquisite aromatic blend featuring rose intertwined with enchanting and enduring scents of pink lotus and ylang ylang. Premium natural ingredients create a mesmerizing scent\u2014pure aromatic bliss for home aromatherapy.",
        "notes": ["Rose", "Pink Lotus", "Ylang Ylang"],
        "image": "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/mmyk8kqb_Rose%20Packet%20%232.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/s9f85jos_Rose%20Packet%20%233.png"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/uyj26i1d_RR%20jar%201%201200px.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/m8u8mwug_RR%20jar%202%201200px.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/bk5g54p5_RR%203%201200px.png"
            ]}
        ],
        "rating": 4.2, "reviews": 98,
    },
    {
        "id": "oriental-oudh", "name": "Oriental Oudh", "tagline": "Wood of the Gods",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "Experience authentic oudh fragrance\u2014the legendary wood of the gods. This premium scent features rich agarwood with warming notes of amber, creating an authentic oud ambiance with long lasting fragrance.",
        "notes": ["Agarwood", "Amber", "Vanilla"],
        "image": "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
                "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/kwkdwh49_Dramatic%20Velvet%20Luxury.png"
            ]}
        ],
        "rating": 4.5, "reviews": 156,
    },
    {
        "id": "bold-bakhoor", "name": "Bold Bakhoor", "tagline": "Traditional Essence",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "A bold and aromatic blend of premium natural bhakhoor featuring oud bakhoor with traditional maghreb spiritual cleansing properties. This incense creates a heady scent with divine essence\u2014perfect as a thoughtful gift.",
        "notes": ["Oud Bakhoor", "Musk", "Amber"],
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
                "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/of3dxgh8_Bakhoor%20Packet%20%232.png"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/p83sa6kl_bb%20jar%201%201200px.png"
            ]}
        ],
        "rating": 4.1, "reviews": 87,
    },
    {
        "id": "mystical-meharishi", "name": "Mystical Meharishi", "tagline": "Bambooless Premium Dhoop",
        "type": "dhoop", "category": "dhoop", "bambooless": True, "comingSoon": False, "isActive": True,
        "description": "Experience the calming essence of Mystical Meharishi\u2014a bambooless premium dhoop with a uniquely light and soothing fragrance that gently fills your space. This artisanal blend creates a serene atmosphere perfect for meditation, relaxation, or unwinding after a long day. Each jar contains 100g of handcrafted dhoop sticks with an extra 25% FREE, plus a complimentary ceramic stand and safety matchbox (20 matches).",
        "notes": ["Light & Soothing", "Calming Essence", "Artisanal Blend"],
        "image": "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg",
        "burnTime": "25+ minutes (standard room temperature)",
        "sizes": [
            {"size": "125g", "sizeLabel": "100g + 25% Extra FREE", "mrp": 149, "price": 149, "weight": 175,
             "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"],
             "images": ["https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg"]}
        ],
        "rating": 4.3, "reviews": 42,
    },
    {
        "id": "grated-omani-bakhoor", "name": "Grated Omani Bakhoor", "tagline": "Traditional Arabian Luxury",
        "type": "bakhoor", "category": "bakhoor", "comingSoon": True, "isActive": True,
        "description": "Immerse yourself in the rich, warm aroma of authentic Omani Bakhoor\u2014finely grated for a smooth, even burn. This premium bakhoor blend features aged oud chips infused with natural resins, musk, and floral extracts sourced from Oman\u2019s finest perfumers. Perfect for scenting your home, welcoming guests, or enhancing special occasions with an opulent, long-lasting fragrance that embodies Arabian hospitality.",
        "notes": ["Aged Oud", "Natural Resins", "Musk & Florals"],
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/c15a934686343e84b679d1e8995844176bb7ed9247cdbcec7c33c8d52d441274.png",
        "burnTime": "30+ minutes on charcoal",
        "sizes": [
            {"size": "20g", "mrp": 249, "price": 249, "weight": 60, "images": [
                "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/c15a934686343e84b679d1e8995844176bb7ed9247cdbcec7c33c8d52d441274.png"
            ]}
        ],
        "rating": 0, "reviews": 0,
    },
    {
        "id": "yemeni-bakhoor-chips", "name": "Yemeni Bakhoor Chips", "tagline": "Exotic Handcrafted Fragrance",
        "type": "bakhoor", "category": "bakhoor", "comingSoon": True, "isActive": True,
        "description": "Discover the exotic depth of Yemeni Bakhoor Chips\u2014hand-selected oud wood chips blended with rare Yemeni honey, saffron, and sandalwood oils. Each chip is carefully aged and infused using traditional methods passed down through generations. When heated, these chips release a rich, complex fragrance that lingers for hours, transforming any space into a haven of tranquility and sophistication.",
        "notes": ["Yemeni Oud", "Saffron & Honey", "Sandalwood"],
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/dd9a7d855b4899a289beae6632de447a07a9612b171fe2d3fc85ff02e10b9713.png",
        "burnTime": "45+ minutes on charcoal",
        "sizes": [
            {"size": "20g", "mrp": 399, "price": 399, "weight": 60, "images": [
                "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/dd9a7d855b4899a289beae6632de447a07a9612b171fe2d3fc85ff02e10b9713.png"
            ]}
        ],
        "rating": 0, "reviews": 0,
    }
]


async def _seed_default_products():
    """Auto-seed the products collection when it's empty (first deploy / fresh database)."""
    import logging
    logger = logging.getLogger(__name__)
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for p in _DEFAULT_PRODUCTS:
        doc = {**p, "created_at": now, "updated_at": now}
        docs.append(doc)
    try:
        await db.products.insert_many(docs)
        await db.products.create_index("id", unique=True)
        logger.info(f"Auto-seeded {len(docs)} products into MongoDB")
    except Exception as e:
        logger.error(f"Auto-seed failed: {e}")


async def refresh_products_cache():
    """Reload products from MongoDB into the module-level cache.
    Auto-seeds the collection if empty (first deploy / fresh database).
    """
    global PRODUCTS
    count = await db.products.count_documents({})
    if count == 0:
        await _seed_default_products()
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
                elif item.get("size") == "20g":
                    item_weight = 60
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
