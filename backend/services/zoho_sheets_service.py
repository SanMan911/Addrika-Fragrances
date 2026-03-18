"""
Zoho Sheets Integration Service
Auto-syncs delivered orders to Zoho Sheets spreadsheet
"""
import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Zoho Configuration
ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
ZOHO_SHEET_ID = os.environ.get("ZOHO_SHEET_ID", "")
ZOHO_REDIRECT_URI = os.environ.get("ZOHO_REDIRECT_URI", "")

# Zoho India endpoints
ZOHO_AUTH_URL = "https://accounts.zoho.in/oauth/v2/auth"
ZOHO_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token"
ZOHO_SHEET_API_URL = "https://sheet.zoho.in/api/v2"

# Database connection for persistent token storage
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

# In-memory cache (loaded from DB on startup)
_token_cache = {
    "access_token": None,
    "refresh_token": None,
    "expires_at": None
}


async def _get_db():
    """Get database connection."""
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


async def _load_tokens_from_db():
    """Load tokens from database into memory cache."""
    global _token_cache
    try:
        db = await _get_db()
        token_doc = await db.zoho_tokens.find_one({"_id": "zoho_auth"})
        if token_doc:
            _token_cache["access_token"] = token_doc.get("access_token")
            _token_cache["refresh_token"] = token_doc.get("refresh_token")
            expires_at = token_doc.get("expires_at")
            if expires_at:
                _token_cache["expires_at"] = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
            logger.info("Loaded Zoho tokens from database")
    except Exception as e:
        logger.error(f"Failed to load tokens from DB: {e}")


async def _save_tokens_to_db():
    """Save tokens from memory cache to database."""
    try:
        db = await _get_db()
        token_doc = {
            "_id": "zoho_auth",
            "access_token": _token_cache.get("access_token"),
            "refresh_token": _token_cache.get("refresh_token"),
            "expires_at": _token_cache.get("expires_at").isoformat() if _token_cache.get("expires_at") else None,
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.zoho_tokens.replace_one({"_id": "zoho_auth"}, token_doc, upsert=True)
        logger.info("Saved Zoho tokens to database")
    except Exception as e:
        logger.error(f"Failed to save tokens to DB: {e}")


def get_authorization_url() -> str:
    """Generate the OAuth2 authorization URL for Zoho."""
    params = {
        "client_id": ZOHO_CLIENT_ID,
        "response_type": "code",
        "scope": "ZohoSheet.dataAPI.READ,ZohoSheet.dataAPI.UPDATE",
        "redirect_uri": ZOHO_REDIRECT_URI,
        "access_type": "offline",
        "prompt": "consent"
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{ZOHO_AUTH_URL}?{query_string}"


async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens."""
    global _token_cache
    
    data = {
        "grant_type": "authorization_code",
        "client_id": ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "redirect_uri": ZOHO_REDIRECT_URI,
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(ZOHO_TOKEN_URL, data=data)
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.text}")
            raise Exception(f"Token exchange failed: {response.text}")
        
        token_data = response.json()
        
        # Store tokens in memory cache
        _token_cache["access_token"] = token_data.get("access_token")
        _token_cache["refresh_token"] = token_data.get("refresh_token")
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        
        # Persist to database
        await _save_tokens_to_db()
        
        logger.info("Successfully obtained Zoho tokens")
        return token_data


async def refresh_access_token() -> str:
    """Refresh the access token using the refresh token."""
    global _token_cache
    
    # Try to load from DB if not in memory
    if not _token_cache.get("refresh_token"):
        await _load_tokens_from_db()
    
    if not _token_cache.get("refresh_token"):
        raise Exception("No refresh token available. Please re-authorize.")
    
    data = {
        "grant_type": "refresh_token",
        "client_id": ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "refresh_token": _token_cache["refresh_token"]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(ZOHO_TOKEN_URL, data=data)
        
        if response.status_code != 200:
            logger.error(f"Token refresh failed: {response.text}")
            raise Exception(f"Token refresh failed: {response.text}")
        
        token_data = response.json()
        
        _token_cache["access_token"] = token_data.get("access_token")
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        
        # Update refresh token if provided
        if "refresh_token" in token_data:
            _token_cache["refresh_token"] = token_data["refresh_token"]
        
        # Persist to database
        await _save_tokens_to_db()
        
        logger.info("Successfully refreshed Zoho access token")
        return _token_cache["access_token"]


async def get_valid_access_token() -> str:
    """Get a valid access token, refreshing if necessary."""
    global _token_cache
    
    # Try to load from DB if not in memory
    if not _token_cache.get("access_token"):
        await _load_tokens_from_db()
    
    if not _token_cache.get("access_token"):
        raise Exception("Not authorized. Please authorize with Zoho first.")
    
    # Check if token needs refresh (5 minutes before expiry)
    if _token_cache.get("expires_at"):
        time_until_expiry = (_token_cache["expires_at"] - datetime.utcnow()).total_seconds()
        if time_until_expiry < 300:  # 5 minutes
            await refresh_access_token()
    
    return _token_cache["access_token"]


async def add_order_to_sheet(order_data: Dict[str, Any], worksheet_name: str = "Sheet1") -> Dict[str, Any]:
    """
    Add an order row to the Zoho Sheet.
    
    Columns (exact headers from user's sheet):
    Date, GST number (if any), Order number, Customer name, Phone number, 
    State of Shipping, Item Name Orderd, Weight, Number of Pieces, Sub Total,
    Discount Code Applied, Discount Received, Tax, Total, Payment Mode, Status
    """
    try:
        access_token = await get_valid_access_token()
    except Exception as e:
        logger.warning(f"Zoho not authorized: {e}")
        return {"status": "skipped", "reason": str(e)}
    
    # Prepare row data - column names must EXACTLY match headers in Zoho Sheet
    row_data = {
        "DATE": str(order_data.get("date", datetime.utcnow().strftime("%Y-%m-%d"))),
        "GST Number (if any)": str(order_data.get("gst_number", "")),
        "Order Number": str(order_data.get("order_number", "")),
        "Customer Name": str(order_data.get("customer_name", "")),
        "Phone Number": str(order_data.get("phone_number", "")),
        "State of Shipping": str(order_data.get("state", "")),
        "Item Name Ordered": str(order_data.get("items_summary", "")),
        "Weight": str(order_data.get("weight", "")),
        "Number of Pieces": str(order_data.get("quantity", 0)),
        "Subtotal": str(order_data.get("subtotal", 0)),
        "Discount Code Applied": str(order_data.get("discount_code", "")),
        "Discount Received": str(order_data.get("discount_amount", 0)),
        "Tax": str(order_data.get("tax", 0)),
        "Total": str(order_data.get("total", 0)),
        "Payment Mode": str(order_data.get("payment_mode", "")),
        "Status": str(order_data.get("status", "Delivered"))
    }
    
    # Zoho Sheet API v2 endpoint - use the base resource endpoint
    # POST https://sheet.zoho.in/api/v2/{resource_id}
    api_url = f"{ZOHO_SHEET_API_URL}/{ZOHO_SHEET_ID}"
    
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    # Form-encoded payload for Zoho Sheet API
    # json_data must be an array of row objects
    import json
    payload = {
        "method": "worksheet.records.add",
        "worksheet_name": worksheet_name,
        "header_row": "1",
        "json_data": json.dumps([row_data])  # Array of records
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                api_url,
                data=payload,  # Use data= for form encoding
                headers=headers,
                timeout=30.0
            )
            
            logger.info(f"Zoho API URL: {api_url}")
            logger.info(f"Zoho API payload: {payload}")
            logger.info(f"Zoho API response: {response.status_code} - {response.text[:500]}")
            
            if response.status_code == 401:
                # Token expired, try to refresh and retry
                await refresh_access_token()
                headers["Authorization"] = f"Zoho-oauthtoken {_token_cache['access_token']}"
                response = await client.post(api_url, data=payload, headers=headers, timeout=30.0)
            
            result = response.json()
            
            if response.status_code == 200 or response.status_code == 201:
                logger.info(f"Successfully added order {order_data.get('order_number')} to Zoho Sheet")
                return {"status": "success", "data": result}
            else:
                logger.error(f"Failed to add row: {response.status_code} - {response.text}")
                return {"status": "error", "error": response.text, "code": response.status_code}
                
        except httpx.RequestError as e:
            logger.error(f"Request to Zoho failed: {e}")
            return {"status": "error", "error": str(e)}


async def sync_delivered_order(order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sync a delivered order to Zoho Sheets.
    Called when an order status is changed to 'delivered'.
    """
    # Extract order details
    shipping = order.get("shipping", {})
    pricing = order.get("pricing", {})
    items = order.get("items", [])
    
    # Build items summary
    items_summary = ", ".join([
        f"{item.get('name', '')} ({item.get('size', '')})" 
        for item in items
    ])
    
    # Calculate total weight and quantity
    total_quantity = sum(item.get("quantity", 1) for item in items)
    weight_summary = ", ".join([
        f"{item.get('size', '')}" 
        for item in items
    ])
    
    # Parse date
    created_at = order.get("created_at") or order.get("createdAt")
    if isinstance(created_at, str):
        try:
            date_str = datetime.fromisoformat(created_at.replace("Z", "+00:00")).strftime("%Y-%m-%d")
        except:
            date_str = datetime.utcnow().strftime("%Y-%m-%d")
    else:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get discount info
    discount = pricing.get("discount", {})
    discount_code = discount.get("code", "") if isinstance(discount, dict) else ""
    discount_amount = discount.get("amount", 0) if isinstance(discount, dict) else pricing.get("discount", 0)
    
    order_data = {
        "date": date_str,
        "gst_number": order.get("gst_number", ""),
        "order_number": order.get("order_number", ""),
        "customer_name": shipping.get("name", ""),
        "phone_number": shipping.get("phone", ""),
        "state": shipping.get("state", ""),
        "items_summary": items_summary,
        "weight": weight_summary,
        "quantity": total_quantity,
        "subtotal": pricing.get("subtotal", 0),
        "discount_code": discount_code,
        "discount_amount": discount_amount,
        "tax": pricing.get("tax", 0),
        "total": pricing.get("final_total", 0),
        "payment_mode": order.get("payment_mode", order.get("paymentMode", "Online")),
        "status": "Delivered"
    }
    
    return await add_order_to_sheet(order_data)


def is_zoho_configured() -> bool:
    """Check if Zoho credentials are configured."""
    return bool(ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET and ZOHO_SHEET_ID)


async def is_zoho_authorized() -> bool:
    """Check if Zoho is authorized (has access token)."""
    global _token_cache
    if not _token_cache.get("access_token"):
        await _load_tokens_from_db()
    return bool(_token_cache.get("access_token"))


async def get_zoho_status() -> Dict[str, Any]:
    """Get current Zoho integration status."""
    global _token_cache
    if not _token_cache.get("access_token"):
        await _load_tokens_from_db()
    return {
        "configured": is_zoho_configured(),
        "authorized": bool(_token_cache.get("access_token")),
        "sheet_id": ZOHO_SHEET_ID[:10] + "..." if ZOHO_SHEET_ID else None,
        "token_expires_at": _token_cache.get("expires_at").isoformat() if _token_cache.get("expires_at") else None
    }
