"""
Live stock-change webhooks.

Fired from the single stock chokepoint `b2b_inventory.adjust_stock`. Related
apps (e.g. Field Sales Manager) subscribe an HTTPS endpoint and receive a
signed POST the moment stock changes — no polling.

Events:
    stock.changed  — every stock movement
    stock.low      — remaining pieces dropped below (pieces_per_carton × threshold)
    stock.out      — remaining pieces hit zero

Security: each delivery carries
    X-Addrika-Event:     <event>
    X-Addrika-Delivery:  <uuid>
    X-Addrika-Signature: sha256=<hmac hex of the raw JSON body, keyed by the webhook secret>

Collections:
    stock_webhooks             registered endpoints (secret stored in full — needed to sign)
    stock_webhook_deliveries   recent delivery attempts (for the admin panel)
"""
import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from dependencies import db

logger = logging.getLogger(__name__)

ALL_EVENTS = ("stock.changed", "stock.low", "stock.out")
DEFAULT_EVENTS = list(ALL_EVENTS)
DELIVERY_TIMEOUT_SECONDS = 10
SECRET_PREFIX = "whsec_"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pack_size(sku: dict) -> int:
    return int(sku.get("pieces_per_carton") or sku.get("units_per_box") or 1) or 1


def _public(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "name": doc.get("name"),
        "url": doc.get("url"),
        "events": doc.get("events") or [],
        "threshold_cartons": doc.get("threshold_cartons", 1.0),
        "is_active": bool(doc.get("is_active")),
        "created_at": doc.get("created_at"),
        "created_by": doc.get("created_by"),
        "last_delivery_at": doc.get("last_delivery_at"),
        "last_status": doc.get("last_status"),
        "secret_hint": (doc.get("secret") or "")[:10] + "…" if doc.get("secret") else None,
    }


def _sku_summary(sku: dict) -> dict:
    pieces = int(sku.get("stock_pieces") or 0)
    return {
        "id": sku.get("id"),
        "product_id": sku.get("product_id"),
        "name": sku.get("name"),
        "category": sku.get("category"),
        "net_weight": sku.get("net_weight"),
        "stock_pieces": pieces,
        "stock_status": sku.get("stock_status") or ("in_stock" if pieces > 0 else "out_of_stock"),
        "pieces_per_carton": _pack_size(sku),
        "price_per_unit": sku.get("mrp_per_unit"),
        "price_per_carton": sku.get("price_per_carton"),
        "is_active": bool(sku.get("is_active", True)),
    }


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def create_webhook(name: str, url: str, events: list[str], threshold_cartons: float, created_by: str) -> dict:
    valid_events = [e for e in (events or []) if e in ALL_EVENTS] or DEFAULT_EVENTS
    doc = {
        "id": f"wh_{uuid.uuid4().hex[:10]}",
        "name": (name or "Untitled webhook").strip()[:120],
        "url": url.strip(),
        "secret": SECRET_PREFIX + secrets.token_urlsafe(32),
        "events": valid_events,
        "threshold_cartons": float(threshold_cartons) if threshold_cartons is not None else 1.0,
        "is_active": True,
        "created_at": _now(),
        "created_by": created_by,
        "last_delivery_at": None,
        "last_status": None,
    }
    await db.stock_webhooks.insert_one(dict(doc))
    out = _public(doc)
    out["secret"] = doc["secret"]  # shown ONCE
    return out


async def list_webhooks() -> list[dict]:
    cursor = db.stock_webhooks.find({}, {"_id": 0}).sort("created_at", -1)
    return [_public(d) async for d in cursor]


async def recent_deliveries(limit: int = 20) -> list[dict]:
    cursor = db.stock_webhook_deliveries.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(limit)


async def toggle_webhook(webhook_id: str, is_active: bool) -> bool:
    res = await db.stock_webhooks.update_one({"id": webhook_id}, {"$set": {"is_active": bool(is_active)}})
    return res.matched_count > 0


async def update_webhook(webhook_id: str, *, name=None, url=None, events=None, threshold_cartons=None) -> Optional[dict]:
    """Edit an existing webhook's name/url/events/threshold WITHOUT rotating its
    secret (so you can point it at the real endpoint later and just flip it on)."""
    updates: dict = {}
    if name is not None:
        updates["name"] = str(name).strip()[:120]
    if url is not None:
        updates["url"] = str(url).strip()
    if events is not None:
        valid = [e for e in events if e in ALL_EVENTS]
        updates["events"] = valid or DEFAULT_EVENTS
    if threshold_cartons is not None:
        updates["threshold_cartons"] = float(threshold_cartons)
    if not updates:
        doc = await db.stock_webhooks.find_one({"id": webhook_id}, {"_id": 0})
        return _public(doc) if doc else None
    res = await db.stock_webhooks.update_one({"id": webhook_id}, {"$set": updates})
    if res.matched_count == 0:
        return None
    doc = await db.stock_webhooks.find_one({"id": webhook_id}, {"_id": 0})
    return _public(doc)


async def delete_webhook(webhook_id: str) -> bool:
    res = await db.stock_webhooks.delete_one({"id": webhook_id})
    return res.deleted_count > 0


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------

def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def _deliver(webhook: dict, event: str, payload: dict) -> None:
    delivery_id = uuid.uuid4().hex
    body = json.dumps(payload, default=str).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Addrika-Event": event,
        "X-Addrika-Delivery": delivery_id,
        "X-Addrika-Signature": _sign(webhook.get("secret", ""), body),
        "User-Agent": "Addrika-StockWebhook/1",
    }
    status_code: Optional[int] = None
    ok = False
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=DELIVERY_TIMEOUT_SECONDS) as client:
            resp = await client.post(webhook["url"], content=body, headers=headers)
            status_code = resp.status_code
            ok = 200 <= resp.status_code < 300
    except Exception as e:
        error = str(e)[:500]
        logger.warning("Stock webhook %s delivery failed: %s", webhook.get("id"), error)

    now = _now()
    try:
        await db.stock_webhook_deliveries.insert_one({
            "id": delivery_id,
            "webhook_id": webhook.get("id"),
            "webhook_name": webhook.get("name"),
            "event": event,
            "url": webhook.get("url"),
            "status_code": status_code,
            "ok": ok,
            "error": error,
            "sku_id": (payload.get("sku") or {}).get("id"),
            "created_at": now,
        })
        await db.stock_webhooks.update_one(
            {"id": webhook.get("id")},
            {"$set": {"last_delivery_at": now, "last_status": ("ok" if ok else (f"http_{status_code}" if status_code else "error"))}},
        )
    except Exception as e:
        logger.warning("Stock webhook delivery-log write failed: %s", e)


def _schedule(coro) -> None:
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        pass  # no loop (sync context) — skip silently


async def fire_stock_event(sku: dict, before: int, after: int, reason: str) -> None:
    """Fan out stock.changed / stock.low / stock.out to matching active webhooks.
    Never raises — best-effort. Called from adjust_stock."""
    try:
        webhooks = await db.stock_webhooks.find({"is_active": True}).to_list(200)
    except Exception:
        return
    if not webhooks:
        return

    pack = _pack_size(sku)
    summary = _sku_summary(sku)
    base = {
        "sku": summary,
        "previous_stock": int(before),
        "reason": reason,
        "occurred_at": _now(),
    }

    for wh in webhooks:
        events = wh.get("events") or DEFAULT_EVENTS
        threshold_pieces = int(pack * float(wh.get("threshold_cartons") or 1.0))
        is_out = after <= 0
        is_low = after < threshold_pieces
        # Highest-severity single event per webhook (avoid duplicate noise)
        chosen: Optional[str] = None
        if is_out and "stock.out" in events:
            chosen = "stock.out"
        elif is_low and "stock.low" in events:
            chosen = "stock.low"
        elif "stock.changed" in events:
            chosen = "stock.changed"
        if not chosen:
            continue
        payload = {"event": chosen, "threshold_pieces": threshold_pieces, **base}
        _schedule(_deliver(wh, chosen, payload))


async def send_test_event(webhook_id: str) -> dict:
    wh = await db.stock_webhooks.find_one({"id": webhook_id}, {"_id": 0})
    if not wh:
        return {"sent": False, "error": "Webhook not found"}
    payload = {
        "event": "stock.test",
        "threshold_pieces": 0,
        "sku": {
            "id": "SAMPLE-SKU-b2b",
            "product_id": "sample-product",
            "name": "Sample Dhoop 100g",
            "category": "dhoop",
            "net_weight": "100g",
            "stock_pieces": 4,
            "stock_status": "in_stock",
            "pieces_per_carton": 32,
            "price_per_unit": 149,
            "price_per_carton": 3800,
            "is_active": True,
        },
        "previous_stock": 40,
        "reason": "test",
        "occurred_at": _now(),
    }
    await _deliver(wh, "stock.test", payload)
    updated = await db.stock_webhooks.find_one({"id": webhook_id}, {"_id": 0})
    return {"sent": True, "last_status": (updated or {}).get("last_status")}
