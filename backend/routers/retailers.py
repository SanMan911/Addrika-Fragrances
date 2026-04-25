"""
Retailer Management Router
Admin endpoints for managing retailers with full legal compliance
"""
from fastapi import APIRouter, HTTPException, Request, Cookie, UploadFile, File, Form, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, EmailStr, field_validator
import logging
import uuid
import base64

from dependencies import db, require_admin as deps_require_admin
from services.auth_service import hash_password
from services.badge_notifications import (
    send_verified_partner_notification,
    send_retailer_label_notification
)
from models.retailers import (
    to_title_case, validate_gst_number
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailers", tags=["Retailers"])


# ===================== Helper Functions =====================

async def require_admin(request: Request, session_token: Optional[str] = None):
    """Verify admin access - wrapper around deps_require_admin"""
    # Use the shared require_admin from dependencies that properly validates sessions
    return await deps_require_admin(request, session_token)


def generate_retailer_id():
    """Generate unique retailer ID"""
    return f"RTL_{str(uuid.uuid4())[:8].upper()}"


# ===================== Admin: Create Retailer =====================

class RetailerCreateRequest(BaseModel):
    """Full retailer creation with compliance - Admin only"""
    # Business Details (Mandatory)
    business_name: str = Field(..., min_length=2, max_length=200)
    gst_number: str = Field(..., min_length=15, max_length=15)
    trade_name: Optional[str] = None  # Display name if different
    
    # Authentication
    username: Optional[str] = Field(None, min_length=3, max_length=50)  # Login username
    
    # Contact Details
    email: EmailStr
    phone_country_code: Optional[str] = '+91'
    phone: str = Field(..., min_length=10, max_length=15)
    whatsapp_country_code: Optional[str] = '+91'
    whatsapp: Optional[str] = None
    
    # Registered Address (as per GST)
    registered_address: str = Field(..., min_length=10)
    city: str
    district: str
    state: str
    pincode: str = Field(..., pattern=r'^\d{6}$')
    coordinates: Optional[dict] = None
    
    # SPOC Details (Mandatory)
    spoc_name: str = Field(..., min_length=2, max_length=100)
    spoc_designation: Optional[str] = None
    spoc_phone_country_code: Optional[str] = '+91'
    spoc_phone: str = Field(..., min_length=10, max_length=15)
    spoc_email: Optional[EmailStr] = None
    spoc_dob: Optional[str] = None
    spoc_anniversary: Optional[str] = None
    spoc_id_proof_type: Optional[str] = None
    spoc_id_proof_number: Optional[str] = None
    
    # Authentication
    password: str = Field(..., min_length=6)
    
    @field_validator('username', mode='before')
    @classmethod
    def validate_username(cls, v):
        if v:
            # Only allow lowercase alphanumeric and underscore
            import re
            if not re.match(r'^[a-z0-9_]+$', v):
                raise ValueError('Username must contain only lowercase letters, numbers, and underscores')
        return v
    
    @field_validator('business_name', 'trade_name', 'city', 'district', 'state', 'spoc_name', 'spoc_designation', mode='before')
    @classmethod
    def apply_title_case(cls, v):
        return to_title_case(v) if v else v
    
    @field_validator('gst_number', mode='before')
    @classmethod
    def validate_gst(cls, v):
        if v:
            return validate_gst_number(v)
        return v


@router.post("/admin/create")
async def admin_create_retailer(
    retailer_data: RetailerCreateRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin creates new retailer with full compliance details"""
    admin = await require_admin(request, session_token)
    
    # Check if email already exists
    existing = await db.retailers.find_one({"email": retailer_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if GST number already exists
    existing_gst = await db.retailers.find_one({"gst_number": retailer_data.gst_number})
    if existing_gst:
        raise HTTPException(status_code=400, detail="GST number already registered")
    
    # Check if username already exists (if provided)
    if retailer_data.username:
        existing_username = await db.retailers.find_one({"username": retailer_data.username.lower()})
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    now = datetime.now(timezone.utc)
    
    # Create SPOC details
    spoc = {
        "name": retailer_data.spoc_name,
        "designation": retailer_data.spoc_designation,
        "phone_country_code": retailer_data.spoc_phone_country_code or '+91',
        "phone": retailer_data.spoc_phone,
        "email": retailer_data.spoc_email,
        "date_of_birth": retailer_data.spoc_dob,
        "anniversary": retailer_data.spoc_anniversary,
        "id_proof_type": retailer_data.spoc_id_proof_type,
        "id_proof_number": retailer_data.spoc_id_proof_number,
        "id_proof_document": None
    }
    
    # Create retailer document
    retailer = {
        "id": str(uuid.uuid4()),
        "retailer_id": generate_retailer_id(),
        "business_name": retailer_data.business_name,
        "trade_name": retailer_data.trade_name or retailer_data.business_name,
        "gst_number": retailer_data.gst_number,
        "gst_state_code": retailer_data.gst_number[:2],
        "username": retailer_data.username.lower() if retailer_data.username else None,
        "email": retailer_data.email.lower(),
        "phone_country_code": retailer_data.phone_country_code or '+91',
        "phone": retailer_data.phone,
        "whatsapp_country_code": retailer_data.whatsapp_country_code or '+91',
        "whatsapp": retailer_data.whatsapp,
        "registered_address": retailer_data.registered_address,
        "city": retailer_data.city,
        "district": retailer_data.district,
        "state": retailer_data.state,
        "pincode": retailer_data.pincode,
        "coordinates": retailer_data.coordinates,
        "spoc": spoc,
        "legal_documents": {
            "gst_certificate": None,
            "gst_certificate_uploaded_at": None,
            "gst_certificate_valid_until": None,
            "business_registration": None,
            "trade_license": None,
            "other_documents": []
        },
        "password_hash": hash_password(retailer_data.password),
        "status": "pending_verification",
        "is_verified": False,
        "gst_verified": False,
        "documents_complete": False,
        "total_orders_handled": 0,
        "total_pickups_completed": 0,
        "total_revenue": 0.0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": admin.get('email', 'admin'),
        "last_updated_by": admin.get('email', 'admin')
    }
    
    await db.retailers.insert_one(retailer)
    
    logger.info(f"Admin created retailer: {retailer['retailer_id']} - {retailer['business_name']}")
    
    # Remove sensitive data before returning
    retailer.pop('password_hash', None)
    retailer.pop('_id', None)
    
    return {
        "message": "Retailer created successfully",
        "retailer_id": retailer['retailer_id'],
        "business_name": retailer['business_name'],
        "status": "pending_verification",
        "next_steps": [
            "Upload GST certificate",
            "Upload SPOC ID proof",
            "Verify retailer"
        ]
    }


# ===================== Admin: Update Retailer =====================

class RetailerUpdateRequest(BaseModel):
    """Update retailer details - Admin only"""
    business_name: Optional[str] = None
    trade_name: Optional[str] = None
    gst_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_country_code: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_country_code: Optional[str] = None
    whatsapp: Optional[str] = None
    registered_address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    coordinates: Optional[dict] = None
    
    # SPOC Details
    spoc_name: Optional[str] = None
    spoc_designation: Optional[str] = None
    spoc_phone_country_code: Optional[str] = None
    spoc_phone: Optional[str] = None
    spoc_email: Optional[EmailStr] = None
    spoc_dob: Optional[str] = None
    spoc_anniversary: Optional[str] = None
    spoc_id_proof_type: Optional[str] = None
    spoc_id_proof_number: Optional[str] = None
    
    # Status
    status: Optional[str] = None
    suspended_reason: Optional[str] = None
    is_verified: Optional[bool] = None
    gst_verified: Optional[bool] = None
    
    # Badges & Labels
    is_addrika_verified_partner: Optional[bool] = None  # "Addrika Verified Partner" badge
    retailer_label: Optional[str] = None  # "top_retailer_month", "star_retailer_quarter", etc.
    label_period: Optional[str] = None  # e.g., "March 2026", "Q1 2026"
    
    @field_validator('business_name', 'trade_name', 'city', 'district', 'state', 'spoc_name', 'spoc_designation', mode='before')
    @classmethod
    def apply_title_case(cls, v):
        return to_title_case(v) if v else v
    
    @field_validator('gst_number', mode='before')
    @classmethod
    def validate_gst(cls, v):
        if v:
            return validate_gst_number(v)
        return v


@router.put("/admin/{retailer_id}")
async def admin_update_retailer(
    retailer_id: str,
    update_data: RetailerUpdateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session_token: Optional[str] = Cookie(None),
    send_notification: bool = True  # Query param to optionally disable notifications
):
    """Admin updates retailer details. Sends badge notifications by default."""
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    now = datetime.now(timezone.utc)
    
    # Build update document
    update_doc = {"updated_at": now.isoformat(), "last_updated_by": admin.get('email', 'admin')}
    
    # Direct fields
    direct_fields = [
        'business_name', 'trade_name', 'gst_number', 'email', 'phone', 'whatsapp',
        'registered_address', 'city', 'district', 'state', 'pincode', 'coordinates',
        'status', 'suspended_reason', 'is_verified', 'gst_verified',
        'is_addrika_verified_partner', 'retailer_label', 'label_period'
    ]
    
    for field in direct_fields:
        value = getattr(update_data, field, None)
        if value is not None:
            if field == 'email':
                update_doc[field] = value.lower()
            else:
                update_doc[field] = value
    
    # Update GST state code if GST changed
    if update_data.gst_number:
        update_doc['gst_state_code'] = update_data.gst_number[:2]
    
    # SPOC fields
    spoc_fields = ['spoc_name', 'spoc_designation', 'spoc_phone', 'spoc_email', 
                   'spoc_dob', 'spoc_anniversary', 'spoc_id_proof_type', 'spoc_id_proof_number']
    
    spoc_updates = {}
    for field in spoc_fields:
        value = getattr(update_data, field, None)
        if value is not None:
            spoc_key = field.replace('spoc_', '')
            if spoc_key == 'dob':
                spoc_key = 'date_of_birth'
            spoc_updates[f"spoc.{spoc_key}"] = value
    
    update_doc.update(spoc_updates)
    
    # Handle status changes
    if update_data.status == 'suspended':
        update_doc['suspended_at'] = now.isoformat()
    elif update_data.status == 'active' and retailer.get('status') == 'suspended':
        update_doc['suspended_at'] = None
        update_doc['suspended_reason'] = None
    
    # Handle verification
    if update_data.is_verified and not retailer.get('is_verified'):
        update_doc['verified_at'] = now.isoformat()
        update_doc['verified_by'] = admin.get('email', 'admin')
    
    # Track badge history for Verified Partner
    badge_history_events = []
    old_verified_partner = retailer.get('is_addrika_verified_partner', False)
    new_verified_partner = update_data.is_addrika_verified_partner
    
    if new_verified_partner is True and not old_verified_partner:
        badge_history_events.append({
            "event_id": str(uuid.uuid4()),
            "badge_type": "verified_partner",
            "badge_name": "Addrika Verified Partner",
            "action": "awarded",
            "awarded_at": now.isoformat(),
            "awarded_by": admin.get('email', 'admin')
        })
    elif new_verified_partner is False and old_verified_partner:
        badge_history_events.append({
            "event_id": str(uuid.uuid4()),
            "badge_type": "verified_partner",
            "badge_name": "Addrika Verified Partner",
            "action": "revoked",
            "revoked_at": now.isoformat(),
            "revoked_by": admin.get('email', 'admin')
        })
    
    # Track badge history for Labels
    old_label = retailer.get('retailer_label', '')
    new_label = update_data.retailer_label
    new_period = update_data.label_period
    
    # Label mapping for display names
    label_names = {
        'top_retailer_month': 'Top Retailer of the Month',
        'top_retailer_quarter': 'Top Retailer of the Quarter',
        'star_retailer_month': 'Star Retailer of the Month',
        'star_retailer_quarter': 'Star Retailer of the Quarter',
        'rising_star': 'Rising Star',
        'best_performer': 'Best Performer'
    }
    
    if new_label and new_label != old_label:
        badge_history_events.append({
            "event_id": str(uuid.uuid4()),
            "badge_type": "label",
            "badge_key": new_label,
            "badge_name": label_names.get(new_label, new_label),
            "period": new_period,
            "action": "awarded",
            "awarded_at": now.isoformat(),
            "awarded_by": admin.get('email', 'admin')
        })
        # If replacing an old label, mark it as replaced
        if old_label:
            badge_history_events.append({
                "event_id": str(uuid.uuid4()),
                "badge_type": "label",
                "badge_key": old_label,
                "badge_name": label_names.get(old_label, old_label),
                "period": retailer.get('label_period'),
                "action": "replaced",
                "replaced_at": now.isoformat(),
                "replaced_by": new_label
            })
    elif new_label == '' and old_label:
        # Label removed
        badge_history_events.append({
            "event_id": str(uuid.uuid4()),
            "badge_type": "label",
            "badge_key": old_label,
            "badge_name": label_names.get(old_label, old_label),
            "period": retailer.get('label_period'),
            "action": "removed",
            "removed_at": now.isoformat(),
            "removed_by": admin.get('email', 'admin')
        })
    
    # Update retailer document
    update_ops = {"$set": update_doc}
    
    # Add badge history events if any
    if badge_history_events:
        update_ops["$push"] = {"badge_history": {"$each": badge_history_events}}
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        update_ops
    )
    
    logger.info(f"Admin updated retailer: {retailer_id}")
    
    # Send badge notifications in background if enabled
    notifications_queued = []
    
    if send_notification:
        # Get updated retailer data for notifications
        updated_retailer = await db.retailers.find_one(
            {"retailer_id": retailer_id},
            {"_id": 0, "password_hash": 0}
        )
        
        # Check for Verified Partner badge change (only notify when newly awarded)
        if new_verified_partner is True and not old_verified_partner:
            background_tasks.add_task(send_verified_partner_notification, updated_retailer)
            notifications_queued.append('verified_partner')
            logger.info(f"Queued Verified Partner notification for {retailer_id}")
        
        # Check for label change (only notify when newly assigned or changed)
        if new_label and new_label != old_label:
            background_tasks.add_task(
                send_retailer_label_notification, 
                updated_retailer, 
                new_label, 
                new_period or updated_retailer.get('label_period')
            )
            notifications_queued.append(f'label:{new_label}')
            logger.info(f"Queued label notification ({new_label}) for {retailer_id}")
    
    response = {
        "message": "Retailer updated successfully", 
        "retailer_id": retailer_id
    }
    
    if notifications_queued:
        response["notifications_sent"] = notifications_queued
    
    return response


# ===================== Admin: Upload Documents =====================

@router.post("/admin/{retailer_id}/documents/gst-certificate")
async def admin_upload_gst_certificate(
    retailer_id: str,
    request: Request,
    file: UploadFile = File(...),
    valid_until: Optional[str] = Form(None),
    session_token: Optional[str] = Cookie(None)
):
    """Admin uploads GST certificate for retailer"""
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Validate file
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    if not file.content_type.startswith(('image/', 'application/pdf')):
        raise HTTPException(status_code=400, detail="Only images and PDFs allowed")
    
    # Store as base64
    doc_data = f"data:{file.content_type};base64,{base64.b64encode(contents).decode()}"
    now = datetime.now(timezone.utc)
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {
            "$set": {
                "legal_documents.gst_certificate": doc_data,
                "legal_documents.gst_certificate_uploaded_at": now.isoformat(),
                "legal_documents.gst_certificate_valid_until": valid_until,
                "updated_at": now.isoformat(),
                "last_updated_by": admin.get('email', 'admin')
            }
        }
    )
    
    # Check if documents are complete
    await check_documents_complete(retailer_id)
    
    logger.info(f"GST certificate uploaded for retailer: {retailer_id}")
    
    return {"message": "GST certificate uploaded successfully"}


@router.post("/admin/{retailer_id}/documents/spoc-id")
async def admin_upload_spoc_id(
    retailer_id: str,
    request: Request,
    file: UploadFile = File(...),
    id_type: str = Form(...),
    id_number: str = Form(...),
    session_token: Optional[str] = Cookie(None)
):
    """Admin uploads SPOC ID proof"""
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Validate file
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    if not file.content_type.startswith(('image/', 'application/pdf')):
        raise HTTPException(status_code=400, detail="Only images and PDFs allowed")
    
    # Store as base64
    doc_data = f"data:{file.content_type};base64,{base64.b64encode(contents).decode()}"
    now = datetime.now(timezone.utc)
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {
            "$set": {
                "spoc.id_proof_type": id_type,
                "spoc.id_proof_number": id_number,
                "spoc.id_proof_document": doc_data,
                "updated_at": now.isoformat(),
                "last_updated_by": admin.get('email', 'admin')
            }
        }
    )
    
    await check_documents_complete(retailer_id)
    
    logger.info(f"SPOC ID proof uploaded for retailer: {retailer_id}")
    
    return {"message": "SPOC ID proof uploaded successfully"}


async def check_documents_complete(retailer_id: str):
    """Check if all required documents are uploaded"""
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        return
    
    legal_docs = retailer.get('legal_documents', {})
    spoc = retailer.get('spoc', {})
    
    gst_uploaded = bool(legal_docs.get('gst_certificate'))
    spoc_id_uploaded = bool(spoc.get('id_proof_document'))
    
    documents_complete = gst_uploaded and spoc_id_uploaded
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {"$set": {"documents_complete": documents_complete}}
    )


# ===================== Admin: Get All Retailers =====================

@router.get("/admin/list")
async def admin_list_retailers(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin gets all retailers with compliance status"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    if status:
        query["status"] = status
    
    retailers = await db.retailers.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add compliance summary to each
    for r in retailers:
        legal_docs = r.get('legal_documents', {})
        spoc = r.get('spoc', {})
        r['compliance_summary'] = {
            "gst_certificate_uploaded": bool(legal_docs.get('gst_certificate')),
            "spoc_id_uploaded": bool(spoc.get('id_proof_document')),
            "is_verified": r.get('is_verified', False),
            "gst_verified": r.get('gst_verified', False),
            "documents_complete": r.get('documents_complete', False)
        }
    
    total = await db.retailers.count_documents(query)
    
    # Status counts
    status_counts = {
        "active": await db.retailers.count_documents({"status": "active"}),
        "pending_verification": await db.retailers.count_documents({"status": "pending_verification"}),
        "suspended": await db.retailers.count_documents({"status": "suspended"})
    }
    
    return {
        "retailers": retailers,
        "status_counts": status_counts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


# ===================== Admin: Profile Change Tickets =====================
# NOTE: These routes MUST come BEFORE /admin/{retailer_id} to avoid path conflicts

@router.get("/admin/profile-change-tickets")
async def admin_list_profile_change_tickets(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """Admin views all profile change tickets"""
    await require_admin(request, session_token)
    
    skip = (page - 1) * limit
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.profile_change_tickets.find(
        query,
        {"_id": 0, "supporting_document": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.profile_change_tickets.count_documents(query)
    
    # Status counts
    status_counts = {
        "pending": await db.profile_change_tickets.count_documents({"status": "pending"}),
        "under_review": await db.profile_change_tickets.count_documents({"status": "under_review"}),
        "approved": await db.profile_change_tickets.count_documents({"status": "approved"}),
        "rejected": await db.profile_change_tickets.count_documents({"status": "rejected"})
    }
    
    return {
        "tickets": tickets,
        "status_counts": status_counts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.get("/admin/profile-change-tickets/{ticket_id}")
async def admin_get_profile_change_ticket(
    ticket_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin gets full ticket details including supporting document"""
    await require_admin(request, session_token)
    
    ticket = await db.profile_change_tickets.find_one(
        {"ticket_id": ticket_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Also get retailer info
    retailer = await db.retailers.find_one(
        {"retailer_id": ticket['retailer_id']},
        {"_id": 0, "password_hash": 0}
    )
    
    return {
        "ticket": ticket,
        "retailer": retailer
    }


class TicketReviewRequest(BaseModel):
    status: str = Field(..., pattern=r'^(under_review|approved|rejected)$')
    admin_notes: Optional[str] = Field(None, max_length=500)


@router.put("/admin/profile-change-tickets/{ticket_id}")
async def admin_review_profile_change_ticket(
    ticket_id: str,
    review_data: TicketReviewRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin reviews and updates ticket status"""
    admin = await require_admin(request, session_token)
    
    ticket = await db.profile_change_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": review_data.status,
        "admin_notes": review_data.admin_notes,
        "reviewed_by": admin.get('email', 'admin'),
        "reviewed_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.profile_change_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin reviewed ticket {ticket_id}: {review_data.status}")
    
    # TODO: Send email notification to retailer about ticket status update
    
    return {
        "message": f"Ticket {review_data.status}",
        "ticket_id": ticket_id,
        "new_status": review_data.status
    }


# ===================== Admin: Get Retailer Details =====================

@router.get("/admin/{retailer_id}")
async def admin_get_retailer(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Admin gets full retailer details including documents"""
    await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one(
        {"retailer_id": retailer_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    return {"retailer": retailer}


# ===================== Admin: Delete/Remove Retailer =====================

@router.delete("/admin/{retailer_id}")
async def admin_delete_retailer(
    retailer_id: str,
    request: Request,
    permanent: bool = False,
    session_token: Optional[str] = Cookie(None)
):
    """
    Admin deletes/removes a retailer.
    - permanent=False: Soft delete (marks as 'deleted' status, retains data)
    - permanent=True: Hard delete (permanently removes from database)
    """
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    now = datetime.now(timezone.utc)
    
    if permanent:
        # Hard delete - permanently remove
        await db.retailers.delete_one({"retailer_id": retailer_id})
        logger.info(f"Admin permanently deleted retailer: {retailer_id} by {admin.get('email', 'admin')}")
        
        # Log the deletion event for audit
        await db.admin_events.insert_one({
            "event_type": "retailer_deleted",
            "retailer_id": retailer_id,
            "business_name": retailer.get('business_name'),
            "deleted_by": admin.get('email', 'admin'),
            "deletion_type": "permanent",
            "created_at": now.isoformat()
        })
        
        return {
            "message": "Retailer permanently deleted",
            "retailer_id": retailer_id,
            "deletion_type": "permanent"
        }
    else:
        # Soft delete - mark as deleted but retain data
        await db.retailers.update_one(
            {"retailer_id": retailer_id},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_at": now.isoformat(),
                    "deleted_by": admin.get('email', 'admin'),
                    "updated_at": now.isoformat(),
                    "last_updated_by": admin.get('email', 'admin')
                }
            }
        )
        
        logger.info(f"Admin soft-deleted retailer: {retailer_id} by {admin.get('email', 'admin')}")
        
        return {
            "message": "Retailer marked as deleted (soft delete)",
            "retailer_id": retailer_id,
            "deletion_type": "soft",
            "note": "Retailer data is retained. Use permanent=true to permanently remove."
        }


# ===================== Admin: Restore Deleted Retailer =====================

@router.post("/admin/{retailer_id}/restore")
async def admin_restore_retailer(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Restore a soft-deleted retailer"""
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    if retailer.get('status') != 'deleted':
        raise HTTPException(status_code=400, detail="Retailer is not deleted")
    
    now = datetime.now(timezone.utc)
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {
            "$set": {
                "status": "pending_verification",
                "deleted_at": None,
                "deleted_by": None,
                "restored_at": now.isoformat(),
                "restored_by": admin.get('email', 'admin'),
                "updated_at": now.isoformat(),
                "last_updated_by": admin.get('email', 'admin')
            }
        }
    )
    
    logger.info(f"Admin restored retailer: {retailer_id} by {admin.get('email', 'admin')}")
    
    return {
        "message": "Retailer restored successfully",
        "retailer_id": retailer_id,
        "new_status": "pending_verification"
    }


# ===================== Public: Get Retailers for Pickup Selection =====================

@router.get("/")
async def get_retailers_for_pickup():
    """Get active retailers for store pickup selection (public)"""
    retailers = await db.retailers.find(
        {"status": "active", "is_verified": True},
        {
            "_id": 0, 
            "password_hash": 0, 
            "legal_documents": 0,
            "spoc.id_proof_document": 0,
            "spoc.id_proof_number": 0
        }
    ).to_list(100)
    
    return {"retailers": retailers}


@router.get("/states-districts")
async def get_states_and_districts():
    """Get unique states and districts from verified retailers"""
    retailers = await db.retailers.find(
        {"status": "active", "is_verified": True},
        {"state": 1, "district": 1, "_id": 0}
    ).to_list(500)
    
    states = list(set(r.get('state') for r in retailers if r.get('state')))
    states.sort()
    
    districts_by_state = {}
    for r in retailers:
        state = r.get('state')
        district = r.get('district')
        if state and district:
            if state not in districts_by_state:
                districts_by_state[state] = set()
            districts_by_state[state].add(district)
    
    for state in districts_by_state:
        districts_by_state[state] = sorted(list(districts_by_state[state]))
    
    return {"states": states, "districts_by_state": districts_by_state}


@router.get("/by-location")
async def get_retailers_by_location(state: str, district: str):
    """Get verified retailers by state and district"""
    retailers = await db.retailers.find(
        {
            "state": state,
            "district": district,
            "status": "active",
            "is_verified": True
        },
        {
            "_id": 0,
            "password_hash": 0,
            "legal_documents": 0,
            "spoc.id_proof_document": 0
        }
    ).to_list(50)
    
    return {"retailers": retailers}


# ===================== Retailer: Get Profile Summary (shown at login) =====================

@router.get("/profile/summary")
async def get_retailer_profile_summary(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get retailer profile summary with compliance status - shown at each login"""
    from routers.retailer_auth import get_current_retailer
    
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Build alerts
    alerts = []
    
    legal_docs = retailer.get('legal_documents', {})
    spoc = retailer.get('spoc', {})
    
    if not legal_docs.get('gst_certificate'):
        alerts.append("GST Certificate not uploaded - please contact admin")
    
    if not spoc.get('id_proof_document'):
        alerts.append("SPOC ID proof not uploaded - please contact admin")
    
    if not retailer.get('is_verified'):
        alerts.append("Account pending verification")
    
    if not retailer.get('gst_verified'):
        alerts.append("GST verification pending")
    
    # Check GST certificate expiry
    gst_valid_until = legal_docs.get('gst_certificate_valid_until')
    if gst_valid_until:
        try:
            from datetime import datetime
            expiry = datetime.strptime(gst_valid_until, '%Y-%m-%d')
            days_until_expiry = (expiry - datetime.now()).days
            if days_until_expiry < 30:
                alerts.append(f"GST certificate expires in {days_until_expiry} days - please renew")
        except:
            pass
    
    summary = {
        "retailer_id": retailer.get('retailer_id'),
        "business_name": retailer.get('business_name'),
        "trade_name": retailer.get('trade_name'),
        "gst_number": retailer.get('gst_number'),
        "registered_address": retailer.get('registered_address'),
        "city": retailer.get('city'),
        "district": retailer.get('district'),
        "state": retailer.get('state'),
        "pincode": retailer.get('pincode'),
        "email": retailer.get('email'),
        "phone": retailer.get('phone'),
        "spoc_name": spoc.get('name') if spoc else None,
        "spoc_phone": spoc.get('phone') if spoc else None,
        "spoc_designation": spoc.get('designation') if spoc else None,
        "status": retailer.get('status'),
        "is_verified": retailer.get('is_verified', False),
        "gst_verified": retailer.get('gst_verified', False),
        "documents_complete": retailer.get('documents_complete', False),
        "gst_certificate_uploaded": bool(legal_docs.get('gst_certificate')),
        "spoc_id_uploaded": bool(spoc.get('id_proof_document')),
        "last_updated": retailer.get('updated_at'),
        "alerts": alerts
    }
    
    return {"profile_summary": summary}



# ===================== GST Verification =====================

class GSTVerifyRequest(BaseModel):
    gst_number: str = Field(..., min_length=15, max_length=15)
    business_name: Optional[str] = None


@router.post("/admin/verify-gst")
async def admin_verify_gst(
    verify_request: GSTVerifyRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Verify GST number against GSTN database and optionally match business name.
    Returns taxpayer details from official records.
    """
    await require_admin(request, session_token)
    
    from services.gst_verification import verify_and_match_gst, verify_gst_number
    
    gst_number = verify_request.gst_number.upper().strip()
    
    if verify_request.business_name:
        # Verify and match
        result = await verify_and_match_gst(gst_number, verify_request.business_name)
    else:
        # Just verify
        result = await verify_gst_number(gst_number)
    
    return result


@router.post("/admin/{retailer_id}/verify-gst")
async def admin_verify_retailer_gst(
    retailer_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Verify a retailer's GST number and update their verification status.
    Compares registered business name with GSTN records.
    """
    admin = await require_admin(request, session_token)
    
    retailer = await db.retailers.find_one({"retailer_id": retailer_id})
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    gst_number = retailer.get('gst_number')
    business_name = retailer.get('business_name')
    
    if not gst_number:
        raise HTTPException(status_code=400, detail="Retailer has no GST number")
    
    from services.gst_verification import verify_and_match_gst
    
    # Verify GST and match name
    result = await verify_and_match_gst(gst_number, business_name)
    
    now = datetime.now(timezone.utc)
    
    # Update retailer with verification results
    update_data = {
        "gst_verification_result": result,
        "gst_verification_date": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_updated_by": admin.get('email', 'admin')
    }
    
    if result.get("verified") and result.get("is_active"):
        if result.get("name_match", {}).get("matched"):
            # Full verification - GST active and name matches
            update_data["gst_verified"] = True
            update_data["gst_taxpayer_name"] = result.get("taxpayer_name")
            update_data["gst_trade_name"] = result.get("trade_name")
            update_data["gst_status"] = result.get("status")
            update_data["gst_registration_date"] = result.get("registration_date")
            update_data["gst_address"] = result.get("address")
        else:
            # GST valid but name doesn't match
            update_data["gst_verified"] = False
            update_data["gst_verification_notes"] = f"Name mismatch: GSTN shows '{result.get('taxpayer_name')}'"
    else:
        update_data["gst_verified"] = False
        if not result.get("verified"):
            update_data["gst_verification_notes"] = result.get("error", "Verification failed")
        elif not result.get("is_active"):
            update_data["gst_verification_notes"] = f"GST status: {result.get('status')} (not Active)"
    
    await db.retailers.update_one(
        {"retailer_id": retailer_id},
        {"$set": update_data}
    )
    
    logger.info(f"GST verification for {retailer_id}: verified={result.get('verified')}, matched={result.get('name_match', {}).get('matched')}")
    
    return {
        "retailer_id": retailer_id,
        "gst_number": gst_number,
        "verification_result": result,
        "gst_verified": update_data.get("gst_verified", False),
        "message": "GST verified and name matched" if update_data.get("gst_verified") else "GST verification incomplete - see details"
    }


@router.get("/admin/gst-lookup/{gst_number}")
async def admin_gst_lookup(
    gst_number: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Look up any GST number to get taxpayer details (for pre-verification).
    """
    await require_admin(request, session_token)
    
    if len(gst_number) != 15:
        raise HTTPException(status_code=400, detail="Invalid GST number format (must be 15 characters)")
    
    from services.gst_verification import verify_gst_number
    
    result = await verify_gst_number(gst_number.upper())
    
    return result




# ===================== Seed Retailers (One-time setup) =====================

@router.post("/seed-default")
async def seed_default_retailers():
    """Seed default retailers - for initial setup"""
    from datetime import datetime, timezone
    
    default_retailers = [
        {
            "id": "delhi_primary",
            "retailer_id": "RTL_DELHI001",
            "business_name": "M.G. Shoppie",
            "name": "M.G. Shoppie",
            "trade_name": "M.G. Shoppie",
            "email": "amitkumar.911@proton.me",
            "phone": "6202311736",
            "gst_number": "07AADCM1234A1Z5",
            "address": "745, Sector 17 Pocket A Phase II, Dwarka",
            "city": "Dwarka",
            "district": "South West Delhi",
            "state": "Delhi",
            "pincode": "110078",
            "coordinates": {
                "lat": 28.5921,
                "lng": 77.0460
            },
            "status": "active",
            "is_verified": True,
            "is_addrika_verified_partner": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "bhagalpur_mela",
            "retailer_id": "RTL_BHAG001",
            "business_name": "Mela Stores",
            "name": "Mela Stores",
            "trade_name": "Mela Stores",
            "email": "mr.amitbgp@gmail.com",
            "phone": "7061483566",
            "gst_number": "10AABCM5678B1Z3",
            "address": "D.N. Singh Road, Variety Chowk",
            "city": "Bhagalpur",
            "district": "Bhagalpur",
            "state": "Bihar",
            "pincode": "812002",
            "coordinates": {
                "lat": 25.2425,
                "lng": 86.9842
            },
            "status": "active",
            "is_verified": True,
            "is_addrika_verified_partner": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    seeded = []
    for retailer in default_retailers:
        result = await db.retailers.update_one(
            {"id": retailer["id"]},
            {"$set": retailer},
            upsert=True
        )
        seeded.append(retailer["business_name"])
    
    return {"message": "Default retailers seeded", "retailers": seeded}



@router.post("/admin/add")
async def admin_add_retailer(request: Request, session_token: Optional[str] = Cookie(None)):
    """Add a new retailer from admin panel"""
    from datetime import datetime, timezone
    import uuid
    
    await require_admin(request, session_token)
    
    body = await request.json()
    
    # Generate unique IDs
    retailer_id = f"RTL_{body.get('city', 'IND')[:3].upper()}{str(uuid.uuid4())[:4].upper()}"
    unique_id = f"{body.get('city', 'store').lower().replace(' ', '_')}_{str(uuid.uuid4())[:8]}"
    
    retailer = {
        "id": unique_id,
        "retailer_id": retailer_id,
        "business_name": body.get("business_name"),
        "name": body.get("business_name"),
        "trade_name": body.get("trade_name") or body.get("business_name"),
        "owner_name": body.get("owner_name"),
        "email": body.get("email"),
        "phone": body.get("phone"),
        "gst_number": body.get("gst_number"),
        "address": body.get("address"),
        "city": body.get("city"),
        "district": body.get("district"),
        "state": body.get("state"),
        "pincode": body.get("pincode"),
        "coordinates": body.get("coordinates"),
        "status": "active",
        "is_verified": True,
        "is_addrika_verified_partner": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.retailers.insert_one(retailer)
    
    return {"message": "Retailer added successfully", "retailer": body.get("business_name"), "id": unique_id}
