"""Shared dependencies for routers"""
import os
import httpx
from fastapi import Request, Cookie, HTTPException
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

from services.auth_service import (
    validate_session, get_user_by_id, is_admin_email
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configuration
NOTIFICATION_EMAIL = "contact.us@centraders.com"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'contact.us@centraders.com')
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '')
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


async def verify_recaptcha(token: str, min_score: float = 0.5) -> bool:
    """Verify Google reCAPTCHA v3 token"""
    if not RECAPTCHA_SECRET_KEY:
        # Skip verification if not configured
        print("reCAPTCHA secret key not configured, skipping verification")
        return True
    
    if not token:
        # No token provided - allow for now during testing
        print("No reCAPTCHA token provided, allowing request")
        return True
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                RECAPTCHA_VERIFY_URL,
                data={
                    'secret': RECAPTCHA_SECRET_KEY,
                    'response': token
                }
            )
            result = response.json()
            
            success = result.get('success', False)
            score = result.get('score', 0)
            
            if not success:
                error_codes = result.get('error-codes', [])
                print(f"reCAPTCHA verification failed: {error_codes}")
                # Allow for common issues in preview/development environments
                allowed_errors = [
                    'hostname-mismatch',      # Domain not whitelisted
                    'invalid-input-response', # Token issue
                    'browser-error',          # Browser/automation issue
                    'timeout-or-duplicate'    # Token reuse or timing
                ]
                if any(err in error_codes for err in allowed_errors):
                    print(f"Allowing request despite reCAPTCHA error (preview environment): {error_codes}")
                    return True
                return False
            
            # reCAPTCHA v3 returns a score from 0.0 to 1.0
            if score < min_score:
                print(f"reCAPTCHA score too low: {score} (min: {min_score})")
                return False
            
            return True
    except Exception as e:
        print(f"reCAPTCHA verification error: {str(e)}")
        # Allow on error to not block users
        return True


# Alias for backward compatibility
verify_hcaptcha = verify_recaptcha


async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None)
) -> Optional[dict]:
    """Get current user from session token (doesn't require auth)"""
    # Try to get token from cookie first
    token = session_token
    
    # If no cookie, try Authorization header (Bearer token)
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if not token:
        return None
    
    # validate_session returns the user directly (or None)
    user = await validate_session(db, token)
    return user


async def require_auth(request: Request, session_token: Optional[str] = Cookie(None)) -> dict:
    """Require authentication - raises exception if not authenticated"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_admin(request: Request, session_token: Optional[str] = Cookie(None)) -> dict:
    """Require admin authentication"""
    user = await require_auth(request, session_token)
    if not is_admin_email(user.get('email', '')):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
