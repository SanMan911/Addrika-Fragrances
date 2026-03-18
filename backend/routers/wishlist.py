"""
Wishlist Routes for Addrika
Handles wishlist CRUD operations and shareable wishlists
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import secrets

from dependencies import db, get_current_user

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


class WishlistItem(BaseModel):
    productId: str
    name: str
    size: str
    price: float
    mrp: float
    image: Optional[str] = None


class AddToWishlistRequest(BaseModel):
    item: WishlistItem


class ShareWishlistRequest(BaseModel):
    recipient_name: Optional[str] = None
    message: Optional[str] = None


def generate_share_code():
    """Generate a unique 8-character share code"""
    return secrets.token_urlsafe(6)[:8].upper()


@router.get("")
async def get_wishlist(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get user's wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to view your wishlist")
    
    user_id = str(user.get("_id", ""))
    
    wishlist = await db.wishlists.find_one({"user_id": user_id})
    
    if not wishlist:
        return {"items": [], "share_code": None, "is_shared": False}
    
    return {
        "items": wishlist.get("items", []),
        "share_code": wishlist.get("share_code"),
        "is_shared": wishlist.get("is_shared", False),
        "share_message": wishlist.get("share_message"),
        "recipient_name": wishlist.get("recipient_name"),
        "created_at": wishlist.get("created_at"),
        "updated_at": wishlist.get("updated_at")
    }


@router.post("/add")
async def add_to_wishlist(request: Request, data: AddToWishlistRequest, session_token: Optional[str] = Cookie(None)):
    """Add item to wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to add items to wishlist")
    
    user_id = str(user.get("_id", ""))
    item = data.item.dict()
    item["added_at"] = datetime.now(timezone.utc).isoformat()
    
    # Find or create wishlist
    wishlist = await db.wishlists.find_one({"user_id": user_id})
    
    if wishlist:
        # Check if item already exists (same product + size)
        existing_items = wishlist.get("items", [])
        item_exists = any(
            i.get("productId") == item["productId"] and i.get("size") == item["size"]
            for i in existing_items
        )
        
        if item_exists:
            return {"message": "Item already in wishlist", "items": existing_items}
        
        # Add new item
        await db.wishlists.update_one(
            {"user_id": user_id},
            {
                "$push": {"items": item},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        existing_items.append(item)
        return {"message": "Item added to wishlist", "items": existing_items}
    else:
        # Create new wishlist
        new_wishlist = {
            "user_id": user_id,
            "user_name": user.get("name", ""),
            "user_email": user.get("email", ""),
            "items": [item],
            "is_shared": False,
            "share_code": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wishlists.insert_one(new_wishlist)
        return {"message": "Wishlist created", "items": [item]}


@router.delete("/remove/{product_id}/{size}")
async def remove_from_wishlist(request: Request, product_id: str, size: str, session_token: Optional[str] = Cookie(None)):
    """Remove item from wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to manage your wishlist")
    
    user_id = str(user.get("_id", ""))
    
    # First check if item exists in wishlist
    wishlist = await db.wishlists.find_one({"user_id": user_id})
    if not wishlist:
        raise HTTPException(status_code=404, detail="Wishlist not found")
    
    # Check if item exists
    existing_items = wishlist.get("items", [])
    item_exists = any(
        i.get("productId") == product_id and i.get("size") == size
        for i in existing_items
    )
    
    if not item_exists:
        raise HTTPException(status_code=404, detail="Item not found in wishlist")
    
    # Remove the item
    await db.wishlists.update_one(
        {"user_id": user_id},
        {
            "$pull": {"items": {"productId": product_id, "size": size}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Get updated wishlist
    updated_wishlist = await db.wishlists.find_one({"user_id": user_id})
    return {"message": "Item removed", "items": updated_wishlist.get("items", [])}


@router.post("/share")
async def share_wishlist(request: Request, data: ShareWishlistRequest, session_token: Optional[str] = Cookie(None)):
    """Generate or update shareable link for wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to share your wishlist")
    
    user_id = str(user.get("_id", ""))
    
    wishlist = await db.wishlists.find_one({"user_id": user_id})
    if not wishlist:
        raise HTTPException(status_code=404, detail="No wishlist found. Add items first!")
    
    if not wishlist.get("items"):
        raise HTTPException(status_code=400, detail="Cannot share an empty wishlist")
    
    # Generate or reuse share code
    share_code = wishlist.get("share_code") or generate_share_code()
    
    await db.wishlists.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "share_code": share_code,
                "is_shared": True,
                "share_message": data.message,
                "recipient_name": data.recipient_name,
                "shared_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Wishlist is now shareable",
        "share_code": share_code,
        "share_url": f"/wishlist/shared/{share_code}"
    }


@router.delete("/share")
async def unshare_wishlist(request: Request, session_token: Optional[str] = Cookie(None)):
    """Disable sharing for wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to manage your wishlist")
    
    user_id = str(user.get("_id", ""))
    
    await db.wishlists.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_shared": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Wishlist sharing disabled"}


@router.get("/shared/{share_code}")
async def get_shared_wishlist(share_code: str):
    """Get a shared wishlist by share code (public endpoint)"""
    wishlist = await db.wishlists.find_one({
        "share_code": share_code.upper(),
        "is_shared": True
    })
    
    if not wishlist:
        raise HTTPException(status_code=404, detail="Wishlist not found or no longer shared")
    
    return {
        "owner_name": wishlist.get("user_name", "Someone"),
        "message": wishlist.get("share_message"),
        "recipient_name": wishlist.get("recipient_name"),
        "items": wishlist.get("items", []),
        "share_code": share_code.upper(),
        "created_at": wishlist.get("created_at"),
        "can_purchase": True  # Recipients can purchase items
    }


@router.post("/shared/{share_code}/checkout")
async def checkout_shared_wishlist(share_code: str, request: Request):
    """
    Prepare checkout for a shared wishlist.
    Returns items ready to be added to cart for gift purchase.
    """
    wishlist = await db.wishlists.find_one({
        "share_code": share_code.upper(),
        "is_shared": True
    })
    
    if not wishlist:
        raise HTTPException(status_code=404, detail="Wishlist not found or no longer shared")
    
    items = wishlist.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Wishlist is empty")
    
    # Calculate totals
    mrp_total = sum(item.get("mrp", item.get("price", 0)) for item in items)
    
    return {
        "items": items,
        "owner_name": wishlist.get("user_name", "Someone"),
        "owner_email": wishlist.get("user_email"),  # For gift notification
        "message": wishlist.get("share_message"),
        "mrp_total": mrp_total,
        "is_gift": True,
        "gift_for": wishlist.get("user_name", "the wishlist owner")
    }


@router.post("/clear")
async def clear_wishlist(request: Request, session_token: Optional[str] = Cookie(None)):
    """Clear all items from wishlist"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Please login to manage your wishlist")
    
    user_id = str(user.get("_id", ""))
    
    await db.wishlists.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "items": [],
                "is_shared": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Wishlist cleared", "items": []}
