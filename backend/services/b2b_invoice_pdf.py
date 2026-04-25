"""
Server-side PDF generation for B2B GST tax invoices.

Pure-Python via reportlab — no external service.

The invoice reflects Indian GST rules:
- GST split as CGST+SGST when buyer & seller are in the same state,
  IGST otherwise. Seller state is hard-coded from SELLER_INFO (can be
  overridden with env).
- Taxable value = line total AFTER all discounts (tier + loyalty + voucher
  + cash), matching the order document's `taxable_value` / per-line
  `taxable_value` fields.
- Credit note (if any) is shown as a post-GST financial credit.
"""
from __future__ import annotations

import io
import os
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


SELLER_INFO = {
    "name": os.environ.get("SELLER_NAME", "Centsibl Traders"),
    "brand": os.environ.get("SELLER_BRAND", "Addrika"),
    "address": os.environ.get(
        "SELLER_ADDRESS",
        "H-1/5, Sector 16, Rohini, Delhi - 110089, India",
    ),
    "state": os.environ.get("SELLER_STATE", "Delhi"),
    "gst": os.environ.get("SELLER_GSTIN", "07XXXXXXXXX1Z1"),
    "email": os.environ.get("SELLER_EMAIL", "contact.us@centraders.com"),
    "phone": os.environ.get("SELLER_PHONE", "+91 96672 69711"),
}

INR = "\u20b9"  # ₹


def _state_from_gstin(gstin: Optional[str]) -> Optional[str]:
    """First two digits of GSTIN encode state code. Return the code or None."""
    if not gstin or len(gstin) < 2 or not gstin[:2].isdigit():
        return None
    return gstin[:2]


def _is_intra_state(seller_gst: str, buyer_gst: Optional[str]) -> bool:
    s = _state_from_gstin(seller_gst)
    b = _state_from_gstin(buyer_gst)
    if not s or not b:
        # If buyer has no GSTIN or seller GSTIN is placeholder, default intra-state
        return True
    return s == b


def _fmt(v: float) -> str:
    return f"{INR}{float(v or 0):,.2f}"


def build_invoice_pdf(order: dict, retailer: dict) -> bytes:
    """Build a PDF byte-string for a B2B tax invoice."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Tax Invoice {order.get('order_id')}",
    )
    styles = getSampleStyleSheet()
    h_center = ParagraphStyle(
        "h_center", parent=styles["Heading2"], alignment=1, textColor=colors.HexColor("#1e3a52")
    )
    small = ParagraphStyle(
        "small", parent=styles["Normal"], fontSize=8, leading=10, textColor=colors.HexColor("#444")
    )

    seller_gst = SELLER_INFO["gst"]
    buyer_gst = (retailer.get("gst_number") or "").upper()
    intra = _is_intra_state(seller_gst, buyer_gst)

    story: list = []

    # ------------------------------------------------------------------
    # Header
    # ------------------------------------------------------------------
    story.append(Paragraph(f"<b>{SELLER_INFO['brand'].upper()}</b> · TAX INVOICE", h_center))
    story.append(Spacer(1, 4))
    seller_block = (
        f"<b>{SELLER_INFO['name']}</b><br/>"
        f"{SELLER_INFO['address']}<br/>"
        f"GSTIN: {SELLER_INFO['gst']} &nbsp;·&nbsp; State: {SELLER_INFO['state']}<br/>"
        f"Email: {SELLER_INFO['email']} &nbsp;·&nbsp; {SELLER_INFO['phone']}"
    )
    meta_block = (
        f"<b>Invoice No:</b> {order.get('order_id')}<br/>"
        f"<b>Invoice Date:</b> {(order.get('created_at') or '')[:10]}<br/>"
        f"<b>Payment:</b> {(order.get('payment_method') or 'credit').upper()} · "
        f"{(order.get('payment_status') or 'pending').upper()}<br/>"
        f"<b>Place of Supply:</b> {retailer.get('state') or '—'}"
    )
    header = Table(
        [[Paragraph(seller_block, small), Paragraph(meta_block, small)]],
        colWidths=[105 * mm, 70 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))

    # ------------------------------------------------------------------
    # Billed To
    # ------------------------------------------------------------------
    bill_to = retailer.get("business_name") or retailer.get("trade_name") or retailer.get("name") or "—"
    addr = order.get("billing_address") or {}
    buyer_block = (
        f"<b>Billed To:</b> {bill_to}<br/>"
        f"{addr.get('address') or retailer.get('address') or ''}<br/>"
        f"{addr.get('city') or retailer.get('city') or ''}, "
        f"{addr.get('state') or retailer.get('state') or ''} "
        f"{addr.get('pincode') or retailer.get('pincode') or ''}<br/>"
        f"GSTIN: {buyer_gst or 'Unregistered'}<br/>"
        f"Email: {retailer.get('email') or '—'} · Phone: {retailer.get('phone') or '—'}"
    )
    story.append(
        Table(
            [[Paragraph(buyer_block, small)]],
            colWidths=[175 * mm],
            style=TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        )
    )
    story.append(Spacer(1, 8))

    # ------------------------------------------------------------------
    # Items table
    # ------------------------------------------------------------------
    if intra:
        header_cells = [
            "#", "Description", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total",
        ]
        col_widths = [8, 50, 18, 14, 20, 22, 14, 14, 22]
    else:
        header_cells = ["#", "Description", "HSN", "Qty", "Rate", "Taxable", "IGST", "Total"]
        col_widths = [8, 60, 20, 14, 22, 24, 18, 22]

    rows = [header_cells]
    subtotal_sum = 0.0
    taxable_sum = 0.0
    cgst_sum = 0.0
    sgst_sum = 0.0
    igst_sum = 0.0
    for idx, it in enumerate(order.get("items") or [], start=1):
        qty = float(it.get("quantity_boxes") or 0)
        rate = float(it.get("price_per_box") or 0)
        # Prefer stored per-line taxable value; fall back to line_total.
        taxable = float(
            it.get("taxable_value")
            if it.get("taxable_value") is not None
            else it.get("line_total") or 0
        )
        gst_rate = float(it.get("gst_rate") or 0)
        gst_amt = round(taxable * gst_rate / 100, 2)
        if intra:
            half = round(gst_amt / 2, 2)
            cgst_sum += half
            sgst_sum += gst_amt - half
            line_cells = [
                str(idx),
                Paragraph(
                    f"<b>{it.get('name', '')}</b> ({it.get('net_weight', '')})",
                    small,
                ),
                it.get("hsn_code") or "",
                f"{qty}",
                _fmt(rate),
                _fmt(taxable),
                _fmt(half),
                _fmt(gst_amt - half),
                _fmt(round(taxable + gst_amt, 2)),
            ]
        else:
            igst_sum += gst_amt
            line_cells = [
                str(idx),
                Paragraph(
                    f"<b>{it.get('name', '')}</b> ({it.get('net_weight', '')})",
                    small,
                ),
                it.get("hsn_code") or "",
                f"{qty}",
                _fmt(rate),
                _fmt(taxable),
                _fmt(gst_amt),
                _fmt(round(taxable + gst_amt, 2)),
            ]
        rows.append(line_cells)
        subtotal_sum += float(it.get("line_total_base") or it.get("line_total") or 0)
        taxable_sum += taxable

    tbl = Table(rows, colWidths=[w * mm for w in col_widths], repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a52")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (2, 1), (2, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 8))

    # ------------------------------------------------------------------
    # Totals / breakdown
    # ------------------------------------------------------------------
    breakdown = []
    breakdown.append(["Subtotal (after bulk-tier savings)", _fmt(order.get("subtotal"))])
    if (order.get("tier_discount_total") or 0) > 0:
        breakdown.append(
            ["  (Bulk-tier savings applied per line)", f"-{_fmt(order.get('tier_discount_total'))}"]
        )
    if (order.get("loyalty_discount") or 0) > 0:
        breakdown.append(
            [f"Loyalty Bonus Discount ({order.get('loyalty_discount_percent') or 0}%)",
             f"-{_fmt(order.get('loyalty_discount'))}"]
        )
    if (order.get("voucher_discount") or 0) > 0:
        breakdown.append(
            [f"Voucher ({order.get('voucher_code') or ''})",
             f"-{_fmt(order.get('voucher_discount'))}"]
        )
    if (order.get("cash_discount") or 0) > 0:
        breakdown.append(
            [f"Online Payment Discount ({order.get('cash_discount_percent') or 0}%)",
             f"-{_fmt(order.get('cash_discount'))}"]
        )
    breakdown.append(["Taxable Value", _fmt(order.get("taxable_value") or taxable_sum)])
    if intra:
        breakdown.append(["CGST", _fmt(cgst_sum)])
        breakdown.append(["SGST", _fmt(sgst_sum)])
    else:
        breakdown.append(["IGST", _fmt(igst_sum)])
    if (order.get("credit_note_discount") or 0) > 0:
        breakdown.append(
            [f"Credit Note ({order.get('credit_note_code') or ''})",
             f"-{_fmt(order.get('credit_note_discount'))}"]
        )
    breakdown.append(["Grand Total", _fmt(order.get("grand_total"))])

    br = Table(breakdown, colWidths=[120 * mm, 55 * mm])
    style_cmds = [
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, -2), (-1, -2), 0.4, colors.HexColor("#d4af37")),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#d4af37")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#1e3a52")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    br.setStyle(TableStyle(style_cmds))
    story.append(br)
    story.append(Spacer(1, 12))

    footer_note = (
        "This is a system-generated tax invoice. GST is calculated on the "
        "taxable value (subtotal less tier / loyalty / voucher / cash "
        "discounts), as permitted under Indian GST law. Any credit note "
        "shown is a post-supply financial credit applied against the "
        "grand total."
    )
    story.append(Paragraph(footer_note, small))
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            f"<i>For {SELLER_INFO['name']}</i> &nbsp; · &nbsp; "
            f"Authorised Signatory &nbsp; · &nbsp; "
            f"Questions: {SELLER_INFO['email']}",
            small,
        )
    )

    doc.build(story)
    return buf.getvalue()
