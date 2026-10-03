"""Aarohmm B2B mobile app API (Supabase-authenticated).

The app reads catalogue / orders / grievances straight from Supabase Postgres
under Row-Level Security. Everything that touches money, stock or another
retailer's data lives here instead, behind a verified Supabase JWT:

    GET  /api/app/v2/me                  → retailer profile + KYC/credit state
    POST /api/app/v2/gstin-lookup        → GSTIN → masked email (pre-login)
    POST /api/app/v2/orders/calculate    → server-authoritative price preview
    POST /api/app/v2/orders              → place order (reuses b2b_order_engine)
    POST /api/app/v2/grievances          → raise a ticket (+ uploaded image paths)
    POST /api/app/v2/support/contact     → message the admin team
    POST /api/app/v2/sync                → refresh this retailer's read model
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from dependencies import db
from routers.b2b_orders import B2BOrderCreate
from services import b2b_order_engine as order_engine
from services import supabase_app_sync as app_sync
from services.supabase_auth import get_app_retailer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/app/v2", tags=["Mobile App v2"])

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


async def _retailer(authorization: Optional[str]) -> dict:
    return await get_app_retailer(db, authorization)


# --------------------------------------------------------------------------
# Pre-login: GSTIN → masked email, so the app can tell the retailer which
# inbox their one-time code is going to without exposing the address.
# --------------------------------------------------------------------------
class GstinLookup(BaseModel):
    gstin: str


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = "*" * len(local)
    else:
        masked = local[:2] + "*" * max(len(local) - 2, 1)
    return f"{masked}@{domain}"


@router.post("/gstin-lookup")
async def gstin_lookup(payload: GstinLookup):
    """Resolve a GSTIN to the retailer's registered (masked) email."""
    gstin = (payload.gstin or "").strip().upper()
    if not GSTIN_RE.match(gstin):
        raise HTTPException(status_code=400, detail="Please enter a valid 15-character GSTIN")

    retailer = await db.retailers.find_one(
        {"gst_number": gstin, "status": "active"},
        {"_id": 0, "email": 1, "business_name": 1, "trade_name": 1},
    )
    if not retailer or not retailer.get("email"):
        # Deliberately generic — this endpoint is public, so it must not
        # confirm which GSTINs are Aarohmm retailers.
        raise HTTPException(
            status_code=404,
            detail=(
                "No active Aarohmm retailer account found for this GSTIN. "
                "Please contact contact.us@centraders.com to get onboarded."
            ),
        )
    return {
        "found": True,
        "business_name": retailer.get("business_name") or retailer.get("trade_name"),
        "masked_email": _mask_email(retailer["email"].lower()),
    }


# --------------------------------------------------------------------------
# Login: GSTIN → one-time code → Supabase session
#
# The backend brokers the whole exchange because GSTINs are public. If the
# app could turn a GSTIN into a real email address, anyone could harvest
# every retailer's contact details, so the raw address never leaves here.
# --------------------------------------------------------------------------
class CodeRequestIn(BaseModel):
    gstin: str


class CodeVerifyIn(BaseModel):
    gstin: str
    code: str = Field(min_length=4, max_length=10)


CODE_MAX_PER_HOUR = 5


async def _retailer_by_gstin(gstin: str) -> dict:
    if not GSTIN_RE.match(gstin):
        raise HTTPException(status_code=400, detail="Please enter a valid 15-character GSTIN")
    retailer = await db.retailers.find_one(
        {"gst_number": gstin, "status": "active"},
        {"_id": 0, "email": 1, "business_name": 1, "trade_name": 1, "retailer_id": 1},
    )
    if not retailer or not retailer.get("email"):
        raise HTTPException(
            status_code=404,
            detail=(
                "No active Aarohmm retailer account found for this GSTIN. "
                "Please contact contact.us@centraders.com to get onboarded."
            ),
        )
    return retailer


def _supabase_cfg() -> tuple[str, str]:
    import os

    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY") or ""
    if not url or not anon:
        raise HTTPException(status_code=503, detail="Sign-in is not configured on this server")
    return url, anon


@router.post("/auth/request-code")
async def request_login_code(payload: CodeRequestIn):
    """Mail a 6-digit Supabase one-time code to the GSTIN's registered inbox."""

    import requests as _requests

    gstin = (payload.gstin or "").strip().upper()
    retailer = await _retailer_by_gstin(gstin)

    since = datetime.now(timezone.utc).timestamp() - 3600
    recent = await db.app_login_codes.count_documents(
        {"gstin": gstin, "ts": {"$gte": since}}
    )
    if recent >= CODE_MAX_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail="Too many sign-in codes requested for this GSTIN. Please try again later.",
        )
    await db.app_login_codes.insert_one(
        {"gstin": gstin, "ts": datetime.now(timezone.utc).timestamp()}
    )

    url, anon = _supabase_cfg()
    email = retailer["email"].lower()
    try:
        resp = await asyncio.to_thread(
            lambda: _requests.post(
                f"{url}/auth/v1/otp",
                headers={"apikey": anon, "Content-Type": "application/json"},
                json={"email": email, "create_user": True},
                timeout=25,
            )
        )
    except Exception as e:
        logger.error(f"Supabase OTP request failed for {gstin}: {e}")
        raise HTTPException(status_code=502, detail="Could not send the code. Please try again.")

    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Too many codes requested just now. Please wait a minute and try again.",
        )
    if resp.status_code >= 400:
        logger.error(f"Supabase OTP error {resp.status_code} for {gstin}: {resp.text[:300]}")
        raise HTTPException(status_code=502, detail="Could not send the code. Please try again.")

    return {
        "sent": True,
        "business_name": retailer.get("business_name") or retailer.get("trade_name"),
        "masked_email": _mask_email(email),
    }


@router.post("/auth/verify-code")
async def verify_login_code(payload: CodeVerifyIn):
    """Verify the code with Supabase and return the resulting session tokens."""
    import requests as _requests

    gstin = (payload.gstin or "").strip().upper()
    retailer = await _retailer_by_gstin(gstin)
    url, anon = _supabase_cfg()

    try:
        resp = await asyncio.to_thread(
            lambda: _requests.post(
                f"{url}/auth/v1/verify",
                headers={"apikey": anon, "Content-Type": "application/json"},
                json={
                    "type": "email",
                    "email": retailer["email"].lower(),
                    "token": payload.code.strip(),
                },
                timeout=25,
            )
        )
    except Exception as e:
        logger.error(f"Supabase verify failed for {gstin}: {e}")
        raise HTTPException(status_code=502, detail="Could not verify the code. Please try again.")

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=401,
            detail="That code is wrong or has expired. Please request a new one.",
        )

    data = resp.json()
    if not data.get("access_token") or not data.get("refresh_token"):
        raise HTTPException(status_code=502, detail="Sign-in failed. Please try again.")

    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_in": data.get("expires_in"),
    }


# --------------------------------------------------------------------------
# GSTIN + password sign-in (mirrors the web portal)
#
# The app asks for the GSTIN first. `/auth/gstin-check` says whether that
# GSTIN is already a stockist — if not, the app sends the retailer to the web
# registration form instead of pretending a password exists. Passwords live
# only in MongoDB; on success we mint a Supabase session behind the scenes so
# the app's RLS-guarded reads keep working.
# --------------------------------------------------------------------------
class GstinCheckIn(BaseModel):
    gstin: str


class PasswordLoginIn(BaseModel):
    gstin: str
    password: str = Field(min_length=1, max_length=128)


@router.post("/auth/gstin-check")
async def gstin_check(payload: GstinCheckIn):
    """Is this GSTIN a registered stockist? Never leaks the retailer's email."""
    from services.supabase_session import is_configured as _pw_login_ready

    gstin = (payload.gstin or "").strip().upper()
    if not GSTIN_RE.match(gstin):
        raise HTTPException(status_code=400, detail="Please enter a valid 15-character GSTIN")

    retailer = await db.retailers.find_one(
        {"$or": [{"gst_number": gstin}, {"username": gstin}]},
        {"_id": 0, "business_name": 1, "trade_name": 1, "status": 1, "password_hash": 1},
    )
    # `password_login_ready` is honest about this server: without the Supabase
    # service key we cannot mint a session from a password, so the app routes
    # to the emailed one-time code instead of showing a field that can't work.
    ready = _pw_login_ready()
    if not retailer or retailer.get("status") == "deleted":
        return {
            "registered": False,
            "status": None,
            "has_password": False,
            "password_login_ready": ready,
        }

    return {
        "registered": True,
        "status": retailer.get("status"),
        "has_password": bool(retailer.get("password_hash")) and ready,
        "password_login_ready": ready,
        "business_name": retailer.get("business_name") or retailer.get("trade_name"),
    }


@router.post("/auth/password-login")
async def password_login(payload: PasswordLoginIn):
    """GSTIN + the retailer's web password -> a real Supabase session."""
    from services.retailer_identity import (
        clear_failed_logins,
        is_locked_out,
        record_failed_login,
    )
    from services.auth_service import verify_password
    from services.supabase_session import mint_session

    gstin = (payload.gstin or "").strip().upper()
    if not GSTIN_RE.match(gstin):
        raise HTTPException(status_code=400, detail="Please enter a valid 15-character GSTIN")

    if await is_locked_out(db, gstin):
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Please try again in 15 minutes or reset your password.",
        )

    retailer = await db.retailers.find_one(
        {"$or": [{"gst_number": gstin}, {"username": gstin}]}
    )
    if not retailer or retailer.get("status") == "deleted":
        await record_failed_login(db, gstin)
        raise HTTPException(status_code=401, detail="Invalid GSTIN or password")

    if not verify_password(payload.password, retailer.get("password_hash") or ""):
        await record_failed_login(db, gstin)
        raise HTTPException(status_code=401, detail="Invalid GSTIN or password")

    await clear_failed_logins(db, gstin)

    if retailer.get("status") == "suspended":
        reason = retailer.get("suspended_reason") or "Please contact AAROHMM."
        raise HTTPException(status_code=403, detail=f"Your account is suspended. Reason: {reason}")
    if retailer.get("status") != "active":
        raise HTTPException(
            status_code=403,
            detail=(
                "Your account is still being reviewed by our team. "
                "You'll be able to sign in to the app as soon as it is approved."
            ),
        )

    email = (retailer.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=409, detail="No email on file for this account. Please contact AAROHMM.")

    session = await mint_session(email)
    if not session:
        raise HTTPException(
            status_code=503,
            detail=(
                "Password sign-in is not available on this server yet. "
                "Please use \"Email me a one-time code\" instead."
            ),
        )

    await db.retailers.update_one(
        {"retailer_id": retailer["retailer_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": session.get("expires_in"),
        "business_name": retailer.get("business_name") or retailer.get("trade_name"),
    }


# --------------------------------------------------------------------------
# Profile
# --------------------------------------------------------------------------
@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    r = await _retailer(authorization)
    return {
        "retailer_id": r["retailer_id"],
        "gstin": r.get("gst_number"),
        "business_name": r.get("business_name") or r.get("trade_name"),
        "contact_name": r.get("name"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "city": r.get("city"),
        "state": r.get("state"),
        "kyc_complete": bool(r.get("documents_complete")),
        "is_verified": bool(r.get("is_verified")),
        "total_orders": r.get("total_orders_handled", 0),
    }


# --------------------------------------------------------------------------
# Orders — pricing and placement stay server-side on purpose
# --------------------------------------------------------------------------
@router.post("/orders/calculate")
async def calculate_order(
    order_data: B2BOrderCreate, authorization: Optional[str] = Header(None)
):
    retailer = await _retailer(authorization)
    return await order_engine.calculate(db, retailer, order_data)


@router.post("/orders")
async def place_order(
    order_data: B2BOrderCreate, authorization: Optional[str] = Header(None)
):
    retailer = await _retailer(authorization)
    if not retailer.get("documents_complete"):
        raise HTTPException(
            status_code=403,
            detail="Your KYC is still pending. Please complete it before placing orders.",
        )
    order, response = await order_engine.place_order(
        db,
        retailer,
        order_data,
        channel="mobile",
        client_ref=order_data.client_ref,
    )
    # Push the new order into the app's read model immediately so the
    # history screen shows it without waiting for the periodic sync.
    try:
        await app_sync.sync_one_order(db, order["order_id"])
    except Exception as e:
        logger.warning(f"read-model sync after order {order.get('order_id')} failed: {e}")
    return response


# --------------------------------------------------------------------------
# Grievances
# --------------------------------------------------------------------------
class GrievanceCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)
    category: str = "other"
    order_number: Optional[str] = None
    image_paths: List[str] = Field(default_factory=list, max_length=6)


ALLOWED_CATEGORIES = {"damaged", "shortage", "billing", "delivery", "quality", "other"}


@router.post("/grievances")
async def create_grievance(
    payload: GrievanceCreate, authorization: Optional[str] = Header(None)
):
    """Raise a grievance. Images are uploaded by the app straight to Supabase
    Storage (RLS confines each retailer to their own folder); the returned
    object paths are recorded here."""
    retailer = await _retailer(authorization)
    category = payload.category if payload.category in ALLOWED_CATEGORIES else "other"

    prefix = f"{retailer['retailer_id']}/"
    for path in payload.image_paths:
        if not path.startswith(prefix):
            raise HTTPException(status_code=400, detail="Invalid attachment path")

    conn = await app_sync._connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Grievance storage is not configured")
    try:
        grievance_id = await conn.fetchval(
            """
            insert into public.app_grievances
              (retailer_id, order_number, category, subject, message, status)
            values ($1,$2,$3,$4,$5,'open')
            returning id
            """,
            retailer["retailer_id"],
            (payload.order_number or "").strip() or None,
            category,
            payload.subject.strip(),
            payload.message.strip(),
        )
        if payload.image_paths:
            await conn.executemany(
                "insert into public.app_grievance_images (grievance_id, storage_path) values ($1,$2)",
                [(grievance_id, p) for p in payload.image_paths],
            )
    finally:
        await conn.close()

    # Notify the admin team — best effort, never fails the ticket.
    email_sent = False
    try:
        from services.email_service import send_email
        import os

        admin_email = os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com")
        rows = "".join(
            f"<tr><td style='background:#f5f0e8;font-weight:600;width:34%'>{k}</td>"
            f"<td style='background:#faf7f2'>{v}</td></tr>"
            for k, v in [
                ("Retailer", retailer.get("business_name") or retailer["retailer_id"]),
                ("GSTIN", retailer.get("gst_number") or "—"),
                ("Category", category),
                ("Order", payload.order_number or "—"),
                ("Attachments", str(len(payload.image_paths))),
            ]
        )
        email_sent = await send_email(
            to_email=admin_email,
            subject=f"[AAROHMM App] Grievance — {payload.subject.strip()[:80]}",
            html_content=(
                "<html><body style=\"font-family:Arial,sans-serif;background:#f5f5f5;padding:20px\">"
                "<table cellpadding='0' cellspacing='0' style='max-width:640px;margin:0 auto;"
                "background:#fff;border-radius:10px;overflow:hidden'>"
                "<tr><td style='background:#1e3a52;padding:20px;text-align:center'>"
                "<h1 style=\"color:#d4af37;margin:0;font-size:20px\">New Grievance Raised</h1>"
                "<p style=\"color:#fff;margin:4px 0 0;font-size:12px\">Aarohmm B2B app</p></td></tr>"
                "<tr><td style='padding:22px;color:#1e3a52'>"
                f"<table cellpadding='6' cellspacing='0' style='width:100%;font-size:14px'>{rows}</table>"
                f"<p style='margin-top:18px;white-space:pre-wrap'>{payload.message.strip()}</p>"
                "</td></tr></table></body></html>"
            ),
        )
    except Exception as e:
        logger.error(f"grievance admin email failed: {e}")

    return {
        "id": str(grievance_id),
        "status": "open",
        "admin_notified": email_sent,
        "message": "Your grievance has been raised. Our team will get back to you.",
    }


# --------------------------------------------------------------------------
# Contact admin
# --------------------------------------------------------------------------
class ContactAdmin(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)


@router.post("/support/contact")
async def contact_admin(
    payload: ContactAdmin, authorization: Optional[str] = Header(None)
):
    retailer = await _retailer(authorization)
    thread_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.retailer_messages.insert_one(
        {
            "id": thread_id,
            "retailer_id": retailer["retailer_id"],
            "channel": "mobile_app",
            "subject": payload.subject.strip(),
            "message": payload.message.strip(),
            "direction": "retailer_to_admin",
            "created_at": now,
            "read": False,
        }
    )
    sent = False
    try:
        from services.email_service import send_email
        import os

        sent = await send_email(
            to_email=os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com"),
            subject=f"[AAROHMM App] {payload.subject.strip()[:80]}",
            html_content=(
                f"<p><strong>{retailer.get('business_name') or retailer['retailer_id']}</strong> "
                f"({retailer.get('gst_number') or '—'}) wrote from the Aarohmm app:</p>"
                f"<p style='white-space:pre-wrap'>{payload.message.strip()}</p>"
            ),
        )
    except Exception as e:
        logger.error(f"contact admin email failed: {e}")
    return {"id": thread_id, "delivered": sent, "message": "Message sent to the Aarohmm team."}


# --------------------------------------------------------------------------
# Read-model refresh (pull-to-refresh safety net)
# --------------------------------------------------------------------------
@router.post("/sync")
async def sync_my_data(authorization: Optional[str] = Header(None)):
    retailer = await _retailer(authorization)
    conn = await app_sync._connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        await app_sync.sync_retailers(db, conn)
        await app_sync.sync_products(db, conn)
        orders = await app_sync.sync_orders(db, conn, retailer_id=retailer["retailer_id"])
    finally:
        await conn.close()
    return {"synced": True, "orders": orders}


# --------------------------------------------------------------------------
# Grievance threads — the shop's side of the conversation
# --------------------------------------------------------------------------
@router.get("/grievances")
async def my_grievances(authorization: Optional[str] = Header(None)):
    retailer = await _retailer(authorization)
    from services import app_grievances as gsvc

    tickets = await gsvc.list_grievances()
    mine = [t for t in tickets if t["retailer_id"] == retailer["retailer_id"]]
    return {
        "tickets": mine,
        "unread": sum(1 for t in mine if t.get("unread_for_retailer")),
    }


@router.get("/grievances/{grievance_id}")
async def my_grievance_thread(
    grievance_id: str, authorization: Optional[str] = Header(None)
):
    retailer = await _retailer(authorization)
    from services import app_grievances as gsvc

    ticket = await gsvc.get_thread(grievance_id, retailer_id=retailer["retailer_id"])
    if not ticket:
        raise HTTPException(status_code=404, detail="Grievance not found")
    await gsvc.mark_read(
        grievance_id, side="retailer", retailer_id=retailer["retailer_id"]
    )
    return ticket


class GrievanceReply(BaseModel):
    body: str = Field(min_length=2, max_length=4000)


@router.post("/grievances/{grievance_id}/reply")
async def reply_to_my_grievance(
    grievance_id: str,
    payload: GrievanceReply,
    authorization: Optional[str] = Header(None),
):
    retailer = await _retailer(authorization)
    from services import app_grievances as gsvc

    msg = await gsvc.add_message(
        grievance_id,
        author="retailer",
        body=payload.body,
        author_name=retailer.get("business_name"),
        retailer_id=retailer["retailer_id"],
    )
    if msg is None:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if msg.get("error") == "closed":
        raise HTTPException(
            status_code=409,
            detail="This ticket has been closed. Please raise a new grievance.",
        )

    # Let the desk know a shop has come back to them.
    try:
        from services.email_service import send_email

        await send_email(
            to_email=os.environ.get("ADMIN_EMAIL", "contact.us@centraders.com"),
            subject=f"[AAROHMM App] Retailer replied — {grievance_id[:8]}",
            html_content=(
                f"<p><strong>{retailer.get('business_name')}</strong> replied on a "
                f"grievance:</p><p style='white-space:pre-wrap'>{payload.body.strip()}</p>"
            ),
        )
    except Exception as e:
        logger.warning(f"admin notify on retailer reply failed: {e}")

    return {"id": str(msg["id"]), "created_at": str(msg["created_at"])}


@router.get("/notifications/summary")
async def notifications_summary(authorization: Optional[str] = Header(None)):
    """Badge counts so the app can show what needs attention."""
    retailer = await _retailer(authorization)
    from services import app_grievances as gsvc

    return {
        "unread_grievance_replies": await gsvc.unread_count_for_retailer(
            retailer["retailer_id"]
        )
    }


# --------------------------------------------------------------------------
# Brochure — auto-built from the website catalogue
# --------------------------------------------------------------------------
@router.get("/brochure")
async def brochure(authorization: Optional[str] = Header(None)):
    await _retailer(authorization)
    conn = await app_sync._connect()
    if conn is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        rows = await conn.fetch(
            "select sku, name, category, size_label, image_url, detail, notes, "
            "mrp, b2b_price from public.app_brochure_items "
            "where is_active order by sort_order, name"
        )
        return {"items": [dict(r) for r in rows]}
    finally:
        await conn.close()


# --------------------------------------------------------------------------
# Payments (Razorpay payment link — Expo friendly, no native SDK)
# --------------------------------------------------------------------------
@router.get("/payments/config")
async def payments_config(authorization: Optional[str] = Header(None)):
    await _retailer(authorization)
    from services import app_payments as pay
    from services import pinelabs_payments as pinelabs

    razorpay_cfg = pay.config_status()
    pinelabs_cfg = pinelabs.config_status()
    return {
        **razorpay_cfg,
        "providers": {"razorpay": razorpay_cfg, "pinelabs": pinelabs_cfg},
        "available_providers": [
            name
            for name, cfg in (("razorpay", razorpay_cfg), ("pinelabs", pinelabs_cfg))
            if cfg["ready_for_payments"]
        ],
    }


class PayIntent(BaseModel):
    order_id: str
    provider: str = "razorpay"


@router.post("/payments/create")
async def create_payment(
    payload: PayIntent, authorization: Optional[str] = Header(None)
):
    """Create a hosted payment session for one of MY unpaid orders."""
    retailer = await _retailer(authorization)
    from services import app_payments as pay
    from services import pinelabs_payments as pinelabs

    provider = (payload.provider or "razorpay").lower()
    if provider not in ("razorpay", "pinelabs"):
        raise HTTPException(status_code=400, detail="Unsupported payment provider")

    handler = pinelabs if provider == "pinelabs" else pay
    if not handler.can_collect():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Online payment via {provider.title()} isn't switched on yet. Your "
                "order is confirmed on credit terms — our team will share payment details."
            ),
        )

    order = await db.b2b_orders.find_one(
        {"order_id": payload.order_id, "retailer_id": retailer["retailer_id"]}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=409, detail="This order is already paid")

    try:
        # Amount is taken from the stored order, never from the request.
        if provider == "pinelabs":
            return await pinelabs.create_checkout(db, order, retailer)
        return await pay.create_payment_link(db, order, retailer)
    except Exception as e:
        logger.error(f"{provider} session creation failed for {payload.order_id}: {e}")
        raise HTTPException(
            status_code=502, detail="Could not start the payment. Please try again."
        )


@router.get("/payments/{order_id}")
async def payment_status(order_id: str, authorization: Optional[str] = Header(None)):
    retailer = await _retailer(authorization)
    from services import app_payments as pay

    order = await db.b2b_orders.find_one(
        {"order_id": order_id, "retailer_id": retailer["retailer_id"]},
        {"_id": 0, "payment_status": 1, "grand_total": 1, "payment_link_url": 1},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_id": order_id,
        "payment_status": order.get("payment_status"),
        "amount": order.get("grand_total"),
        "payment_url": order.get("payment_link_url"),
        "payment": await pay.payment_for_order(order_id, retailer["retailer_id"]),
    }
