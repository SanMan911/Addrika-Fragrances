"""Mint a genuine Supabase Auth session server-side, with no email round-trip.

Why this exists: the Aarohmm mobile app reads Supabase under Row Level
Security, and `public.app_current_retailer_id()` resolves the retailer from
the JWT's **email** claim. So the app needs a real Supabase session keyed on
the retailer's registered email — but retailer passwords live in MongoDB
(bcrypt) and are never mirrored into Supabase.

Flow (service-role, documented admin endpoints only):
  1. ensure an email-confirmed auth user exists for that address
  2. POST /auth/v1/admin/generate_link {type: magiclink} -> `hashed_token`
  3. POST /auth/v1/verify {token_hash, type: magiclink} -> access/refresh token

The one-time hash is consumed immediately and never leaves the server.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(20.0, connect=10.0)


def _cfg() -> Optional[tuple[str, str]]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    service = os.environ.get("SUPABASE_SERVICE_KEY") or ""
    if not url or not service:
        return None
    return url, service


def is_configured() -> bool:
    return _cfg() is not None


async def _post(client: httpx.AsyncClient, base: str, key: str, path: str,
                body: dict) -> tuple[int, Any]:
    resp = await client.post(
        f"{base}/auth/v1{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=body,
    )
    try:
        return resp.status_code, resp.json()
    except ValueError:
        return resp.status_code, {"message": resp.text[:300]}


async def mint_session(email: str) -> Optional[dict]:
    """Return {access_token, refresh_token, expires_in} or None on failure."""
    cfg = _cfg()
    if not cfg:
        logger.error("supabase_session: SUPABASE_URL / SUPABASE_SERVICE_KEY missing")
        return None
    base, key = cfg
    addr = (email or "").strip().lower()
    if not addr:
        return None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # 1. Provision the auth user once. A duplicate is the normal case.
        code, payload = await _post(client, base, key, "/admin/users", {
            "email": addr,
            "email_confirm": True,
        })
        if code not in (200, 201) and code != 422:
            logger.error(f"supabase_session: admin/users {code} {str(payload)[:200]}")
            return None

        # 2. One-time magic-link hash — never emailed, never returned to a client.
        code, link = await _post(client, base, key, "/admin/generate_link", {
            "type": "magiclink",
            "email": addr,
        })
        token_hash = (link or {}).get("hashed_token") if isinstance(link, dict) else None
        if code != 200 or not token_hash:
            logger.error(f"supabase_session: generate_link {code} {str(link)[:200]}")
            return None

        # 3. Exchange it for a session.
        code, session = await _post(client, base, key, "/verify", {
            "token_hash": token_hash,
            "type": "magiclink",
        })

    if code != 200 or not isinstance(session, dict) or not session.get("access_token"):
        logger.error(f"supabase_session: verify {code} {str(session)[:200]}")
        return None

    return {
        "access_token": session["access_token"],
        "refresh_token": session.get("refresh_token"),
        "expires_in": session.get("expires_in"),
    }
