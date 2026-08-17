"""
Supabase Postgres async engine + session factory.

MongoDB remains the source of truth. Supabase is a downstream MIRROR only.
Writes here MUST be non-blocking (asyncio.create_task). See services/supabase_sync.py.

Uses the Supabase Transaction Pooler URI on port 6543. `statement_cache_size=0`
is REQUIRED — the pooler does not support prepared statements.
"""
from __future__ import annotations

import os
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)

logger = logging.getLogger(__name__)


def _mirror_enabled() -> bool:
    return os.environ.get("SUPABASE_MIRROR_ENABLED", "false").lower() in ("1", "true", "yes")


def _async_url() -> Optional[str]:
    raw = os.environ.get("SUPABASE_DB_URL")
    if not raw:
        return None
    if raw.startswith("postgresql+asyncpg://"):
        return raw
    if raw.startswith("postgresql://"):
        return "postgresql+asyncpg://" + raw[len("postgresql://") :]
    return raw


def _sync_url() -> Optional[str]:
    """Sync URL used by Alembic and the backfill script."""
    raw = os.environ.get("SUPABASE_DB_URL")
    if not raw:
        return None
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://") :]
    return raw


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> Optional[AsyncEngine]:
    """Lazy engine. Returns None when the mirror is disabled or the URL is missing."""
    global _engine, _session_factory
    if not _mirror_enabled():
        return None
    if _engine is not None:
        return _engine
    url = _async_url()
    if not url:
        logger.warning("SUPABASE_DB_URL missing — mirror disabled")
        return None
    _engine = create_async_engine(
        url,
        pool_size=5,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=False,
        echo=False,
        connect_args={
            "statement_cache_size": 0,  # CRITICAL for transaction pooler
            "command_timeout": 15,
            "server_settings": {"application_name": "addrika-mirror"},
        },
    )
    _session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    logger.info("Supabase mirror engine initialised")
    return _engine


def session_factory() -> Optional[async_sessionmaker[AsyncSession]]:
    if get_engine() is None:
        return None
    return _session_factory


async def dispose() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None


def is_enabled() -> bool:
    return _mirror_enabled() and bool(os.environ.get("SUPABASE_DB_URL"))
