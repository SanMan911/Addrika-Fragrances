"""Authentication service for Addrika"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import httpx
from jose import jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'addrika_secret_key_change_in_production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'contact.us@centraders.com')
ADMIN_DEFAULT_PIN = os.environ.get('ADMIN_DEFAULT_PIN', '110078')


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_jwt_token(user_id: str, email: str) -> str:
    """Create a JWT token for user"""
    expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expires,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[dict]:
    """Get user by email"""
    user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
    return user


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[dict]:
    """Get user by user_id"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


async def create_user(
    db: AsyncIOMotorDatabase,
    email: str,
    name: str,
    password: Optional[str] = None,
    phone: Optional[str] = None,
    alternate_phone: Optional[str] = None,  # Optional alternate phone
    picture: Optional[str] = None,
    salutation: Optional[str] = None,
    gender: Optional[str] = None,  # Male, Female, Other
    date_of_birth: Optional[str] = None,  # YYYY-MM-DD format
    date_of_marriage: Optional[str] = None,  # YYYY-MM-DD format (for gift codes)
    auth_provider: str = 'email',
    address: Optional[str] = None,
    landmark: Optional[str] = None,  # Nearby landmark for delivery
    city: Optional[str] = None,
    state: Optional[str] = None,
    pincode: Optional[str] = None,
    username: Optional[str] = None  # Unique login name/user ID
) -> dict:
    """Create a new user"""
    now = datetime.now(timezone.utc)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_data = {
        "user_id": user_id,
        "email": email.lower(),
        "username": username.lower() if username else None,  # Store lowercase for uniqueness
        "name": name,
        "phone": phone,
        "alternate_phone": alternate_phone,
        "salutation": salutation,
        "gender": gender,
        "date_of_birth": date_of_birth,
        "date_of_marriage": date_of_marriage,
        "picture": picture,
        "auth_provider": auth_provider,
        "password_hash": hash_password(password) if password else None,
        "is_verified": auth_provider == 'google',  # Google users are auto-verified
        "address": address,
        "landmark": landmark,
        "city": city,
        "state": state,
        "pincode": pincode,
        "fcm_token": None,  # Firebase Cloud Messaging token
        "push_enabled": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_data)
    
    # Return without password_hash and _id
    user_data.pop('password_hash', None)
    user_data.pop('_id', None)
    return user_data


async def create_session(db: AsyncIOMotorDatabase, user_id: str) -> str:
    """Create a new user session and return the session token"""
    now = datetime.now(timezone.utc)
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = now + timedelta(days=JWT_EXPIRATION_DAYS)
    
    session_data = {
        "session_id": f"sid_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": now
    }
    
    await db.user_sessions.insert_one(session_data)
    return session_token


async def validate_session(db: AsyncIOMotorDatabase, session_token: str) -> Optional[dict]:
    """Validate a session token and return the user"""
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiry with timezone awareness
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Session expired, delete it
        await db.user_sessions.delete_one({"session_token": session_token})
        return None
    
    user_id = session["user_id"]
    
    # Check if this is an admin session
    if user_id.startswith("admin_"):
        # Return a synthetic admin user object
        admin_email = user_id[6:]  # Remove "admin_" prefix
        return {
            "user_id": user_id,
            "email": admin_email,
            "name": "Admin",
            "is_admin": True
        }
    
    # Get regular user
    user = await get_user_by_id(db, user_id)
    return user


async def delete_session(db: AsyncIOMotorDatabase, session_token: str):
    """Delete a user session"""
    await db.user_sessions.delete_one({"session_token": session_token})


async def get_google_session_data(session_id: str) -> Optional[dict]:
    """Get user data from Emergent Google OAuth session"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Google session fetch failed: {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"Error fetching Google session: {e}")
        return None


# ===================== Admin Authentication =====================

async def init_admin_settings(db: AsyncIOMotorDatabase):
    """Initialize admin settings if not exists"""
    existing = await db.admin_settings.find_one({"admin_email": ADMIN_EMAIL})
    if not existing:
        admin_settings = {
            "admin_email": ADMIN_EMAIL,
            "pin_hash": hash_password(ADMIN_DEFAULT_PIN),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.admin_settings.insert_one(admin_settings)
        logger.info(f"Admin settings initialized for {ADMIN_EMAIL}")


async def verify_admin_pin(db: AsyncIOMotorDatabase, email: str, pin: str) -> bool:
    """Verify admin PIN"""
    settings = await db.admin_settings.find_one({"admin_email": email.lower()})
    logger.info(f"[Admin PIN] Checking for email: {email.lower()}, found: {settings is not None}")
    if not settings:
        # Fallback: check with default PIN if no settings exist
        logger.info(f"[Admin PIN] No settings found, using default PIN: {ADMIN_DEFAULT_PIN}")
        return pin == ADMIN_DEFAULT_PIN
    result = verify_password(pin, settings["pin_hash"])
    logger.info(f"[Admin PIN] Password verify result: {result}")
    return result


async def change_admin_pin(db: AsyncIOMotorDatabase, email: str, old_pin: str, new_pin: str) -> bool:
    """Change admin PIN"""
    if not await verify_admin_pin(db, email, old_pin):
        return False
    
    await db.admin_settings.update_one(
        {"admin_email": email.lower()},
        {"$set": {
            "pin_hash": hash_password(new_pin),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return True


def is_admin_email(email: str) -> bool:
    """Check if email is admin email"""
    return email.lower() == ADMIN_EMAIL.lower()
