"""
Zoho Books integration for Addrika B2B.

- Single-tenant (one Zoho org connected via OAuth refresh-token).
- All calls are best-effort and gated behind env vars; if creds are missing,
  the integration silently no-ops so production doesn't break.
- Discount is split proportionally per line so Zoho's GST math matches ours.
- Razorpay payments recorded as customer payment, applied to invoice when
  available, otherwise held as customer advance against the sales order.
"""
from __future__ import annotations

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import httpx

logger = logging.getLogger(__name__)

REGION = os.environ.get("ZOHO_REGION", "in")
CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
REFRESH_TOKEN = os.environ.get("ZOHO_REFRESH_TOKEN", "")
ORG_ID = os.environ.get("ZOHO_ORG_ID", "")

ACCOUNTS_URL = f"https://accounts.zoho.{REGION}/oauth/v2/token"
API_URL = f"https://www.zohoapis.{REGION}/books/v3"


def is_configured() -> bool:
    return all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ORG_ID])


# ---------------------------------------------------------------------------
# Token cache
# ---------------------------------------------------------------------------
_token_cache: dict[str, Any] = {"token": None, "expiry": None}
_token_lock = asyncio.Lock()


async def _get_access_token() -> Optional[str]:
    if not is_configured():
        return None
    now = datetime.now(timezone.utc)
    if _token_cache["token"] and _token_cache["expiry"] and now < _token_cache["expiry"]:
        return _token_cache["token"]
    async with _token_lock:
        if _token_cache["token"] and _token_cache["expiry"] and datetime.now(timezone.utc) < _token_cache["expiry"]:
            return _token_cache["token"]
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                ACCOUNTS_URL,
                data={
                    "grant_type": "refresh_token",
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "refresh_token": REFRESH_TOKEN,
                },
            )
            r.raise_for_status()
            data = r.json()
            _token_cache["token"] = data["access_token"]
            _token_cache["expiry"] = datetime.now(timezone.utc) + timedelta(
                seconds=int(data.get("expires_in", 3600)) - 120
            )
            return _token_cache["token"]


async def _request(method: str, path: str, *, json_body: Optional[dict] = None,
                   params: Optional[dict] = None) -> Optional[dict]:
    token = await _get_access_token()
    if not token:
        return None
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
    }
    qp = {"organization_id": ORG_ID, **(params or {})}
    url = f"{API_URL}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.request(method, url, headers=headers, params=qp, json=json_body)
        if r.status_code == 401:
            # Force refresh and retry once
            _token_cache["token"] = None
            token = await _get_access_token()
            headers["Authorization"] = f"Zoho-oauthtoken {token}"
            r = await c.request(method, url, headers=headers, params=qp, json=json_body)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Zoho {method} {path} failed: {e.response.status_code} {e.response.text[:300]}")
            return None
        return r.json()


# ---------------------------------------------------------------------------
# Customer (retailer) sync
# ---------------------------------------------------------------------------

async def find_customer_by_gst(gst_number: str) -> Optional[dict]:
    res = await _request("GET", "contacts", params={"gst_no": gst_number})
    if not res:
        return None
    contacts = res.get("contacts") or []
    for c in contacts:
        if (c.get("gst_no") or "").upper() == gst_number.upper():
            return c
    return contacts[0] if contacts else None


async def upsert_customer(retailer: dict) -> Optional[str]:
    """Return Zoho contact_id, or None if integration disabled / failed."""
    if not is_configured():
        return None
    gst = (retailer.get("gst_number") or "").upper().strip()
    name = (
        retailer.get("business_name")
        or retailer.get("trade_name")
        or retailer.get("name")
        or retailer.get("email")
    )
    payload = {
        "contact_name": name,
        "company_name": retailer.get("business_name") or name,
        "contact_type": "customer",
        "gst_treatment": "business_gst" if gst else "consumer",
        "gst_no": gst or None,
        "contact_persons": [
            {
                "first_name": (retailer.get("contact_name") or name).split(" ")[0][:50],
                "email": retailer.get("email"),
                "phone": retailer.get("phone"),
                "is_primary_contact": True,
            }
        ],
        "billing_address": {
            "address": retailer.get("address") or "",
            "city": retailer.get("city") or "",
            "state": retailer.get("state") or "",
            "zip": retailer.get("pincode") or "",
            "country": "India",
        },
    }
    existing = await find_customer_by_gst(gst) if gst else None
    if existing and existing.get("contact_id"):
        res = await _request("PUT", f"contacts/{existing['contact_id']}", json_body=payload)
        return (res or {}).get("contact", {}).get("contact_id") or existing["contact_id"]
    res = await _request("POST", "contacts", json_body=payload)
    return (res or {}).get("contact", {}).get("contact_id")


# ---------------------------------------------------------------------------
# Sales Order
# ---------------------------------------------------------------------------

def _distribute_discount(order: dict) -> list[dict]:
    """Spread the total non-GST discount proportionally across line items.

    User requirement: "all discounts availed should be split amongst all
    items ordered equally and should be factored in the prices for the
    purpose of Purchase Order Creation".

    Returns Zoho line_items in their expected schema, with `rate` already
    reduced by per-line discount and `tax_percentage` = 18.
    """
    items = order.get("items") or []
    subtotal = float(order.get("subtotal") or 0) or 1.0
    total_discount = float(
        (order.get("loyalty_discount") or 0)
        + (order.get("voucher_discount") or 0)
        + (order.get("cash_discount") or 0)
    )
    # Tier discount is already inside line_total, so don't double count
    factor = max(0.0, 1.0 - (total_discount / subtotal)) if subtotal else 1.0
    out = []
    for it in items:
        line_total = float(it.get("line_total") or 0)
        qty = float(it.get("quantity_boxes") or 0) or 1.0
        net_rate = round((line_total / qty) * factor, 2)
        out.append(
            {
                "name": f"{it.get('name')} ({it.get('net_weight')})",
                "description": f"Box rate after proportional discount · HSN {it.get('hsn_code') or ''}",
                "rate": net_rate,
                "quantity": qty,
                "unit": "box",
                "tax_percentage": float(it.get("gst_rate") or 18),
                "hsn_or_sac": it.get("hsn_code") or "",
                "item_total": round(net_rate * qty, 2),
            }
        )
    return out


async def push_sales_order(order: dict, retailer: dict) -> Optional[dict]:
    """Create a Zoho Sales Order from an Addrika B2B order. Returns Zoho payload or None."""
    if not is_configured():
        return None
    contact_id = await upsert_customer(retailer)
    if not contact_id:
        logger.warning("Zoho: skipping sales order — no contact_id")
        return None
    line_items = _distribute_discount(order)
    payload = {
        "customer_id": contact_id,
        "reference_number": order["order_id"],
        "date": (order.get("created_at") or datetime.now(timezone.utc).isoformat())[:10],
        "line_items": line_items,
        "notes": "Synced from Addrika B2B portal",
    }
    res = await _request("POST", "salesorders", json_body=payload)
    so = (res or {}).get("salesorder")
    if so:
        logger.info(f"Zoho sales order {so.get('salesorder_id')} created for {order['order_id']}")
    return so


async def push_payment(order: dict, retailer: dict, amount: float,
                       razorpay_payment_id: str) -> Optional[dict]:
    """Record a Razorpay payment as Zoho customer payment (advance against SO)."""
    if not is_configured():
        return None
    contact_id = await upsert_customer(retailer)
    if not contact_id:
        return None
    payload = {
        "customer_id": contact_id,
        "payment_mode": "online",
        "amount": float(amount),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "reference_number": razorpay_payment_id,
        "description": f"Razorpay payment for Addrika B2B order {order['order_id']}",
    }
    res = await _request("POST", "customerpayments", json_body=payload)
    pmt = (res or {}).get("payment")
    if pmt:
        logger.info(
            f"Zoho payment {pmt.get('payment_id')} recorded for order {order['order_id']}"
        )
    return pmt


async def status() -> dict:
    """Lightweight ping for admin sanity check."""
    if not is_configured():
        return {"configured": False}
    try:
        res = await _request("GET", "organizations")
        return {
            "configured": True,
            "ok": bool(res),
            "org_id": ORG_ID,
            "region": REGION,
        }
    except Exception as e:
        return {"configured": True, "ok": False, "error": str(e)[:200]}
