"""Admin balances — unified rollup of AppyFlow / Sandbox / Mappls status."""
from typing import Optional

from fastapi import APIRouter, Cookie, Request

from dependencies import require_admin
from services.provider_health import get_all_provider_status

router = APIRouter(prefix="/admin/provider-balances", tags=["Admin · Provider Balances"])


@router.get("")
async def admin_provider_balances(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Return live probes + 30-day usage rollups for every external provider."""
    await require_admin(request, session_token)
    return await get_all_provider_status()
