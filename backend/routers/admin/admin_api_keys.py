"""
Admin — External API key management.

Generate / list / revoke / delete machine keys that let related apps
(Field Sales Manager, etc.) read live stock via /api/external/v1/*.
The raw key is returned ONCE on creation and never again.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, Field

from dependencies import require_admin
from services.api_keys import (
    AVAILABLE_SCOPES,
    SCOPE_DESCRIPTIONS,
    create_key,
    delete_key,
    list_keys,
    revoke_key,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api-keys", tags=["Admin · API Keys"])


class CreateKeyBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    scopes: Optional[list[str]] = Field(default=None)
    retailer_ids: Optional[list[str]] = Field(
        default=None,
        description=(
            "Restrict this key to these retailer_ids. OMITTED OR EMPTY = UNRESTRICTED "
            "(the key can read/write orders for every retailer) — always set this for "
            "third-party or field-sales keys."
        ),
    )


@router.get("")
async def list_api_keys(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    return {
        "items": await list_keys(),
        "available_scopes": list(AVAILABLE_SCOPES),
        "scope_descriptions": SCOPE_DESCRIPTIONS,
    }


@router.post("")
async def create_api_key(
    body: CreateKeyBody,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    created = await create_key(
        body.name, body.scopes or ["stock:read"], admin.get("email", "admin"),
        retailer_ids=body.retailer_ids,
    )
    logger.info(f"API key created: {created['id']} ({created['name']}) by {admin.get('email')}")
    return created  # includes the one-time `key`


@router.post("/{key_id}/revoke")
async def revoke_api_key(key_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    if not await revoke_key(key_id):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"revoked": True, "id": key_id}


@router.delete("/{key_id}")
async def remove_api_key(key_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    if not await delete_key(key_id):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"deleted": True, "id": key_id}
