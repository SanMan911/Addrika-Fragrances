"""Email service for Addrika using Resend"""
import os
import asyncio
import logging
import random
import resend
from datetime import datetime

logger = logging.getLogger(__name__)


def _get_resend_key():
    """Get Resend API key at runtime"""
    return os.environ.get('RESEND_API_KEY', '')


def _get_sender_email():
    """Get sender email at runtime"""
    return os.environ.get('SENDER_EMAIL', 'noreply@centraders.com')


def is_email_service_available() -> bool:
    """Check if email service is available"""
    key = _get_resend_key()
    available = bool(key and key.startswith('re_'))
    if not available and key:
        logger.warning(f"RESEND_API_KEY found but is not a valid Resend key (should start with re_). Key starts with: {key[:5]}...")
    return available


def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])


def get_otp_email_html(otp: str) -> str:
    """Generate HTML email for OTP verification"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #d4af37; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 24px;">✉️</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Verify Your Email</h2>
                    <p style="color: #666; margin: 0 0 30px 0;">Use the code below to complete your registration</p>
                    
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase;">Your Verification Code</p>
                        <p style="color: #1e3a52; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">{otp}</p>
                    </div>
                    
                    <p style="color: #999; font-size: 14px; margin: 20px 0 0 0;">
                        This code expires in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                        If you didn't request this code, please ignore this email.
                    </p>
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


async def send_otp_email(email: str, otp: str) -> bool:
    """Send OTP verification email"""
    html = get_otp_email_html(otp)
    return await send_email(
        to_email=email,
        subject="Verify Your Email - Addrika",
        html_content=html
    )


def get_admin_2fa_email_html(otp: str) -> str:
    """Generate HTML email for Admin 2FA verification"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Admin Panel</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #dc2626; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 24px;">🔐</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Admin Login Verification</h2>
                    <p style="color: #666; margin: 0 0 30px 0;">A login attempt was made to your admin account. Use the code below to verify your identity.</p>
                    
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #dc2626;">
                        <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase;">Your Security Code</p>
                        <p style="color: #dc2626; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">{otp}</p>
                    </div>
                    
                    <p style="color: #999; font-size: 14px; margin: 20px 0 0 0;">
                        This code expires in <strong>5 minutes</strong>.
                    </p>
                    <p style="color: #dc2626; font-size: 12px; margin: 10px 0 0 0; font-weight: bold;">
                        ⚠️ If you didn't attempt to login, please secure your account immediately.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #999; margin: 0; font-size: 11px;">
                        Addrika Admin Portal | Secure Access
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_admin_2fa_otp(email: str, otp: str) -> bool:
    """Send Admin 2FA OTP email"""
    html = get_admin_2fa_email_html(otp)
    return await send_email(
        to_email=email,
        subject="🔐 Admin Login Verification - Addrika",
        html_content=html
    )


def get_order_confirmation_html(order: dict) -> str:
    """Generate HTML email for order confirmation"""
    items_html = ""
    for item in order.get('items', []):
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                {item.get('name', '')} ({item.get('size', '')})
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                {item.get('quantity', 1)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                ₹{item.get('price', 0) * item.get('quantity', 1):.2f}
            </td>
        </tr>
        """
    
    shipping = order.get('shipping', {})
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            
            <!-- Order Confirmed Message -->
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #d4af37; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 30px;">✓</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Order Confirmed!</h2>
                    <p style="color: #666; margin: 0;">Thank you for shopping with Addrika</p>
                </td>
            </tr>
            
            <!-- Order Details -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Order Details</h3>
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> {order.get('orderNumber', 'N/A')}</p>
                        <p style="margin: 5px 0;"><strong>Order Date:</strong> {datetime.now().strftime('%B %d, %Y')}</p>
                        <p style="margin: 5px 0;"><strong>Payment Status:</strong> <span style="color: #22c55e;">✓ {order.get('paymentStatus', 'Pending').title()}</span></p>
                    </div>
                </td>
            </tr>
            
            <!-- Items Table -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Items Ordered</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px;">
                        <thead>
                            <tr style="background-color: #f9f7f4;">
                                <th style="padding: 12px; text-align: left; color: #1e3a52;">Product</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a52;">Qty</th>
                                <th style="padding: 12px; text-align: right; color: #1e3a52;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                </td>
            </tr>
            
            <!-- Price Summary -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Subtotal:</td>
                            <td style="padding: 8px 0; text-align: right;">₹{order.get('subtotal', 0):.2f}</td>
                        </tr>
                        {f'<tr><td style="padding: 8px 0; color: #22c55e;">Bulk Discount:</td><td style="padding: 8px 0; text-align: right; color: #22c55e;">-₹{order.get("bulkDiscount", 0):.2f}</td></tr>' if order.get('bulkDiscount', 0) > 0 else ''}
                        {f'<tr><td style="padding: 8px 0; color: #22c55e;">Code Discount:</td><td style="padding: 8px 0; text-align: right; color: #22c55e;">-₹{order.get("codeDiscount", 0):.2f}</td></tr>' if order.get('codeDiscount', 0) > 0 else ''}
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Shipping:</td>
                            <td style="padding: 8px 0; text-align: right;">{f'₹{order.get("shippingCharge", 0):.2f}' if order.get('shippingCharge', 0) > 0 else 'FREE'}</td>
                        </tr>
                        <tr style="border-top: 2px solid #1e3a52;">
                            <td style="padding: 15px 0; font-size: 18px; font-weight: bold; color: #1e3a52;">Total:</td>
                            <td style="padding: 15px 0; text-align: right; font-size: 18px; font-weight: bold; color: #d4af37;">₹{order.get('total', 0):.2f}</td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Shipping Address -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Shipping Address</h3>
                        <p style="margin: 0; color: #333;">
                            {shipping.get('name', '')}<br>
                            {shipping.get('address', '')}<br>
                            {shipping.get('city', '')}, {shipping.get('state', '')} {shipping.get('pincode', '')}<br>
                            Phone: {shipping.get('phone', '')}
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Track Order CTA -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <a href="https://centraders.com/track-order" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Track Your Order
                    </a>
                </td>
            </tr>
            
            <!-- Policy Notice -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #991b1b; font-weight: bold;">Important Notice:</p>
                        <p style="margin: 0; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
                            Orders once placed cannot be cancelled. For any RTO (Return-To-Origin) orders, a voucher will be issued within 7 days of receipt of returns, valid for 15 days. The voucher value equals the amount received minus RTO processing charges. Unused vouchers may be donated to our partner NGOs.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">
                        Premium Agarbattis | Elegance in Every Scent
                    </p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_order_status_update_html(order: dict, new_status: str) -> str:
    """Generate HTML email for order status updates"""
    status_messages = {
        'confirmed': ('Order Confirmed', 'Your order has been confirmed and is being prepared.', '#22c55e'),
        'processing': ('Order Processing', 'Your order is being carefully packed with love.', '#f59e0b'),
        'shipped': ('Order Shipped', 'Great news! Your order is on its way to you.', '#3b82f6'),
        'delivered': ('Order Delivered', 'Your order has been delivered. Enjoy your premium agarbattis!', '#22c55e'),
        'cancelled': ('Order Cancelled', 'Your order has been cancelled. If you have questions, please contact us.', '#ef4444')
    }
    
    title, message, color = status_messages.get(new_status, ('Order Update', 'Your order status has been updated.', '#1e3a52'))
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <h2 style="color: {color}; margin: 0 0 10px 0;">{title}</h2>
                    <p style="color: #666; margin: 0 0 20px 0;">{message}</p>
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; text-align: left;">
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> {order.get('orderNumber', 'N/A')}</p>
                        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: {color};">{new_status.title()}</span></p>
                    </div>
                    <a href="https://centraders.com/track-order" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
                        Track Order
                    </a>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #999; margin: 0; font-size: 12px;">Addrika - Premium Agarbattis</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    attachments: list = None,
) -> bool:
    """Send an email using Resend.

    `attachments`, if provided, must be a list of dicts with keys
    `filename` (str) and `content` (bytes or base64 str). Resend accepts
    base64-encoded content directly.
    """
    api_key = _get_resend_key()
    sender_email = _get_sender_email()

    if not api_key or not api_key.startswith('re_'):
        logger.warning(f"Resend API key not configured or invalid, skipping email. Key present: {bool(api_key)}")
        return False

    try:
        # Set API key at runtime
        resend.api_key = api_key

        params = {
            "from": f"Addrika <{sender_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        if attachments:
            import base64 as _b64
            payload_attachments = []
            for a in attachments:
                content = a.get("content")
                if isinstance(content, (bytes, bytearray)):
                    content = _b64.b64encode(bytes(content)).decode("ascii")
                payload_attachments.append(
                    {"filename": a["filename"], "content": content}
                )
            params["attachments"] = payload_attachments

        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully to {to_email}, ID: {result.get('id')}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_order_confirmation(order: dict):
    """Send order confirmation email to customer AND admin"""
    customer_email = order.get('shipping', {}).get('email')
    admin_email = "contact.us@centraders.com"
    order_number = order.get('orderNumber', 'N/A')
    
    results = []
    
    # Send to customer
    if customer_email:
        html = get_order_confirmation_html(order)
        customer_result = await send_email(
            to_email=customer_email,
            subject=f"Order Confirmed - {order_number} | Addrika",
            html_content=html
        )
        results.append(('customer', customer_result))
        logger.info(f"Customer confirmation email sent to {customer_email}: {customer_result}")
    else:
        logger.warning("No customer email address for order confirmation")
    
    # Send to admin
    admin_html = get_admin_order_notification_html(order)
    admin_result = await send_email(
        to_email=admin_email,
        subject=f"🛒 New Order Received - {order_number} | Addrika Admin",
        html_content=admin_html
    )
    results.append(('admin', admin_result))
    logger.info(f"Admin notification email sent to {admin_email}: {admin_result}")
    
    return all(r[1] for r in results)


def get_admin_order_notification_html(order: dict) -> str:
    """Generate HTML email for admin order notification"""
    items_html = ""
    for item in order.get('items', []):
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                {item.get('name', '')} ({item.get('size', '')})
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                {item.get('quantity', 1)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                ₹{item.get('price', 0) * item.get('quantity', 1):.2f}
            </td>
        </tr>
        """
    
    shipping = order.get('shipping', {})
    payment_mode = order.get('paymentMode', 'Online')
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA ADMIN</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">New Order Notification</p>
                </td>
            </tr>
            
            <!-- New Order Alert -->
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 30px;">🛒</span>
                    </div>
                    <h2 style="color: #22c55e; margin: 0 0 10px 0;">New Order Received!</h2>
                    <p style="color: #666; margin: 0;">A new order has been placed and payment confirmed.</p>
                </td>
            </tr>
            
            <!-- Order Details -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #22c55e;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Order Details</h3>
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> {order.get('orderNumber', 'N/A')}</p>
                        <p style="margin: 5px 0;"><strong>Order Date:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
                        <p style="margin: 5px 0;"><strong>Payment Mode:</strong> <span style="color: #22c55e; font-weight: bold;">{payment_mode}</span></p>
                        <p style="margin: 5px 0;"><strong>Payment Status:</strong> <span style="color: #22c55e;">✓ PAID</span></p>
                    </div>
                </td>
            </tr>
            
            <!-- Customer Details -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Customer Details</h3>
                        <p style="margin: 5px 0;"><strong>Name:</strong> {shipping.get('name', 'N/A')}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> {shipping.get('email', 'N/A')}</p>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> {shipping.get('phone', 'N/A')}</p>
                    </div>
                </td>
            </tr>
            
            <!-- Shipping Address -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Shipping Address</h3>
                        <p style="margin: 0; color: #333;">
                            {shipping.get('name', '')}<br>
                            {shipping.get('address', '')}<br>
                            {f"{shipping.get('landmark')}<br>" if shipping.get('landmark') else ''}
                            {shipping.get('city', '')}, {shipping.get('state', '')} {shipping.get('pincode', '')}<br>
                            Phone: {shipping.get('phone', '')}
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Items Table -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Items Ordered</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px;">
                        <thead>
                            <tr style="background-color: #f9f7f4;">
                                <th style="padding: 12px; text-align: left; color: #1e3a52;">Product</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a52;">Qty</th>
                                <th style="padding: 12px; text-align: right; color: #1e3a52;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                </td>
            </tr>
            
            <!-- Price Summary -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Subtotal:</td>
                            <td style="padding: 8px 0; text-align: right;">₹{order.get('subtotal', 0):.2f}</td>
                        </tr>
                        {f'<tr><td style="padding: 8px 0; color: #22c55e;">Bulk Discount:</td><td style="padding: 8px 0; text-align: right; color: #22c55e;">-₹{order.get("bulkDiscount", 0):.2f}</td></tr>' if order.get('bulkDiscount', 0) > 0 else ''}
                        {f'<tr><td style="padding: 8px 0; color: #22c55e;">Code Discount:</td><td style="padding: 8px 0; text-align: right; color: #22c55e;">-₹{order.get("codeDiscount", 0):.2f}</td></tr>' if order.get('codeDiscount', 0) > 0 else ''}
                        <tr>
                            <td style="padding: 8px 0; color: #666;">Shipping:</td>
                            <td style="padding: 8px 0; text-align: right;">{f'₹{order.get("shippingCharge", 0):.2f}' if order.get('shippingCharge', 0) > 0 else 'FREE'}</td>
                        </tr>
                        <tr style="border-top: 2px solid #1e3a52;">
                            <td style="padding: 15px 0; font-size: 18px; font-weight: bold; color: #1e3a52;">Total Collected:</td>
                            <td style="padding: 15px 0; text-align: right; font-size: 18px; font-weight: bold; color: #22c55e;">₹{order.get('total', 0):.2f}</td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Action Required -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #fef3cd; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e; font-weight: bold;">⚡ Action Required</p>
                        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                            Please process this order and update the status in the admin dashboard.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">
                        Admin Order Notification
                    </p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        This is an automated notification from your Addrika admin system.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_order_status_update(order: dict, new_status: str):
    """Send order status update email to customer"""
    email = order.get('shipping', {}).get('email')
    if not email:
        logger.warning("No email address for status update")
        return False
    
    html = get_order_status_update_html(order, new_status)
    return await send_email(
        to_email=email,
        subject=f"Order {new_status.title()} - {order.get('orderNumber', 'N/A')} | Addrika",
        html_content=html
    )


def get_order_status_update_v2_html(order: dict, new_status: str, rto_voucher: dict = None) -> str:
    """Generate enhanced HTML email for order status updates with shipping details and RTO info"""
    
    order_number = order.get('order_number') or order.get('orderNumber', 'N/A')
    shipping_details = order.get('shipping_details', {})
    carrier_name = shipping_details.get('carrier_name', '')
    tracking_number = shipping_details.get('tracking_number', '')
    
    status_messages = {
        'confirmed': ('Order Confirmed', 'Your order has been confirmed and is being prepared.', '#22c55e', '✓'),
        'processing': ('Order Processing', 'Your order is being carefully packed with love.', '#f59e0b', '📦'),
        'shipped': ('Order Shipped!', 'Great news! Your order is on its way to you.', '#3b82f6', '🚚'),
        'delivered': ('Order Delivered', 'Your order has been delivered. Enjoy your premium agarbattis!', '#22c55e', '✅'),
        'rto': ('Return-To-Origin (RTO)', 'Your order is being returned to us. A voucher will be generated for you shortly.', '#f97316', '↩️'),
        'cancelled': ('Order Cancelled', 'Your order has been cancelled. If you have questions, please contact us.', '#ef4444', '❌')
    }
    
    title, message, color, icon = status_messages.get(new_status, ('Order Update', 'Your order status has been updated.', '#1e3a52', '📋'))
    
    # Shipping details section for shipped/delivered/rto statuses
    shipping_info_html = ""
    if new_status in ['shipped', 'delivered', 'rto'] and (carrier_name or tracking_number):
        shipping_info_html = f"""
        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
            <h3 style="color: #1e3a52; margin: 0 0 10px 0; font-size: 14px;">🚚 Shipping Details</h3>
            {'<p style="margin: 5px 0;"><strong>Carrier:</strong> ' + carrier_name + '</p>' if carrier_name else ''}
            {'<p style="margin: 5px 0;"><strong>Tracking Number:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">' + tracking_number + '</code></p>' if tracking_number else ''}
        </div>
        """
    
    # RTO Voucher section - show "coming soon" if no voucher provided
    rto_voucher_html = ""
    if new_status == 'rto':
        if rto_voucher:
            # Voucher provided - show voucher details (VALUE only, not percentage)
            voucher_code = rto_voucher.get('voucher_code', '')
            voucher_value = rto_voucher.get('voucher_value', 0)
            expires_at = rto_voucher.get('expires_at', '')
            
            rto_voucher_html = f"""
            <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b;">
                <h3 style="color: #92400e; margin: 0 0 15px 0;">🎁 Your RTO Voucher</h3>
                <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">VOUCHER CODE</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e3a52; letter-spacing: 2px;">{voucher_code}</p>
                </div>
                <div style="text-align: center; margin-top: 15px;">
                    <p style="color: #22c55e; font-weight: bold; font-size: 24px; margin: 0;">₹{voucher_value:.2f}</p>
                    <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Voucher Value</p>
                </div>
                <p style="color: #92400e; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
                    ⏰ Valid for 15 days from issue. Must be claimed from the same account.
                </p>
            </div>
            """
        else:
            # No voucher yet - show "coming soon" message
            rto_voucher_html = """
            <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b;">
                <h3 style="color: #92400e; margin: 0 0 15px 0;">🎁 Voucher Coming Soon</h3>
                <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="color: #666; margin: 0;">
                        Your voucher is being processed and will be sent to you via email shortly.
                    </p>
                    <p style="color: #92400e; font-size: 13px; margin: 15px 0 0 0;">
                        Please allow <strong>2-3 business days</strong> for voucher generation.
                    </p>
                </div>
            </div>
            """
        
        # RTO policy note
        rto_voucher_html += """
        <div style="background-color: #f9f7f4; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 12px; color: #666;">
            <strong>RTO Policy:</strong><br>
            • Orders once placed cannot be cancelled.<br>
            • For RTO orders, a voucher is issued within 7 days of receipt of returns.<br>
            • Voucher must be claimed within 15 days of issue.<br>
            • Upon non-usage after expiry, the company may donate the amount to partner NGOs.<br>
            • Transaction reference for donations can be obtained by emailing contact.us@centraders.com within 15 days of donation.
        </div>
        """
    
    # Non-cancellation policy note
    policy_note = ""
    if new_status == 'confirmed':
        policy_note = """
        <div style="background-color: #fef2f2; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 12px; color: #991b1b;">
            <strong>Please Note:</strong> Orders once placed cannot be cancelled. For any queries, please contact us at contact.us@centraders.com
        </div>
        """
    
    # Review request section for delivered orders
    review_request_html = ""
    if new_status == 'delivered':
        items = order.get('items', [])
        items_list = ""
        for item in items:
            item_name = item.get('name', 'Product')
            item_size = item.get('size', '')
            items_list += f"<li style='margin: 5px 0;'>{item_name} ({item_size})</li>"
        
        review_request_html = f"""
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #22c55e;">
            <h3 style="color: #166534; margin: 0 0 15px 0; text-align: center;">⭐ Share Your Experience!</h3>
            <p style="color: #333; text-align: center; margin: 0 0 15px 0;">
                We hope you love your purchase! Your feedback helps us improve and helps other customers make informed decisions.
            </p>
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">PRODUCTS YOU ORDERED:</p>
                <ul style="margin: 0; padding-left: 20px; color: #1e3a52;">
                    {items_list}
                </ul>
            </div>
            <div style="text-align: center;">
                <a href="https://centraders.com/review?order={order_number}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    ⭐ Write a Review
                </a>
            </div>
            <p style="color: #666; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
                Your review helps fellow customers and earns you loyalty points!
            </p>
        </div>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: {color}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 28px;">{icon}</span>
                    </div>
                    <h2 style="color: {color}; margin: 0 0 10px 0;">{title}</h2>
                    <p style="color: #666; margin: 0 0 20px 0;">{message}</p>
                    
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; text-align: left;">
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> {order_number}</p>
                        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: {color}; font-weight: bold;">{new_status.upper() if new_status == 'rto' else new_status.title()}</span></p>
                    </div>
                    
                    {shipping_info_html}
                    {rto_voucher_html}
                    {review_request_html}
                    {policy_note}
                    
                    <a href="https://centraders.com/track-order?order={order_number}" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
                        Track Order
                    </a>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 5px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #999; margin: 0; font-size: 12px;">Premium Agarbattis | Elegance in Every Scent</p>
                    <p style="color: #999; margin: 10px 0 0 0; font-size: 11px;">
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_order_status_update_v2(order: dict, new_status: str, rto_voucher: dict = None):
    """Send enhanced order status update email with shipping details and RTO info"""
    email = order.get('shipping', {}).get('email')
    if not email:
        logger.warning("No email address for status update")
        return False
    
    order_number = order.get('order_number') or order.get('orderNumber', 'N/A')
    html = get_order_status_update_v2_html(order, new_status, rto_voucher)
    
    # Special subject for RTO
    if new_status == 'rto':
        subject = f"RTO Voucher Generated - {order_number} | Addrika"
    else:
        subject = f"Order {new_status.title()} - {order_number} | Addrika"
    
    return await send_email(
        to_email=email,
        subject=subject,
        html_content=html
    )


# ===================== Newsletter & Instagram Notification Emails =====================

def get_welcome_subscriber_html(name: str = None) -> str:
    """Generate welcome email for new subscribers"""
    greeting = f"Hi {name}," if name else "Hello,"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <h2 style="color: #1e3a52; margin: 0 0 20px 0;">Welcome to the Addrika Family! 🙏</h2>
                    <p style="color: #333;">{greeting}</p>
                    <p style="color: #666; line-height: 1.6;">
                        Thank you for subscribing to our newsletter! You'll now be the first to know about:
                    </p>
                    <ul style="color: #666; line-height: 1.8;">
                        <li>New fragrance launches</li>
                        <li>Exclusive offers & discounts</li>
                        <li>Tips on aromatherapy & wellness</li>
                        <li>Updates from our Instagram</li>
                    </ul>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://centraders.com" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Shop Now
                        </a>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f9f7f4; padding: 20px 30px; text-align: center;">
                    <p style="color: #666; margin: 0; font-size: 14px;">Follow us on Instagram</p>
                    <a href="https://instagram.com/addrika.fragrances" style="color: #d4af37; font-weight: bold;">@addrika.fragrances</a>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #999; margin: 0; font-size: 11px;">
                        You're receiving this because you subscribed to Addrika updates.
                        <br><a href="https://centraders.com/unsubscribe" style="color: #d4af37;">Unsubscribe</a>
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_instagram_notification_html(post_url: str, caption: str = None, image_url: str = None) -> str:
    """Generate email for Instagram post notification"""
    caption_html = f'<p style="color: #666; font-style: italic; margin: 20px 0;">"{caption[:200]}..."</p>' if caption and len(caption) > 0 else ''
    image_html = f'<img src="{image_url}" alt="New Post" style="max-width: 100%; border-radius: 8px; margin: 20px 0;" />' if image_url else ''
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 28px;">📸</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">New on Instagram!</h2>
                    <p style="color: #666;">We just shared something special on our Instagram. Check it out!</p>
                    {image_html}
                    {caption_html}
                    <a href="{post_url}" style="display: inline-block; background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
                        View on Instagram
                    </a>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f9f7f4; padding: 20px 30px; text-align: center;">
                    <a href="https://instagram.com/addrika.fragrances" style="color: #d4af37; font-weight: bold;">@addrika.fragrances</a>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #999; margin: 0; font-size: 11px;">
                        <a href="https://centraders.com/unsubscribe" style="color: #d4af37;">Unsubscribe</a> from these updates
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_new_blog_notification_html(post_title: str, post_excerpt: str, post_slug: str, featured_image: str = None) -> str:
    """Generate email for new blog post notification"""
    image_html = f'<img src="{featured_image}" alt="{post_title}" style="max-width: 100%; border-radius: 8px; margin: 20px 0;" />' if featured_image else ''
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <p style="color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">New Blog Post</p>
                    <h2 style="color: #1e3a52; margin: 0 0 20px 0;">{post_title}</h2>
                    {image_html}
                    <p style="color: #666; line-height: 1.6;">{post_excerpt}</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://centraders.com/blog/{post_slug}" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Read More
                        </a>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #999; margin: 0; font-size: 11px;">
                        <a href="https://centraders.com/unsubscribe" style="color: #d4af37;">Unsubscribe</a> from these updates
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_welcome_email(email: str, name: str = None):
    """Send welcome email to new subscriber"""
    html = get_welcome_subscriber_html(name)
    return await send_email(
        to_email=email,
        subject="Welcome to Addrika! 🙏",
        html_content=html
    )


async def send_rto_voucher_email(
    email: str,
    name: str,
    order_number: str,
    voucher_code: str,
    voucher_value: float,
    expires_at: str
):
    """
    Send RTO voucher email to customer.
    Shows ONLY the voucher VALUE, not the percentage of original order.
    """
    try:
        # Parse expiry date
        from datetime import datetime
        try:
            expiry_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            expiry_str = expiry_date.strftime('%d %B %Y')
        except:
            expiry_str = "15 days from today"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 12px;">Elegance in Every Scent</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                        <div style="width: 70px; height: 70px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 32px;">🎁</span>
                        </div>
                        
                        <h2 style="color: #1e3a52; margin: 0 0 15px 0;">Your Voucher is Ready!</h2>
                        <p style="color: #666; margin: 0 0 25px 0;">
                            Dear {name},<br><br>
                            Your voucher for Order <strong>#{order_number}</strong> has been generated.
                        </p>
                        
                        <div style="background-color: #fef3cd; padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid #f59e0b;">
                            <p style="color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">Your Voucher Code</p>
                            <p style="font-size: 28px; font-weight: bold; color: #1e3a52; letter-spacing: 3px; margin: 0; font-family: 'Courier New', monospace;">{voucher_code}</p>
                        </div>
                        
                        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0;">VOUCHER VALUE</p>
                            <p style="font-size: 36px; font-weight: bold; color: #22c55e; margin: 0;">₹{voucher_value:.2f}</p>
                        </div>
                        
                        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
                            <p style="color: #991b1b; font-size: 13px; margin: 0;">
                                ⏰ <strong>Valid until {expiry_str}</strong><br>
                                <span style="font-size: 12px;">Must be redeemed from the same account</span>
                            </p>
                        </div>
                        
                        <div style="margin-top: 30px;">
                            <a href="https://centraders.com/shop" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Shop Now
                            </a>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px 30px; background-color: #f9f7f4;">
                        <p style="color: #666; font-size: 12px; margin: 0; line-height: 1.6;">
                            <strong>How to use:</strong><br>
                            1. Add items to your cart<br>
                            2. Enter the voucher code at checkout<br>
                            3. The voucher value will be applied to your order
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0; font-size: 11px;">
                            Thank you for being a valued Addrika customer
                        </p>
                        <p style="color: #999; margin: 10px 0 0 0; font-size: 10px;">
                            Questions? Email us at contact.us@centraders.com
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        return await send_email(
            to_email=email,
            subject=f"🎁 Your Addrika Voucher is Ready! - ₹{voucher_value:.0f}",
            html_content=html
        )
    except Exception as e:
        logger.error(f"Failed to send RTO voucher email: {e}")
        return False


async def send_instagram_notification(email: str, post_url: str, caption: str = None, image_url: str = None):
    """Send Instagram post notification to subscriber"""
    html = get_instagram_notification_html(post_url, caption, image_url)
    return await send_email(
        to_email=email,
        subject="📸 New on Instagram | Addrika",
        html_content=html
    )


async def send_blog_notification(email: str, post_title: str, post_excerpt: str, post_slug: str, featured_image: str = None):
    """Send new blog post notification to subscriber"""
    html = get_new_blog_notification_html(post_title, post_excerpt, post_slug, featured_image)
    return await send_email(
        to_email=email,
        subject=f"New Post: {post_title} | Addrika Blog",
        html_content=html
    )



# ===================== Admin Inquiry Notification =====================

def get_admin_inquiry_notification_html(inquiry: dict) -> str:
    """Generate HTML email for new inquiry notification to admin"""
    inquiry_type_labels = {
        'retail': 'Retail Inquiry',
        'wholesale': 'Wholesale/B2B Inquiry',
        'general': 'General Inquiry',
        'product': 'Product Question',
        'support': 'Customer Support',
        'feedback': 'Feedback',
        'partnership': 'Partnership/Collaboration',
        'media': 'Media/Press',
        'other': 'Other'
    }
    
    inquiry_type = inquiry.get('inquiryType', inquiry.get('type', 'general'))
    type_label = inquiry_type_labels.get(inquiry_type, inquiry_type.title())
    
    # Build product details section if available
    product_details = ""
    if inquiry.get('fragrance') or inquiry.get('packageSize') or inquiry.get('quantity'):
        product_details = f"""
            <!-- Product Details -->
            <tr>
                <td style="padding: 0 30px 20px;">
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">🪔 Product Interest</h3>
                        <table width="100%" style="font-size: 14px;">
                            {f'<tr><td style="padding: 5px 0; color: #666; width: 120px;"><strong>Fragrance:</strong></td><td style="padding: 5px 0; color: #333;">{inquiry.get("fragrance")}</td></tr>' if inquiry.get('fragrance') else ''}
                            {f'<tr><td style="padding: 5px 0; color: #666;"><strong>Package Size:</strong></td><td style="padding: 5px 0; color: #333;">{inquiry.get("packageSize")}</td></tr>' if inquiry.get('packageSize') else ''}
                            {f'<tr><td style="padding: 5px 0; color: #666;"><strong>Quantity:</strong></td><td style="padding: 5px 0; color: #333;">{inquiry.get("quantity")} units</td></tr>' if inquiry.get('quantity') else ''}
                        </table>
                    </div>
                </td>
            </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA ADMIN</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">New Customer Inquiry</p>
                </td>
            </tr>
            
            <!-- Alert Banner -->
            <tr>
                <td style="padding: 30px 30px 20px;">
                    <div style="background-color: #fef3cd; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; text-align: center;">
                        <p style="margin: 0; color: #92400e; font-weight: bold;">📩 New Inquiry Received</p>
                        <p style="margin: 5px 0 0 0; color: #92400e; font-size: 14px;">A customer has submitted an inquiry through the website.</p>
                    </div>
                </td>
            </tr>
            
            <!-- Inquiry Type Badge -->
            <tr>
                <td style="padding: 0 30px 20px; text-align: center;">
                    <span style="display: inline-block; background-color: #3b82f6; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold;">
                        {type_label}
                    </span>
                </td>
            </tr>
            
            <!-- Customer Details -->
            <tr>
                <td style="padding: 0 30px 20px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">👤 Customer Details</h3>
                        <table width="100%" style="font-size: 14px;">
                            <tr>
                                <td style="padding: 5px 0; color: #666; width: 100px;"><strong>Name:</strong></td>
                                <td style="padding: 5px 0; color: #333;">{inquiry.get('name', 'N/A')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #666;"><strong>Email:</strong></td>
                                <td style="padding: 5px 0; color: #333;">
                                    <a href="mailto:{inquiry.get('email', '')}" style="color: #3b82f6;">{inquiry.get('email', 'N/A')}</a>
                                </td>
                            </tr>
                            {f'<tr><td style="padding: 5px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 5px 0; color: #333;">{inquiry.get("phone")}</td></tr>' if inquiry.get('phone') else ''}
                        </table>
                    </div>
                </td>
            </tr>
            
            {product_details}
            
            <!-- Message Content -->
            <tr>
                <td style="padding: 0 30px 20px;">
                    <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <h3 style="color: #1e3a52; margin: 0 0 15px 0;">💬 Message</h3>
                        <p style="margin: 0; color: #333; line-height: 1.6; white-space: pre-wrap;">{inquiry.get('message', 'No message provided.')}</p>
                    </div>
                </td>
            </tr>
            
            <!-- Inquiry ID -->
            <tr>
                <td style="padding: 0 30px 20px;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                        Inquiry ID: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">{inquiry.get('inquiry_id', 'N/A')}</code>
                    </p>
                </td>
            </tr>
            
            <!-- Action Button -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <a href="mailto:{inquiry.get('email', '')}?subject=Re: Your Addrika Inquiry" style="display: inline-block; background-color: #1e3a52; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Reply to Customer
                    </a>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">
                        Admin Inquiry Notification
                    </p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        This is an automated notification from your Addrika admin system.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_admin_inquiry_notification(inquiry: dict, admin_email: str = "contact.us@centraders.com"):
    """Send inquiry notification email to admin"""
    html = get_admin_inquiry_notification_html(inquiry)
    
    inquiry_type = inquiry.get('inquiryType', 'general').title()
    customer_name = inquiry.get('name', 'Customer')
    
    return await send_email(
        to_email=admin_email,
        subject=f"📩 New {inquiry_type} Inquiry from {customer_name} | Addrika",
        html_content=html
    )



# ============================================================================
# Review Request Email (Sent 3 days after delivery)
# ============================================================================

def get_review_request_html(order: dict) -> str:
    """Generate HTML email requesting a product review after delivery"""
    customer_name = order.get('shipping', {}).get('name', 'Valued Customer')
    order_number = order.get('orderNumber', 'N/A')
    
    # Get product names from the order
    products = [f"{item.get('name', '')} ({item.get('size', '')})" for item in order.get('items', [])]
    products_text = ", ".join(products) if products else "your recent purchase"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            
            <!-- Main Content -->
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #d4af37, #f5e6c8); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 40px;">⭐</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 15px 0; font-size: 24px;">How was your experience?</h2>
                    <p style="color: #666; margin: 0 0 20px 0; line-height: 1.6;">
                        Dear {customer_name},<br><br>
                        We hope you're enjoying <strong>{products_text}</strong>! Your feedback helps us improve and helps other customers make informed choices.
                    </p>
                </td>
            </tr>
            
            <!-- Order Reference -->
            <tr>
                <td style="padding: 0 30px 20px;">
                    <div style="background-color: #f9f7f4; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #d4af37;">
                        <p style="margin: 0; font-size: 14px; color: #666;">
                            <strong>Order:</strong> {order_number}
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- CTA Buttons -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <p style="color: #666; margin: 0 0 20px 0; font-size: 14px;">Rate your experience:</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="text-align: center; padding: 5px;">
                                <a href="https://centraders.com/review?order={order_number}&rating=5" style="text-decoration: none; font-size: 36px;" title="Excellent">⭐</a>
                            </td>
                            <td style="text-align: center; padding: 5px;">
                                <a href="https://centraders.com/review?order={order_number}&rating=4" style="text-decoration: none; font-size: 36px;" title="Good">⭐</a>
                            </td>
                            <td style="text-align: center; padding: 5px;">
                                <a href="https://centraders.com/review?order={order_number}&rating=3" style="text-decoration: none; font-size: 36px;" title="Average">⭐</a>
                            </td>
                            <td style="text-align: center; padding: 5px;">
                                <a href="https://centraders.com/review?order={order_number}&rating=2" style="text-decoration: none; font-size: 36px;" title="Below Average">⭐</a>
                            </td>
                            <td style="text-align: center; padding: 5px;">
                                <a href="https://centraders.com/review?order={order_number}&rating=1" style="text-decoration: none; font-size: 36px;" title="Poor">⭐</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Write Review Button -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <a href="https://centraders.com/review?order={order_number}" 
                       style="display: inline-block; background-color: #d4af37; color: #1e3a52; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Write a Review
                    </a>
                </td>
            </tr>
            
            <!-- Google Review Option -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <p style="color: #999; margin: 0 0 15px 0; font-size: 13px;">Or leave a review on Google:</p>
                    <a href="https://g.page/r/addrika/review" 
                       style="display: inline-block; background-color: #4285f4; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-size: 14px;">
                        Review on Google
                    </a>
                </td>
            </tr>
            
            <!-- Appreciation Note -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #fef9e7; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                            🙏 <strong>Thank you for choosing Addrika!</strong><br>
                            Your support helps us continue our mission of crafting premium, sustainable incense while supporting Women Self-Help Groups.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">
                        Premium Agarbattis | Elegance in Every Scent
                    </p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                    <p style="color: #666; margin: 10px 0 0 0; font-size: 10px;">
                        <a href="https://centraders.com/unsubscribe?email={order.get('shipping', {}).get('email', '')}" style="color: #666;">Unsubscribe</a>
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_review_request_email(order: dict) -> bool:
    """
    Send a review request email to the customer.
    This should be called 3 days after an order is marked as 'delivered'.
    
    Args:
        order: The order document containing customer and product info
        
    Returns:
        True if email sent successfully, False otherwise
    """
    customer_email = order.get('shipping', {}).get('email')
    order_number = order.get('orderNumber', 'N/A')
    
    if not customer_email:
        logger.warning(f"No customer email for review request: Order {order_number}")
        return False
    
    html = get_review_request_html(order)
    
    result = await send_email(
        to_email=customer_email,
        subject=f"⭐ How was your Addrika experience? | Order {order_number}",
        html_content=html
    )
    
    if result:
        logger.info(f"Review request email sent to {customer_email} for order {order_number}")
    else:
        logger.error(f"Failed to send review request email for order {order_number}")
    
    return result


# ================== ABANDONED CART EMAILS ==================

def get_abandoned_cart_html(name: str, items: list, cart_total: float) -> str:
    """Generate HTML email for abandoned cart reminder"""
    
    items_html = ""
    for item in items[:5]:  # Show first 5 items
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <div style="display: flex; align-items: center;">
                    <span>{item.get('name', '')} ({item.get('size', '')})</span>
                </div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                {item.get('quantity', 1)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                ₹{item.get('price', 0) * item.get('quantity', 1):.2f}
            </td>
        </tr>
        """
    
    if len(items) > 5:
        items_html += f"""
        <tr>
            <td colspan="3" style="padding: 12px; text-align: center; color: #666; font-style: italic;">
                ... and {len(items) - 5} more items
            </td>
        </tr>
        """
    
    return items_html



# ================== COIN EXPIRY REMINDER EMAIL ==================

async def send_coin_expiry_reminder_email(email: str, name: str, coins_balance: float, expiry_date: datetime) -> bool:
    """
    Send reminder email to user about coins expiring soon.
    Sent 7 days before expiry.
    """
    try:
        # Format expiry date
        if isinstance(expiry_date, str):
            expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        
        expiry_str = expiry_date.strftime("%d %B %Y")
        
        # Calculate coin value
        coin_value = round(coins_balance * 0.60, 2)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #d4af37, #f5d76e); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 40px;">🪙</span>
                        </div>
                        
                        <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Your Addrika Coins Are Expiring Soon!</h2>
                        <p style="color: #666; margin: 0 0 30px 0;">
                            Hi {name}, don't let your rewards go to waste!
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #fef9e7, #fff9f0); padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid #d4af37;">
                            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Your Coin Balance</p>
                            <p style="color: #d4af37; font-size: 42px; font-weight: bold; margin: 0;">
                                {coins_balance:.2f} <span style="font-size: 16px; color: #666;">coins</span>
                            </p>
                            <p style="color: #38a169; font-size: 16px; margin: 10px 0 0 0;">
                                Worth <strong>₹{coin_value:.2f}</strong> in savings!
                            </p>
                        </div>
                        
                        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                            <p style="color: #c53030; margin: 0; font-weight: bold;">
                                ⚠️ Expires on {expiry_str}
                            </p>
                            <p style="color: #742a2a; margin: 5px 0 0 0; font-size: 14px;">
                                Use your coins before they expire!
                            </p>
                        </div>
                        
                        <a href="https://centraders.com" 
                           style="display: inline-block; background: linear-gradient(135deg, #d4af37, #b8960c); color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Shop Now & Redeem Coins
                        </a>
                        
                        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-top: 30px; text-align: left;">
                            <h3 style="color: #1e3a52; margin: 0 0 15px 0; font-size: 14px;">How to Redeem:</h3>
                            <ul style="color: #666; margin: 0; padding-left: 20px; font-size: 14px;">
                                <li style="margin-bottom: 8px;">Add your favorite Addrika fragrances to cart</li>
                                <li style="margin-bottom: 8px;">At checkout, enter the coins you want to redeem</li>
                                <li style="margin-bottom: 8px;">Each coin = ₹0.60 discount (up to 50% of order value)</li>
                                <li>Complete your order and enjoy your savings!</li>
                            </ul>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0 0 10px 0; font-size: 14px;">
                            Addrika Rewards - Earn More, Save More
                        </p>
                        <p style="color: #999; margin: 0; font-size: 11px;">
                            You received this email because you have reward coins in your Addrika account.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        result = await send_email(
            to_email=email,
            subject=f"⚠️ Your {coins_balance:.0f} Addrika Coins Expire Soon - Use Them Now!",
            html_content=html_content
        )
        
        if result:
            logger.info(f"Coin expiry reminder sent to {email}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send coin expiry reminder to {email}: {str(e)}")
        return False


# ================== COIN EARNED NOTIFICATION EMAIL ==================

async def send_coins_earned_email(email: str, name: str, coins_earned: float, new_balance: float, order_number: str) -> bool:
    """
    Send notification email when user earns coins from a purchase.
    """
    try:
        coin_value = round(new_balance * 0.60, 2)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 28px;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Rewards</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #38a169, #48bb78); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 40px;">🎉</span>
                        </div>
                        
                        <h2 style="color: #38a169; margin: 0 0 10px 0;">You've Earned Addrika Coins!</h2>
                        <p style="color: #666; margin: 0 0 30px 0;">
                            Thank you for your order #{order_number}, {name}!
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #f0fff4, #c6f6d5); padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid #38a169;">
                            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Coins Earned</p>
                            <p style="color: #38a169; font-size: 42px; font-weight: bold; margin: 0;">
                                +{coins_earned:.2f}
                            </p>
                        </div>
                        
                        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Your New Balance</p>
                            <p style="color: #d4af37; font-size: 32px; font-weight: bold; margin: 0;">
                                {new_balance:.2f} <span style="font-size: 14px; color: #666;">coins</span>
                            </p>
                            <p style="color: #38a169; font-size: 14px; margin: 10px 0 0 0;">
                                Worth <strong>₹{coin_value:.2f}</strong> on your next order!
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin: 20px 0 0 0;">
                            Your coins are valid for <strong>3 months</strong> from your last purchase.
                            <br>Keep shopping to extend validity and earn more!
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0 0 10px 0; font-size: 14px;">
                            Earn 6.9 coins for every ₹125 spent
                        </p>
                        <p style="color: #999; margin: 0; font-size: 11px;">
                            Addrika - Premium Agarbattis | contact.us@centraders.com
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        result = await send_email(
            to_email=email,
            subject=f"🪙 You earned {coins_earned:.2f} Addrika Coins!",
            html_content=html_content
        )
        
        if result:
            logger.info(f"Coins earned email sent to {email}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send coins earned email to {email}: {str(e)}")
        return False



# ============================================================================
# Abandoned Cart Email Functions
# ============================================================================

def get_abandoned_cart_email_html(name: str, items: list, cart_total: float) -> str:
    """Generate HTML email for abandoned cart reminder"""
    
    # Build items HTML
    items_html = ""
    for item in items[:5]:  # Show max 5 items
        item_name = item.get('name', 'Product')
        item_size = item.get('size', '')
        item_qty = item.get('quantity', 1)
        item_price = item.get('price', 0)
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                {item_name} {f'({item_size})' if item_size else ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                {item_qty}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                ₹{item_price * item_qty:.2f}
            </td>
        </tr>
        """
    
    if len(items) > 5:
        items_html += f"""
        <tr>
            <td colspan="3" style="padding: 12px; text-align: center; color: #666; font-style: italic;">
                + {len(items) - 5} more items
            </td>
        </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Elegance in Every Scent</p>
                </td>
            </tr>
            
            <!-- Reminder Message -->
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #f59e0b; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 30px;">🛒</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">You Left Something Behind!</h2>
                    <p style="color: #666; margin: 0;">Hi {name}, your cart is waiting for you.</p>
                </td>
            </tr>
            
            <!-- Cart Items -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Your Cart Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px;">
                        <thead>
                            <tr style="background-color: #f9f7f4;">
                                <th style="padding: 12px; text-align: left; color: #1e3a52;">Product</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a52;">Qty</th>
                                <th style="padding: 12px; text-align: right; color: #1e3a52;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                </td>
            </tr>
            
            <!-- Cart Total -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="color: #666; font-size: 14px; margin: 0 0 5px 0;">Cart Total</p>
                        <p style="color: #1e3a52; font-size: 28px; font-weight: bold; margin: 0;">₹{cart_total:.2f}</p>
                    </div>
                </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                    <a href="https://centraders.com/cart" style="display: inline-block; background-color: #d4af37; color: #1e3a52; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Complete Your Order
                    </a>
                </td>
            </tr>
            
            <!-- Urgency Note -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #fef3cd; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; text-align: center;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            <strong>Don't miss out!</strong> Complete your order before items sell out.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 12px;">
                        Premium Agarbattis | Elegance in Every Scent
                    </p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_abandoned_cart_email(email: str, name: str, items: list, cart_total: float) -> bool:
    """Send abandoned cart reminder email to customer"""
    try:
        html = get_abandoned_cart_email_html(name, items, cart_total)
        return await send_email(
            to_email=email,
            subject=f"Your cart is waiting for you, {name}! | Addrika",
            html_content=html
        )
    except Exception as e:
        logger.error(f"Failed to send abandoned cart email to {email}: {str(e)}")
        return False


def get_admin_abandoned_cart_notification_html(abandoned_carts: list) -> str:
    """Generate HTML email for admin notification about abandoned carts"""
    
    # Build carts summary
    carts_html = ""
    total_value = 0
    for cart in abandoned_carts[:10]:  # Show max 10 carts
        name = cart.get('name', 'Customer')
        email = cart.get('email', 'N/A')
        phone = cart.get('phone', 'N/A')
        cart_total = cart.get('cart_total', 0)
        item_count = cart.get('item_count', 0)
        total_value += cart_total
        
        carts_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>{name}</strong><br>
                <span style="font-size: 12px; color: #666;">{email}</span><br>
                <span style="font-size: 12px; color: #666;">{phone}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                {item_count}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                ₹{cart_total:.2f}
            </td>
        </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: bold;">ADDRIKA ADMIN</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Abandoned Cart Alert</p>
                </td>
            </tr>
            
            <!-- Summary Banner -->
            <tr>
                <td style="padding: 30px;">
                    <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; border: 1px solid #f59e0b; text-align: center;">
                        <h2 style="color: #92400e; margin: 0 0 10px 0;">Cart Recovery Report</h2>
                        <p style="color: #92400e; margin: 0;">
                            <strong>{len(abandoned_carts)}</strong> customers have abandoned carts worth 
                            <strong>₹{total_value:.2f}</strong>
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Abandoned Carts Table -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <h3 style="color: #1e3a52; margin: 0 0 15px 0;">Carts Needing Follow-up</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px;">
                        <thead>
                            <tr style="background-color: #f9f7f4;">
                                <th style="padding: 12px; text-align: left; color: #1e3a52;">Customer</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a52;">Items</th>
                                <th style="padding: 12px; text-align: right; color: #1e3a52;">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carts_html}
                        </tbody>
                    </table>
                    {f'<p style="color: #666; font-size: 12px; margin-top: 10px; text-align: center;">Showing {min(10, len(abandoned_carts))} of {len(abandoned_carts)} abandoned carts</p>' if len(abandoned_carts) > 10 else ''}
                </td>
            </tr>
            
            <!-- Action Note -->
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; border: 1px solid #3b82f6;">
                        <p style="color: #1e40af; margin: 0; font-size: 14px;">
                            <strong>Tip:</strong> Consider reaching out to high-value carts via WhatsApp or phone for personal follow-up.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold;">ADDRIKA</p>
                    <p style="color: #999; margin: 0; font-size: 11px;">
                        Automated Admin Notification
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_admin_abandoned_cart_notification(abandoned_carts: list, admin_email: str = "contact.us@centraders.com") -> bool:
    """Send abandoned cart notification to admin"""
    try:
        if not abandoned_carts:
            return True
        
        html = get_admin_abandoned_cart_notification_html(abandoned_carts)
        total_value = sum(cart.get('cart_total', 0) for cart in abandoned_carts)
        
        return await send_email(
            to_email=admin_email,
            subject=f"🛒 {len(abandoned_carts)} Abandoned Carts (₹{total_value:.0f}) | Addrika Admin",
            html_content=html
        )
    except Exception as e:
        logger.error(f"Failed to send admin abandoned cart notification: {str(e)}")
        return False
