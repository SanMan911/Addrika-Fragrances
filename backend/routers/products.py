"""Products and cart routes"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from models.ecommerce import CartItem
from dependencies import db

router = APIRouter(tags=["Products"])

# Product data - in production, move to database
# ALL products at MRP - no general discount
PRODUCTS = [
    {
        "id": "kesar-chandan",
        "name": "Kesar Chandan",
        "tagline": "Sacred Luxury Blend",
        "description": "A sacred luxury blend combining the divine warmth of saffron and nutmeg with pure sandalwood. This natural incense promotes tranquility, enhancing focus during mindfulness practices while creating an authentic aromatic ambiance.",
        "notes": ["Saffron", "Sandalwood", "Nutmeg"],
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "burnTime": "40+ minutes",
        "sizes": [
            {
                "size": "50g", 
                "mrp": 110, 
                "price": 110,  # MRP only - no discount
                "images": [
                    "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
                    "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg"
                ]
            },
            {
                "size": "200g", 
                "mrp": 402, 
                "price": 402,  # MRP only - no discount
                "images": [
                    "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
                    "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0q2xrv3z_KC_200%20gms_2.jpg",
                    "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/e3twm0ue_KC_200%20gms_3.jpg"
                ]
            }
        ],
        "rating": 4.8,
        "reviews": 124
    },
    {
        "id": "regal-rose",
        "name": "Regal Rose",
        "tagline": "Enchanting Floral Essence",
        "description": "An exquisite aromatic blend featuring rose intertwined with enchanting and enduring scents of pink lotus and ylang ylang. Premium natural ingredients create a mesmerizing scent—pure aromatic bliss for home aromatherapy.",
        "notes": ["Rose", "Pink Lotus", "Ylang Ylang"],
        "image": "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {
                "size": "50g", 
                "mrp": 110, 
                "price": 110,
                "images": [
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/mmyk8kqb_Rose%20Packet%20%232.png",
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/s9f85jos_Rose%20Packet%20%233.png"
                ]
            },
            {
                "size": "200g", 
                "mrp": 402, 
                "price": 402,
                "images": [
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/uyj26i1d_RR%20jar%201%201200px.png",
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/m8u8mwug_RR%20jar%202%201200px.png",
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/bk5g54p5_RR%203%201200px.png"
                ]
            }
        ],
        "rating": 4.7,
        "reviews": 98
    },
    {
        "id": "oriental-oudh",
        "name": "Oriental Oudh",
        "tagline": "Wood of the Gods",
        "description": "Experience authentic oudh fragrance—the legendary wood of the gods. This premium scent features rich agarwood with warming notes of amber, creating an authentic oud ambiance with long lasting fragrance.",
        "notes": ["Agarwood", "Amber", "Vanilla"],
        "image": "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {
                "size": "200g", 
                "mrp": 402, 
                "price": 402,
                "images": [
                    "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
                    "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/kwkdwh49_Dramatic%20Velvet%20Luxury.png"
                ]
            }
        ],
        "rating": 4.9,
        "reviews": 156
    },
    {
        "id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "tagline": "Traditional Essence",
        "description": "A bold and aromatic blend of premium natural bhakhoor featuring oud bakhoor with traditional maghreb spiritual cleansing properties. This incense creates a heady scent with divine essence—perfect as a thoughtful gift.",
        "notes": ["Oud Bakhoor", "Musk", "Amber"],
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {
                "size": "50g", 
                "mrp": 110, 
                "price": 110,
                "images": [
                    "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
                    "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/of3dxgh8_Bakhoor%20Packet%20%232.png"
                ]
            },
            {
                "size": "200g", 
                "mrp": 402, 
                "price": 402,
                "images": [
                    "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/p83sa6kl_bb%20jar%201%201200px.png"
                ]
            }
        ],
        "rating": 4.6,
        "reviews": 87
    },
    {
        "id": "mystical-meharishi",
        "name": "Mystical Meharishi",
        "tagline": "Premium Dhoop Sticks",
        "category": "dhoop",
        "description": "Experience the divine essence of Mystical Meharishi Premium Dhoop. Each jar contains 100g of handcrafted dhoop sticks with an extra 25% FREE. Includes a complimentary ceramic stand and safety matchbox (20 matches) for the complete aromatic experience.",
        "notes": ["Sacred Herbs", "Natural Resins", "Traditional Blend"],
        "image": "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg",
        "burnTime": "30+ minutes per stick",
        "sizes": [
            {
                "size": "125g", 
                "sizeLabel": "100g + 25% Extra FREE",
                "mrp": 149, 
                "price": 149,
                "weight": 175,
                "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"],
                "images": [
                    "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg"
                ]
            }
        ],
        "rating": 4.9,
        "reviews": 42
    }
]


@router.get("/products")
async def get_products():
    """Get all products"""
    return PRODUCTS


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get a single product by ID"""
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
                
                # Weight calculation:
                # 50g packet = 55g gross + 15g packaging = 70g
                # 200g jar = 240g gross + 30g packaging = 270g
                # Custom weight from size_info if available (for Dhoop etc.)
                if "weight" in size_info:
                    item_weight = size_info["weight"]
                elif item.get("size") == "50g":
                    item_weight = 70
                elif item.get("size") == "125g":
                    item_weight = 175  # Dhoop jar
                else:
                    item_weight = 270
                total_weight += item_weight * quantity
    
    # Calculate bulk discount
    bulk_discount = 0
    bulk_discount_percent = 0
    if subtotal > 4999:
        bulk_discount_percent = 10
        bulk_discount = subtotal * 0.10
    elif subtotal > 2499:
        bulk_discount_percent = 5
        bulk_discount = subtotal * 0.05
    
    # Calculate shipping using zone-based free shipping thresholds
    # Get threshold for the delivery pincode
    if pincode:
        threshold_info = get_free_shipping_threshold(pincode)
        free_shipping_threshold = threshold_info.get("threshold")
        free_shipping_available = threshold_info.get("free_shipping_available", False)
        
        if free_shipping_available and free_shipping_threshold is not None and subtotal >= free_shipping_threshold:
            shipping = 0
        else:
            # ₹30 per 250g (rounded up)
            shipping_units = -(-total_weight // 250)  # Ceiling division
            shipping = shipping_units * 30
    else:
        # Fallback: If no pincode, use default logic
        if subtotal >= 2999:  # Rest of India threshold
            shipping = 0
        else:
            shipping_units = -(-total_weight // 250)
            shipping = shipping_units * 30
    
    # Calculate totals
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


# Cart routes
@router.get("/cart/{session_id}")
async def get_cart(session_id: str):
    """Get cart for a session"""
    cart = await db.carts.find_one({"session_id": session_id})
    
    if not cart:
        return {
            "session_id": session_id,
            "items": [],
            "pricing": calculate_pricing([])
        }
    
    # Remove MongoDB _id
    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart.get("items", []))
    
    return cart


@router.post("/cart/{session_id}/add")
async def add_to_cart(session_id: str, item: CartItem):
    """Add item to cart"""
    # Validate product exists
    product = next((p for p in PRODUCTS if p["id"] == item.productId), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get size info
    size_info = next((s for s in product["sizes"] if s["size"] == item.size), None)
    if not size_info:
        raise HTTPException(status_code=400, detail="Invalid size")
    
    # Get or create cart
    cart = await db.carts.find_one({"session_id": session_id})
    
    if not cart:
        cart = {
            "session_id": session_id,
            "items": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Check if item already in cart
    existing_item = None
    for i, cart_item in enumerate(cart.get("items", [])):
        if cart_item["productId"] == item.productId and cart_item["size"] == item.size:
            existing_item = i
            break
    
    if existing_item is not None:
        # Update quantity
        cart["items"][existing_item]["quantity"] += item.quantity
    else:
        # Add new item
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
    
    # Upsert cart
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
    
    # Find and update item
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
    
    # Remove item
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
    result = await db.carts.delete_one({"session_id": session_id})
    
    return {
        "session_id": session_id,
        "items": [],
        "pricing": calculate_pricing([]),
        "message": "Cart cleared"
    }
