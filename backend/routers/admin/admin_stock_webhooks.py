"""
Admin — Stock-change webhook management.

Register HTTPS endpoints (e.g. Field Sales Manager) that receive signed
POSTs when B2B stock changes. Secret shown once on creation.
"""
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field, field_validator

from dependencies import require_admin
from services.stock_webhooks import (
    ALL_EVENTS,
    create_webhook,
    delete_webhook,
    list_webhooks,
    recent_deliveries,
    send_test_event,
    toggle_webhook,
    update_webhook,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stock-webhooks", tags=["Admin · Stock Webhooks"])

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


class CreateWebhookBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    url: str = Field(..., min_length=8, max_length=500)
    events: Optional[list[str]] = None
    threshold_cartons: float = Field(default=1.0, ge=0)

    @field_validator("url")
    @classmethod
    def _valid_url(cls, v: str) -> str:
        from services.stock_webhooks import is_public_http_url
        ok, why = is_public_http_url(v)
        if not ok:
            raise ValueError(why)
        return v.strip()


class ToggleBody(BaseModel):
    is_active: bool


class UpdateWebhookBody(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    url: Optional[str] = Field(None, min_length=8, max_length=500)
    events: Optional[list[str]] = None
    threshold_cartons: Optional[float] = Field(None, ge=0)

    @field_validator("url")
    @classmethod
    def _valid_url(cls, v):
        if v is None:
            return v
        from services.stock_webhooks import is_public_http_url
        ok, why = is_public_http_url(v)
        if not ok:
            raise ValueError(why)
        return v.strip()


@router.get("")
async def get_webhooks(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    return {
        "items": await list_webhooks(),
        "available_events": list(ALL_EVENTS),
        "recent_deliveries": await recent_deliveries(20),
    }


@router.post("")
async def add_webhook(body: CreateWebhookBody, request: Request, session_token: Optional[str] = Cookie(None)):
    admin = await require_admin(request, session_token)
    created = await create_webhook(
        body.name, body.url, body.events or list(ALL_EVENTS), body.threshold_cartons, admin.get("email", "admin")
    )
    logger.info(f"Stock webhook created: {created['id']} ({created['name']}) by {admin.get('email')}")
    return created  # includes one-time secret


@router.patch("/{webhook_id}")
async def edit_webhook(webhook_id: str, body: UpdateWebhookBody, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    updated = await update_webhook(
        webhook_id,
        name=body.name,
        url=body.url,
        events=body.events,
        threshold_cartons=body.threshold_cartons,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return updated


@router.post("/{webhook_id}/toggle")
async def toggle(webhook_id: str, body: ToggleBody, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    if not await toggle_webhook(webhook_id, body.is_active):
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"id": webhook_id, "is_active": body.is_active}


@router.post("/{webhook_id}/test")
async def test(webhook_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    result = await send_test_event(webhook_id)
    if not result.get("sent"):
        raise HTTPException(status_code=404, detail=result.get("error") or "Could not send test event")
    return result


@router.delete("/{webhook_id}")
async def remove(webhook_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    if not await delete_webhook(webhook_id):
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"deleted": True, "id": webhook_id}
