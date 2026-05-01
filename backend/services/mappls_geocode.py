"""Thin wrapper around the Mappls (MapMyIndia) REST geocoding API.

Used to forward-geocode a retailer address → lat/lng so newly added
retailers without explicit coordinates land on the map.

Mappls uses a Static-Key auth pattern where the key is embedded in the
URL path, not sent as a Bearer token. Whitelisting of caller domains
must be configured in the Mappls Console → App → Whitelisting tab.

If `MAPPLS_REST_API_KEY` is empty the helpers no-op and callers should
fall back to the existing pincode-prefix table.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


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

    url = f"https://apis.mappls.com/advancedmaps/v1/{key}/geo_code"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(
                url,
                params={"addr": query},
                headers={"Referer": "https://centraders.com/"},
            )
            if r.status_code != 200:
                logger.warning(
                    "Mappls geocode failed: status=%s body=%s",
                    r.status_code, r.text[:200],
                )
                return None
            data = r.json()
            # Mappls returns `results` array with `lat`/`lng` keys.
            results = data.get("results") or []
            if not isinstance(results, list) or not results:
                return None
            top = results[0]
            lat = top.get("lat") or top.get("latitude")
            lng = top.get("lng") or top.get("longitude")
            if lat is None or lng is None:
                return None
            return {"lat": float(lat), "lng": float(lng)}
    except Exception as exc:
        logger.warning("Mappls geocode exception for %r: %s", query, exc)
        return None
