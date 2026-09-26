#!/usr/bin/env python3
"""One-shot Addrika → AAROHMM rename for backend source (user-facing strings only).

Protected technical identifiers (cookies, DB name, storage paths, env keys,
partner-protocol values) are masked before the replace and restored after.
Run from repo root: python3 scripts/rename_brand_backend.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "backend"]
SKIP_DIRS = {"__pycache__", "tests", ".venv", "node_modules"}
EXTS = {".py", ".md", ".txt", ".html"}

PROTECTED = [
    "addrika_verified_partner", "addrika_db", "addrika_session_token", "addrika_match",
    "ADDRIKA_PICKUP_PINCODE", "addrika_admin_override", "addrika_secret_key",
    "addrika_sr_wh", "addrika/blog-images", "addrika-mirror", "addrika-fragrances-backend",
    "addrika-early-access-fallback", "/tmp/addrika_brochure_cache", "addrika-fragrances",
    "AddrikaAdmin@2026", "total_addrika_match", "addrika_incense",
]

# Ordered explicit rewrites (run BEFORE the generic capitalised replace)
EXPLICIT = [
    ("X-Addrika-", "X-Aarohmm-"),
    ("Addrika-StockWebhook", "Aarohmm-StockWebhook"),
    ("#AddrikaCommunity", "#AarohmmCommunity"),
    ("@addrika.fragrances", "@aarohmm.fragrances"),
    ("instagram.com/addrika.fragrances", "instagram.com/aarohmm.fragrances"),
    ("@addrika_incense", "@aarohmm_incense"),
    ("@addrikaofficial", "@aarohmmofficial"),
    ("@addrika.official", "@aarohmm.fragrances"),
    ("https://addrika.com", "https://centraders.com"),
    ("k=addrika+incense", "k=aarohmm+incense"),
    ("addrika-logo-gold-cropped.png", "aarohmm-emblem-gold.png"),
    ("addrika-rewards-", "aarohmm-rewards-"),
    ("addrika-inventory-log-", "aarohmm-inventory-log-"),
    ("addrika-products-template.csv", "aarohmm-products-template.csv"),
    ("Elegance in Every Scent", "Where Fragrance Becomes Atmosphere…"),
    ("Elevate Your Everyday Rituals", "Where Fragrance Becomes Atmosphere…"),
    ("Sacred Luxury in Every Scent", "Where Fragrance Becomes Atmosphere…"),
    # dead sender addresses on an unverified domain → env-driven sender
    ('"from": "Addrika Orders <orders@addrika.in>"', '"from": f"{BRAND.name} Orders <{os.environ.get(\'SENDER_EMAIL\')}>"'),
    ('"from": "Addrika System <system@addrika.in>"', '"from": f"{BRAND.name} System <{os.environ.get(\'SENDER_EMAIL\')}>"'),
    ('"from": "Addrika <orders@addrika.in>"', '"from": f"{BRAND.name} <{os.environ.get(\'SENDER_EMAIL\')}>"'),
    ('<a href="mailto:support@addrika.in" style="color: #d4af37;">support@addrika.in</a>',
     '<a href="mailto:contact.us@centraders.com" style="color: #d4af37;">contact.us@centraders.com</a>'),
]

GENERIC = [(re.compile(r"\bADDRIKA\b"), "AAROHMM"), (re.compile(r"\bAddrika\b"), "AAROHMM")]


def process(path: Path) -> int:
    src = path.read_text(encoding="utf-8")
    original = src
    masks = {}
    for i, tok in enumerate(PROTECTED):
        key = f"\x00PROT{i}\x00"
        if tok in src:
            masks[key] = tok
            src = src.replace(tok, key)
    for a, b in EXPLICIT:
        src = src.replace(a, b)
    for rx, rep in GENERIC:
        src = rx.sub(rep, src)
    for key, tok in masks.items():
        src = src.replace(key, tok)
    if src != original:
        path.write_text(src, encoding="utf-8")
        return sum(1 for _ in re.finditer(r"AAROHMM", src)) - sum(1 for _ in re.finditer(r"AAROHMM", original))
    return 0


def main() -> None:
    total, files = 0, 0
    for base in TARGETS:
        for p in base.rglob("*"):
            if p.suffix not in EXTS or any(s in p.parts for s in SKIP_DIRS):
                continue
            n = process(p)
            if n:
                files += 1
                total += n
                print(f"  {p.relative_to(ROOT)}: +{n}")
    print(f"done: {total} replacements across {files} files")


if __name__ == "__main__":
    main()
