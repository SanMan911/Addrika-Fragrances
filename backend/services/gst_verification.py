"""
GST Verification Service
Verifies GST numbers against official GSTN database
"""
import httpx
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# GST Verification API (GSTINCheck.co.in - free tier)
GST_API_BASE = "https://sheet.gstincheck.co.in/check"
GST_API_KEY = os.environ.get("GST_VERIFICATION_API_KEY", "")


async def verify_gst_number(gst_number: str) -> dict:
    """
    Verify GST number and fetch taxpayer details from GSTN database.
    
    Returns:
        dict with keys:
        - verified: bool
        - matched: bool (if business name matches)
        - taxpayer_name: str (legal name from GSTN)
        - trade_name: str
        - status: str (Active/Inactive/Cancelled)
        - registration_date: str
        - state: str
        - address: str
        - error: str (if any)
    """
    if not gst_number or len(gst_number) != 15:
        return {
            "verified": False,
            "error": "Invalid GST number format"
        }
    
    gst_number = gst_number.upper().strip()
    
    # If no API key, return unverified
    if not GST_API_KEY:
        logger.warning("GST_VERIFICATION_API_KEY not set - skipping verification")
        return {
            "verified": False,
            "error": "GST verification API not configured",
            "manual_verification_required": True
        }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{GST_API_BASE}/{GST_API_KEY}/{gst_number}"
            response = await client.get(url)
            
            if response.status_code != 200:
                logger.error(f"GST API error: {response.status_code}")
                return {
                    "verified": False,
                    "error": f"API error: {response.status_code}"
                }
            
            data = response.json()
            
            # Check if GST found
            if not data.get("flag"):
                return {
                    "verified": False,
                    "error": data.get("message", "GST number not found")
                }
            
            # Extract taxpayer details
            taxpayer = data.get("data", {})
            
            result = {
                "verified": True,
                "gst_number": gst_number,
                "taxpayer_name": taxpayer.get("lgnm", ""),  # Legal name
                "trade_name": taxpayer.get("tradeNam", ""),  # Trade name
                "status": taxpayer.get("sts", ""),  # Status (Active/Inactive)
                "registration_date": taxpayer.get("rgdt", ""),
                "state": taxpayer.get("stj", ""),
                "state_code": gst_number[:2],
                "taxpayer_type": taxpayer.get("dty", ""),  # Dealer type
                "constitution": taxpayer.get("ctb", ""),  # Constitution of business
                "last_updated": taxpayer.get("lstupdt", ""),
                "address": "",
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Build address from components
            addr = taxpayer.get("pradr", {}).get("addr", {})
            if addr:
                addr_parts = [
                    addr.get("bno", ""),
                    addr.get("flno", ""),
                    addr.get("bnm", ""),
                    addr.get("st", ""),
                    addr.get("loc", ""),
                    addr.get("city", ""),
                    addr.get("dst", ""),
                    addr.get("stcd", ""),
                    addr.get("pncd", "")
                ]
                result["address"] = ", ".join(p for p in addr_parts if p)
            
            # Check if status is Active
            result["is_active"] = result["status"].lower() == "active"
            
            return result
            
    except httpx.TimeoutException:
        logger.error("GST API timeout")
        return {
            "verified": False,
            "error": "Verification service timeout"
        }
    except Exception as e:
        logger.error(f"GST verification error: {str(e)}")
        return {
            "verified": False,
            "error": str(e)
        }


def normalize_business_name(name: str) -> str:
    """Normalize business name for comparison"""
    if not name:
        return ""
    # Remove common suffixes and normalize
    name = name.upper().strip()
    # Remove common business suffixes
    for suffix in [" PVT LTD", " PRIVATE LIMITED", " LTD", " LIMITED", " LLP", " LLC"]:
        name = name.replace(suffix, "")
    # Remove special characters and extra spaces
    name = ''.join(c for c in name if c.isalnum() or c.isspace())
    name = ' '.join(name.split())
    return name


def match_business_names(provided_name: str, gstn_name: str, gstn_trade_name: str = "") -> dict:
    """
    Compare provided business name with GSTN records.
    
    Returns:
        dict with match_score (0-100) and matched (bool)
    """
    provided_normalized = normalize_business_name(provided_name)
    legal_normalized = normalize_business_name(gstn_name)
    trade_normalized = normalize_business_name(gstn_trade_name)
    
    if not provided_normalized:
        return {"matched": False, "match_score": 0, "reason": "No business name provided"}
    
    # Exact match with legal name
    if provided_normalized == legal_normalized:
        return {"matched": True, "match_score": 100, "matched_with": "legal_name"}
    
    # Exact match with trade name
    if trade_normalized and provided_normalized == trade_normalized:
        return {"matched": True, "match_score": 100, "matched_with": "trade_name"}
    
    # Partial match - check if one contains the other
    if provided_normalized in legal_normalized or legal_normalized in provided_normalized:
        return {"matched": True, "match_score": 80, "matched_with": "legal_name_partial"}
    
    if trade_normalized:
        if provided_normalized in trade_normalized or trade_normalized in provided_normalized:
            return {"matched": True, "match_score": 80, "matched_with": "trade_name_partial"}
    
    # Calculate word overlap
    provided_words = set(provided_normalized.split())
    legal_words = set(legal_normalized.split())
    
    if provided_words and legal_words:
        overlap = len(provided_words & legal_words)
        total = max(len(provided_words), len(legal_words))
        score = int((overlap / total) * 100)
        
        if score >= 60:
            return {"matched": True, "match_score": score, "matched_with": "word_overlap"}
    
    return {
        "matched": False, 
        "match_score": 0, 
        "reason": "Business name does not match GSTN records",
        "gstn_legal_name": gstn_name,
        "gstn_trade_name": gstn_trade_name
    }


async def verify_and_match_gst(gst_number: str, provided_business_name: str) -> dict:
    """
    Complete GST verification: verify number and match business name.
    
    Returns comprehensive verification result.
    """
    # First verify the GST number
    verification = await verify_gst_number(gst_number)
    
    if not verification.get("verified"):
        return verification
    
    # Then match business names
    match_result = match_business_names(
        provided_business_name,
        verification.get("taxpayer_name", ""),
        verification.get("trade_name", "")
    )
    
    return {
        **verification,
        "name_match": match_result,
        "fully_verified": verification.get("is_active", False) and match_result.get("matched", False)
    }
