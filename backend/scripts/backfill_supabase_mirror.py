"""
Idempotent full-catalog backfill from MongoDB into Supabase mirror tables.

Run standalone:
    python -m scripts.backfill_supabase_mirror

Or from an admin request via `POST /api/admin/supabase-mirror/backfill`.

The backfill uses the same helpers as live writes (mirror_*_upsert) but
awaits their internal work directly so we get accurate counters. It is
safe to re-run (ON CONFLICT DO UPDATE).
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

# Allow running as `python scripts/backfill_supabase_mirror.py`
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from supabase_db import is_enabled, session_factory  # noqa: E402
from services.supabase_sync import (  # noqa: E402
    _MIRROR_BLOCKLIST,
    _TYPED_COLLECTIONS,
    _collection_row,
    _product_row,
    _upsert_collection,
    _upsert_product,
    _upsert_user,
    _user_row,
)

logger = logging.getLogger("backfill")


async def _backfill_users(db) -> int:
    n = 0
    factory = session_factory()
    if factory is None:
        return 0
    async with factory() as session:
        async for doc in db.users.find({}, {"password_hash": 0}):
            row = _user_row(doc, kind="admin" if doc.get("is_admin") else "b2c")
            if not row.get("id"):
                continue
            try:
                await _upsert_user(session, row)
                n += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("user %s failed: %s", row.get("id"), exc)
    return n


async def _backfill_retailers(db) -> int:
    n = 0
    factory = session_factory()
    if factory is None:
        return 0
    async with factory() as session:
        async for doc in db.retailers.find({}, {"password_hash": 0}):
            doc["id"] = doc.get("retailer_id") or doc.get("id") or str(doc.get("_id"))
            row = _user_row(doc, kind="b2b")
            if not row.get("id"):
                continue
            try:
                await _upsert_user(session, row)
                n += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("retailer %s failed: %s", row.get("id"), exc)
    return n


async def _backfill_products(db) -> int:
    n = 0
    factory = session_factory()
    if factory is None:
        return 0
    async with factory() as session:
        async for doc in db.products.find({}):
            doc["id"] = doc.get("id") or doc.get("product_id") or str(doc.get("_id"))
            row = _product_row(doc, channel="b2c")
            if not row.get("id"):
                continue
            try:
                await _upsert_product(session, row)
                n += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("product %s failed: %s", row.get("id"), exc)
    return n


async def _backfill_b2b_products(db) -> int:
    n = 0
    factory = session_factory()
    if factory is None:
        return 0
    async with factory() as session:
        async for doc in db.b2b_products.find({}):
            doc["id"] = doc.get("id") or str(doc.get("_id"))
            row = _product_row(doc, channel="b2b")
            if not row.get("id"):
                continue
            try:
                await _upsert_product(session, row)
                n += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("b2b product %s failed: %s", row.get("id"), exc)
    return n


async def _backfill_all_collections(db) -> dict:
    """Mirror every non-typed, non-blocklisted Mongo collection into
    collections_mirror. Returns per-collection counters."""
    factory = session_factory()
    if factory is None:
        return {}
    counters: dict = {}
    try:
        names = await db.list_collection_names()
    except Exception as exc:  # noqa: BLE001
        logger.warning("could not list collections: %s", exc)
        return {}
    for name in names:
        if name.startswith("system."):
            continue
        if name in _TYPED_COLLECTIONS or name in _MIRROR_BLOCKLIST:
            continue
        n = 0
        try:
            async with factory() as session:
                async for doc in db[name].find({}):
                    row = _collection_row(name, doc)
                    if not row:
                        continue
                    try:
                        await _upsert_collection(session, row)
                        n += 1
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("%s/%s failed: %s", name, row.get("doc_id"), exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s backfill failed: %s", name, exc)
        counters[name] = n
    return counters


async def run_backfill(db, kind: str = "all") -> dict:
    if not is_enabled():
        return {"enabled": False, "skipped": True}
    counters: dict = {}
    if kind in ("all", "users"):
        counters["users"] = await _backfill_users(db)
    if kind in ("all", "retailers"):
        counters["retailers"] = await _backfill_retailers(db)
    if kind in ("all", "products"):
        counters["products"] = await _backfill_products(db)
    if kind in ("all", "b2b_products"):
        counters["b2b_products"] = await _backfill_b2b_products(db)
    if kind in ("all", "collections"):
        counters["collections"] = await _backfill_all_collections(db)
    return {"enabled": True, "kind": kind, **counters}


async def _main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]
    try:
        result = await run_backfill(db, kind="all")
        print("BACKFILL_RESULT:", result)
    finally:
        client.close()
        from supabase_db import dispose
        await dispose()


if __name__ == "__main__":
    asyncio.run(_main())
