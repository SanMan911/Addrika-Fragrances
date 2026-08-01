"""Central brand configuration (backend mirror of frontend/lib/brand.config.js).

ONE-FILE RENAME
===============
Whenever `BRAND_NAME` in `.env` changes, this module reflects the new
name across every backend-generated artefact — welcome emails, invoice
PDFs, brochure, RSS feed titles, sitemap `<title>`s, receipt copy, etc.

Convention: any user-facing string that includes the brand name should
call `brand.name` instead of hard-coding `"Addrika"`. When the trademark
clears (or is denied) and a rename is required, the swap is a single env
var flip + redeploy — no code touched.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class BrandColors:
    gold: str = "#D4AF37"
    gold_dark: str = "#c9a432"
    ink: str = "#1a1a2e"
    ink_soft: str = "#22324a"
    cream: str = "#fbf6e6"


@dataclass(frozen=True)
class Brand:
    name: str
    legal_name: str
    tagline: str
    domain: str
    monogram: str
    email: str
    phone: str
    whatsapp: str
    instagram: str
    colors: BrandColors

    @property
    def website_url(self) -> str:
        return f"https://{self.domain}"

    @property
    def welcome_email_subject(self) -> str:
        return f"Welcome to {self.name} \U0001f64f"


BRAND = Brand(
    name=os.environ.get("BRAND_NAME", "Addrika"),
    legal_name=os.environ.get("BRAND_LEGAL_NAME", "Centraders (India) Private Limited"),
    tagline=os.environ.get("BRAND_TAGLINE", "Elevate Your Everyday Rituals"),
    domain=os.environ.get("BRAND_DOMAIN", "centraders.com"),
    monogram=os.environ.get("BRAND_MONOGRAM", "A"),
    email=os.environ.get("BRAND_EMAIL", "contact.us@centraders.com"),
    phone=os.environ.get("BRAND_PHONE", "+91 8377020402"),
    whatsapp=os.environ.get("BRAND_WHATSAPP", "+91 8377020402"),
    instagram=os.environ.get("BRAND_INSTAGRAM", "@addrika.official"),
    colors=BrandColors(),
)
