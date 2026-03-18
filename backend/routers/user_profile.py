"""User Profile & Addresses Routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

from dependencies import db, get_current_user

router = APIRouter(prefix="/user", tags=["User Profile"])


# ===================== Pydantic Models =====================

class AddressCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50, description="Address nickname e.g. 'Home', 'Office'")
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    address_line1: str = Field(..., min_length=5, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r'^\d{6}$')
    is_default: bool = False


class AddressUpdate(BaseModel):
    nickname: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    address_line1: Optional[str] = Field(None, min_length=5, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    pincode: Optional[str] = Field(None, pattern=r'^\d{6}$')
    is_default: Optional[bool] = None


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., description="Current password for verification")
    reason: Optional[str] = Field(None, max_length=500, description="Optional reason for deletion")
    confirm_text: str = Field(..., description="Must be 'DELETE MY ACCOUNT'")


# ===================== Address Management =====================

@router.get("/addresses")
async def get_addresses(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get all saved addresses for the current user"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    addresses = await db.user_addresses.find(
        {"user_id": user['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"addresses": addresses}


@router.post("/addresses")
async def create_address(
    address_data: AddressCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Create a new saved address"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if nickname already exists for this user
    existing = await db.user_addresses.find_one({
        "user_id": user['user_id'],
        "nickname": {"$regex": f"^{address_data.nickname}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"An address with nickname '{address_data.nickname}' already exists")
    
    # If this is the first address or is_default is True, make it default
    address_count = await db.user_addresses.count_documents({"user_id": user['user_id']})
    is_default = address_data.is_default or address_count == 0
    
    # If setting as default, unset other defaults
    if is_default:
        await db.user_addresses.update_many(
            {"user_id": user['user_id']},
            {"$set": {"is_default": False}}
        )
    
    address_id = f"addr_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    address_doc = {
        "address_id": address_id,
        "user_id": user['user_id'],
        "nickname": address_data.nickname,
        "name": address_data.name,
        "phone": address_data.phone,
        "address_line1": address_data.address_line1,
        "address_line2": address_data.address_line2 or "",
        "city": address_data.city,
        "state": address_data.state,
        "pincode": address_data.pincode,
        "is_default": is_default,
        "created_at": now,
        "updated_at": now
    }
    
    await db.user_addresses.insert_one(address_doc)
    
    # Remove _id for response
    address_doc.pop("_id", None)
    
    return {"message": "Address saved successfully", "address": address_doc}


@router.put("/addresses/{address_id}")
async def update_address(
    address_id: str,
    address_data: AddressUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Update an existing address"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the address
    address = await db.user_addresses.find_one({
        "address_id": address_id,
        "user_id": user['user_id']
    })
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Check if nickname is being changed and if new nickname already exists
    if address_data.nickname and address_data.nickname.lower() != address['nickname'].lower():
        existing = await db.user_addresses.find_one({
            "user_id": user['user_id'],
            "nickname": {"$regex": f"^{address_data.nickname}$", "$options": "i"},
            "address_id": {"$ne": address_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"An address with nickname '{address_data.nickname}' already exists")
    
    # Build update dict with only provided fields
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field, value in address_data.dict(exclude_unset=True).items():
        if value is not None:
            update_dict[field] = value
    
    # Handle default setting
    if address_data.is_default:
        await db.user_addresses.update_many(
            {"user_id": user['user_id'], "address_id": {"$ne": address_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.user_addresses.update_one(
        {"address_id": address_id},
        {"$set": update_dict}
    )
    
    # Get updated address
    updated_address = await db.user_addresses.find_one(
        {"address_id": address_id},
        {"_id": 0}
    )
    
    return {"message": "Address updated successfully", "address": updated_address}


@router.delete("/addresses/{address_id}")
async def delete_address(
    address_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Delete a saved address"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the address
    address = await db.user_addresses.find_one({
        "address_id": address_id,
        "user_id": user['user_id']
    })
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    was_default = address.get('is_default', False)
    
    # Delete the address
    await db.user_addresses.delete_one({"address_id": address_id})
    
    # If deleted address was default, make the most recent one default
    if was_default:
        latest_address = await db.user_addresses.find_one(
            {"user_id": user['user_id']},
            sort=[("created_at", -1)]
        )
        if latest_address:
            await db.user_addresses.update_one(
                {"address_id": latest_address['address_id']},
                {"$set": {"is_default": True}}
            )
    
    return {"message": "Address deleted successfully"}


@router.put("/addresses/{address_id}/set-default")
async def set_default_address(
    address_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Set an address as the default"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the address
    address = await db.user_addresses.find_one({
        "address_id": address_id,
        "user_id": user['user_id']
    })
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Unset all other defaults
    await db.user_addresses.update_many(
        {"user_id": user['user_id']},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.user_addresses.update_one(
        {"address_id": address_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"'{address['nickname']}' set as default address"}


# ===================== GDPR Account Deletion =====================

@router.post("/delete-account")
async def delete_account(
    delete_request: DeleteAccountRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    GDPR-compliant account deletion.
    - Verifies password
    - Requires explicit confirmation text
    - Anonymizes order history (keeps for business records)
    - Deletes personal data
    """
    from services.auth_service import verify_password
    
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify confirmation text
    if delete_request.confirm_text != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=400, 
            detail="Please type 'DELETE MY ACCOUNT' exactly to confirm deletion"
        )
    
    # Check if user has a password (not Google OAuth only)
    stored_password = user.get('password_hash')
    if stored_password:
        if not verify_password(delete_request.password, stored_password):
            raise HTTPException(status_code=400, detail="Incorrect password")
    else:
        # For Google OAuth users, password field should be their Google email
        if delete_request.password != user.get('email'):
            raise HTTPException(
                status_code=400, 
                detail="For social login accounts, enter your email address to confirm"
            )
    
    user_id = user['user_id']
    user_email = user.get('email', 'unknown')
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Anonymize orders (keep for business/tax records)
    await db.orders.update_many(
        {"user_id": user_id},
        {"$set": {
            "billing.name": "DELETED USER",
            "billing.email": "deleted@deleted.com",
            "billing.phone": "0000000000",
            "shipping.name": "DELETED USER",
            "shipping.phone": "0000000000",
            "user_deleted": True,
            "user_deleted_at": now
        }}
    )
    
    # 2. Delete saved addresses
    await db.user_addresses.delete_many({"user_id": user_id})
    
    # 3. Delete wishlist
    await db.wishlists.delete_many({"user_id": user_id})
    
    # 4. Delete cart
    await db.carts.delete_many({"user_id": user_id})
    
    # 5. Anonymize reviews (keep content, remove identity)
    await db.reviews.update_many(
        {"user_id": user_id},
        {"$set": {
            "reviewer_name": "Deleted User",
            "reviewer_email": "deleted@deleted.com",
            "user_deleted": True
        }}
    )
    
    # 6. Delete user sessions
    await db.sessions.delete_many({"user_id": user_id})
    
    # 7. Log deletion for audit trail
    deletion_log = {
        "log_id": f"deletion_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "user_email_hash": hash(user_email),  # Store hash for audit, not email
        "reason": delete_request.reason or "Not provided",
        "deleted_at": now,
        "data_deleted": ["user_profile", "addresses", "wishlist", "cart", "sessions"],
        "data_anonymized": ["orders", "reviews"]
    }
    await db.account_deletions.insert_one(deletion_log)
    
    # 8. Delete the user account
    await db.users.delete_one({"user_id": user_id})
    
    return {
        "message": "Account deleted successfully",
        "details": "Your personal data has been deleted. Order history has been anonymized for legal/tax compliance."
    }


# ===================== Profile Stats =====================

@router.get("/profile-stats")
async def get_profile_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get user profile statistics"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user['user_id']
    
    # Count orders
    order_count = await db.orders.count_documents({"user_id": user_id})
    
    # Count addresses
    address_count = await db.user_addresses.count_documents({"user_id": user_id})
    
    # Count wishlist items
    wishlist = await db.wishlists.find_one({"user_id": user_id})
    wishlist_count = len(wishlist.get('product_ids', [])) if wishlist else 0
    
    # Total spent
    pipeline = [
        {"$match": {"user_id": user_id, "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$pricing.final_amount"}}}
    ]
    total_result = await db.orders.aggregate(pipeline).to_list(1)
    total_spent = total_result[0]['total'] if total_result else 0
    
    return {
        "order_count": order_count,
        "address_count": address_count,
        "wishlist_count": wishlist_count,
        "total_spent": total_spent,
        "member_since": user.get('created_at', 'Unknown')
    }
