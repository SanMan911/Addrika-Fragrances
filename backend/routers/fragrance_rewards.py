"""Fragrance Rewards / B2B Trade Credit HTTP router.

Distinct from the customer-facing /rewards router (B2C shop credits) —
this is exclusively for onboarded retailers earning shipping cashback
on ≥ ₹1,000 B2B orders per the spec in services/fragrance_rewards.py.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services.fragrance_rewards import (
    apply_credit,
    get_balance,
)

router = APIRouter(prefix="/fragrance-rewards", tags=["Fragrance Rewards (B2B)"])


async def _current_retailer_id(request: Request) -> str:
    from routers.retailer_auth import get_current_retailer  # local import to avoid cycles
    r = await get_current_retailer(request, request.cookies.get("retailer_session"))
    if not r:
        raise HTTPException(status_code=401, detail="Retailer login required")
    return r["retailer_id"]


@router.get("/balance")
async def retailer_balance(request: Request):
    rid = await _current_retailer_id(request)
    return await get_balance(db, rid)


class ApplyRequest(BaseModel):
    order_id: str
    invoice_subtotal_inr: float = Field(..., gt=0)
    amount_to_apply: float = Field(..., gt=0)


@router.post("/apply")
async def retailer_apply_credit(body: ApplyRequest, request: Request):
    rid = await _current_retailer_id(request)
    return await apply_credit(
        db, rid, body.order_id, body.invoice_subtotal_inr, body.amount_to_apply
    )


# --------------- Admin --------------------
@router.get("/admin/{retailer_id}/balance")
async def admin_view_balance(
    retailer_id: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    return await get_balance(db, retailer_id)


@router.get("/admin/{retailer_id}/ledger")
async def admin_view_ledger(
    retailer_id: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    cursor = db.rewards_ledger.find(
        {"retailer_id": retailer_id}, {"_id": 0}
    ).sort("earned_at", -1)
    rows = await cursor.to_list(500)
    return {"retailer_id": retailer_id, "entries": rows}


class ManualAdjustRequest(BaseModel):
    amount_inr: float
    note: str = ""


@router.post("/admin/{retailer_id}/adjust")
async def admin_manual_adjust(
    retailer_id: str,
    body: ManualAdjustRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Manual credit/debit — for goodwill, disputes, or offline reconciliation."""
    await require_admin(request, session_token)
    from datetime import datetime, timezone, timedelta
    from services.fragrance_rewards import CREDIT_VALIDITY_DAYS
    import uuid
    now = datetime.now(timezone.utc)
    entry = {
        "id": f"FR-{uuid.uuid4().hex[:10].upper()}",
        "retailer_id": retailer_id,
        "source_order_id": None,
        "kind": "adjust",
        "amount": float(body.amount_inr),
        "status": "active" if body.amount_inr > 0 else "consumed",
        "earned_at": now.isoformat(),
        "expires_at": (now + timedelta(days=CREDIT_VALIDITY_DAYS)).isoformat(),
        "note": body.note or "Manual admin adjustment",
    }
    await db.rewards_ledger.insert_one(entry)
    entry.pop("_id", None)
    return {"ok": True, "entry": entry}
