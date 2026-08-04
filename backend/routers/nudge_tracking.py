"""Public open + click tracking endpoints for admin broadcast nudges.

These are NOT protected by auth — email clients / anonymous browsers
cannot carry retailer session cookies. Retailer identity is embedded
in the URL as an opaque ID; we treat both IDs as untrusted and only
use them as counter keys.
"""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse, Response

from dependencies import db
from services.b2b_nudge_analytics import (
    pixel_bytes, record_click, record_open,
)

router = APIRouter(prefix="/nudges/track", tags=["Nudge Tracking"])


@router.get("/open/{broadcast_id}/{retailer_id}.gif")
async def track_open(broadcast_id: str, retailer_id: str):
    try:
        await record_open(db, broadcast_id=broadcast_id, retailer_id=retailer_id)
    except Exception:
        pass  # never let tracking failures break the pixel response
    return Response(
        content=pixel_bytes(),
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/click/{broadcast_id}/{retailer_id}")
async def track_click(
    broadcast_id: str, retailer_id: str,
    url: str = Query(..., min_length=4),
):
    # Reject javascript: / data: / relative URLs — never redirect to those
    lower = url.lower().strip()
    if not (lower.startswith("http://") or lower.startswith("https://")):
        return RedirectResponse(url="/", status_code=302)
    try:
        await record_click(
            db, broadcast_id=broadcast_id, retailer_id=retailer_id, url=url,
        )
    except Exception:
        pass
    return RedirectResponse(url=url, status_code=302)
