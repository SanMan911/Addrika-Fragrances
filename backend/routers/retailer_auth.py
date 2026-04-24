"""
Retailer Authentication Router
Handles retailer login, session management, and profile
"""
from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import logging
import secrets
import uuid

from dependencies import db
from services.auth_service import verify_password, hash_password
from services.b2b_settings import get_b2b_enabled

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-auth", tags=["Retailer Auth"])


@router.get("/portal-status")
async def get_portal_status():
    """Public endpoint: whether the B2B retailer portal is currently enabled."""
    enabled = await get_b2b_enabled(db)
    return {"enabled": enabled}


class RetailerLoginRequest(BaseModel):
    email: Optional[str] = None  # Can be email or username
    username: Optional[str] = None  # Alternative login method
    password: str


class RetailerPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# Session expiry: 7 days
RETAILER_SESSION_EXPIRY_DAYS = 7


async def create_retailer_session(retailer_id: str, retailer_email: str) -> str:
    """Create a new session for retailer"""
    session_token = secrets.token_urlsafe(32)
    session_id = f"rtl_sess_{uuid.uuid4().hex}"
    
    session = {
        "session_id": session_id,
        "retailer_id": retailer_id,
        "email": retailer_email,
        "session_token": session_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=RETAILER_SESSION_EXPIRY_DAYS)).isoformat()
    }
    
    await db.retailer_sessions.insert_one(session)
    return session_token


async def validate_retailer_session(session_token: str) -> Optional[dict]:
    """Validate retailer session and return retailer data"""
    if not session_token:
        return None
    
    session = await db.retailer_sessions.find_one({"session_token": session_token})
    if not session:
        return None
    
    # Check expiry
    expires_at = session.get('expires_at')
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            await db.retailer_sessions.delete_one({"session_token": session_token})
            return None
    
    # Get retailer data
    retailer = await db.retailers.find_one(
        {"retailer_id": session['retailer_id']},
        {"_id": 0, "password_hash": 0}
    )
    
    if not retailer or retailer.get('status') != 'active':
        return None
    
    return retailer


async def get_current_retailer(request: Request, retailer_session: Optional[str] = Cookie(None)) -> Optional[dict]:
    """Get current retailer from session cookie or auth header"""
    token = retailer_session
    
    # Also check Authorization header
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if not token:
        return None
    
    return await validate_retailer_session(token)


@router.post("/login")
async def retailer_login(login_data: RetailerLoginRequest, response: Response):
    """Retailer login endpoint - supports email or username"""
    # Kill-switch: block login when B2B portal is disabled
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="Retailer portal is currently unavailable. Please contact Addrika for access.",
        )

    identifier = login_data.email or login_data.username
    
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or username is required")
    
    identifier = identifier.lower().strip()
    
    # Find retailer by email or username
    retailer = await db.retailers.find_one({
        "$or": [
            {"email": identifier},
            {"username": identifier}
        ]
    })
    
    if not retailer:
        raise HTTPException(status_code=401, detail="Invalid email/username or password")
    
    # Check status
    if retailer.get('status') == 'suspended':
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact admin.")
    
    if retailer.get('status') == 'deleted':
        raise HTTPException(status_code=403, detail="Account not found")
    
    # Verify password
    if not verify_password(login_data.password, retailer.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid email/username or password")
    
    # Create session
    email = retailer.get('email', identifier)
    session_token = await create_retailer_session(retailer['retailer_id'], email)
    
    # Set cookie
    response.set_cookie(
        key="retailer_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=RETAILER_SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    # Update last login
    await db.retailers.update_one(
        {"retailer_id": retailer['retailer_id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"Retailer logged in: {retailer['retailer_id']}")
    
    return {
        "message": "Login successful",
        "retailer": {
            "retailer_id": retailer['retailer_id'],
            "name": retailer['name'],
            "email": retailer['email'],
            "city": retailer.get('city'),
            "district": retailer.get('district'),
            "state": retailer.get('state')
        },
        "token": session_token
    }


@router.post("/logout")
async def retailer_logout(
    response: Response,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Retailer logout endpoint"""
    token = retailer_session
    
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if token:
        await db.retailer_sessions.delete_one({"session_token": token})
    
    response.delete_cookie("retailer_session")
    
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_retailer_profile(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get current retailer's profile"""
    retailer = await get_current_retailer(request, retailer_session)
    
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {"retailer": retailer}


@router.post("/change-password")
async def change_retailer_password(
    password_data: RetailerPasswordChange,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Change retailer password"""
    retailer = await get_current_retailer(request, retailer_session)
    
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get full retailer record with password
    full_retailer = await db.retailers.find_one({"retailer_id": retailer['retailer_id']})
    
    # Verify current password
    if not verify_password(password_data.current_password, full_retailer.get('password_hash', '')):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    new_hash = hash_password(password_data.new_password)
    await db.retailers.update_one(
        {"retailer_id": retailer['retailer_id']},
        {
            "$set": {
                "password_hash": new_hash,
                "password_changed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Retailer {retailer['retailer_id']} changed password")
    
    return {"message": "Password changed successfully"}


@router.get("/validate")
async def validate_retailer_token(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Validate retailer session token"""
    retailer = await get_current_retailer(request, retailer_session)
    
    return {
        "valid": retailer is not None,
        "retailer": retailer
    }
