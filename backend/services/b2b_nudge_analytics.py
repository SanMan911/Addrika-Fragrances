"""Broadcast analytics — open + click tracking for custom nudges.

Wire-in strategy:
    ▸ **Open**: a 1x1 transparent GIF pixel appended to the email HTML.
      When the retailer opens the email, their client fetches the pixel,
      which hits `GET /api/nudges/track/open/{broadcast_id}/{retailer_id}.gif`
      and we bump the open counter.
    ▸ **Click**: every `<a href="...">` link in the admin-authored body
      is rewritten to route through
      `GET /api/nudges/track/click/{broadcast_id}/{retailer_id}?url=<encoded>`
      which logs the click, then 302-redirects to the target URL.

Both endpoints are public (no auth) since email clients / browsers do
NOT carry retailer session cookies. Retailer identity is embedded in
the URL as an opaque ID, safe to expose.

Aggregations live on `custom_nudges_log` (single-row per broadcast) so
one lookup gives the admin the entire funnel.
"""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# 1x1 transparent GIF89a
_PIXEL_GIF = base64.b64decode(
    b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def pixel_bytes() -> bytes:
    return _PIXEL_GIF


# ---------------------------------------------------------------------------
# HTML rewriting — used at send time inside `broadcast_custom_nudge`
# ---------------------------------------------------------------------------
_HREF_RE = re.compile(r'href="(?P<url>[^"]+)"', re.IGNORECASE)


def _api_base(request_scheme: str = "https", request_host: str = "centraders.com") -> str:
    """Absolute base URL for the tracking endpoints. Uses the public host
    stamped into the email — always centraders.com in production."""
    return f"{request_scheme}://{request_host}"


def rewrite_links_for_tracking(
    html: str, *, api_base: str, broadcast_id: str, retailer_id: str,
) -> str:
    """Replace every http(s) link's href with a tracking URL. Non-http
    hrefs (mailto:, tel:, anchor) are left alone."""
    from urllib.parse import quote

    def _repl(match: re.Match) -> str:
        url = match.group("url")
        if not url or not url.lower().startswith(("http://", "https://")):
            return match.group(0)
        tracked = (
            f"{api_base}/api/nudges/track/click/{broadcast_id}/{retailer_id}"
            f"?url={quote(url, safe='')}"
        )
        return f'href="{tracked}"'

    return _HREF_RE.sub(_repl, html or "")


def append_open_pixel(
    html: str, *, api_base: str, broadcast_id: str, retailer_id: str,
) -> str:
    """Append a 1x1 open-tracking pixel just before `</body>` (or at end)."""
    pixel_url = (
        f"{api_base}/api/nudges/track/open/{broadcast_id}/{retailer_id}.gif"
    )
    pixel_tag = (
        f'<img src="{pixel_url}" width="1" height="1" '
        f'alt="" style="display:block;width:1px;height:1px;border:0;" />'
    )
    if "</body>" in html.lower():
        return re.sub(r"</body>", pixel_tag + "</body>", html, count=1, flags=re.IGNORECASE)
    return html + pixel_tag


# ---------------------------------------------------------------------------
# Persistence — bumps counters on the broadcast row
# ---------------------------------------------------------------------------
async def record_open(db, *, broadcast_id: str, retailer_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    # De-dupe per retailer using `nudges_open_log` — first hit only bumps
    # the aggregate. Every hit still logs the raw event for analytics.
    existing = await db.nudges_open_log.find_one({
        "broadcast_id": broadcast_id, "retailer_id": retailer_id,
    })
    await db.nudges_open_log.insert_one({
        "broadcast_id": broadcast_id,
        "retailer_id": retailer_id,
        "opened_at": now,
    })
    if not existing:
        await db.custom_nudges_log.update_one(
            {"broadcast_id": broadcast_id},
            {"$inc": {"opens": 1, "unique_opens": 1}},
        )
    else:
        await db.custom_nudges_log.update_one(
            {"broadcast_id": broadcast_id},
            {"$inc": {"opens": 1}},
        )


async def record_click(
    db, *, broadcast_id: str, retailer_id: str, url: str,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.nudges_click_log.find_one({
        "broadcast_id": broadcast_id,
        "retailer_id": retailer_id,
        "url": url,
    })
    await db.nudges_click_log.insert_one({
        "broadcast_id": broadcast_id,
        "retailer_id": retailer_id,
        "url": url,
        "clicked_at": now,
    })
    if not existing:
        await db.custom_nudges_log.update_one(
            {"broadcast_id": broadcast_id},
            {"$inc": {"clicks": 1, "unique_clicks": 1}},
        )
    else:
        await db.custom_nudges_log.update_one(
            {"broadcast_id": broadcast_id},
            {"$inc": {"clicks": 1}},
        )


# ---------------------------------------------------------------------------
# Admin-side rollup
# ---------------------------------------------------------------------------
async def summarise_broadcast(db, broadcast_id: str) -> dict:
    """Return the per-broadcast funnel — used by the composer sidebar."""
    row = await db.custom_nudges_log.find_one(
        {"broadcast_id": broadcast_id}, {"_id": 0},
    )
    if not row:
        return {}
    audience = int(row.get("audience_size") or 0)
    opens = int(row.get("opens") or 0)
    unique_opens = int(row.get("unique_opens") or 0)
    clicks = int(row.get("clicks") or 0)
    unique_clicks = int(row.get("unique_clicks") or 0)
    email_sent = int(row.get("email_sent") or 0)
    denom = email_sent or audience
    return {
        **row,
        "opens": opens, "unique_opens": unique_opens,
        "clicks": clicks, "unique_clicks": unique_clicks,
        "open_rate_pct": round((unique_opens / denom) * 100, 1) if denom else 0.0,
        "click_rate_pct": round((unique_clicks / denom) * 100, 1) if denom else 0.0,
        "ctr_pct": round((unique_clicks / unique_opens) * 100, 1) if unique_opens else 0.0,
    }
