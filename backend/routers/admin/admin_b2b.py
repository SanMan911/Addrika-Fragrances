"""
Admin B2B Management System
- B2B Order tracking and status management
- Retailer voucher generation
- Credit Note (CN) generation
- Self-pickup tracking and retailer performance
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import string
import random
import logging
import os

from dependencies import db, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/b2b", tags=["Admin B2B"])


# ============================================================================
# B2B Invoice PDF (admin download)
# ============================================================================

@router.get("/orders/{order_id}/invoice.pdf")
async def admin_download_b2b_invoice(
    order_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Generate a GST tax invoice PDF for a B2B order."""
    await require_admin(request, session_token)
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    retailer = await db.retailers.find_one(
        {"retailer_id": order["retailer_id"]},
        {"_id": 0, "password_hash": 0},
    ) or {}

    from services.b2b_invoice_pdf import build_invoice_pdf

    pdf_bytes = build_invoice_pdf(order, retailer)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="invoice-{order_id}.pdf"'
        },
    )


@router.post("/orders/{order_id}/email-invoice")
async def admin_email_b2b_invoice(
    order_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Email the GST tax invoice PDF to the retailer's account email."""
    await require_admin(request, session_token)
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    retailer = await db.retailers.find_one(
        {"retailer_id": order["retailer_id"]},
        {"_id": 0, "password_hash": 0},
    )
    if not retailer or not retailer.get("email"):
        raise HTTPException(status_code=400, detail="Retailer has no email on file")

    from services.b2b_invoice_pdf import build_invoice_pdf
    from services.email_service import send_email

    pdf_bytes = build_invoice_pdf(order, retailer)

    business_name = (
        retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    )
    html = f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:20px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;'>ADDRIKA</h1>
          <p style='color:#fff;margin:4px 0 0;'>Tax Invoice · {order_id}</p>
        </td></tr>
        <tr><td style='padding:24px;'>
          <p>Dear {business_name},</p>
          <p>Please find attached the GST tax invoice for your B2B order
          <b>{order_id}</b>, totalling <b>₹{float(order.get('grand_total') or 0):,.2f}</b>.</p>
          <p>For any queries, reply to this email or contact us at
          <a href='mailto:contact.us@centraders.com'>contact.us@centraders.com</a>.</p>
          <p style='margin-top:24px;color:#888;font-size:12px;'>— Addrika B2B Team</p>
        </td></tr>
      </table>
    </body></html>
    """

    sent = await send_email(
        to_email=retailer["email"],
        subject=f"Addrika · Tax Invoice {order_id}",
        html_content=html,
        attachments=[{"filename": f"invoice-{order_id}.pdf", "content": pdf_bytes}],
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="Email service unavailable — could not send invoice",
        )

    from datetime import datetime, timezone
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "invoice_emailed_at": datetime.now(timezone.utc).isoformat(),
            "invoice_emailed_to": retailer["email"],
        }},
    )
    return {"emailed": True, "to": retailer["email"]}


# ============================================================================
# B2B Catalog (Mongo-managed) — admin CRUD
# ============================================================================

class B2BProductPayload(BaseModel):
    id: str = Field(..., min_length=2, max_length=80)
    product_id: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=1, max_length=120)
    image: Optional[str] = None
    net_weight: str = Field(..., max_length=20)
    units_per_box: int = Field(..., ge=1)
    mrp_per_unit: float = Field(..., ge=0)
    price_per_box: int = Field(..., ge=0)
    price_per_half_box: int = Field(..., ge=0)
    min_order: float = Field(0.5, ge=0)
    gst_rate: int = Field(..., ge=0, le=28)
    hsn_code: Optional[str] = Field(None, max_length=12)
    is_active: bool = True


@router.get("/products")
async def admin_list_b2b_products(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    docs = await db.b2b_products.find({}, {"_id": 0}).sort("id", 1).to_list(500)
    return {"products": docs}


@router.post("/products")
async def admin_upsert_b2b_product(
    payload: B2BProductPayload,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    from services.b2b_catalog import upsert_b2b_product

    product = payload.model_dump(exclude_none=True)
    await upsert_b2b_product(db, product)
    return {"ok": True, "product": product}


@router.delete("/products/{product_id}")
async def admin_delete_b2b_product(
    product_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    from services.b2b_catalog import delete_b2b_product

    deleted = await delete_b2b_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": True}


@router.post("/products/bulk-import")
async def admin_bulk_import_b2b_products(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """CSV bulk import for B2B catalog. Body: text/csv with header row.

    Headers (case-insensitive): id, product_id, name, image, net_weight,
    units_per_box, mrp_per_unit, price_per_box, price_per_half_box,
    min_order, gst_rate, hsn_code, is_active.
    Rows are upserted by `id`. Pricing columns missing → auto-derived as
    76.52% × units × MRP. Returns per-row {ok|error} so partial imports
    surface clearly.
    """
    await require_admin(request, session_token)
    import csv
    import io
    from services.b2b_catalog import upsert_b2b_product

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty CSV body")
    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    results = []
    created = 0
    updated = 0
    failed = 0
    for idx, row in enumerate(reader, start=2):  # row 1 is header
        try:
            row = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
            if not row.get("id") or not row.get("product_id") or not row.get("name"):
                raise ValueError("id, product_id, name are required")
            units = int(row.get("units_per_box") or 12)
            mrp = float(row.get("mrp_per_unit") or 0)
            price_box = int(row.get("price_per_box") or round(units * mrp * 0.7652))
            price_half = int(
                row.get("price_per_half_box") or round((units / 2) * mrp * 0.7652)
            )
            payload = {
                "id": row["id"],
                "product_id": row["product_id"],
                "name": row["name"],
                "image": row.get("image") or "",
                "net_weight": row.get("net_weight") or "",
                "units_per_box": units,
                "mrp_per_unit": mrp,
                "price_per_box": price_box,
                "price_per_half_box": price_half,
                "min_order": float(row.get("min_order") or 0.5),
                "gst_rate": int(row.get("gst_rate") or 5),
                "hsn_code": row.get("hsn_code") or "33074100",
                "is_active": str(row.get("is_active", "true")).lower() not in ("false", "0", "no"),
            }
            existed = await db.b2b_products.find_one({"id": payload["id"]}, {"_id": 0})
            await upsert_b2b_product(db, payload)
            if existed:
                updated += 1
            else:
                created += 1
            results.append({"row": idx, "id": payload["id"], "ok": True})
        except Exception as e:
            failed += 1
            results.append({"row": idx, "ok": False, "error": str(e)})
    return {
        "created": created,
        "updated": updated,
        "failed": failed,
        "total": created + updated + failed,
        "results": results,
    }


@router.post("/retailers/bulk-grandfather-kyc")
async def admin_bulk_grandfather_kyc(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """One-click migration: mark every existing retailer's KYC as verified.

    Used to flip the `b2b_kyc_required_for_orders` gate ON without
    blocking already-onboarded retailers from placing orders. Sets
    `gst_verified=True, pan_verified=True, aadhaar_verified=True` on
    every retailer doc that currently has at least one of them False.
    Idempotent — re-running matches no docs.
    """
    await require_admin(request, session_token)
    now = datetime.now(timezone.utc).isoformat()
    res = await db.retailers.update_many(
        {
            "$or": [
                {"gst_verified": {"$ne": True}},
                {"pan_verified": {"$ne": True}},
                {"aadhaar_verified": {"$ne": True}},
            ]
        },
        {
            "$set": {
                "gst_verified": True,
                "pan_verified": True,
                "aadhaar_verified": True,
                "kyc_grandfathered_at": now,
            }
        },
    )
    logger.info(f"KYC grandfather migration matched={res.matched_count} modified={res.modified_count}")
    return {
        "matched": res.matched_count,
        "modified": res.modified_count,
        "grandfathered_at": now,
    }


# ============================================================================
# B2B Maintenance — bills migration to object storage
# ============================================================================

@router.post("/maintenance/migrate-bills")
async def admin_migrate_bills(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    dry_run: bool = False,
):
    """One-shot migrator: move legacy base64 bills into object storage.

    Pass `?dry_run=true` to count what would be migrated without writing.
    Idempotent — already-migrated bills are skipped automatically.
    """
    await require_admin(request, session_token)
    from scripts.migrate_bills_to_object_storage import migrate_bills

    result = await migrate_bills(db, dry_run=dry_run)
    return result


# ============================================================================
# B2B Order Status Management
# ============================================================================

# Valid status transitions
ORDER_STATUSES = [
    "ordered",
    "confirmed",
    "processing",
    "packaging",
    "shipped",
    "delivered",
    "returned",
    "modified"
]


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="New order status")
    note: Optional[str] = None


@router.get("/orders")
async def admin_list_b2b_orders(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    retailer_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin view all B2B orders"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    
    if status:
        query["order_status"] = status
    if retailer_id:
        query["retailer_id"] = retailer_id
    
    orders = await db.b2b_orders.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.b2b_orders.count_documents(query)
    
    # Get status counts
    status_counts = {}
    for s in ORDER_STATUSES:
        status_counts[s] = await db.b2b_orders.count_documents({"order_status": s})
    
    return {
        "orders": orders,
        "status_counts": status_counts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.get("/orders/{order_id}")
async def admin_get_b2b_order(
    order_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin get B2B order details"""
    await require_admin(request, session_token)
    
    order = await db.b2b_orders.find_one(
        {"order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get retailer info
    retailer = await db.retailers.find_one(
        {"retailer_id": order["retailer_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    return {
        "order": order,
        "retailer": retailer
    }


@router.put("/orders/{order_id}/status")
async def admin_update_b2b_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin update B2B order status"""
    admin = await require_admin(request, session_token)
    
    if status_data.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(ORDER_STATUSES)}"
        )
    
    order = await db.b2b_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.get("order_status")
    now = datetime.now(timezone.utc)
    
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "order_status": status_data.status,
                "updated_at": now.isoformat()
            },
            "$push": {
                "status_history": {
                    "status": status_data.status,
                    "timestamp": now.isoformat(),
                    "note": status_data.note,
                    "updated_by": admin.get("email", "admin")
                }
            }
        }
    )
    
    logger.info(f"B2B order {order_id} status updated to {status_data.status}")
    
    # Send email notification for status change
    try:
        if old_status != status_data.status:
            # Get retailer info for email
            retailer = await db.retailers.find_one(
                {"retailer_id": order["retailer_id"]},
                {"_id": 0, "email": 1, "business_name": 1, "trade_name": 1}
            )
            if retailer and retailer.get("email"):
                await send_b2b_status_change_email(
                    order, 
                    retailer, 
                    old_status, 
                    status_data.status, 
                    status_data.note
                )
    except Exception as e:
        logger.error(f"Failed to send B2B status change email: {str(e)}")
    
    return {
        "message": "Order status updated",
        "order_id": order_id,
        "new_status": status_data.status,
        "email_sent": True
    }


async def send_b2b_status_change_email(order: dict, retailer: dict, old_status: str, new_status: str, note: str = None):
    """Send email notification when B2B order status changes"""
    from services.email_service import send_email
    
    # Status display names and colors
    status_display = {
        "ordered": {"name": "Order Placed", "color": "#6B7280", "icon": "📝"},
        "confirmed": {"name": "Confirmed", "color": "#2563EB", "icon": "✓"},
        "processing": {"name": "Processing", "color": "#7C3AED", "icon": "⚙️"},
        "packaging": {"name": "Packaging", "color": "#EA580C", "icon": "📦"},
        "shipped": {"name": "Shipped", "color": "#0891B2", "icon": "🚚"},
        "delivered": {"name": "Delivered", "color": "#16A34A", "icon": "✅"},
        "returned": {"name": "Returned", "color": "#DC2626", "icon": "↩️"},
        "modified": {"name": "Modified", "color": "#CA8A04", "icon": "✏️"}
    }
    
    new_display = status_display.get(new_status, {"name": new_status.title(), "color": "#1e3a52", "icon": "📋"})
    business_name = retailer.get("trade_name") or retailer.get("business_name")
    
    # Build items table
    items_html = ""
    for item in order.get("items", [])[:5]:  # Show first 5 items
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{item['name']} ({item['net_weight']})</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">{item['quantity_boxes']} boxes</td>
        </tr>
        """
    
    if len(order.get("items", [])) > 5:
        items_html += f"""
        <tr>
            <td colspan="2" style="padding: 8px; color: #666; font-style: italic;">
                ... and {len(order['items']) - 5} more items
            </td>
        </tr>
        """
    
    note_section = ""
    if note:
        note_section = f"""
        <div style="margin-top: 15px; padding: 12px; background-color: #FEF3C7; border-radius: 6px; border-left: 4px solid #F59E0B;">
            <strong style="color: #92400E;">Admin Note:</strong>
            <p style="margin: 5px 0 0 0; color: #78350F;">{note}</p>
        </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 25px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 24px;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">B2B Order Update</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="display: inline-block; width: 70px; height: 70px; background-color: {new_display['color']}; border-radius: 50%; line-height: 70px; font-size: 32px;">
                            {new_display['icon']}
                        </div>
                        <h2 style="color: #1e3a52; margin: 15px 0 5px 0;">Order Status Updated</h2>
                        <p style="color: {new_display['color']}; font-size: 20px; font-weight: bold; margin: 0;">
                            {new_display['name']}
                        </p>
                    </div>
                    
                    <div style="background-color: #f9f7f4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <table width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                <td style="width: 50%;">
                                    <strong style="color: #666; font-size: 12px;">ORDER ID</strong><br>
                                    <span style="color: #1e3a52; font-size: 16px; font-weight: bold;">{order['order_id']}</span>
                                </td>
                                <td style="width: 50%; text-align: right;">
                                    <strong style="color: #666; font-size: 12px;">ORDER TOTAL</strong><br>
                                    <span style="color: #d4af37; font-size: 16px; font-weight: bold;">₹{order.get('grand_total', 0):,.2f}</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <h3 style="color: #1e3a52; margin-bottom: 10px; font-size: 16px;">Order Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 6px;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="padding: 10px; text-align: left; font-size: 13px;">Product</th>
                                <th style="padding: 10px; text-align: center; font-size: 13px;">Qty</th>
                            </tr>
                        </thead>
                        <tbody>{items_html}</tbody>
                    </table>
                    
                    {note_section}
                    
                    <div style="margin-top: 25px; padding: 15px; background-color: #EFF6FF; border-radius: 6px; text-align: center;">
                        <p style="margin: 0; color: #1E40AF; font-size: 14px;">
                            Track your order anytime in your <strong>Retailer Dashboard</strong>
                        </p>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0; font-size: 14px;">ADDRIKA - Premium Agarbattis</p>
                    <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Questions? Contact contact.us@centraders.com</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    subject = f"B2B Order {order['order_id']} - {new_display['name']} | Addrika"
    
    await send_email(
        to_email=retailer["email"],
        subject=subject,
        html_content=html
    )
    
    logger.info(f"B2B status change email sent to {retailer['email']} for order {order['order_id']}: {old_status} -> {new_status}")


# ============================================================================
# Retailer Voucher System
# ============================================================================

class VoucherCreate(BaseModel):
    code: Optional[str] = None  # Auto-generate if not provided
    discount_type: str = Field(..., pattern=r'^(percentage|fixed)$')
    discount_value: float = Field(..., gt=0)
    max_discount: Optional[float] = None  # For percentage discounts
    min_order: Optional[float] = None
    retailer_id: Optional[str] = None  # Specific retailer or None for all
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None


def generate_voucher_code(prefix: str = "RV") -> str:
    """Generate unique voucher code"""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=6))
    return f"{prefix}-{random_part}"


@router.post("/vouchers")
async def admin_create_voucher(
    voucher_data: VoucherCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin create retailer voucher"""
    admin = await require_admin(request, session_token)
    
    code = voucher_data.code or generate_voucher_code()
    code = code.upper()
    
    # Check for duplicate
    existing = await db.retailer_vouchers.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")
    
    now = datetime.now(timezone.utc)
    
    voucher = {
        "id": str(uuid.uuid4()),
        "code": code,
        "discount_type": voucher_data.discount_type,
        "discount_value": voucher_data.discount_value,
        "max_discount": voucher_data.max_discount,
        "min_order": voucher_data.min_order,
        "retailer_id": voucher_data.retailer_id,
        "max_uses": voucher_data.max_uses,
        "used_count": 0,
        "expires_at": voucher_data.expires_at,
        "is_active": True,
        "created_by": admin.get("email", "admin"),
        "created_at": now.isoformat()
    }
    
    await db.retailer_vouchers.insert_one(voucher)
    
    logger.info(f"Retailer voucher {code} created by admin")
    
    return {
        "message": "Voucher created successfully",
        "code": code,
        "discount_type": voucher_data.discount_type,
        "discount_value": voucher_data.discount_value
    }


@router.get("/vouchers")
async def admin_list_vouchers(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    is_active: Optional[bool] = None,
    retailer_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin list all retailer vouchers"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    
    if is_active is not None:
        query["is_active"] = is_active
    if retailer_id:
        query["retailer_id"] = retailer_id
    
    vouchers = await db.retailer_vouchers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_vouchers.count_documents(query)
    
    return {
        "vouchers": vouchers,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total
        }
    }


@router.put("/vouchers/{code}/deactivate")
async def admin_deactivate_voucher(
    code: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin deactivate a voucher"""
    await require_admin(request, session_token)
    
    result = await db.retailer_vouchers.update_one(
        {"code": code.upper()},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    return {"message": "Voucher deactivated", "code": code}


# ============================================================================
# Credit Note (CN) System
# ============================================================================

CN_REASONS = [
    "Goods Returned",
    "Damaged Pickup",
    "Self-Pick by Customer",
    "Shipped to Customer",
    "Quality Issue",
    "Price Adjustment",
    "Other"
]


class CreditNoteCreate(BaseModel):
    retailer_id: str
    amount: float = Field(..., gt=0)
    reason: str
    notes: Optional[str] = None


def generate_cn_code() -> str:
    """Generate unique credit note code"""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=8))
    return f"CN-{random_part}"


@router.post("/credit-notes")
async def admin_create_credit_note(
    cn_data: CreditNoteCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin create credit note for retailer"""
    admin = await require_admin(request, session_token)
    
    # Verify retailer exists
    retailer = await db.retailers.find_one({"retailer_id": cn_data.retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    if cn_data.reason not in CN_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reason. Must be one of: {', '.join(CN_REASONS)}"
        )
    
    code = generate_cn_code()
    now = datetime.now(timezone.utc)
    
    # 45 days validity excluding generation date
    expires_at = now + timedelta(days=46)  # 45 + 1 (excluding today)
    
    credit_note = {
        "id": str(uuid.uuid4()),
        "code": code,
        "retailer_id": cn_data.retailer_id,
        "retailer_email": retailer["email"],
        "retailer_name": retailer.get("business_name") or retailer.get("trade_name"),
        "amount": cn_data.amount,
        "balance": cn_data.amount,  # Initially full balance
        "reason": cn_data.reason,
        "notes": cn_data.notes,
        "status": "active",  # active, used, expired
        "expires_at": expires_at.isoformat(),
        "created_by": admin.get("email", "admin"),
        "created_at": now.isoformat()
    }
    
    await db.credit_notes.insert_one(credit_note)
    
    # Send email to retailer
    try:
        await send_credit_note_email(credit_note, retailer)
    except Exception as e:
        logger.error(f"Failed to send CN email: {str(e)}")
    
    logger.info(f"Credit note {code} created for retailer {cn_data.retailer_id}: ₹{cn_data.amount}")
    
    return {
        "message": "Credit note created successfully",
        "code": code,
        "amount": cn_data.amount,
        "expires_at": expires_at.isoformat(),
        "retailer_email": retailer["email"]
    }


async def send_credit_note_email(credit_note: dict, retailer: dict):
    """Send credit note notification email to retailer"""
    from services.email_service import send_email
    
    expiry_date = datetime.fromisoformat(credit_note["expires_at"]).strftime("%d %B %Y")
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0;">Credit Note Issued</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <p style="color: #333; font-size: 16px;">Dear {retailer.get('business_name', 'Partner')},</p>
                    
                    <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
                        <p style="color: #166534; font-size: 14px; margin: 0;">Your Credit Note Code</p>
                        <h2 style="color: #16a34a; font-size: 32px; margin: 10px 0; letter-spacing: 3px;">{credit_note['code']}</h2>
                        <p style="color: #166534; font-size: 28px; font-weight: bold; margin: 10px 0;">₹{credit_note['amount']:,.2f}</p>
                    </div>
                    
                    <div style="background-color: #f9f7f4; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Reason:</strong> {credit_note['reason']}</p>
                        <p style="margin: 5px 0;"><strong>Valid Until:</strong> {expiry_date}</p>
                        {f"<p style='margin: 5px 0;'><strong>Notes:</strong> {credit_note['notes']}</p>" if credit_note.get('notes') else ""}
                    </div>
                    
                    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            <strong>How to use:</strong> Enter this code during checkout on your next B2B order. 
                            The credit will be automatically applied to your order total.
                        </p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This credit note is valid for 45 days and can be used on any B2B order. 
                        Partial usage is allowed - any remaining balance can be used on future orders.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                    <p style="color: #d4af37; margin: 0;">ADDRIKA - Premium Agarbattis</p>
                    <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">Questions? Contact contact.us@centraders.com</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email(
        to_email=retailer["email"],
        subject=f"Credit Note Issued: {credit_note['code']} - ₹{credit_note['amount']:,.0f} | Addrika",
        html_content=html
    )


@router.get("/credit-notes")
async def admin_list_credit_notes(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    retailer_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin list all credit notes"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    
    if retailer_id:
        query["retailer_id"] = retailer_id
    if status:
        query["status"] = status
    
    credit_notes = await db.credit_notes.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.credit_notes.count_documents(query)
    
    # Get totals
    total_issued = await db.credit_notes.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    total_used = await db.credit_notes.aggregate([
        {"$group": {"_id": None, "total": {"$sum": {"$subtract": ["$amount", "$balance"]}}}}
    ]).to_list(1)
    
    return {
        "credit_notes": credit_notes,
        "summary": {
            "total_issued": total_issued[0]["total"] if total_issued else 0,
            "total_used": total_used[0]["total"] if total_used else 0
        },
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total
        }
    }


@router.get("/credit-notes/reasons")
async def get_cn_reasons(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get list of valid CN reasons"""
    await require_admin(request, session_token)
    return {"reasons": CN_REASONS}


# ============================================================================
# Self-Pickup Tracking
# ============================================================================

class SelfPickupRecord(BaseModel):
    order_id: str
    retailer_id: str
    items_count: int
    notes: Optional[str] = None


@router.post("/self-pickup/record")
async def admin_record_self_pickup(
    pickup_data: SelfPickupRecord,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Record a self-pickup fulfilled by retailer"""
    admin = await require_admin(request, session_token)
    
    # Verify retailer exists
    retailer = await db.retailers.find_one({"retailer_id": pickup_data.retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    now = datetime.now(timezone.utc)
    
    record = {
        "id": str(uuid.uuid4()),
        "order_id": pickup_data.order_id,
        "retailer_id": pickup_data.retailer_id,
        "retailer_name": retailer.get("business_name") or retailer.get("trade_name"),
        "items_count": pickup_data.items_count,
        "notes": pickup_data.notes,
        "recorded_by": admin.get("email", "admin"),
        "recorded_at": now.isoformat(),
        "month": now.strftime("%Y-%m"),
        "quarter": f"{now.year}-Q{(now.month - 1) // 3 + 1}"
    }
    
    await db.self_pickup_records.insert_one(record)
    
    # Update retailer stats
    await db.retailers.update_one(
        {"retailer_id": pickup_data.retailer_id},
        {
            "$inc": {
                "total_pickups_fulfilled": 1,
                "total_items_given": pickup_data.items_count
            }
        }
    )
    
    logger.info(f"Self-pickup recorded for retailer {pickup_data.retailer_id}: {pickup_data.items_count} items")
    
    return {
        "message": "Self-pickup recorded",
        "retailer_id": pickup_data.retailer_id,
        "items_count": pickup_data.items_count
    }


@router.get("/self-pickup/report")
async def admin_self_pickup_report(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    month: Optional[str] = None,  # Format: YYYY-MM
    quarter: Optional[str] = None,  # Format: YYYY-Q1
    retailer_id: Optional[str] = None
):
    """Get self-pickup report for retailer performance"""
    await require_admin(request, session_token)
    
    query = {}
    if month:
        query["month"] = month
    if quarter:
        query["quarter"] = quarter
    if retailer_id:
        query["retailer_id"] = retailer_id
    
    # Aggregate by retailer
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {
            "$group": {
                "_id": "$retailer_id",
                "retailer_name": {"$first": "$retailer_name"},
                "total_pickups": {"$sum": 1},
                "total_items": {"$sum": "$items_count"},
                "last_pickup": {"$max": "$recorded_at"}
            }
        },
        {"$sort": {"total_items": -1}}  # Sort by items descending for ranking
    ]
    
    results = await db.self_pickup_records.aggregate(pipeline).to_list(100)
    
    # Add rank
    for i, result in enumerate(results):
        result["rank"] = i + 1
        result["retailer_id"] = result.pop("_id")
    
    # Get overall totals
    totals = await db.self_pickup_records.aggregate([
        {"$match": query} if query else {"$match": {}},
        {
            "$group": {
                "_id": None,
                "total_pickups": {"$sum": 1},
                "total_items": {"$sum": "$items_count"},
                "unique_retailers": {"$addToSet": "$retailer_id"}
            }
        }
    ]).to_list(1)
    
    summary = {
        "total_pickups": totals[0]["total_pickups"] if totals else 0,
        "total_items": totals[0]["total_items"] if totals else 0,
        "unique_retailers": len(totals[0]["unique_retailers"]) if totals else 0
    }
    
    return {
        "retailers": results,
        "summary": summary,
        "filters": {
            "month": month,
            "quarter": quarter,
            "retailer_id": retailer_id
        }
    }


@router.get("/self-pickup/leaderboard")
async def admin_self_pickup_leaderboard(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "quarter"  # month, quarter, year, all
):
    """Get self-pickup leaderboard for Star Retailer selection"""
    await require_admin(request, session_token)
    
    now = datetime.now(timezone.utc)
    
    # Build query based on period
    query = {}
    if period == "month":
        query["month"] = now.strftime("%Y-%m")
    elif period == "quarter":
        query["quarter"] = f"{now.year}-Q{(now.month - 1) // 3 + 1}"
    elif period == "year":
        query["recorded_at"] = {"$gte": f"{now.year}-01-01T00:00:00"}
    
    # Aggregate and rank
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {
            "$group": {
                "_id": "$retailer_id",
                "retailer_name": {"$first": "$retailer_name"},
                "total_pickups": {"$sum": 1},
                "total_items": {"$sum": "$items_count"}
            }
        },
        {"$sort": {"total_items": -1, "total_pickups": -1}},
        {"$limit": 20}
    ]
    
    results = await db.self_pickup_records.aggregate(pipeline).to_list(20)
    
    leaderboard = []
    for i, result in enumerate(results):
        # Get retailer details
        retailer = await db.retailers.find_one(
            {"retailer_id": result["_id"]},
            {"_id": 0, "business_name": 1, "city": 1, "is_verified_partner": 1, "recognition_level": 1}
        )
        
        leaderboard.append({
            "rank": i + 1,
            "retailer_id": result["_id"],
            "retailer_name": result["retailer_name"],
            "city": retailer.get("city") if retailer else None,
            "is_verified_partner": retailer.get("is_verified_partner", False) if retailer else False,
            "recognition_level": retailer.get("recognition_level", "None") if retailer else "None",
            "total_pickups": result["total_pickups"],
            "total_items": result["total_items"],
            "eligible_for_star": result["total_items"] >= 50  # Example threshold
        })
    
    return {
        "leaderboard": leaderboard,
        "period": period,
        "period_label": {
            "month": now.strftime("%B %Y"),
            "quarter": f"Q{(now.month - 1) // 3 + 1} {now.year}",
            "year": str(now.year),
            "all": "All Time"
        }.get(period, period)
    }


# ============================================================================
# Retailer Abandoned Carts (B2B)
# ============================================================================

@router.get("/abandoned-carts")
async def admin_retailer_abandoned_carts(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    page: int = 1,
    limit: int = 50
):
    """Get retailer abandoned B2B carts"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    
    # Find carts that haven't been converted to orders in 24+ hours
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    carts = await db.retailer_b2b_carts.find(
        {
            "updated_at": {"$lt": cutoff},
            "converted_to_order": {"$ne": True}
        },
        {"_id": 0}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_b2b_carts.count_documents({
        "updated_at": {"$lt": cutoff},
        "converted_to_order": {"$ne": True}
    })
    
    # Enrich with retailer info
    for cart in carts:
        retailer = await db.retailers.find_one(
            {"retailer_id": cart.get("retailer_id")},
            {"_id": 0, "business_name": 1, "email": 1, "phone": 1}
        )
        cart["retailer"] = retailer
    
    return {
        "abandoned_carts": carts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total
        }
    }
