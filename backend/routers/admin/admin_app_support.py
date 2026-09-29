"""Admin — Aarohmm app support desk (grievances + trade schemes).

Grievances are a two-way thread: the shop posts from the mobile app, the team
replies here, and either side sees the whole conversation. Only an admin can
close a ticket.
"""
import logging
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator


def _parse_date(v):
    """asyncpg requires a real date object for date columns; accept 'YYYY-MM-DD' too."""
    if v is None or v == "":
        return None
    if isinstance(v, date):
        return v
    try:
        return datetime.strptime(str(v)[:10], "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date: {v!r} (want YYYY-MM-DD)")

from dependencies import db, require_admin
from services import app_grievances as grievances
from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/app-support", tags=["Admin · App Support"])


# ============================ GRIEVANCES ============================
@router.get("/grievances")
async def list_grievances(
    request: Request,
    status: Optional[str] = None,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    tickets = await grievances.list_grievances(status=status)
    return {
        "tickets": tickets,
        "counts": {
            "total": len(tickets),
            "unread": sum(1 for t in tickets if t.get("unread_for_admin")),
        },
    }


@router.get("/grievances/{grievance_id}")
async def get_grievance(
    grievance_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    ticket = await grievances.get_thread(grievance_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Grievance not found")

    # Attachments are private; hand the admin short-lived signed URLs.
    ticket["image_urls"] = await _signed_urls([i["storage_path"] for i in ticket.get("images", [])])
    await grievances.mark_read(grievance_id, side="admin")
    return ticket


class AdminReply(BaseModel):
    body: str = Field(min_length=2, max_length=4000)
    close_ticket: bool = False


@router.post("/grievances/{grievance_id}/reply")
async def reply_to_grievance(
    grievance_id: str,
    payload: AdminReply,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    actor = admin.get("email") or "admin"

    msg = await grievances.add_message(
        grievance_id, author="admin", body=payload.body, author_name="Aarohmm Team"
    )
    if msg is None:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if msg.get("error") == "closed":
        raise HTTPException(
            status_code=409,
            detail="This ticket is closed. Reopen it before replying.",
        )

    if payload.close_ticket:
        await grievances.set_status(grievance_id, "closed", actor=actor)

    ticket = await grievances.get_thread(grievance_id)
    notified = await grievances.notify_retailer_of_reply(
        grievance_id,
        subject=ticket.get("subject", "your grievance") if ticket else "your grievance",
        reply_body=payload.body,
        closed=payload.close_ticket,
    )
    return {
        "message": dict(msg) | {"created_at": str(msg["created_at"])},
        "closed": payload.close_ticket,
        "retailer_notified": notified,
    }


class StatusChange(BaseModel):
    status: str


@router.post("/grievances/{grievance_id}/status")
async def change_status(
    grievance_id: str,
    payload: StatusChange,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    admin = await require_admin(request, session_token)
    if payload.status not in grievances.STATUSES:
        raise HTTPException(
            status_code=400, detail=f"status must be one of {grievances.STATUSES}"
        )
    ok = await grievances.set_status(
        grievance_id, payload.status, actor=admin.get("email") or "admin"
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Grievance not found")
    return {"status": payload.status}


async def _signed_urls(paths: list[str]) -> list[str]:
    """Signed URLs for private grievance attachments (1 hour)."""
    import os

    import httpx

    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY") or ""
    if not base or not anon or not paths:
        return []

    urls: list[str] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for path in paths:
            try:
                r = await client.post(
                    f"{base}/storage/v1/object/sign/grievance-uploads/{path}",
                    headers={"apikey": anon, "Authorization": f"Bearer {anon}"},
                    json={"expiresIn": 3600},
                )
                if r.status_code < 400:
                    signed = r.json().get("signedURL") or ""
                    if signed:
                        urls.append(f"{base}/storage/v1{signed}")
            except Exception as e:
                logger.warning(f"could not sign {path}: {e}")
    return urls


# ============================ SCHEMES ============================
class SchemeIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = None
    terms: Optional[str] = None
    min_cartons: Optional[int] = None
    discount_pct: Optional[float] = Field(default=None, ge=0, le=100)
    banner_url: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool = True
    # Auto-pricing rules. `min_boxes` is in BOXES — the unit the retailer
    # types on the order pad — and is what the pricing engine actually uses.
    min_boxes: Optional[float] = Field(default=None, ge=0)
    min_order_value: Optional[float] = Field(default=None, ge=0)
    max_discount_inr: Optional[float] = Field(default=None, ge=0)
    applies_to: str = "all"
    categories: List[str] = Field(default_factory=list)
    skus: List[str] = Field(default_factory=list)
    priority: int = 100

    @field_validator("applies_to")
    @classmethod
    def _check_scope(cls, v: str) -> str:
        if v not in ("all", "category", "sku"):
            raise ValueError("applies_to must be 'all', 'category' or 'sku'")
        return v

    @model_validator(mode="after")
    def _scope_needs_targets(self):
        if self.applies_to == "category" and not self.categories:
            raise ValueError("Pick at least one category for a category scheme")
        if self.applies_to == "sku" and not self.skus:
            raise ValueError("Pick at least one product for a product scheme")
        return self


@router.get("/schemes")
async def list_schemes(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    conn = await _connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        rows = await conn.fetch(
            "select id, title, description, terms, min_cartons, discount_pct, "
            "banner_url, valid_from, valid_to, is_active, updated_at, "
            "min_boxes, min_order_value, max_discount_inr, applies_to, "
            "categories, skus, priority "
            "from public.app_schemes order by priority desc, updated_at desc"
        )
        return {"schemes": [dict(r) for r in rows]}
    finally:
        await conn.close()


@router.post("/schemes")
async def create_scheme(
    payload: SchemeIn, request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    conn = await _connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        row = await conn.fetchrow(
            """
            insert into public.app_schemes
              (title, description, terms, min_cartons, discount_pct, banner_url,
               valid_from, valid_to, is_active, min_boxes, min_order_value,
               max_discount_inr, applies_to, categories, skus, priority)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            returning id
            """,
            payload.title.strip(),
            payload.description,
            payload.terms,
            payload.min_cartons,
            payload.discount_pct,
            payload.banner_url,
            _parse_date(payload.valid_from),
            _parse_date(payload.valid_to),
            payload.is_active,
            payload.min_boxes,
            payload.min_order_value,
            payload.max_discount_inr,
            payload.applies_to,
            payload.categories,
            payload.skus,
            payload.priority,
        )
        return {"id": str(row["id"])}
    finally:
        await conn.close()


@router.put("/schemes/{scheme_id}")
async def update_scheme(
    scheme_id: str,
    payload: SchemeIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    conn = await _connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        result = await conn.execute(
            """
            update public.app_schemes set
              title=$2, description=$3, terms=$4, min_cartons=$5, discount_pct=$6,
              banner_url=$7, valid_from=$8, valid_to=$9, is_active=$10,
              min_boxes=$11, min_order_value=$12, max_discount_inr=$13,
              applies_to=$14, categories=$15, skus=$16, priority=$17,
              updated_at=now()
            where id=$1
            """,
            scheme_id,
            payload.title.strip(),
            payload.description,
            payload.terms,
            payload.min_cartons,
            payload.discount_pct,
            payload.banner_url,
            _parse_date(payload.valid_from),
            _parse_date(payload.valid_to),
            payload.is_active,
            payload.min_boxes,
            payload.min_order_value,
            payload.max_discount_inr,
            payload.applies_to,
            payload.categories,
            payload.skus,
            payload.priority,
        )
        if result.split()[-1] == "0":
            raise HTTPException(status_code=404, detail="Scheme not found")
        return {"updated": True}
    finally:
        await conn.close()


@router.delete("/schemes/{scheme_id}")
async def delete_scheme(
    scheme_id: str, request: Request, session_token: Optional[str] = Cookie(None)
):
    await require_admin(request, session_token)
    conn = await _connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        result = await conn.execute(
            "delete from public.app_schemes where id = $1", scheme_id
        )
        if result.split()[-1] == "0":
            raise HTTPException(status_code=404, detail="Scheme not found")
        return {"deleted": True}
    finally:
        await conn.close()


# ============================ BROCHURE ============================
@router.post("/brochure/sync")
async def sync_brochure_now(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """Rebuild the brochure from the website catalogue on demand."""
    await require_admin(request, session_token)
    from services.app_brochure_sync import sync_brochure

    return await sync_brochure(db)


@router.get("/brochure")
async def list_brochure(request: Request, session_token: Optional[str] = Cookie(None)):
    await require_admin(request, session_token)
    conn = await _connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        rows = await conn.fetch(
            "select sku, name, category, size_label, image_url, detail, notes, "
            "mrp, b2b_price, is_active, updated_at "
            "from public.app_brochure_items order by sort_order, name"
        )
        return {"items": [dict(r) for r in rows]}
    finally:
        await conn.close()
