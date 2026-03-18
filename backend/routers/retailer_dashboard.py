"""
Retailer Dashboard Router
Handles retailer-specific operations: orders, grievances, messaging, performance
"""
from fastapi import APIRouter, HTTPException, Request, Cookie, UploadFile, File, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import logging
import uuid
import base64
import os

from dependencies import db
from routers.retailer_auth import get_current_retailer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retailer-dashboard", tags=["Retailer Dashboard"])

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com")


# ===================== Orders =====================

@router.get("/orders")
async def get_retailer_orders(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    status: Optional[str] = None,  # pending, confirmed, ready_for_pickup, completed
    page: int = 1,
    limit: int = 20
):
    """Get orders assigned to this retailer (both shipping and pickup)"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    retailer_id = retailer['retailer_id']
    skip = (page - 1) * limit
    
    # Build query - orders assigned to this retailer OR pickup orders for this store
    query = {
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ]
    }
    
    if status:
        query["order_status"] = status
    
    # Get orders
    orders = await db.orders.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get counts by status
    status_counts = {}
    for s in ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled']:
        count_query = {
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ],
            "order_status": s
        }
        status_counts[s] = await db.orders.count_documents(count_query)
    
    total = await db.orders.count_documents(query)
    
    return {
        "orders": orders,
        "status_counts": status_counts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/orders/{order_number}")
async def get_order_detail(
    order_number: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get detailed order information"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    retailer_id = retailer['retailer_id']
    
    order = await db.orders.find_one(
        {
            "order_number": order_number,
            "$or": [
                {"assigned_retailer.retailer_id": retailer_id},
                {"pickup_store.id": retailer_id}
            ]
        },
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get OTP info for pickup orders
    otp_info = None
    if order.get('delivery_mode') == 'self_pickup':
        otp_record = await db.store_pickup_otps.find_one(
            {"order_number": order_number},
            {"_id": 0, "otp_code": 0}  # Don't expose OTP code
        )
        if otp_record:
            otp_info = {
                "status": otp_record.get('status'),
                "verified_at": otp_record.get('verified_at'),
                "balance_amount": otp_record.get('balance_amount')
            }
    
    return {
        "order": order,
        "otp_info": otp_info
    }


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r'^(confirmed|processing|ready_for_pickup|shipped|delivered)$')
    notes: Optional[str] = None


@router.put("/orders/{order_number}/status")
async def update_order_status(
    order_number: str,
    status_update: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Update order status (limited options for retailers)"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    retailer_id = retailer['retailer_id']
    
    order = await db.orders.find_one({
        "order_number": order_number,
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.get('order_status')
    now = datetime.now(timezone.utc)
    
    update_data = {
        "order_status": status_update.status,
        "updated_at": now.isoformat(),
        f"status_{status_update.status}_at": now.isoformat(),
        f"status_{status_update.status}_by": retailer_id
    }
    
    if status_update.notes:
        update_data["retailer_notes"] = status_update.notes
    
    await db.orders.update_one(
        {"order_number": order_number},
        {"$set": update_data}
    )
    
    # Log the status change
    await db.admin_events.insert_one({
        "event_type": "order_status_change",
        "order_number": order_number,
        "old_status": old_status,
        "new_status": status_update.status,
        "changed_by": retailer_id,
        "changed_by_type": "retailer",
        "notes": status_update.notes,
        "created_at": now.isoformat()
    })
    
    logger.info(f"Retailer {retailer_id} updated order {order_number} to {status_update.status}")
    
    # Send admin notification when order is marked as delivered
    if status_update.status == 'delivered':
        try:
            background_tasks.add_task(
                send_admin_delivery_notification,
                order,
                retailer,
                status_update.notes
            )
        except Exception as e:
            logger.error(f"Failed to queue admin delivery notification: {e}")
    
    return {"message": "Order status updated", "new_status": status_update.status}


async def send_admin_delivery_notification(order: dict, retailer: dict, notes: str = None):
    """
    Send email to admin when retailer marks an order as delivered.
    For shipping orders (non-pickup), admin is notified for verification.
    """
    try:
        from services.email_service import send_email
        
        customer_name = order.get('billing', {}).get('name') or order.get('shipping', {}).get('name', 'Unknown')
        customer_phone = order.get('billing', {}).get('phone') or order.get('shipping', {}).get('phone', 'N/A')
        customer_email = order.get('billing', {}).get('email') or order.get('shipping', {}).get('email', 'N/A')
        customer_address = order.get('shipping', {}).get('address', '')
        customer_city = order.get('shipping', {}).get('city', '')
        
        retailer_name = retailer.get('business_name') or retailer.get('trade_name') or retailer.get('name', 'Unknown')
        retailer_phone = retailer.get('phone', 'N/A')
        retailer_city = retailer.get('city', '')
        
        order_number = order.get('order_number')
        order_total = order.get('pricing', {}).get('final_total', 0) or order.get('total', 0)
        delivery_mode = order.get('delivery_mode', 'shipping')
        
        # Build items list
        items_html = ""
        for item in order.get('items', [])[:5]:
            items_html += f"<tr><td style='padding: 8px; border-bottom: 1px solid #eee;'>{item.get('name', '')} ({item.get('size', '')})</td><td style='padding: 8px; border-bottom: 1px solid #eee; text-align: center;'>{item.get('quantity', 1)}</td></tr>"
        
        notes_section = ""
        if notes:
            notes_section = f"""
            <div style="margin-top: 15px; padding: 12px; background-color: #f0f9ff; border-radius: 6px; border-left: 4px solid #0284c7;">
                <strong style="color: #0369a1;">Retailer Notes:</strong>
                <p style="margin: 5px 0 0 0; color: #0c4a6e;">{notes}</p>
            </div>
            """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td style="background-color: #1e3a52; padding: 25px; text-align: center;">
                        <h1 style="color: #d4af37; margin: 0;">ADDRIKA</h1>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Delivery Verification Alert</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 25px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; border-radius: 20px; font-weight: bold;">
                                🚚 Marked as Delivered
                            </div>
                        </div>
                        
                        <h2 style="color: #1e3a52; margin: 0 0 5px 0;">Shipping Order Delivered</h2>
                        <p style="color: #666; margin: 0 0 20px 0;">Order <strong>#{order_number}</strong> has been marked as delivered by the retailer</p>
                        
                        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                            <h3 style="margin: 0 0 10px 0; color: #92400e;">⚠️ Customer Details - For Verification Call</h3>
                            <p style="margin: 5px 0;"><strong>Name:</strong> {customer_name}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{customer_phone}" style="color: #1e3a52; font-weight: bold;">{customer_phone}</a></p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {customer_email}</p>
                            <p style="margin: 5px 0;"><strong>Address:</strong> {customer_address}, {customer_city}</p>
                        </div>
                        
                        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #38a169;">
                            <h3 style="margin: 0 0 10px 0; color: #166534;">🏪 Retailer Who Fulfilled</h3>
                            <p style="margin: 5px 0;"><strong>Store:</strong> {retailer_name}</p>
                            <p style="margin: 5px 0;"><strong>City:</strong> {retailer_city}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{retailer_phone}" style="color: #1e3a52;">{retailer_phone}</a></p>
                        </div>
                        
                        <div style="background-color: #f9f7f4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 10px 0; color: #1e3a52;">📦 Order Summary</h3>
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>{items_html}</tbody>
                            </table>
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #d4af37;">
                                <p style="margin: 0;"><strong>Order Total:</strong> ₹{order_total:,.0f}</p>
                            </div>
                        </div>
                        
                        {notes_section}
                        
                        <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 8px;">
                            <p style="margin: 0; color: #1e40af; font-size: 14px;">
                                <strong>Recommended:</strong> Call the customer to verify they received the order
                            </p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #1e3a52; padding: 20px; text-align: center;">
                        <p style="color: #d4af37; margin: 0; font-size: 14px;">ADDRIKA - Premium Agarbattis</p>
                        <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">Admin Verification System</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        await send_email(
            to_email=ADMIN_EMAIL,
            subject=f"🚚 Delivery Complete: Order #{order_number} | {retailer_name}",
            html_content=html_content
        )
        
        logger.info(f"Admin delivery notification sent for order {order_number}")
        
    except Exception as e:
        logger.error(f"Failed to send admin delivery notification: {e}")

class GrievanceCreate(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=2000)
    category: str = Field(default='other', pattern=r'^(order_issue|payment|product_quality|delivery|other)$')
    priority: str = Field(default='medium', pattern=r'^(low|medium|high)$')
    order_number: Optional[str] = None


@router.post("/grievances")
async def create_grievance(
    grievance_data: GrievanceCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Create a new grievance/complaint"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    now = datetime.now(timezone.utc)
    complaint_id = f"CMP-{str(uuid.uuid4())[:8].upper()}"
    
    grievance = {
        "id": str(uuid.uuid4()),
        "complaint_id": complaint_id,
        "retailer_id": retailer['retailer_id'],
        "retailer_name": retailer['name'],
        "retailer_email": retailer['email'],
        "subject": grievance_data.subject,
        "description": grievance_data.description,
        "category": grievance_data.category,
        "priority": grievance_data.priority,
        "order_number": grievance_data.order_number,
        "images": [],
        "status": "open",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.retailer_complaints.insert_one(grievance)
    
    logger.info(f"Grievance {complaint_id} created by retailer {retailer['retailer_id']}")
    
    return {
        "message": "Grievance submitted successfully",
        "complaint_id": complaint_id
    }


@router.post("/grievances/{complaint_id}/images")
async def upload_grievance_image(
    complaint_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    image: UploadFile = File(...)
):
    """Upload image for a grievance"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify grievance belongs to retailer
    grievance = await db.retailer_complaints.find_one({
        "complaint_id": complaint_id,
        "retailer_id": retailer['retailer_id']
    })
    
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    
    # Check file size (max 5MB)
    contents = await image.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    # Check file type
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Store as base64 (in production, use cloud storage)
    image_data = f"data:{image.content_type};base64,{base64.b64encode(contents).decode()}"
    
    # Add to grievance
    await db.retailer_complaints.update_one(
        {"complaint_id": complaint_id},
        {
            "$push": {"images": image_data},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Image uploaded successfully"}


@router.get("/grievances")
async def get_retailer_grievances(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """Get retailer's grievances"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    query = {"retailer_id": retailer['retailer_id']}
    
    if status:
        query["status"] = status
    
    grievances = await db.retailer_complaints.find(
        query,
        {"_id": 0, "images": 0}  # Exclude large image data from list
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_complaints.count_documents(query)
    
    return {
        "grievances": grievances,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/grievances/{complaint_id}")
async def get_grievance_detail(
    complaint_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get detailed grievance info including images"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    grievance = await db.retailer_complaints.find_one(
        {
            "complaint_id": complaint_id,
            "retailer_id": retailer['retailer_id']
        },
        {"_id": 0}
    )
    
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    
    return {"grievance": grievance}


# ===================== Profile Change Tickets =====================

class ProfileChangeTicketCreate(BaseModel):
    """
    Retailers cannot change their profile directly (except profile image).
    They must raise a ticket for any changes.
    """
    change_type: str = Field(
        ..., 
        pattern=r'^(name_address|gst|spoc|other)$',
        description="Type of change: name_address, gst, spoc, or other"
    )
    description: str = Field(
        ..., 
        min_length=10, 
        max_length=1000,
        description="Details of the requested change"
    )
    # Optional fields for specific change types
    new_value: Optional[str] = Field(None, max_length=500, description="Proposed new value if applicable")
    supporting_document: Optional[str] = Field(None, description="Base64 encoded document if needed")


@router.post("/profile-change-request")
async def create_profile_change_ticket(
    ticket_data: ProfileChangeTicketCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """
    Retailer raises a ticket to request profile changes.
    Supported change types:
    - name_address: Change in business name or registered address
    - gst: Change in GST number or GST-related details
    - spoc: Change in Single Point of Contact details
    - other: Any other change request
    """
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    now = datetime.now(timezone.utc)
    ticket_id = f"PCT-{str(uuid.uuid4())[:8].upper()}"
    
    # Map change types to readable labels
    change_type_labels = {
        "name_address": "Change in Name or Address",
        "gst": "Change in GST",
        "spoc": "Change in SPOC",
        "other": "Other Request"
    }
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "retailer_id": retailer['retailer_id'],
        "business_name": retailer.get('business_name') or retailer.get('name'),
        "retailer_email": retailer['email'],
        "change_type": ticket_data.change_type,
        "change_type_label": change_type_labels.get(ticket_data.change_type, ticket_data.change_type),
        "description": ticket_data.description,
        "new_value": ticket_data.new_value,
        "supporting_document": ticket_data.supporting_document,
        "status": "pending",  # pending, under_review, approved, rejected
        "admin_notes": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.profile_change_tickets.insert_one(ticket)
    
    logger.info(f"Profile change ticket {ticket_id} created by retailer {retailer['retailer_id']}: {ticket_data.change_type}")
    
    return {
        "message": "Profile change request submitted successfully",
        "ticket_id": ticket_id,
        "change_type": change_type_labels.get(ticket_data.change_type),
        "status": "pending",
        "note": "Your request will be reviewed by our admin team. You will be notified once processed."
    }


@router.get("/profile-change-requests")
async def get_profile_change_tickets(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    status: Optional[str] = None,  # pending, under_review, approved, rejected
    page: int = 1,
    limit: int = 20
):
    """Get all profile change tickets for the retailer"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    
    query = {"retailer_id": retailer['retailer_id']}
    if status:
        query["status"] = status
    
    tickets = await db.profile_change_tickets.find(
        query,
        {"_id": 0, "supporting_document": 0}  # Exclude large documents from list
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.profile_change_tickets.count_documents(query)
    
    # Count by status
    status_counts = {
        "pending": await db.profile_change_tickets.count_documents(
            {"retailer_id": retailer['retailer_id'], "status": "pending"}
        ),
        "under_review": await db.profile_change_tickets.count_documents(
            {"retailer_id": retailer['retailer_id'], "status": "under_review"}
        ),
        "approved": await db.profile_change_tickets.count_documents(
            {"retailer_id": retailer['retailer_id'], "status": "approved"}
        ),
        "rejected": await db.profile_change_tickets.count_documents(
            {"retailer_id": retailer['retailer_id'], "status": "rejected"}
        )
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


@router.get("/profile-change-requests/{ticket_id}")
async def get_profile_change_ticket_detail(
    ticket_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get detailed ticket info"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    ticket = await db.profile_change_tickets.find_one(
        {
            "ticket_id": ticket_id,
            "retailer_id": retailer['retailer_id']
        },
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"ticket": ticket}


# ===================== Profile Image Update (Only Allowed Self-Service) =====================

@router.post("/profile/image")
async def update_profile_image(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    image: UploadFile = File(...)
):
    """
    Update retailer's profile image.
    This is the ONLY profile field retailers can update themselves.
    All other changes must go through the ticket system.
    Images are automatically optimized and compressed.
    """
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file
    contents = await image.read()
    
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit before optimization
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    # Optimize image before storing
    try:
        from services.image_optimization import optimize_image
        optimized_bytes, mime_type = optimize_image(
            contents,
            max_size=(800, 800),  # Profile images don't need to be huge
            quality=80,
            format='WEBP'
        )
        image_data = f"data:{mime_type};base64,{base64.b64encode(optimized_bytes).decode()}"
        logger.info(f"Profile image optimized: {len(contents)} -> {len(optimized_bytes)} bytes")
    except Exception as e:
        logger.warning(f"Image optimization failed, using original: {str(e)}")
        image_data = f"data:{image.content_type};base64,{base64.b64encode(contents).decode()}"
    
    now = datetime.now(timezone.utc)
    
    await db.retailers.update_one(
        {"retailer_id": retailer['retailer_id']},
        {
            "$set": {
                "profile_image": image_data,
                "profile_image_updated_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        }
    )
    
    logger.info(f"Retailer {retailer['retailer_id']} updated profile image")
    
    return {
        "message": "Profile image updated successfully",
        "updated_at": now.isoformat()
    }


@router.delete("/profile/image")
async def remove_profile_image(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Remove retailer's profile image"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    now = datetime.now(timezone.utc)
    
    await db.retailers.update_one(
        {"retailer_id": retailer['retailer_id']},
        {
            "$set": {
                "profile_image": None,
                "updated_at": now.isoformat()
            },
            "$unset": {
                "profile_image_updated_at": ""
            }
        }
    )
    
    logger.info(f"Retailer {retailer['retailer_id']} removed profile image")
    
    return {"message": "Profile image removed"}


# ===================== Inter-Retailer Messaging =====================

class MessageCreate(BaseModel):
    to_retailer_id: str
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=10, max_length=2000)


@router.get("/messages/retailers")
async def get_district_retailers(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get list of retailers in the same district for messaging"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get retailers in same district (excluding self)
    retailers = await db.retailers.find(
        {
            "district": retailer['district'],
            "status": "active",
            "retailer_id": {"$ne": retailer['retailer_id']}
        },
        {"_id": 0, "password_hash": 0, "gst_number": 0}
    ).to_list(50)
    
    return {"retailers": retailers}


@router.post("/messages")
async def send_message(
    message_data: MessageCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Send message to another retailer"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify recipient exists and is in same district
    recipient = await db.retailers.find_one({
        "retailer_id": message_data.to_retailer_id,
        "district": retailer['district'],
        "status": "active"
    })
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient retailer not found or not in your district")
    
    now = datetime.now(timezone.utc)
    message_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "from_retailer_id": retailer['retailer_id'],
        "from_retailer_name": retailer['name'],
        "to_retailer_id": recipient['retailer_id'],
        "to_retailer_name": recipient['name'],
        "subject": message_data.subject,
        "message": message_data.message,
        "is_read": False,
        "created_at": now.isoformat()
    }
    
    await db.retailer_messages.insert_one(message)
    
    # Log for admin
    await db.admin_events.insert_one({
        "event_type": "retailer_message",
        "message_id": message_id,
        "from_retailer": retailer['retailer_id'],
        "to_retailer": recipient['retailer_id'],
        "district": retailer['district'],
        "subject": message_data.subject,
        "created_at": now.isoformat()
    })
    
    logger.info(f"Retailer {retailer['retailer_id']} sent message to {recipient['retailer_id']}")
    
    return {"message": "Message sent successfully", "message_id": message_id}


@router.get("/messages/inbox")
async def get_inbox(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    page: int = 1,
    limit: int = 20
):
    """Get received messages"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    
    messages = await db.retailer_messages.find(
        {"to_retailer_id": retailer['retailer_id']},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_messages.count_documents({"to_retailer_id": retailer['retailer_id']})
    unread = await db.retailer_messages.count_documents({
        "to_retailer_id": retailer['retailer_id'],
        "is_read": False
    })
    
    return {
        "messages": messages,
        "unread_count": unread,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/messages/sent")
async def get_sent_messages(
    request: Request,
    retailer_session: Optional[str] = Cookie(None),
    page: int = 1,
    limit: int = 20
):
    """Get sent messages"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    skip = (page - 1) * limit
    
    messages = await db.retailer_messages.find(
        {"from_retailer_id": retailer['retailer_id']},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.retailer_messages.count_documents({"from_retailer_id": retailer['retailer_id']})
    
    return {
        "messages": messages,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.put("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Mark message as read"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.retailer_messages.update_one(
        {
            "id": message_id,
            "to_retailer_id": retailer['retailer_id']
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Message marked as read"}


# ===================== Performance Metrics =====================

@router.get("/performance")
async def get_performance_metrics(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get retailer's performance metrics"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    retailer_id = retailer['retailer_id']
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    # Total orders handled
    total_orders = await db.orders.count_documents({
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ]
    })
    
    # Orders in last 30 days
    recent_orders = await db.orders.count_documents({
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ],
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    
    # Completed orders (delivered)
    completed_orders = await db.orders.count_documents({
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ],
        "order_status": "delivered"
    })
    
    # Pickup orders completed
    pickups_completed = await db.orders.count_documents({
        "pickup_store.id": retailer_id,
        "order_status": "delivered"
    })
    
    # Pending orders
    pending_orders = await db.orders.count_documents({
        "$or": [
            {"assigned_retailer.retailer_id": retailer_id},
            {"pickup_store.id": retailer_id}
        ],
        "order_status": {"$in": ["pending", "confirmed", "processing", "ready_for_pickup"]}
    })
    
    # Calculate completion rate
    completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
    
    # Average pickup time (in hours) - for delivered pickup orders
    pipeline = [
        {
            "$match": {
                "pickup_store.id": retailer_id,
                "order_status": "delivered",
                "status_delivered_at": {"$exists": True}
            }
        },
        {
            "$project": {
                "created_at": 1,
                "status_delivered_at": 1
            }
        }
    ]
    
    pickup_orders = await db.orders.aggregate(pipeline).to_list(1000)
    
    avg_pickup_hours = None
    if pickup_orders:
        total_hours = 0
        valid_count = 0
        for order in pickup_orders:
            try:
                created = order.get('created_at')
                delivered = order.get('status_delivered_at')
                if created and delivered:
                    if isinstance(created, str):
                        created = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    if isinstance(delivered, str):
                        delivered = datetime.fromisoformat(delivered.replace('Z', '+00:00'))
                    hours = (delivered - created).total_seconds() / 3600
                    total_hours += hours
                    valid_count += 1
            except:
                pass
        if valid_count > 0:
            avg_pickup_hours = round(total_hours / valid_count, 1)
    
    # Revenue generated (total value of completed orders)
    revenue_pipeline = [
        {
            "$match": {
                "$or": [
                    {"assigned_retailer.retailer_id": retailer_id},
                    {"pickup_store.id": retailer_id}
                ],
                "order_status": "delivered"
            }
        },
        {
            "$group": {
                "_id": None,
                "total_revenue": {"$sum": "$total"}
            }
        }
    ]
    
    revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
    
    # Open grievances
    open_grievances = await db.retailer_complaints.count_documents({
        "retailer_id": retailer_id,
        "status": {"$in": ["open", "in_progress"]}
    })
    
    # Unread messages
    unread_messages = await db.retailer_messages.count_documents({
        "to_retailer_id": retailer_id,
        "is_read": False
    })
    
    return {
        "metrics": {
            "total_orders": total_orders,
            "recent_orders_30d": recent_orders,
            "completed_orders": completed_orders,
            "pickups_completed": pickups_completed,
            "pending_orders": pending_orders,
            "completion_rate": round(completion_rate, 1),
            "avg_pickup_hours": avg_pickup_hours,
            "total_revenue": round(total_revenue, 2),
            "open_grievances": open_grievances,
            "unread_messages": unread_messages
        },
        "retailer": {
            "name": retailer['name'],
            "retailer_id": retailer['retailer_id'],
            "district": retailer.get('district'),
            "state": retailer.get('state'),
            "member_since": retailer.get('created_at')
        }
    }


# ===================== Leaderboard =====================

@router.get("/leaderboard")
async def get_retailer_leaderboard(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get leaderboard showing retailer rankings"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_retailer_id = retailer['retailer_id']
    
    # Get all active retailers
    retailers = await db.retailers.find(
        {"status": "active"},
        {"_id": 0, "password_hash": 0, "gst_number": 0}
    ).to_list(500)
    
    leaderboard_data = []
    
    for r in retailers:
        r_id = r['retailer_id']
        
        # Total orders
        total_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": r_id},
                {"pickup_store.id": r_id}
            ]
        })
        
        # Completed orders
        completed_orders = await db.orders.count_documents({
            "$or": [
                {"assigned_retailer.retailer_id": r_id},
                {"pickup_store.id": r_id}
            ],
            "order_status": "delivered"
        })
        
        # Revenue
        revenue_pipeline = [
            {
                "$match": {
                    "$or": [
                        {"assigned_retailer.retailer_id": r_id},
                        {"pickup_store.id": r_id}
                    ],
                    "order_status": "delivered"
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        
        # Completion rate
        completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        
        # Calculate score
        volume_score = min(total_orders * 2, 100)
        revenue_score = min(total_revenue / 1000, 100)
        overall_score = (completion_rate * 0.4) + (volume_score * 0.3) + (revenue_score * 0.3)
        
        leaderboard_data.append({
            "retailer_id": r_id,
            "name": r['name'],
            "city": r.get('city'),
            "district": r.get('district'),
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "completion_rate": round(completion_rate, 1),
            "total_revenue": round(total_revenue, 2),
            "overall_score": round(overall_score, 1),
            "is_current_user": r_id == current_retailer_id
        })
    
    # Sort by overall score
    leaderboard_data.sort(key=lambda x: x['overall_score'], reverse=True)
    
    # Add ranks
    for idx, item in enumerate(leaderboard_data):
        item['rank'] = idx + 1
    
    # Find current retailer's position
    current_retailer_data = next((r for r in leaderboard_data if r['retailer_id'] == current_retailer_id), None)
    
    return {
        "leaderboard": leaderboard_data[:20],  # Top 20 only
        "total_retailers": len(leaderboard_data),
        "current_retailer": current_retailer_data
    }



# ===================== B2B Ordering (Placeholder) =====================

@router.get("/b2b/products")
async def get_b2b_products(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get products available for B2B ordering (wholesale)"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Placeholder - returns products with placeholder wholesale pricing
    from routers.products import PRODUCTS
    
    b2b_products = []
    for product in PRODUCTS:
        b2b_product = {
            "id": product['id'],
            "name": product['name'],
            "sizes": []
        }
        for size in product.get('sizes', []):
            b2b_product['sizes'].append({
                "size": size['size'],
                "mrp": size['mrp'],
                "wholesale_price": None,  # PLACEHOLDER - to be set by admin
                "min_quantity": 12,  # PLACEHOLDER
                "available": True
            })
        b2b_products.append(b2b_product)
    
    return {
        "products": b2b_products,
        "notice": "B2B wholesale pricing coming soon. Contact admin for bulk orders."
    }


class B2BOrderCreate(BaseModel):
    items: List[dict]  # [{"product_id": "...", "size": "50g", "quantity": 24}]
    notes: Optional[str] = None


@router.post("/b2b/orders")
async def create_b2b_order(
    order_data: B2BOrderCreate,
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Create a B2B order (placeholder - wholesale pricing TBD)"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Placeholder response
    return {
        "message": "B2B ordering is coming soon. Your order request has been noted.",
        "items_requested": len(order_data.items),
        "notes": order_data.notes,
        "status": "pending_pricing",
        "contact": "For immediate bulk orders, please contact admin directly."
    }



# ===================== Badge History & Achievements =====================

@router.get("/badges")
async def get_retailer_badges(
    request: Request,
    retailer_session: Optional[str] = Cookie(None)
):
    """Get retailer's current badges and badge history timeline"""
    retailer = await get_current_retailer(request, retailer_session)
    if not retailer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    retailer_id = retailer['retailer_id']
    
    # Get full retailer data with badges
    retailer_data = await db.retailers.find_one(
        {"retailer_id": retailer_id},
        {
            "_id": 0,
            "is_addrika_verified_partner": 1,
            "retailer_label": 1,
            "label_period": 1,
            "is_verified": 1,
            "verified_at": 1,
            "gst_verified": 1,
            "badge_history": 1,
            "created_at": 1
        }
    )
    
    if not retailer_data:
        raise HTTPException(status_code=404, detail="Retailer not found")
    
    # Current badges
    current_badges = []
    
    # Verified Partner badge
    if retailer_data.get('is_addrika_verified_partner'):
        # Find when it was awarded from history
        awarded_at = None
        history = retailer_data.get('badge_history', [])
        for event in reversed(history):
            if event.get('badge_type') == 'verified_partner' and event.get('action') == 'awarded':
                awarded_at = event.get('awarded_at')
                break
        
        current_badges.append({
            "type": "verified_partner",
            "name": "Addrika Verified Partner",
            "description": "Trusted and verified retail partner",
            "icon": "trophy",
            "color": "#d4af37",
            "awarded_at": awarded_at,
            "active": True
        })
    
    # Current label badge
    if retailer_data.get('retailer_label'):
        label_key = retailer_data.get('retailer_label')
        label_names = {
            'top_retailer_month': {'name': 'Top Retailer of the Month', 'icon': 'crown', 'color': '#f59e0b'},
            'top_retailer_quarter': {'name': 'Top Retailer of the Quarter', 'icon': 'crown', 'color': '#d97706'},
            'star_retailer_month': {'name': 'Star Retailer of the Month', 'icon': 'star', 'color': '#8b5cf6'},
            'star_retailer_quarter': {'name': 'Star Retailer of the Quarter', 'icon': 'star', 'color': '#7c3aed'},
            'rising_star': {'name': 'Rising Star', 'icon': 'star', 'color': '#3b82f6'},
            'best_performer': {'name': 'Best Performer', 'icon': 'target', 'color': '#10b981'}
        }
        
        label_info = label_names.get(label_key, {'name': label_key, 'icon': 'award', 'color': '#6366f1'})
        
        # Find when it was awarded
        awarded_at = None
        history = retailer_data.get('badge_history', [])
        for event in reversed(history):
            if event.get('badge_type') == 'label' and event.get('badge_key') == label_key and event.get('action') == 'awarded':
                awarded_at = event.get('awarded_at')
                break
        
        current_badges.append({
            "type": "label",
            "key": label_key,
            "name": label_info['name'],
            "period": retailer_data.get('label_period'),
            "description": "Recognition for outstanding performance",
            "icon": label_info['icon'],
            "color": label_info['color'],
            "awarded_at": awarded_at,
            "active": True
        })
    
    # GST Verified badge
    if retailer_data.get('gst_verified'):
        current_badges.append({
            "type": "gst_verified",
            "name": "GST Verified",
            "description": "Business GST registration verified",
            "icon": "check-circle",
            "color": "#22c55e",
            "active": True
        })
    
    # Account Verified badge
    if retailer_data.get('is_verified'):
        current_badges.append({
            "type": "account_verified",
            "name": "Verified Account",
            "description": "Account verification completed",
            "icon": "shield-check",
            "color": "#3b82f6",
            "verified_at": retailer_data.get('verified_at'),
            "active": True
        })
    
    # Get badge history timeline (sorted by date, most recent first)
    badge_history = retailer_data.get('badge_history', [])
    
    # Sort history by event date (descending)
    def get_event_date(event):
        return event.get('awarded_at') or event.get('revoked_at') or event.get('removed_at') or event.get('replaced_at') or ''
    
    sorted_history = sorted(badge_history, key=get_event_date, reverse=True)
    
    # Calculate stats
    total_badges_earned = len([e for e in badge_history if e.get('action') == 'awarded'])
    
    # Calculate time as verified partner if applicable
    partner_duration = None
    if retailer_data.get('is_addrika_verified_partner'):
        for event in badge_history:
            if event.get('badge_type') == 'verified_partner' and event.get('action') == 'awarded':
                awarded_at = event.get('awarded_at')
                if awarded_at:
                    try:
                        awarded_date = datetime.fromisoformat(awarded_at.replace('Z', '+00:00'))
                        days = (datetime.now(timezone.utc) - awarded_date).days
                        partner_duration = days
                    except:
                        pass
                break
    
    return {
        "current_badges": current_badges,
        "badge_history": sorted_history,
        "stats": {
            "total_badges_earned": total_badges_earned,
            "current_active_badges": len(current_badges),
            "partner_duration_days": partner_duration
        },
        "member_since": retailer_data.get('created_at')
    }
