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
        return "GST verification credits exhausted. Please contact Addrika support to top up."
    if "invalid" in r and "key" in r:
        return "GST verification key invalid. Admin: update the Appyflow key in Integrations."
    if "not found" in r or "invalid gstin" in r or "invalid gst" in r:
        return "GSTIN not found in the GSTN database. Please check the number and try again."
    return (raw or "GST verification failed").strip()


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
    if not appyflow_key and not legacy_key:
        logger.warning("Neither APPYFLOW_API_KEY nor GST_VERIFICATION_API_KEY set")
        return {
            "verified": False,
            "error": "GST verification API not configured",
            "manual_verification_required": True,
        }

    # ---- Try Appyflow first ----
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
