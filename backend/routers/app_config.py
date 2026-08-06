"""
Mobile / cross-client App Config endpoint.

Purpose
-------
This is the ONE endpoint a mobile app (Android/iOS) or a third-party
integration hits at boot. Everything a client needs to render, theme,
route or CTA is available here — brand tokens, feature flags, contact
info, deep-link scheme, plus a "live counters" bundle so a splash screen
never needs a second network round-trip.

Design principles
-----------------
▸ **Stable shape.** New fields may be *added* but never renamed or
  removed — old app versions keep working.
▸ **Versioned.** `min_supported_app_version` lets us force-upgrade
  stale clients without a server outage.
▸ **DB-driven where useful.** Feature flags, contact info and social
  links live in the `platform_config` Mongo document so ops can tweak
  without a deploy.
▸ **Idempotent + cheap.** Safe to call from a splash screen, background
  refresh, or startup boot.

The React web app also uses this indirectly via `ImpactContext`, but
the mobile app treats `/api/app-config` as canonical.

See also
--------
FastAPI's built-in `/openapi.json` exposes the full typed contract —
mobile teams can run `openapi-generator` / `swagger-codegen` off it to
regenerate typed SDKs on every backend change.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter

from dependencies import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/app", tags=["App Config (mobile / SDK)"])

# Bump this whenever the response shape changes in a backwards-INCOMPATIBLE
# way. Additive changes should keep the same version — clients ignore
# unknown fields.
APP_CONFIG_SCHEMA_VERSION = "1"

# The lowest app build number that's still allowed to hit the API. Older
# mobile builds see `must_upgrade: true` on the client and get prompted.
MIN_SUPPORTED_APP_VERSION = 1  # bump when we ship a breaking client change

DEFAULT_BRAND = {
    "name": "Addrika",
    "tagline": "Sacred Luxury in Every Scent",
    "primary_color": "#D4AF37",   # gold
    "secondary_color": "#2B3A4A", # navy
    "accent_color": "#8B4513",    # saddle brown
    "background_dark": "#0f1419",
    "background_light": "#FDFCF7",
    "logo_url": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
    "font_family_serif": "Playfair Display",
    "font_family_sans": "Inter",
}

DEFAULT_CONTACT = {
    "email": "contact.us@centraders.com",
    "phone": "+919667269711",
    "whatsapp": "+916202311736",
    "support_hours": "Mon–Sat, 10:00–19:00 IST",
}

DEFAULT_SOCIAL = {
    "instagram": "https://www.instagram.com/addrika.fragrances",
    "website": "https://centraders.com",
}

DEFAULT_ROUTES = {
    # Deep-link paths the app can use. Web = same URL. Mobile prepends
    # its scheme (e.g. `addrika://retailer/b2b`).
    "home": "/",
    "collection": "/collection",
    "b2b_login": "/retailer/login",
    "b2b_home": "/retailer/b2b",
    "b2b_order_detail": "/retailer/b2b/orders/{order_id}",
    "b2b_order_balance": "/retailer/b2b/orders/{order_id}?balance=1",
    "csr": "/csr",
    "blog": "/blog",
    "preview": "/preview/{token}",
    "product": "/products/{product_id}",
}

DEFAULT_FEATURES = {
    "b2b_enabled": True,
    "preorders_enabled": True,
    "fragrance_rewards_enabled": True,
    "auto_blog_enabled": True,
    "founding_retailer_launch_enabled": True,
    "razorpay_enabled": True,
    "whatsapp_nudges_enabled": True,
    "map_locator_enabled": True,
}


async def _load_platform_config() -> dict:
    """Merge DB overrides on top of the compile-time defaults so ops can
    toggle features / update contact info without a redeploy."""
    doc = await db.platform_config.find_one({"_id": "app_config"}, {"_id": 0}) or {}
    merged = {
        "brand": {**DEFAULT_BRAND, **(doc.get("brand") or {})},
        "contact": {**DEFAULT_CONTACT, **(doc.get("contact") or {})},
        "social": {**DEFAULT_SOCIAL, **(doc.get("social") or {})},
        "routes": {**DEFAULT_ROUTES, **(doc.get("routes") or {})},
        "features": {**DEFAULT_FEATURES, **(doc.get("features") or {})},
    }
    return merged


async def _impact_snapshot() -> dict:
    """Cheap re-implementation of /api/impact/trees so we can bundle it
    without an extra HTTP call. Keeps the shape identical."""
    try:
        from routers.impact import _compute_trees, _get_config
        cfg = await _get_config()
        return {
            "trees_planted": _compute_trees(cfg),
            "trees_per_week": float(cfg.get("trees_per_week") or 0),
        }
    except Exception as e:
        logger.debug("impact snapshot failed: %s", e)
        return {"trees_planted": None, "trees_per_week": None}


async def _catalog_counts() -> dict:
    """Tiny public roll-up so the mobile splash can promise concrete numbers."""
    try:
        b2c = await db.products.count_documents({"isActive": {"$ne": False}})
        b2b = await db.b2b_products.count_documents({})
        return {"b2c_products": b2c, "b2b_skus": b2b}
    except Exception:
        return {"b2c_products": 0, "b2b_skus": 0}


@router.get("/config", summary="Boot config for mobile/web/SDK clients")
async def get_app_config(client_version: Optional[int] = None) -> dict:
    """
    Returns brand tokens, contact info, social links, deep-link routes,
    feature flags, live-impact counters and a compatibility check.

    Clients pass their build number as `?client_version=N` and inspect
    `must_upgrade` in the response to decide whether to prompt.
    """
    cfg = await _load_platform_config()
    now = datetime.now(timezone.utc)
    return {
        "schema_version": APP_CONFIG_SCHEMA_VERSION,
        "generated_at": now.isoformat(),
        "brand": cfg["brand"],
        "contact": cfg["contact"],
        "social": cfg["social"],
        "routes": cfg["routes"],
        "features": cfg["features"],
        "impact": await _impact_snapshot(),
        "catalog": await _catalog_counts(),
        "compatibility": {
            "min_supported_app_version": MIN_SUPPORTED_APP_VERSION,
            "must_upgrade": bool(
                client_version is not None
                and int(client_version) < MIN_SUPPORTED_APP_VERSION
            ),
            "openapi_url": "/openapi.json",
        },
        "deep_link_scheme": os.environ.get("APP_DEEP_LINK_SCHEME", "addrika"),
        "public_web_url": os.environ.get("PUBLIC_APP_URL", "https://centraders.com"),
    }


@router.get("/manifest", summary="Route + endpoint manifest for SDK generation")
async def get_app_manifest() -> dict:
    """A discoverability endpoint intended for SDK generators + third-party
    integrators. Points at the OpenAPI schema plus the most-used stable
    endpoints so tooling doesn't have to guess."""
    return {
        "schema_version": APP_CONFIG_SCHEMA_VERSION,
        "openapi": "/openapi.json",
        "swagger_ui": "/docs",
        "redoc": "/redoc",
        "stable_endpoints": {
            "app_config": "/api/app/config",
            "products_list": "/api/products",
            "product_detail": "/api/products/{product_id}",
            "impact_trees": "/api/impact/trees",
            "brochure_pdf": "/api/brochure/download",
            "preview_resolve": "/api/preview/resolve/{token}",
            "b2b_catalog": "/api/retailer-dashboard/b2b/catalog",
            "b2b_orders": "/api/retailer-dashboard/b2b/orders",
        },
        "notes": "Every schema shape can be regenerated as typed models via `openapi-generator -i https://<host>/openapi.json -g dart` (Flutter) or `-g swift5` / `-g kotlin`.",
    }
