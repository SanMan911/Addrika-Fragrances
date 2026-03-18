"""Discount code public routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone

from dependencies import db

router = APIRouter(tags=["Discounts"])

# Standard gift codes
BIRTHDAY_CODE = "HAPPYBDAY"
ANNIVERSARY_CODE = "ANNIVERSARY"

# Special codes that use MRP for calculation (remove bulk discount)
SPECIAL_MRP_CODES = ["WELCOME10", "HAPPYBDAY"]


@router.post("/discount-codes/validate")
async def validate_discount_code(
    code: str, 
    subtotal: float, 
    request: Request, 
    mrp_total: float = None,  # MRP total for special code calculation
    session_token: Optional[str] = Cookie(None)
):
    """Validate a discount code"""
    from services.gift_code_service import (
        validate_birthday_code, validate_anniversary_code,
        MIN_ORDER_VALUE
    )
    
    # Global minimum cart value for any coupon
    GLOBAL_MIN_CART_VALUE = 249
    
    if subtotal < GLOBAL_MIN_CART_VALUE:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum cart value of ₹{GLOBAL_MIN_CART_VALUE} required to apply any coupon code"
        )
    
    code_upper = code.upper()
    is_special_code = code_upper in SPECIAL_MRP_CODES
    
    # Use MRP for special codes, otherwise use subtotal
    base_for_calculation = mrp_total if (is_special_code and mrp_total) else subtotal
    
    # Check for special gift codes (HAPPYBDAY, ANNIVERSARY)
    if code_upper == BIRTHDAY_CODE or code_upper == ANNIVERSARY_CODE:
        # These require user to be logged in
        user = None
        if session_token:
            session = await db.user_sessions.find_one({"session_token": session_token})
            if session:
                user_id = session.get("user_id", "")
                # Check if it's an admin session (starts with "admin_")
                if user_id.startswith("admin_"):
                    # For admin sessions, the email is after "admin_" prefix
                    admin_email = user_id[6:]  # Remove "admin_" prefix
                    user = await db.users.find_one({"email": admin_email.lower()})
                else:
                    # Regular user session
                    user = await db.users.find_one({"user_id": user_id})
        
        if not user:
            raise HTTPException(status_code=401, detail="Please login to use this gift code")
        
        # Validate based on code type - HAPPYBDAY uses MRP
        if code_upper == BIRTHDAY_CODE:
            result = await validate_birthday_code(user, base_for_calculation)
        else:
            result = await validate_anniversary_code(user, subtotal)
        
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "valid": True,
            "code": result["code"],
            "discountType": result["discount_type"],
            "discountValue": result["discount_percent"],
            "discountAmount": result["discount_amount"],
            "minOrderValue": MIN_ORDER_VALUE,
            "usageType": "gift_code",
            "isSpecialCode": is_special_code,
            "message": result["message"]
        }
    
    # Standard discount code validation
    discount_code = await db.discount_codes.find_one({
        "code": code_upper,
        "$or": [{"is_active": True}, {"isActive": True}]
    })
    
    # If not found in discount_codes, check RTO vouchers
    if not discount_code:
        rto_voucher = await db.rto_vouchers.find_one({
            "voucher_code": code_upper
        })
        
        if rto_voucher:
            # Check voucher status
            voucher_status = rto_voucher.get("status", "active")
            
            if voucher_status == "used":
                raise HTTPException(status_code=400, detail="This RTO voucher has already been used")
            
            if voucher_status == "cancelled":
                raise HTTPException(status_code=400, detail="This RTO voucher has been cancelled")
            
            if voucher_status == "voided":
                raise HTTPException(status_code=400, detail="This RTO voucher is no longer valid (order was delivered)")
            
            if voucher_status != "active":
                raise HTTPException(status_code=400, detail=f"This RTO voucher is not valid (status: {voucher_status})")
            
            # Check if voucher has expired
            expires_at = rto_voucher.get("expires_at")
            if expires_at:
                try:
                    if isinstance(expires_at, str):
                        if expires_at.endswith('Z'):
                            expiry = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                        elif '+' in expires_at:
                            expiry = datetime.fromisoformat(expires_at)
                        else:
                            expiry = datetime.fromisoformat(expires_at).replace(tzinfo=timezone.utc)
                    else:
                        expiry = expires_at
                        if expiry.tzinfo is None:
                            expiry = expiry.replace(tzinfo=timezone.utc)
                    
                    if datetime.now(timezone.utc) > expiry:
                        raise HTTPException(status_code=400, detail="This RTO voucher has expired")
                except HTTPException:
                    raise
                except Exception:
                    pass  # If parsing fails, allow the voucher
            
            # RTO vouchers are fixed-value
            voucher_value = rto_voucher.get("voucher_value", 0)
            
            # Cap at cart value
            discount_amount = min(voucher_value, subtotal)
            
            return {
                "valid": True,
                "code": rto_voucher["voucher_code"],
                "discountType": "fixed",
                "discountValue": voucher_value,
                "discountAmount": round(discount_amount, 2),
                "minOrderValue": 0,
                "usageType": "rto_voucher",
                "isSpecialCode": False,
                "voucherType": "rto_voucher",
                "message": f"RTO voucher worth ₹{voucher_value} applied"
            }
        
        raise HTTPException(status_code=404, detail="Invalid or expired discount code")
    
    # Handle both field naming conventions
    usage_type = discount_code.get("usage_type") or discount_code.get("usageType") or "universal"
    discount_type = discount_code.get("discount_type") or discount_code.get("discountType") or "percentage"
    discount_value = discount_code.get("discount_value") or discount_code.get("discountValue") or 0
    min_order_value = discount_code.get("min_order_value") or discount_code.get("minOrderValue") or 0
    max_uses = discount_code.get("max_uses") or discount_code.get("maxUses")
    times_used = discount_code.get("times_used") or discount_code.get("timesUsed") or 0
    max_discount = discount_code.get("max_discount") or discount_code.get("maxDiscount")
    expires_at = discount_code.get("expires_at") or discount_code.get("expiresAt")
    
    # Check expiry for time_bound codes
    if expires_at:
        expiry_str = expires_at
        if isinstance(expiry_str, str):
            expiry = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
        else:
            expiry = expiry_str
        
        # Make both datetimes timezone-aware for comparison
        now = datetime.now(timezone.utc)
        if expiry.tzinfo is None:
            # If expiry is naive, assume it's UTC
            expiry = expiry.replace(tzinfo=timezone.utc)
        
        if now > expiry:
            raise HTTPException(status_code=400, detail="Discount code has expired")
    
    # Check max uses for limited type codes
    if usage_type == "limited" or max_uses:
        if max_uses and times_used >= max_uses:
            raise HTTPException(status_code=400, detail="Discount code has reached maximum uses")
    
    # Check single_per_user - requires user to be logged in
    if usage_type == "single_per_user":
        # Get user from session
        user_id = None
        if session_token:
            session = await db.user_sessions.find_one({"session_token": session_token})
            if session:
                user_id = session.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Please login to use this discount code")
        
        # Check if user has already used this code
        used = await db.discount_usage.find_one({
            "code": code.upper(),
            "user_id": user_id
        })
        if used:
            raise HTTPException(status_code=400, detail="You have already used this discount code")
    
    # Check minimum order value
    if subtotal < min_order_value:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum order value of ₹{min_order_value} required for this code"
        )
    
    # Calculate discount - use MRP for special codes (WELCOME10)
    calculation_base = base_for_calculation if is_special_code else subtotal
    
    if discount_type == "percentage":
        discount_amount = calculation_base * (discount_value / 100)
        if max_discount:
            discount_amount = min(discount_amount, max_discount)
    else:
        discount_amount = discount_value
    
    return {
        "valid": True,
        "code": discount_code["code"],
        "discountType": discount_type,
        "discountValue": discount_value,
        "discountAmount": round(discount_amount, 2),
        "minOrderValue": min_order_value,
        "usageType": usage_type,
        "isSpecialCode": is_special_code
    }


@router.get("/discount-codes/available")
async def get_available_discounts(subtotal: float = 0):
    """Get available discount codes and hints for achievable ones"""
    codes = await db.discount_codes.find({
        "$or": [{"is_active": True}, {"isActive": True}]
    }).to_list(50)
    
    available = []
    hints = []
    
    now = datetime.now(timezone.utc)
    
    for code in codes:
        # Handle both field naming conventions
        expires_at = code.get("expires_at") or code.get("expiresAt")
        usage_type = code.get("usage_type") or code.get("usageType") or "universal"
        max_uses = code.get("max_uses") or code.get("maxUses")
        times_used = code.get("times_used") or code.get("timesUsed") or 0
        min_order = code.get("min_order_value") or code.get("minOrderValue") or 0
        discount_type = code.get("discount_type") or code.get("discountType") or "percentage"
        discount_value = code.get("discount_value") or code.get("discountValue") or 0
        
        # Skip expired codes
        if expires_at:
            expiry_str = expires_at
            if isinstance(expiry_str, str):
                expiry = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
            else:
                expiry = expiry_str
            
            # Make both datetimes timezone-aware for comparison
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            
            if now > expiry:
                continue
        
        # Skip maxed out limited codes
        if usage_type == "limited" or max_uses:
            if max_uses and times_used >= max_uses:
                continue
        
        code_info = {
            "code": code["code"],
            "discount_type": discount_type,
            "discount_value": discount_value,
            "min_order_value": min_order,
            "description": code.get("description", ""),
            "usage_type": usage_type
        }
        
        if subtotal >= min_order:
            available.append(code_info)
        elif min_order > 0:
            # This is a hint - show how much more to spend
            code_info["amount_needed"] = round(min_order - subtotal, 2)
            hints.append(code_info)
    
    # Sort hints by amount needed (lowest first - easiest to achieve)
    hints.sort(key=lambda x: x.get("amount_needed", 0))
    
    return {
        "available": available,
        "hints": hints[:3]  # Show top 3 achievable discounts
    }
