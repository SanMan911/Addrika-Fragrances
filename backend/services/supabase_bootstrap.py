"""
Supabase mirror scheduler loops.

- run_alembic_upgrade_on_boot(): applies pending migrations at server startup.
- periodic_backfill_loop(): every N hours runs an idempotent full re-mirror
  as a safety net for any write path that isn't hooked yet.
"""
from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


def run_alembic_upgrade_on_boot() -> None:
    """Apply Alembic migrations synchronously at startup. Best-effort."""
    try:
        from alembic.config import Config
        from alembic import command
        from pathlib import Path

        cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(cfg, "head")
        logger.info("Supabase mirror: alembic upgrade head OK")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Supabase mirror: alembic upgrade failed (mirror still runs): %s", exc)


async def periodic_backfill_loop(db) -> None:
    """
    Idempotent safety-net backfill. Runs a first pass ~90s after boot, then
    every SUPABASE_MIRROR_BACKFILL_INTERVAL_SECONDS (default 21600 = 6h).
    Never raises.
    """
    from supabase_db import is_enabled
    if not is_enabled():
        return
    interval = int(os.environ.get("SUPABASE_MIRROR_BACKFILL_INTERVAL_SECONDS", "21600"))
    warmup = int(os.environ.get("SUPABASE_MIRROR_BACKFILL_WARMUP_SECONDS", "90"))
    await asyncio.sleep(warmup)
    while True:
        try:
            from scripts.backfill_supabase_mirror import run_backfill
            result = await run_backfill(db, kind="all")
            logger.info("Supabase mirror periodic backfill: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Periodic backfill tick failed: %s", exc)
        await asyncio.sleep(interval)
