"""
KYC Routes — PAN + Aadhaar OTP eKYC powered by Sandbox API.

Public retailer-facing endpoints (used during waitlist / setup-password
onboarding) and admin endpoints (used to manually KYC any retailer or
waitlist entry).
"""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Cookie, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.kyc_sandbox import (
    is_configured as kyc_configured,
    verify_pan,
    aadhaar_generate_otp,
    aadhaar_verify_otp,
)

retailer_router = APIRouter(prefix="/retailer-auth/kyc", tags=["Retailer KYC"])
admin_router = APIRouter(prefix="/admin/kyc", tags=["Admin KYC"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class PanVerifyRequest(BaseModel):
    pan_number: str = Field(..., min_length=10, max_length=10)
    name_to_match: Optional[str] = None
    waitlist_id: Optional[str] = None  # if set, persist result on waitlist row
    retailer_id: Optional[str] = None  # if set, persist result on retailer doc


class AadhaarOtpRequest(BaseModel):
    aadhaar_number: str = Field(..., min_length=12, max_length=14)


class AadhaarOtpVerifyRequest(BaseModel):
    reference_id: str = Field(..., min_length=4)
    otp: str = Field(..., min_length=6, max_length=6)
    waitlist_id: Optional[str] = None
    retailer_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Status (public — used by frontend to render KYC step at all)
# ---------------------------------------------------------------------------
@retailer_router.get("/status")
async def public_kyc_status():
    return {"enabled": kyc_configured(), "provider": "sandbox"}


@admin_router.get("/status")
async def admin_kyc_status(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    return {"enabled": kyc_configured(), "provider": "sandbox"}


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------
async def _persist_pan(result: dict, waitlist_id: Optional[str], retailer_id: Optional[str]):
    if not result.get("verified"):
        return
    payload = {
        "pan_number": result["pan_number"],
        "pan_verified": True,
        "pan_full_name": result.get("full_name"),
        "pan_status": result.get("status"),
        "pan_verified_at": result.get("verified_at"),
    }
    if waitlist_id:
        await db.retailer_waitlist.update_one(
            {"id": waitlist_id}, {"$set": payload}
        )
    if retailer_id:
        await db.retailers.update_one(
            {"retailer_id": retailer_id}, {"$set": payload}
        )


async def _persist_aadhaar(result: dict, waitlist_id: Optional[str], retailer_id: Optional[str]):
    if not result.get("verified"):
        return
    payload = {
        "aadhaar_verified": True,
        "aadhaar_last_4": result.get("aadhaar_last_4"),
        "aadhaar_name": result.get("name"),
        "aadhaar_dob": result.get("dob"),
        "aadhaar_address": result.get("address"),
        "aadhaar_state": result.get("state"),
        "aadhaar_pincode": result.get("pincode"),
        "aadhaar_verified_at": result.get("verified_at"),
    }
    if waitlist_id:
        await db.retailer_waitlist.update_one(
            {"id": waitlist_id}, {"$set": payload}
        )
    if retailer_id:
        await db.retailers.update_one(
            {"retailer_id": retailer_id}, {"$set": payload}
        )


def _strip_raw(result: dict) -> dict:
    """Don't ship the raw provider payload to clients."""
    return {k: v for k, v in result.items() if k != "raw"}


# ---------------------------------------------------------------------------
# PAN — retailer + admin
# ---------------------------------------------------------------------------
@retailer_router.post("/pan/verify")
async def retailer_pan_verify(data: PanVerifyRequest):
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await verify_pan(data.pan_number, data.name_to_match or "")
    await _persist_pan(result, data.waitlist_id, data.retailer_id)
    return _strip_raw(result)


@admin_router.post("/pan/verify")
async def admin_pan_verify(
    data: PanVerifyRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await verify_pan(data.pan_number, data.name_to_match or "")
    await _persist_pan(result, data.waitlist_id, data.retailer_id)
    return _strip_raw(result)


# ---------------------------------------------------------------------------
# Aadhaar OTP — retailer + admin
# ---------------------------------------------------------------------------
@retailer_router.post("/aadhaar/otp")
async def retailer_aadhaar_otp(data: AadhaarOtpRequest):
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await aadhaar_generate_otp(data.aadhaar_number)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error") or "OTP generation failed")
    return result


@retailer_router.post("/aadhaar/verify")
async def retailer_aadhaar_verify(data: AadhaarOtpVerifyRequest):
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await aadhaar_verify_otp(data.reference_id, data.otp)
    await _persist_aadhaar(result, data.waitlist_id, data.retailer_id)
    return _strip_raw(result)


@admin_router.post("/aadhaar/otp")
async def admin_aadhaar_otp(
    data: AadhaarOtpRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await aadhaar_generate_otp(data.aadhaar_number)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error") or "OTP generation failed")
    return result


@admin_router.post("/aadhaar/verify")
async def admin_aadhaar_verify(
    data: AadhaarOtpVerifyRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if not kyc_configured():
        raise HTTPException(503, "KYC service not configured")
    result = await aadhaar_verify_otp(data.reference_id, data.otp)
    await _persist_aadhaar(result, data.waitlist_id, data.retailer_id)
    return _strip_raw(result)


# ---------------------------------------------------------------------------
# Admin: KYC summary for a retailer or waitlist row
# ---------------------------------------------------------------------------
@admin_router.get("/summary/retailer/{retailer_id}")
async def admin_kyc_summary_retailer(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    rt = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0})
    if not rt:
        raise HTTPException(404, "Retailer not found")
    return _build_summary(rt)


@admin_router.get("/summary/waitlist/{waitlist_id}")
async def admin_kyc_summary_waitlist(
    waitlist_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    wl = await db.retailer_waitlist.find_one({"id": waitlist_id}, {"_id": 0})
    if not wl:
        raise HTTPException(404, "Waitlist entry not found")
    return _build_summary(wl)


def _build_summary(doc: dict) -> dict:
    return {
        "gst_verified": bool(doc.get("gst_verified")),
        "gst_number": doc.get("gst_number"),
        "pan_verified": bool(doc.get("pan_verified")),
        "pan_number": doc.get("pan_number"),
        "pan_full_name": doc.get("pan_full_name"),
        "pan_verified_at": doc.get("pan_verified_at"),
        "aadhaar_verified": bool(doc.get("aadhaar_verified")),
        "aadhaar_last_4": doc.get("aadhaar_last_4"),
        "aadhaar_name": doc.get("aadhaar_name"),
        "aadhaar_verified_at": doc.get("aadhaar_verified_at"),
        "fully_kyc_verified": bool(
            doc.get("gst_verified")
            and doc.get("pan_verified")
            and doc.get("aadhaar_verified")
        ),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
