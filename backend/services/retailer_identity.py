"""Retailer identity — GSTIN is the login username for every B2B account.

Rules (June 2026, per product owner):
    ▸ A retailer signs in with their 15-character GSTIN. Email is kept for
      password recovery and transactional mail only — never for login.
    ▸ `username` mirrors `gst_number` (uppercase) on every account, so the
      existing username lookup keeps working.
    ▸ Accounts with no GSTIN on file are deactivated (soft-deleted) — the
      portal has no way to identify them any more.
    ▸ One seeded pytest account keeps its legacy username as an explicit
      allowlisted exception.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GSTIN_PATTERN = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')

# Retailers whose pre-migration username must keep working (pytest fixtures).
LEGACY_USERNAME_RETAILER_IDS = {"RTL_TEST_B2B"}
LEGACY_LOGIN_USERNAMES = {"test_b2b_retailer"}


def normalize_gstin(value: str | None) -> str:
    return (value or "").strip().upper().replace(" ", "")


def is_valid_gstin(value: str | None) -> bool:
    return bool(GSTIN_PATTERN.match(normalize_gstin(value)))


async def ensure_gstin_usernames(db) -> dict:
    """Idempotent migration — safe to run on every boot.

    1. username := GSTIN for every live account that has one.
    2. Soft-delete live accounts with no valid GSTIN.
    3. Index `gst_number` (unique only when the data allows it).
    """
    now = datetime.now(timezone.utc).isoformat()
    aligned, deactivated = 0, 0

    cursor = db.retailers.find(
        {"status": {"$ne": "deleted"}},
        {"_id": 0, "retailer_id": 1, "gst_number": 1, "username": 1, "email": 1},
    )
    async for r in cursor:
        gst = normalize_gstin(r.get("gst_number"))
        rid = r.get("retailer_id")

        if not is_valid_gstin(gst):
            await db.retailers.update_one(
                {"retailer_id": rid},
                {"$set": {
                    "status": "deleted",
                    "deleted_at": now,
                    "deleted_reason": "No GSTIN on file — GSTIN is now the required retailer login ID",
                    "gstin_migration_deactivated": True,
                }},
            )
            deactivated += 1
            logger.warning("retailer %s deactivated: no valid GSTIN", rid)
            continue

        updates = {}
        if r.get("gst_number") != gst:
            updates["gst_number"] = gst
        if rid not in LEGACY_USERNAME_RETAILER_IDS and r.get("username") != gst:
            updates["username"] = gst
        if updates:
            updates["gstin_username_synced_at"] = now
            await db.retailers.update_one({"retailer_id": rid}, {"$set": updates})
            aligned += 1

    # Lookup index. Deliberately NOT unique: soft-deleted rows keep their
    # GSTIN (so a closed account can re-register), and duplicates are blocked
    # at the application layer in the register endpoints instead.
    try:
        await db.retailers.create_index("gst_number", name="gst_number_idx")
    except Exception as e:  # noqa: BLE001
        logger.warning("gst_number index not created: %s", e)

    if aligned or deactivated:
        logger.info("GSTIN login migration: %d aligned, %d deactivated", aligned, deactivated)
    return {"aligned": aligned, "deactivated": deactivated}


# ---------------------------------------------------------------- login guard
MAX_FAILED_LOGINS = 10
LOCKOUT_MINUTES = 15


async def is_locked_out(db, identifier: str) -> bool:
    row = await db.retailer_login_attempts.find_one({"identifier": identifier})
    if not row:
        return False
    if int(row.get("failures") or 0) < MAX_FAILED_LOGINS:
        return False
    last = row.get("last_failed_at")
    if not last:
        return False
    last_dt = datetime.fromisoformat(last)
    age_min = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60
    if age_min >= LOCKOUT_MINUTES:
        await db.retailer_login_attempts.delete_one({"identifier": identifier})
        return False
    return True


async def record_failed_login(db, identifier: str) -> None:
    await db.retailer_login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"failures": 1},
         "$set": {"last_failed_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def clear_failed_logins(db, identifier: str) -> None:
    await db.retailer_login_attempts.delete_one({"identifier": identifier})
