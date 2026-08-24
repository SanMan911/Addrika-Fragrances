"""
Retailer Authentication Router
Handles retailer login, session management, and profile
"""
from fastapi import APIRouter, HTTPException, Request, Response, Cookie, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import logging
import re
import secrets
import uuid

from dependencies import db
from services.auth_service import verify_password, hash_password
from services.b2b_settings import get_b2b_enabled
from services.object_storage import put_object, make_path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-auth", tags=["Retailer Auth"])

GST_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
ALLOWED_CERT_MIME = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_CERT_BYTES = 8 * 1024 * 1024  # 8 MB


@router.get("/portal-status")
async def get_portal_status():
    """Public endpoint: whether the B2B retailer portal is currently enabled."""
    enabled = await get_b2b_enabled(db)
    return {"enabled": enabled}


# ---------------------------------------------------------------------------
# Setup-password flow (used by waitlist → onboarding magic link)
# ---------------------------------------------------------------------------

class SetupPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20)
    password: str = Field(..., min_length=8, max_length=128)


@router.get("/setup-password/validate/{token}")
async def validate_setup_token(token: str):
    """Public — return whether an invite token is valid + the
    business name (so the setup page can greet the user)."""
    retailer = await db.retailers.find_one(
        {"invite_token": token},
        {"_id": 0, "business_name": 1, "name": 1, "email": 1, "invite_expires_at": 1, "password_hash": 1, "retailer_id": 1},
    )
    if not retailer:
        return {"valid": False, "reason": "Invalid invitation link"}
    if retailer.get("password_hash"):
        return {"valid": False, "reason": "Password already set — please log in"}
    if retailer.get("invite_expires_at"):
        try:
            expires = datetime.fromisoformat(retailer["invite_expires_at"])
            if expires < datetime.now(timezone.utc):
                return {"valid": False, "reason": "This invitation link has expired"}
        except Exception:
            pass
    return {
        "valid": True,
        "business_name": retailer.get("business_name"),
        "name": retailer.get("name"),
        "email": retailer.get("email"),
        "retailer_id": retailer.get("retailer_id"),
    }


@router.post("/setup-password")
async def setup_password(data: SetupPasswordRequest):
    """Public — exchanges a one-time invite token for the user's chosen password."""
    retailer = await db.retailers.find_one({"invite_token": data.token})
    if not retailer:
        raise HTTPException(status_code=404, detail="Invalid invitation link")
    if retailer.get("password_hash"):
        raise HTTPException(status_code=409, detail="Password already set — please log in")
    if retailer.get("invite_expires_at"):
        try:
            expires = datetime.fromisoformat(retailer["invite_expires_at"])
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="This invitation link has expired")
        except ValueError:
            pass

    new_hash = hash_password(data.password)
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "status": "active",
                "password_set_at": datetime.now(timezone.utc).isoformat(),
            },
            "$unset": {"invite_token": "", "invite_expires_at": ""},
        },
    )
    logger.info(f"Retailer {retailer['retailer_id']} completed setup-password")
    return {"ok": True, "email": retailer["email"]}


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
    
    if not retailer or retailer.get('status') in ('suspended', 'deleted'):
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
    
    # Check status — suspended returns a reason; deleted looks like not-found
    if retailer.get('status') == 'suspended':
        reason = retailer.get('suspended_reason') or 'Please contact admin.'
        raise HTTPException(
            status_code=403,
            detail=f"Your account has been suspended. Reason: {reason}",
        )
    
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
    
    logger.info(f"Retailer logged in: {retailer['retailer_id']} status={retailer.get('status')}")
    
    return {
        "message": "Login successful",
        "retailer": {
            "retailer_id": retailer['retailer_id'],
            "name": retailer['name'],
            "business_name": retailer.get('business_name'),
            "email": retailer['email'],
            "status": retailer.get('status', 'under_processing'),
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



# ---------------------------------------------------------------------------
# Retailer self-registration (Iteration 100)
# multipart POST — creates a retailer with status=`under_processing`, uploads
# the GST certificate to object storage, emails admin + applicant, and
# auto-logs the retailer in so they land on the "Under Processing" screen.
# ---------------------------------------------------------------------------

INDIAN_STATE_CODES_REG = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "25": "Daman and Diu", "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman and Nicobar Islands",
    "36": "Telangana", "37": "Andhra Pradesh (New)", "38": "Ladakh",
    "97": "Other Territory", "99": "Centre Jurisdiction",
}


def _titlecase(v: Optional[str]) -> Optional[str]:
    if not v:
        return v
    return " ".join(w.capitalize() for w in v.strip().split())


@router.post("/register")
async def retailer_register(
    response: Response,
    business_name: str = Form(..., min_length=2, max_length=200),
    contact_name: str = Form(..., min_length=2, max_length=100),
    email: EmailStr = Form(...),
    country_code: str = Form("+91"),
    phone: str = Form(..., min_length=10, max_length=20),
    gst_number: str = Form(..., min_length=15, max_length=15),
    password: str = Form(..., min_length=8, max_length=128),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    pincode: Optional[str] = Form(None, min_length=6, max_length=6),
    gst_certificate: UploadFile = File(...),
):
    """Self-serve retailer registration.
    Behaviour matches waitlist for GST auto-verify (hard-block unless
    provider is down). On success the retailer is created with status
    `under_processing`, auto-logged in, and lands on /retailer/pending.
    """
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="Retailer portal is currently unavailable. Please contact Addrika.",
        )

    gst = (gst_number or "").upper().strip()
    if not GST_PATTERN.match(gst):
        raise HTTPException(status_code=400, detail="Invalid GST number format")

    # ---- Validate certificate BEFORE any DB writes ----
    if not gst_certificate:
        raise HTTPException(status_code=400, detail="GST certificate file is required")
    ctype = (gst_certificate.content_type or "").lower()
    if ctype not in ALLOWED_CERT_MIME:
        raise HTTPException(
            status_code=400,
            detail="GST certificate must be PDF, JPG, PNG or WebP",
        )
    cert_bytes = await gst_certificate.read()
    if len(cert_bytes) == 0:
        raise HTTPException(status_code=400, detail="GST certificate is empty")
    if len(cert_bytes) > MAX_CERT_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"GST certificate must be under {MAX_CERT_BYTES // (1024 * 1024)} MB",
        )

    # ---- Dedup ----
    existing = await db.retailers.find_one({"email": email.lower()})
    if existing and existing.get("status") != "deleted":
        raise HTTPException(
            status_code=409,
            detail="A retailer account with this email already exists. Please log in.",
        )

    # ---- Auto-verify GST via Appyflow (best-effort; hard-block only on user error) ----
    gst_verified = False
    gst_verification_error: Optional[str] = None
    gst_provider_down = False
    gst_record: dict = {}
    try:
        from services.gst_verification import verify_gst_number, _is_provider_outage  # type: ignore
        result = await verify_gst_number(gst)
        if isinstance(result, dict) and result.get("verified"):
            gst_verified = True
            gst_record = result
        else:
            gst_verification_error = (result or {}).get("error", "Verification unavailable")
            gst_provider_down = _is_provider_outage(gst_verification_error)
    except Exception as e:
        gst_verification_error = str(e) or "Verification service unavailable"
        gst_provider_down = True

    if not gst_verified and not gst_provider_down:
        raise HTTPException(
            status_code=400,
            detail=gst_verification_error or "GSTIN could not be verified.",
        )

    # ---- Upload the certificate ----
    ext = ALLOWED_CERT_MIME[ctype]
    retailer_id = f"RTL_{uuid.uuid4().hex[:10].upper()}"
    storage_path = make_path("kyc/gst-cert", retailer_id, ext)
    upload_result = await put_object(storage_path, cert_bytes, ctype)
    if not upload_result:
        raise HTTPException(
            status_code=503,
            detail="Could not upload GST certificate right now. Please try again.",
        )
    stored_path = upload_result.get("path", storage_path)

    # ---- Create retailer ----
    cc = country_code.strip() if country_code else "+91"
    if not cc.startswith("+"):
        cc = f"+{cc}"
    now = datetime.now(timezone.utc).isoformat()
    legal_name = gst_record.get("taxpayer_name") or gst_record.get("trade_name")
    retailer_state = _titlecase((state or "").strip()) or INDIAN_STATE_CODES_REG.get(gst[:2])

    retailer = {
        "retailer_id": retailer_id,
        "business_name": _titlecase(business_name) or "—",
        "trade_name": legal_name,
        "name": _titlecase(contact_name) or _titlecase(business_name) or "—",
        "contact_name": _titlecase(contact_name),
        "email": email.lower(),
        "phone": phone.strip(),
        "country_code": cc,
        "gst_number": gst,
        "gst_verified": gst_verified,
        "gst_verification_error": gst_verification_error,
        "gst_certificate": {
            "storage_path": stored_path,
            "original_filename": gst_certificate.filename or f"gst-cert.{ext}",
            "content_type": ctype,
            "size": len(cert_bytes),
            "uploaded_at": now,
            "is_deleted": False,
        },
        "city": _titlecase((city or "").strip()) or None,
        "state": retailer_state,
        "address": (address or "").strip() or None,
        "pincode": (pincode or "").strip() or None,
        "status": "under_processing",
        "is_verified": False,
        "legal_documents": {
            "gst_certificate": stored_path,
            "gst_certificate_filename": gst_certificate.filename or f"gst-cert.{ext}",
        },
        "admin_notes": [],
        "password_hash": hash_password(password),
        "password_set_at": now,
        "created_at": now,
        "self_registered": True,
    }
    await db.retailers.insert_one(retailer)

    # ---- Best-effort admin + applicant emails ----
    try:
        import os as _os
        from services.email_service import send_email
        import base64 as _b64

        admin_email = _os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com")
        gst_badge = (
            "<span style='color:#16a34a;font-weight:700;'>✓ GST auto-verified</span>"
            if gst_verified
            else f"<span style='color:#b45309;font-weight:700;'>⚠ GST NOT auto-verified — {gst_verification_error or 'provider down'}</span>"
        )
        panel_link = (
            _os.environ.get(
                "FRONTEND_PUBLIC_URL",
                "https://b2b-handoff.preview.emergentagent.com",
            ).rstrip("/")
            + "/admin/retailer-requests"
        )
        admin_html = f"""
        <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
          <table cellpadding='0' cellspacing='0' style='max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;'>
            <tr><td style='background:#1e3a52;padding:20px;text-align:center;'>
              <h1 style='color:#d4af37;margin:0;'>New B2B Retailer Registration</h1>
              <p style='color:#fff;margin:4px 0 0;font-size:12px;'>Awaiting manual verification</p>
            </td></tr>
            <tr><td style='padding:22px;color:#1e3a52;'>
              <p style='margin:0 0 12px;'>A new retailer has registered on the Addrika B2B portal and is waiting for your approval.</p>
              <p style='margin:0 0 16px;'>{gst_badge}</p>
              <table cellpadding='6' cellspacing='0' style='width:100%;border-collapse:collapse;font-size:14px;'>
                <tr><td style='background:#f5f0e8;font-weight:600;width:38%;'>Retailer ID</td><td style='background:#faf7f2;font-family:monospace;'>{retailer_id}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>Business Name</td><td style='background:#faf7f2;'>{retailer['business_name']}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>Contact</td><td style='background:#faf7f2;'>{retailer['contact_name']}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>Email</td><td style='background:#faf7f2;'><a href='mailto:{retailer['email']}'>{retailer['email']}</a></td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>WhatsApp</td><td style='background:#faf7f2;'><a href='https://wa.me/{cc.lstrip("+")}{retailer["phone"]}'>{cc} {retailer['phone']}</a></td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>GSTIN</td><td style='background:#faf7f2;font-family:monospace;'>{gst}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>Legal Name (GSTN)</td><td style='background:#faf7f2;'>{legal_name or '—'}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>City / State</td><td style='background:#faf7f2;'>{retailer.get('city') or '—'}, {retailer.get('state') or '—'}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>Pincode</td><td style='background:#faf7f2;'>{retailer.get('pincode') or '—'}</td></tr>
                <tr><td style='background:#f5f0e8;font-weight:600;'>GST Certificate</td><td style='background:#faf7f2;'>Attached · {retailer['gst_certificate']['original_filename']} · {round(len(cert_bytes) / 1024, 1)} KB</td></tr>
              </table>
              <p style='margin:22px 0 8px;text-align:center;'>
                <a href='{panel_link}' style='background:#d4af37;color:#1e3a52;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:700;'>
                  Review in Admin Panel →
                </a>
              </p>
              <p style='margin:20px 0 0;font-size:12px;color:#6b6357;'>The retailer will see an "Under Processing" screen and can't access the dashboard until you approve.</p>
            </td></tr>
          </table>
        </body></html>
        """
        await send_email(
            to_email=admin_email,
            subject=f"[Addrika B2B] New retailer registration — {retailer['business_name']}",
            html_content=admin_html,
            attachments=[{
                "filename": retailer['gst_certificate']['original_filename'],
                "content": _b64.b64encode(cert_bytes).decode("ascii"),
            }],
        )

        applicant_html = f"""
        <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
          <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;'>
            <tr><td style='background:#1e3a52;padding:24px;text-align:center;'>
              <h1 style='color:#d4af37;margin:0;'>ADDRIKA</h1>
              <p style='color:#fff;margin:6px 0 0;'>Registration received · under review</p>
            </td></tr>
            <tr><td style='padding:24px;color:#1e3a52;'>
              <p>Hi {retailer['contact_name'] or 'there'},</p>
              <p>Thanks for registering as an Addrika retailer. Our team is verifying your details against your GST certificate. You&rsquo;ll receive a follow-up email as soon as your account is activated (typically within 1 business day).</p>
              <p style='background:#f5f0e8;padding:12px;border-radius:6px;font-size:13px;'>
                <strong>Business:</strong> {retailer['business_name']}<br/>
                <strong>GSTIN:</strong> <span style='font-family:monospace;'>{gst}</span><br/>
                <strong>Login email:</strong> {retailer['email']}
              </p>
              <p style='margin-top:16px;'>You can already sign in — but you&rsquo;ll see an <b>Under Processing</b> screen until verification is complete.</p>
              <p style='color:#6b6357;font-size:13px;margin-top:20px;'>Questions? Reply to this email or reach us at <a href='mailto:{admin_email}'>{admin_email}</a>.</p>
            </td></tr>
          </table>
        </body></html>
        """
        await send_email(
            to_email=retailer["email"],
            subject="Addrika B2B — your registration is under review",
            html_content=applicant_html,
        )
    except Exception as e:
        logger.error(f"Registration notification email failed for {email}: {e}")

    # ---- Auto-login the retailer ----
    session_token = await create_retailer_session(retailer_id, retailer["email"])
    response.set_cookie(
        key="retailer_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=RETAILER_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    )

    logger.info(f"New retailer registered: {retailer_id} status=under_processing gst_verified={gst_verified}")

    return {
        "message": "Registration submitted — your account is under review.",
        "retailer": {
            "retailer_id": retailer_id,
            "name": retailer["name"],
            "email": retailer["email"],
            "status": "under_processing",
        },
        "token": session_token,
        "gst_verified": gst_verified,
    }
