"""Admin authentication routes"""
from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta
import secrets
import logging

from services.auth_service import (
    create_session, verify_admin_pin, change_admin_pin, is_admin_email
)
from services.email_service import generate_otp, send_admin_2fa_otp
from dependencies import db, require_admin, ADMIN_EMAIL

router = APIRouter(tags=["Admin Auth"])
logger = logging.getLogger(__name__)

# MongoDB collection for 2FA tokens (persists across server restarts)
ADMIN_2FA_COLLECTION = "admin_2fa_tokens"


async def store_2fa_token(token_id: str, email: str, otp: str):
    """Store 2FA token in MongoDB with TTL"""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    await db[ADMIN_2FA_COLLECTION].insert_one({
        "token_id": token_id,
        "email": email,
        "otp": otp,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "attempts": 0
    })
    # Create TTL index if not exists (auto-delete expired tokens)
    await db[ADMIN_2FA_COLLECTION].create_index("expires_at", expireAfterSeconds=0)


async def get_2fa_token(token_id: str):
    """Get 2FA token from MongoDB"""
    return await db[ADMIN_2FA_COLLECTION].find_one({"token_id": token_id})


async def update_2fa_attempts(token_id: str):
    """Increment failed attempts"""
    await db[ADMIN_2FA_COLLECTION].update_one(
        {"token_id": token_id},
        {"$inc": {"attempts": 1}}
    )


async def delete_2fa_token(token_id: str):
    """Delete 2FA token after use"""
    await db[ADMIN_2FA_COLLECTION].delete_one({"token_id": token_id})


@router.post("/login/initiate")
async def admin_login_initiate(request: Request):
    """Step 1: Admin login - verify email and PIN, send OTP"""
    try:
        body = await request.json()
        email = body.get('email', '')
        pin = body.get('pin', '')
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    if not email or not pin:
        raise HTTPException(status_code=400, detail="Email and PIN are required")
    
    if not is_admin_email(email):
        raise HTTPException(status_code=403, detail="Not an admin email")
    
    # Verify PIN
    if not await verify_admin_pin(db, email, pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Generate OTP and store it in MongoDB (persists across restarts)
    otp = generate_otp()
    token_id = secrets.token_urlsafe(32)
    
    # Remove any existing tokens for this email first
    await db[ADMIN_2FA_COLLECTION].delete_many({"email": email})
    
    # Store new token in MongoDB
    await store_2fa_token(token_id, email, otp)
    
    # Send OTP email
    email_sent = await send_admin_2fa_otp(email, otp)
    
    if not email_sent:
        logger.warning(f"Failed to send 2FA email to {email}, but continuing for testing")
    
    logger.info(f"Admin 2FA initiated for {email}, token_id: {token_id[:10]}...")
    
    return {
        "message": "OTP sent to your email",
        "token_id": token_id,
        "email_masked": f"{email[:3]}***{email[email.index('@'):]}"
    }


@router.post("/login/verify-otp")
async def admin_login_verify_otp(response: Response, request: Request):
    """Step 2: Admin login - verify OTP and complete login"""
    try:
        body = await request.json()
        token_id = body.get('token_id', '')
        otp = body.get('otp', '')
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    if not token_id or not otp:
        raise HTTPException(status_code=400, detail="Token ID and OTP are required")
    
    # Check if token exists in MongoDB
    token_data = await get_2fa_token(token_id)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired session. Please login again.")
    
    # Check expiration
    expires_at = token_data['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        await delete_2fa_token(token_id)
        raise HTTPException(status_code=400, detail="OTP has expired. Please login again.")
    
    # Check attempts (max 3)
    if token_data['attempts'] >= 3:
        await delete_2fa_token(token_id)
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please login again.")
    
    # Verify OTP
    if otp != token_data['otp']:
        await update_2fa_attempts(token_id)
        remaining = 3 - token_data['attempts'] - 1
        raise HTTPException(status_code=401, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # OTP verified - complete login
    email = token_data['email']
    await delete_2fa_token(token_id)  # Clean up
    
    # Create admin session
    admin_user_id = f"admin_{email}"
    session_token = await create_session(db, admin_user_id)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=24 * 60 * 60  # 24 hours
    )
    
    logger.info(f"Admin 2FA login successful for {email}")
    
    return {
        "message": "Admin login successful",
        "user": {
            "user_id": admin_user_id,
            "email": email,
            "name": "Admin",
            "is_admin": True
        },
        "session_token": session_token,
        "is_admin": True
    }


@router.post("/login")
async def admin_login(response: Response, request: Request):
    """Legacy admin login - redirects to 2FA flow"""
    raise HTTPException(
        status_code=400, 
        detail="Please use the new 2FA login flow: /admin/login/initiate followed by /admin/login/verify-otp"
    )


@router.post("/change-pin")
async def admin_change_pin(request: Request, old_pin: str, new_pin: str, session_token: Optional[str] = Cookie(None)):
    """Change admin PIN"""
    user = await require_admin(request, session_token)
    email = user.get('email', ADMIN_EMAIL)
    
    success = await change_admin_pin(db, email, old_pin, new_pin)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid old PIN")
    
    return {"message": "PIN changed successfully"}


@router.get("/check")
async def admin_check(request: Request, session_token: Optional[str] = Cookie(None)):
    """Check if current user is admin"""
    try:
        await require_admin(request, session_token)
        return {"is_admin": True}
    except HTTPException:
        return {"is_admin": False}


@router.post("/change-password")
async def admin_change_password(request: Request, session_token: Optional[str] = Cookie(None)):
    """
    Change admin password/PIN.
    Requires current password verification.
    """
    await require_admin(request, session_token)
    
    try:
        body = await request.json()
        current_password = body.get('currentPassword') or body.get('current_password')
        new_password = body.get('newPassword') or body.get('new_password')
        confirm_password = body.get('confirmPassword') or body.get('confirm_password')
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    # Validation
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password are required")
    
    if confirm_password and new_password != confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")
    
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    
    if new_password == current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Attempt to change password
    success = await change_admin_pin(db, ADMIN_EMAIL, current_password, new_password)
    
    if not success:
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    logger.info(f"Admin password changed successfully for {ADMIN_EMAIL}")
    
    return {"message": "Password changed successfully"}


@router.get("/stats")
async def admin_get_stats(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get admin dashboard statistics"""
    await require_admin(request, session_token)
    
    # Get order stats
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"order_status": "pending"})
    
    # Get revenue - match orders where payment is confirmed (paid or completed)
    pipeline = [
        {"$match": {"payment_status": {"$in": ["paid", "completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$pricing.final_total"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Get user stats
    total_users = await db.users.count_documents({})
    
    # Get inquiry stats
    total_inquiries = await db.inquiries.count_documents({})
    pending_inquiries = await db.inquiries.count_documents({"status": "pending"})
    
    # Get review stats
    pending_reviews = await db.reviews.count_documents({"is_approved": False})
    
    # Get low stock alerts
    low_stock = await db.product_stock.count_documents({
        "$expr": {"$lte": ["$stock", "$low_stock_threshold"]}
    })
    
    return {
        "orders": {
            "total": total_orders,
            "pending": pending_orders
        },
        "revenue": {
            "total": round(total_revenue, 2)
        },
        "users": {
            "total": total_users
        },
        "inquiries": {
            "total": total_inquiries,
            "pending": pending_inquiries
        },
        "reviews": {
            "pending": pending_reviews
        },
        "inventory": {
            "low_stock_alerts": low_stock
        }
    }
