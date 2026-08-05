"""B2B Pre-Order receipt PDF — token acknowledgement + legal terms + signature line.

Design mandate from user (Feb 2026):
    ▸ Focus on "Next Production Batch" — NEVER print a delivery date or ETA.
    ▸ Signature line for the retailer to sign upon delivery — one copy
      retained by the sales person / delivery boy.
    ▸ Full legal block: non-refundable, non-cancellable, no CNs, amend-only-up,
      manufacturing-defect exchange with intact seal, damage-at-delivery-only.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak,
)

from services.b2b_invoice_pdf import SELLER_INFO
from services.b2b_preorder import TERMS_TEXT, TERMS_VERSION

INR = "\u20b9"


def _fmt_amt(a: float) -> str:
    return f"{INR}{float(a or 0):,.2f}"


def build_preorder_receipt_pdf(order: dict, retailer: dict) -> bytes:
    """Emit a downloadable A4 receipt with the pre-order + legal + signature line."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title=f"Addrika · Pre-Order Receipt · {order.get('order_id')}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18,
                        textColor=colors.HexColor("#1e3a52"), spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9,
                          textColor=colors.HexColor("#2B3A4A"), leading=12)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8,
                           textColor=colors.HexColor("#666"), leading=11)
    banner = ParagraphStyle("banner", parent=styles["Normal"], fontSize=11,
                            textColor=colors.HexColor("#78350f"),
                            backColor=colors.HexColor("#FEF3C7"),
                            borderColor=colors.HexColor("#F59E0B"),
                            borderWidth=1, borderPadding=8, leading=14,
                            spaceBefore=4, spaceAfter=4)
    legal_style = ParagraphStyle("legal", parent=styles["Normal"], fontSize=8,
                                 textColor=colors.HexColor("#2B3A4A"),
                                 leading=11.5)

    story = []

    # ── Header ──────────────────────────────────────────────────────────
    header = Table(
        [[
            Paragraph(f"<b>{SELLER_INFO['brand'].upper()}</b><br/>"
                      f"<font size='8' color='#666'>{SELLER_INFO['name']}</font>", h1),
            Paragraph(
                f"<b>PRE-ORDER RECEIPT</b><br/>"
                f"<font size='9' color='#666'>Order # <b>{order.get('order_id')}</b></font><br/>"
                f"<font size='8' color='#888'>Issued {datetime.now(timezone.utc).strftime('%d %b %Y · %H:%M UTC')}</font>",
                body,
            ),
        ]],
        colWidths=[95 * mm, 85 * mm],
    )
    header.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(header)
    story.append(Spacer(1, 3 * mm))

    # ── Next Production Batch banner (per user: emphasise batch, NOT timeline) ─
    story.append(Paragraph(
        "<b>Priority slot confirmed against the Next Production Batch.</b> "
        "This Pre-Order will be prioritized when the next production batch is "
        "completely manufactured. Our team will reach out via WhatsApp/email once "
        "your allocation is ready for dispatch.",
        banner,
    ))
    story.append(Spacer(1, 2 * mm))

    # ── Retailer + payment block ────────────────────────────────────────
    biz = retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    addr = ", ".join(filter(None, [
        retailer.get("address_line1"), retailer.get("city"),
        retailer.get("state"), retailer.get("pincode"),
    ]))
    grand = float(order.get("grand_total") or 0)
    token = float(order.get("token_amount_inr") or 0)
    balance_due = round(grand - token, 2)

    party_block = Table(
        [[
            Paragraph(
                f"<b>Retailer</b><br/>{biz}<br/>"
                f"GSTIN: <b>{retailer.get('gst_number') or 'N/A'}</b><br/>"
                f"{addr}<br/>"
                f"{retailer.get('email') or ''} · {retailer.get('phone') or ''}",
                body,
            ),
            Paragraph(
                f"<b>Payment</b><br/>"
                f"Order Value: <b>{_fmt_amt(grand)}</b><br/>"
                f"<font color='#059669'>Token Paid (50%): <b>{_fmt_amt(token)}</b></font><br/>"
                f"<font color='#b91c1c'>Balance Payable on Delivery: <b>{_fmt_amt(balance_due)}</b></font><br/>"
                f"Payment ref: {order.get('razorpay_payment_id') or order.get('payment_reference') or 'N/A'}",
                body,
            ),
        ]],
        colWidths=[95 * mm, 85 * mm],
    )
    party_block.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#f3f4f6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(party_block)
    story.append(Spacer(1, 5 * mm))

    # ── Items table ─────────────────────────────────────────────────────
    story.append(Paragraph("<b>Pre-Ordered Items</b>", body))
    story.append(Spacer(1, 2 * mm))
    rows = [["Product", "Weight", "Qty", "Rate", "Amount"]]
    for it in order.get("items", []):
        rows.append([
            it.get("name") or it.get("product_id") or "",
            it.get("net_weight") or "",
            f"{it.get('quantity_boxes', 0)} × {it.get('unit_label', 'carton')}",
            _fmt_amt(it.get("price_per_box") or it.get("unit_price") or 0),
            _fmt_amt(it.get("line_total") or 0),
        ])
    items = Table(rows, colWidths=[70 * mm, 22 * mm, 32 * mm, 28 * mm, 28 * mm],
                  repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a52")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#faf8f4")]),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#d4af37")),
    ]))
    story.append(items)
    story.append(Spacer(1, 6 * mm))

    # ── Legal terms block ───────────────────────────────────────────────
    story.append(Paragraph("<b>Terms of this Pre-Order</b>", body))
    story.append(Spacer(1, 1.5 * mm))
    for line in TERMS_TEXT.split("\n"):
        story.append(Paragraph(line, legal_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"<i>Terms version: {TERMS_VERSION} · Accepted at "
        f"{order.get('terms_accepted_at') or 'time of token payment'}</i>",
        small,
    ))
    story.append(Spacer(1, 8 * mm))

    # ── Signature block — retailer signs on delivery, hands the receipt back ─
    sig_left = Paragraph(
        "<b>Acknowledgement by Retailer</b><br/>"
        "<font size='7' color='#666'>To be signed at the time of delivery. "
        "Signature below confirms receipt of goods and closes this Pre-Order per the terms overleaf.</font>",
        small,
    )
    sig_lines = Table(
        [
            [Paragraph("<b>Signature</b>", body), Paragraph("<b>Date</b>", body)],
            ["", ""],
            [Paragraph("<font size='7' color='#888'>Retailer / Authorised Signatory</font>", small),
             Paragraph("<font size='7' color='#888'>DD / MM / YYYY</font>", small)],
        ],
        colWidths=[95 * mm, 45 * mm], rowHeights=[6 * mm, 16 * mm, 5 * mm],
    )
    sig_lines.setStyle(TableStyle([
        ("LINEBELOW", (0, 1), (0, 1), 0.5, colors.HexColor("#2B3A4A")),
        ("LINEBELOW", (1, 1), (1, 1), 0.5, colors.HexColor("#2B3A4A")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_left)
    story.append(Spacer(1, 3 * mm))
    story.append(sig_lines)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f"<b>Received By (Sales Rep / Delivery):</b> ___________________  "
        f"<b>Stamp:</b> ___________________",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
