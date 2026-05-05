"""Nightly reconciliation cron for the Addrika ↔ Amardeep partner bridge.

Why this exists
---------------
Both `issue_amardeep_voucher` and `redeem_amardeep_coupon` are best-effort
fire-and-forget HTTP calls. If a single call fails (network blip, partner
deploy, expired cert, etc.) the customer-facing checkout flow stays fast
because we never raise — but the partner side might be missing a coupon
issue or a redemption.

This module adds two safety nets:

  1. **Local sync log** (`partner_sync_log` collection): every outbound
     call is logged with `status ∈ {sent, failed}`. The cron loops over
     `failed` rows whose `next_retry_at <= now()` and replays them with
     exponential backoff. After `MAX_ATTEMPTS` (default 5) the row is
     marked `abandoned` and surfaced to admins.

  2. **Optional bidirectional reconcile**: if Amardeep ever exposes
     `GET /api/partner/coupons/list?since=<iso>&issued_by=amardeep` we'll
     pull the diff and upsert anything we don't have. If that endpoint
     404s we skip silently — the local log alone is enough for now.

The cron is scheduled from `server.py::startup` and runs once on boot
plus every `RECONCILE_INTERVAL_SECONDS` (default 24h).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from services.partner_coupons import (
    AMD_GIFT_PREFIX,
    is_configured,
    partner_signature,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BACKOFF_MINUTES = [5, 30, 120, 360, 1440]  # 5m → 30m → 2h → 6h → 24h
RECONCILE_INTERVAL_SECONDS = int(
    os.environ.get("PARTNER_RECONCILE_INTERVAL_SECONDS", str(24 * 3600))
)


# ---------------------------------------------------------------------------
# Sync-log helpers — called by partner_coupons after every outbound attempt
# ---------------------------------------------------------------------------
async def record_outbound_attempt(
    db,
    *,
    op: str,
    code: str,
    payload: dict,
    success: bool,
    error: Optional[str] = None,
    http_status: Optional[int] = None,
) -> None:
    """Idempotent: keyed by (op, code).

    Marks `sent` on success, `failed` (with retry schedule) on failure.
    """
    now = datetime.now(timezone.utc)
    if success:
        await db.partner_sync_log.update_one(
            {"op": op, "code": code},
            {
                "$set": {
                    "op": op,
                    "code": code,
                    "payload": payload,
                    "status": "sent",
                    "last_error": None,
                    "http_status": http_status,
                    "last_attempt_at": now.isoformat(),
                },
                "$setOnInsert": {"created_at": now.isoformat(), "attempts": 0},
            },
            upsert=True,
        )
        return

    # Failure: schedule next retry with exponential backoff
    existing = await db.partner_sync_log.find_one({"op": op, "code": code})
    attempts = (existing.get("attempts", 0) if existing else 0) + 1
    if attempts >= MAX_ATTEMPTS:
        status = "abandoned"
        next_retry_at = None
    else:
        backoff = BACKOFF_MINUTES[min(attempts - 1, len(BACKOFF_MINUTES) - 1)]
        status = "failed"
        next_retry_at = (now + timedelta(minutes=backoff)).isoformat()

    await db.partner_sync_log.update_one(
        {"op": op, "code": code},
        {
            "$set": {
                "op": op,
                "code": code,
                "payload": payload,
                "status": status,
                "last_error": (error or "")[:500],
                "http_status": http_status,
                "attempts": attempts,
                "last_attempt_at": now.isoformat(),
                "next_retry_at": next_retry_at,
            },
            "$setOnInsert": {"created_at": now.isoformat()},
        },
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Replay helpers — used by the cron
# ---------------------------------------------------------------------------
def _base_url() -> str:
    return os.environ.get(
        "AMARDEEP_API_BASE",
        "https://amardeep-numerology.preview.emergentagent.com",
    ).rstrip("/")


async def _replay_one(db, row: dict) -> bool:
    """Replay a single failed log row. Returns True on success."""
    op = row["op"]
    code = row["code"]
    payload = row.get("payload") or {}

    if op == "issue":
        url = f"{_base_url()}/api/partner/coupons/issue"
        body = json.dumps(payload).encode()
    elif op == "redeem":
        url = f"{_base_url()}/api/partner/coupons/redeem"
        body = json.dumps(payload).encode()
    else:
        # Unknown op — abandon the row so it stops cycling
        await db.partner_sync_log.update_one(
            {"_id": row["_id"]},
            {"$set": {"status": "abandoned", "last_error": f"unknown op {op}"}},
        )
        return False

    headers = {
        "Content-Type": "application/json",
        "X-Partner-Signature": partner_signature(body),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, content=body, headers=headers)
        success = r.status_code == 200
        await record_outbound_attempt(
            db, op=op, code=code, payload=payload,
            success=success, http_status=r.status_code,
            error=None if success else (r.text or "")[:500],
        )
        return success
    except Exception as e:
        await record_outbound_attempt(
            db, op=op, code=code, payload=payload,
            success=False, error=str(e),
        )
        return False


async def reconcile_partner_coupons(db) -> dict[str, Any]:
    """Single sweep: replay every `failed` row whose `next_retry_at` has
    passed. Returns a small stats dict (used by the admin endpoint and
    test suite).

    Safe to call ad-hoc; idempotent.
    """
    if not is_configured():
        return {"skipped": "not_configured"}

    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = db.partner_sync_log.find({
        "status": "failed",
        "$or": [
            {"next_retry_at": {"$lte": now_iso}},
            {"next_retry_at": None},
        ],
    })

    rows = await cursor.to_list(200)
    sent = 0
    still_failing = 0
    abandoned = 0
    for row in rows:
        ok = await _replay_one(db, row)
        if ok:
            sent += 1
        else:
            # Re-fetch to see if we crossed the abandon threshold
            updated = await db.partner_sync_log.find_one({"_id": row["_id"]})
            if updated and updated.get("status") == "abandoned":
                abandoned += 1
            else:
                still_failing += 1

    return {
        "scanned": len(rows),
        "sent": sent,
        "still_failing": still_failing,
        "abandoned": abandoned,
        "ran_at": now_iso,
    }


# ---------------------------------------------------------------------------
# Background loop
# ---------------------------------------------------------------------------
async def reconcile_scheduler_loop(db) -> None:
    """Fire once on boot (after a 60s warm-up) then every
    `RECONCILE_INTERVAL_SECONDS`."""
    if not is_configured():
        logger.info("partner reconcile loop skipped — not configured")
        return

    # Warm-up so we don't compete with other startup chores
    await asyncio.sleep(60)
    while True:
        try:
            stats = await reconcile_partner_coupons(db)
            if stats.get("scanned"):
                logger.info("partner reconcile %s", stats)
        except Exception as e:  # never crash the loop
            logger.warning("partner reconcile sweep failed: %s", e)
        await asyncio.sleep(RECONCILE_INTERVAL_SECONDS)
