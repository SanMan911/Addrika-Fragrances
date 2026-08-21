"""
Non-blocking Supabase mirror sync service.

Public API — call these from MongoDB write paths:
  mirror_user_upsert(user_doc, kind)
  mirror_user_delete(user_id)
  mirror_product_upsert(product_doc, channel)
  mirror_product_delete(product_id)

Each helper wraps the actual write in asyncio.create_task so the caller
never awaits Supabase. A dead-letter queue records failures for retry.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from supabase_db import is_enabled, session_factory
from models.mirror import CollectionMirror, ProductMirror, SyncDeadLetter, UserMirror

logger = logging.getLogger(__name__)


# Backoff schedule (minutes) — matches partner_reconcile.py conventions
_BACKOFF_MINUTES = [5, 30, 120, 360, 1440]

# Per-entity FIFO locks so back-to-back writes for the same (entity, id) can
# not reorder in the fire-and-forget task queue. Key: f"{entity}:{entity_id}".
# Small unbounded growth (one asyncio.Lock per unique key touched) is
# acceptable — a typical mirror set has thousands of ids at most.
_entity_locks: dict[str, asyncio.Lock] = {}
_MAX_ATTEMPTS = len(_BACKOFF_MINUTES)


# Collections that must NEVER leave MongoDB. Session tokens, credentials,
# OTPs, and OAuth refresh tokens live here and would be a breach if mirrored.
_MIRROR_BLOCKLIST = frozenset(
    {
        "admin_credentials",
        "admin_2fa_tokens",
        "admin_recovery_tokens",
        "admin_sessions",
        "retailer_sessions",
        "user_sessions",
        "sessions",
        "otp_verifications",
        "store_pickup_otps",
        "payment_sessions",
        "zoho_tokens",
    }
)

# These collections are already mirrored into typed tables — skip them
# in the generic collections_mirror to avoid duplicate storage.
_TYPED_COLLECTIONS = frozenset({"users", "retailers", "products", "b2b_products"})

# Keys stripped from every JSONB payload before it lands in Supabase.
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "password_hash",
        "session_token",
        "refresh_token",
        "access_token",
        "bearer_token",
        "api_key",
        "secret",
        "secret_key",
        "reset_token",
        "otp",
        "otp_hash",
        "verification_code",
        "two_factor_secret",
    }
)


def _sanitize(value: Any) -> Any:
    """Recursively strip sensitive keys and coerce Mongo/BSON types."""
    if isinstance(value, dict):
        return {
            str(k): _sanitize(v)
            for k, v in value.items()
            if str(k).lower() not in _SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.isoformat()
    if hasattr(value, "binary") and hasattr(value, "generation_time"):
        return str(value)
    return value


def _jsonable(value: Any) -> Any:
    """Recursively convert Mongo/BSON types to JSON-serialisable primitives.

    Unlike _sanitize, this keeps ALL keys — used for typed mirror rows where
    the caller already knows what it's writing.
    """
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.isoformat()
    # Motor returns ObjectId — stringify
    if hasattr(value, "binary") and hasattr(value, "generation_time"):
        return str(value)
    return value


def _extract_id(doc: dict) -> Optional[str]:
    for key in ("id", "product_id", "user_id", "retailer_id", "_id"):
        v = doc.get(key) if isinstance(doc, dict) else None
        if v is not None:
            return str(v)
    return None


def _first(doc: dict, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if isinstance(doc, dict) and k in doc and doc[k] is not None:
            return doc[k]
    return default


def _as_datetime(value: Any) -> Optional[datetime]:
    """Coerce ISO strings / datetimes to timezone-aware datetime. None on failure."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Python < 3.11 doesn't accept trailing 'Z'; normalise
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _user_row(doc: dict, kind: str) -> dict:
    uid = _extract_id(doc)
    return {
        "id": uid,
        "kind": kind,
        "email": _first(doc, "email", "primary_email"),
        "phone": _first(doc, "phone", "phone_number", "mobile"),
        "name": _first(doc, "name", "full_name", "customer_name"),
        "business_name": _first(doc, "business_name", "trade_name"),
        "gst_number": _first(doc, "gst_number", "gstin"),
        "status": _first(doc, "status", "kyc_status"),
        "is_verified": bool(_first(doc, "is_verified", default=False)),
        "is_admin": kind == "admin" or bool(_first(doc, "is_admin", default=False)),
        "city": _first(doc, "city"),
        "state": _first(doc, "state"),
        "pincode": _first(doc, "pincode", "pin_code"),
        "raw": _jsonable(doc),
        "mongo_created_at": _as_datetime(_first(doc, "created_at")),
        "mongo_updated_at": _as_datetime(_first(doc, "updated_at")),
    }


def _product_row(doc: dict, channel: str) -> dict:
    pid = _extract_id(doc)
    price = _first(doc, "price", "price_inr", "unit_price_inr", "wholesale_price")
    mrp = _first(doc, "mrp", "mrp_inr")
    stock = _first(doc, "stock_pieces")

    # B2C products store variants inside `sizes[]` — pull the first size's
    # price/mrp/stock so the mirror rows aren't blank on the storefront.
    sizes = doc.get("sizes") if isinstance(doc.get("sizes"), list) else []
    if sizes:
        first = sizes[0] if isinstance(sizes[0], dict) else {}
        if price is None:
            price = first.get("price") or first.get("mrp")
        if mrp is None:
            mrp = first.get("mrp")
        if stock is None:
            # Sum stock across sizes when the b2b enricher has populated `stock`
            totals = [int(s.get("stock") or 0) for s in sizes if isinstance(s, dict) and s.get("stock") is not None]
            stock = sum(totals) if totals else None

    # B2B SKUs store per-unit price under `mrp_per_unit` and per-carton price
    # under `price_per_carton`. Surface `mrp_per_unit` as the canonical
    # `price_inr` so downstream consumers (mobile catalogue, analytics)
    # never see NULL when the wholesale price is actually known.
    if channel == "b2b":
        if price is None:
            price = _first(doc, "mrp_per_unit", "price_per_carton", "price_per_box")
        if mrp is None:
            mrp = _first(doc, "mrp_per_unit")

    # B2C uses `isActive` (camelCase); B2B uses `is_active`. Honour both.
    is_active = _first(doc, "is_active", "isActive", default=True)

    return {
        "id": pid,
        "channel": channel,
        "name": str(_first(doc, "name", "title", default="")),
        "slug": _first(doc, "slug", "product_id"),
        "category": _first(doc, "category"),
        "hsn": _first(doc, "hsn", "hsn_code"),
        "price_inr": price,
        "mrp_inr": mrp,
        "gst_pct": _first(doc, "gst_pct", "gst_percent"),
        "stock_pieces": stock,
        "is_active": bool(is_active),
        "ready_to_use": bool(_first(doc, "ready_to_use", default=False)),
        "raw": _jsonable(doc),
        "mongo_updated_at": _as_datetime(_first(doc, "updated_at")),
    }


async def _record_dead_letter(
    session: AsyncSession,
    *,
    entity: str,
    op: str,
    entity_id: str,
    payload: dict,
    error: str,
) -> None:
    row = SyncDeadLetter(
        entity=entity,
        op=op,
        entity_id=entity_id,
        payload=payload,
        error=error[:2000],
        attempts=1,
        next_retry_at=datetime.now(timezone.utc) + timedelta(minutes=_BACKOFF_MINUTES[0]),
        status="pending",
    )
    session.add(row)
    await session.commit()


async def _upsert_user(session: AsyncSession, row: dict) -> None:
    stmt = pg_insert(UserMirror).values(**row)
    update_cols = {c: stmt.excluded[c] for c in row.keys() if c != "id"}
    stmt = stmt.on_conflict_do_update(index_elements=[UserMirror.id], set_=update_cols)
    await session.execute(stmt)
    await session.commit()


async def _upsert_product(session: AsyncSession, row: dict) -> None:
    stmt = pg_insert(ProductMirror).values(**row)
    update_cols = {c: stmt.excluded[c] for c in row.keys() if c != "id"}
    stmt = stmt.on_conflict_do_update(index_elements=[ProductMirror.id], set_=update_cols)
    await session.execute(stmt)
    await session.commit()


async def _delete_user(session: AsyncSession, uid: str) -> None:
    await session.execute(delete(UserMirror).where(UserMirror.id == uid))
    await session.commit()


async def _delete_product(session: AsyncSession, pid: str) -> None:
    await session.execute(delete(ProductMirror).where(ProductMirror.id == pid))
    await session.commit()


async def _upsert_collection(session: AsyncSession, row: dict) -> None:
    stmt = pg_insert(CollectionMirror).values(**row)
    update_cols = {c: stmt.excluded[c] for c in row.keys() if c not in ("collection", "doc_id")}
    stmt = stmt.on_conflict_do_update(
        index_elements=[CollectionMirror.collection, CollectionMirror.doc_id],
        set_=update_cols,
    )
    await session.execute(stmt)
    await session.commit()


async def _delete_collection(session: AsyncSession, collection: str, doc_id: str) -> None:
    await session.execute(
        delete(CollectionMirror).where(
            (CollectionMirror.collection == collection)
            & (CollectionMirror.doc_id == doc_id)
        )
    )
    await session.commit()


def _collection_doc_id(doc: dict) -> Optional[str]:
    """Prefer business keys, fall back to _id string."""
    for key in ("id", "product_id", "user_id", "retailer_id", "order_id", "message_id", "post_id", "slug"):
        v = doc.get(key) if isinstance(doc, dict) else None
        if v is not None:
            return str(v)
    _id = doc.get("_id") if isinstance(doc, dict) else None
    return str(_id) if _id is not None else None


def _collection_row(collection: str, doc: dict) -> Optional[dict]:
    doc_id = _collection_doc_id(doc)
    if not doc_id:
        return None
    return {
        "collection": collection,
        "doc_id": doc_id,
        "raw": _sanitize(doc),
        "mongo_updated_at": _as_datetime(_first(doc, "updated_at", "modified_at", "created_at")),
    }


async def _run(entity: str, op: str, entity_id: str, payload: dict, work) -> None:
    factory = session_factory()
    if factory is None:
        return
    # Per-entity FIFO: back-to-back upsert/delete on the same (entity, id)
    # must complete in the order they were enqueued. Without this, a fast
    # PUT-then-DELETE sequence can reorder and leave a stale row behind.
    key = f"{entity}:{entity_id}"
    lock = _entity_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _entity_locks[key] = lock
    async with lock:
        try:
            async with factory() as session:
                await work(session)
        except Exception as exc:  # noqa: BLE001 — never let mirror errors bubble
            logger.warning("Supabase mirror %s/%s for %s failed: %s", entity, op, entity_id, exc)
            try:
                async with factory() as session:
                    await _record_dead_letter(
                        session,
                        entity=entity,
                        op=op,
                        entity_id=entity_id,
                        payload=payload,
                        error=str(exc),
                    )
            except Exception as inner:  # noqa: BLE001
                logger.error("Failed to record dead-letter: %s", inner)


def mirror_user_upsert(user_doc: dict, kind: str = "b2c") -> None:
    """Fire-and-forget upsert. Never raises."""
    if not is_enabled() or not isinstance(user_doc, dict):
        return
    uid = _extract_id(user_doc)
    if not uid:
        return
    row = _user_row(user_doc, kind)

    async def work(session: AsyncSession) -> None:
        await _upsert_user(session, row)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run("user", "upsert", uid, row, work))
    except RuntimeError:
        # No running loop (e.g. sync context) — swallow silently
        pass


def mirror_user_delete(user_id: str) -> None:
    if not is_enabled() or not user_id:
        return

    async def work(session: AsyncSession) -> None:
        await _delete_user(session, str(user_id))

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run("user", "delete", str(user_id), {"id": str(user_id)}, work))
    except RuntimeError:
        pass


def mirror_product_upsert(product_doc: dict, channel: str = "b2c") -> None:
    if not is_enabled() or not isinstance(product_doc, dict):
        return
    pid = _extract_id(product_doc)
    if not pid:
        return
    row = _product_row(product_doc, channel)

    async def work(session: AsyncSession) -> None:
        await _upsert_product(session, row)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run("product", "upsert", pid, row, work))
    except RuntimeError:
        pass


def mirror_product_delete(product_id: str) -> None:
    if not is_enabled() or not product_id:
        return

    async def work(session: AsyncSession) -> None:
        await _delete_product(session, str(product_id))

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            _run("product", "delete", str(product_id), {"id": str(product_id)}, work)
        )
    except RuntimeError:
        pass


def mirror_collection_upsert(collection: str, doc: dict) -> None:
    """
    Generic fire-and-forget upsert for any non-typed collection.
    Silently no-ops for blocklisted (session/credential) collections.
    """
    if not is_enabled() or not isinstance(doc, dict):
        return
    if not collection or collection in _MIRROR_BLOCKLIST or collection in _TYPED_COLLECTIONS:
        return
    row = _collection_row(collection, doc)
    if not row:
        return

    async def work(session: AsyncSession) -> None:
        await _upsert_collection(session, row)

    entity_id = f"{collection}|{row['doc_id']}"
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run("collection", "upsert", entity_id, row, work))
    except RuntimeError:
        pass


def mirror_collection_delete(collection: str, doc_id: str) -> None:
    if not is_enabled() or not collection or not doc_id:
        return
    if collection in _MIRROR_BLOCKLIST or collection in _TYPED_COLLECTIONS:
        return

    async def work(session: AsyncSession) -> None:
        await _delete_collection(session, collection, str(doc_id))

    entity_id = f"{collection}|{doc_id}"
    payload = {"collection": collection, "doc_id": str(doc_id)}
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run("collection", "delete", entity_id, payload, work))
    except RuntimeError:
        pass


async def mirror_order_snapshot(
    db,
    *,
    order_number: Optional[str] = None,
    order_id: Optional[str] = None,
    collection: str = "orders",
) -> None:
    """
    Re-read an order from Mongo and mirror the fresh snapshot to Supabase.

    Call this AFTER any db.orders.update_one / db.b2b_orders.update_one so the
    mirror stays in sync when we don't have the full updated doc in-hand.
    Safe to call from async request handlers — never raises.

    Args:
        db: Motor AsyncIOMotorDatabase instance.
        order_number: For B2C orders (`orders` collection, keyed by `order_number`).
        order_id:     For B2B orders (`b2b_orders` collection, keyed by `order_id`).
        collection:   "orders" (default) or "b2b_orders".
    """
    if not is_enabled():
        return
    key_field = "order_number" if collection == "orders" else "order_id"
    key_value = order_number if collection == "orders" else order_id
    if not key_value:
        return
    try:
        doc = await db[collection].find_one({key_field: key_value})
        if doc:
            mirror_collection_upsert(collection, doc)
    except Exception as exc:  # noqa: BLE001 — never let mirror errors bubble
        logger.warning(
            "mirror_order_snapshot failed (%s=%s, collection=%s): %s",
            key_field, key_value, collection, exc,
        )


# ---------------------------------------------------------------------------
# Dead-letter retry
# ---------------------------------------------------------------------------

async def _replay_row(session: AsyncSession, row: SyncDeadLetter) -> bool:
    """Attempt to re-execute a dead-letter row. Returns True if it succeeded."""
    payload = row.payload or {}
    try:
        if row.entity == "user" and row.op == "upsert":
            await _upsert_user(session, payload)
        elif row.entity == "user" and row.op == "delete":
            await _delete_user(session, str(payload.get("id") or row.entity_id))
        elif row.entity == "product" and row.op == "upsert":
            await _upsert_product(session, payload)
        elif row.entity == "product" and row.op == "delete":
            await _delete_product(session, str(payload.get("id") or row.entity_id))
        elif row.entity == "collection" and row.op == "upsert":
            await _upsert_collection(session, payload)
        elif row.entity == "collection" and row.op == "delete":
            await _delete_collection(
                session,
                str(payload.get("collection")),
                str(payload.get("doc_id") or row.entity_id.split("|", 1)[-1]),
            )
        else:
            raise ValueError(f"Unknown dead-letter row: {row.entity}/{row.op}")
        return True
    except Exception as exc:  # noqa: BLE001
        row.error = str(exc)[:2000]
        return False


async def replay_dead_letter(limit: int = 100) -> dict:
    """
    Drain up to `limit` due dead-letter rows. Returns a counters dict:
        {sent, failed, abandoned, checked}
    """
    factory = session_factory()
    if factory is None:
        return {"sent": 0, "failed": 0, "abandoned": 0, "checked": 0, "skipped": "mirror_disabled"}

    now = datetime.now(timezone.utc)
    sent = failed = abandoned = 0

    async with factory() as session:
        result = await session.execute(
            select(SyncDeadLetter)
            .where(SyncDeadLetter.status == "pending")
            .where(SyncDeadLetter.next_retry_at <= now)
            .order_by(SyncDeadLetter.next_retry_at.asc())
            .limit(limit)
        )
        rows = list(result.scalars())
        checked = len(rows)

        for row in rows:
            ok = await _replay_row(session, row)
            if ok:
                row.status = "sent"
                sent += 1
            else:
                row.attempts = (row.attempts or 0) + 1
                if row.attempts >= _MAX_ATTEMPTS:
                    row.status = "abandoned"
                    abandoned += 1
                else:
                    delay = _BACKOFF_MINUTES[min(row.attempts, _MAX_ATTEMPTS - 1)]
                    row.next_retry_at = now + timedelta(minutes=delay)
                    failed += 1
            session.add(row)
        await session.commit()

    return {"sent": sent, "failed": failed, "abandoned": abandoned, "checked": checked}


async def dead_letter_summary() -> dict:
    """Return running counts by status for the admin dashboard."""
    factory = session_factory()
    if factory is None:
        return {"enabled": False}
    from sqlalchemy import func as sa_func

    async with factory() as session:
        result = await session.execute(
            select(SyncDeadLetter.status, sa_func.count()).group_by(SyncDeadLetter.status)
        )
        counts = {status: int(cnt) for status, cnt in result.all()}
    return {
        "enabled": True,
        "pending": counts.get("pending", 0),
        "sent": counts.get("sent", 0),
        "abandoned": counts.get("abandoned", 0),
    }


async def dead_letter_scheduler_loop() -> None:
    """Background loop that drains dead-letter rows every 5 min."""
    if not is_enabled():
        return
    import os
    interval = int(os.environ.get("SUPABASE_MIRROR_RETRY_INTERVAL_SECONDS", "300"))
    # Warm-up delay so we don't fight a cold-start
    await asyncio.sleep(60)
    while True:
        try:
            summary = await replay_dead_letter(limit=100)
            if summary.get("checked"):
                logger.info("Supabase dead-letter replay: %s", summary)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Dead-letter scheduler tick failed: %s", exc)
        await asyncio.sleep(interval)
