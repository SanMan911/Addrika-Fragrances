"""Admin product management CRUD endpoints"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request, Cookie
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import logging
import re
import uuid

from dependencies import db, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Products"])


# Supported image types for the product uploader.
_IMAGE_MIME = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif",
}
_MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB — plenty for a hero shot


class ProductSizeInput(BaseModel):
    size: str
    sizeLabel: Optional[str] = None
    mrp: float = Field(..., gt=0)
    price: float = Field(..., gt=0)
    weight: Optional[int] = None
    stock: Optional[int] = None  # in-stock qty for this variant (nullable = unlimited)
    opening_stock: Optional[int] = Field(
        default=None,
        description="Initial pieces to seed the linked B2B SKU with on creation. "
        "Ignored on updates — use the Inventory panel to adjust live stock.",
    )
    includes: Optional[list[str]] = None
    images: list[str] = []


class ProductInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    tagline: Optional[str] = ""
    type: str = "agarbatti"
    category: str = "agarbatti"
    description: str = ""
    notes: list[str] = []
    image: str = ""
    burnTime: Optional[str] = ""
    sizes: list[ProductSizeInput] = []
    rating: float = 0
    reviews: int = 0
    comingSoon: bool = False
    bambooless: Optional[bool] = None
    isActive: bool = True


def slugify(name: str) -> str:
    """Generate a URL-friendly slug from product name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug


@router.get("/products")
async def admin_list_products(admin=Depends(require_admin)):
    """List all products (including inactive) for admin management."""
    products = await db.products.find({}, {"_id": 0}).to_list(500)
    return products


@router.post("/products")
async def admin_create_product(product: ProductInput, admin=Depends(require_admin)):
    """Create a new product. Also mirrors matching B2B SKUs so the same
    product appears in the retailer catalog + brochure with a shared
    stock pool."""
    from routers.products import refresh_products_cache
    from services.product_sync import mirror_b2c_product

    slug = slugify(product.name)
    existing = await db.products.find_one({"id": slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"Product with slug '{slug}' already exists")

    now = datetime.now(timezone.utc).isoformat()
    doc = product.model_dump()
    doc["id"] = slug
    doc["sizes"] = [s.model_dump() for s in product.sizes]
    doc["created_at"] = now
    doc["updated_at"] = now

    await db.products.insert_one(doc)
    await refresh_products_cache()

    # Mirror into B2B catalog (retailer portal + brochure use these)
    b2b_rows = await mirror_b2c_product(db, doc)

    # Best-effort Supabase mirror (non-blocking).
    # Attach shared stock onto doc.sizes[] so the mirror row has a real
    # stock_pieces number instead of NULL.
    try:
        from services.product_sync import enrich_b2c_products_with_stock
        enrich_b2c_products_with_stock([doc], b2b_rows)
        from services.supabase_sync import mirror_product_upsert
        mirror_product_upsert(doc, channel="b2c")
    except Exception:
        pass

    doc.pop("_id", None)
    return {"message": "Product created", "product": doc, "b2b_skus_created": len(b2b_rows)}


@router.put("/products/{product_id}")
async def admin_update_product(product_id: str, product: ProductInput, admin=Depends(require_admin)):
    """Update an existing product + re-mirror the linked B2B SKUs.
    Stock is preserved on the B2B side — this only refreshes name/price/images."""
    from routers.products import refresh_products_cache
    from services.product_sync import mirror_b2c_product

    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    update = product.model_dump()
    update["sizes"] = [s.model_dump() for s in product.sizes]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Preserve original id and created_at
    update["id"] = product_id
    update.pop("_id", None)

    await db.products.update_one({"id": product_id}, {"$set": update})
    await refresh_products_cache()

    b2b_rows = await mirror_b2c_product(db, update)

    # Best-effort Supabase mirror (non-blocking).
    # Attach shared stock onto update.sizes[] so the mirror row has a real
    # stock_pieces number instead of NULL.
    try:
        from services.product_sync import enrich_b2c_products_with_stock
        enrich_b2c_products_with_stock([update], b2b_rows)
        from services.supabase_sync import mirror_product_upsert
        mirror_product_upsert(update, channel="b2c")
    except Exception:
        pass

    return {"message": "Product updated", "product": update, "b2b_skus_synced": len(b2b_rows)}


@router.delete("/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_admin)):
    """Delete a B2C product AND its linked B2B SKUs from Mongo + Supabase mirror.
    Prevents orphan `<slug>-<size>-b2b` rows accumulating in the mirror."""
    from routers.products import refresh_products_cache

    # Collect linked B2B SKU ids first so we can mirror-delete them after Mongo.
    b2b_sku_ids = [
        r["id"]
        for r in await db.b2b_products.find(
            {"product_id": product_id}, {"_id": 0, "id": 1}
        ).to_list(100)
    ]

    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    # Cascade Mongo B2B rows
    await db.b2b_products.delete_many({"product_id": product_id})
    await refresh_products_cache()

    # Best-effort Supabase mirror (non-blocking) — b2c row + every b2b SKU row
    try:
        from services.supabase_sync import mirror_product_delete
        mirror_product_delete(product_id)
        for sku_id in b2b_sku_ids:
            mirror_product_delete(sku_id)
    except Exception:
        pass

    return {
        "message": "Product deleted",
        "id": product_id,
        "b2b_skus_deleted": len(b2b_sku_ids),
    }


@router.patch("/products/{product_id}/toggle-active")
async def admin_toggle_active(product_id: str, admin=Depends(require_admin)):
    """Toggle a product's isActive status."""
    from routers.products import refresh_products_cache

    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    new_status = not existing.get("isActive", True)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"isActive": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await refresh_products_cache()

    return {"message": f"Product {'activated' if new_status else 'deactivated'}", "isActive": new_status}


@router.patch("/products/{product_id}/toggle-coming-soon")
async def admin_toggle_coming_soon(product_id: str, admin=Depends(require_admin)):
    """Toggle a product's comingSoon status."""
    from routers.products import refresh_products_cache

    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    new_status = not existing.get("comingSoon", False)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"comingSoon": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await refresh_products_cache()

    return {"message": f"Product marked as {'Coming Soon' if new_status else 'Available'}", "comingSoon": new_status}



# ---------------------------------------------------------------------------
# Product image uploader — drop-and-go from the Add Product form.
# Stores originals in Emergent object storage; DB row tracks the reference.
# Served back via `/api/products/asset/{asset_id}` so any <img src> works.
# ---------------------------------------------------------------------------
@router.post("/products/upload-image")
async def admin_upload_product_image(
    file: UploadFile = File(...),
    admin=Depends(require_admin),
):
    from services.object_storage import put_object, is_configured, make_path

    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="Object storage is not configured on this environment. "
            "Set EMERGENT_LLM_KEY in backend/.env to enable image uploads.",
        )

    content_type = (file.content_type or "").lower()
    if content_type not in _IMAGE_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{content_type}'. Use JPG, PNG, WEBP or GIF.",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Max size is {_MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    ext = _IMAGE_MIME[content_type]
    path = make_path("products", "images", ext)
    result = await put_object(path, data, content_type)
    if not result:
        raise HTTPException(status_code=502, detail="Upload failed. Please retry.")

    asset_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": asset_id,
        "storage_path": result["path"],
        "content_type": content_type,
        "size": result.get("size") or len(data),
        "original_filename": file.filename or "",
        "uploaded_by": (admin or {}).get("email") or "admin",
        "is_deleted": False,
        "created_at": now,
    }
    await db.product_assets.insert_one(dict(doc))

    return {
        "asset_id": asset_id,
        "url": f"/api/products/asset/{asset_id}",
        "size": doc["size"],
        "content_type": content_type,
    }



# ---------------------------------------------------------------------------
# One-click SKU launch — flags an early-access window + broadcasts the SKU
# to every active retailer + CCs the platform accountant. See
# services/product_launch.py for the full playbook.
# ---------------------------------------------------------------------------
class LaunchInput(BaseModel):
    hidden_hours: int = Field(
        default=24, ge=1, le=168,
        description="How long the SKU stays hidden from the public storefront "
        "while Founding Retailers get their exclusive preview. Max 7 days.",
    )
    broadcast: bool = True


@router.post("/products/{product_id}/launch")
async def admin_launch_product(
    product_id: str, body: LaunchInput, admin=Depends(require_admin),
):
    from services.product_launch import launch_sku
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    summary = await launch_sku(
        db, product,
        admin_email=(admin or {}).get("email") or "admin",
        hidden_hours=body.hidden_hours,
        broadcast=body.broadcast,
    )
    # Refresh in-memory catalog so /api/products reflects the hidden window
    from routers.products import refresh_products_cache
    await refresh_products_cache()
    return {"message": "Launch initiated", "launch": summary}


# ---------------------------------------------------------------------------
# Bulk CSV upload — ingest a spreadsheet of new SKUs in one request.
# CSV columns (headers are case-insensitive):
#     name              (required)
#     description       (optional)
#     type              (agarbatti|dhoop|bakhoor — default: agarbatti)
#     size              (e.g. "50g"; multiple rows per name = multiple sizes)
#     mrp               (required, ₹)
#     price             (optional, ₹ — defaults to mrp)
#     opening_stock     (optional, pieces to seed the linked B2B SKU)
#     image             (optional URL)
# Rows sharing a `name` are collapsed into a single product with multiple
# sizes. Uses the same mirror_b2c_product hook as the single-product form
# so every uploaded row ends up in B2B + brochure automatically.
# ---------------------------------------------------------------------------
@router.post("/products/bulk-import")
async def admin_bulk_import_products(
    file: UploadFile = File(...), admin=Depends(require_admin),
):
    import csv
    import io as _io
    from services.product_sync import mirror_b2c_product
    from routers.products import refresh_products_cache

    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(_io.StringIO(raw))
    # Normalise headers to lowercase for forgiving matches
    reader.fieldnames = [(h or "").strip().lower() for h in (reader.fieldnames or [])]
    required = {"name", "size", "mrp"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required column(s): {', '.join(sorted(required - set(reader.fieldnames or [])))}. "
                   "Required: name, size, mrp. Optional: description, type, price, opening_stock, image.",
        )

    # Collect rows by product name (case-insensitive slug key)
    groups: dict[str, dict] = {}
    row_errors: list[dict] = []
    for line_no, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        size = (row.get("size") or "").strip()
        mrp_raw = (row.get("mrp") or "").strip()
        if not name or not size or not mrp_raw:
            row_errors.append({"line": line_no, "reason": "name/size/mrp is required"})
            continue
        try:
            mrp = float(mrp_raw)
            price = float(row.get("price") or mrp)
        except ValueError:
            row_errors.append({"line": line_no, "reason": "mrp/price must be numeric"})
            continue
        opening = 0
        if row.get("opening_stock"):
            try:
                opening = max(0, int(row["opening_stock"]))
            except ValueError:
                pass
        key = slugify(name)
        entry = groups.setdefault(key, {
            "name": name,
            "description": (row.get("description") or "").strip(),
            "type": (row.get("type") or "agarbatti").strip().lower() or "agarbatti",
            "image": (row.get("image") or "").strip(),
            "sizes": [],
        })
        # Rows further down can overwrite blank description/image on the same product
        if not entry["description"] and row.get("description"):
            entry["description"] = row["description"].strip()
        if not entry["image"] and row.get("image"):
            entry["image"] = row["image"].strip()
        entry["sizes"].append({
            "size": size,
            "mrp": mrp,
            "price": price,
            "opening_stock": opening,
            "images": [row["image"].strip()] if row.get("image") else [],
        })

    now = datetime.now(timezone.utc).isoformat()
    created, updated, skipped = [], [], []
    for slug, payload in groups.items():
        existing = await db.products.find_one({"id": slug})
        payload["id"] = slug
        payload["category"] = payload["type"]
        payload["updated_at"] = now
        if existing:
            # Merge sizes by size label — new rows extend, existing rows update
            existing_sizes = {s.get("size"): s for s in (existing.get("sizes") or [])}
            for s in payload["sizes"]:
                existing_sizes[s["size"]] = {**existing_sizes.get(s["size"], {}), **s}
            payload["sizes"] = list(existing_sizes.values())
            await db.products.update_one({"id": slug}, {"$set": payload})
            updated.append(slug)
        else:
            payload["created_at"] = now
            await db.products.insert_one(payload)
            created.append(slug)
        # Mirror into B2B catalog + reset the in-memory cache
        try:
            await mirror_b2c_product(db, payload)
        except Exception as e:
            logger.warning("Bulk import: mirror failed for %s: %s", slug, e)
            skipped.append({"product_id": slug, "reason": str(e)})

    await refresh_products_cache()
    return {
        "message": f"Bulk import complete. {len(created)} created, {len(updated)} updated.",
        "created": created,
        "updated": updated,
        "row_errors": row_errors,
        "skipped_mirror": skipped,
    }


@router.get("/products/bulk-import/template.csv")
async def admin_bulk_import_template(admin=Depends(require_admin)):
    """Downloadable CSV template with example rows so admins can copy/paste
    from their catalog spreadsheet."""
    csv_body = (
        "name,description,type,size,mrp,price,opening_stock,image\n"
        "Sample Bakhoor,Woody amber blend,bakhoor,20g,399,399,50,https://example.com/hero.jpg\n"
        "Sample Bakhoor,Woody amber blend,bakhoor,50g,899,899,30,\n"
        "Rose Petal Dhoop,Floral Ready-to-Use dhoop,dhoop,100g,149,149,100,\n"
    )
    return Response(
        content=csv_body, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="addrika-products-template.csv"'},
    )
