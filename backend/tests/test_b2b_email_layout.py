"""
Email layout regression: ensures admin notification clearly shows
discount lines BEFORE the GST line, with an explicit Taxable Value row.
"""
import sys
import types
import asyncio


def test_admin_email_shows_discount_before_gst(tmp_path):
    captured = {}

    async def fake_send(to_email, subject, html_content):
        captured["html"] = html_content
        captured["subject"] = subject

    fake = types.ModuleType("services.email_service")
    fake.send_email = fake_send
    sys.modules["services.email_service"] = fake

    from services.b2b_emails import send_b2b_admin_notification_email

    order = {
        "order_id": "B2B-TEST-EMAIL",
        "created_at": "2026-04-24T20:00:00+00:00",
        "items": [
            {
                "name": "Kesar Chandan",
                "net_weight": "50g",
                "quantity_boxes": 10,
                "line_total": 10100,
                "gst_rate": 18,
                "hsn_code": "33074900",
            }
        ],
        "subtotal": 10100,
        "tier_discount_total": 0,
        "loyalty_discount": 50.5,
        "voucher_discount": 0,
        "cash_discount": 150.74,
        "credit_note_discount": 0,
        "taxable_value": 9898.76,
        "gst_total": 1781.78,
        "grand_total": 11680.54,
        "payment_method": "online",
        "payment_status": "paid",
        "cash_discount_percent": 1.5,
    }
    retailer = {
        "business_name": "Pytest Retailer",
        "gst_number": "27ABCDE1234F1Z5",
        "email": "t@x.com",
        "phone": "+919999999999",
    }
    asyncio.run(send_b2b_admin_notification_email(order, retailer))
    html = captured["html"]
    p_subtotal = html.find("Subtotal")
    p_loyalty = html.find("Loyalty Bonus")
    p_online = html.find("Online Payment Discount")
    p_taxable = html.find("Taxable Value")
    p_gst = html.find("GST @ 18%")
    p_total = html.find("Grand Total")
    # All present and in the correct order
    for tag, pos in [
        ("Subtotal", p_subtotal),
        ("Loyalty", p_loyalty),
        ("Online", p_online),
        ("Taxable", p_taxable),
        ("GST", p_gst),
        ("Grand Total", p_total),
    ]:
        assert pos > 0, f"missing {tag}"
    assert p_subtotal < p_loyalty < p_online < p_taxable < p_gst < p_total
