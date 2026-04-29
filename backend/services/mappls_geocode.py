"""Thin wrapper around the Mappls (MapMyIndia) REST geocoding API.

Used to forward-geocode a retailer address → lat/lng so newly added
retailers without explicit coordinates land on the map.

If `MAPPLS_REST_API_KEY` is empty the helpers no-op and callers should
fall back to the existing pincode-prefix table.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Mappls free-tier key (registered on apis.mappls.com).
# Both the JS Map SDK key and the REST API key may be the same value
# depending on how the dashboard provisioned them; the user can paste
# either into MAPPLS_REST_API_KEY.
_FORWARD_GEOCODE_URL = (
    "https://atlas.mappls.com/api/places/geocode"
)


def _key() -> str:
    return (os.environ.get("MAPPLS_REST_API_KEY") or "").strip()


def is_mappls_enabled() -> bool:
    return bool(_key())


async def forward_geocode(
    address: str,
    *,
    pincode: Optional[str] = None,
    timeout: float = 6.0,
) -> Optional[dict]:
    """Resolve a free-form address to {lat, lng}. Returns None when
    Mappls is not configured, the request fails, or no match.
    """
    key = _key()
    if not key or not address:
        return None

    query = address.strip()
    if pincode and pincode not in query:
        query = f"{query} {pincode}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(
                _FORWARD_GEOCODE_URL,
                params={"address": query, "itemCount": 1, "region": "ind"},
                headers={"Authorization": f"Bearer {key}"},
            )
            if r.status_code != 200:
                logger.warning(
                    "Mappls geocode failed: status=%s body=%s",
                    r.status_code, r.text[:200],
                )
                return None
            data = r.json()
            results = data.get("copResults") or data.get("suggestedLocations") or []
            if not isinstance(results, list) or not results:
                return None
            top = results[0]
            lat = top.get("latitude") or top.get("lat")
            lng = top.get("longitude") or top.get("lng")
            if lat is None or lng is None:
                return None
            return {"lat": float(lat), "lng": float(lng)}
    except Exception as exc:
        logger.warning("Mappls geocode exception for %r: %s", query, exc)
        return None
