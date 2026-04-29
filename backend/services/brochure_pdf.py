"""
Generates a professional, share-ready tri-fold brochure PDF for Addrika.

Layout:
  - Page size: A4 landscape (297 x 210 mm) — letter-fold tri-fold.
  - Page 1 (OUTSIDE, when folded shut): [Inner-Flap | Back-Cover | Front-Cover]
      Front cover sits on the right so it's visible when folded.
  - Page 2 (INSIDE, when opened): [Panel A | Panel B | Panel C]
      Distributes products across 3 panels.

The PDF is rendered with reportlab (already a dependency). Product images
are downloaded once on first generation and cached on disk for re-use.
"""
from __future__ import annotations

import io
import os
import textwrap
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ----- Brand & Company -----
COMPANY_NAME = os.environ.get("SELLER_NAME", "Centsibl Traders Private Limited")
BRAND_NAME = os.environ.get("SELLER_BRAND", "Addrika")
TAGLINE = "Elegance in Every Scent"
COMPANY_CIN = "U46491DL2022PTC392334"
COMPANY_ADDRESS = os.environ.get(
    "SELLER_ADDRESS",
    "H-1/5, Sector 16, Rohini, Delhi - 110089, India",
)
COMPANY_EMAIL = os.environ.get("SELLER_EMAIL", "contact.us@centraders.com")
COMPANY_PHONE = os.environ.get("SELLER_PHONE", "+91 96672 69711")
COMPANY_WEBSITE = "centraders.com"
INSTAGRAM = "@addrika.fragrances"

# ----- Colours (brand palette) -----
DEEP_BLUE = colors.HexColor("#0f1419")
INK_BLUE = colors.HexColor("#1a2332")
GOLD = colors.HexColor("#D4AF37")
GOLD_DARK = colors.HexColor("#a8842b")
CREAM = colors.HexColor("#f6efdc")
SOFT_GREY = colors.HexColor("#a3a3a3")
WHITE = colors.white

# ----- Geometry (in points) -----
MM = 2.83464567
PAGE_W, PAGE_H = landscape(A4)  # 842 x 595 pt
PANEL_W = PAGE_W / 3.0
MARGIN = 12 * MM
INNER_PAD = 6 * MM

# ----- Image cache -----
_CACHE_DIR = Path("/tmp/addrika_brochure_cache")
_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_image(url: str) -> Optional[Path]:
    """Download once and cache a small JPEG suitable for the brochure (≤300px)."""
    if not url:
        return None
    safe = "".join(c if c.isalnum() else "_" for c in url)[-180:]
    path = _CACHE_DIR / f"{safe}.jpg"
    if path.exists() and path.stat().st_size > 0:
        return path
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(url)
            if r.status_code != 200 or not r.content:
                return None
            try:
                img = Image.open(io.BytesIO(r.content))
                if img.mode in ("RGBA", "LA", "P"):
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[-1] if img.mode != "P" else None)
                    img = bg
                else:
                    img = img.convert("RGB")
                img.thumbnail((360, 360), Image.LANCZOS)
                img.save(path, "JPEG", quality=78, optimize=True)
                return path
            except Exception:
                # If Pillow can't decode it, store raw bytes as fallback.
                path.write_bytes(r.content)
                return path
    except Exception:
        pass
    return None


# ----- Drawing helpers -----
def _panel_x(index: int) -> float:
    """Left x of panel index (0,1,2)."""
    return index * PANEL_W


def _draw_panel_bg(c: canvas.Canvas, x: float, fill, *, with_borders: bool = True):
    c.setFillColor(fill)
    c.rect(x, 0, PANEL_W, PAGE_H, stroke=0, fill=1)
    if with_borders:
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.5)
        # subtle gold gutter line
        if x > 0.1:
            c.line(x, 8 * MM, x, PAGE_H - 8 * MM)


def _draw_centered_text(c, text, x_center, y, font, size, color):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(x_center, y, text)


def _wrap_text(text: str, width_chars: int) -> list[str]:
    return textwrap.wrap(text or "", width=width_chars)


def _draw_paragraph(
    c, text, x, y, *, max_width, font="Helvetica", size=9, color=WHITE,
    leading=12, max_lines=12,
):
    """Word-wrap and draw, returns final y."""
    c.setFont(font, size)
    c.setFillColor(color)
    # crude char width estimate
    avg_char = size * 0.52
    width_chars = max(8, int(max_width / avg_char))
    lines = _wrap_text(text, width_chars)[:max_lines]
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def _draw_image_fit(c, img_path: Path, x, y, w, h):
    try:
        img = ImageReader(str(img_path))
        iw, ih = img.getSize()
        if iw <= 0 or ih <= 0:
            return
        scale = min(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        dx = x + (w - dw) / 2
        dy = y + (h - dh) / 2
        c.drawImage(
            img, dx, dy, width=dw, height=dh,
            preserveAspectRatio=True, mask="auto",
        )
    except Exception:
        # quietly skip broken images
        pass


def _draw_gold_divider(c, x_center, y, width=70):
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.4)
    c.line(x_center - width / 2, y, x_center + width / 2, y)
    c.setFillColor(GOLD)
    # diamond accent
    c.circle(x_center, y, 1.6, stroke=0, fill=1)


# ----- Panels -----
def _draw_front_cover(c: canvas.Canvas, x: float):
    """Right panel of OUTSIDE page — what people see when folded."""
    _draw_panel_bg(c, x, DEEP_BLUE, with_borders=False)

    # Faint radial gold glow (using overlapping translucent rects)
    c.saveState()
    c.setFillColorRGB(0.83, 0.69, 0.22, alpha=0.08)
    for r in range(180, 40, -25):
        c.circle(x + PANEL_W / 2, PAGE_H * 0.62, r, stroke=0, fill=1)
    c.restoreState()

    cx = x + PANEL_W / 2

    # Top tag
    _draw_centered_text(c, "PREMIUM NATURAL INCENSE", cx, PAGE_H - 28 * MM,
                        "Helvetica-Bold", 8, GOLD)

    # Brand
    _draw_centered_text(c, BRAND_NAME.upper(), cx, PAGE_H - 60 * MM,
                        "Helvetica-Bold", 44, WHITE)
    _draw_gold_divider(c, cx, PAGE_H - 70 * MM, width=80)
    _draw_centered_text(c, TAGLINE, cx, PAGE_H - 82 * MM,
                        "Helvetica-Oblique", 12, CREAM)

    # Manifesto
    body = (
        "Hand-crafted in Delhi, born of ancient Indian ritual and a refusal to "
        "settle for charcoal smoke. Twelve fragrances. Zero shortcuts. Just "
        "pure, lingering elegance for your home, your meditation, and every "
        "quiet moment in between."
    )
    _draw_paragraph(c, body, x + INNER_PAD, PAGE_H - 105 * MM,
                    max_width=PANEL_W - 2 * INNER_PAD, font="Helvetica",
                    size=9.5, color=CREAM, leading=13.5, max_lines=8)

    # Bottom call-out
    _draw_centered_text(c, "ZERO CHARCOAL  •  100% NATURAL  •  HAND-ROLLED",
                        cx, 28 * MM, "Helvetica-Bold", 8, GOLD)
    _draw_centered_text(c, "centraders.com", cx, 18 * MM,
                        "Helvetica-Bold", 11, WHITE)
    _draw_centered_text(c, COMPANY_NAME, cx, 11 * MM,
                        "Helvetica", 7.5, SOFT_GREY)


def _draw_back_cover(c: canvas.Canvas, x: float):
    """Middle panel of OUTSIDE page — back of the brochure."""
    _draw_panel_bg(c, x, INK_BLUE, with_borders=True)
    cx = x + PANEL_W / 2

    # Header
    _draw_centered_text(c, "GET IN TOUCH", cx, PAGE_H - 28 * MM,
                        "Helvetica-Bold", 11, GOLD)
    _draw_gold_divider(c, cx, PAGE_H - 33 * MM, width=60)

    # Contact block
    contact_lines = [
        ("Brand", BRAND_NAME),
        ("Manufactured & Marketed by", COMPANY_NAME),
        ("Email", COMPANY_EMAIL),
        ("Phone / WhatsApp", COMPANY_PHONE),
        ("Website", COMPANY_WEBSITE),
        ("Instagram", INSTAGRAM),
    ]
    y = PAGE_H - 50 * MM
    for label, value in contact_lines:
        c.setFont("Helvetica", 7.5)
        c.setFillColor(SOFT_GREY)
        c.drawString(x + INNER_PAD, y, label.upper())
        y -= 9
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(WHITE)
        c.drawString(x + INNER_PAD, y, value)
        y -= 14

    # Address
    y -= 4
    c.setFont("Helvetica", 7.5)
    c.setFillColor(SOFT_GREY)
    c.drawString(x + INNER_PAD, y, "REGISTERED ADDRESS")
    y -= 10
    y = _draw_paragraph(
        c, COMPANY_ADDRESS, x + INNER_PAD, y,
        max_width=PANEL_W - 2 * INNER_PAD,
        font="Helvetica-Bold", size=9.5, color=WHITE, leading=12, max_lines=3,
    )
    y -= 4
    c.setFont("Helvetica", 7)
    c.setFillColor(SOFT_GREY)
    c.drawString(x + INNER_PAD, y, f"CIN: {COMPANY_CIN}")

    # B2B box
    box_h = 32 * MM
    box_y = 28 * MM
    c.setFillColor(colors.HexColor("#22324a"))
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.roundRect(x + INNER_PAD, box_y, PANEL_W - 2 * INNER_PAD, box_h,
                4, stroke=1, fill=1)
    _draw_centered_text(c, "RETAILER & WHOLESALE", cx, box_y + box_h - 9 * MM,
                        "Helvetica-Bold", 9, GOLD)
    _draw_paragraph(
        c,
        "Become an authorised Addrika partner. GST-verified onboarding, "
        "transparent margins, dedicated SPOC. Visit centraders.com/find-retailers",
        x + INNER_PAD + 4, box_y + box_h - 14 * MM,
        max_width=PANEL_W - 2 * INNER_PAD - 8,
        font="Helvetica", size=8, color=CREAM, leading=10.5, max_lines=4,
    )

    # Footer line
    _draw_centered_text(c, f"© {COMPANY_NAME}", cx, 8 * MM,
                        "Helvetica", 7, SOFT_GREY)


def _draw_inner_flap(c: canvas.Canvas, x: float):
    """Left panel of OUTSIDE page — the flap that folds inward first.
    Contains the brand story (visible when the brochure is opened first time).
    """
    _draw_panel_bg(c, x, CREAM, with_borders=False)
    cx = x + PANEL_W / 2

    _draw_centered_text(c, "OUR STORY", cx, PAGE_H - 28 * MM,
                        "Helvetica-Bold", 11, GOLD_DARK)
    _draw_gold_divider(c, cx, PAGE_H - 33 * MM, width=60)

    _draw_centered_text(c, "Built on a refusal", cx, PAGE_H - 46 * MM,
                        "Helvetica-Bold", 14, INK_BLUE)
    _draw_centered_text(c, "to settle for ordinary.", cx, PAGE_H - 53 * MM,
                        "Helvetica-Bold", 14, INK_BLUE)

    body = (
        "Addrika was born when a third-generation incense family looked at "
        "the modern agarbatti — choked with charcoal, perfumed with cheap "
        "synthetics — and decided enough was enough.\n\n"
        "Every stick is hand-rolled in our Delhi workshop using 100% natural "
        "halmaddi paste, slow-distilled essential oils, and zero charcoal. "
        "The result: a clean, lingering scent that doesn't fight your home — "
        "it elevates it.\n\n"
        "Twelve signature fragrances. One promise: elegance in every scent."
    )
    y = PAGE_H - 70 * MM
    paragraphs = body.split("\n\n")
    for para in paragraphs:
        y = _draw_paragraph(
            c, para, x + INNER_PAD, y,
            max_width=PANEL_W - 2 * INNER_PAD,
            font="Helvetica", size=9.5, color=INK_BLUE, leading=13, max_lines=10,
        )
        y -= 6

    # Why-us pills
    pills = [
        "ZERO CHARCOAL", "100% NATURAL", "HAND-ROLLED",
        "GST-COMPLIANT", "PAN-INDIA SHIPPING",
    ]
    py = 30 * MM
    px = x + INNER_PAD
    c.setFont("Helvetica-Bold", 7.5)
    for pill in pills:
        text_w = c.stringWidth(pill, "Helvetica-Bold", 7.5)
        pad = 5
        pw = text_w + 2 * pad
        if px + pw > x + PANEL_W - INNER_PAD:
            px = x + INNER_PAD
            py -= 12
        c.setFillColor(GOLD)
        c.roundRect(px, py - 3, pw, 11, 5, stroke=0, fill=1)
        c.setFillColor(INK_BLUE)
        c.drawString(px + pad, py, pill)
        px += pw + 4

    _draw_centered_text(c, "Turn over for our full collection →", cx, 14 * MM,
                        "Helvetica-Oblique", 8.5, GOLD_DARK)


def _draw_product_card(c, x, y, w, h, product):
    """Single product card on inside panels."""
    # Card frame
    c.setFillColor(colors.HexColor("#f9f5e8"))
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, 3, stroke=1, fill=1)

    # Image (square thumbnail on left)
    img_size = h - 8
    img_x = x + 4
    img_y = y + 4
    img_url = product.get("image") or ""
    img_path = _cache_image(img_url)
    if img_path:
        # subtle bg
        c.setFillColor(WHITE)
        c.roundRect(img_x, img_y, img_size, img_size, 2, stroke=0, fill=1)
        _draw_image_fit(c, img_path, img_x + 2, img_y + 2, img_size - 4, img_size - 4)
    else:
        c.setFillColor(INK_BLUE)
        c.roundRect(img_x, img_y, img_size, img_size, 2, stroke=0, fill=1)
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(
            img_x + img_size / 2, img_y + img_size / 2 - 6,
            (product.get("name") or "?")[:1].upper(),
        )

    # Text block to the right of image
    tx = img_x + img_size + 6
    tw = w - (tx - x) - 6
    ty = y + h - 12

    # Name
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(INK_BLUE)
    name = (product.get("name") or "").strip()
    c.drawString(tx, ty, name[:28])
    ty -= 11

    # Tagline / fragrance notes
    tagline = product.get("tagline") or ""
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(GOLD_DARK)
    c.drawString(tx, ty, tagline[:36])
    ty -= 9

    # Description (truncated)
    desc = (product.get("description") or "").strip()
    desc_short = desc.split(".")[0] + ("." if "." in desc else "")
    if len(desc_short) > 145:
        desc_short = desc_short[:142].rstrip() + "…"
    _draw_paragraph(
        c, desc_short, tx, ty,
        max_width=tw, font="Helvetica", size=7.5,
        color=INK_BLUE, leading=9.5, max_lines=4,
    )

    # Sizes / price line at bottom of card
    sizes = product.get("sizes") or []
    if sizes:
        size_strs = []
        for s in sizes[:3]:
            sz = s.get("size", "")
            pr = s.get("price") or s.get("mrp") or 0
            try:
                size_strs.append(f"{sz} · \u20b9{int(pr)}")
            except Exception:
                size_strs.append(str(sz))
        line = "   ".join(size_strs)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(GOLD_DARK)
        c.drawString(tx, y + 5, line)


def _draw_inside_panel(c, x, header, products, panel_index):
    """Render one of three panels on the inside spread."""
    bg = WHITE if panel_index % 2 == 0 else colors.HexColor("#fbf7eb")
    _draw_panel_bg(c, x, bg, with_borders=True)
    cx = x + PANEL_W / 2

    _draw_centered_text(c, header.upper(), cx, PAGE_H - 18 * MM,
                        "Helvetica-Bold", 10, GOLD_DARK)
    _draw_gold_divider(c, cx, PAGE_H - 22 * MM, width=50)

    # Card grid: 1 per row, multiple rows.
    card_w = PANEL_W - 2 * INNER_PAD
    card_h = 36 * MM
    card_gap = 4 * MM
    top_y = PAGE_H - 27 * MM

    available = top_y - 14 * MM
    max_cards = max(1, int(available / (card_h + card_gap)))
    products = products[:max_cards]

    cy = top_y - card_h
    for p in products:
        _draw_product_card(c, x + INNER_PAD, cy, card_w, card_h, p)
        cy -= card_h + card_gap

    # Footer
    _draw_centered_text(c, f"{BRAND_NAME.upper()} · {COMPANY_WEBSITE}",
                        cx, 8 * MM, "Helvetica-Bold", 7.5, GOLD_DARK)


# ----- Public API -----
def build_brochure_pdf(products: list[dict]) -> bytes:
    """Generate the tri-fold brochure PDF and return its bytes.

    `products` should be a list of dicts with keys: name, tagline,
    description, image, sizes (list of {size, price/mrp}).
    """
    # Filter only active, non-coming-soon, public products.
    products = [
        p for p in products
        if p.get("isActive", True) and not p.get("comingSoon", False)
    ]

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    c.setTitle(f"{BRAND_NAME} — Product Brochure")
    c.setAuthor(COMPANY_NAME)
    c.setSubject(f"{BRAND_NAME} premium natural incense — full product catalogue")
    c.setCreator(f"{BRAND_NAME} brochure generator")

    # ---- Page 1: OUTSIDE  [Inner-Flap | Back-Cover | Front-Cover] ----
    _draw_inner_flap(c, _panel_x(0))
    _draw_back_cover(c, _panel_x(1))
    _draw_front_cover(c, _panel_x(2))
    c.showPage()

    # ---- Page 2: INSIDE  [Panel A | Panel B | Panel C]  ----
    # Distribute products evenly across three panels.
    n = len(products)
    if n == 0:
        third = []
        a, b, p3 = [], [], []
    else:
        third = max(1, (n + 2) // 3)
        a = products[:third]
        b = products[third:2 * third]
        p3 = products[2 * third:]

    _draw_inside_panel(c, _panel_x(0), "Signature Agarbattis", a, 0)
    _draw_inside_panel(c, _panel_x(1), "Premium Range", b, 1)
    _draw_inside_panel(c, _panel_x(2), "Dhoop & Specialities", p3, 2)
    c.showPage()

    c.save()
    return buf.getvalue()
