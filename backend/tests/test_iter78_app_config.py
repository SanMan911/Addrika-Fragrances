"""Iter78 — Verify:
1. ImpactProvider single-source (unit-level via requests to /api/impact/trees stability)
2. /api/app/config boot payload shape + fields
3. /api/app/manifest points at OpenAPI + stable endpoints
4. Backwards-compatibility: DB override merges on top of defaults
5. must_upgrade compatibility check works
6. OpenAPI schema is served (mobile SDK generators need it)
"""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest_asyncio.fixture
async def dbc():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


# ── 1. IMPACT SINGLE SOURCE ──────────────────────────────────────────────

def test_impact_endpoint_stable():
    """Two back-to-back reads must return the same tree count (no race)."""
    r1 = requests.get(f"{BASE_URL}/api/impact/trees", timeout=15)
    r2 = requests.get(f"{BASE_URL}/api/impact/trees", timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["trees"] == r2.json()["trees"]


# ── 2. APP CONFIG BOOT PAYLOAD ────────────────────────────────────────────

def test_app_config_shape():
    r = requests.get(f"{BASE_URL}/api/app/config", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("schema_version", "generated_at", "brand", "contact", "social",
              "routes", "features", "impact", "catalog", "compatibility",
              "deep_link_scheme", "public_web_url"):
        assert k in body, f"missing key: {k}"

    brand = body["brand"]
    for k in ("name", "tagline", "primary_color", "logo_url"):
        assert k in brand

    routes = body["routes"]
    assert routes["home"] == "/"
    assert "{order_id}" in routes["b2b_order_balance"]
    assert routes["b2b_order_balance"].endswith("?balance=1")

    # Impact snapshot must match the standalone endpoint
    r2 = requests.get(f"{BASE_URL}/api/impact/trees", timeout=15).json()
    assert body["impact"]["trees_planted"] == r2["trees"], (
        "app config impact snapshot drifted from /api/impact/trees — single-source broken"
    )


def test_app_config_features_are_flags():
    r = requests.get(f"{BASE_URL}/api/app/config", timeout=15).json()
    features = r["features"]
    # Every known feature flag must be a bool so mobile clients can safely
    # do `if features['b2b_enabled']` without a truthy-coercion surprise.
    for k, v in features.items():
        assert isinstance(v, bool), f"feature flag '{k}' is not a bool ({type(v).__name__})"


def test_app_config_compatibility_upgrade_prompt():
    """Old client (version=0) sees must_upgrade=True; new client (999) doesn't."""
    r_old = requests.get(f"{BASE_URL}/api/app/config?client_version=0", timeout=15).json()
    r_new = requests.get(f"{BASE_URL}/api/app/config?client_version=999", timeout=15).json()
    assert r_old["compatibility"]["must_upgrade"] is True
    assert r_new["compatibility"]["must_upgrade"] is False


# ── 3. DB OVERRIDE MERGE ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_app_config_db_override_merges(dbc):
    """Ops can flip a feature flag or update contact info by editing the
    `platform_config` doc — the response merges these on top of defaults."""
    await dbc.platform_config.update_one(
        {"_id": "app_config"},
        {"$set": {
            "features": {"whatsapp_nudges_enabled": False},
            "contact": {"phone": "+919999999999"},
        }},
        upsert=True,
    )
    try:
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=15).json()
        assert r["features"]["whatsapp_nudges_enabled"] is False
        assert r["contact"]["phone"] == "+919999999999"
        # Defaults still filled in for keys not overridden
        assert r["features"]["b2b_enabled"] is True
        assert r["contact"]["email"] == "contact.us@centraders.com"
    finally:
        await dbc.platform_config.delete_one({"_id": "app_config"})


# ── 4. MANIFEST ──────────────────────────────────────────────────────────

def test_app_manifest():
    r = requests.get(f"{BASE_URL}/api/app/manifest", timeout=15)
    assert r.status_code == 200
    m = r.json()
    assert m["openapi"] == "/openapi.json"
    assert "app_config" in m["stable_endpoints"]
    assert m["stable_endpoints"]["products_list"] == "/api/products"


# ── 5. OPENAPI SCHEMA ────────────────────────────────────────────────────

def test_openapi_schema_available_for_sdk_generators():
    """Mobile SDK generators (openapi-generator, swagger-codegen) read this
    to produce typed clients. Must be JSON, must include our new paths."""
    r = requests.get(f"{BASE_URL}/openapi.json", timeout=15)
    assert r.status_code == 200
    schema = r.json()
    assert schema["openapi"].startswith("3.")
    paths = schema.get("paths", {})
    # New app config endpoints must be discoverable
    assert "/api/app/config" in paths
    assert "/api/app/manifest" in paths
    # Long-standing public endpoints must be there too (contract stability)
    assert "/api/products" in paths
    assert "/api/impact/trees" in paths


def test_docs_ui_served():
    """FastAPI's swagger UI must be reachable — used by mobile devs during
    integration."""
    r = requests.get(f"{BASE_URL}/docs", timeout=15)
    assert r.status_code == 200
    assert "swagger" in r.text.lower()
