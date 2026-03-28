"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Response, Request, Cookie
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import re
import logging

from models.users import UserCreate, UserLogin
from services.auth_service import (
    verify_password, get_user_by_email, create_user, create_session,
    delete_session, get_google_session_data, is_admin_email,
    hash_password
)
from services.email_service import send_otp_email, generate_otp, is_email_service_available
from dependencies import db, verify_hcaptcha, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


# Pydantic models for OTP
class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

class RegisterWithOTP(BaseModel):
    email: str
    password: str
    name: str
    username: Optional[str] = None  # Unique login name/user ID chosen by user
    phone: str  # Required - for duplicate checking
    country_code: Optional[str] = "+91"
    alternate_phone: Optional[str] = None  # Optional alternate phone number
    salutation: Optional[str] = None
    gender: Optional[str] = None  # Male, Female, Other
    date_of_birth: Optional[str] = None  # YYYY-MM-DD format
    date_of_marriage: Optional[str] = None  # YYYY-MM-DD format (optional, for gift codes)
    otp: str
    # Address fields - now required
    address: str  # Street address
    landmark: Optional[str] = None  # Nearby landmark for delivery
    city: str
    state: str
    pincode: str


def validate_username(username: str) -> tuple[bool, str]:
    """Validate username - alphanumeric, underscores, no spaces, 3-30 chars, case-sensitive"""
    if not username:
        return True, ""  # Optional field
    username = username.strip()
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    if len(username) > 30:
        return False, "Username cannot exceed 30 characters"
    username_regex = r'^[a-zA-Z0-9_]+$'
    if not re.match(username_regex, username):
        return False, "Username can only contain letters, numbers, and underscores"
    # Cannot start with a number
    if username[0].isdigit():
        return False, "Username cannot start with a number"
    # Check for blocked usernames (case-insensitive check)
    blocked_usernames = ["sanman911", "911sanman", "sanman"]
    if username.lower() in blocked_usernames:
        return False, "This username is not available"
    return True, ""


# Validation functions
def validate_name(name: str) -> tuple[bool, str]:
    """Validate name - only letters, spaces, and basic punctuation"""
    if not name or not name.strip():
        return False, "Name is required"
    name_regex = r'^[a-zA-Z\s.\'-]+$'
    if not re.match(name_regex, name):
        return False, "Name should contain only letters (no special characters)"
    if len(name) < 2:
        return False, "Name must be at least 2 characters"
    return True, ""


def validate_email(email: str) -> tuple[bool, str]:
    """Validate email - only allow @, ., -, _ as special characters"""
    if not email or not email.strip():
        return False, "Email is required"
    # Check for valid characters (alphanumeric + @, ., -, _)
    email_char_regex = r'^[a-zA-Z0-9@.\-_]+$'
    if not re.match(email_char_regex, email):
        return False, "Email can only contain letters, numbers, @, ., -, _"
    # Basic email format check
    email_format_regex = r'^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_format_regex, email):
        return False, "Invalid email format"
    return True, ""


def validate_phone(phone: str) -> tuple[bool, str]:
    """Validate phone - only numbers allowed"""
    if not phone:  # Optional field
        return True, ""
    phone_regex = r'^[0-9]+$'
    if not re.match(phone_regex, phone):
        return False, "Phone should contain only numbers"
    if len(phone) < 6 or len(phone) > 15:
        return False, "Phone number must be 6-15 digits"
    return True, ""


@router.post("/send-otp")
async def send_registration_otp(request: OTPRequest, captcha_token: Optional[str] = None):
    """Send OTP to email for verification"""
    # Validate email format
    is_valid, error_msg = validate_email(request.email)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    email = request.email.lower().strip()
    
    # Verify hCaptcha if token provided
    if captcha_token:
        if not await verify_hcaptcha(captcha_token):
            raise HTTPException(status_code=400, detail="Captcha verification failed")
    
    # Check if email already registered
    existing_user = await get_user_by_email(db, email)
    if existing_user:
        if existing_user.get('auth_provider') == 'google':
            raise HTTPException(status_code=400, detail="This email is registered with Google. Please use Google login.")
        raise HTTPException(status_code=400, detail="Email already registered. Please login instead.")
    
    # Generate OTP
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in database
    await db.otp_verifications.delete_many({"email": email})  # Remove old OTPs
    await db.otp_verifications.insert_one({
        "email": email,
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Check if email service is available at runtime
    if not is_email_service_available():
        # Email service not configured, return OTP directly (dev mode)
        return {
            "message": "OTP generated (DEV MODE - email not configured)",
            "expires_in_minutes": 10,
            "dev_otp": otp,
            "note": "In production, OTP will be sent to email. Please configure Resend API key (re_...) for email functionality."
        }
    
    # Try to send OTP email
    sent = await send_otp_email(email, otp)
    if not sent:
        # Fall back to showing OTP if email fails
        return {
            "message": "OTP generated (email sending failed)",
            "expires_in_minutes": 10,
            "dev_otp": otp,
            "note": "Email sending failed. Using fallback OTP display."
        }
    
    # Email sent successfully - do NOT return the OTP
    return {"message": "OTP sent to your email", "expires_in_minutes": 10}


@router.post("/verify-otp")
async def verify_registration_otp(request: OTPVerify):
    """Verify the OTP"""
    email = request.email.lower().strip()
    
    # Find OTP record
    otp_record = await db.otp_verifications.find_one({
        "email": email,
        "verified": False
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    # Check expiry
    expires_at = otp_record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.otp_verifications.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.otp_verifications.update_one(
        {"_id": otp_record["_id"]},
        {"$set": {"verified": True}}
    )
    
    return {"message": "Email verified successfully", "verified": True}


@router.post("/register-with-otp")
async def register_user_with_otp(user_data: RegisterWithOTP):
    """Register a new user after OTP verification"""
    email = user_data.email.lower().strip()
    
    # Validate all fields
    is_valid, error_msg = validate_name(user_data.name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    is_valid, error_msg = validate_email(email)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    if user_data.phone:
        is_valid, error_msg = validate_phone(user_data.phone)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate username if provided
    username = None
    if user_data.username:
        is_valid, error_msg = validate_username(user_data.username)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        username = user_data.username.strip()  # Keep original case for display
        username_lower = username.lower()  # Lowercase for uniqueness check
        # Check if username is already taken (case-insensitive)
        existing_username = await db.users.find_one({"username_lower": username_lower})
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken. Please choose a different one.")
    
    # Check OTP verification
    otp_record = await db.otp_verifications.find_one({
        "email": email,
        "otp": user_data.otp,
        "verified": True
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Email not verified. Please verify your email first.")
    
    # Check if user already exists with this email
    existing_user = await get_user_by_email(db, email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if phone number is already registered
    if user_data.phone:
        formatted_phone = f"{user_data.country_code} {user_data.phone}"
        existing_phone = await db.users.find_one({
            "$or": [
                {"phone": formatted_phone},
                {"phone": user_data.phone},
                {"phone": {"$regex": f"{user_data.phone}$"}}  # Match phone regardless of country code prefix
            ]
        })
        if existing_phone:
            raise HTTPException(status_code=400, detail="This phone number is already registered with another account")
    
    # Format phone with country code
    phone = None
    if user_data.phone:
        phone = f"{user_data.country_code} {user_data.phone}"
    
    # Format alternate phone if provided
    alternate_phone = None
    if user_data.alternate_phone:
        alternate_phone = f"{user_data.country_code} {user_data.alternate_phone}"
    
    # Create user
    user = await create_user(
        db,
        email=email,
        name=user_data.name.strip(),
        password=user_data.password,
        phone=phone,
        alternate_phone=alternate_phone,
        salutation=user_data.salutation,
        gender=user_data.gender,
        date_of_birth=user_data.date_of_birth,
        date_of_marriage=user_data.date_of_marriage,
        auth_provider='email',
        address=user_data.address,
        landmark=user_data.landmark,
        city=user_data.city,
        state=user_data.state,
        pincode=user_data.pincode,
        username=username
    )
    
    # Mark email as verified in user record (since they completed OTP verification)
    # Also store username_lower for case-insensitive lookups
    update_fields = {"email_verified": True, "is_verified": True}
    if username:
        update_fields["username_lower"] = username.lower()
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": update_fields}
    )
    
    # Log registration for admin notifications
    await db.registration_logs.insert_one({
        "user_id": user['user_id'],
        "email": user['email'],
        "name": user['name'],
        "username": username,
        "phone": phone,
        "registered_at": datetime.now(timezone.utc),
        "read_by_admin": False
    })
    
    # Clean up OTP records
    await db.otp_verifications.delete_many({"email": email})
    
    # Create session
    session_token = await create_session(db, user['user_id'])
    
    return {
        "message": "Registration successful",
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user['name'],
            "username": user.get('username'),
            "created_at": str(user['created_at'])
        },
        "session_token": session_token
    }


@router.post("/register")
async def register_user(user_data: UserCreate, captcha_token: Optional[str] = None):
    """Register a new user with email/password"""
    # Verify hCaptcha if token provided
    if captcha_token:
        if not await verify_hcaptcha(captcha_token):
            raise HTTPException(status_code=400, detail="Captcha verification failed")
    
    # Check if user exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        # Check if they registered with Google
        if existing_user.get('auth_provider') == 'google':
            raise HTTPException(status_code=400, detail="Please use Google login for this account")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user using the correct function signature
    user = await create_user(
        db,
        email=user_data.email,
        name=user_data.name,
        password=user_data.password,
        phone=user_data.phone,
        auth_provider='email'
    )
    
    # Create session
    session_token = await create_session(db, user['user_id'])
    
    return {
        "message": "Registration successful",
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user['name'],
            "created_at": str(user['created_at'])
        },
        "session_token": session_token
    }


@router.post("/login")
async def login_user(response: Response, login_data: UserLogin):
    """Login with email or username + password"""
    identifier = login_data.identifier.strip()
    
    # Determine if identifier is email or username
    is_email = '@' in identifier
    
    if is_email:
        # Login with email (case-insensitive)
        user = await get_user_by_email(db, identifier.lower())
    else:
        # Login with username - use username_lower for lookup (case-insensitive)
        user = await db.users.find_one({"username_lower": identifier.lower()})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user registered with Google
    if user.get('auth_provider') == 'google':
        raise HTTPException(status_code=400, detail="Please use Google login for this account")
    
    # Verify password
    if not verify_password(login_data.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = await create_session(db, user['user_id'])
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "message": "Login successful",
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user.get('name', ''),
            "username": user.get('username'),
            "created_at": str(user.get('created_at', ''))
        },
        "session_token": session_token
    }



@router.post("/google/session")
async def process_google_session(response: Response, session_id: str):
    """Process Google OAuth session after redirect"""
    # Get session data from Emergent Google auth
    session_data = await get_google_session_data(session_id)
    
    if not session_data or 'email' not in session_data:
        raise HTTPException(status_code=400, detail="Invalid Google session")
    
    email = session_data['email'].lower()
    name = session_data.get('name', email.split('@')[0])
    
    # Check if user exists
    existing_user = await get_user_by_email(db, email)
    
    if existing_user:
        # User exists - create new session
        user = existing_user
    else:
        # Create new user
        user = await create_user(
            db,
            email=email,
            name=name,
            picture=session_data.get('picture', ''),
            auth_provider='google'
        )
    
    # Create session
    session_token = await create_session(db, user['user_id'])
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "message": "Google login successful",
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user.get('name', ''),
            "avatar": user.get('picture', ''),
            "created_at": str(user.get('created_at', ''))
        },
        "session_token": session_token
    }


@router.get("/me")
async def get_current_user_info(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get current user information"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user.get('name', ''),
            "avatar": user.get('avatar', ''),
            "is_admin": is_admin_email(user.get('email', ''))
        }
    }


@router.post("/logout")
async def logout_user(response: Response, request: Request, session_token: Optional[str] = Cookie(None)):
    """Logout user and clear session"""
    if session_token:
        await delete_session(db, session_token)
    
    response.delete_cookie(
        key="session_token",
        httponly=True,
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}



# ===================== Email Change Feature =====================

class EmailChangeOTPRequest(BaseModel):
    new_email: str
    password: str


class EmailChangeVerify(BaseModel):
    new_email: str
    otp: str


@router.post("/request-email-change")
async def request_email_change(
    request_data: EmailChangeOTPRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Request email change - sends OTP to new email"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate new email format
    is_valid, error_msg = validate_email(request_data.new_email)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    new_email = request_data.new_email.lower().strip()
    
    # Can't change to same email
    if new_email == user['email'].lower():
        raise HTTPException(status_code=400, detail="New email is the same as current email")
    
    # Check if new email is already registered
    existing_user = await get_user_by_email(db, new_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="This email is already registered to another account")
    
    # Verify password for security
    stored_password = user.get('password_hash')
    if not stored_password or not verify_password(request_data.password, stored_password):
        raise HTTPException(status_code=400, detail="Invalid password")
    
    # Generate OTP for new email
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store email change OTP
    await db.email_change_otps.delete_many({"user_id": user['user_id']})
    await db.email_change_otps.insert_one({
        "user_id": user['user_id'],
        "old_email": user['email'],
        "new_email": new_email,
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Check if email service is available
    if not is_email_service_available():
        return {
            "message": "OTP generated (DEV MODE - email not configured)",
            "expires_in_minutes": 10,
            "dev_otp": otp,
            "note": "In production, OTP will be sent to the new email."
        }
    
    # Send OTP to new email
    sent = await send_otp_email(new_email, otp)
    if not sent:
        return {
            "message": "OTP generated (email sending failed)",
            "expires_in_minutes": 10,
            "dev_otp": otp
        }
    
    return {"message": "OTP sent to new email address", "expires_in_minutes": 10}


@router.post("/confirm-email-change")
async def confirm_email_change(
    verify_data: EmailChangeVerify,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Confirm email change with OTP"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    new_email = verify_data.new_email.lower().strip()
    
    # Find email change OTP record
    otp_record = await db.email_change_otps.find_one({
        "user_id": user['user_id'],
        "new_email": new_email,
        "otp": verify_data.otp
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP or email")
    
    # Check expiry
    expires_at = otp_record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.email_change_otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Double-check new email isn't taken
    existing_user = await get_user_by_email(db, new_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="This email is already registered")
    
    old_email = user['email']
    
    # Update user's email
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": {
            "email": new_email,
            "previous_emails": [old_email] + user.get('previous_emails', []),
            "email_changed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update email in any related orders (shipping.email, billing.email)
    await db.orders.update_many(
        {"shipping.email": old_email.lower()},
        {"$set": {"shipping.email": new_email}}
    )
    await db.orders.update_many(
        {"billing.email": old_email.lower()},
        {"$set": {"billing.email": new_email}}
    )
    
    # Clean up OTP record
    await db.email_change_otps.delete_many({"user_id": user['user_id']})
    
    return {
        "message": "Email changed successfully",
        "old_email": old_email,
        "new_email": new_email
    }


@router.get("/check-username/{username}")
async def check_username_availability(username: str):
    """Check if a username is available"""
    is_valid, error_msg = validate_username(username)
    if not is_valid:
        return {"available": False, "error": error_msg}
    
    username_lower = username.strip().lower()
    existing = await db.users.find_one({"username_lower": username_lower})
    
    return {
        "available": existing is None,
        "username": username_lower
    }


# ===================== Forgot Username =====================

class ForgotUsernameRequest(BaseModel):
    phone: str
    country_code: Optional[str] = "+91"


def mask_email(email: str) -> str:
    """Mask email for privacy - show first 3 chars and domain"""
    if not email or '@' not in email:
        return "***@***.***"
    parts = email.split('@')
    local = parts[0]
    domain = parts[1]
    if len(local) <= 3:
        masked_local = local[0] + "***"
    else:
        masked_local = local[:3] + "***"
    return f"{masked_local}@{domain}"


@router.post("/forgot-username")
async def forgot_username(data: ForgotUsernameRequest):
    """Send username to user's registered email based on mobile number"""
    phone = data.phone.strip()
    country_code = data.country_code or "+91"
    
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    # Find user by phone number (check with and without country code)
    formatted_phone = f"{country_code} {phone}"
    user = await db.users.find_one({
        "$or": [
            {"phone": formatted_phone},
            {"phone": phone},
            {"phone": {"$regex": f"{phone}$"}}
        ]
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this phone number")
    
    username = user.get("username")
    email = user.get("email")
    
    if not username:
        raise HTTPException(status_code=400, detail="No username set for this account. Please contact support.")
    
    if not email:
        raise HTTPException(status_code=400, detail="No email associated with this account")
    
    # Send username to email
    if is_email_service_available():
        try:
            from services.email_service import send_email
            await send_email(
                to_email=email,
                subject="Your Addrika Username",
                html_content=f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #D4AF37; font-family: 'Playfair Display', serif;">ADDRIKA</h1>
                        <p style="color: #666;">Elegance in Every Scent</p>
                    </div>
                    <h2 style="color: #1a1a2e;">Your Username Recovery</h2>
                    <p>Hello {user.get('name', 'Valued Customer')},</p>
                    <p>Your username is:</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <strong style="font-size: 24px; color: #1a1a2e;">{username}</strong>
                    </div>
                    <p style="color: #666; font-size: 14px;">Note: Username is case-sensitive when logging in.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        Centsibl Traders<br>
                        contact.us@centraders.com
                    </p>
                </div>
                """
            )
        except Exception as e:
            logger.error(f"Failed to send username recovery email: {e}")
            # Still return masked email even if sending fails
    
    # Return masked email so user knows where to check
    masked = mask_email(email)
    
    return {
        "message": "Username sent to your registered email",
        "email_masked": masked
    }


@router.post("/update-profile")
async def update_user_profile(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Update user profile (name, phone, username, etc.)"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    update_data = {}
    
    # Update name
    if 'name' in body and body['name']:
        is_valid, error_msg = validate_name(body['name'])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        update_data['name'] = body['name'].strip()
    
    # Update phone
    if 'phone' in body:
        if body['phone']:
            is_valid, error_msg = validate_phone(body['phone'])
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)
            country_code = body.get('country_code', '+91')
            update_data['phone'] = f"{country_code} {body['phone']}"
        else:
            update_data['phone'] = None
    
    # Update username
    if 'username' in body and body['username']:
        is_valid, error_msg = validate_username(body['username'])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        new_username = body['username'].strip().lower()
        # Check if username is taken (by someone else)
        existing = await db.users.find_one({"username": new_username, "user_id": {"$ne": user['user_id']}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data['username'] = new_username
    
    # Update salutation
    if 'salutation' in body:
        update_data['salutation'] = body['salutation']
    
    # Update address fields
    for field in ['address', 'landmark', 'city', 'state', 'pincode']:
        if field in body:
            update_data[field] = body[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": update_data}
    )
    
    # Fetch updated user
    updated_user = await db.users.find_one({"user_id": user['user_id']}, {"_id": 0, "password_hash": 0})
    
    return {"message": "Profile updated successfully", "user": updated_user}


# ===================== Change Password =====================

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Change user password - requires current password verification"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user has a password (not Google OAuth only user)
    stored_password = user.get('password_hash')
    if not stored_password:
        raise HTTPException(
            status_code=400, 
            detail="Password change not available for social login accounts. Please use Google to sign in."
        )
    
    # Verify current password
    if not verify_password(password_data.current_password, stored_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    new_password = password_data.new_password
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if len(new_password) > 100:
        raise HTTPException(status_code=400, detail="Password too long")
    if new_password == password_data.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Hash and update password
    new_password_hash = hash_password(new_password)
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": {
            "password_hash": new_password_hash,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}


# ===================== Push Notification Subscription =====================

class PushSubscription(BaseModel):
    fcm_token: str
    enabled: bool = True


@router.post("/push-subscribe")
async def subscribe_to_push(
    subscription: PushSubscription,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Subscribe to push notifications"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": {
            "fcm_token": subscription.fcm_token,
            "push_enabled": subscription.enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Push notification subscription updated", "enabled": subscription.enabled}


@router.post("/push-unsubscribe")
async def unsubscribe_from_push(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Unsubscribe from push notifications"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": {
            "push_enabled": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Push notifications disabled"}


# ===================== Notification Preferences =====================

@router.get("/notification-preferences")
async def get_notification_preferences(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get user notification preferences"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Default preferences
    default_prefs = {
        "email_order_updates": True,
        "email_shipping_updates": True,
        "email_promotions": False,
        "email_blog_posts": False,
        "email_new_products": False,
        "push_enabled": user.get("push_enabled", False),
        "push_order_updates": True,
        "push_shipping_updates": True,
        "push_promotions": False,
        "sms_enabled": False,
        "sms_order_updates": False
    }
    
    # Get stored preferences
    stored_prefs = user.get("notification_preferences", {})
    
    # Merge with defaults
    preferences = {**default_prefs, **stored_prefs}
    preferences["push_enabled"] = user.get("push_enabled", False)
    
    return {"preferences": preferences}


@router.post("/notification-preferences")
async def update_notification_preferences(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Update user notification preferences"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    preferences = body.get("preferences", {})
    
    # Validate preferences structure
    valid_keys = {
        "email_order_updates", "email_shipping_updates", "email_promotions",
        "email_blog_posts", "email_new_products",
        "push_order_updates", "push_shipping_updates", "push_promotions",
        "sms_enabled", "sms_order_updates"
    }
    
    # Filter to only valid keys
    clean_prefs = {k: v for k, v in preferences.items() if k in valid_keys and isinstance(v, bool)}
    
    await db.users.update_one(
        {"user_id": user['user_id']},
        {"$set": {
            "notification_preferences": clean_prefs,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Preferences saved successfully", "preferences": clean_prefs}


# ============================================
# PASSWORD RECOVERY - USER (via Mobile Number)
# ============================================

class PasswordRecoveryInitiate(BaseModel):
    phone: str
    country_code: Optional[str] = "+91"

class PasswordRecoveryVerifyOTP(BaseModel):
    phone: str
    otp: str
    recovery_token: str

class PasswordRecoveryReset(BaseModel):
    recovery_token: str
    new_password: str

# Store recovery tokens in MongoDB
RECOVERY_COLLECTION = "password_recovery_tokens"

@router.post("/forgot-password/initiate")
async def forgot_password_initiate(data: PasswordRecoveryInitiate):
    """Step 1: User password recovery - verify phone exists and send OTP"""
    import secrets
    
    phone = data.phone.strip()
    country_code = data.country_code or "+91"
    
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    # Find user by phone number
    user = await db.users.find_one({"phone": phone})
    if not user:
        # Don't reveal if user exists or not for security
        raise HTTPException(status_code=404, detail="No account found with this phone number")
    
    # Generate OTP and recovery token
    otp = generate_otp()
    recovery_token = secrets.token_urlsafe(32)
    
    # Store recovery token in MongoDB with TTL
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Remove any existing recovery tokens for this phone
    await db[RECOVERY_COLLECTION].delete_many({"phone": phone})
    
    # Store new token
    await db[RECOVERY_COLLECTION].insert_one({
        "recovery_token": recovery_token,
        "phone": phone,
        "user_id": user["user_id"],
        "otp": otp,
        "otp_verified": False,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "attempts": 0
    })
    
    # Create TTL index if not exists
    await db[RECOVERY_COLLECTION].create_index("expires_at", expireAfterSeconds=0)
    
    # Send OTP via email (we don't have SMS integration yet)
    # For now, send to user's email
    user_email = user.get("email")
    if user_email:
        try:
            await send_otp_email(user_email, otp)
        except Exception as e:
            logger.error(f"Failed to send recovery OTP: {e}")
    
    # Mask phone for response
    masked_phone = f"{phone[:3]}****{phone[-3:]}" if len(phone) > 6 else "****"
    masked_email = f"{user_email[:3]}***{user_email[user_email.index('@'):]}" if user_email else None
    
    return {
        "message": "OTP sent to your registered email",
        "recovery_token": recovery_token,
        "phone_masked": masked_phone,
        "email_masked": masked_email,
        "expires_in_minutes": 10
    }


@router.post("/forgot-password/verify-otp")
async def forgot_password_verify_otp(data: PasswordRecoveryVerifyOTP):
    """Step 2: Verify OTP for password recovery"""
    
    # Get recovery token
    recovery = await db[RECOVERY_COLLECTION].find_one({
        "recovery_token": data.recovery_token,
        "phone": data.phone
    })
    
    if not recovery:
        raise HTTPException(status_code=400, detail="Invalid or expired recovery token")
    
    # Check if expired (handle both naive and aware datetimes from MongoDB)
    expires_at = recovery["expires_at"]
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        await db[RECOVERY_COLLECTION].delete_one({"recovery_token": data.recovery_token})
        raise HTTPException(status_code=400, detail="Recovery token has expired. Please try again.")
    
    # Check attempts
    if recovery["attempts"] >= 5:
        await db[RECOVERY_COLLECTION].delete_one({"recovery_token": data.recovery_token})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please try again.")
    
    # Verify OTP
    if recovery["otp"] != data.otp:
        await db[RECOVERY_COLLECTION].update_one(
            {"recovery_token": data.recovery_token},
            {"$inc": {"attempts": 1}}
        )
        remaining = 5 - recovery["attempts"] - 1
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # Mark OTP as verified
    await db[RECOVERY_COLLECTION].update_one(
        {"recovery_token": data.recovery_token},
        {"$set": {"otp_verified": True}}
    )
    
    return {
        "message": "OTP verified successfully",
        "recovery_token": data.recovery_token,
        "can_reset_password": True
    }


@router.post("/forgot-password/reset")
async def forgot_password_reset(data: PasswordRecoveryReset):
    """Step 3: Reset password after OTP verification"""
    
    # Get and validate recovery token
    recovery = await db[RECOVERY_COLLECTION].find_one({
        "recovery_token": data.recovery_token,
        "otp_verified": True
    })
    
    if not recovery:
        raise HTTPException(status_code=400, detail="Invalid or unverified recovery token. Please verify OTP first.")
    
    # Check if expired (handle both naive and aware datetimes from MongoDB)
    expires_at = recovery["expires_at"]
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        await db[RECOVERY_COLLECTION].delete_one({"recovery_token": data.recovery_token})
        raise HTTPException(status_code=400, detail="Recovery session has expired. Please try again.")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash new password and update user
    hashed_password = hash_password(data.new_password)
    
    await db.users.update_one(
        {"user_id": recovery["user_id"]},
        {"$set": {
            "password_hash": hashed_password,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Delete recovery token
    await db[RECOVERY_COLLECTION].delete_one({"recovery_token": data.recovery_token})
    
    return {
        "message": "Password reset successfully. You can now login with your new password."
    }


