"""
Gift Code API Routes for Addrika
Admin endpoints for birthday/anniversary/festival gift code management
"""
from fastapi import APIRouter, HTTPException, Request, Cookie, Depends
from typing import Optional
from pydantic import BaseModel

from dependencies import db, require_admin
from services.gift_code_service import (
    get_gift_code_stats,
    get_users_with_upcoming_birthdays,
    get_users_with_upcoming_anniversaries,
    send_birthday_wish_emails,
    send_anniversary_wish_emails,
    get_active_festival_codes,
    get_upcoming_festivals,
    ensure_festival_code_exists,
    create_festival_codes_for_upcoming,
    BIRTHDAY_CODE,
    ANNIVERSARY_CODE,
    BIRTHDAY_DISCOUNT_PERCENT,
    ANNIVERSARY_DISCOUNT_PERCENT,
    FESTIVAL_DISCOUNT_PERCENT
)

router = APIRouter(prefix="/gift-codes", tags=["Gift Codes"])


class CreateFestivalCodeRequest(BaseModel):
    festival_name: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD


@router.get("/admin/stats")
async def get_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get gift code statistics for admin dashboard"""
    stats = await get_gift_code_stats()
    return stats


@router.get("/admin/upcoming-birthdays")
async def get_upcoming_birthdays(
    request: Request,
    days_ahead: int = 7,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get users with upcoming birthdays"""
    users = await get_users_with_upcoming_birthdays(days_ahead=days_ahead)
    return {
        "users": [
            {
                "user_id": u.get("user_id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "phone": u.get("phone"),
                "date_of_birth": u.get("date_of_birth"),
                "birthday_date": u.get("birthday_date"),
                "days_until": u.get("days_until")
            } for u in users
        ],
        "total": len(users)
    }


@router.get("/admin/upcoming-anniversaries")
async def get_upcoming_anniversaries(
    request: Request,
    days_ahead: int = 7,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get users with upcoming anniversaries"""
    users = await get_users_with_upcoming_anniversaries(days_ahead=days_ahead)
    return {
        "users": [
            {
                "user_id": u.get("user_id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "phone": u.get("phone"),
                "date_of_marriage": u.get("date_of_marriage"),
                "anniversary_date": u.get("anniversary_date"),
                "days_until": u.get("days_until"),
                "years_married": u.get("years_married")
            } for u in users
        ],
        "total": len(users)
    }


@router.post("/admin/process-birthdays")
async def trigger_birthday_processing(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Manually trigger birthday wish email processing"""
    result = await send_birthday_wish_emails()
    return {
        "message": "Birthday processing completed",
        "sent": result["sent"],
        "skipped": result["skipped"],
        "failed": result["failed"],
        "total_users": result["total_users"]
    }


@router.post("/admin/process-anniversaries")
async def trigger_anniversary_processing(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Manually trigger anniversary wish email processing"""
    result = await send_anniversary_wish_emails()
    return {
        "message": "Anniversary processing completed",
        "sent": result["sent"],
        "skipped": result["skipped"],
        "failed": result["failed"],
        "total_users": result["total_users"]
    }


# ==================== FESTIVAL CODE ENDPOINTS ====================

@router.get("/admin/festivals/upcoming")
async def get_upcoming_festivals_list(
    request: Request,
    days_ahead: int = 30,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get upcoming festivals"""
    festivals = get_upcoming_festivals(days_ahead=days_ahead)
    return {"festivals": festivals}


@router.get("/admin/festivals/active-codes")
async def get_active_festival_codes_list(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Get all active festival codes"""
    codes = await get_active_festival_codes()
    return {"codes": codes}


@router.post("/admin/festivals/create-code")
async def create_festival_code(
    request_data: CreateFestivalCodeRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Manually create a festival code"""
    result = await ensure_festival_code_exists(
        request_data.festival_name,
        request_data.start_date,
        request_data.end_date
    )
    
    if result["already_existed"]:
        return {
            "message": f"Festival code {result['code']} already exists",
            **result
        }
    
    return {
        "message": f"Festival code {result['code']} created successfully",
        **result
    }


@router.post("/admin/festivals/auto-create")
async def auto_create_festival_codes(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Auto-create codes for upcoming festivals (next 7 days)"""
    created = await create_festival_codes_for_upcoming()
    
    return {
        "message": f"Created {len(created)} new festival codes",
        "codes": created
    }


@router.delete("/admin/festivals/deactivate/{code}")
async def deactivate_festival_code(
    code: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Deactivate a festival code"""
    result = await db.discount_codes.update_one(
        {"code": code.upper(), "gift_type": "festival"},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Festival code not found")
    
    return {"message": f"Festival code {code} deactivated"}


# ==================== CODE USAGE STATS ====================

@router.get("/admin/usage-stats")
async def get_usage_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    skip: int = 0,
    limit: int = 50,
    admin: dict = Depends(require_admin)
):
    """Get gift code usage statistics"""
    # Get recent birthday/anniversary code usages
    cursor = db.gift_code_usage.find({}).sort("used_at", -1).skip(skip).limit(limit)
    
    usages = []
    async for usage in cursor:
        usages.append({
            "user_id": usage.get("user_id"),
            "code_type": usage.get("code_type"),
            "code": usage.get("code"),
            "discount_amount": usage.get("discount_amount"),
            "used_at": usage.get("used_at").isoformat() if usage.get("used_at") else None
        })
    
    total = await db.gift_code_usage.count_documents({})
    
    return {"usages": usages, "total": total}


@router.get("/admin/wishes-sent")
async def get_wishes_sent(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    wish_type: Optional[str] = None,  # "birthday" or "anniversary"
    skip: int = 0,
    limit: int = 50,
    admin: dict = Depends(require_admin)
):
    """Get list of birthday/anniversary wishes sent"""
    results = []
    
    if wish_type != "anniversary":
        # Get birthday wishes
        cursor = db.birthday_wishes_sent.find({}).sort("sent_at", -1).skip(skip).limit(limit)
        async for wish in cursor:
            results.append({
                "type": "birthday",
                "email": wish.get("email"),
                "year": wish.get("year"),
                "sent_at": wish.get("sent_at").isoformat() if wish.get("sent_at") else None
            })
    
    if wish_type != "birthday":
        # Get anniversary wishes
        cursor = db.anniversary_wishes_sent.find({}).sort("sent_at", -1).skip(skip).limit(limit)
        async for wish in cursor:
            results.append({
                "type": "anniversary",
                "email": wish.get("email"),
                "year": wish.get("year"),
                "sent_at": wish.get("sent_at").isoformat() if wish.get("sent_at") else None
            })
    
    # Sort by sent_at
    results.sort(key=lambda x: x.get("sent_at") or "", reverse=True)
    
    return {"wishes": results[:limit]}


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/info")
async def get_gift_codes_info():
    """Get public info about gift codes (for customers)"""
    return {
        "birthday_code": BIRTHDAY_CODE,
        "anniversary_code": ANNIVERSARY_CODE,
        "birthday_discount": f"{BIRTHDAY_DISCOUNT_PERCENT}% OFF",
        "anniversary_discount": f"{ANNIVERSARY_DISCOUNT_PERCENT}% OFF",
        "festival_discount": f"{FESTIVAL_DISCOUNT_PERCENT}% OFF",
        "note": "Birthday and Anniversary codes can be used within ±7 days of your special date. Make sure your profile has your DOB/Anniversary set!"
    }
