"""
B2B Retailer Waitlist
Public capture form shown on /retailer/login when portal is disabled.
Admin can view all signups.
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
import os
import re
import uuid
import logging

from dependencies import db, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-auth/waitlist", tags=["Retailer Waitlist"])
admin_router = APIRouter(prefix="/admin/b2b-waitlist", tags=["Admin B2B Waitlist"])

GST_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')

# State code → state name (first 2 chars of GSTIN)
INDIAN_STATE_CODES = {
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


class WaitlistSignup(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    country_code: str = Field(default="+91", max_length=5)
    gst_number: str = Field(..., min_length=15, max_length=15)
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    message: Optional[str] = Field(None, max_length=1000)


def _titlecase(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return " ".join(w.capitalize() for w in value.strip().split())


# ---------------------------------------------------------------------------
# Public GST lookup — used by the waitlist form to auto-prefill business
# name + city + state once a valid GSTIN is typed. NOT authenticated; rate
# is implicitly limited by Appyflow's per-key quota.
# ---------------------------------------------------------------------------

@router.get("/gst-lookup/{gst_number}")
async def public_gst_lookup(gst_number: str):
    """Return verified business name + address fields for a GSTIN.

    Returns 200 with `verified=False` (instead of an error) when the GSTIN
    is well-formed but Appyflow can't find/verify it — so the form can show
    a soft warning without aborting.
    """
    gst = (gst_number or "").upper().strip()
    if not GST_PATTERN.match(gst):
        raise HTTPException(status_code=400, detail="Invalid GST number format")

    from services.gst_verification import verify_gst_number

    result = await verify_gst_number(gst)
    if not result.get("verified"):
        return {
            "verified": False,
            "gst_number": gst,
            "state": INDIAN_STATE_CODES.get(gst[:2]),
            "error": result.get("error") or "Could not verify GSTIN",
        }

    # Build a clean payload for the form
    addr_parts = result.get("address", "").split(", ")
    return {
        "verified": True,
        "gst_number": gst,
        "business_name": _titlecase(
            result.get("trade_name") or result.get("taxpayer_name") or ""
        ),
        "legal_name": result.get("taxpayer_name"),
        "trade_name": result.get("trade_name"),
        "is_active": result.get("is_active", False),
        "status": result.get("status"),
        "state": INDIAN_STATE_CODES.get(gst[:2]) or result.get("state"),
        "city": _titlecase(addr_parts[-4]) if len(addr_parts) >= 4 else None,
        "pincode": addr_parts[-1] if addr_parts and addr_parts[-1].isdigit() else None,
        "address": result.get("address"),
        "registration_date": result.get("registration_date"),
    }


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
        if isinstance(result, dict) and result.get("verified"):
            gst_verified = True
            legal_name = result.get("taxpayer_name") or result.get("trade_name")
        else:
            gst_verification_error = (result or {}).get(
                "error", "Verification unavailable"
            )
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
                "state": _titlecase((data.state or "").strip())
                or INDIAN_STATE_CODES.get(gst[:2]),
                "address": (data.address or "").strip() or None,
                "pincode": (data.pincode or "").strip() or None,
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


@admin_router.post("/{signup_id}/onboard")
async def admin_onboard_waitlist_retailer(
    signup_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """One-click onboarding from waitlist:

    - Re-fetch GSTN data via Appyflow (uses freshest legal-name / address).
    - Create the retailer with everything pre-filled.
    - Generate a single-use invite token (24h TTL) and email a magic
      `setup-password` link to the retailer's email.
    - Mark the waitlist entry as `onboarded` and link the new retailer_id.
    Returns 409 if the retailer was already onboarded from this signup.
    """
    admin = await require_admin(request, session_token)
    signup = await db.retailer_waitlist.find_one({"id": signup_id}, {"_id": 0})
    if not signup:
        raise HTTPException(status_code=404, detail="Signup not found")
    if signup.get("retailer_id"):
        raise HTTPException(
            status_code=409,
            detail=f"Already onboarded as retailer {signup['retailer_id']}",
        )

    # Refresh GSTN data — Appyflow may have newer info than at signup time
    legal_name = signup.get("legal_name_from_gst")
    address = signup.get("address")
    state = signup.get("state")
    city = signup.get("city")
    pincode = signup.get("pincode")
    try:
        from services.gst_verification import verify_gst_number

        verify = await verify_gst_number(signup["gst_number"])
        if verify.get("verified"):
            legal_name = verify.get("taxpayer_name") or legal_name
            full_addr = verify.get("address") or ""
            if full_addr:
                parts = [p.strip() for p in full_addr.split(",") if p.strip()]
                # Last numeric token is pincode; second-to-last is state
                if parts and parts[-1].isdigit():
                    pincode = pincode or parts[-1]
                    parts = parts[:-1]
                if parts:
                    state = state or parts[-1]
                    parts = parts[:-1]
                if parts:
                    city = city or parts[-1]
                    parts = parts[:-1]
                address = address or ", ".join(parts) or full_addr
    except Exception as e:
        logger.warning(f"Onboarding refresh GST lookup failed: {e}")

    retailer_id = f"RTL_{uuid.uuid4().hex[:10].upper()}"
    invite_token = uuid.uuid4().hex + uuid.uuid4().hex
    invite_expires = datetime.now(timezone.utc).replace(microsecond=0)
    invite_expires_iso = (
        invite_expires.replace(tzinfo=timezone.utc) + timedelta(days=1)
    ).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    retailer = {
        "retailer_id": retailer_id,
        "business_name": signup.get("business_name") or legal_name or "—",
        "trade_name": legal_name,
        "name": signup.get("contact_name") or signup.get("business_name") or "—",
        "contact_name": signup.get("contact_name"),
        "email": signup["email"],
        "phone": signup.get("phone"),
        "country_code": signup.get("country_code", "+91"),
        "gst_number": signup.get("gst_number"),
        "city": city,
        "state": state,
        "address": address,
        "pincode": pincode,
        "status": "pending_setup",
        "invite_token": invite_token,
        "invite_expires_at": invite_expires_iso,
        "password_hash": None,
        "created_at": now,
        "onboarded_by": admin.get("email", "admin"),
        "from_waitlist_id": signup_id,
    }
    await db.retailers.insert_one(retailer)

    # Mark waitlist entry as onboarded
    await db.retailer_waitlist.update_one(
        {"id": signup_id},
        {"$set": {
            "status": "onboarded",
            "retailer_id": retailer_id,
            "onboarded_at": now,
            "onboarded_by": admin.get("email", "admin"),
            "updated_at": now,
        }},
    )

    # Send invite email
    try:
        from services.email_service import send_email

        portal_url = os.environ.get(
            "FRONTEND_PUBLIC_URL",
            "https://addrika-kyc-onboard.preview.emergentagent.com",
        ).rstrip("/")
        link = f"{portal_url}/retailer/setup-password?token={invite_token}"
        html = f"""
        <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
          <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;'>
            <tr><td style='background:#1e3a52;padding:24px;text-align:center;'>
              <h1 style='color:#d4af37;margin:0;'>ADDRIKA</h1>
              <p style='color:#fff;margin:4px 0 0;'>Welcome to our wholesale family</p>
            </td></tr>
            <tr><td style='padding:24px;'>
              <p>Hi {retailer['name']},</p>
              <p>You've been onboarded to Addrika's B2B Retailer Portal.
              Your account <b>{retailer['business_name']}</b> ({retailer['gst_number']}) is ready.</p>
              <p style='text-align:center;margin:28px 0;'>
                <a href='{link}' style='background:#d4af37;color:#1e3a52;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;'>
                  Set your password
                </a>
              </p>
              <p style='color:#888;font-size:12px;'>This link expires in 24 hours. If it doesn't work, paste this in your browser:<br/><code>{link}</code></p>
              <p style='margin-top:24px;color:#888;font-size:12px;'>— Addrika B2B Team · contact.us@centraders.com</p>
            </td></tr>
          </table>
        </body></html>
        """
        await send_email(
            to_email=retailer["email"],
            subject="Welcome to Addrika B2B — set your password (link expires in 24h)",
            html_content=html,
        )
    except Exception as e:
        logger.error(f"Onboarding email failed for {retailer['email']}: {e}")

    return {
        "ok": True,
        "retailer_id": retailer_id,
        "invite_link": f"/retailer/setup-password?token={invite_token}",
        "expires_at": invite_expires_iso,
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
