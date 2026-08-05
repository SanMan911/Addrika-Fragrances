"""Retailer Fragrance Rewards statement PDF.

Pure-Python via reportlab. Shows every earn / redeem / adjust / expire
row in the retailer's ledger with a running balance, plus per-kind
totals — a full accountant-friendly statement.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from services.b2b_invoice_pdf import SELLER_INFO

INR = "\u20b9"

_KIND_LABEL = {
    "earn":   "Earned",
    "redeem": "Redeemed",
    "adjust": "Adjustment",
    "expire": "Expired",
}


def _fmt_amount(a: float) -> str:
    a = float(a or 0)
    return f"{INR}{abs(a):,.2f}"


def _fmt_date(iso: Optional[str]) -> str:
    if not iso:
        return ""
    try:
        d = datetime.fromisoformat(iso)
        return d.strftime("%d %b %Y · %H:%M")
    except Exception:
        return iso[:16]


def build_rewards_statement_pdf(retailer: dict, ledger: list[dict]) -> bytes:
    """Build a downloadable statement of Fragrance Rewards ledger entries.

    `retailer` — dict from `db.retailers` (safe-projected, no password_hash).
    `ledger`   — list of `db.rewards_ledger` rows sorted newest-first.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title="Addrika · Fragrance Rewards Statement",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "h1", parent=styles["Heading1"], fontSize=18,
        textColor=colors.HexColor("#1e3a52"), spaceAfter=6,
    )
    h2 = ParagraphStyle(
        "h2", parent=styles["Normal"], fontSize=11,
        textColor=colors.HexColor("#d4af37"), spaceAfter=2,
    )
    body = ParagraphStyle(
        "body", parent=styles["Normal"], fontSize=9,
        textColor=colors.HexColor("#2B3A4A"),
    )
    small = ParagraphStyle(
        "small", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#666"),
    )

    story = []

    # ── Header ─────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph(f"<b>{SELLER_INFO['brand'].upper()}</b>", h1),
            Paragraph(
                f"<b>Fragrance Rewards Statement</b><br/>"
                f"<font size='8' color='#666'>Generated {datetime.now(timezone.utc).strftime('%d %b %Y · %H:%M UTC')}</font>",
                body,
            ),
        ]
    ]
    header = Table(header_data, colWidths=[90 * mm, 90 * mm])
    header.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header)
    story.append(Spacer(1, 4 * mm))

    # ── Retailer block ─────────────────────────────────────────────────
    biz = retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    addr_parts = [
        retailer.get("address_line1") or "",
        retailer.get("city") or "",
        retailer.get("state") or "",
        retailer.get("pincode") or "",
    ]
    addr = ", ".join([p for p in addr_parts if p])
    retailer_block = (
        f"<b>Statement for:</b> {biz}<br/>"
        f"GSTIN: <b>{retailer.get('gst_number') or 'N/A'}</b><br/>"
        f"Retailer ID: {retailer.get('retailer_id') or ''}<br/>"
        f"{addr}<br/>"
        f"Email: {retailer.get('email') or ''} · "
        f"Phone: {retailer.get('phone') or ''}"
    )
    story.append(Paragraph(retailer_block, body))
    story.append(Spacer(1, 4 * mm))

    # ── Totals summary ─────────────────────────────────────────────────
    totals = {"earn": 0.0, "redeem": 0.0, "adjust": 0.0, "expire": 0.0}
    for e in ledger:
        k = (e.get("kind") or "earn").lower()
        amt = float(e.get("amount") or 0)
        if k in totals:
            totals[k] += abs(amt) if k != "adjust" else amt
    balance = totals["earn"] + totals["adjust"] - totals["redeem"] - totals["expire"]

    summary_rows = [
        ["Total Earned", _fmt_amount(totals["earn"])],
        ["Total Redeemed", "-" + _fmt_amount(totals["redeem"])],
        ["Adjustments", _fmt_amount(totals["adjust"]) if totals["adjust"] >= 0 else "-" + _fmt_amount(totals["adjust"])],
        ["Expired", "-" + _fmt_amount(totals["expire"])],
        ["Current Balance", _fmt_amount(balance)],
    ]
    summary = Table(summary_rows, colWidths=[70 * mm, 40 * mm])
    summary.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2B3A4A")),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#eeeeee")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#d4af37")),
        ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#059669")),   # earn = green
        ("TEXTCOLOR", (1, 1), (1, 1), colors.HexColor("#b91c1c")),   # redeem = red
        ("TEXTCOLOR", (1, 3), (1, 3), colors.HexColor("#78350f")),   # expire = brown
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(summary)
    story.append(Spacer(1, 6 * mm))

    # ── Ledger table (running balance) ─────────────────────────────────
    story.append(Paragraph("<b>Ledger — every earn, redeem, adjustment, and expiry</b>", body))
    story.append(Spacer(1, 2 * mm))

    # Build in chronological order (oldest first) so running balance ticks up naturally.
    chronological = list(reversed(ledger))
    running = 0.0
    rows = [["Date", "Type", "Order / Note", "Amount", "Balance"]]
    for e in chronological:
        k = (e.get("kind") or "earn").lower()
        amt = float(e.get("amount") or 0)
        sign = -1 if k in ("redeem", "expire") or (k == "adjust" and amt < 0) else 1
        signed = sign * abs(amt) if k != "adjust" else amt
        running += signed
        ref = e.get("source_order_id") or e.get("note") or ""
        if e.get("multiplier_pct") and k == "earn":
            ref = f"{ref}  ({int(e['multiplier_pct'])}% multiplier)" if ref else f"{int(e['multiplier_pct'])}% multiplier"
        rows.append([
            _fmt_date(e.get("earned_at") or e.get("created_at")),
            _KIND_LABEL.get(k, k.title()),
            ref[:44],
            ("+" if signed > 0 else "-") + _fmt_amount(abs(signed)),
            _fmt_amount(running),
        ])
    if len(rows) == 1:
        rows.append(["—", "—", "No ledger entries yet", "—", _fmt_amount(0)])

    ledger_table = Table(
        rows, colWidths=[32 * mm, 22 * mm, 68 * mm, 25 * mm, 25 * mm],
        repeatRows=1,
    )
    ledger_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a52")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#2B3A4A")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#faf8f4")]),
        ("ALIGN", (3, 0), (4, -1), "RIGHT"),
        ("ALIGN", (0, 0), (2, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#d4af37")),
    ]))
    story.append(ledger_table)
    story.append(Spacer(1, 5 * mm))

    # ── Footer ─────────────────────────────────────────────────────────
    story.append(Paragraph(
        "<i>Fragrance Rewards is Addrika's B2B trade-credit programme. "
        "Credit accrues at 100 / 110 / 125% of the shipping charge on qualifying "
        f"invoices (\u2265 {INR}1,000). Streak resets after 45 days of inactivity. "
        f"Redemption threshold: {INR}2,500 · applies to invoice value only "
        "(shipping + GST are always payable).</i>",
        small,
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"{SELLER_INFO['name']} · GSTIN {SELLER_INFO['gst']} · {SELLER_INFO['email']}",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
