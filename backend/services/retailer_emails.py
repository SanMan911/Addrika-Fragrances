"""
Retailer Email Notifications for Addrika
Handles order notifications to retailers for pickup and shipping orders
"""
from datetime import datetime, timezone
import logging
from services.email_service import send_email

logger = logging.getLogger(__name__)


async def send_retailer_order_notification(
    retailer_email: str,
    order: dict,
    is_pickup: bool = False,
    items_list: list = None
) -> bool:
    """Send order notification to retailer (for pickup or shipping fulfillment)"""
    
    order_type = "Self-Pickup" if is_pickup else "Shipping"
    order_number = order.get('orderNumber', 'New Order')
    action_required = "STOCK CONFIRMATION REQUIRED" if is_pickup else "DISPATCH REQUIRED"
    
    # Build items table
    items_rows = ""
    if items_list:
        for item in items_list:
            item_total = item.get('mrp', 0) * item.get('quantity', 1)
            items_rows += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('name', 'Product')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('size', '')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity', 1)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">Rs.{item_total:.2f}</td>
            </tr>
            """
    
    # Customer info
    customer = order.get('shipping', order.get('billing', {}))
    customer_name = customer.get('name', 'Customer')
    customer_phone = customer.get('phone', 'N/A')
    customer_email = customer.get('email', 'N/A')
    balance = order.get('balance_at_store', 0)
    order_total = order.get('total', 0)
    pickup_time_slot = order.get('pickup_time_slot', 'Not specified')
    
    # Build delivery section based on pickup vs shipping
    # Token amount for calculations
    TOKEN_AMOUNT = 11
    
    if is_pickup:
        if balance > 0:
            balance_text = f"""
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #f59e0b;">
                <p style="color: #92400e; font-weight: bold; margin: 0;">PAYMENT COLLECTION:</p>
                <p style="color: #78350f; margin: 10px 0 0 0; font-size: 16px;">
                    Customer has prepaid Rs.{TOKEN_AMOUNT}. <strong>Collect no more than Rs.{balance:.0f}.</strong>
                </p>
            </div>
            """
        else:
            balance_text = "<p style='color: #22c55e; font-weight: bold;'>Fully Paid Online - No collection required</p>"
        
        delivery_section = f"""
        <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #166534; margin: 0 0 15px 0;">Self-Pickup Order</h3>
            <p><strong>Payment Status:</strong> {order.get('payment_type', 'Token Paid')}</p>
            <p><strong>Preferred Pickup Time:</strong> <span style="color: #b45309; font-weight: bold;">{pickup_time_slot}</span></p>
            {balance_text}
        </div>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px;">
            <p style="color: #92400e; font-weight: bold;">ACTION REQUIRED:</p>
            <ol style="color: #78350f; margin: 10px 0 0 0;">
                <li>Verify ALL items in stock</li>
                <li>If out of stock, contact customer immediately</li>
                <li>Keep order ready for pickup at {pickup_time_slot}</li>
            </ol>
        </div>
        """
    else:
        delivery_addr = f"{customer.get('address', '')}, {customer.get('city', '')}, {customer.get('state', '')} - {customer.get('pincode', '')}"
        delivery_section = f"""
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0;">Shipping Order</h3>
            <p><strong>Deliver to:</strong></p>
            <p>{customer_name}</p>
            <p>{delivery_addr}</p>
            <p><strong>Phone:</strong> {customer_phone}</p>
        </div>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px;">
            <p style="color: #92400e; font-weight: bold;">ACTION REQUIRED:</p>
            <ol style="color: #78350f; margin: 10px 0 0 0;">
                <li>Verify ALL items in stock</li>
                <li>Pack order securely</li>
                <li>Schedule pickup with courier</li>
                <li>If unavailable, contact admin</li>
            </ol>
        </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 25px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0;">ADDRIKA - RETAILER NOTIFICATION</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0;">{order_type.upper()} ORDER</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 20px;">
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 2px solid #ef4444; text-align: center; margin-bottom: 20px;">
                        <p style="margin: 0; color: #dc2626; font-size: 16px; font-weight: bold;">{action_required}</p>
                    </div>
                    
                    <div style="background-color: #f9f7f4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong>Order Number:</strong> {order_number}</p>
                        <p><strong>Order Date:</strong> {order.get('order_date', datetime.now(timezone.utc).strftime('%d %b %Y'))}</p>
                        <p><strong>Customer:</strong> {customer_name}</p>
                        <p><strong>Phone:</strong> <a href="tel:{customer_phone}">{customer_phone}</a></p>
                        <p><strong>Email:</strong> <a href="mailto:{customer_email}">{customer_email}</a></p>
                    </div>
                    
                    <h3>Order Items - VERIFY STOCK</h3>
                    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #1e3a52; color: white;">
                                <th style="padding: 10px; text-align: left;">Product</th>
                                <th style="padding: 10px; text-align: center;">Size</th>
                                <th style="padding: 10px; text-align: center;">Qty</th>
                                <th style="padding: 10px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_rows}
                            <tr style="background-color: #f9f7f4; font-weight: bold;">
                                <td colspan="3" style="padding: 10px; text-align: right;">Order Total:</td>
                                <td style="padding: 10px; text-align: right; color: #d4af37;">Rs.{order_total:.2f}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    {delivery_section}
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0;">ADDRIKA</p>
                    <p style="color: #999; margin: 5px 0 0 0; font-size: 11px;">For issues, contact admin at contact.us@centraders.com</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    result = await send_email(
        to_email=retailer_email,
        subject=f"[{order_type}] Order #{order_number} - Stock Verification Required | Addrika",
        html_content=html
    )
    
    if result:
        logger.info(f"Retailer notification sent to {retailer_email} for order {order_number}")
    else:
        logger.error(f"Failed to send retailer notification to {retailer_email}")
    
    return result


async def send_pickup_confirmation_to_customer(email: str, order: dict, store_info: dict) -> bool:
    """Send pickup confirmation email to customer"""
    
    order_number = order.get('orderNumber', 'N/A')
    store_name = store_info.get('name', 'Store')
    store_address = f"{store_info.get('address', '')}, {store_info.get('city', '')}"
    store_phone = store_info.get('phone', 'N/A')
    balance = order.get('balance_at_store', 0)
    pickup_time_slot = order.get('pickup_time_slot', 'As per store availability')
    
    # Token amount
    TOKEN_AMOUNT = 11
    
    balance_section = ""
    balance_item = ""
    if balance > 0:
        balance_section = f"""
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #f59e0b;">
            <p style="color: #92400e; font-weight: bold; margin: 0;">PAYMENT INFORMATION:</p>
            <p style="color: #78350f; margin: 10px 0 5px 0;">
                You have prepaid Rs.{TOKEN_AMOUNT}. Pay no more than <strong>Rs.{balance:.0f}</strong> at store to collect your order.
            </p>
            <p style="font-size: 24px; color: #d97706; font-weight: bold; margin: 10px 0 0 0;">Balance: Rs.{balance:.0f}</p>
        </div>
        """
        balance_item = f"<li>Rs.{balance:.0f} for remaining payment</li>"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0;">Elegance in Every Scent</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 20px;"></div>
                    <h2 style="color: #1e3a52; margin: 0 0 10px 0;">Order Reserved for Pickup!</h2>
                    <p style="color: #666;">Your order has been confirmed. Please collect from the store.</p>
                    <p style="color: #b45309; font-weight: bold; margin-top: 10px;">Preferred Pickup Time: {pickup_time_slot}</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="color: #666; margin: 0 0 5px 0;">Order Number</p>
                        <p style="font-size: 24px; font-weight: bold; color: #d4af37; margin: 0;">{order_number}</p>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 30px 30px;">
                    <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px;">
                        <h3 style="color: #1e40af; margin: 0 0 15px 0;">Pickup Location</h3>
                        <p style="font-weight: bold;">{store_name}</p>
                        <p>{store_address}</p>
                        <p><strong>Phone:</strong> <a href="tel:{store_phone}">{store_phone}</a></p>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 30px 30px;">
                    {balance_section}
                    <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px;">
                        <p style="color: #166534; font-weight: bold;">What to Bring:</p>
                        <ul style="color: #166534; margin: 10px 0 0 0; padding-left: 20px;">
                            <li>This email or Order Number</li>
                            <li>Valid ID for verification</li>
                            {balance_item}
                        </ul>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0;">ADDRIKA</p>
                    <p style="color: #999; margin: 5px 0 0 0; font-size: 11px;">Questions? Contact us at contact.us@centraders.com</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    result = await send_email(
        to_email=email,
        subject=f"Order Reserved for Pickup - #{order_number} | Addrika",
        html_content=html
    )
    
    if result:
        logger.info(f"Pickup confirmation sent to {email} for order {order_number}")
    
    return result
