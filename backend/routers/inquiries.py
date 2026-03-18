"""Inquiry routes"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from models.ecommerce import InquiryCreate
from services.email_service import send_admin_inquiry_notification, is_email_service_available
from dependencies import db, verify_hcaptcha, NOTIFICATION_EMAIL

router = APIRouter(tags=["Inquiries"])
logger = logging.getLogger(__name__)


async def send_inquiry_notification_email(inquiry_dict: dict):
    """Send email notification for new inquiry to admin using Resend"""
    try:
        if not is_email_service_available():
            logger.warning("Email service not configured, skipping admin notification")
            return
        
        result = await send_admin_inquiry_notification(inquiry_dict, NOTIFICATION_EMAIL)
        if result:
            logger.info(f"Admin inquiry notification sent to {NOTIFICATION_EMAIL}")
        else:
            logger.warning("Failed to send admin inquiry notification")
    except Exception as e:
        logger.error(f"Failed to send inquiry notification: {e}")


@router.post("/inquiries")
async def create_inquiry(inquiry_data: InquiryCreate, background_tasks: BackgroundTasks, captcha_token: Optional[str] = None):
    """Create a new inquiry"""
    # Verify hCaptcha if token provided
    if captcha_token:
        if not await verify_hcaptcha(captcha_token):
            raise HTTPException(status_code=400, detail="Captcha verification failed")
    
    inquiry = {
        "inquiry_id": str(uuid.uuid4()),
        "name": inquiry_data.name,
        "email": inquiry_data.email.lower(),
        "phone": inquiry_data.phone,
        "fragrance": inquiry_data.fragrance,
        "packageSize": inquiry_data.packageSize,
        "quantity": inquiry_data.quantity,
        "message": inquiry_data.message,
        "inquiryType": inquiry_data.type,  # Map 'type' to 'inquiryType' for email template
        "type": inquiry_data.type,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inquiries.insert_one(inquiry)
    
    # Send notification email to admin in background
    background_tasks.add_task(send_inquiry_notification_email, inquiry)
    
    inquiry.pop("_id", None)
    return {"message": "Inquiry submitted successfully", "inquiry": inquiry}


@router.get("/inquiries")
async def get_inquiries(skip: int = 0, limit: int = 50):
    """Get all inquiries (admin only in production)"""
    inquiries = await db.inquiries.find({}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for inquiry in inquiries:
        inquiry.pop("_id", None)
    
    total = await db.inquiries.count_documents({})
    
    return {"inquiries": inquiries, "total": total}


@router.get("/inquiries/{inquiry_id}")
async def get_inquiry(inquiry_id: str):
    """Get a single inquiry"""
    inquiry = await db.inquiries.find_one({"inquiry_id": inquiry_id})
    
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    inquiry.pop("_id", None)
    return inquiry


@router.patch("/inquiries/{inquiry_id}/status")
async def update_inquiry_status(inquiry_id: str, status: str):
    """Update inquiry status"""
    valid_statuses = ["pending", "contacted", "resolved", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Try to find by 'id' field first (UUID), then by 'inquiry_id'
    result = await db.inquiries.update_one(
        {"$or": [{"id": inquiry_id}, {"inquiry_id": inquiry_id}]},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    return {"message": "Status updated", "inquiry_id": inquiry_id, "new_status": status}


@router.delete("/inquiries/{inquiry_id}")
async def delete_inquiry(inquiry_id: str):
    """Delete an inquiry"""
    # Try to delete by 'id' field first, then by 'inquiry_id'
    result = await db.inquiries.delete_one(
        {"$or": [{"id": inquiry_id}, {"inquiry_id": inquiry_id}]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    return {"message": "Inquiry deleted", "inquiry_id": inquiry_id}
