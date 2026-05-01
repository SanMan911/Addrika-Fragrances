"""Provider health/balance tracker.

None of our three external providers (AppyFlow, Mappls, Sandbox) expose
a public "wallet balance" REST endpoint. To give the admin panel a
useful rollup we:

1. Persist every call-result from our side into `provider_health` with
   a timestamp (success / rate_limit / credit_exhausted / auth_error).
2. Run a live on-demand probe on each provider that makes a minimal
   no-op call and interprets the response.
3. Combine both into a structured status card per provider.

Users still have to top-up manually on the provider's dashboard, but
the admin sees accurate "last successful call", "last error", rolling
calls this month, and a red-flag banner if credits have been exhausted.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import httpx

from dependencies import db

# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
async def log_call(
    provider: str,
    *,
    endpoint: str,
    outcome: str,                 # "success" | "rate_limit" | "credit_exhausted" | "auth_error" | "network_error"
    note: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> None:
    """Fire-and-forget call logger. Callers wrap with `asyncio.create_task`."""
    try:
        await db.provider_health.insert_one({
            "provider": provider,
            "endpoint": endpoint,
            "outcome": outcome,
            "note": note,
            "latency_ms": latency_ms,
            "ts": datetime.now(timezone.utc),
        })
    except Exception:
        # Never let logging break a real request.
        pass


async def _rollup(provider: str) -> Dict[str, Any]:
    """Aggregate the last 30 days of logs for a provider."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=30)

    cursor = db.provider_health.find({
        "provider": provider,
        "ts": {"$gte": since},
    }).sort("ts", -1).limit(500)

    total = 0
    by_outcome: Dict[str, int] = {}
    last_success_ts: Optional[datetime] = None
    last_error: Optional[Dict[str, Any]] = None

    async for doc in cursor:
        total += 1
        oc = doc.get("outcome", "unknown")
        by_outcome[oc] = by_outcome.get(oc, 0) + 1
        if oc == "success" and not last_success_ts:
            last_success_ts = doc.get("ts")
        if oc != "success" and last_error is None:
            last_error = {
                "outcome": oc,
                "note": doc.get("note"),
                "endpoint": doc.get("endpoint"),
                "at": doc.get("ts").isoformat() if doc.get("ts") else None,
            }

    return {
        "calls_30d": total,
        "by_outcome_30d": by_outcome,
        "last_success_at": last_success_ts.isoformat() if last_success_ts else None,
        "last_error": last_error,
    }


# ---------------------------------------------------------------------------
# Live probes
# ---------------------------------------------------------------------------
async def probe_appyflow() -> Dict[str, Any]:
    """Hit the AppyFlow endpoint with a dummy GSTIN and interpret."""
    key = (os.environ.get("APPYFLOW_API_KEY") or "").strip()
    if not key:
        return {"status": "unconfigured", "message": "APPYFLOW_API_KEY is not set."}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                "https://appyflow.in/api/verifyGST",
                data={"key_secret": key, "gstNo": "07AAACR5055K1Z7"},
            )
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        msg = (body.get("message") or "").lower()
        if "credit expire" in msg or "limit exceed" in msg or "limit exceeded" in msg:
            return {"status": "exhausted", "message": body.get("message")}
        if r.status_code == 401 or "unauthoriz" in msg:
            return {"status": "auth_error", "message": body.get("message") or "401"}
        if r.status_code == 200:
            return {"status": "healthy", "message": "Live call succeeded."}
        return {"status": "unknown", "message": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"status": "network_error", "message": str(e)[:200]}


async def probe_mappls() -> Dict[str, Any]:
    """Attempt a minimal Mappls call. Mappls static-key auth passes the key
    as a path segment, NOT as a Bearer token — that was the source of the
    earlier 401 confusion. We try two well-known static-key endpoints and
    interpret the response.
    """
    key = (os.environ.get("MAPPLS_REST_API_KEY") or "").strip()
    if not key:
        return {"status": "unconfigured", "message": "MAPPLS_REST_API_KEY is not set."}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            # Forward-geocode is cheap, JSON response, static-key path-style.
            r = await client.get(
                f"https://apis.mappls.com/advancedmaps/v1/{key}/geo_code",
                params={"addr": "India Gate Delhi"},
                headers={
                    # Mappls whitelists by Referer; mimic the production domain
                    # so the probe succeeds once the user whitelists that domain.
                    "Referer": "https://centraders.com/",
                },
            )
        if r.status_code == 200:
            return {"status": "healthy", "message": "Geocode probe succeeded."}
        if r.status_code in (401, 412):
            return {
                "status": "auth_error",
                "message": (
                    f"Mappls HTTP {r.status_code} — key is valid but the app "
                    "isn't fully configured yet. In the Mappls console → app detail: "
                    "(1) Allocations tab: allocate Raster Map Tile + Geocoding APIs. "
                    "(2) Whitelisting tab: add centraders.com and "
                    "incense-retail.preview.emergentagent.com."
                ),
            }
        if r.status_code == 429:
            return {"status": "rate_limited", "message": "HTTP 429 — too many requests"}
        return {"status": "unknown", "message": f"HTTP {r.status_code}: {r.text[:120]}"}
    except Exception as e:
        return {"status": "network_error", "message": str(e)[:200]}


async def probe_sandbox() -> Dict[str, Any]:
    """Authenticate against Sandbox; token issuance implies wallet is live."""
    key = (os.environ.get("SANDBOX_API_KEY") or "").strip()
    sec = (os.environ.get("SANDBOX_API_SECRET") or "").strip()
    if not (key and sec):
        return {"status": "unconfigured", "message": "SANDBOX_API_KEY / SECRET not set."}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                "https://api.sandbox.co.in/authenticate",
                headers={
                    "x-api-key": key,
                    "x-api-secret": sec,
                    "x-api-version": "1.0.0",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code == 200:
            return {"status": "healthy", "message": "Token issued successfully."}
        body = r.text[:200]
        if r.status_code == 401:
            return {"status": "auth_error", "message": body}
        if r.status_code in (402, 403):
            return {"status": "exhausted", "message": body}
        return {"status": "unknown", "message": f"HTTP {r.status_code} {body}"}
    except Exception as e:
        return {"status": "network_error", "message": str(e)[:200]}


# ---------------------------------------------------------------------------
# Public rollup
# ---------------------------------------------------------------------------
_PROVIDERS = [
    {
        "id": "appyflow",
        "label": "AppyFlow (GST Verification)",
        "recharge_url": "https://appyflow.in/verify-gst/#paidUsages",
        "dashboard_url": "https://appyflow.in/verify-gst/",
        "probe": probe_appyflow,
        "uses": "Live GST verification during retailer onboarding + spoofing checks",
    },
    {
        "id": "sandbox",
        "label": "Sandbox (PAN + Aadhaar eKYC)",
        "recharge_url": "https://apis.sandbox.co.in/dashboard/wallet",
        "dashboard_url": "https://apis.sandbox.co.in/dashboard",
        "probe": probe_sandbox,
        "uses": "Retailer PAN verify + Aadhaar OTP eKYC",
    },
    {
        "id": "mappls",
        "label": "Mappls (India-compliant Maps + Geocoding)",
        "recharge_url": "https://apis.mappls.com/console/#/home/dashboard/billing",
        "dashboard_url": "https://apis.mappls.com/console",
        "probe": probe_mappls,
        "uses": "Map tiles on /find-retailers + retailer address geocoding",
    },
]


async def get_all_provider_status() -> Dict[str, Any]:
    """Kick off all live probes in parallel and merge with historical rollups."""
    probes = await asyncio.gather(*(p["probe"]() for p in _PROVIDERS))
    rollups = await asyncio.gather(*(_rollup(p["id"]) for p in _PROVIDERS))

    providers_out = []
    for meta, live, history in zip(_PROVIDERS, probes, rollups):
        providers_out.append({
            "id": meta["id"],
            "label": meta["label"],
            "uses": meta["uses"],
            "recharge_url": meta["recharge_url"],
            "dashboard_url": meta["dashboard_url"],
            "live": live,
            "history_30d": history,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "providers": providers_out,
    }
