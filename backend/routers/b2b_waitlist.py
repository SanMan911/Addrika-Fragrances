"""
B2B Retailer Waitlist
Public capture form shown on /retailer/login when portal is disabled.
Admin can view all signups.
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
import re
import uuid
import logging

from dependencies import db, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-auth/waitlist", tags=["Retailer Waitlist"])
admin_router = APIRouter(prefix="/admin/b2b-waitlist", tags=["Admin B2B Waitlist"])

GST_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')


class WaitlistSignup(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    country_code: str = Field(default="+91", max_length=5)
    gst_number: str = Field(..., min_length=15, max_length=15)
    city: Optional[str] = None
    message: Optional[str] = Field(None, max_length=1000)


def _titlecase(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return " ".join(w.capitalize() for w in value.strip().split())


@router.post("")
async def create_waitlist_signup(data: WaitlistSignup, request: Request):
    """Public endpoint — anyone interested in B2B can leave their info."""
    gst = (data.gst_number or "").upper().strip()
    if not GST_PATTERN.match(gst):
        raise HTTPException(status_code=400, detail="Invalid GST number format")

    # Try to auto-verify GST (best-effort; doesn't block signup)
    legal_name = None
    gst_verified = False
    gst_verification_error: Optional[str] = None
    try:
        from services.gst_verification import verify_gst_number  # type: ignore
        result = await verify_gst_number(gst)
        if isinstance(result, dict) and result.get("valid"):
            gst_verified = True
            legal_name = result.get("legal_name") or result.get("trade_name")
        else:
            gst_verification_error = (result or {}).get("error", "Verification unavailable")
    except Exception as e:
        gst_verification_error = str(e) or "Verification service unavailable"

    cc = (data.country_code or "+91").strip()
    if not cc.startswith("+"):
        cc = f"+{cc}"

    # Deduplicate on email (upsert latest)
    now = datetime.now(timezone.utc).isoformat()
    await db.retailer_waitlist.update_one(
        {"email": data.email.lower()},
        {
            "$set": {
                "business_name": _titlecase(data.business_name),
                "contact_name": _titlecase(data.contact_name),
                "legal_name_from_gst": legal_name,
                "email": data.email.lower(),
                "country_code": cc,
                "phone": data.phone.strip(),
                "whatsapp_full": f"{cc}{data.phone.strip()}",
                "gst_number": gst,
                "gst_verified": gst_verified,
                "gst_verification_error": gst_verification_error,
                "city": _titlecase((data.city or "").strip()) or None,
                "message": (data.message or "").strip() or None,
                "updated_at": now,
                "source_ip": request.client.host if request.client else None,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "status": "new",  # new | contacted | onboarded | archived
                "created_at": now,
            },
        },
        upsert=True,
    )
    logger.info(
        f"B2B waitlist signup: {data.email} / {data.business_name} (GST verified={gst_verified})"
    )
    return {
        "message": "Thanks — we'll be in touch soon.",
        "email": data.email.lower(),
        "gst_verified": gst_verified,
        "legal_name": legal_name,
    }


@admin_router.get("")
async def admin_list_waitlist(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    await require_admin(request, session_token)
    skip = (page - 1) * limit
    query = {}
    if status:
        query["status"] = status

    items = await db.retailer_waitlist.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.retailer_waitlist.count_documents(query)
    status_counts = {}
    for s in ["new", "contacted", "onboarded", "archived"]:
        status_counts[s] = await db.retailer_waitlist.count_documents({"status": s})

    return {
        "items": items,
        "status_counts": status_counts,
        "pagination": {"page": page, "limit": limit, "total": total},
    }


class WaitlistStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r'^(new|contacted|onboarded|archived)$')
    notes: Optional[str] = None


@admin_router.put("/{signup_id}/status")
async def admin_update_waitlist_status(
    signup_id: str,
    data: WaitlistStatusUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    result = await db.retailer_waitlist.update_one(
        {"id": signup_id},
        {
            "$set": {
                "status": data.status,
                "admin_notes": data.notes,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin.get("email", "admin"),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Signup not found")
    return {"message": "Status updated", "status": data.status}
