"""
Common utilities for backend operations.
Centralized helper functions to reduce code duplication.
"""
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from fastapi import HTTPException, status
import uuid
import re
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Date/Time Utilities
# ============================================================================

def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """Get current UTC datetime as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse ISO date string to datetime, returns None on failure."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None


# ============================================================================
# ID Generation
# ============================================================================

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix."""
    uid = str(uuid.uuid4())
    return f"{prefix}{uid}" if prefix else uid


def generate_short_id(prefix: str = "", length: int = 8) -> str:
    """Generate a short unique ID."""
    uid = str(uuid.uuid4())[:length].upper()
    return f"{prefix}-{uid}" if prefix else uid


def generate_order_id() -> str:
    """Generate order ID in format: ORD-YYYYMMDD-XXXX"""
    now = utc_now()
    date_part = now.strftime('%Y%m%d')
    random_part = str(uuid.uuid4())[:4].upper()
    return f"ORD-{date_part}-{random_part}"


def generate_ticket_id(prefix: str = "TKT") -> str:
    """Generate ticket ID."""
    return f"{prefix}-{str(uuid.uuid4())[:8].upper()}"


# ============================================================================
# HTTP Exceptions (Pre-built common errors)
# ============================================================================

def not_authenticated() -> HTTPException:
    """Return 401 Unauthorized exception."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated"
    )


def not_found(resource: str = "Resource") -> HTTPException:
    """Return 404 Not Found exception."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource} not found"
    )


def bad_request(detail: str = "Bad request") -> HTTPException:
    """Return 400 Bad Request exception."""
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail
    )


def forbidden(detail: str = "Forbidden") -> HTTPException:
    """Return 403 Forbidden exception."""
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail
    )


def conflict(detail: str = "Conflict") -> HTTPException:
    """Return 409 Conflict exception."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail
    )


# ============================================================================
# Data Transformation
# ============================================================================

def sanitize_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove MongoDB _id field and convert ObjectIds to strings.
    Safe to call even if doc is None.
    """
    if not doc:
        return {}
    
    result = dict(doc)
    
    # Remove _id
    result.pop('_id', None)
    
    # Convert any ObjectId fields to string
    for key, value in result.items():
        if hasattr(value, '__str__') and 'ObjectId' in str(type(value)):
            result[key] = str(value)
    
    return result


def sanitize_mongo_list(docs: list) -> list:
    """Sanitize a list of MongoDB documents."""
    return [sanitize_mongo_doc(doc) for doc in docs]


# ============================================================================
# String Utilities
# ============================================================================

def capitalize_words(text: str) -> str:
    """Capitalize first letter of each word (Title Case)."""
    if not text:
        return ''
    return ' '.join(word.capitalize() for word in text.split())


def sanitize_phone(phone: str) -> str:
    """Clean phone number - keep only digits."""
    if not phone:
        return ''
    return re.sub(r'\D', '', phone)


def format_indian_phone(phone: str) -> str:
    """Format phone number for Indian format (+91 XXXXX XXXXX)."""
    digits = sanitize_phone(phone)
    if len(digits) == 10:
        return f"+91 {digits[:5]} {digits[5:]}"
    elif len(digits) == 12 and digits.startswith('91'):
        return f"+{digits[:2]} {digits[2:7]} {digits[7:]}"
    return phone


def mask_email(email: str) -> str:
    """Mask email for display (j***@example.com)."""
    if not email or '@' not in email:
        return email
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def mask_phone(phone: str) -> str:
    """Mask phone number for display (******1234)."""
    digits = sanitize_phone(phone)
    if len(digits) >= 4:
        return f"******{digits[-4:]}"
    return phone


# ============================================================================
# Validation Utilities
# ============================================================================

def is_valid_email(email: str) -> bool:
    """Basic email validation."""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def is_valid_indian_phone(phone: str) -> bool:
    """Validate Indian phone number (10 digits, starts with 6-9)."""
    digits = sanitize_phone(phone)
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    return len(digits) == 10 and digits[0] in '6789'


def is_valid_pincode(pincode: str) -> bool:
    """Validate Indian pincode (6 digits)."""
    if not pincode:
        return False
    return bool(re.match(r'^\d{6}$', pincode))


def is_valid_gst(gst: str) -> bool:
    """Basic GST number validation (15 alphanumeric)."""
    if not gst:
        return False
    return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gst.upper()))


# ============================================================================
# Price/Amount Utilities
# ============================================================================

def format_currency(amount: float, symbol: str = "₹") -> str:
    """Format amount as currency with Indian formatting."""
    if amount >= 10000000:  # 1 Crore
        return f"{symbol}{amount/10000000:.2f} Cr"
    elif amount >= 100000:  # 1 Lakh
        return f"{symbol}{amount/100000:.2f} L"
    elif amount >= 1000:
        return f"{symbol}{amount:,.2f}"
    return f"{symbol}{amount:.2f}"


def calculate_percentage(part: float, whole: float) -> float:
    """Calculate percentage safely."""
    if not whole:
        return 0.0
    return round((part / whole) * 100, 2)


def round_to_nearest(value: float, nearest: int = 1) -> int:
    """Round value to nearest integer."""
    return int(round(value / nearest) * nearest)


# ============================================================================
# Pagination Utilities
# ============================================================================

def get_pagination_info(page: int, limit: int, total: int) -> Dict[str, Any]:
    """Generate standard pagination response."""
    total_pages = (total + limit - 1) // limit if total > 0 else 0
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


def get_skip_limit(page: int = 1, limit: int = 20, max_limit: int = 100) -> tuple:
    """Calculate skip and limit for MongoDB queries."""
    page = max(1, page)
    limit = min(max(1, limit), max_limit)
    skip = (page - 1) * limit
    return skip, limit
