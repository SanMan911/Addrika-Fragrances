"""
Auto-archive admin ↔ retailer message threads that have been idle for
more than 90 days. Just flags `archived: true` on the thread doc; no
status change on the retailer. Thread listing can opt-in to include
archived threads via a query flag.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

IDLE_DAYS = 90


async def archive_idle_threads(db) -> int:
    """Flag any non-archived thread whose last_message_at is older than
    90 days. Returns the number of threads flagged.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=IDLE_DAYS)).isoformat()
    res = await db.retailer_admin_threads.update_many(
        {
            "$and": [
                {"last_message_at": {"$lt": cutoff}},
                {"$or": [{"archived": {"$ne": True}}, {"archived": {"$exists": False}}]},
            ]
        },
        {
            "$set": {
                "archived": True,
                "archived_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if res.modified_count:
        logger.info(
            f"Auto-archived {res.modified_count} admin-retailer threads idle > {IDLE_DAYS} days"
        )
    return res.modified_count


async def unarchive_thread(db, thread_id: str) -> bool:
    """Reopen an archived thread (used when a new message arrives)."""
    res = await db.retailer_admin_threads.update_one(
        {"thread_id": thread_id, "archived": True},
        {"$set": {"archived": False}, "$unset": {"archived_at": ""}},
    )
    return res.modified_count > 0


async def thread_archive_scheduler_loop(db) -> None:
    """Runs every 24 hours."""
    await asyncio.sleep(60)  # Small delay after startup
    while True:
        try:
            await archive_idle_threads(db)
        except Exception as e:  # pragma: no cover
            logger.error(f"Thread archive scheduler error: {e}")
        await asyncio.sleep(24 * 3600)
