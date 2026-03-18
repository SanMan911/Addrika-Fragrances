"""
Store Pickup OTP Router
Handles OTP generation and verification for store pickup orders
Supports MasterPassword override for admin verification
"""
from fastapi import APIRouter, HTTPException, Request, Cookie, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import logging
import random
import string
import os

from dependencies import db, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/store-pickup", tags=["Store Pickup"])

# Admin MasterPassword for override verification
ADMIN_MASTER_PASSWORD = os.environ.get("ADMIN_MASTER_PASSWORD", "AddrikaAdmin@2026")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com")


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return ''.join(random.choices(string.digits, k=length))


class OTPVerifyRequest(BaseModel):
    """Request to verify OTP at pickup"""
    order_number: str
    otp_code: str
    retailer_id: str
    use_master_password: Optional[bool] = False  # Flag to indicate master password use


# ===================== Customer Endpoints =====================

@router.get("/otp/{order_number}")
async def get_pickup_otp(
    order_number: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Get OTP for a store pickup order.
    Customer calls this to retrieve their OTP after payment.
    """
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find the order
    order = await db.orders.find_one(
        {
            "order_number": order_number,
            "user_id": user['user_id']
        },
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if it's a store pickup order
    if order.get('delivery_mode') != 'self_pickup':
        raise HTTPException(status_code=400, detail="This is not a store pickup order")
    
    # Get OTP record
    otp_record = await db.store_pickup_otps.find_one(
        {"order_number": order_number},
        {"_id": 0}
    )
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="OTP not found for this order")
    
    return {
        "order_number": order_number,
        "otp_code": otp_record.get('otp_code'),
        "status": otp_record.get('status'),
        "expires_at": otp_record.get('expires_at'),
        "retailer_name": otp_record.get('retailer_name'),
        "balance_amount": otp_record.get('balance_amount', 0)
    }


# ===================== Retailer Endpoints =====================

@router.post("/verify-otp")
async def verify_pickup_otp(
    otp_data: OTPVerifyRequest,
    request: Request,
    background_tasks: BackgroundTasks = None,
    session_token: Optional[str] = Cookie(None)
):
    """
    Retailer verifies OTP when customer picks up order.
    Called by retailer dashboard or admin.
    
    Supports two verification methods:
    1. Customer OTP (primary - secure)
    2. Admin MasterPassword (fallback - for edge cases like customer forgot phone)
    """
    # Find the OTP record
    otp_record = await db.store_pickup_otps.find_one(
        {"order_number": otp_data.order_number},
        {"_id": 0}
    )
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="Order OTP not found")
    
    # Check if already verified
    if otp_record.get('status') == 'verified':
        return {
            "success": False,
            "message": "This order has already been picked up",
            "verified_at": otp_record.get('verified_at')
        }
    
    # Check if using MasterPassword (admin override)
    is_master_password_used = otp_data.use_master_password and otp_data.otp_code == ADMIN_MASTER_PASSWORD
    
    if not is_master_password_used:
        # Normal OTP verification
        # Check if expired
        expires_at = otp_record.get('expires_at')
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at < datetime.now(timezone.utc):
                return {
                    "success": False,
                    "message": "OTP has expired. Please contact customer support or use admin verification."
                }
        
        # Verify OTP
        if otp_record.get('otp_code') != otp_data.otp_code:
            return {
                "success": False,
                "message": "Invalid OTP. Please check and try again, or use admin verification."
            }
    
    # Verify retailer matches (required for both OTP and MasterPassword)
    if otp_record.get('retailer_id') != otp_data.retailer_id:
        return {
            "success": False,
            "message": "This order is assigned to a different store."
        }
    
    now = datetime.now(timezone.utc)
    verification_method = "master_password" if is_master_password_used else "customer_otp"
    
    # Mark OTP as verified
    await db.store_pickup_otps.update_one(
        {"order_number": otp_data.order_number},
        {
            "$set": {
                "status": "verified",
                "verified_at": now.isoformat(),
                "verified_by_retailer_id": otp_data.retailer_id,
                "verification_method": verification_method
            }
        }
    )
    
    # Update order status to delivered
    await db.orders.update_one(
        {"order_number": otp_data.order_number},
        {
            "$set": {
                "order_status": "delivered",
                "delivered_at": now.isoformat(),
                "pickup_verified_at": now.isoformat(),
                "pickup_verified_by": otp_data.retailer_id,
                "pickup_verification_method": verification_method
            }
        }
    )
    
    # Update retailer stats
    await db.retailers.update_one(
        {"retailer_id": otp_data.retailer_id},
        {"$inc": {"total_pickups_completed": 1}}
    )
    
    logger.info(f"Order {otp_data.order_number} picked up. Verified via {verification_method} by retailer {otp_data.retailer_id}")
    
    # Send admin notification about successful pickup (for verification)
    try:
        # Get order and customer details
        order = await db.orders.find_one(
            {"order_number": otp_data.order_number},
            {"_id": 0}
        )
        
        retailer = await db.retailers.find_one(
            {"retailer_id": otp_data.retailer_id},
            {"_id": 0, "business_name": 1, "trade_name": 1, "city": 1, "phone": 1}
        )
        
        if order and background_tasks:
            background_tasks.add_task(
                send_admin_pickup_completion_email,
                order,
                retailer or {},
                otp_record,
                verification_method
            )
    except Exception as e:
        logger.error(f"Failed to send admin pickup notification: {e}")
    
    return {
        "success": True,
        "message": f"Order verified successfully via {verification_method.replace('_', ' ')}! Marked as delivered.",
        "order_number": otp_data.order_number,
        "verified_at": now.isoformat(),
        "verification_method": verification_method,
        "balance_collected": otp_record.get('balance_amount', 0)
    }


# ===================== Internal Functions =====================

async def create_pickup_otp(
    order_number: str,
    customer_email: str,
    customer_phone: str,
    retailer_id: str,
    retailer_name: str,
    balance_amount: float = 0,
    send_notification: bool = True,
    background_tasks: BackgroundTasks = None
) -> dict:
    """
    Create OTP for store pickup order.
    Called from orders.py after payment verification.
    
    Returns:
        dict with OTP details
    """
    try:
        otp_code = generate_otp(6)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=7)  # OTP valid for 7 days
        
        otp_record = {
            "order_number": order_number,
            "otp_code": otp_code,
            "customer_email": customer_email.lower(),
            "customer_phone": customer_phone,
            "retailer_id": retailer_id,
            "retailer_name": retailer_name,
            "balance_amount": balance_amount,
            "status": "pending",
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat()
        }
        
        # Check if OTP already exists for this order
        existing = await db.store_pickup_otps.find_one({"order_number": order_number})
        if existing:
            # Update existing
            await db.store_pickup_otps.update_one(
                {"order_number": order_number},
                {"$set": otp_record}
            )
        else:
            await db.store_pickup_otps.insert_one(otp_record)
        
        # Send OTP to customer
        if send_notification:
            if background_tasks:
                background_tasks.add_task(
                    send_pickup_otp_email,
                    customer_email,
                    order_number,
                    otp_code,
                    retailer_name,
                    balance_amount
                )
            else:
                await send_pickup_otp_email(
                    customer_email,
                    order_number,
                    otp_code,
                    retailer_name,
                    balance_amount
                )
        
        logger.info(f"Created pickup OTP for order {order_number}: {otp_code}")
        
        return {
            "success": True,
            "otp_code": otp_code,
            "expires_at": expires_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to create pickup OTP for {order_number}: {e}")
        return {"success": False, "error": str(e)}


async def send_pickup_otp_email(
    email: str,
    order_number: str,
    otp_code: str,
    retailer_name: str,
    balance_amount: float
) -> bool:
    """Send pickup OTP to customer"""
    try:
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Store Pickup</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                        <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Your Pickup OTP</h2>
                        <p style="color: #666; margin: 0 0 30px 0;">
                            Order #{order_number} is ready for pickup!
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #1e3a52, #2d4a6a); padding: 30px; border-radius: 12px; margin: 20px 0;">
                            <p style="color: #d4af37; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase;">
                                Your OTP Code
                            </p>
                            <p style="color: #ffffff; font-size: 48px; font-weight: bold; margin: 0; letter-spacing: 8px;">
                                {otp_code}
                            </p>
                        </div>
                        
                        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
                            <h3 style="color: #1e3a52; margin: 0 0 15px 0; font-size: 14px;">Pickup Details</h3>
                            <p style="color: #666; margin: 0 0 10px 0;">
                                <strong>Store:</strong> {retailer_name}
                            </p>
                            {f'<p style="color: #38a169; margin: 0; font-weight: bold;"><strong>Balance to Pay:</strong> ₹{balance_amount:.0f}</p>' if balance_amount > 0 else '<p style="color: #38a169; margin: 0;"><strong>Payment:</strong> Fully Paid ✓</p>'}
                        </div>
                        
                        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                <strong>Important:</strong> Share this OTP with the store staff when picking up your order.
                                The OTP is valid for 7 days.
                            </p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #999; margin: 0; font-size: 11px;">
                            Addrika - Premium Agarbattis | contact.us@centraders.com
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        from services.email_service import send_email
        result = await send_email(
            to_email=email,
            subject=f"🔐 Your Pickup OTP for Order #{order_number}",
            html_content=html_content
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send pickup OTP email: {e}")
        return False


async def send_admin_pickup_completion_email(
    order: dict,
    retailer: dict,
    otp_record: dict,
    verification_method: str
):
    """
    Send email to admin when a retailer marks an order as picked up/delivered.
    Includes customer details for verification.
    """
    try:
        from services.email_service import send_email
        
        customer_name = order.get('billing', {}).get('name') or order.get('shipping', {}).get('name', 'Unknown')
        customer_phone = order.get('billing', {}).get('phone') or order.get('shipping', {}).get('phone', 'N/A')
        customer_email = order.get('billing', {}).get('email') or order.get('shipping', {}).get('email', 'N/A')
        
        retailer_name = retailer.get('business_name') or retailer.get('trade_name', 'Unknown Store')
        retailer_city = retailer.get('city', '')
        retailer_phone = retailer.get('phone', 'N/A')
        
        order_number = order.get('order_number')
        balance_collected = otp_record.get('balance_amount', 0)
        order_total = order.get('pricing', {}).get('final_total', 0)
        
        # Build items list
        items_html = ""
        for item in order.get('items', [])[:5]:
            items_html += f"<tr><td style='padding: 8px; border-bottom: 1px solid #eee;'>{item.get('name', '')} ({item.get('size', '')})</td><td style='padding: 8px; border-bottom: 1px solid #eee; text-align: center;'>{item.get('quantity', 1)}</td></tr>"
        
        verification_badge = "🔐 OTP Verified" if verification_method == "customer_otp" else "🔑 Admin Password Used"
        verification_color = "#38a169" if verification_method == "customer_otp" else "#e53e3e"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 25px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Pickup Verification Alert</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 25px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="display: inline-block; padding: 10px 20px; background-color: {verification_color}; color: white; border-radius: 20px; font-weight: bold;">
                                {verification_badge}
                            </div>
                        </div>
                        
                        <h2 style="color: #1e3a52; margin: 0 0 5px 0;">Order Marked as Delivered</h2>
                        <p style="color: #666; margin: 0 0 20px 0;">Order <strong>#{order_number}</strong> has been picked up by the customer</p>
                        
                        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                            <h3 style="margin: 0 0 10px 0; color: #92400e;">⚠️ Customer Details - For Verification Call</h3>
                            <p style="margin: 5px 0;"><strong>Name:</strong> {customer_name}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{customer_phone}" style="color: #1e3a52; font-weight: bold;">{customer_phone}</a></p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {customer_email}</p>
                        </div>
                        
                        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #38a169;">
                            <h3 style="margin: 0 0 10px 0; color: #166534;">🏪 Retailer Details</h3>
                            <p style="margin: 5px 0;"><strong>Store:</strong> {retailer_name}</p>
                            <p style="margin: 5px 0;"><strong>City:</strong> {retailer_city}</p>
                            <p style="margin: 5px 0;"><strong>Retailer Phone:</strong> <a href="tel:{retailer_phone}" style="color: #1e3a52;">{retailer_phone}</a></p>
                        </div>
                        
                        <div style="background-color: #f9f7f4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 10px 0; color: #1e3a52;">📦 Order Summary</h3>
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <thead>
                                    <tr style="background-color: #eee;">
                                        <th style="padding: 8px; text-align: left;">Item</th>
                                        <th style="padding: 8px; text-align: center;">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items_html}
                                </tbody>
                            </table>
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #d4af37;">
                                <p style="margin: 5px 0;"><strong>Order Total:</strong> ₹{order_total:,.0f}</p>
                                <p style="margin: 5px 0;"><strong>Balance Collected at Store:</strong> ₹{balance_collected:,.0f}</p>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px;">
                            <p style="margin: 0; color: #1e40af; font-size: 14px;">
                                <strong>Action Required:</strong> Please verify this pickup by calling the customer if verification method shows "Admin Password Used"
                            </p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0; font-size: 14px;">ADDRIKA - Premium Agarbattis</p>
                        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Admin Notification System</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        await send_email(
            to_email=ADMIN_EMAIL,
            subject=f"✅ Pickup Complete: Order #{order_number} | {verification_badge}",
            html_content=html_content
        )
        
        logger.info(f"Admin pickup notification sent for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send admin pickup notification: {e}")


async def send_admin_order_routed_email(
    order: dict,
    retailer: dict,
    is_pickup: bool = False
):
    """
    Send email to admin when an order is routed to a retailer.
    Called after payment verification.
    """
    try:
        from services.email_service import send_email
        
        customer_name = order.get('billing', {}).get('name') or order.get('shipping', {}).get('name', 'Unknown')
        customer_phone = order.get('billing', {}).get('phone') or order.get('shipping', {}).get('phone', 'N/A')
        customer_email = order.get('billing', {}).get('email') or order.get('shipping', {}).get('email', 'N/A')
        customer_address = order.get('shipping', {}).get('address', '')
        customer_city = order.get('shipping', {}).get('city', '')
        customer_state = order.get('shipping', {}).get('state', '')
        customer_pincode = order.get('shipping', {}).get('pincode', '')
        
        retailer_name = retailer.get('name') or retailer.get('business_name') or retailer.get('trade_name', 'Unknown')
        retailer_email = retailer.get('email', 'N/A')
        retailer_phone = retailer.get('phone', 'N/A')
        retailer_city = retailer.get('city', '')
        
        order_number = order.get('order_number')
        order_total = order.get('pricing', {}).get('final_total', 0)
        delivery_mode = order.get('delivery_mode', 'shipping')
        balance_at_store = order.get('balance_at_store', 0)
        
        # Build items list
        items_html = ""
        for item in order.get('items', []):
            items_html += f"<tr><td style='padding: 8px; border-bottom: 1px solid #eee;'>{item.get('name', '')} ({item.get('size', '')})</td><td style='padding: 8px; border-bottom: 1px solid #eee; text-align: center;'>{item.get('quantity', 1)}</td><td style='padding: 8px; border-bottom: 1px solid #eee; text-align: right;'>₹{item.get('price', 0) * item.get('quantity', 1):,.0f}</td></tr>"
        
        order_type = "🏪 Self-Pickup" if is_pickup else "🚚 Home Delivery"
        order_type_color = "#7c3aed" if is_pickup else "#0891b2"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 25px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">New Order Routed</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 25px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="display: inline-block; padding: 10px 20px; background-color: {order_type_color}; color: white; border-radius: 20px; font-weight: bold;">
                                {order_type}
                            </div>
                        </div>
                        
                        <h2 style="color: #1e3a52; margin: 0 0 5px 0;">New Order Assigned</h2>
                        <p style="color: #666; margin: 0 0 20px 0;">Order <strong>#{order_number}</strong> has been routed to a retailer</p>
                        
                        <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                            <h3 style="margin: 0 0 10px 0; color: #1e40af;">👤 Customer Details</h3>
                            <p style="margin: 5px 0;"><strong>Name:</strong> {customer_name}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{customer_phone}" style="color: #1e3a52; font-weight: bold;">{customer_phone}</a></p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {customer_email}</p>
                            {f'<p style="margin: 5px 0;"><strong>Address:</strong> {customer_address}, {customer_city}, {customer_state} - {customer_pincode}</p>' if not is_pickup else ''}
                        </div>
                        
                        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #38a169;">
                            <h3 style="margin: 0 0 10px 0; color: #166534;">🏪 Assigned Retailer</h3>
                            <p style="margin: 5px 0;"><strong>Store:</strong> {retailer_name}</p>
                            <p style="margin: 5px 0;"><strong>City:</strong> {retailer_city}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {retailer_email}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{retailer_phone}" style="color: #1e3a52;">{retailer_phone}</a></p>
                        </div>
                        
                        <div style="background-color: #f9f7f4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 10px 0; color: #1e3a52;">📦 Order Details</h3>
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <thead>
                                    <tr style="background-color: #eee;">
                                        <th style="padding: 8px; text-align: left;">Item</th>
                                        <th style="padding: 8px; text-align: center;">Qty</th>
                                        <th style="padding: 8px; text-align: right;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items_html}
                                </tbody>
                            </table>
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #d4af37;">
                                <p style="margin: 5px 0;"><strong>Order Total:</strong> ₹{order_total:,.0f}</p>
                                {f'<p style="margin: 5px 0; color: #e53e3e;"><strong>Balance at Store:</strong> ₹{balance_at_store:,.0f}</p>' if balance_at_store > 0 else '<p style="margin: 5px 0; color: #38a169;"><strong>Payment:</strong> Fully Paid ✓</p>'}
                            </div>
                        </div>
                        
                        <div style="text-align: center; padding: 15px; background-color: #fef3c7; border-radius: 8px;">
                            <p style="margin: 0; color: #92400e; font-size: 14px;">
                                {'<strong>Pickup Order:</strong> Customer will collect from store with OTP verification' if is_pickup else '<strong>Shipping Order:</strong> Retailer will dispatch for home delivery'}
                            </p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0; font-size: 14px;">ADDRIKA - Premium Agarbattis</p>
                        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Admin Order Tracking System</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        await send_email(
            to_email=ADMIN_EMAIL,
            subject=f"📦 New Order #{order_number} | {order_type} | {retailer_name}",
            html_content=html_content
        )
        
        logger.info(f"Admin order routed notification sent for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send admin order routed notification: {e}")
