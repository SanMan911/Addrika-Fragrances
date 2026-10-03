"""
Retailer Authentication Router
Handles retailer login, session management, and profile
"""
from fastapi import APIRouter, HTTPException, Request, Response, Cookie, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
import logging
import os
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


def _gst_email_otp_required() -> bool:
    """Enforce the IDSPay GST-email OTP at registration.

    Defaults to OFF so onboarding keeps working until real IDSPay keys land;
    flip IDSPAY_REQUIRE_GST_EMAIL_OTP=1 once the sandbox flow is confirmed.
    """
    return (os.environ.get("IDSPAY_REQUIRE_GST_EMAIL_OTP") or "").strip() == "1"


class SendOtpRequest(BaseModel):
    country_code: str = Field(default="+91")
    phone: str = Field(min_length=6, max_length=20)


class VerifyOtpRequest(BaseModel):
    country_code: str = Field(default="+91")
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=4, max_length=8)


@router.post("/phone/send-otp")
async def phone_send_otp(data: SendOtpRequest):
    """Send an SMS OTP to prove ownership of the phone number typed during registration."""
    from services.phone_otp import to_e164, send_otp
    cc = (data.country_code or "+91").strip()
    digits = "".join(c for c in (data.phone or "") if c.isdigit())
    if cc.lstrip("+") == "91" and len(digits) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number.")
    e164 = to_e164(cc, data.phone)
    result = await send_otp(e164)
    if result.get("status") == "cooldown":
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {result.get('retry_after')}s before requesting another code.",
        )
    if result.get("status") == "error":
        raise HTTPException(status_code=503, detail=result.get("error"))
    return {
        "sent": True,
        "dev_mode": result.get("dev_mode", False),
        "dev_code": result.get("dev_code"),  # only present in DEV mode (no MSG91 key)
    }


@router.post("/phone/verify-otp")
async def phone_verify_otp(data: VerifyOtpRequest):
    """Verify the OTP code the user typed. On success the number is remembered as verified."""
    from services.phone_otp import to_e164, verify_otp
    e164 = to_e164(data.country_code, data.phone)
    result = await verify_otp(e164, data.code)
    if not result.get("verified"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Verification failed.")
    return {"verified": True}


# ---------------------------------------------------------------------------
# IDSPay GST-to-Contact + email-OTP ownership proof (Iteration 121)
# IDSPay returns the GST-registered mobile/email; it has no OTP endpoint, so we
# email our own OTP to the fetched address. Until IDSPay keys are supplied the
# endpoints report `not_configured` honestly and never fake a verification.
# ---------------------------------------------------------------------------

class GstContactFetchRequest(BaseModel):
    gstin: str = Field(min_length=15, max_length=15)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)
    country_code: str = Field(default="+91")


class GstContactVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=8)


def _client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "")


@router.get("/gst-contact/config")
async def gst_contact_config():
    """Honest readiness report so the UI can show 'setup pending' instead of guessing."""
    from services import idspay_gst_contacts as idspay
    configured = idspay.is_configured()
    return {
        "provider": "idspay",
        "configured": configured,
        "environment": (os.environ.get("IDSPAY_ENV") or "").strip().lower() or None,
        "required": _gst_email_otp_required(),
        "ready": configured and bool((os.environ.get("OTP_PEPPER") or "").strip()),
    }


@router.post("/gst-contact/fetch")
async def gst_contact_fetch(data: GstContactFetchRequest, request: Request):
    """Match the applicant's typed mobile/email against the GST record, then OTP.

    Product rule: if BOTH the typed mobile AND the typed email contradict the
    GST record, registration is denied. If at least one matches (or cannot be
    compared), we email an OTP to the GST-registered address. Any mismatch is
    recorded for admin review.

    Never returns the full GST email/mobile — only server-masked hints.
    """
    from services import idspay_gst_contacts as idspay
    from services import gst_email_otp as otp

    gst = (data.gstin or "").upper().strip()
    if not GST_PATTERN.match(gst):
        raise HTTPException(status_code=400, detail="Invalid GST number format")

    result = await idspay.fetch_contacts(gst)
    status = result.get("status")

    if status == "not_configured":
        raise HTTPException(
            status_code=503,
            detail="GST contact verification is not configured yet. Please continue with the standard form.",
        )
    if status == "invalid_gstin":
        raise HTTPException(status_code=400, detail="Invalid GST number format")
    if status == "failed":
        if result.get("account_issue"):
            # Our IDSPay account problem (wallet/key/IP) — never blame the retailer.
            logger.error(f"idspay account issue during onboarding: {result.get('error')}")
            raise HTTPException(
                status_code=503,
                detail="GST contact verification is temporarily unavailable. Please continue — our team will verify your business.",
            )
        raise HTTPException(
            status_code=502 if result.get("provider_down") else 400,
            detail=result.get("error") or "Could not fetch the contact details registered against this GSTIN.",
        )

    existing = await db.retailers.find_one({"gst_number": gst})
    if existing and existing.get("status") != "deleted":
        raise HTTPException(
            status_code=409,
            detail="An account already exists for this GSTIN. Please log in with your GSTIN.",
        )

    # ---- Compare what they typed against the GST record ----
    verdict = idspay.compare_contacts(data.email, data.phone, result)
    if verdict["deny"]:
        logger.warning(f"idspay: registration DENIED for {gst} — both mobile and email contradict the GST record")
        await db.gst_contact_denials.insert_one({
            "gstin": gst,
            "entered_email": verdict["entered_email"],
            "entered_mobile": verdict["entered_mobile"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "ip": _client_ip(request),
        })
        raise HTTPException(
            status_code=403,
            detail=(
                "Neither the mobile number nor the email you entered matches the contact details "
                "registered against this GSTIN. Please use your GST-registered details, or contact "
                "AAROHMM if your GST records are out of date."
            ),
        )

    email = result.get("email")
    mobile = result.get("mobile")
    if not email:
        # Masked/absent email => an OTP cannot be delivered. Do NOT fall back to
        # a user-typed address; that would defeat the ownership proof.
        return {
            "status": "email_unavailable",
            "email_masked": bool(result.get("email_masked")),
            "mobile_hint": idspay.mask_mobile_hint(mobile) if mobile else None,
            "action": "manual_business_verification",
            "message": "The email registered against this GSTIN could not be read. Our team will verify your business manually.",
        }

    issued = await otp.issue_otp(gst, email, ip=_client_ip(request), meta=verdict)
    if not issued.get("ok"):
        reason = issued.get("reason")
        if reason == "cooldown":
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {issued.get('retry_after')}s before requesting another code.",
            )
        if reason == "rate_limited":
            raise HTTPException(
                status_code=429,
                detail="Too many verification attempts for this GSTIN. Please try again later.",
            )
        raise HTTPException(
            status_code=503,
            detail="Could not email the verification code right now. Please try again.",
        )

    return {
        "status": "otp_required",
        "challenge_id": issued["challenge_id"],
        "expires_in": issued["expires_in"],
        "email_hint": idspay.mask_email_hint(email),
        "mobile_hint": idspay.mask_mobile_hint(mobile) if mobile else None,
        "mobile_masked": bool(result.get("mobile_masked")),
        # Tell the applicant which of their entries differs, without leaking the record.
        "email_matches": verdict["email"] == idspay.MATCH,
        "mobile_matches": verdict["mobile"] == idspay.MATCH,
        "mismatch": verdict["any_mismatch"],
        "message": (
            "A code has been sent to the email registered against your GSTIN."
            if not verdict["any_mismatch"] else
            "Some details you entered differ from your GST records. A code has been sent to the "
            "email registered against your GSTIN — our team will review the difference."
        ),
    }


@router.post("/gst-contact/verify-otp")
async def gst_contact_verify_otp(data: GstContactVerifyRequest, request: Request):
    """Consume the emailed code and hand back an opaque onboarding session."""
    from services import gst_email_otp as otp
    from services import idspay_gst_contacts as idspay

    res = await otp.verify_otp(data.challenge_id, data.code, ip=_client_ip(request))
    if not res.get("ok"):
        if res.get("reason") == "too_many_attempts":
            raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    contact = await idspay.fetch_contacts(res["gstin"])
    meta = res.get("meta") or {}
    return {
        "verified": True,
        "onboarding_session": res["onboarding_session"],
        "expires_in": res["expires_in"],
        "gstin": res["gstin"],
        "email_hint": idspay.mask_email_hint(res["email"]),
        "mobile": contact.get("mobile") if contact.get("status") == "ok" else None,
        "mismatch": bool(meta.get("any_mismatch")),
        "email_matches": meta.get("email") == idspay.MATCH,
        "mobile_matches": meta.get("mobile") == idspay.MATCH,
    }


# ---------------------------------------------------------------------------
# Post-login KYC (Iteration 120) — retailer must have a GST certificate AND a
# SPOC Aadhaar on file within 30 days of registration, else the account is
# auto-suspended by a daily cron. Retailers self-upload here.
# ---------------------------------------------------------------------------

KYC_UPLOAD_DEADLINE_DAYS = 30
KYC_DOC_TYPES = {"gst_certificate", "spoc_aadhaar"}


def _kyc_has_gst(r: dict) -> bool:
    if (r.get("kyc") or {}).get("gst_certificate"):
        return True
    gc = r.get("gst_certificate")
    if isinstance(gc, dict) and gc.get("storage_path") and not gc.get("is_deleted"):
        return True
    return bool((r.get("legal_documents") or {}).get("gst_certificate"))


def _kyc_has_spoc(r: dict) -> bool:
    if (r.get("kyc") or {}).get("spoc_aadhaar"):
        return True
    return bool((r.get("spoc") or {}).get("id_proof_document"))


def _kyc_deadline(r: dict) -> Optional[datetime]:
    ca = r.get("created_at")
    if not ca:
        return None
    try:
        return datetime.fromisoformat(ca) + timedelta(days=KYC_UPLOAD_DEADLINE_DAYS)
    except Exception:
        return None


def kyc_status_for(r: dict) -> dict:
    has_gst = _kyc_has_gst(r)
    has_spoc = _kyc_has_spoc(r)
    complete = has_gst and has_spoc
    deadline = _kyc_deadline(r)
    days_left = (deadline - datetime.now(timezone.utc)).days if deadline else None
    return {
        "gst_certificate": has_gst,
        "spoc_aadhaar": has_spoc,
        "complete": complete,
        "deadline": deadline.isoformat() if deadline else None,
        "days_left": days_left,
        "at_risk": (not complete) and (days_left is not None and days_left <= KYC_UPLOAD_DEADLINE_DAYS),
    }


@router.get("/kyc/status")
async def kyc_status(request: Request, retailer_session: Optional[str] = Cookie(None)):
    """Retailer self-service — current KYC document state + 30-day deadline."""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return kyc_status_for(retailer)


@router.post("/kyc/upload")
async def kyc_upload(
    request: Request,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    retailer_session: Optional[str] = Cookie(None),
):
    """Retailer self-uploads a KYC document (gst_certificate | spoc_aadhaar)."""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    dt = (doc_type or "").strip()
    if dt not in KYC_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_CERT_MIME:
        raise HTTPException(status_code=400, detail="File must be PDF, JPG, PNG or WebP")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(data) > MAX_CERT_BYTES:
        raise HTTPException(status_code=400, detail=f"File must be under {MAX_CERT_BYTES // (1024 * 1024)} MB")

    ext = ALLOWED_CERT_MIME[ctype]
    rid = retailer["retailer_id"]
    path = make_path(f"kyc/{dt}", rid, ext)
    up = await put_object(path, data, ctype)
    if not up:
        raise HTTPException(status_code=503, detail="Could not upload right now. Please try again.")
    now = datetime.now(timezone.utc).isoformat()
    await db.retailers.update_one(
        {"retailer_id": rid},
        {"$set": {f"kyc.{dt}": {
            "storage_path": up.get("path", path),
            "original_filename": file.filename or f"{dt}.{ext}",
            "content_type": ctype,
            "size": len(data),
            "uploaded_at": now,
        }}},
    )
    fresh = await db.retailers.find_one({"retailer_id": rid})
    st = kyc_status_for(fresh)
    # Self-heal: if this completes KYC and the account was suspended *for* KYC, restore it.
    if st["complete"] and fresh.get("status") == "suspended" and fresh.get("kyc_suspended"):
        await db.retailers.update_one(
            {"retailer_id": rid},
            {"$set": {"status": "active"}, "$unset": {"kyc_suspended": "", "suspended_reason": "", "suspended_at": ""}},
        )
        st = kyc_status_for(await db.retailers.find_one({"retailer_id": rid}))
        st["reactivated"] = True
    logger.info(f"Retailer {rid} uploaded KYC {dt}; complete={st['complete']}")
    return {"ok": True, "doc_type": dt, "kyc": st}


# ---------------------------------------------------------------------------
# Passwordless login via SMS OTP (registered numbers only)
# ---------------------------------------------------------------------------

class LoginOtpSendRequest(BaseModel):
    country_code: str = Field(default="+91")
    phone: str = Field(min_length=6, max_length=20)


class LoginOtpVerifyRequest(BaseModel):
    country_code: str = Field(default="+91")
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=4, max_length=8)


async def _find_retailer_by_phone(country_code: str, phone: str) -> Optional[dict]:
    """Find a non-deleted retailer whose stored phone ends with the given digits."""
    target = "".join(c for c in (phone or "") if c.isdigit())
    if not target:
        return None
    return await db.retailers.find_one({
        "phone": {"$regex": f"{re.escape(target)}$"},
        "status": {"$ne": "deleted"},
    })


@router.post("/phone/login-send-otp")
async def phone_login_send_otp(data: LoginOtpSendRequest):
    """OTP login step 1 — only send a code if a retailer is registered with this number."""
    if not await get_b2b_enabled(db):
        raise HTTPException(status_code=403, detail="Retailer portal is currently unavailable.")
    from services.phone_otp import to_e164, send_otp
    cc = (data.country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = f"+{cc}"
    digits = "".join(c for c in data.phone if c.isdigit())
    if cc == "+91" and len(digits) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number.")

    retailer = await _find_retailer_by_phone(cc, data.phone)
    if not retailer:
        raise HTTPException(
            status_code=404,
            detail="No retailer account is registered with this number. Please register first.",
        )
    if retailer.get("status") == "suspended":
        reason = retailer.get("suspended_reason") or "Please contact admin."
        raise HTTPException(status_code=403, detail=f"Your account has been suspended. Reason: {reason}")

    result = await send_otp(to_e164(cc, data.phone))
    if result.get("status") == "cooldown":
        raise HTTPException(status_code=429, detail=f"Please wait {result.get('retry_after')}s before requesting another code.")
    if result.get("status") == "error":
        raise HTTPException(status_code=503, detail=result.get("error"))
    return {
        "sent": True,
        "dev_mode": result.get("dev_mode", False),
        "dev_code": result.get("dev_code"),
        "business_name": retailer.get("business_name"),
    }


@router.post("/phone/login-verify")
async def phone_login_verify(data: LoginOtpVerifyRequest, response: Response):
    """OTP login step 2 — verify the code and issue a retailer session."""
    if not await get_b2b_enabled(db):
        raise HTTPException(status_code=403, detail="Retailer portal is currently unavailable.")
    from services.phone_otp import to_e164, verify_otp
    cc = (data.country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = f"+{cc}"

    retailer = await _find_retailer_by_phone(cc, data.phone)
    if not retailer:
        raise HTTPException(status_code=404, detail="No retailer account is registered with this number.")
    if retailer.get("status") == "suspended":
        reason = retailer.get("suspended_reason") or "Please contact admin."
        raise HTTPException(status_code=403, detail=f"Your account has been suspended. Reason: {reason}")
    if retailer.get("status") == "deleted":
        raise HTTPException(status_code=403, detail="Account not found")

    result = await verify_otp(to_e164(cc, data.phone), data.code)
    if not result.get("verified"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Verification failed.")

    email = retailer.get("email")
    session_token = await create_retailer_session(retailer["retailer_id"], email)
    response.set_cookie(
        key="retailer_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=RETAILER_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    )
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}},
    )
    logger.info(f"Retailer OTP-login: {retailer['retailer_id']} status={retailer.get('status')}")
    return {
        "message": "Login successful",
        "retailer": {
            "retailer_id": retailer["retailer_id"],
            "name": retailer.get("name"),
            "business_name": retailer.get("business_name"),
            "email": retailer.get("email"),
            "status": retailer.get("status", "under_processing"),
            "city": retailer.get("city"),
            "district": retailer.get("district"),
            "state": retailer.get("state"),
        },
        "token": session_token,
    }


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
    gstin: Optional[str] = None  # Preferred field — the GSTIN is the username
    email: Optional[str] = None  # Legacy field; treated as the GSTIN input
    username: Optional[str] = None  # Legacy field; treated as the GSTIN input
    password: str


# ---------------------------------------------------------------------------
# Self-serve password reset (GSTIN in → link to the email on file)
# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    gstin: str = Field(..., min_length=6, max_length=20)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20)
    password: str = Field(..., min_length=8, max_length=128)


GENERIC_RESET_RESPONSE = {
    "ok": True,
    "message": "If that GSTIN is registered, we've emailed a password reset link to the address on file.",
}


@router.post("/forgot-password")
async def retailer_forgot_password(data: ForgotPasswordRequest, request: Request):
    """Public — always returns the same message so GSTINs can't be probed."""
    from services.retailer_identity import normalize_gstin
    from services.retailer_password_reset import (
        issue_reset_token,
        send_reset_email,
        too_many_requests,
    )

    gstin = normalize_gstin(data.gstin)
    ip = request.client.host if request.client else None

    if await too_many_requests(db, gstin, ip):
        raise HTTPException(
            status_code=429,
            detail="Too many reset requests. Please try again in an hour or contact us.",
        )

    retailer = await db.retailers.find_one({
        "$or": [{"gst_number": gstin}, {"username": gstin}, {"username": gstin.lower()}]
    })

    if retailer and retailer.get("status") != "deleted" and retailer.get("email"):
        token = await issue_reset_token(db, retailer, ip)
        try:
            await send_reset_email(retailer, token)
        except Exception as e:  # noqa: BLE001
            logger.warning("reset email failed for %s: %s", retailer["retailer_id"], e)
        logger.info("password reset requested for %s", retailer["retailer_id"])

    return GENERIC_RESET_RESPONSE


@router.get("/reset-password/validate/{token}")
async def validate_reset_token(token: str):
    """Public — tells the reset page whether the link is still usable."""
    from services.retailer_password_reset import find_valid_token

    row = await find_valid_token(db, token)
    if not row:
        return {"valid": False, "reason": "This reset link is invalid or has expired"}
    retailer = await db.retailers.find_one(
        {"retailer_id": row["retailer_id"]},
        {"_id": 0, "business_name": 1, "name": 1, "gst_number": 1},
    )
    return {
        "valid": True,
        "business_name": (retailer or {}).get("business_name") or (retailer or {}).get("name"),
        "gst_number": (retailer or {}).get("gst_number"),
    }


@router.post("/reset-password")
async def retailer_reset_password(data: ResetPasswordRequest):
    """Public — consumes a one-time token and sets a new password."""
    from services.retailer_password_reset import find_valid_token, password_problems, send_changed_email

    problems = password_problems(data.password)
    if problems:
        raise HTTPException(status_code=422, detail="; ".join(problems))

    row = await find_valid_token(db, data.token)
    if not row:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    retailer = await db.retailers.find_one({"retailer_id": row["retailer_id"]})
    if not retailer or retailer.get("status") == "deleted":
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    now = datetime.now(timezone.utc).isoformat()
    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {"password_hash": hash_password(data.password), "password_set_at": now}},
    )
    await db.retailer_password_resets.update_one({"id": row["id"]}, {"$set": {"used_at": now}})

    # Revoke every existing session + clear any login lockout
    await db.retailer_sessions.delete_many({"retailer_id": retailer["retailer_id"]})
    from services.retailer_identity import clear_failed_logins
    await clear_failed_logins(db, (retailer.get("gst_number") or "").upper())

    try:
        await send_changed_email(retailer)
    except Exception as e:  # noqa: BLE001
        logger.warning("password-changed email failed: %s", e)

    logger.info("Retailer %s reset their password", retailer["retailer_id"])
    return {"ok": True, "gst_number": retailer.get("gst_number")}


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
    """Retailer login — the GSTIN is the username for every B2B account.

    Email is NOT a login identifier any more; it is kept for password
    recovery and transactional mail only.
    """
    # Kill-switch: block login when B2B portal is disabled
    if not await get_b2b_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="Retailer portal is currently unavailable. Please contact AAROHMM for access.",
        )

    from services.retailer_identity import (
        LEGACY_LOGIN_USERNAMES,
        clear_failed_logins,
        is_locked_out,
        is_valid_gstin,
        normalize_gstin,
        record_failed_login,
    )

    raw_identifier = (login_data.gstin or login_data.username or login_data.email or "").strip()

    if not raw_identifier:
        raise HTTPException(status_code=400, detail="Your GSTIN is required to sign in")

    if "@" in raw_identifier:
        raise HTTPException(
            status_code=400,
            detail="Retailer logins use your 15-character GSTIN, not your email address.",
        )

    gstin = normalize_gstin(raw_identifier)
    is_legacy = gstin.lower() in LEGACY_LOGIN_USERNAMES

    if not is_valid_gstin(gstin) and not is_legacy:
        raise HTTPException(status_code=400, detail="Enter a valid 15-character GSTIN")

    if await is_locked_out(db, gstin):
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Please try again in 15 minutes or reset your password.",
        )

    # Find retailer by GSTIN (or an allowlisted legacy username)
    retailer = await db.retailers.find_one({
        "$or": [
            {"gst_number": gstin},
            {"username": gstin},
            {"username": gstin.lower()},
        ]
    })

    if not retailer:
        await record_failed_login(db, gstin)
        raise HTTPException(status_code=401, detail="Invalid GSTIN or password")

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
        await record_failed_login(db, gstin)
        raise HTTPException(status_code=401, detail="Invalid GSTIN or password")

    await clear_failed_logins(db, gstin)

    # Create session
    email = retailer.get('email', '')
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
            "gst_number": retailer.get('gst_number'),
            "username": retailer.get('username'),
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
    alternate_phone: Optional[str] = Form(None, max_length=20),
    alternate_email: Optional[str] = Form(None, max_length=200),
    onboarding_session: Optional[str] = Form(None, max_length=200),
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
            detail="Retailer portal is currently unavailable. Please contact AAROHMM.",
        )

    gst = (gst_number or "").upper().strip()
    if not GST_PATTERN.match(gst):
        raise HTTPException(status_code=400, detail="Invalid GST number format")

    # ---- GST-registered email ownership (IDSPay contact + our email OTP) ----
    # The session is authoritative: identity comes from the server-side record,
    # never from the submitted email/GSTIN fields.
    from services import gst_email_otp as _gst_otp
    gst_email_verified = False
    verified_gst_email: Optional[str] = None
    gst_contact_meta: dict = {}
    if onboarding_session:
        sess = await _gst_otp.peek_session(onboarding_session)
        if not sess:
            raise HTTPException(
                status_code=400,
                detail="Your email verification has expired. Please verify your GST-registered email again.",
            )
        if (sess.get("gstin") or "").upper() != gst:
            raise HTTPException(
                status_code=400,
                detail="The verified email belongs to a different GSTIN. Please restart verification.",
            )
        gst_email_verified = True
        verified_gst_email = (sess.get("verified_email") or "").lower()
        gst_contact_meta = sess.get("meta") or {}
    elif _gst_email_otp_required():
        raise HTTPException(
            status_code=400,
            detail="Please verify the email registered against your GSTIN before registering.",
        )

    # Identity is the verified address; anything typed becomes an alternate.
    if verified_gst_email:
        typed = (str(email) or "").lower()
        if typed and typed != verified_gst_email and not alternate_email:
            alternate_email = typed
        email = verified_gst_email  # type: ignore[assignment]

    # ---- Phone ownership (OTP) required for Indian (+91) numbers ----
    cc_check = (country_code or "+91").strip()
    if not cc_check.startswith("+"):
        cc_check = f"+{cc_check}"
    if cc_check == "+91" and not gst_email_verified:
        from services.phone_otp import to_e164, is_phone_verified
        if not await is_phone_verified(to_e164(cc_check, phone)):
            raise HTTPException(
                status_code=400,
                detail="Please verify your phone number via the SMS OTP before registering.",
            )

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
    existing_gst = await db.retailers.find_one({"gst_number": gst})
    if existing_gst and existing_gst.get("status") != "deleted":
        raise HTTPException(
            status_code=409,
            detail="An account already exists for this GSTIN. Please log in with your GSTIN.",
        )

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
    trade_name = gst_record.get("trade_name") or legal_name
    retailer_state = _titlecase((state or "").strip()) or INDIAN_STATE_CODES_REG.get(gst[:2])

    # ---- Auto-onboarding gate ----
    # A retailer is onboarded AUTOMATICALLY only when BOTH the mobile AND the
    # email they entered match the GST record AND the email OTP was verified.
    # Anything else (IDSPay unavailable / wallet empty / IP not whitelisted, a
    # partial match, or a masked GST record) falls back to MANUAL admin review,
    # so onboarding keeps working while the IDSPay account is being sorted out.
    auto_approved = (
        gst_email_verified
        and gst_contact_meta.get("email") == "match"
        and gst_contact_meta.get("mobile") == "match"
    )
    if auto_approved:
        manual_review_reason = None
    elif not gst_email_verified:
        manual_review_reason = "GST-registered email OTP not completed (IDSPay verification unavailable or skipped)"
    else:
        diffs = [f for f in ("email", "mobile") if gst_contact_meta.get(f) != "match"]
        manual_review_reason = (
            "Entered " + " and ".join(diffs) + " did not match the GST record"
            if diffs else "GST contact could not be matched"
        )

    retailer = {
        "retailer_id": retailer_id,
        "business_name": _titlecase(business_name) or "—",
        "trade_name": trade_name,
        "legal_name": legal_name,
        "name": _titlecase(contact_name) or _titlecase(business_name) or "—",
        "contact_name": _titlecase(contact_name),
        "email": email.lower(),
        "phone": phone.strip(),
        "country_code": cc,
        "gst_number": gst,
        "username": gst,  # GSTIN is the login username for all B2B accounts
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
        "alternate_phone": (alternate_phone or "").strip() or None,
        "alternate_email": (alternate_email or "").strip().lower() or None,
        "status": "active" if auto_approved else "under_processing",
        "auto_onboarded": auto_approved,
        "onboarding_mode": "auto_idspay" if auto_approved else "manual_review",
        "manual_review_reason": manual_review_reason,
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
        "gst_email_verified": gst_email_verified,
        "gst_email_verified_at": now if gst_email_verified else None,
        "gst_email_verification_provider": "idspay" if gst_email_verified else None,
        # Admin review trail: what the applicant typed vs the GST record.
        "gst_contact_mismatch": bool(gst_contact_meta.get("any_mismatch")),
        "gst_contact_check": {
            "email_verdict": gst_contact_meta.get("email"),
            "mobile_verdict": gst_contact_meta.get("mobile"),
            "entered_email": gst_contact_meta.get("entered_email"),
            "entered_mobile": gst_contact_meta.get("entered_mobile"),
            "gst_email": gst_contact_meta.get("gst_email"),
            "gst_mobile": gst_contact_meta.get("gst_mobile"),
            "checked_at": now,
            "provider": "idspay",
        } if gst_contact_meta else None,
        "gst_contact_mismatch_reviewed": False if gst_contact_meta.get("any_mismatch") else None,
    }
    await db.retailers.insert_one(retailer)

    # Burn the onboarding session so one verification cannot register twice.
    if onboarding_session:
        await _gst_otp.claim_session(onboarding_session)

    # ---- Best-effort alert: typed contact differs from the GST record ----
    if gst_contact_meta.get("any_mismatch"):
        try:
            import os as _os2
            from services.email_service import send_email as _send

            chk = retailer["gst_contact_check"] or {}
            admin_to = _os2.environ.get("ADMIN_EMAIL", "contact.us@centraders.com")

            def _row(label, entered, record, verdict):
                colour = "#c0392b" if verdict == "mismatch" else "#16a34a" if verdict == "match" else "#b8860b"
                tag = {"mismatch": "DIFFERENT", "match": "matches", "indeterminate": "could not compare"}.get(verdict, verdict)
                return (
                    f"<tr><td style='padding:6px 10px;border:1px solid #e5e0d8'><b>{label}</b></td>"
                    f"<td style='padding:6px 10px;border:1px solid #e5e0d8'>{entered or '—'}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #e5e0d8'>{record or '—'}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #e5e0d8;color:{colour};font-weight:700'>{tag}</td></tr>"
                )

            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:640px">
              <h2 style="color:#b8860b">⚠ GST contact mismatch on a new registration</h2>
              <p><b>{retailer['business_name']}</b> ({gst}) completed email-OTP verification, but some
              details they entered differ from the contact on record against their GSTIN.</p>
              <table style="border-collapse:collapse;font-size:13px">
                <tr style="background:#f5f0e8">
                  <th style="padding:6px 10px;border:1px solid #e5e0d8;text-align:left">Field</th>
                  <th style="padding:6px 10px;border:1px solid #e5e0d8;text-align:left">They entered</th>
                  <th style="padding:6px 10px;border:1px solid #e5e0d8;text-align:left">GST record (IDSPay)</th>
                  <th style="padding:6px 10px;border:1px solid #e5e0d8;text-align:left">Result</th>
                </tr>
                {_row('Mobile', chk.get('entered_mobile'), chk.get('gst_mobile'), chk.get('mobile_verdict'))}
                {_row('Email', chk.get('entered_email'), chk.get('gst_email'), chk.get('email_verdict'))}
              </table>
              <p style="color:#6b6357;font-size:12px">They proved ownership of the GST-registered email via OTP,
              so registration was allowed. Review it under Retailers in the admin panel.</p>
            </div>
            """
            await _send(admin_to, f"⚠ GST contact mismatch — {retailer['business_name']} ({gst})", html)
        except Exception as _e:
            logger.warning(f"mismatch alert email failed: {_e}")

    # ---- Best-effort Supabase mirror (never blocks, strips password) ----
    try:
        from services.supabase_sync import mirror_user_upsert
        mirror_user_upsert({k: v for k, v in retailer.items() if k != "password_hash"}, kind="retailer")
    except Exception:
        pass

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
                "https://gst-onboard-hub.preview.emergentagent.com",
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
              <p style='margin:0 0 12px;'>A new retailer has registered on the AAROHMM B2B portal and is waiting for your approval.</p>
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
            subject=f"[AAROHMM B2B] New retailer registration — {retailer['business_name']}",
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
              <h1 style='color:#d4af37;margin:0;'>AAROHMM</h1>
              <p style='color:#fff;margin:6px 0 0;'>Registration received · under review</p>
            </td></tr>
            <tr><td style='padding:24px;color:#1e3a52;'>
              <p>Hi {retailer['contact_name'] or 'there'},</p>
              <p>Thanks for registering as an AAROHMM retailer. Our team is verifying your details against your GST certificate. You&rsquo;ll receive a follow-up email as soon as your account is activated (typically within 1 business day).</p>
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
            subject="AAROHMM B2B — your registration is under review",
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

    logger.info(
        f"New retailer registered: {retailer_id} status={retailer['status']} "
        f"auto_onboarded={auto_approved} gst_verified={gst_verified}"
    )

    return {
        "message": (
            "Registration complete — your account is active."
            if auto_approved else
            "Registration submitted — your account is under review."
        ),
        "retailer": {
            "retailer_id": retailer_id,
            "name": retailer["name"],
            "email": retailer["email"],
            "status": retailer["status"],
        },
        "token": session_token,
        "gst_verified": gst_verified,
        "auto_onboarded": auto_approved,
        "manual_review_reason": manual_review_reason,
    }
