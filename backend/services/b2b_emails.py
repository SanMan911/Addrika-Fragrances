"""
B2B email templates and senders.
Extracted from routers/b2b_orders.py to keep the router slim.
"""
import logging
from typing import Optional

from dependencies import db, NOTIFICATION_EMAIL  # noqa: F401  (db imported for symmetry)

logger = logging.getLogger(__name__)


async def send_b2b_admin_notification_email(order: dict, retailer: dict) -> None:
    """Email Addrika admin (contact.us@centraders.com) when a B2B order is placed.
    B2B orders bypass ShipRocket — admin handles delivery manually.
    """
    from services.email_service import send_email

    items_html = ""
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{item['name']} ({item['net_weight']})</td>
            <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">{item['quantity_boxes']} boxes</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">₹{item['line_total']:,.2f}</td>
        </tr>
        """

    business_name = (
        retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    )
    payment_method = (order.get("payment_method", "credit") or "credit").upper()
    online_line: Optional[str] = ""
    if order.get("cash_discount", 0) > 0:
        online_line = (
            f"<p style='margin:5px 0;'><strong>Online Payment Discount:</strong> "
            f"{order.get('cash_discount_percent', 0)}% (₹{order['cash_discount']:,.2f})</p>"
        )

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#1e3a52;padding:24px;text-align:center;">
                <h1 style="color:#d4af37;margin:0;">ADDRIKA</h1>
                <p style="color:#fff;margin:4px 0 0;">New B2B Order Received</p>
            </td></tr>
            <tr><td style="padding:24px;">
                <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 14px;border-radius:6px;margin-bottom:18px;">
                    <strong style="color:#92400E;">Action required:</strong>
                    <span style="color:#78350F;"> Contact retailer to confirm and arrange delivery (B2B orders bypass ShipRocket).</span>
                </div>

                <h3 style="margin:0 0 8px 0;color:#1e3a52;">Retailer</h3>
                <p style="margin:4px 0;"><strong>{business_name}</strong></p>
                <p style="margin:4px 0;">GST: {retailer.get('gst_number') or 'N/A'}</p>
                <p style="margin:4px 0;">Email: {retailer.get('email', 'N/A')}</p>
                <p style="margin:4px 0;">Phone: {retailer.get('phone', 'N/A')}</p>

                <h3 style="margin:18px 0 8px 0;color:#1e3a52;">Order {order['order_id']}</h3>
                <p style="margin:4px 0;"><strong>Payment Method:</strong> {payment_method}</p>
                <p style="margin:4px 0;"><strong>Payment Status:</strong> {order.get('payment_status', 'pending').upper()}</p>
                {online_line}

                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-top:12px;">
                    <thead>
                        <tr style="background:#f9f7f4;">
                            <th style="padding:10px;text-align:left;">Product</th>
                            <th style="padding:10px;text-align:center;">Qty</th>
                            <th style="padding:10px;text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>{items_html}</tbody>
                </table>

                <div style="margin-top:18px;padding:14px;background:#f9f7f4;border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>₹{order['subtotal']:,.2f}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span>GST:</span><span>₹{order['gst_total']:,.2f}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Discount:</span><span>-₹{order.get('total_discount', 0):,.2f}</span></div>
                    <div style="display:flex;justify-content:space-between;font-weight:bold;color:#d4af37;margin-top:8px;border-top:2px solid #d4af37;padding-top:8px;">
                        <span>Grand Total:</span><span>₹{order['grand_total']:,.2f}</span>
                    </div>
                </div>
            </td></tr>
            <tr><td style="background:#1e3a52;padding:14px;text-align:center;">
                <p style="color:#d4af37;margin:0;font-size:12px;">Addrika B2B • {NOTIFICATION_EMAIL}</p>
            </td></tr>
        </table>
    </body>
    </html>
    """

    await send_email(
        to_email=NOTIFICATION_EMAIL,
        subject=f"[B2B] New Order {order['order_id']} · {business_name} · ₹{order['grand_total']:,.0f}",
        html_content=html,
    )
    logger.info(
        f"B2B admin notification sent to {NOTIFICATION_EMAIL} for order {order['order_id']}"
    )
