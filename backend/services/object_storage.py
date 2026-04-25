"""
Emergent managed object storage wrapper.
- Upload bills / message attachments outside MongoDB (was base64 → 5MB cap).
- Backwards compatible: a record may have either `file_base64` (legacy) or
  `storage_path` (new). Readers must fall back gracefully.
- Soft-delete only via DB flag; storage backend exposes no delete API.
"""
import os
import logging
import asyncio
from typing import Optional, Tuple

import requests

logger = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("OBJECT_STORAGE_APP", "addrika")

_storage_key: Optional[str] = None
_init_lock = asyncio.Lock()


def is_configured() -> bool:
    return bool(EMERGENT_KEY)


async def init_storage() -> Optional[str]:
    """Idempotent — returns the session-scoped storage_key, or None if not configured."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    async with _init_lock:
        if _storage_key:
            return _storage_key
        try:
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: requests.post(
                    f"{STORAGE_URL}/init",
                    json={"emergent_key": EMERGENT_KEY},
                    timeout=15,
                ),
            )
            resp.raise_for_status()
            _storage_key = resp.json().get("storage_key")
            logger.info("Object storage initialized")
            return _storage_key
        except Exception as e:
            logger.error(f"Object storage init failed: {e}")
            return None


async def put_object(path: str, data: bytes, content_type: str) -> Optional[dict]:
    key = await init_storage()
    if not key:
        return None
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
        logger.error(f"put_object {path} failed: {e}")
        return None


async def get_object(path: str) -> Optional[Tuple[bytes, str]]:
    key = await init_storage()
    if not key:
        return None
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
        logger.error(f"get_object {path} failed: {e}")
        return None


def make_path(kind: str, owner: str, ext: str) -> str:
    """e.g. addrika/bills/RTL_TEST/{uuid}.pdf"""
    import uuid as _uuid
    safe_ext = (ext or "bin").lstrip(".").lower()[:6] or "bin"
    return f"{APP_NAME}/{kind}/{owner}/{_uuid.uuid4()}.{safe_ext}"
