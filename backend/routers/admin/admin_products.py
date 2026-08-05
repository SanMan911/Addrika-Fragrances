"""Admin product management CRUD endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import re

from dependencies import db, require_admin

router = APIRouter(tags=["Admin Products"])


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

    return {"message": "Product updated", "product": update, "b2b_skus_synced": len(b2b_rows)}


@router.delete("/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_admin)):
    """Delete a product."""
    from routers.products import refresh_products_cache

    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    await refresh_products_cache()
    return {"message": "Product deleted", "id": product_id}


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
