"""
B2B Retailer Bills & Messages
- Admin-uploaded bills per retailer (GST invoices, statements, etc.)
- Two-way threaded messaging between admin and retailer with safe attachments

All payloads use base64 for files. Max 5MB per file. Allowed types: PDF, PNG, JPG, JPEG, WEBP.
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import base64

from dependencies import db, require_admin
from routers.retailer_auth import get_current_retailer as _get_retailer_from_req

logger = logging.getLogger(__name__)

# Routers
admin_router = APIRouter(prefix="/admin/b2b", tags=["Admin B2B Bills & Messages"])
retailer_router = APIRouter(prefix="/retailer-dashboard", tags=["Retailer Bills & Messages"])

ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _validate_attachment(file_base64: Optional[str], file_type: Optional[str]) -> None:
    if not file_base64:
        return
    if file_type and file_type.lower() not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="File type not allowed. Allowed: PDF, PNG, JPG, WEBP",
        )
    # Estimate decoded size (base64 expands by ~33%)
    try:
        data = file_base64.split(",")[-1]  # strip data: prefix if present
        approx_bytes = len(base64.b64decode(data, validate=True))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 attachment")
    if approx_bytes > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="File exceeds 5MB limit",
        )


# ============================================================================
# Bills
# ============================================================================

class BillCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    amount: Optional[float] = Field(None, ge=0)
    bill_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = Field(None, max_length=1000)
    file_base64: str = Field(..., description="Base64-encoded file (may include data: prefix)")
    file_name: str = Field(..., min_length=1, max_length=200)
    file_type: str = Field(..., description="MIME type")


@admin_router.post("/retailers/{retailer_id}/bills")
async def admin_upload_bill(
    retailer_id: str,
    data: BillCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    _validate_attachment(data.file_base64, data.file_type)

    now = datetime.now(timezone.utc).isoformat()
    bill_id = f"BILL-{datetime.now(timezone.utc).strftime('%Y%m')}-{str(uuid.uuid4())[:6].upper()}"
    doc = {
        "id": str(uuid.uuid4()),
        "bill_id": bill_id,
        "retailer_id": retailer_id,
        "title": data.title.strip(),
        "amount": data.amount,
        "bill_date": data.bill_date,
        "notes": (data.notes or "").strip() or None,
        "file_base64": data.file_base64,
        "file_name": data.file_name,
        "file_type": data.file_type.lower(),
        "uploaded_by": admin.get("email", "admin"),
        "created_at": now,
    }
    await db.retailer_bills.insert_one(doc)
    logger.info(f"Bill {bill_id} uploaded for retailer {retailer_id}")
    response = {k: v for k, v in doc.items() if k not in ("file_base64", "_id")}
    return {"message": "Bill uploaded", "bill": response}


@admin_router.get("/retailers/{retailer_id}/bills")
async def admin_list_bills(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    bills = await db.retailer_bills.find(
        {"retailer_id": retailer_id}, {"_id": 0, "file_base64": 0}
    ).sort("created_at", -1).to_list(200)
    return {"bills": bills}


@admin_router.get("/bills/{bill_id}/download")
async def admin_download_bill(
    bill_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    bill = await db.retailer_bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@admin_router.delete("/bills/{bill_id}")
async def admin_delete_bill(
    bill_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    result = await db.retailer_bills.delete_one({"bill_id": bill_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"deleted": True}


@retailer_router.get("/bills")
async def retailer_list_bills(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    retailer = await _get_retailer_from_req(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    bills = await db.retailer_bills.find(
        {"retailer_id": retailer["retailer_id"]},
        {"_id": 0, "file_base64": 0},
    ).sort("created_at", -1).to_list(200)
    return {"bills": bills}


@retailer_router.get("/bills/{bill_id}/download")
async def retailer_download_bill(
    bill_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    retailer = await _get_retailer_from_req(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    bill = await db.retailer_bills.find_one(
        {"bill_id": bill_id, "retailer_id": retailer["retailer_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


# ============================================================================
# Messages
# ============================================================================

class MessageAttachment(BaseModel):
    file_base64: str
    file_name: str
    file_type: str


class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    attachments: Optional[List[MessageAttachment]] = None


def _thread_id(retailer_id: str) -> str:
    return f"thr_{retailer_id}"


async def _insert_message(
    retailer_id: str,
    sender_type: str,
    sender_id: str,
    sender_name: str,
    message: str,
    attachments: Optional[List[MessageAttachment]],
) -> dict:
    # Validate attachments
    attach_docs = []
    for a in (attachments or []):
        _validate_attachment(a.file_base64, a.file_type)
        attach_docs.append(
            {
                "file_base64": a.file_base64,
                "file_name": a.file_name,
                "file_type": a.file_type.lower(),
            }
        )
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "thread_id": _thread_id(retailer_id),
        "retailer_id": retailer_id,
        "sender_type": sender_type,  # admin | retailer
        "sender_id": sender_id,
        "sender_name": sender_name,
        "message": message,
        "attachments": attach_docs,
        "is_read_by_admin": sender_type == "admin",
        "is_read_by_retailer": sender_type == "retailer",
        "created_at": now,
    }
    await db.retailer_admin_messages.insert_one(doc)
    # Strip Mongo-injected _id before returning
    doc.pop("_id", None)
    # Upsert thread doc (for fast listing in admin)
    await db.retailer_admin_threads.update_one(
        {"thread_id": doc["thread_id"]},
        {
            "$set": {
                "thread_id": doc["thread_id"],
                "retailer_id": retailer_id,
                "last_message_preview": message[:200],
                "last_message_sender": sender_type,
                "last_message_at": now,
            },
            "$inc": {
                "unread_admin_count": 0 if sender_type == "admin" else 1,
                "unread_retailer_count": 0 if sender_type == "retailer" else 1,
            },
        },
        upsert=True,
    )
    return {k: v for k, v in doc.items() if k not in ("attachments", "_id")} | {
        "attachments": [
            {k2: v2 for k2, v2 in a.items() if k2 != "file_base64"} for a in attach_docs
        ]
    }


# ---- Retailer side ----

@retailer_router.get("/admin-chat")
async def retailer_list_messages(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    retailer = await _get_retailer_from_req(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    msgs = await db.retailer_admin_messages.find(
        {"retailer_id": retailer["retailer_id"]},
        {"_id": 0, "attachments.file_base64": 0},
    ).sort("created_at", 1).to_list(500)
    # Mark all as read by retailer
    await db.retailer_admin_messages.update_many(
        {"retailer_id": retailer["retailer_id"], "is_read_by_retailer": False},
        {"$set": {"is_read_by_retailer": True}},
    )
    await db.retailer_admin_threads.update_one(
        {"thread_id": _thread_id(retailer["retailer_id"])},
        {"$set": {"unread_retailer_count": 0}},
    )
    return {"messages": msgs, "thread_id": _thread_id(retailer["retailer_id"])}


@retailer_router.post("/admin-chat")
async def retailer_send_message(
    data: MessageCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    retailer = await _get_retailer_from_req(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await _insert_message(
        retailer_id=retailer["retailer_id"],
        sender_type="retailer",
        sender_id=retailer["retailer_id"],
        sender_name=retailer.get("business_name") or retailer.get("name") or retailer.get("email"),
        message=data.message,
        attachments=data.attachments,
    )


@retailer_router.get("/admin-chat/attachment/{message_id}/{index}")
async def retailer_download_message_attachment(
    message_id: str,
    index: int,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
):
    retailer = await _get_retailer_from_req(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    msg = await db.retailer_admin_messages.find_one(
        {"id": message_id, "retailer_id": retailer["retailer_id"]}, {"_id": 0}
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    atts = msg.get("attachments") or []
    if index < 0 or index >= len(atts):
        raise HTTPException(status_code=404, detail="Attachment not found")
    return atts[index]


# ---- Admin side ----

@admin_router.get("/threads")
async def admin_list_threads(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    threads = await db.retailer_admin_threads.find({}, {"_id": 0}).sort(
        "last_message_at", -1
    ).to_list(200)
    # Enrich with retailer name
    for t in threads:
        rtl = await db.retailers.find_one(
            {"retailer_id": t.get("retailer_id")},
            {"_id": 0, "business_name": 1, "trade_name": 1, "email": 1},
        )
        t["retailer_name"] = (rtl or {}).get("business_name") or (rtl or {}).get(
            "trade_name"
        ) or "—"
        t["retailer_email"] = (rtl or {}).get("email")
    return {"threads": threads}


@admin_router.get("/retailers/{retailer_id}/messages")
async def admin_list_thread_messages(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    msgs = await db.retailer_admin_messages.find(
        {"retailer_id": retailer_id},
        {"_id": 0, "attachments.file_base64": 0},
    ).sort("created_at", 1).to_list(500)
    # mark read by admin
    await db.retailer_admin_messages.update_many(
        {"retailer_id": retailer_id, "is_read_by_admin": False},
        {"$set": {"is_read_by_admin": True}},
    )
    await db.retailer_admin_threads.update_one(
        {"thread_id": _thread_id(retailer_id)}, {"$set": {"unread_admin_count": 0}}
    )
    return {"messages": msgs}


@admin_router.post("/retailers/{retailer_id}/messages")
async def admin_send_message(
    retailer_id: str,
    data: MessageCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    return await _insert_message(
        retailer_id=retailer_id,
        sender_type="admin",
        sender_id=admin.get("email", "admin"),
        sender_name="Addrika Team",
        message=data.message,
        attachments=data.attachments,
    )


@admin_router.get("/messages/attachment/{message_id}/{index}")
async def admin_download_message_attachment(
    message_id: str,
    index: int,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    msg = await db.retailer_admin_messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    atts = msg.get("attachments") or []
    if index < 0 or index >= len(atts):
        raise HTTPException(status_code=404, detail="Attachment not found")
    return atts[index]
