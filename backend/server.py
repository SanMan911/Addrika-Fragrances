"""Aarohmm Pad — FastAPI backend. Supabase (auth + data) + Resend (email)."""
import os
import re
import ipaddress
import logging
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional, List
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, EmailStr
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().strip('"')
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"].strip().strip('"')
ADMIN_GSTINS = {g.strip().upper() for g in os.environ.get("ADMIN_GSTINS", "").split(",") if g.strip()}
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip()
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Aarohmm").strip()
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "").strip()
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_DOMAIN = "aarohmm.pad"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = FastAPI(title="Aarohmm Pad API")


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")


# -------------------------- Helpers ---------------------------------------
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$")


def normalize_gstin(g: str) -> str:
    return (g or "").strip().upper().replace(" ", "")


def gstin_to_email(gstin: str) -> str:
    return f"{gstin.lower()}@{EMAIL_DOMAIN}"


def role_for_gstin(gstin: str) -> Optional[str]:
    """Return 'admin' if GSTIN is designated admin, else None (defer to user choice)."""
    if gstin.upper() in ADMIN_GSTINS:
        return "admin"
    return None


# -------------------------- Email guardrails ------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    """Send a transactional email. If the email key is not provisioned, log and skip."""
    if not EMERGENT_EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set; skipping email to %s subject=%s", to, subject)
        return None
    try:
        _assert_safe_email(subject, html)
    except ValueError as e:
        logger.error("Email blocked by guardrail: %s", e)
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMERGENT_EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
    except Exception as e:
        logger.error("Email send error: %s", e)
    return None


# -------------------------- Models ----------------------------------------
class RegisterIn(BaseModel):
    gstin: str
    password: str = Field(min_length=6)
    name: str
    email: EmailStr
    business_name: Optional[str] = None
    phone: Optional[str] = None
    role: str  # 'retailer' or 'distributor' (admin auto-detected)
    assigned_distributor_id: Optional[str] = None


class LoginIn(BaseModel):
    gstin: str
    password: str


class OrderItem(BaseModel):
    sku: str
    name: str
    size_label: Optional[str] = None
    quantity: int = Field(ge=1)
    unit_price: float
    pieces_per_carton: Optional[int] = None


class CreateOrderIn(BaseModel):
    items: List[OrderItem]
    distributor_id: Optional[str] = None  # required when placed_by is retailer
    notes: Optional[str] = None


class UpdateOrderStatusIn(BaseModel):
    status: str


# -------------------------- Auth dependency --------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception as e:
        logger.warning("get_user failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    uid = user_resp.user.id
    prof = supabase.table("pad_users").select("*").eq("id", uid).limit(1).execute()
    if not prof.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return prof.data[0]


# -------------------------- Auth routes -----------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    gstin = normalize_gstin(body.gstin)
    if not GSTIN_RE.match(gstin):
        raise HTTPException(status_code=400, detail="Invalid GSTIN format")
    if body.role not in ("retailer", "distributor"):
        raise HTTPException(status_code=400, detail="Role must be retailer or distributor")

    # Admin GSTINs override role
    final_role = role_for_gstin(gstin) or body.role

    # Check uniqueness
    existing = supabase.table("pad_users").select("id").eq("gstin", gstin).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="A user with this GSTIN already exists")

    synthetic_email = gstin_to_email(gstin)
    # Create auth user (email-confirmed) via admin API
    try:
        created = supabase.auth.admin.create_user({
            "email": synthetic_email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"gstin": gstin, "name": body.name, "role": final_role},
        })
    except Exception as e:
        msg = str(e)
        logger.error("auth.admin.create_user failed: %s", msg)
        if "already" in msg.lower() or "registered" in msg.lower():
            raise HTTPException(status_code=409, detail="Account already exists for this GSTIN")
        raise HTTPException(status_code=400, detail=f"Signup failed: {msg}")

    new_uid = created.user.id

    # Validate assigned distributor if retailer
    assigned = None
    if final_role == "retailer":
        if not body.assigned_distributor_id:
            # Allow registration without distributor; retailer can set later. Admin can also assign.
            assigned = None
        else:
            dist = supabase.table("pad_users").select("id,role").eq("id", body.assigned_distributor_id).limit(1).execute()
            if not dist.data or dist.data[0]["role"] != "distributor":
                raise HTTPException(status_code=400, detail="Assigned distributor is invalid")
            assigned = body.assigned_distributor_id

    profile = {
        "id": new_uid,
        "gstin": gstin,
        "email": body.email,
        "name": body.name,
        "business_name": body.business_name,
        "phone": body.phone,
        "role": final_role,
        "assigned_distributor_id": assigned,
    }
    try:
        supabase.table("pad_users").insert(profile).execute()
    except Exception as e:
        logger.error("profile insert failed: %s", e)
        # rollback auth user
        try:
            supabase.auth.admin.delete_user(new_uid)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to create profile")

    # Sign in to return a token immediately
    sess = supabase.auth.sign_in_with_password({"email": synthetic_email, "password": body.password})
    return {
        "access_token": sess.session.access_token,
        "refresh_token": sess.session.refresh_token,
        "user": profile,
    }


@api.post("/auth/login")
async def login(body: LoginIn):
    gstin = normalize_gstin(body.gstin)
    synthetic_email = gstin_to_email(gstin)
    try:
        sess = supabase.auth.sign_in_with_password({"email": synthetic_email, "password": body.password})
    except Exception as e:
        logger.info("login failed for %s: %s", gstin, e)
        raise HTTPException(status_code=401, detail="Invalid GSTIN or password")
    uid = sess.user.id
    prof = supabase.table("pad_users").select("*").eq("id", uid).limit(1).execute()
    if not prof.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "access_token": sess.session.access_token,
        "refresh_token": sess.session.refresh_token,
        "user": prof.data[0],
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# -------------------------- Products (live stock) --------------------------
@api.get("/products")
async def list_products(user=Depends(get_current_user)):
    resp = supabase.table("app_products").select(
        "sku,name,category,size_label,pieces_per_carton,mrp,b2b_price,stock_pieces,image_url,is_active"
    ).eq("is_active", True).order("name").execute()
    return {"products": resp.data or []}


# -------------------------- Distributors list ------------------------------
@api.get("/distributors")
async def list_distributors():
    resp = supabase.table("pad_users").select(
        "id,name,business_name,gstin,city,state"
    ).eq("role", "distributor").eq("is_active", True).order("name").execute()
    return {"distributors": resp.data or []}


# -------------------------- Orders ----------------------------------------
def _calc_totals(items: List[OrderItem]):
    subtotal = round(sum(i.quantity * i.unit_price for i in items), 2)
    gst = round(subtotal * 0.18, 2)  # 18% GST placeholder; adjust later
    total = round(subtotal + gst, 2)
    return subtotal, gst, total


def _order_number() -> str:
    # Readable number: AP-YYMMDD-xxxxx (uuid-ish)
    import uuid
    return "AP-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid.uuid4().hex[:6].upper()


async def _notify_order(order_row: dict, placer: dict, distributor_profile: Optional[dict]):
    """Send email to admin always, and to distributor when placer is retailer."""
    order_no = order_row["order_number"]
    total = order_row["total_amount"]
    items = order_row["items"]
    rows_html = "".join(
        f'<tr><td style="padding:6px;border-bottom:1px solid #E6E3DE">{escape(i["name"])}</td>'
        f'<td style="padding:6px;border-bottom:1px solid #E6E3DE;text-align:center">{int(i["quantity"])}</td>'
        f'<td style="padding:6px;border-bottom:1px solid #E6E3DE;text-align:right">Rs. {float(i["unit_price"]):.2f}</td></tr>'
        for i in items
    )
    placer_line = f'{escape(placer["name"])} ({escape(placer["role"].title())}, GSTIN {escape(placer["gstin"])})'
    html = (
        '<table role="presentation" width="100%" style="font-family:Arial,sans-serif;color:#1C1B1A">'
        '<tr><td style="padding:20px">'
        f'<h2 style="color:#4F6354;margin:0 0 8px">New order {escape(order_no)}</h2>'
        f'<p style="margin:0 0 12px">Placed by {placer_line}.</p>'
        '<table style="width:100%;border-collapse:collapse;font-size:14px">'
        '<thead><tr><th style="text-align:left;padding:6px;background:#F2EFEA">Item</th>'
        '<th style="padding:6px;background:#F2EFEA">Qty</th>'
        '<th style="text-align:right;padding:6px;background:#F2EFEA">Unit Price</th></tr></thead>'
        f'<tbody>{rows_html}</tbody></table>'
        f'<p style="margin-top:16px;font-weight:bold">Total: Rs. {float(total):.2f}</p>'
        '<p style="font-size:12px;color:#73706C;margin-top:20px">'
        f'Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.'
        '</p></td></tr></table>'
    )
    subject = f"New order {order_no} — {EMAIL_FROM_NAME}"
    if ADMIN_EMAIL:
        await send_email(to=ADMIN_EMAIL, subject=subject, html=html)
    if placer["role"] == "retailer" and distributor_profile and distributor_profile.get("email"):
        await send_email(to=distributor_profile["email"], subject=subject, html=html)


@api.post("/orders")
async def create_order(body: CreateOrderIn, user=Depends(get_current_user)):
    if user["role"] not in ("retailer", "distributor"):
        raise HTTPException(status_code=403, detail="Only retailers and distributors can place orders")
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    distributor_id = None
    distributor_profile = None
    if user["role"] == "retailer":
        distributor_id = body.distributor_id or user.get("assigned_distributor_id")
        if not distributor_id:
            raise HTTPException(status_code=400, detail="No distributor assigned. Pick one to place the order.")
        d = supabase.table("pad_users").select("*").eq("id", distributor_id).eq("role", "distributor").limit(1).execute()
        if not d.data:
            raise HTTPException(status_code=400, detail="Distributor not found")
        distributor_profile = d.data[0]

    # Validate stock against live app_products
    skus = [i.sku for i in body.items]
    prod_resp = supabase.table("app_products").select("sku,stock_pieces,is_active,b2b_price,name").in_("sku", skus).execute()
    stock_map = {p["sku"]: p for p in (prod_resp.data or [])}
    for i in body.items:
        p = stock_map.get(i.sku)
        if not p or not p.get("is_active"):
            raise HTTPException(status_code=400, detail=f"Product unavailable: {i.sku}")
        if (p.get("stock_pieces") or 0) < i.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {p['name']}: only {p.get('stock_pieces',0)} left")

    subtotal, gst, total = _calc_totals(body.items)
    row = {
        "order_number": _order_number(),
        "placed_by_id": user["id"],
        "placed_by_role": user["role"],
        "distributor_id": distributor_id,
        "items": [i.model_dump() for i in body.items],
        "subtotal": subtotal,
        "gst_amount": gst,
        "total_amount": total,
        "status": "placed",
        "notes": body.notes,
    }
    try:
        ins = supabase.table("pad_orders").insert(row).execute()
    except Exception as e:
        logger.error("order insert failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create order")
    created = ins.data[0]
    # Notify
    try:
        await _notify_order(created, user, distributor_profile)
    except Exception as e:
        logger.error("notify failed: %s", e)
    return {"order": created}


@api.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    q = supabase.table("pad_orders").select("*").order("created_at", desc=True).limit(200)
    if user["role"] == "retailer":
        q = q.eq("placed_by_id", user["id"])
    elif user["role"] == "distributor":
        # all orders sent to me OR placed by me
        q = q.or_(f"distributor_id.eq.{user['id']},placed_by_id.eq.{user['id']}")
    # admin: no filter, sees all
    resp = q.execute()
    return {"orders": resp.data or []}


@api.get("/orders/actionable")
async def actionable(user=Depends(get_current_user)):
    """Actionable = non-delivered, non-cancelled orders the user must act on."""
    q = supabase.table("pad_orders").select("*").not_.in_("status", ["delivered", "cancelled"]).order("created_at", desc=True)
    if user["role"] == "admin":
        # orders placed by distributors
        q = q.eq("placed_by_role", "distributor")
    elif user["role"] == "distributor":
        # orders from retailers assigned to me
        q = q.eq("distributor_id", user["id"]).eq("placed_by_role", "retailer")
    else:
        # retailer: their own in-flight orders
        q = q.eq("placed_by_id", user["id"])
    resp = q.execute()
    return {"orders": resp.data or []}


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    resp = supabase.table("pad_orders").select("*").eq("id", order_id).limit(1).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = resp.data[0]
    # Access control
    if user["role"] == "admin":
        pass
    elif user["role"] == "distributor":
        if order["distributor_id"] != user["id"] and order["placed_by_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if order["placed_by_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    # Attach placer profile
    placer = supabase.table("pad_users").select("name,business_name,gstin,role,email,phone").eq("id", order["placed_by_id"]).limit(1).execute()
    order["placed_by"] = placer.data[0] if placer.data else None
    if order.get("distributor_id"):
        d = supabase.table("pad_users").select("name,business_name,gstin").eq("id", order["distributor_id"]).limit(1).execute()
        order["distributor"] = d.data[0] if d.data else None
    return {"order": order}


STATUS_FLOW = {
    "placed": {"confirmed", "cancelled"},
    "confirmed": {"dispatched", "cancelled"},
    "dispatched": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}


@api.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: UpdateOrderStatusIn, user=Depends(get_current_user)):
    resp = supabase.table("pad_orders").select("*").eq("id", order_id).limit(1).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = resp.data[0]
    # Only admin or the distributor who received the order can update status
    allowed = user["role"] == "admin" or (
        user["role"] == "distributor" and order["distributor_id"] == user["id"]
    ) or (
        # Admin reviews distributor-placed orders; distributor cannot update own order
        user["role"] == "admin"
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed to update this order")
    new_status = body.status
    if new_status not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="Invalid status")
    cur = order["status"]
    if new_status not in STATUS_FLOW.get(cur, set()):
        raise HTTPException(status_code=400, detail=f"Cannot move from {cur} to {new_status}")
    upd = supabase.table("pad_orders").update({
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", order_id).execute()
    return {"order": upd.data[0] if upd.data else None}


# -------------------------- Admin helpers ---------------------------------
@api.get("/admin/users")
async def admin_list_users(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    resp = supabase.table("pad_users").select("*").order("created_at", desc=True).execute()
    return {"users": resp.data or []}


class AssignDistributorIn(BaseModel):
    retailer_id: str
    distributor_id: Optional[str] = None


@api.post("/admin/assign-distributor")
async def admin_assign(body: AssignDistributorIn, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    r = supabase.table("pad_users").select("id,role").eq("id", body.retailer_id).limit(1).execute()
    if not r.data or r.data[0]["role"] != "retailer":
        raise HTTPException(status_code=400, detail="Retailer not found")
    if body.distributor_id:
        d = supabase.table("pad_users").select("id,role").eq("id", body.distributor_id).limit(1).execute()
        if not d.data or d.data[0]["role"] != "distributor":
            raise HTTPException(status_code=400, detail="Distributor not found")
    upd = supabase.table("pad_users").update({
        "assigned_distributor_id": body.distributor_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", body.retailer_id).execute()
    return {"user": upd.data[0] if upd.data else None}


@api.post("/retailer/set-distributor")
async def retailer_set_distributor(body: AssignDistributorIn, user=Depends(get_current_user)):
    if user["role"] != "retailer":
        raise HTTPException(status_code=403, detail="Retailer only")
    if body.retailer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Can only update your own assignment")
    if body.distributor_id:
        d = supabase.table("pad_users").select("id,role").eq("id", body.distributor_id).limit(1).execute()
        if not d.data or d.data[0]["role"] != "distributor":
            raise HTTPException(status_code=400, detail="Distributor not found")
    upd = supabase.table("pad_users").update({
        "assigned_distributor_id": body.distributor_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user["id"]).execute()
    return {"user": upd.data[0] if upd.data else None}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
