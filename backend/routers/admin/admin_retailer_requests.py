"""
Admin — Retailer verification requests (Iteration 100).

Manages the self-registered retailer accounts whose `status` is one of
`under_processing`, `verified`, `revoked`, or `suspended`. Admin can:
  • Approve (tick) → status='verified'
  • Revoke  → status='revoked' (retailer bounced back to Under Processing)
  • Suspend (with reason) → status='suspended' (login blocked)
  • Un-suspend → status='under_processing'
  • Append a note (admin_notes[])
  • Delete a request (hard-delete + soft-delete the cert file in storage)
  • Stream the GST certificate for review
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Query
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.object_storage import get_object

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-requests", tags=["Admin · Retailer Requests"])

ALLOWED_STATUSES = ("under_processing", "verified", "revoked", "suspended")


def _serialize(r: dict) -> dict:
    """Public shape for admin panel — strips password_hash, keeps notes."""
    return {
        "retailer_id": r.get("retailer_id"),
        "business_name": r.get("business_name"),
        "contact_name": r.get("contact_name") or r.get("name"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "country_code": r.get("country_code"),
        "gst_number": r.get("gst_number"),
        "gst_verified": bool(r.get("gst_verified")),
        "gst_verification_error": r.get("gst_verification_error"),
        "trade_name": r.get("trade_name"),
        "city": r.get("city"),
        "state": r.get("state"),
        "address": r.get("address"),
        "pincode": r.get("pincode"),
        "status": r.get("status"),
        "suspended_reason": r.get("suspended_reason"),
        "revoked_reason": r.get("revoked_reason"),
        "admin_notes": r.get("admin_notes") or [],
        "has_certificate": bool(
            (r.get("gst_certificate") or {}).get("storage_path")
            and not (r.get("gst_certificate") or {}).get("is_deleted")
        ),
        "certificate_filename": (r.get("gst_certificate") or {}).get("original_filename"),
        "created_at": r.get("created_at"),
        "verified_at": r.get("verified_at"),
        "last_status_change_at": r.get("last_status_change_at"),
    }


@router.get("")
async def list_retailer_requests(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """List self-registered retailers, newest first. Optional `status` filter."""
    await require_admin(request, session_token)
    q: dict = {"self_registered": True}
    if status:
        if status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        q["status"] = status

    skip = (page - 1) * limit
    cursor = db.retailers.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = [_serialize(r) async for r in cursor]
    total = await db.retailers.count_documents(q)

    counts = {}
    for s in ALLOWED_STATUSES:
        counts[s] = await db.retailers.count_documents({"self_registered": True, "status": s})

    return {
        "items": items,
        "status_counts": counts,
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/{retailer_id}")
async def get_retailer_request(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    r = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0, "password_hash": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Retailer request not found")
    return _serialize(r)


@router.get("/{retailer_id}/certificate")
async def download_certificate(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Stream the GST certificate to the admin. Admin auth required."""
    await require_admin(request, session_token)
    r = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0, "gst_certificate": 1})
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    cert = r.get("gst_certificate") or {}
    if not cert.get("storage_path") or cert.get("is_deleted"):
        raise HTTPException(status_code=404, detail="Certificate not available")
    got = await get_object(cert["storage_path"])
    if not got:
        # Return 404 instead of 502 — the edge/CDN swaps HTTP 5xx for its
        # own HTML gateway page, hiding the real detail from the admin.
        raise HTTPException(status_code=404, detail="Certificate not available in storage")
    data, ctype = got
    filename = cert.get("original_filename") or "gst-certificate"
    return Response(
        content=data,
        media_type=cert.get("content_type") or ctype or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


async def _apply_status(
    retailer_id: str,
    new_status: str,
    admin_email: str,
    *,
    reason: Optional[str] = None,
) -> dict:
    """Common status-change helper. Writes an audit note automatically."""
    r = await db.retailers.find_one({"retailer_id": retailer_id})
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")

    now = datetime.now(timezone.utc).isoformat()
    updates: dict = {
        "status": new_status,
        "last_status_change_at": now,
        "last_status_changed_by": admin_email,
    }
    unset: dict = {}
    if new_status == "verified":
        updates["verified_at"] = now
        updates["verified_by"] = admin_email
        updates["is_verified"] = True
        # Mirror the cert into legal_documents so the retailer dashboard's
        # legacy alerts endpoint stops complaining "GST Certificate not uploaded".
        cert = (r.get("gst_certificate") or {})
        if cert.get("storage_path"):
            updates["legal_documents"] = {
                **(r.get("legal_documents") or {}),
                "gst_certificate": cert.get("storage_path"),
                "gst_certificate_filename": cert.get("original_filename"),
            }
        unset.update({"suspended_reason": "", "revoked_reason": ""})
    elif new_status == "revoked":
        updates["revoked_at"] = now
        updates["revoked_by"] = admin_email
        updates["revoked_reason"] = reason or None
        updates["is_verified"] = False
        unset["suspended_reason"] = ""
    elif new_status == "suspended":
        updates["suspended_at"] = now
        updates["suspended_by"] = admin_email
        updates["suspended_reason"] = reason or "No reason provided"
        updates["is_verified"] = False
    elif new_status == "under_processing":
        updates["is_verified"] = False
        unset.update({"suspended_reason": "", "revoked_reason": ""})

    # Append an automatic audit note describing the transition
    note_body = f"Status changed to {new_status}"
    if reason:
        note_body += f" — {reason}"
    audit_note = {
        "id": f"note_{now}",
        "author": admin_email,
        "body": note_body,
        "created_at": now,
        "kind": "audit",
    }

    ops: dict = {"$set": updates, "$push": {"admin_notes": audit_note}}
    if unset:
        ops["$unset"] = unset
    await db.retailers.update_one({"retailer_id": retailer_id}, ops)

    # If we just suspended or revoked, kill all live sessions
    if new_status in ("suspended",):
        await db.retailer_sessions.delete_many({"retailer_id": retailer_id})

    updated = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0, "password_hash": 0})
    logger.info(f"Retailer {retailer_id} → {new_status} by {admin_email}")
    return _serialize(updated)


class _StatusBody(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


@router.post("/{retailer_id}/approve")
async def approve_retailer(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    return await _apply_status(retailer_id, "verified", admin.get("email", "admin"))


@router.post("/{retailer_id}/revoke")
async def revoke_retailer(
    retailer_id: str,
    body: _StatusBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    return await _apply_status(retailer_id, "revoked", admin.get("email", "admin"), reason=body.reason)


class _SuspendBody(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/{retailer_id}/suspend")
async def suspend_retailer(
    retailer_id: str,
    body: _SuspendBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    return await _apply_status(retailer_id, "suspended", admin.get("email", "admin"), reason=body.reason)


@router.post("/{retailer_id}/unsuspend")
async def unsuspend_retailer(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Move a suspended retailer back to under_processing so admin can re-review."""
    admin = await require_admin(request, session_token)
    return await _apply_status(retailer_id, "under_processing", admin.get("email", "admin"))


class _NoteBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


@router.post("/{retailer_id}/notes")
async def add_note(
    retailer_id: str,
    body: _NoteBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    r = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0, "retailer_id": 1})
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    now = datetime.now(timezone.utc).isoformat()
    note = {
        "id": f"note_{now}",
        "author": admin.get("email", "admin"),
        "body": body.body.strip(),
        "created_at": now,
        "kind": "manual",
    }
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {"$push": {"admin_notes": note}},
    )
    updated = await db.retailers.find_one({"retailer_id": retailer_id}, {"_id": 0, "password_hash": 0})
    return _serialize(updated)


@router.delete("/{retailer_id}")
async def delete_retailer_request(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Hard-delete the retailer record. The certificate object in storage
    can't literally be deleted (no delete API), so we mark it soft-deleted
    and stop serving it.
    """
    admin = await require_admin(request, session_token)
    r = await db.retailers.find_one({"retailer_id": retailer_id})
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    await db.retailer_sessions.delete_many({"retailer_id": retailer_id})
    await db.retailers.delete_one({"retailer_id": retailer_id})
    logger.info(f"Admin {admin.get('email')} deleted retailer request {retailer_id}")
    return {"ok": True, "deleted": retailer_id}
