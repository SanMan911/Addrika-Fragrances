"""
Admin Zoho Books integration controls.
- Status / health
- Manually resync a B2B order (sales order + payment) to Zoho
- OAuth Connect flow (browser-based, no terminal needed)
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from fastapi.responses import HTMLResponse, RedirectResponse
from typing import Optional
import logging
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from dependencies import db, require_admin
from services.zoho_books import status as zoho_status, push_sales_order, push_payment, is_configured, reset_token_cache
from services.zoho_errors import (
    list_errors as list_zoho_errors,
    resolve as resolve_zoho_error,
    unresolved_count as zoho_unresolved_count,
    record_error as record_zoho_error,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/zoho", tags=["Admin Zoho"])

# Public callback router (no /admin prefix — must be reachable without admin auth
# because Zoho redirects the browser back here after consent).
public_router = APIRouter(prefix="/zoho-books", tags=["Zoho Books OAuth"])


@router.get("/status")
async def admin_zoho_status(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return await zoho_status()


# ---------------------------------------------------------------------------
# OAuth Connect — initiates the browser-based flow that drops a fresh
# refresh_token into MongoDB without any copy-paste race condition.
# ---------------------------------------------------------------------------

OAUTH_STATE_KEY = "zoho_oauth_state"


@router.get("/oauth-init")
async def admin_zoho_oauth_init(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    org_id: Optional[str] = None,
):
    """Returns the Zoho authorization URL the admin must open in their browser.

    Optionally accepts an `org_id` param so we can persist it alongside the
    refresh token at callback time (saves one round-trip for the admin).
    """
    await require_admin(request, session_token)
    client_id = os.environ.get("ZOHO_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=500, detail="ZOHO_CLIENT_ID not configured")
    region = os.environ.get("ZOHO_REGION", "in")
    redirect_uri = os.environ.get(
        "ZOHO_REDIRECT_URI",
        "https://kyc-verification-14.preview.emergentagent.com/api/zoho-books/callback",
    )
    state = secrets.token_urlsafe(24)
    # Persist the state nonce + (optional) org_id so the callback can verify
    await db.admin_settings.update_one(
        {"setting_key": OAUTH_STATE_KEY},
        {"$set": {
            "setting_key": OAUTH_STATE_KEY,
            "setting_value": {
                "state": state,
                "org_id": (org_id or "").strip(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        }},
        upsert=True,
    )
    auth_url = (
        f"https://accounts.zoho.{region}/oauth/v2/auth?"
        + urlencode({
            "scope": "ZohoBooks.fullaccess.all",
            "client_id": client_id,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "redirect_uri": redirect_uri,
            "state": state,
        })
    )
    return {
        "authorize_url": auth_url,
        "redirect_uri": redirect_uri,
        "instructions": (
            f"Make sure {redirect_uri} is added under "
            f"'Authorized Redirect URIs' in your Zoho API console "
            f"(https://api-console.zoho.{region}/) before clicking Authorize."
        ),
    }


@public_router.get("/callback", response_class=HTMLResponse)
async def zoho_oauth_callback(request: Request):
    """Public callback Zoho redirects to after the admin authorizes.

    - Verifies the state nonce
    - Exchanges the code for a refresh_token
    - Stores refresh_token + org_id (env wins, else stored value) in
      `admin_settings.zoho_oauth`
    - Resets the in-memory access-token cache so the very next API call
      uses the new refresh_token immediately.
    """
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")
    if error:
        return HTMLResponse(_html_msg(f"Zoho returned an error: <code>{error}</code>", success=False), 400)
    if not code or not state:
        return HTMLResponse(_html_msg("Missing <code>code</code> or <code>state</code>.", success=False), 400)

    stored = await db.admin_settings.find_one(
        {"setting_key": OAUTH_STATE_KEY}, {"_id": 0, "setting_value": 1}
    )
    expected = (stored or {}).get("setting_value", {})
    if expected.get("state") != state:
        return HTMLResponse(_html_msg("State mismatch — please retry the connect flow.", success=False), 400)

    region = os.environ.get("ZOHO_REGION", "in")
    client_id = os.environ.get("ZOHO_CLIENT_ID", "").strip()
    client_secret = os.environ.get("ZOHO_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get(
        "ZOHO_REDIRECT_URI",
        str(request.url).split("?")[0],
    )
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"https://accounts.zoho.{region}/oauth/v2/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
        data = r.json()
    except Exception as e:
        logger.error(f"Zoho callback token exchange failed: {e}")
        return HTMLResponse(_html_msg(f"Token exchange failed: {e}", success=False), 502)

    if not data.get("refresh_token"):
        logger.error(f"Zoho callback no refresh_token: {data}")
        return HTMLResponse(
            _html_msg(
                f"Zoho response missing <code>refresh_token</code>:<br/><pre style='text-align:left'>{data}</pre>",
                success=False,
            ),
            400,
        )

    # Preserve pre-existing org_id if neither env nor state nonce supplied one
    pre_existing = await db.admin_settings.find_one(
        {"setting_key": "zoho_oauth"}, {"_id": 0, "setting_value": 1}
    )
    org_id = (
        os.environ.get("ZOHO_ORG_ID", "").strip()
        or expected.get("org_id", "").strip()
        or (pre_existing or {}).get("setting_value", {}).get("org_id", "").strip()
    )

    await db.admin_settings.update_one(
        {"setting_key": "zoho_oauth"},
        {"$set": {
            "setting_key": "zoho_oauth",
            "setting_value": {
                "refresh_token": data["refresh_token"],
                "org_id": org_id,
                "client_id": client_id,
                "client_secret": client_secret,
                "connected_at": datetime.now(timezone.utc).isoformat(),
            },
        }},
        upsert=True,
    )
    # Drop the one-time state nonce
    await db.admin_settings.delete_one({"setting_key": OAUTH_STATE_KEY})
    reset_token_cache()
    logger.info("Zoho OAuth: refresh_token saved successfully")

    if not org_id:
        body = (
            "<b>Refresh token saved!</b> But we still need your "
            "<b>Organization ID</b>. Open Zoho Books, copy the number after "
            "<code>/app/</code> in the URL, and POST it to "
            "<code>/api/admin/zoho/save-org-id</code>, or just paste it back to me."
        )
    else:
        # Live ping
        try:
            ping = await zoho_status()
            ok = ping.get("ok")
        except Exception:
            ok = False
        body = (
            f"<b>Connected to Zoho Books ✅</b><br/>"
            f"Org ID: <code>{org_id}</code><br/>"
            f"Live ping: {'<span style=color:#059669>OK</span>' if ok else '<span style=color:#dc2626>failed</span>'}<br/><br/>"
            f"You can close this tab and return to admin."
        )
    return HTMLResponse(_html_msg(body, success=True))


def _html_msg(body: str, success: bool = True) -> str:
    bg = "#ecfdf5" if success else "#fef2f2"
    border = "#10b981" if success else "#dc2626"
    return f"""
    <html><head><title>Zoho OAuth</title></head>
    <body style='font-family:Arial,sans-serif;background:#1e3a52;color:#fff;padding:48px;text-align:center;'>
      <div style='max-width:560px;margin:0 auto;background:{bg};color:#1e3a52;border-radius:14px;padding:32px;border-top:6px solid {border};'>
        <h1 style='margin:0 0 12px;color:#1e3a52;'>Addrika · Zoho Connect</h1>
        <div style='font-size:15px;line-height:1.6;text-align:left;'>{body}</div>
      </div>
    </body></html>
    """


class _SaveOrgPayload(__import__('pydantic').BaseModel):
    org_id: str


@router.post("/save-org-id")
async def admin_zoho_save_org_id(
    payload: _SaveOrgPayload,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Update only the org_id in `admin_settings.zoho_oauth`."""
    await require_admin(request, session_token)
    org_id = payload.org_id.strip()
    if not org_id.isdigit():
        raise HTTPException(status_code=400, detail="Org ID must be numeric")
    res = await db.admin_settings.update_one(
        {"setting_key": "zoho_oauth"},
        {"$set": {"setting_value.org_id": org_id}},
        upsert=False,
    )
    if res.matched_count == 0:
        raise HTTPException(
            status_code=409,
            detail="Connect to Zoho first via /admin/zoho/oauth-init",
        )
    reset_token_cache()
    return {"ok": True, "org_id": org_id, "status": await zoho_status()}


# ---------------------------------------------------------------------------
# Sync health summary (for the admin dashboard card)
# ---------------------------------------------------------------------------

@router.get("/sync-health")
async def admin_zoho_sync_health(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Aggregate Zoho sync health for the admin dashboard card."""
    await require_admin(request, session_token)
    base_status = await zoho_status()

    synced_so = await db.b2b_orders.count_documents(
        {"zoho_salesorder_id": {"$exists": True, "$ne": None}}
    )
    pending_so = await db.b2b_orders.count_documents(
        {"$or": [
            {"zoho_salesorder_id": {"$exists": False}},
            {"zoho_salesorder_id": None},
        ]}
    )
    synced_pmt = await db.b2b_orders.count_documents(
        {"zoho_payment_id": {"$exists": True, "$ne": None}}
    )
    paid_orders = await db.b2b_orders.count_documents({"payment_status": "paid"})
    pending_pmt = max(0, paid_orders - synced_pmt)
    unresolved_errors = await zoho_unresolved_count()

    last_sync_doc = await db.b2b_orders.find_one(
        {"zoho_synced_at": {"$exists": True}},
        {"_id": 0, "order_id": 1, "zoho_synced_at": 1, "zoho_salesorder_id": 1},
        sort=[("zoho_synced_at", -1)],
    )

    return {
        **base_status,
        "synced_sales_orders": synced_so,
        "pending_sales_orders": pending_so,
        "synced_payments": synced_pmt,
        "pending_payments": pending_pmt,
        "unresolved_errors": unresolved_errors,
        "last_sync": last_sync_doc,
    }


# ---------------------------------------------------------------------------
# One-click backfill — pushes any unsynced B2B order to Zoho.
# ---------------------------------------------------------------------------

@router.post("/backfill")
async def admin_zoho_backfill(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 100,
    only_paid: bool = False,
):
    """Walk B2B orders missing `zoho_salesorder_id` and try to push each one.

    - Skips orders already synced (idempotent).
    - For every order with `payment_status=paid`, also pushes the matching
      payment (best-effort).
    - Records failures into the existing `zoho_sync_errors` log so they
      surface in the admin Zoho-errors banner.
    """
    await require_admin(request, session_token)
    if not await is_configured():
        raise HTTPException(
            status_code=412, detail="Zoho is not connected — run OAuth first"
        )

    query: dict = {
        "$or": [
            {"zoho_salesorder_id": {"$exists": False}},
            {"zoho_salesorder_id": None},
        ]
    }
    if only_paid:
        query["payment_status"] = "paid"

    cursor = db.b2b_orders.find(query, {"_id": 0}).sort("created_at", 1).limit(max(1, min(limit, 500)))
    so_pushed = 0
    pmt_pushed = 0
    failed = 0
    skipped_no_retailer = 0
    failures: list[dict] = []

    async for order in cursor:
        retailer = await db.retailers.find_one(
            {"retailer_id": order.get("retailer_id")},
            {"_id": 0, "password_hash": 0},
        )
        if not retailer:
            skipped_no_retailer += 1
            continue

        try:
            so = await push_sales_order(order, retailer)
        except Exception as e:
            so = None
            await record_zoho_error(
                "sales_order", order["order_id"], retailer["retailer_id"], str(e)
            )
            failed += 1
            failures.append({"order_id": order["order_id"], "stage": "sales_order", "error": str(e)[:200]})
            continue

        if not so:
            await record_zoho_error(
                "sales_order",
                order["order_id"],
                retailer["retailer_id"],
                "push_sales_order returned None during backfill",
            )
            failed += 1
            failures.append({"order_id": order["order_id"], "stage": "sales_order", "error": "returned None"})
            continue

        await db.b2b_orders.update_one(
            {"order_id": order["order_id"]},
            {"$set": {
                "zoho_salesorder_id": so.get("salesorder_id"),
                "zoho_synced_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            }},
        )
        so_pushed += 1

        if order.get("payment_status") == "paid" and not order.get("zoho_payment_id"):
            try:
                pmt = await push_payment(
                    order,
                    retailer,
                    float(order.get("grand_total", 0)),
                    order.get("razorpay_payment_id") or order["order_id"],
                )
            except Exception as e:
                pmt = None
                await record_zoho_error(
                    "payment", order["order_id"], retailer["retailer_id"], str(e)
                )
            if pmt:
                await db.b2b_orders.update_one(
                    {"order_id": order["order_id"]},
                    {"$set": {
                        "zoho_payment_id": pmt.get("payment_id"),
                        "zoho_payment_synced_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                    }},
                )
                pmt_pushed += 1
            elif order.get("payment_status") == "paid":
                await record_zoho_error(
                    "payment",
                    order["order_id"],
                    retailer["retailer_id"],
                    "push_payment returned None during backfill",
                )

    return {
        "ok": True,
        "sales_orders_pushed": so_pushed,
        "payments_pushed": pmt_pushed,
        "failed": failed,
        "skipped_orphan": skipped_no_retailer,
        "failures": failures[:20],
    }


@router.post("/resync/{order_id}")
async def admin_resync_order(
    order_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    """Idempotent: pushes the sales order and (if paid) the payment to Zoho."""
    await require_admin(request, session_token)
    order = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    retailer = await db.retailers.find_one(
        {"retailer_id": order["retailer_id"]}, {"_id": 0}
    )
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    so = await push_sales_order(order, retailer)
    pmt = None
    so_err = None
    pmt_err = None
    if not so:
        so_err = "push_sales_order returned None (check server logs for Zoho API response)"
        await record_zoho_error(
            "sales_order", order_id, order.get("retailer_id"), so_err
        )
    if order.get("payment_status") == "paid":
        pmt = await push_payment(
            order,
            retailer,
            float(order.get("grand_total", 0)),
            order.get("razorpay_payment_id") or order["order_id"],
        )
        if not pmt:
            pmt_err = "push_payment returned None (check server logs for Zoho API response)"
            await record_zoho_error(
                "payment", order_id, order.get("retailer_id"), pmt_err
            )

    updates = {}
    if so:
        updates["zoho_salesorder_id"] = so.get("salesorder_id")
    if pmt:
        updates["zoho_payment_id"] = pmt.get("payment_id")
    if updates:
        from datetime import datetime, timezone
        updates["zoho_synced_at"] = datetime.now(timezone.utc).isoformat()
        await db.b2b_orders.update_one({"order_id": order_id}, {"$set": updates})

    return {
        "configured": await is_configured(),
        "salesorder_pushed": bool(so),
        "payment_pushed": bool(pmt),
        "zoho_salesorder_id": (so or {}).get("salesorder_id"),
        "zoho_payment_id": (pmt or {}).get("payment_id"),
        "errors": {k: v for k, v in {"sales_order": so_err, "payment": pmt_err}.items() if v},
    }


# ---------------------------------------------------------------------------
# Zoho sync error log (for admin banner + error page)
# ---------------------------------------------------------------------------

@router.get("/errors")
async def admin_zoho_errors(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    include_resolved: bool = False,
):
    await require_admin(request, session_token)
    errors = await list_zoho_errors(include_resolved=include_resolved, limit=200)
    return {"errors": errors, "unresolved": await zoho_unresolved_count()}


@router.get("/errors/count")
async def admin_zoho_errors_count(
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    return {"unresolved": await zoho_unresolved_count()}


@router.post("/errors/{error_id}/resolve")
async def admin_zoho_resolve_error(
    error_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    ok = await resolve_zoho_error(error_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Error not found or already resolved")
    return {"resolved": True}
