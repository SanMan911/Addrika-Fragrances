"""
Zoho Integration Router
Handles OAuth callbacks and integration status
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Optional
import logging

from services.zoho_sheets_service import (
    get_authorization_url,
    exchange_code_for_tokens,
    get_zoho_status,
    is_zoho_configured,
    is_zoho_authorized
)

router = APIRouter(prefix="/zoho", tags=["Zoho Integration"])
logger = logging.getLogger(__name__)


@router.get("/authorize")
async def authorize_zoho():
    """
    Start OAuth2 authorization flow with Zoho.
    Redirects to Zoho's consent screen.
    """
    if not is_zoho_configured():
        raise HTTPException(status_code=400, detail="Zoho credentials not configured")
    
    auth_url = get_authorization_url()
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def zoho_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    location: Optional[str] = Query(None)
):
    """
    Handle OAuth2 callback from Zoho.
    Exchange authorization code for tokens.
    """
    if error:
        logger.error(f"Zoho authorization error: {error}")
        return HTMLResponse(content=f"""
            <html>
            <head><title>Authorization Failed</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authorization Failed</h1>
                <p>Error: {error}</p>
                <p>Please try again or contact support.</p>
                <a href="/admin" style="color: #2563eb;">Return to Admin Panel</a>
            </body>
            </html>
        """, status_code=400)
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not provided")
    
    try:
        token_data = await exchange_code_for_tokens(code)
        
        return HTMLResponse(content=f"""
            <html>
            <head><title>Authorization Successful</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #16a34a;">✓ Zoho Authorization Successful!</h1>
                <p>Your Zoho Sheets integration is now active.</p>
                <p>Delivered orders will automatically sync to your spreadsheet.</p>
                <br>
                <a href="/admin" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    Return to Admin Panel
                </a>
            </body>
            </html>
        """)
        
    except Exception as e:
        logger.error(f"Token exchange failed: {e}")
        return HTMLResponse(content=f"""
            <html>
            <head><title>Authorization Failed</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authorization Failed</h1>
                <p>Error: {str(e)}</p>
                <p>Please try again.</p>
                <a href="/admin" style="color: #2563eb;">Return to Admin Panel</a>
            </body>
            </html>
        """, status_code=500)


@router.get("/status")
async def zoho_status():
    """
    Get current Zoho integration status.
    """
    return await get_zoho_status()


@router.post("/test-sync")
async def test_zoho_sync():
    """
    Test the Zoho sync with a sample order (for debugging).
    """
    from services.zoho_sheets_service import add_order_to_sheet
    
    if not await is_zoho_authorized():
        raise HTTPException(status_code=401, detail="Zoho not authorized. Please authorize first.")
    
    # Test order data matching the exact column headers
    test_order = {
        "date": "2026-02-12",
        "gst_number": "",
        "order_number": "TEST-ZOHO-001",
        "customer_name": "Test Customer",
        "phone_number": "+91 98765 43210",
        "state": "Delhi",
        "items_summary": "Kesar Chandan (50g), Rose Premium (100g)",
        "weight": "50g, 100g",
        "quantity": 3,
        "subtotal": 347,
        "discount_code": "WELCOME10",
        "discount_amount": 34.70,
        "tax": 62.46,
        "total": 374.76,
        "payment_mode": "Online",
        "status": "Delivered"
    }
    
    # Use the actual worksheet name
    result = await add_order_to_sheet(test_order, worksheet_name="Sheet1")
    return result
