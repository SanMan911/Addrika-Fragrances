"""Mongo → Supabase sync for the Aarohmm B2B mobile app read model.

MongoDB stays the source of truth for money and stock. These `app_*` tables
are the app's read layer: the phone queries them directly under Row-Level
Security, which keeps the UI fast and makes each retailer's data provably
isolated at the database level.

Sync is idempotent (upsert by primary key) and safe to re-run.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


def _db_url() -> Optional[str]:
    return os.environ.get("SUPABASE_DB_URL")


async def _connect() -> Optional[asyncpg.Connection]:
    url = _db_url()
    if not url:
        return None
    # statement_cache_size=0 is required behind Supabase's transaction pooler.
    return await asyncpg.connect(url, statement_cache_size=0)


def _fy(ts: Optional[datetime]) -> Optional[str]:
    if not ts:
        return None
    y = ts.year
    return f"{y}-{str((y + 1) % 100).zfill(2)}" if ts.month >= 4 else f"{y - 1}-{str(y % 100).zfill(2)}"


def _as_dt(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


async def sync_retailers(db, conn) -> int:
    # Only ACTIVE retailers with a GSTIN belong in the app's read model:
    # GSTIN is the login identity, and soft-deleted test accounts in Mongo
    # legitimately share GSTINs.
    rows = await db.retailers.find(
        {"status": "active", "gst_number": {"$nin": [None, ""]}},
        {
            "_id": 0, "retailer_id": 1, "gst_number": 1, "business_name": 1, "name": 1,
            "trade_name": 1, "email": 1, "phone": 1, "city": 1, "state": 1, "status": 1,
        },
    ).to_list(5000)
    seen: set[str] = set()
    payload = []
    for r in rows:
        gstin = (r.get("gst_number") or "").upper()
        if not r.get("retailer_id") or not gstin or gstin in seen:
            continue
        seen.add(gstin)
        payload.append(
            (
                r["retailer_id"],
                gstin,
                r.get("business_name") or r.get("trade_name"),
                r.get("name"),
                (r.get("email") or "").lower() or None,
                r.get("phone"),
                r.get("city"),
                r.get("state"),
                True,
            )
        )
    await conn.executemany(
        """
        insert into public.app_retailers
          (id, gstin, business_name, contact_name, email, phone, city, state, is_active, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
        on conflict (id) do update set
          gstin=excluded.gstin, business_name=excluded.business_name,
          contact_name=excluded.contact_name, email=excluded.email,
          phone=excluded.phone, city=excluded.city, state=excluded.state,
          is_active=excluded.is_active, updated_at=now()
        """,
        payload,
    )
    return len(payload)


async def sync_products(db, conn) -> int:
    # The SKU is `id` (e.g. "bold-bakhoor-b2b"), NOT `product_id`. Each SIZE is
    # its own document and several sizes share one `product_id`, so keying on
    # product_id collapsed sizes together and let a 0-stock row overwrite the
    # real stock of another size. `id` is also what the order engine accepts.
    rows = await db.b2b_products.find({}, {"_id": 0}).to_list(2000)
    payload = []
    seen: set[str] = set()
    for p in rows:
        sku = p.get("id") or p.get("product_id")
        if not sku or sku in seen:
            continue
        seen.add(sku)
        name = p.get("name") or sku
        size = p.get("net_weight")
        payload.append(
            (
                sku,
                f"{name} {size}".strip() if size else name,
                p.get("category"),
                size,
                int(p.get("pieces_per_carton") or 12),
                p.get("mrp_per_unit"),
                p.get("price_per_box"),
                int(p.get("stock_pieces") or 0),
                p.get("image"),
                bool(p.get("is_active", True)),
            )
        )
    await conn.executemany(
        """
        insert into public.app_products
          (sku, name, category, size_label, pieces_per_carton, mrp, b2b_price,
           stock_pieces, image_url, is_active, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
        on conflict (sku) do update set
          name=excluded.name, category=excluded.category,
          size_label=excluded.size_label, pieces_per_carton=excluded.pieces_per_carton,
          mrp=excluded.mrp, b2b_price=excluded.b2b_price,
          stock_pieces=excluded.stock_pieces, image_url=excluded.image_url,
          is_active=excluded.is_active, updated_at=now()
        """,
        payload,
    )
    return len(payload)


async def sync_orders(db, conn, retailer_id: Optional[str] = None) -> int:
    query = {"retailer_id": retailer_id} if retailer_id else {}
    rows = await db.b2b_orders.find(query, {"_id": 0}).to_list(20000)
    known = {r["id"] for r in await conn.fetch("select id from public.app_retailers")}
    payload = []
    for o in rows:
        if not o.get("order_id") or o.get("retailer_id") not in known:
            continue
        placed = _as_dt(o.get("created_at"))
        payload.append(
            (
                o["order_id"],
                o.get("order_number") or o["order_id"],
                o["retailer_id"],
                o.get("order_status"),
                o.get("payment_status"),
                o.get("subtotal"),
                o.get("gst_total"),
                o.get("grand_total"),
                json.dumps(o.get("items") or [], default=str),
                placed,
                _fy(placed),
            )
        )
    await conn.executemany(
        """
        insert into public.app_orders
          (id, order_number, retailer_id, status, payment_status, subtotal,
           gst_amount, total_amount, items, placed_at, fy, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11, now())
        on conflict (id) do update set
          order_number=excluded.order_number, status=excluded.status,
          payment_status=excluded.payment_status, subtotal=excluded.subtotal,
          gst_amount=excluded.gst_amount, total_amount=excluded.total_amount,
          items=excluded.items, placed_at=excluded.placed_at, fy=excluded.fy,
          updated_at=now()
        """,
        payload,
    )
    return len(payload)


async def sync_all(db) -> dict:
    """Full idempotent refresh of the mobile read model."""
    conn = await _connect()
    if conn is None:
        logger.warning("SUPABASE_DB_URL not set — mobile read model not synced")
        return {"synced": False, "reason": "SUPABASE_DB_URL not configured"}
    try:
        retailers = await sync_retailers(db, conn)
        products = await sync_products(db, conn)
        orders = await sync_orders(db, conn)
        result = {
            "synced": True,
            "retailers": retailers,
            "products": products,
            "orders": orders,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info(f"Supabase app read model synced: {result}")
        return result
    finally:
        await conn.close()


async def sync_one_order(db, order_id: str) -> bool:
    """Push a single freshly-placed/updated order into the read model."""
    conn = await _connect()
    if conn is None:
        return False
    try:
        order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
        if not order:
            return False
        await sync_retailers(db, conn)
        await sync_orders(db, conn, retailer_id=order.get("retailer_id"))
        return True
    except Exception as e:
        logger.error(f"sync_one_order({order_id}) failed: {e}")
        return False
    finally:
        await conn.close()


async def app_read_model_scheduler_loop(db, interval_seconds: int = 600):
    """Keep the mobile read model fresh.

    Orders are pushed the moment they're placed, so this loop exists mainly
    for stock levels and retailer detail changes made in the admin panel.
    """
    import asyncio as _asyncio

    while True:
        try:
            await sync_all(db)
        except Exception as e:
            logger.error(f"app read-model sync loop error: {e}")
        await _asyncio.sleep(interval_seconds)
