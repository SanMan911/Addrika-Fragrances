"""Emergent managed object storage wrapper with MongoDB backup fallback.
- Upload bills / message attachments / product images outside MongoDB (was base64 → 5MB cap).
- When EMERGENT_LLM_KEY is configured: Uses Emergent Managed Object Storage.
- When EMERGENT_LLM_KEY is unset (e.g. self-hosted / Render): Automatically falls back to
  MongoDB document storage so uploads never fail with 503.
- Backwards compatible: a record may have either `file_base64` (legacy) or
  `storage_path` (new). Readers fall back gracefully.
- Soft-delete only via DB flag; storage backend exposes no delete API.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Tuple
from bson.binary import Binary

import requests

logger = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("OBJECT_STORAGE_APP", "addrika")

_storage_key: Optional[str] = None
_init_lock = asyncio.Lock()


def _emergent_key() -> str:
    return (os.environ.get("EMERGENT_LLM_KEY") or "").strip()


def _get_db():
    from dependencies import db
    return db


def is_configured() -> bool:
    """Always returns True because either Emergent Object Storage or MongoDB fallback is available."""
    return True


async def init_storage() -> Optional[str]:
    """Idempotent — returns the session-scoped storage_key for Emergent storage, or None if unset."""
    global _storage_key
    ek = _emergent_key()
    if not ek:
        return None
    if _storage_key:
        return _storage_key
    async with _init_lock:
        if _storage_key:
            return _storage_key
        try:
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: requests.post(
                    f"{STORAGE_URL}/init",
                    json={"emergent_key": ek},
                    timeout=15,
                ),
            )
            resp.raise_for_status()
            _storage_key = resp.json().get("storage_key")
            logger.info("Emergent Object storage initialized")
            return _storage_key
        except Exception as e:
            logger.error(f"Emergent Object storage init failed: {e}")
            return None


async def _mongo_put(path: str, data: bytes, content_type: str) -> bool:
    try:
        from dependencies import db
        now = datetime.now(timezone.utc).isoformat()
        await db.object_storage_files.update_one(
            {"path": path},
            {"$set": {
                "path": path,
                "data": Binary(data),
                "content_type": content_type,
                "size": len(data),
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            }},
            upsert=True,
        )
        return True
    except Exception:
        # Fallback to sync PyMongo in thread executor if event loop differs
        try:
            from pymongo import MongoClient
            loop = asyncio.get_running_loop()
            def _sync_put():
                mc = MongoClient(os.environ["MONGO_URL"])
                try:
                    now = datetime.now(timezone.utc).isoformat()
                    mc[os.environ["DB_NAME"]].object_storage_files.update_one(
                        {"path": path},
                        {"$set": {
                            "path": path,
                            "data": Binary(data),
                            "content_type": content_type,
                            "size": len(data),
                            "updated_at": now,
                        },
                        "$setOnInsert": {
                            "created_at": now,
                        }},
                        upsert=True,
                    )
                finally:
                    mc.close()
            await loop.run_in_executor(None, _sync_put)
            return True
        except Exception as e2:
            logger.error(f"MongoDB fallback put_object {path} failed: {e2}")
            return False


async def _mongo_get(path: str) -> Optional[Tuple[bytes, str]]:
    try:
        from dependencies import db
        doc = await db.object_storage_files.find_one({"path": path})
        if doc and doc.get("data"):
            raw_bytes = bytes(doc["data"])
            ctype = doc.get("content_type") or "application/octet-stream"
            return raw_bytes, ctype
    except Exception:
        try:
            from pymongo import MongoClient
            loop = asyncio.get_running_loop()
            def _sync_get():
                mc = MongoClient(os.environ["MONGO_URL"])
                try:
                    return mc[os.environ["DB_NAME"]].object_storage_files.find_one({"path": path})
                finally:
                    mc.close()
            doc = await loop.run_in_executor(None, _sync_get)
            if doc and doc.get("data"):
                raw_bytes = bytes(doc["data"])
                ctype = doc.get("content_type") or "application/octet-stream"
                return raw_bytes, ctype
        except Exception as e2:
            logger.debug(f"MongoDB get_object check for {path}: {e2}")
    return None


async def put_object(path: str, data: bytes, content_type: str) -> Optional[dict]:
    """Store object in Emergent Storage if configured, or MongoDB fallback otherwise."""
    key = await init_storage()
    if key:
        try:
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: requests.put(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key, "Content-Type": content_type},
                    data=data,
                    timeout=60,
                ),
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"Emergent put_object {path} failed ({e}), attempting MongoDB fallback...")

    # MongoDB fallback storage
    ok = await _mongo_put(path, data, content_type)
    if ok:
        logger.info(f"Stored object {path} in MongoDB fallback storage ({len(data)} bytes)")
        return {"path": path, "size": len(data)}
    return None


async def get_object(path: str) -> Optional[Tuple[bytes, str]]:
    """Retrieve object from MongoDB fallback or Emergent Storage."""
    # Check MongoDB fallback first if present
    mongo_res = await _mongo_get(path)
    if mongo_res:
        return mongo_res

    # Otherwise fetch from Emergent Storage
    key = await init_storage()
    if key:
        try:
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: requests.get(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key},
                    timeout=60,
                ),
            )
            resp.raise_for_status()
            return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
        except Exception as e:
            logger.error(f"Emergent get_object {path} failed: {e}")

    return None



def make_path(kind: str, owner: str, ext: str) -> str:
    """e.g. addrika/bills/RTL_TEST/{uuid}.pdf"""
    import uuid as _uuid
    safe_ext = (ext or "bin").lstrip(".").lower()[:6] or "bin"
    return f"{APP_NAME}/{kind}/{owner}/{_uuid.uuid4()}.{safe_ext}"

