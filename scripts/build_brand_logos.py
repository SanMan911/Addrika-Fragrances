#!/usr/bin/env python3
"""Build every AAROHMM logo variant + PWA icons + OG image from ONE source file.

Usage:
    python3 scripts/build_brand_logos.py [path/to/source.webp|png]

Re-run this whenever a sharper master logo arrives — every derived asset
listed in frontend-next/public/images/logos/LOGO_INDEX.md is regenerated.
The source must be a transparent-background lockup laid out vertically:
emblem → ® → wordmark → divider → tagline (same as mobile/assets/aarohmm-src.webp).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "mobile/assets/aarohmm-src.webp"
LOGOS = ROOT / "frontend-next/public/images/logos"
PWA = ROOT / "frontend-next/public/images/pwa-icons"
DARK_BG = (15, 20, 25, 255)  # #0f1419


def trim(im: Image.Image, pad: int = 0) -> Image.Image:
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 20)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, im.width), min(ys.max() + pad + 1, im.height))
    return im.crop(box)


def bands(im: Image.Image) -> list[tuple[int, int]]:
    """Horizontal content bands (start,end) separated by fully-transparent rows."""
    rows = (np.array(im)[:, :, 3] > 20).sum(axis=1)
    out, start = [], None
    for y, v in enumerate(rows):
        if v and start is None:
            start = y
        elif not v and start is not None:
            out.append((start, y))
            start = None
    if start is not None:
        out.append((start, im.height))
    return out


def crop_rows(im: Image.Image, y0: int, y1: int) -> Image.Image:
    return trim(im.crop((0, y0, im.width, y1)))


def square(im: Image.Image, pad_ratio: float = 0.08) -> Image.Image:
    side = int(max(im.size) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} {im.size}")


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    b = bands(src)
    if len(b) < 5:
        sys.exit(f"Expected ≥5 vertical bands in source (emblem/®/wordmark/divider/tagline); got {b}")

    # Band roles (top→bottom). The ® sits as its own small band right above the wordmark.
    emblem_band = b[0]
    wordmark_idx = max(range(len(b)), key=lambda i: (b[i][1] - b[i][0]) * (i > 0))  # tallest band after emblem
    reg_band = b[wordmark_idx - 1] if wordmark_idx >= 2 else None
    wordmark_band = b[wordmark_idx]
    tagline_band = b[-1]

    # Emblem: everything above the ® (includes the small dot under the circle)
    emblem_end = reg_band[0] if reg_band else wordmark_band[0]
    emblem = crop_rows(src, emblem_band[0], emblem_end)
    wordmark = crop_rows(src, (reg_band[0] if reg_band else wordmark_band[0]), wordmark_band[1])
    full = trim(src)
    lockup = crop_rows(src, emblem_band[0], wordmark_band[1])
    tagline = crop_rows(src, tagline_band[0], tagline_band[1])

    # Horizontal lockup: emblem left, wordmark right, wordmark height = 38% of emblem height
    wm_h = int(emblem.height * 0.38)
    wm = wordmark.resize((int(wordmark.width * wm_h / wordmark.height), wm_h), Image.LANCZOS)
    gap = int(emblem.height * 0.12)
    horiz = Image.new("RGBA", (emblem.width + gap + wm.width, emblem.height), (0, 0, 0, 0))
    horiz.paste(emblem, (0, 0), emblem)
    horiz.paste(wm, (emblem.width + gap, (emblem.height - wm_h) // 2), wm)

    print("Logo variants:")
    save(full, LOGOS / "aarohmm-logo-full.png")
    save(lockup, LOGOS / "aarohmm-logo-lockup.png")
    save(square(emblem), LOGOS / "aarohmm-emblem-gold.png")
    save(wordmark, LOGOS / "aarohmm-wordmark-gold.png")
    save(horiz, LOGOS / "aarohmm-logo-horizontal.png")
    save(tagline, LOGOS / "aarohmm-tagline-gold.png")

    # PWA icons — emblem on dark brand background so maskable crops stay legible
    print("PWA icons:")
    sq = square(emblem, pad_ratio=0.16)
    for size in (48, 72, 96, 128, 144, 152, 192, 384, 512):
        canvas = Image.new("RGBA", (size, size), DARK_BG)
        icon = sq.resize((size, size), Image.LANCZOS)
        canvas.alpha_composite(icon)
        save(canvas.convert("RGB").convert("RGBA"), PWA / f"icon-{size}x{size}.png")
        if size in (192, 512):
            save(canvas, PWA / f"maskable-icon-{size}x{size}.png")

    # Favicon (transparent emblem, 64px) + OG share card 1200×630
    save(square(emblem).resize((64, 64), Image.LANCZOS), ROOT / "frontend-next/public/favicon.png")
    og = Image.new("RGBA", (1200, 630), DARK_BG)
    fl = full.resize((int(full.width * 560 / full.height), 560), Image.LANCZOS)
    og.alpha_composite(fl, ((1200 - fl.width) // 2, (630 - fl.height) // 2))
    save(og.convert("RGB").convert("RGBA"), ROOT / "frontend-next/public/og-image.png")
    print("done.")


if __name__ == "__main__":
    main()
