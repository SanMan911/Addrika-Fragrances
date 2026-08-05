"""Admin: unified integration-keys panel.

Reads/writes non-social integration keys (Shiprocket, Razorpay override,
Emergent LLM override, Mappls, Sandbox, Zoho, Resend) from a single Mongo
row `db.settings.integration_keys`. Values that live in env vars are
returned as REDACTED so the admin sees whether they're set without
leaking them; PUT lets the admin override the env-var value with a
DB-stored one (highest precedence at read time via the helper below).

Sensitive: every response redacts secrets to their last-4-chars.
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel

from dependencies import db, require_admin

router = APIRouter(prefix="/admin/settings/integrations", tags=["Admin Integrations"])

# Slots the admin can manage. First arg is the env-var fallback, second is
# a friendly label, third is a category so the UI can group them.
SLOTS = {
    # Shipping & fulfillment
    "shiprocket_email":      ("SHIPROCKET_EMAIL",       "Shiprocket login email",           "shipping"),
    "shiprocket_password":   ("SHIPROCKET_PASSWORD",    "Shiprocket password",              "shipping"),
    "shiprocket_pickup_pin": ("SHIPROCKET_PICKUP_PIN",  "Default pickup pincode",           "shipping"),
    "accountant_email":      ("ACCOUNTANT_EMAIL",       "Accountant CC for monthly rewards digest (optional)", "bookkeeping"),

    # Payments
    "razorpay_key_id":       ("RAZORPAY_KEY_ID",        "Razorpay key ID",                  "payments"),
    "razorpay_key_secret":   ("RAZORPAY_KEY_SECRET",    "Razorpay key secret",              "payments"),

    # GST / KYC
    "appyflow_api_key":      ("APPYFLOW_API_KEY",       "Appyflow GST verify key",          "kyc"),
    "sandbox_api_key":       ("SANDBOX_API_KEY",        "Sandbox eKYC key",                 "kyc"),
    "sandbox_api_secret":    ("SANDBOX_API_SECRET",     "Sandbox eKYC secret",              "kyc"),

    # Maps
    "mappls_rest_api_key":   ("MAPPLS_REST_API_KEY",    "Mappls REST API key",              "maps"),

    # LLM (override for Emergent universal key)
    "emergent_llm_key":      ("EMERGENT_LLM_KEY",       "Emergent LLM key (override)",      "ai"),

    # Email
    "resend_api_key":        ("RESEND_API_KEY",         "Resend email API key",             "email"),

    # Cross-platform (Emergent auth, Zoho, Instagram GBM etc — keep expanding)
    "zoho_client_id":        ("ZOHO_CLIENT_ID",         "Zoho Books client ID",             "erp"),
    "zoho_client_secret":    ("ZOHO_CLIENT_SECRET",     "Zoho Books client secret",         "erp"),
}


def _redact(v: Optional[str]) -> Optional[str]:
    if not v:
        return v
    v = str(v)
    if len(v) <= 6:
        return "***"
    return f"…{v[-4:]}"


async def _fetch_row() -> dict:
    doc = await db.settings.find_one({"_id": "integration_keys"}) or {}
    doc.pop("_id", None)
    return doc


async def get_effective(key: str) -> Optional[str]:
    """Read the effective value for a slot: DB override wins over env var.

    Used by internal services (e.g. Shiprocket client, Razorpay client)
    so admins can rotate keys at runtime without a redeploy.
    """
    if key not in SLOTS:
        return None
    row = await _fetch_row()
    db_val = row.get(key)
    if db_val:
        return db_val
    env_var, *_ = SLOTS[key]
    return os.environ.get(env_var)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
@router.get("/config")
async def read_config(
    request: Request, session_token: Optional[str] = Cookie(None)
):
    """List every slot + its status (set-in-env / set-in-db / unset).
    Values are redacted; PUT is the only way to see or change them."""
    await require_admin(request, session_token)
    row = await _fetch_row()
    slots = []
    for key, (env_var, label, category) in SLOTS.items():
        env_val = os.environ.get(env_var)
        db_val = row.get(key)
        source = "db" if db_val else ("env" if env_val else "unset")
        val = db_val or env_val
        slots.append({
            "key": key,
            "label": label,
            "category": category,
            "env_var": env_var,
            "source": source,
            "is_set": bool(val),
            "value_masked": _redact(val),
        })
    return {"slots": slots}


class WriteSlot(BaseModel):
    value: Optional[str] = None  # None or "" wipes the DB override


@router.put("/config/{key}")
async def write_slot(
    key: str, body: WriteSlot,
    request: Request, session_token: Optional[str] = Cookie(None),
):
    await require_admin(request, session_token)
    if key not in SLOTS:
        raise HTTPException(status_code=404, detail=f"unknown slot: {key}")
    val = (body.value or "").strip()
    if val:
        await db.settings.update_one(
            {"_id": "integration_keys"},
            {"$set": {key: val}},
            upsert=True,
        )
    else:
        await db.settings.update_one(
            {"_id": "integration_keys"},
            {"$unset": {key: ""}},
        )
    return {"ok": True, "key": key, "cleared": not val}
