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

    # Build the discount breakdown rows so the math is unambiguous
    subtotal = float(order.get("subtotal") or 0)
    tier_disc = float(order.get("tier_discount_total") or 0)
    loyalty_disc = float(order.get("loyalty_discount") or 0)
    voucher_disc = float(order.get("voucher_discount") or 0)
    cash_disc = float(order.get("cash_discount") or 0)
    cn_disc = float(order.get("credit_note_discount") or 0)
    taxable = float(
        order.get("taxable_value")
        or max(0.0, subtotal - tier_disc - loyalty_disc - voucher_disc - cash_disc)
    )
    gst_total = float(order.get("gst_total") or 0)
    grand = float(order.get("grand_total") or 0)

    def _row(label: str, value: float, color: str = "#444") -> str:
        sign = "-" if value > 0 and "Discount" in label else ""
        if "Discount" not in label:
            sign = ""
        return (
            f"<tr><td style='padding:6px 0;color:{color};'>{label}</td>"
            f"<td style='padding:6px 0;text-align:right;color:{color};'>"
            f"{sign}₹{value:,.2f}</td></tr>"
        )

    breakdown_rows = [_row("Subtotal (after bulk-tier savings)", subtotal)]
    if tier_disc > 0:
        # subtotal already excludes tier-discount; show the saved amount as info
        breakdown_rows.append(
            f"<tr><td style='padding:6px 0;color:#059669;font-size:12px;'>"
            f"&nbsp;&nbsp;Bulk-tier savings already applied per line</td>"
            f"<td style='padding:6px 0;text-align:right;color:#059669;font-size:12px;'>"
            f"-₹{tier_disc:,.2f}</td></tr>"
        )
    if loyalty_disc > 0:
        breakdown_rows.append(_row("Loyalty Bonus Discount", loyalty_disc, "#059669"))
    if voucher_disc > 0:
        breakdown_rows.append(_row("Voucher Discount", voucher_disc, "#059669"))
    if cash_disc > 0:
        breakdown_rows.append(_row("Online Payment Discount", cash_disc, "#059669"))
    breakdown_rows.append(
        f"<tr><td style='padding:8px 0;border-top:1px dashed #ccc;font-weight:600;'>"
        f"Taxable Value</td>"
        f"<td style='padding:8px 0;text-align:right;border-top:1px dashed #ccc;font-weight:600;'>"
        f"₹{taxable:,.2f}</td></tr>"
    )
    # Determine the GST rate label dynamically from the line items
    line_rates = {float(it.get("gst_rate") or 0) for it in (order.get("items") or [])}
    if len(line_rates) == 1:
        gst_label = f"GST @ {next(iter(line_rates)):g}% (on taxable value)"
    elif line_rates:
        gst_label = (
            f"GST @ mixed rates ({', '.join(f'{r:g}%' for r in sorted(line_rates))} "
            f"— see line items, on taxable value)"
        )
    else:
        gst_label = "GST (on taxable value)"
    breakdown_rows.append(_row(gst_label, gst_total))
    if cn_disc > 0:
        breakdown_rows.append(_row("Credit Note Applied", cn_disc, "#059669"))
    breakdown_rows.append(
        f"<tr><td style='padding:10px 0;border-top:2px solid #d4af37;color:#1e3a52;font-weight:bold;'>"
        f"Grand Total</td>"
        f"<td style='padding:10px 0;text-align:right;border-top:2px solid #d4af37;color:#1e3a52;font-weight:bold;'>"
        f"₹{grand:,.2f}</td></tr>"
    )
    breakdown_html = "".join(breakdown_rows)

    business_name = (
        retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    )
    payment_method = (order.get("payment_method", "credit") or "credit").upper()

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

                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-top:12px;">
                    <thead>
                        <tr style="background:#f9f7f4;">
                            <th style="padding:10px;text-align:left;">Product</th>
                            <th style="padding:10px;text-align:center;">Qty</th>
                            <th style="padding:10px;text-align:right;">Line Total*</th>
                        </tr>
                    </thead>
                    <tbody>{items_html}</tbody>
                </table>
                <p style="font-size:11px;color:#888;margin:6px 0 0;">
                    *Line total is the box price &times; quantity, with bulk-tier savings already netted in.
                </p>

                <div style="margin-top:18px;padding:14px 16px;background:#f9f7f4;border-radius:6px;">
                    <p style="margin:0 0 8px;color:#1e3a52;font-weight:600;font-size:13px;">
                        Bill computation (GST charged on taxable value, after all discounts)
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        {breakdown_html}
                    </table>
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
