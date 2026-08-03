"""Pincode → city + state lookup.

Strategy:
  1. Try Shiprocket serviceability API (accurate city name) — requires creds.
  2. Fallback to offline India-Post 2-digit → state mapping so the UI can
     still auto-fill the state even when Shiprocket is unconfigured.

The public endpoint is exposed via `routers/shipping.py::check_pincode`
and via a new B2B-facing wrapper below.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# First-two-digit → State mapping (India Post allocated PIN zones).
# Source: https://en.wikipedia.org/wiki/Postal_Index_Number
_STATE_BY_PIN_PREFIX = {
    "11": "Delhi",
    "12": "Haryana", "13": "Haryana",
    "14": "Punjab", "15": "Punjab", "16": "Punjab",
    "17": "Himachal Pradesh",
    "18": "Jammu & Kashmir", "19": "Jammu & Kashmir",
    "20": "Uttar Pradesh", "21": "Uttar Pradesh", "22": "Uttar Pradesh",
    "23": "Uttar Pradesh", "24": "Uttar Pradesh", "25": "Uttar Pradesh",
    "26": "Uttar Pradesh", "27": "Uttar Pradesh", "28": "Uttar Pradesh",
    "30": "Rajasthan", "31": "Rajasthan", "32": "Rajasthan",
    "33": "Rajasthan", "34": "Rajasthan",
    "36": "Gujarat", "37": "Gujarat", "38": "Gujarat", "39": "Gujarat",
    "40": "Maharashtra", "41": "Maharashtra", "42": "Maharashtra",
    "43": "Maharashtra", "44": "Maharashtra",
    "45": "Madhya Pradesh", "46": "Madhya Pradesh", "47": "Madhya Pradesh",
    "48": "Madhya Pradesh",
    "49": "Chhattisgarh",
    "50": "Telangana", "51": "Andhra Pradesh", "52": "Andhra Pradesh",
    "53": "Andhra Pradesh",
    "56": "Karnataka", "57": "Karnataka", "58": "Karnataka", "59": "Karnataka",
    "60": "Tamil Nadu", "61": "Tamil Nadu", "62": "Tamil Nadu",
    "63": "Tamil Nadu", "64": "Tamil Nadu",
    "67": "Kerala", "68": "Kerala", "69": "Kerala",
    "70": "West Bengal", "71": "West Bengal", "72": "West Bengal",
    "73": "West Bengal", "74": "West Bengal",
    "75": "Odisha", "76": "Odisha", "77": "Odisha",
    "78": "Assam", "79": "Arunachal Pradesh · Nagaland · Manipur · Mizoram · Tripura · Meghalaya",
    "80": "Bihar", "81": "Bihar", "82": "Bihar",
    "83": "Jharkhand",
    "84": "Bihar",
    "85": "Bihar",
}


def state_from_pincode(pincode: str) -> str | None:
    if not pincode or len(pincode) < 2 or not pincode.isdigit():
        return None
    return _STATE_BY_PIN_PREFIX.get(pincode[:2])


async def lookup_pincode(pincode: str) -> dict:
    """Return `{pincode, city, state, source}`. Best-effort; the state is
    resolvable offline so this endpoint never returns 404."""
    if not pincode or len(pincode) != 6 or not pincode.isdigit():
        return {"pincode": pincode, "city": None, "state": None, "source": "invalid"}

    # Try Shiprocket first (gives city name)
    city = None
    state = None
    source = "offline"
    try:
        from services.shiprocket_service import check_pincode_serviceability
        res = await check_pincode_serviceability(pincode)
        if res and res.get("serviceable") is True:
            city = res.get("city")
            state = res.get("state") or state
            if city:
                source = "shiprocket"
    except Exception as e:
        logger.debug("pincode lookup Shiprocket failed: %s", e)

    # Backfill state from offline mapping if Shiprocket didn't return one
    if not state:
        state = state_from_pincode(pincode)

    return {
        "pincode": pincode,
        "city": city,
        "state": state,
        "source": source,
        "serviceable": True if (state or city) else False,
    }
