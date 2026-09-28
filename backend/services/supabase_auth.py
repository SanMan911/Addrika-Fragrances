"""Supabase Auth verification for the Aarohmm B2B mobile app.

The mobile app signs a retailer in with Supabase Auth (email OTP) and sends
the resulting access token as `Authorization: Bearer <jwt>`.

We verify that token against the project's published JWKS (asymmetric ES256
signing keys) — so no shared secret has to live on the server — then resolve
the retailer record the email belongs to.

Reads in the app go straight to Postgres under RLS. This module exists for
the WRITE side: placing orders and raising grievances still run through
FastAPI so pricing, stock and payments stay server-authoritative.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import jwt
from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)

_jwk_client: Optional[jwt.PyJWKClient] = None


def _supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise HTTPException(
            status_code=503, detail="Supabase is not configured on this server"
        )
    return url


def _jwks() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        # PyJWKClient keeps its own cache, so this is cheap after the first call.
        _jwk_client = jwt.PyJWKClient(
            f"{_supabase_url()}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwk_client


def verify_supabase_token(token: str) -> dict:
    """Return the verified JWT claims, or raise 401."""
    try:
        signing_key = _jwks().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{_supabase_url()}/auth/v1",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except Exception as e:
        logger.warning(f"Supabase token rejected: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")

    if not claims.get("email"):
        raise HTTPException(status_code=401, detail="Session is missing an email claim")
    return claims


async def get_app_retailer(
    db,
    authorization: Optional[str] = Header(None),
) -> dict:
    """FastAPI dependency: verified Supabase user → active retailer record.

    A signed-in Supabase user who is not a known active retailer gets 403 —
    signing up in Supabase Auth alone grants no B2B access.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    claims = verify_supabase_token(authorization.split(" ", 1)[1].strip())
    email = (claims.get("email") or "").lower()

    retailer = await db.retailers.find_one(
        {"email": {"$regex": f"^{_escape(email)}$", "$options": "i"}, "status": "active"}
    )
    if not retailer:
        raise HTTPException(
            status_code=403,
            detail=(
                "This email is not linked to an approved Aarohmm retailer account. "
                "Please contact contact.us@centraders.com."
            ),
        )
    return retailer


def _escape(value: str) -> str:
    import re

    return re.escape(value)
