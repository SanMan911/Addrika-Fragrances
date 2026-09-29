"""
GST Verification Service.

Primary backend: **Appyflow** (https://appyflow.in/gst-api) — single GET
call returning GSTN-shaped fields. Falls back to gstincheck.co.in if
APPYFLOW_API_KEY isn't configured but GST_VERIFICATION_API_KEY is.
"""
import httpx
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Primary: Appyflow
APPYFLOW_URL = "https://appyflow.in/api/verifyGST"

# Fallback: GSTINCheck.co.in (legacy free-tier)
LEGACY_GST_API_BASE = "https://sheet.gstincheck.co.in/check"


async def _read_keys_async() -> tuple[str, str]:
    """Prefer DB-backed integration keys (admin panel) — fall back to env."""
    appy, legacy = "", ""
    try:
        from routers.admin.admin_integrations import get_effective
        appy = (await get_effective("appyflow_api_key") or "").strip()
    except Exception:
        pass
    if not appy:
        appy = os.environ.get("APPYFLOW_API_KEY", "").strip()
    legacy = os.environ.get("GST_VERIFICATION_API_KEY", "").strip()
    return appy, legacy


def _read_keys() -> tuple[str, str]:
    """Read keys at call time so reloads pick up env changes. Sync
    variant used only when we're not inside an event loop (rare)."""
    return (
        os.environ.get("APPYFLOW_API_KEY", "").strip(),
        os.environ.get("GST_VERIFICATION_API_KEY", "").strip(),
    )


# ---------------------------------------------------------------------------
# Deepvue (pay-per-use wallet) — primary GST provider
# ---------------------------------------------------------------------------
DEEPVUE_BASE = "https://production.deepvue.tech"
_deepvue_token: dict = {"value": None, "expires": 0.0}


def _deepvue_keys() -> tuple[str, str]:
    return (
        os.environ.get("DEEPVUE_CLIENT_ID", "").strip(),
        os.environ.get("DEEPVUE_CLIENT_SECRET", "").strip(),
    )


async def _deepvue_access_token(client_id: str, client_secret: str) -> str:
    """Fetch + cache the 24h bearer token (renew ~1h early)."""
    import time as _t
    now = _t.time()
    if _deepvue_token["value"] and now < _deepvue_token["expires"]:
        return _deepvue_token["value"]
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{DEEPVUE_BASE}/v1/authorize",
            files={
                "client_id": (None, client_id),
                "client_secret": (None, client_secret),
            },
        )
    r.raise_for_status()
    token = (r.json() or {}).get("access_token")
    if not token:
        raise RuntimeError("Deepvue returned no access token")
    _deepvue_token.update(value=token, expires=now + 23 * 3600)
    return token


def _shape_deepvue(payload: dict, gst_number: str) -> dict:
    """Convert Deepvue gstinlite payload into our internal shape."""
    data = payload.get("data") or {}
    err = data.get("error_code")
    if err:
        return {"verified": False, "error": _friendly_upstream_error(data.get("message") or str(err))}
    status = (data.get("sts") or "").strip()
    if not status and not data.get("lgnm"):
        return {"verified": False, "error": "GSTIN not found in the GSTN database. Please check the number and try again."}
    addr = (data.get("pradr") or {}).get("addr") or {}
    addr_parts = [
        addr.get("bno", ""), addr.get("flno", ""), addr.get("bnm", ""),
        addr.get("st", ""), addr.get("loc", ""), addr.get("city", ""),
        addr.get("dst", ""), addr.get("stcd", ""), addr.get("pncd", ""),
    ]
    return {
        "verified": True,
        "provider": "deepvue",
        "gst_number": gst_number,
        "taxpayer_name": data.get("lgnm", ""),
        "trade_name": data.get("tradeNam", ""),
        "status": status,
        "is_active": status.lower() == "active",
        "registration_date": data.get("rgdt", ""),
        "state": addr.get("stcd") or data.get("stj", ""),
        "state_code": gst_number[:2],
        "taxpayer_type": data.get("dty", ""),
        "constitution": data.get("ctb", ""),
        "last_updated": data.get("lstupdt", ""),
        "address": ", ".join(p for p in addr_parts if p),
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


async def _verify_deepvue(gst_number: str, client_id: str, client_secret: str):
    """Return shaped dict on a definitive answer, or None to fall through to
    the next provider on a transient/outage failure."""
    from services.provider_health import log_call as _log_provider
    import asyncio as _aio, time as _t
    _t0 = _t.time()

    async def _call(token: str):
        headers = {
            "Authorization": f"Bearer {token}",
            "x-api-key": client_secret,
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            return await client.get(
                f"{DEEPVUE_BASE}/v1/verification/gstinlite",
                params={"gstin_number": gst_number},
                headers=headers,
            )

    try:
        token = await _deepvue_access_token(client_id, client_secret)
        r = await _call(token)
        if r.status_code in (401, 403):
            # token likely expired — refresh once and retry
            _deepvue_token["expires"] = 0.0
            token = await _deepvue_access_token(client_id, client_secret)
            r = await _call(token)
        _lat = int((_t.time() - _t0) * 1000)

        if r.status_code == 200:
            shaped = _shape_deepvue(r.json(), gst_number)
            _aio.create_task(_log_provider(
                "deepvue", endpoint="gstinlite",
                outcome="success" if shaped.get("verified") else "unknown",
                note=None if shaped.get("verified") else shaped.get("error"),
                latency_ms=_lat,
            ))
            return shaped
        if r.status_code == 422:
            _aio.create_task(_log_provider(
                "deepvue", endpoint="gstinlite", outcome="unknown",
                note="HTTP 422", latency_ms=_lat,
            ))
            return {"verified": False, "error": "GSTIN not found in the GSTN database. Please check the number and try again."}
        if r.status_code == 400:
            # Definitive user error (bad/invalid GSTIN) — don't burn a fallback call
            try:
                msg = (r.json() or {}).get("message", "")
            except Exception:
                msg = ""
            if "gstin" in msg.lower() or "pattern" in msg.lower():
                _aio.create_task(_log_provider(
                    "deepvue", endpoint="gstinlite", outcome="unknown",
                    note=f"HTTP 400 · {msg[:60]}", latency_ms=_lat,
                ))
                return {"verified": False, "error": "GSTIN not found in the GSTN database. Please check the number and try again."}

        # 429 / 5xx / auth — treat as transient outage so we fall through
        _aio.create_task(_log_provider(
            "deepvue", endpoint="gstinlite",
            outcome="auth_error" if r.status_code in (401, 403) else "unknown",
            note=f"HTTP {r.status_code}", latency_ms=_lat,
        ))
        logger.error(f"Deepvue HTTP {r.status_code} · {r.text[:200]}")
        return None
    except httpx.TimeoutException:
        _aio.create_task(_log_provider("deepvue", endpoint="gstinlite", outcome="network_error", note="timeout"))
        logger.error("Deepvue timeout — falling back if possible")
        return None
    except Exception as e:
        _aio.create_task(_log_provider("deepvue", endpoint="gstinlite", outcome="network_error", note=str(e)[:200]))
        logger.error(f"Deepvue error: {e}")
        return None


def _shape_appyflow(payload: dict, gst_number: str) -> dict:
    """Convert Appyflow's `taxpayerInfo` payload into our internal shape."""
    # Appyflow returns HTTP 200 for upstream errors, with `error:true` + message.
    if payload.get("error"):
        return {
            "verified": False,
            "error": _friendly_upstream_error(payload.get("message") or "GST verification failed"),
            "upstream": payload.get("message"),
        }

    info = payload.get("taxpayerInfo") or {}
    if not info:
        return {
            "verified": False,
            "error": _friendly_upstream_error(payload.get("message") or "GST number not found"),
        }
    addr = (info.get("pradr") or {}).get("addr") or {}
    addr_parts = [
        addr.get("bno", ""), addr.get("flno", ""), addr.get("bnm", ""),
        addr.get("st", ""), addr.get("loc", ""), addr.get("city", ""),
        addr.get("dst", ""), addr.get("stcd", ""), addr.get("pncd", ""),
    ]
    status = (info.get("sts") or "").strip()
    return {
        "verified": True,
        "provider": "appyflow",
        "gst_number": gst_number,
        "taxpayer_name": info.get("lgnm", ""),
        "trade_name": info.get("tradeNam", ""),
        "status": status,
        "is_active": status.lower() == "active",
        "registration_date": info.get("rgdt", ""),
        "state": (info.get("pradr") or {}).get("addr", {}).get("stcd")
                 or info.get("stj", ""),
        "state_code": gst_number[:2],
        "taxpayer_type": info.get("dty", ""),
        "constitution": info.get("ctb", ""),
        "last_updated": info.get("lstupdt", ""),
        "address": ", ".join(p for p in addr_parts if p),
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


def _friendly_upstream_error(raw: str) -> str:
    """Map raw upstream GST-provider error strings to human-readable one-liners.
    Shared by both Appyflow and gstincheck legacy so the retailer/admin UI
    never sees dumps like "Credit Expire." or 503 JSON blobs."""
    r = (raw or "").lower()
    if "maintenance" in r or "503" in r or "under maintenance" in r:
        return "GST verification service is temporarily under maintenance. Please try again in a few minutes."
    if "credit" in r or "limit" in r or "insufficient" in r or "expire" in r:
        return "GST verification credits exhausted. Please contact AAROHMM support to top up."
    if "invalid" in r and "key" in r:
        return "GST verification key invalid. Admin: update the Appyflow key in Integrations."
    if "not found" in r or "invalid gstin" in r or "invalid gst" in r:
        return "GSTIN not found in the GSTN database. Please check the number and try again."
    return (raw or "GST verification failed").strip()


def _is_provider_outage(err_msg: str) -> bool:
    """Return True when the failure is a provider-side outage rather than a
    user data problem. Used by b2b_waitlist to decide whether to hard-block
    the signup (user error) or accept-with-caveat (provider down)."""
    e = (err_msg or "").lower()
    return any(k in e for k in (
        "maintenance", "temporarily", "timeout", "unavailable",
        "credit", "expire", "insufficient", "limit",
        "not configured", "all gst providers failed",
        "invalid key", "key invalid", "auth",
        "network", "connection",
    ))


def _shape_legacy(payload: dict, gst_number: str) -> dict:
    """Convert gstincheck payload into our internal shape."""
    if not payload.get("flag"):
        return {
            "verified": False,
            "error": _friendly_upstream_error(payload.get("message", "GST number not found")),
        }
    taxpayer = payload.get("data", {}) or {}
    addr = (taxpayer.get("pradr") or {}).get("addr", {})
    addr_parts = [
        addr.get("bno", ""), addr.get("flno", ""), addr.get("bnm", ""),
        addr.get("st", ""), addr.get("loc", ""), addr.get("city", ""),
        addr.get("dst", ""), addr.get("stcd", ""), addr.get("pncd", ""),
    ]
    status = (taxpayer.get("sts") or "").strip()
    return {
        "verified": True,
        "provider": "gstincheck",
        "gst_number": gst_number,
        "taxpayer_name": taxpayer.get("lgnm", ""),
        "trade_name": taxpayer.get("tradeNam", ""),
        "status": status,
        "is_active": status.lower() == "active",
        "registration_date": taxpayer.get("rgdt", ""),
        "state": taxpayer.get("stj", ""),
        "state_code": gst_number[:2],
        "taxpayer_type": taxpayer.get("dty", ""),
        "constitution": taxpayer.get("ctb", ""),
        "last_updated": taxpayer.get("lstupdt", ""),
        "address": ", ".join(p for p in addr_parts if p),
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


async def verify_gst_number(gst_number: str) -> dict:
    """Verify GST number via Appyflow (preferred) → gstincheck fallback."""
    if not gst_number or len(gst_number) != 15:
        return {"verified": False, "error": "Invalid GST number format"}
    gst_number = gst_number.upper().strip()

    appyflow_key, legacy_key = await _read_keys_async()
    deepvue_id, deepvue_secret = _deepvue_keys()
    if not deepvue_id and not appyflow_key and not legacy_key:
        logger.warning("No GST provider configured (Deepvue / Appyflow / gstincheck)")
        return {
            "verified": False,
            "error": "GST verification API not configured",
            "manual_verification_required": True,
        }

    # ---- Try Deepvue first (pay-per-use wallet) ----
    if deepvue_id and deepvue_secret:
        shaped = await _verify_deepvue(gst_number, deepvue_id, deepvue_secret)
        if shaped is not None:
            # Definitive answer (verified, or a real user-facing reason like
            # "not found") — return it. Transient failures return None above
            # and fall through to Appyflow/legacy.
            if shaped.get("verified") or shaped.get("error"):
                return shaped

    # ---- Try Appyflow next ----
    if appyflow_key:
        from services.provider_health import log_call as _log_provider
        import asyncio as _aio, time as _t
        _t0 = _t.time()
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    APPYFLOW_URL,
                    params={"gstNo": gst_number, "key_secret": appyflow_key},
                )
            _lat = int((_t.time() - _t0) * 1000)
            if r.status_code == 200:
                data = r.json()
                shaped = _shape_appyflow(data, gst_number)
                if shaped.get("verified"):
                    _aio.create_task(_log_provider(
                        "appyflow", endpoint="verifyGST",
                        outcome="success", latency_ms=_lat,
                    ))
                    return shaped
                err = (shaped.get("error") or "").lower()
                outcome = ("credit_exhausted" if ("credit" in err or "limit" in err)
                           else "unknown")
                _aio.create_task(_log_provider(
                    "appyflow", endpoint="verifyGST",
                    outcome=outcome, note=shaped.get("error"), latency_ms=_lat,
                ))
                logger.info(
                    f"Appyflow non-verified for {gst_number}: {shaped.get('error')}"
                )
                # If Appyflow actually spoke to us and gave a meaningful reason
                # (not just a transient network hiccup), keep that friendly
                # reason instead of falling through to the legacy provider
                # which surfaces raw upstream strings like "Credit Expire.".
                if shaped.get("error"):
                    return shaped
            else:
                _aio.create_task(_log_provider(
                    "appyflow", endpoint="verifyGST",
                    outcome="auth_error" if r.status_code in (401, 403) else "unknown",
                    note=f"HTTP {r.status_code}", latency_ms=_lat,
                ))
                logger.error(f"Appyflow HTTP {r.status_code} · {r.text[:200]}")
        except httpx.TimeoutException:
            _aio.create_task(_log_provider(
                "appyflow", endpoint="verifyGST",
                outcome="network_error", note="timeout",
            ))
            logger.error("Appyflow timeout — falling back if possible")
        except Exception as e:
            _aio.create_task(_log_provider(
                "appyflow", endpoint="verifyGST",
                outcome="network_error", note=str(e)[:200],
            ))
            logger.error(f"Appyflow error: {e}")

    # ---- Legacy fallback ----
    if legacy_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                url = f"{LEGACY_GST_API_BASE}/{legacy_key}/{gst_number}"
                r = await client.get(url)
            if r.status_code == 200:
                return _shape_legacy(r.json(), gst_number)
            return {"verified": False, "error": f"Legacy API error: {r.status_code}"}
        except httpx.TimeoutException:
            return {"verified": False, "error": "Verification service timeout"}
        except Exception as e:
            return {"verified": False, "error": str(e)}

    return {"verified": False, "error": "All GST providers failed"}


def normalize_business_name(name: str) -> str:
    """Normalize business name for comparison."""
    if not name:
        return ""
    name = name.upper().strip()
    for suffix in [" PVT LTD", " PRIVATE LIMITED", " LTD", " LIMITED", " LLP", " LLC"]:
        name = name.replace(suffix, "")
    name = ''.join(c for c in name if c.isalnum() or c.isspace())
    name = ' '.join(name.split())
    return name


def match_business_names(provided_name: str, gstn_name: str, gstn_trade_name: str = "") -> dict:
    """Compare provided business name with GSTN records."""
    provided_normalized = normalize_business_name(provided_name)
    legal_normalized = normalize_business_name(gstn_name)
    trade_normalized = normalize_business_name(gstn_trade_name)

    if not provided_normalized:
        return {"matched": False, "match_score": 0, "reason": "No business name provided"}

    if provided_normalized == legal_normalized:
        return {"matched": True, "match_score": 100, "matched_with": "legal_name"}
    if trade_normalized and provided_normalized == trade_normalized:
        return {"matched": True, "match_score": 100, "matched_with": "trade_name"}
    if provided_normalized in legal_normalized or legal_normalized in provided_normalized:
        return {"matched": True, "match_score": 80, "matched_with": "legal_name_partial"}
    if trade_normalized and (
        provided_normalized in trade_normalized or trade_normalized in provided_normalized
    ):
        return {"matched": True, "match_score": 80, "matched_with": "trade_name_partial"}

    provided_words = set(provided_normalized.split())
    legal_words = set(legal_normalized.split())
    if provided_words and legal_words:
        overlap = len(provided_words & legal_words)
        total = max(len(provided_words), len(legal_words))
        score = int((overlap / total) * 100)
        if score >= 60:
            return {"matched": True, "match_score": score, "matched_with": "word_overlap"}

    return {
        "matched": False, "match_score": 0,
        "reason": "Business name does not match GSTN records",
        "gstn_legal_name": gstn_name, "gstn_trade_name": gstn_trade_name,
    }


async def verify_and_match_gst(gst_number: str, provided_business_name: str) -> dict:
    """Verify GST number and match business name."""
    verification = await verify_gst_number(gst_number)
    if not verification.get("verified"):
        return verification
    match_result = match_business_names(
        provided_business_name,
        verification.get("taxpayer_name", ""),
        verification.get("trade_name", ""),
    )
    return {
        **verification,
        "name_match": match_result,
        "fully_verified": verification.get("is_active", False)
        and match_result.get("matched", False),
    }
