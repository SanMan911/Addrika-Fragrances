"""Admin — Restock alert approvals.

A restock alert is queued automatically when a SKU goes from 0 to in-stock and
someone is on its Notify-Me waitlist. Nothing is emailed until an admin
approves it here.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Cookie

from dependencies import db, require_admin
from services.restock_alerts import send_restock_alert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/restock-alerts", tags=["Admin · Restock Alerts"])


@router.get("")
async def list_restock_alerts(request: Request, session_token: Optional[str] = Cookie(None)):
    admin = await require_admin(request, session_token)
    pending = await db.restock_alerts.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    history = await db.restock_alerts.find(
        {"status": {"$ne": "pending"}}, {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    return {"pending": pending, "history": history}


@router.post("/{alert_id}/approve")
async def approve_restock_alert(
    alert_id: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    admin = await require_admin(request, session_token)
    alert = await db.restock_alerts.find_one({"id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Restock alert not found")
    if alert.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Alert already {alert.get('status')}")
    result = await send_restock_alert(db, alert, admin_email=(admin or {}).get("email"))
    return {"message": f"Sent {result['sent']} restock email(s)", **result}


@router.post("/{alert_id}/dismiss")
async def dismiss_restock_alert(
    alert_id: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    admin = await require_admin(request, session_token)
    result = await db.restock_alerts.update_one(
        {"id": alert_id, "status": "pending"},
        {"$set": {"status": "dismissed", "approved_by": (admin or {}).get("email")}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending restock alert not found")
    return {"message": "Alert dismissed"}
