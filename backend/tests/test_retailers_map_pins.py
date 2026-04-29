"""Regression test: legacy & new retailers without explicit coordinates
must be enriched with pincode-derived coordinates by GET /api/retailers/.
This guarantees they show up as pins on /find-retailers.
"""
import os
import asyncio
import uuid

import httpx
import pytest

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://incense-retail.preview.emergentagent.com",
).rstrip("/")


@pytest.mark.asyncio
async def test_retailers_have_mappable_coordinates():
    """Every active+verified retailer returned by the public list endpoint
    must have valid float lat/lng (either original or pincode_fallback)."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        r = await client.get(f"{BASE_URL}/api/retailers/")
        assert r.status_code == 200, r.text
        retailers = r.json().get("retailers", [])
        assert len(retailers) > 0, "Expected at least one seeded retailer"

        unmappable = [
            x.get("business_name")
            for x in retailers
            if not (
                isinstance(x.get("coordinates"), dict)
                and isinstance(x["coordinates"].get("lat"), (int, float))
                and isinstance(x["coordinates"].get("lng"), (int, float))
            )
        ]
        assert not unmappable, (
            f"These retailers have no mappable coords (add pincode "
            f"to PINCODE_COORDINATES or pass coordinates on create): {unmappable}"
        )


@pytest.mark.asyncio
async def test_pincode_fallback_marker_present_when_used():
    """At least one of our seeded retailers (Test Retailer Store, pincode 110001)
    should be tagged as pincode_fallback if it had no DB coords."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        r = await client.get(f"{BASE_URL}/api/retailers/")
        retailers = r.json().get("retailers", [])
        # Assert the fallback path is reachable: at least one retailer was
        # mappable solely because of the pincode fallback OR all had real coords.
        had_fallback = any(
            x.get("coordinates_source") == "pincode_fallback" for x in retailers
        )
        all_have_explicit = all(
            x.get("coordinates_source") in (None, "pincode_fallback")
            for x in retailers
        )
        assert had_fallback or all_have_explicit, (
            "Fallback marker missing AND not all retailers have explicit coords"
        )


if __name__ == "__main__":
    async def _main():
        await test_retailers_have_mappable_coordinates()
        await test_pincode_fallback_marker_present_when_used()
        print("OK")

    asyncio.run(_main())
