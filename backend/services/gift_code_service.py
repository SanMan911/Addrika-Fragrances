"""
Birthday, Anniversary & Festival Gift Code Service for Addrika

Code Types:
1. HAPPYBDAY - 20% off, usable by any user during their birthday period (±7 days)
2. ANNIVERSARY - 15% off, usable by any user during their anniversary period (±7 days)
3. Festival codes - 10% off, named after major festival, usable by anyone during validity

Each user can use birthday/anniversary code only once per year.
Festival codes can be used by anyone, any number of times during validity.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# Configuration
BIRTHDAY_DISCOUNT_PERCENT = 20  # 20% off on birthday
ANNIVERSARY_DISCOUNT_PERCENT = 15  # 15% off on anniversary
FESTIVAL_DISCOUNT_PERCENT = 10  # 10% off on festivals
CODE_VALIDITY_DAYS = 7  # Birthday/Anniversary codes valid ±7 days from date
MIN_ORDER_VALUE = 249  # Minimum order value for codes

# Standard codes (reusable, validated per user)
BIRTHDAY_CODE = "HAPPYBDAY"
ANNIVERSARY_CODE = "ANNIVERSARY"

# Indian Festivals with dates (month, day) and priority (higher = bigger festival)
INDIAN_FESTIVALS = [
    # Major festivals
    {"name": "Diwali", "month": 10, "day_range": (20, 31), "priority": 100, "extends_to_nov": 5},  # Oct 20 - Nov 5
    {"name": "Holi", "month": 3, "day_range": (10, 20), "priority": 90},
    {"name": "Durga Puja", "month": 10, "day_range": (1, 15), "priority": 85},
    {"name": "Ganesh Chaturthi", "month": 9, "day_range": (5, 15), "priority": 80},
    {"name": "Navratri", "month": 10, "day_range": (1, 10), "priority": 75},
    {"name": "Raksha Bandhan", "month": 8, "day_range": (15, 25), "priority": 70},
    {"name": "Janmashtami", "month": 8, "day_range": (20, 30), "priority": 65},
    {"name": "Onam", "month": 8, "day_range": (25, 31), "priority": 60},
    # New Year and Republic/Independence Day
    {"name": "New Year", "month": 1, "day_range": (1, 7), "priority": 95},
    {"name": "Republic Day", "month": 1, "day_range": (24, 28), "priority": 50},
    {"name": "Independence Day", "month": 8, "day_range": (13, 17), "priority": 55},
    # Other festivals
    {"name": "Makar Sankranti", "month": 1, "day_range": (12, 16), "priority": 45},
    {"name": "Pongal", "month": 1, "day_range": (14, 17), "priority": 45},
    {"name": "Baisakhi", "month": 4, "day_range": (12, 16), "priority": 40},
    {"name": "Eid", "month": 4, "day_range": (1, 15), "priority": 70},  # Approximate - varies by lunar calendar
    {"name": "Dussehra", "month": 10, "day_range": (10, 18), "priority": 75},
    {"name": "Christmas", "month": 12, "day_range": (23, 28), "priority": 60},
    {"name": "Karwa Chauth", "month": 10, "day_range": (15, 25), "priority": 35},
]


async def get_db():
    """Get database connection"""
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'addrika_db')
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


def is_within_birthday_period(date_of_birth: str, check_date: datetime = None) -> bool:
    """Check if current date is within ±7 days of user's birthday"""
    if not date_of_birth:
        return False
    
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        if check_date is None:
            check_date = datetime.now(timezone.utc)
        
        # Create this year's birthday
        this_year_birthday = dob.replace(year=check_date.year)
        
        # Check if within ±7 days
        delta = abs((check_date.replace(tzinfo=None) - this_year_birthday).days)
        return delta <= CODE_VALIDITY_DAYS
    except (ValueError, TypeError):
        return False


def is_within_anniversary_period(date_of_marriage: str, check_date: datetime = None) -> bool:
    """Check if current date is within ±7 days of user's anniversary"""
    if not date_of_marriage:
        return False
    
    try:
        dom = datetime.strptime(date_of_marriage, "%Y-%m-%d")
        if check_date is None:
            check_date = datetime.now(timezone.utc)
        
        # Create this year's anniversary
        this_year_anniversary = dom.replace(year=check_date.year)
        
        # Check if within ±7 days
        delta = abs((check_date.replace(tzinfo=None) - this_year_anniversary).days)
        return delta <= CODE_VALIDITY_DAYS
    except (ValueError, TypeError):
        return False


async def can_user_use_birthday_code(user_id: str, year: int = None) -> bool:
    """Check if user has already used birthday code this year"""
    db = await get_db()
    if year is None:
        year = datetime.now(timezone.utc).year
    
    usage = await db.gift_code_usage.find_one({
        "user_id": user_id,
        "code_type": "birthday",
        "year": year
    })
    
    return usage is None


async def can_user_use_anniversary_code(user_id: str, year: int = None) -> bool:
    """Check if user has already used anniversary code this year"""
    db = await get_db()
    if year is None:
        year = datetime.now(timezone.utc).year
    
    usage = await db.gift_code_usage.find_one({
        "user_id": user_id,
        "code_type": "anniversary",
        "year": year
    })
    
    return usage is None


async def record_gift_code_usage(user_id: str, code_type: str, code: str, discount_amount: float):
    """Record that user has used a gift code"""
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    await db.gift_code_usage.insert_one({
        "user_id": user_id,
        "code_type": code_type,
        "code": code,
        "year": now.year,
        "discount_amount": discount_amount,
        "used_at": now
    })


async def validate_birthday_code(user: dict, subtotal: float) -> dict:
    """Validate HAPPYBDAY code for a user"""
    user_id = user.get("user_id") or str(user.get("_id", ""))
    dob = user.get("date_of_birth")
    
    # Check if user has DOB set
    if not dob:
        return {"valid": False, "error": "Please update your date of birth in your profile to use this code"}
    
    # Check if within birthday period
    if not is_within_birthday_period(dob):
        return {"valid": False, "error": "This code is only valid during your birthday period (±7 days)"}
    
    # Check minimum order value
    if subtotal < MIN_ORDER_VALUE:
        return {"valid": False, "error": f"Minimum order value of ₹{MIN_ORDER_VALUE} required"}
    
    # Check if already used this year
    if not await can_user_use_birthday_code(user_id):
        return {"valid": False, "error": "You have already used your birthday code this year"}
    
    # Calculate discount
    discount_amount = min(subtotal * (BIRTHDAY_DISCOUNT_PERCENT / 100), 500)  # Max ₹500
    
    return {
        "valid": True,
        "code": BIRTHDAY_CODE,
        "discount_type": "percentage",
        "discount_percent": BIRTHDAY_DISCOUNT_PERCENT,
        "discount_amount": round(discount_amount, 2),
        "max_discount": 500,
        "message": f"🎂 Happy Birthday! {BIRTHDAY_DISCOUNT_PERCENT}% off applied!"
    }


async def validate_anniversary_code(user: dict, subtotal: float) -> dict:
    """Validate ANNIVERSARY code for a user"""
    user_id = user.get("user_id") or str(user.get("_id", ""))
    dom = user.get("date_of_marriage")
    
    # Check if user has anniversary set
    if not dom:
        return {"valid": False, "error": "Please update your anniversary date in your profile to use this code"}
    
    # Check if within anniversary period
    if not is_within_anniversary_period(dom):
        return {"valid": False, "error": "This code is only valid during your anniversary period (±7 days)"}
    
    # Check minimum order value
    if subtotal < MIN_ORDER_VALUE:
        return {"valid": False, "error": f"Minimum order value of ₹{MIN_ORDER_VALUE} required"}
    
    # Check if already used this year
    if not await can_user_use_anniversary_code(user_id):
        return {"valid": False, "error": "You have already used your anniversary code this year"}
    
    # Calculate discount
    discount_amount = min(subtotal * (ANNIVERSARY_DISCOUNT_PERCENT / 100), 750)  # Max ₹750
    
    return {
        "valid": True,
        "code": ANNIVERSARY_CODE,
        "discount_type": "percentage",
        "discount_percent": ANNIVERSARY_DISCOUNT_PERCENT,
        "discount_amount": round(discount_amount, 2),
        "max_discount": 750,
        "message": f"💕 Happy Anniversary! {ANNIVERSARY_DISCOUNT_PERCENT}% off applied!"
    }


# ==================== FESTIVAL CODES ====================

def get_current_festival_period() -> Optional[Dict]:
    """
    Get the current festival period if any.
    Returns the biggest festival if multiple festivals overlap.
    """
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_day = now.day
    
    matching_festivals = []
    
    for festival in INDIAN_FESTIVALS:
        month = festival["month"]
        day_start, day_end = festival["day_range"]
        
        # Check if current date falls within festival period
        if month == current_month and day_start <= current_day <= day_end:
            matching_festivals.append(festival)
        
        # Handle Diwali extending to November
        if festival.get("extends_to_nov") and current_month == 11:
            if current_day <= festival["extends_to_nov"]:
                matching_festivals.append(festival)
    
    if not matching_festivals:
        return None
    
    # Return the festival with highest priority (biggest festival)
    return max(matching_festivals, key=lambda x: x["priority"])


def get_upcoming_festivals(days_ahead: int = 30) -> List[Dict]:
    """Get festivals coming up in the next N days"""
    now = datetime.now(timezone.utc)
    upcoming = []
    
    for day_offset in range(days_ahead + 1):
        check_date = now + timedelta(days=day_offset)
        check_month = check_date.month
        check_day = check_date.day
        
        for festival in INDIAN_FESTIVALS:
            month = festival["month"]
            day_start, day_end = festival["day_range"]
            
            # Check if this date is the START of a festival
            if month == check_month and check_day == day_start:
                upcoming.append({
                    "name": festival["name"],
                    "start_date": check_date.strftime("%Y-%m-%d"),
                    "end_date": (check_date + timedelta(days=day_end - day_start)).strftime("%Y-%m-%d"),
                    "days_until": day_offset,
                    "priority": festival["priority"]
                })
    
    # Remove duplicates and sort by days_until
    seen = set()
    unique_upcoming = []
    for f in sorted(upcoming, key=lambda x: x["days_until"]):
        if f["name"] not in seen:
            seen.add(f["name"])
            unique_upcoming.append(f)
    
    return unique_upcoming[:10]  # Return max 10


def generate_festival_code(festival_name: str, year: int = None) -> str:
    """Generate a festival code name"""
    if year is None:
        year = datetime.now(timezone.utc).year
    
    # Clean festival name - remove spaces, convert to uppercase
    clean_name = festival_name.upper().replace(" ", "")
    return f"{clean_name}{year}"


async def ensure_festival_code_exists(festival_name: str, start_date: str, end_date: str) -> dict:
    """
    Ensure a festival discount code exists. Creates it if it doesn't.
    Returns the code info.
    """
    db = await get_db()
    now = datetime.now(timezone.utc)
    year = now.year
    
    code = generate_festival_code(festival_name, year)
    
    # Check if code already exists
    existing = await db.discount_codes.find_one({"code": code})
    
    if existing:
        return {
            "code": code,
            "discount_percent": FESTIVAL_DISCOUNT_PERCENT,
            "festival": festival_name,
            "start_date": start_date,
            "end_date": end_date,
            "already_existed": True
        }
    
    # Create new festival code
    try:
        end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # Valid until end of end_date
    except:
        end_datetime = now + timedelta(days=14)
    
    discount_code = {
        "code": code,
        "discount_type": "percentage",
        "discount_value": FESTIVAL_DISCOUNT_PERCENT,
        "min_order_value": MIN_ORDER_VALUE,
        "max_discount": None,  # No max for festival codes
        "max_uses": None,  # Unlimited uses
        "usage_type": "universal",  # Anyone can use
        "times_used": 0,
        "is_active": True,
        "expires_at": end_datetime.isoformat(),
        "description": f"Festival offer for {festival_name} {year}",
        "created_at": now.isoformat(),
        "gift_type": "festival",
        "festival_name": festival_name,
        "festival_year": year
    }
    
    await db.discount_codes.insert_one(discount_code)
    
    return {
        "code": code,
        "discount_percent": FESTIVAL_DISCOUNT_PERCENT,
        "festival": festival_name,
        "start_date": start_date,
        "end_date": end_date,
        "already_existed": False
    }


async def get_active_festival_codes() -> List[Dict]:
    """Get all currently active festival codes"""
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    cursor = db.discount_codes.find({
        "gift_type": "festival",
        "is_active": True,
        "$or": [
            {"expires_at": {"$gt": now.isoformat()}},
            {"expires_at": None}
        ]
    }).sort("created_at", -1)
    
    codes = []
    async for code in cursor:
        codes.append({
            "code": code.get("code"),
            "festival": code.get("festival_name"),
            "discount_percent": code.get("discount_value"),
            "expires_at": code.get("expires_at"),
            "times_used": code.get("times_used", 0),
            "is_active": code.get("is_active")
        })
    
    return codes


async def create_festival_codes_for_upcoming():
    """Auto-create festival codes for upcoming festivals"""
    upcoming = get_upcoming_festivals(days_ahead=7)  # Create codes 7 days ahead
    
    created = []
    for festival in upcoming:
        if festival["days_until"] <= 7:  # Only create for festivals within 7 days
            result = await ensure_festival_code_exists(
                festival["name"],
                festival["start_date"],
                festival["end_date"]
            )
            if not result["already_existed"]:
                created.append(result)
    
    return created


# ==================== BIRTHDAY/ANNIVERSARY WISH EMAILS ====================

async def get_users_with_upcoming_birthdays(days_ahead: int = 0) -> List[Dict]:
    """Get users whose birthday is today or within days_ahead days"""
    db = await get_db()
    today = datetime.now(timezone.utc)
    
    users = []
    cursor = db.users.find({
        "date_of_birth": {"$exists": True, "$nin": [None, ""]}
    })
    
    async for user in cursor:
        dob_str = user.get("date_of_birth")
        if not dob_str:
            continue
        
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d")
            
            for day_offset in range(days_ahead + 1):
                check_date = today + timedelta(days=day_offset)
                if dob.month == check_date.month and dob.day == check_date.day:
                    user["_id"] = str(user["_id"])
                    user["birthday_date"] = check_date.strftime("%Y-%m-%d")
                    user["days_until"] = day_offset
                    users.append(user)
                    break
        except (ValueError, TypeError):
            continue
    
    return users


async def get_users_with_upcoming_anniversaries(days_ahead: int = 0) -> List[Dict]:
    """Get users whose anniversary is today or within days_ahead days"""
    db = await get_db()
    today = datetime.now(timezone.utc)
    
    users = []
    cursor = db.users.find({
        "date_of_marriage": {"$exists": True, "$nin": [None, ""]}
    })
    
    async for user in cursor:
        dom_str = user.get("date_of_marriage")
        if not dom_str:
            continue
        
        try:
            dom = datetime.strptime(dom_str, "%Y-%m-%d")
            
            for day_offset in range(days_ahead + 1):
                check_date = today + timedelta(days=day_offset)
                if dom.month == check_date.month and dom.day == check_date.day:
                    user["_id"] = str(user["_id"])
                    user["anniversary_date"] = check_date.strftime("%Y-%m-%d")
                    user["days_until"] = day_offset
                    user["years_married"] = check_date.year - dom.year
                    users.append(user)
                    break
        except (ValueError, TypeError):
            continue
    
    return users


async def send_birthday_wish_emails():
    """Send birthday wish emails to users whose birthday is today"""
    from services.email_service import send_birthday_email
    
    users = await get_users_with_upcoming_birthdays(days_ahead=0)
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    sent = 0
    skipped = 0
    failed = 0
    
    for user in users:
        user_id = user.get("user_id") or str(user.get("_id", ""))
        email = user.get("email")
        
        # Check if already sent this year
        existing = await db.birthday_wishes_sent.find_one({
            "user_id": user_id,
            "year": now.year
        })
        
        if existing:
            skipped += 1
            continue
        
        try:
            success = await send_birthday_email(
                email=email,
                name=user.get("name", "Valued Customer"),
                salutation=user.get("salutation", ""),
                code=BIRTHDAY_CODE,
                discount_percent=BIRTHDAY_DISCOUNT_PERCENT,
                expires_at=(now + timedelta(days=CODE_VALIDITY_DAYS)).isoformat(),
                min_order_value=MIN_ORDER_VALUE
            )
            
            if success:
                await db.birthday_wishes_sent.insert_one({
                    "user_id": user_id,
                    "email": email,
                    "year": now.year,
                    "sent_at": now
                })
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Error sending birthday email to {email}: {str(e)}")
            failed += 1
    
    return {"sent": sent, "skipped": skipped, "failed": failed, "total_users": len(users)}


async def send_anniversary_wish_emails():
    """Send anniversary wish emails to users whose anniversary is today"""
    from services.email_service import send_anniversary_email
    
    users = await get_users_with_upcoming_anniversaries(days_ahead=0)
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    sent = 0
    skipped = 0
    failed = 0
    
    for user in users:
        user_id = user.get("user_id") or str(user.get("_id", ""))
        email = user.get("email")
        
        # Check if already sent this year
        existing = await db.anniversary_wishes_sent.find_one({
            "user_id": user_id,
            "year": now.year
        })
        
        if existing:
            skipped += 1
            continue
        
        try:
            success = await send_anniversary_email(
                email=email,
                name=user.get("name", "Valued Customer"),
                salutation=user.get("salutation", ""),
                code=ANNIVERSARY_CODE,
                discount_percent=ANNIVERSARY_DISCOUNT_PERCENT,
                expires_at=(now + timedelta(days=CODE_VALIDITY_DAYS)).isoformat(),
                min_order_value=MIN_ORDER_VALUE,
                years_married=user.get("years_married", 0)
            )
            
            if success:
                await db.anniversary_wishes_sent.insert_one({
                    "user_id": user_id,
                    "email": email,
                    "year": now.year,
                    "sent_at": now
                })
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Error sending anniversary email to {email}: {str(e)}")
            failed += 1
    
    return {"sent": sent, "skipped": skipped, "failed": failed, "total_users": len(users)}


# ==================== STATS ====================

async def get_gift_code_stats() -> Dict:
    """Get statistics about gift codes"""
    db = await get_db()
    now = datetime.now(timezone.utc)
    year = now.year
    
    # Birthday wishes sent this year
    birthday_wishes_sent = await db.birthday_wishes_sent.count_documents({"year": year})
    
    # Anniversary wishes sent this year
    anniversary_wishes_sent = await db.anniversary_wishes_sent.count_documents({"year": year})
    
    # Birthday code usages this year
    birthday_code_usages = await db.gift_code_usage.count_documents({
        "code_type": "birthday",
        "year": year
    })
    
    # Anniversary code usages this year
    anniversary_code_usages = await db.gift_code_usage.count_documents({
        "code_type": "anniversary",
        "year": year
    })
    
    # Upcoming birthdays
    upcoming_birthdays = await get_users_with_upcoming_birthdays(days_ahead=7)
    
    # Upcoming anniversaries
    upcoming_anniversaries = await get_users_with_upcoming_anniversaries(days_ahead=7)
    
    # Users with DOB/DOM set
    users_with_dob = await db.users.count_documents({
        "date_of_birth": {"$exists": True, "$nin": [None, ""]}
    })
    
    users_with_dom = await db.users.count_documents({
        "date_of_marriage": {"$exists": True, "$nin": [None, ""]}
    })
    
    # Active festival codes
    active_festival_codes = await get_active_festival_codes()
    
    # Current festival period
    current_festival = get_current_festival_period()
    
    # Upcoming festivals
    upcoming_festivals = get_upcoming_festivals(days_ahead=30)
    
    return {
        "birthday_code": BIRTHDAY_CODE,
        "anniversary_code": ANNIVERSARY_CODE,
        "birthday_discount": BIRTHDAY_DISCOUNT_PERCENT,
        "anniversary_discount": ANNIVERSARY_DISCOUNT_PERCENT,
        "festival_discount": FESTIVAL_DISCOUNT_PERCENT,
        "code_validity_days": CODE_VALIDITY_DAYS,
        "birthday_wishes_sent_this_year": birthday_wishes_sent,
        "anniversary_wishes_sent_this_year": anniversary_wishes_sent,
        "birthday_code_usages_this_year": birthday_code_usages,
        "anniversary_code_usages_this_year": anniversary_code_usages,
        "upcoming_birthdays_7d": len(upcoming_birthdays),
        "upcoming_anniversaries_7d": len(upcoming_anniversaries),
        "users_with_dob": users_with_dob,
        "users_with_anniversary": users_with_dom,
        "upcoming_birthdays": [
            {
                "name": u.get("name"),
                "email": u.get("email"),
                "date": u.get("birthday_date"),
                "days_until": u.get("days_until")
            } for u in upcoming_birthdays[:10]
        ],
        "upcoming_anniversaries": [
            {
                "name": u.get("name"),
                "email": u.get("email"),
                "date": u.get("anniversary_date"),
                "days_until": u.get("days_until"),
                "years": u.get("years_married")
            } for u in upcoming_anniversaries[:10]
        ],
        "current_festival": current_festival,
        "upcoming_festivals": upcoming_festivals,
        "active_festival_codes": active_festival_codes
    }


# ==================== SCHEDULER ====================

async def gift_code_scheduler_loop():
    """
    Background loop that:
    1. Sends birthday/anniversary wishes daily at 9 AM IST
    2. Creates festival codes for upcoming festivals
    """
    while True:
        try:
            now = datetime.now(timezone.utc)
            
            # Run at 3:30 AM UTC (9 AM IST)
            if now.hour == 3 and 25 <= now.minute <= 35:
                logger.info("Running daily gift code processor...")
                
                # Send birthday wishes
                birthday_result = await send_birthday_wish_emails()
                logger.info(f"Birthday wishes: {birthday_result}")
                
                # Send anniversary wishes
                anniversary_result = await send_anniversary_wish_emails()
                logger.info(f"Anniversary wishes: {anniversary_result}")
                
                # Create festival codes for upcoming festivals
                festival_codes = await create_festival_codes_for_upcoming()
                if festival_codes:
                    logger.info(f"Created {len(festival_codes)} new festival codes")
                
                # Wait 1 hour to avoid re-running
                await asyncio.sleep(3600)
            else:
                # Check every 10 minutes
                await asyncio.sleep(600)
                
        except Exception as e:
            logger.error(f"Gift code scheduler error: {str(e)}")
            await asyncio.sleep(600)
