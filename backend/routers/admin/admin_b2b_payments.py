"""Admin desk for the B2B pre-payment gate.

    GET  /api/admin/b2b-payments/settings           → gate + killswitch config
    PUT  /api/admin/b2b-payments/settings           → change it
    GET  /api/admin/b2b-payments/proofs             → declared payments to verify
    POST /api/admin/b2b-payments/proofs/{id}/review → verify or reject one
    GET  /api/admin/b2b-payments/intents            → carts waiting for payment
    POST /api/admin/b2b-payments/intents/{id}/confirm → confirm an offline payment
    GET  /api/admin/b2b-payments/retailers          → shops with outstanding dues
    POST /api/admin/b2b-payments/retailers/{id}/block → lock / unlock one shop
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel, Field

from dependencies import db, require_admin
from services import b2b_checkout_intent as intents
from services import b2b_payment_gate as gate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/b2b-payments", tags=["Admin B2B Payments"])


class GateSettingsUpdate(BaseModel):
    prepayment_required: Optional[bool] = None
    min_payment_percent: Optional[int] = None
    dues_killswitch_enabled: Optional[bool] = None
    dues_grace_days: Optional[int] = Field(None, ge=0, le=365)


class ProofReview(BaseModel):
    approve: bool
    admin_note: str = ""


class BlockUpdate(BaseModel):
    blocked: bool
    note: str = ""


class IntentConfirm(BaseModel):
    payment_reference: str = Field(min_length=3, max_length=120)
    amount: Optional[float] = None


@router.get("/settings")
async def get_gate_settings(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    return await gate.get_settings(db)


@router.put("/settings")
async def update_gate_settings(
    data: GateSettingsUpdate, request: Request, session_token: Optional[str] = Cookie(None)
):
    admin = await require_admin(request, session_token)
    try:
        return await gate.update_settings(
            db,
            admin.get("email", "admin"),
            prepayment_required=data.prepayment_required,
            min_payment_percent=data.min_payment_percent,
            dues_killswitch_enabled=data.dues_killswitch_enabled,
            dues_grace_days=data.dues_grace_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/proofs")
async def list_payment_proofs(
    request: Request,
    status: Optional[str] = None,
    retailer_id: Optional[str] = None,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    proofs = await gate.list_proofs(db, status=status, retailer_id=retailer_id)
    pending = await db.b2b_payment_proofs.count_documents({"status": "pending"})
    return {"proofs": proofs, "pending_count": pending}


@router.post("/proofs/{proof_id}/review")
async def review_payment_proof(
    proof_id: str,
    data: ProofReview,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    try:
        return await gate.review_proof(
            db,
            proof_id,
            approve=data.approve,
            admin_email=admin.get("email", "admin"),
            admin_note=data.admin_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/intents")
async def list_checkout_intents(
    request: Request,
    status: Optional[str] = "awaiting_payment",
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return {"intents": await intents.list_intents(db, status=status)}


@router.post("/intents/{intent_id}/confirm")
async def confirm_checkout_intent(
    intent_id: str,
    data: IntentConfirm,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Confirm an intent whose payment arrived outside the gateway (NEFT, UPI)."""
    admin = await require_admin(request, session_token)
    try:
        return await intents.confirm_intent(
            db,
            intent_id,
            payment_reference=data.payment_reference,
            verified_by=admin.get("email", "admin"),
            amount=data.amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/retailers")
async def list_retailer_dues(request: Request, session_token: Optional[str] = Cookie(None)):
    """Every active shop with its outstanding balance and lock state."""
    await require_admin(request, session_token)
    settings = await gate.get_settings(db)
    rows = []
    cursor = db.retailers.find(
        {"status": "active"},
        {
            "_id": 0,
            "retailer_id": 1,
            "business_name": 1,
            "trade_name": 1,
            "gst_number": 1,
            "city": 1,
            "ordering_blocked": 1,
            "ordering_block_note": 1,
        },
    )
    async for retailer in cursor:
        dues = await gate.dues_summary(db, retailer["retailer_id"])
        if dues["outstanding_amount"] <= 0 and not retailer.get("ordering_blocked"):
            continue
        rows.append(
            {
                **retailer,
                "business_name": retailer.get("business_name") or retailer.get("trade_name"),
                "outstanding_amount": dues["outstanding_amount"],
                "overdue_amount": dues["overdue_amount"],
                "oldest_unpaid_days": dues["oldest_unpaid_days"],
                "locked_by_killswitch": bool(
                    settings["dues_killswitch_enabled"] and dues["overdue_amount"] > 0
                ),
            }
        )
    rows.sort(key=lambda r: r["outstanding_amount"], reverse=True)
    return {"retailers": rows, "settings": settings}


@router.post("/retailers/{retailer_id}/block")
async def block_retailer_ordering(
    retailer_id: str,
    data: BlockUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    try:
        return await gate.set_manual_block(
            db, retailer_id, data.blocked, admin.get("email", "admin"), data.note
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
