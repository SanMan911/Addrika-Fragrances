"""
External API key management.

Machine-to-machine keys let related apps (e.g. the Field Sales Manager)
read live stock from this backend. Keys are random secrets shown ONCE at
creation; only a SHA-256 hash is stored. Each key carries a set of scopes.

Collection: `api_keys`
    id          str    e.g. "ak_<uuid10>"
    name        str    human label ("Field Sales Manager")
    key_prefix  str    first chars of the raw key, for display ("addk_ab12…")
    key_hash    str    sha256(raw_key)
    scopes      [str]  e.g. ["stock:read"]
    is_active   bool
    created_at  iso str
    created_by  str    admin email
    last_used_at iso str | None
    revoked_at  iso str | None
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from dependencies import db

KEY_PLAINTEXT_PREFIX = "addk_"
AVAILABLE_SCOPES = ("stock:read",)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _public(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "name": doc.get("name"),
        "key_prefix": doc.get("key_prefix"),
        "scopes": doc.get("scopes") or [],
        "is_active": bool(doc.get("is_active")),
        "created_at": doc.get("created_at"),
        "created_by": doc.get("created_by"),
        "last_used_at": doc.get("last_used_at"),
        "revoked_at": doc.get("revoked_at"),
    }


async def create_key(name: str, scopes: list[str], created_by: str) -> dict:
    raw = KEY_PLAINTEXT_PREFIX + secrets.token_urlsafe(32)
    key_id = f"ak_{uuid.uuid4().hex[:10]}"
    valid_scopes = [s for s in (scopes or []) if s in AVAILABLE_SCOPES] or ["stock:read"]
    doc = {
        "id": key_id,
        "name": (name or "Untitled key").strip()[:120],
        "key_prefix": raw[:12] + "…",
        "key_hash": _hash(raw),
        "scopes": valid_scopes,
        "is_active": True,
        "created_at": _now(),
        "created_by": created_by,
        "last_used_at": None,
        "revoked_at": None,
    }
    await db.api_keys.insert_one(doc)
    out = _public(doc)
    out["key"] = raw  # shown ONCE — never stored in plaintext
    return out


async def list_keys() -> list[dict]:
    cursor = db.api_keys.find({}, {"_id": 0, "key_hash": 0}).sort("created_at", -1)
    return [_public(d) async for d in cursor]


async def revoke_key(key_id: str) -> bool:
    res = await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"is_active": False, "revoked_at": _now()}},
    )
    return res.matched_count > 0


async def delete_key(key_id: str) -> bool:
    res = await db.api_keys.delete_one({"id": key_id})
    return res.deleted_count > 0


async def verify_key(raw_key: str, required_scope: Optional[str] = None) -> Optional[dict]:
    """Return the key doc if valid + active + (optionally) has the scope. Else None."""
    if not raw_key:
        return None
    doc = await db.api_keys.find_one({"key_hash": _hash(raw_key.strip())})
    if not doc or not doc.get("is_active"):
        return None
    if required_scope and required_scope not in (doc.get("scopes") or []):
        return None
    # best-effort last-used stamp (don't block on it)
    try:
        await db.api_keys.update_one({"id": doc["id"]}, {"$set": {"last_used_at": _now()}})
    except Exception:
        pass
    return doc
