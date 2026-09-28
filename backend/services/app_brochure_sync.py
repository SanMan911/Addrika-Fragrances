"""Auto-build the B2B brochure from the website's own product catalogue.

The brochure must never drift from what the storefront shows, so every entry
is derived from live data:

  * image        → the D2C product image already used on centraders.com
  * detail       → the product's tagline + description (trimmed to a brief blurb)
  * notes        → its fragrance notes
  * sizes/prices → the matching B2B SKU rows

Nothing here invents copy. If a product has no description we leave `detail`
empty rather than fabricate one.
"""
from __future__ import annotations

import logging
from typing import Optional

from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)

# Rough order the catalogue is presented in on the website.
CATEGORY_ORDER = {"agarbatti": 10, "dhoop": 20, "bakhoor": 30}

MAX_DETAIL_CHARS = 280


def _short_detail(product: dict) -> str:
    """A brief, presentable blurb: tagline first, then a trimmed description."""
    tagline = (product.get("tagline") or "").strip()
    description = (product.get("description") or "").strip()

    if tagline and description:
        text = f"{tagline}. {description}" if not tagline.endswith(".") else f"{tagline} {description}"
    else:
        text = tagline or description

    if len(text) <= MAX_DETAIL_CHARS:
        return text

    # Cut on a sentence boundary where possible so it never ends mid-word.
    cut = text[:MAX_DETAIL_CHARS]
    for sep in (". ", "! ", "? "):
        idx = cut.rfind(sep)
        if idx > MAX_DETAIL_CHARS * 0.5:
            return cut[: idx + 1].strip()
    return cut.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def _notes_text(product: dict) -> Optional[str]:
    notes = product.get("notes")
    if isinstance(notes, list) and notes:
        return " · ".join(str(n).strip() for n in notes if str(n).strip())
    if isinstance(notes, str) and notes.strip():
        return notes.strip()
    return None


async def sync_brochure(db) -> dict:
    """Rebuild app_brochure_items from `products` (D2C) × `b2b_products`."""
    conn = await _connect()
    if conn is None:
        return {"synced": False, "reason": "SUPABASE_DB_URL not configured"}

    try:
        d2c = await db.products.find({}, {"_id": 0}).to_list(500)
        by_product = {p["id"]: p for p in d2c if p.get("id")}

        b2b = await db.b2b_products.find({}, {"_id": 0}).to_list(2000)

        payload = []
        seen: set[str] = set()
        for row in b2b:
            # `id` is the real SKU; `product_id` is the shared fragrance.
            sku = row.get("id") or row.get("product_id")
            if not sku or sku in seen:
                continue
            seen.add(sku)

            parent = by_product.get(row.get("product_id")) or {}
            size = row.get("net_weight")
            base_name = row.get("name") or parent.get("name") or sku
            category = row.get("category") or parent.get("category")

            payload.append(
                (
                    sku,
                    f"{base_name} {size}".strip() if size else base_name,
                    category,
                    size,
                    # Prefer the storefront image so print and web agree.
                    parent.get("image") or row.get("image"),
                    _short_detail(parent),
                    _notes_text(parent),
                    row.get("mrp_per_unit"),
                    row.get("price_per_box"),
                    CATEGORY_ORDER.get((category or "").lower(), 100),
                    bool(row.get("is_active", True)),
                )
            )

        await conn.executemany(
            """
            insert into public.app_brochure_items
              (sku, name, category, size_label, image_url, detail, notes,
               mrp, b2b_price, sort_order, is_active, updated_at)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
            on conflict (sku) do update set
              name=excluded.name, category=excluded.category,
              size_label=excluded.size_label, image_url=excluded.image_url,
              detail=excluded.detail, notes=excluded.notes,
              mrp=excluded.mrp, b2b_price=excluded.b2b_price,
              sort_order=excluded.sort_order, is_active=excluded.is_active,
              updated_at=now()
            """,
            payload,
        )

        # Drop brochure rows whose SKU no longer exists in the catalogue.
        removed = 0
        if seen:
            removed = int(
                (
                    await conn.execute(
                        "delete from public.app_brochure_items where sku <> all($1::text[])",
                        list(seen),
                    )
                ).split()[-1]
            )

        with_image = sum(1 for p in payload if p[4])
        with_detail = sum(1 for p in payload if p[5])
        result = {
            "synced": True,
            "items": len(payload),
            "with_image": with_image,
            "with_detail": with_detail,
            "removed": removed,
        }
        logger.info(f"Brochure auto-sync: {result}")
        return result
    finally:
        await conn.close()


async def brochure_scheduler_loop(db, interval_seconds: int = 900):
    """Keep the brochure in step with the website catalogue."""
    import asyncio

    while True:
        try:
            await sync_brochure(db)
        except Exception as e:
            logger.error(f"brochure sync loop error: {e}")
        await asyncio.sleep(interval_seconds)
