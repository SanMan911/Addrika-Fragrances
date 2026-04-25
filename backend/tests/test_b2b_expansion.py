"""
Sanity/regression tests for B2B expansion: waitlist, loyalty milestones,
bill/messages service-level checks, and catalog refactor integrity.
Runs against live backend via REACT_APP_BACKEND_URL.
"""
import os
import pytest
import httpx

BASE = os.environ.get(
    "BACKEND_URL",
    "https://addrika-kyc-onboard.preview.emergentagent.com",
)


@pytest.mark.asyncio
async def test_portal_status_public():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/api/retailer-auth/portal-status")
        assert r.status_code == 200
        assert "enabled" in r.json()


@pytest.mark.asyncio
async def test_waitlist_signup_validation():
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/api/retailer-auth/waitlist", json={})
        assert r.status_code == 422


@pytest.mark.asyncio
async def test_waitlist_signup_valid():
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{BASE}/api/retailer-auth/waitlist",
            json={
                "business_name": "Pytest Store",
                "contact_name": "Pytest Bot",
                "email": "pytest.waitlist@example.com",
                "phone": "9999999999",
                "city": "Testville",
                "message": "pytest run",
                "gst_number": "27AAPFU0939F1ZV",  # iter63: required
            },
        )
        assert r.status_code == 200
        assert r.json()["email"] == "pytest.waitlist@example.com"


@pytest.mark.asyncio
async def test_admin_endpoints_require_auth():
    endpoints = [
        "/api/admin/b2b-waitlist",
        "/api/admin/b2b-loyalty/milestones",
        "/api/admin/b2b-settings",
        "/api/admin/b2b/threads",
        "/api/admin/b2b/retailers/RTL_TEST_B2B/bills",
    ]
    async with httpx.AsyncClient() as c:
        for ep in endpoints:
            r = await c.get(f"{BASE}{ep}")
            assert r.status_code == 401, f"{ep} returned {r.status_code}"


@pytest.mark.asyncio
async def test_retailer_endpoints_require_auth_or_disabled_portal():
    """All /retailer-dashboard/b2b endpoints should 401/403 without auth."""
    paths = [
        "/api/retailer-dashboard/b2b/catalog",
        "/api/retailer-dashboard/b2b/loyalty",
        "/api/retailer-dashboard/bills",
        "/api/retailer-dashboard/admin-chat",
    ]
    async with httpx.AsyncClient() as c:
        for p in paths:
            r = await c.get(f"{BASE}{p}")
            assert r.status_code in (401, 403)


def test_catalog_refactor_importable():
    """Core catalog importable from shared module with all 10 products."""
    from services.b2b_catalog import B2B_PRODUCTS, find_b2b_product

    assert len(B2B_PRODUCTS) == 10
    assert find_b2b_product("kesar-chandan-b2b") is not None
    assert find_b2b_product("nonexistent") is None


def test_loyalty_utilities():
    from services.b2b_loyalty import (
        applicable_milestone,
        next_milestone,
        current_quarter_range,
    )

    ms = [
        {"min_purchase": 10000.0, "discount_percent": 0.5},
        {"min_purchase": 25000.0, "discount_percent": 1.0},
        {"min_purchase": 50000.0, "discount_percent": 2.0},
    ]
    assert applicable_milestone(ms, 5000) is None
    assert applicable_milestone(ms, 10000)["discount_percent"] == 0.5
    assert applicable_milestone(ms, 25000)["discount_percent"] == 1.0
    assert applicable_milestone(ms, 100000)["discount_percent"] == 2.0
    assert next_milestone(ms, 0)["min_purchase"] == 10000
    assert next_milestone(ms, 100000) is None
    start, end, label = current_quarter_range()
    assert start < end
    assert "Q" in label
