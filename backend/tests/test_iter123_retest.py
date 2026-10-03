"""Iter123 retest — the extra backend assertions the review_request calls out
on top of iter122 (which already passes 21/21):

  * /gst-contact/preview 409 when an account already exists for the GSTIN
  * /admin/{retailer_id}/signup-reminder: emails + lists missing docs,
    400 if nothing outstanding, 404 for an unknown retailer
  * /app/v2/auth/gstin-check: unknown => registered=false,
    registered QA GSTIN => registered=true with business_name
  * /app/v2/auth/password-login: wrong password -> 401,
    correct password -> 503 today (SUPABASE_SERVICE_KEY missing — expected)

Run: cd /app/backend && pytest tests/test_iter123_retest.py -v
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

_mongo = MongoClient(os.environ["MONGO_URL"])
sdb = _mongo[os.environ["DB_NAME"]]

BASE = "http://localhost:8001"
GSTIN_REAL = "27AAACR5055K1Z7"
QA_GSTIN = "29AAAAA0000A1Z5"
B2B_GSTIN = "07AAAAA0000A1Z5"


async def _admin_cookie(client: httpx.AsyncClient) -> str:
    r = await client.post(
        f"{BASE}/api/admin/login/initiate",
        json={"email": "contact.us@centraders.com", "pin": "050499"},
    )
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    doc = sdb.admin_2fa_tokens.find_one({"token_id": tid})
    assert doc, "2FA token row not written"
    v = await client.post(
        f"{BASE}/api/admin/login/verify-otp",
        json={"token_id": tid, "otp": doc["otp"]},
    )
    assert v.status_code == 200, v.text
    return v.json()["session_token"]


# ---------- preview 409 ----------
def test_preview_409_when_account_exists():
    gstin = GSTIN_REAL
    email = f"iter123dup+{uuid.uuid4().hex[:6]}@centraders.com"
    sdb.retailers.delete_many({"gst_number": gstin})
    sdb.retailers.insert_one(
        {
            "retailer_id": f"RTL_DUP_{uuid.uuid4().hex[:6]}",
            "gst_number": gstin,
            "email": email,
            "status": "active",
        }
    )
    try:
        r = httpx.post(
            f"{BASE}/api/retailer-auth/gst-contact/preview",
            json={"gstin": gstin},
            timeout=30,
        )
        assert r.status_code == 409, f"{r.status_code} {r.text}"
    finally:
        sdb.retailers.delete_many({"gst_number": gstin})


# ---------- admin signup-reminder ----------
def test_signup_reminder_lifecycle():
    async def run():
        rid = f"RTL_REM_{uuid.uuid4().hex[:6]}"
        email = f"iter123rem+{uuid.uuid4().hex[:6]}@centraders.com"
        sdb.retailers.insert_one(
            {
                "retailer_id": rid,
                "gst_number": "27AAAAA0000A2Z6",
                "business_name": "Reminder Co",
                "contact_name": "Qa",
                "email": email,
                "phone": "9876543210",
                "status": "under_processing",
                "gst_cert_deferred": True,
            }
        )
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                cookie = await _admin_cookie(c)
                H = {"Cookie": f"session_token={cookie}"}

                r = await c.post(
                    f"{BASE}/api/retailers/admin/{rid}/signup-reminder", headers=H
                )
                assert r.status_code == 200, r.text
                body = r.json()
                missing = body.get("missing") or body.get("missing_docs") or []
                assert isinstance(missing, list) and missing, body

                r = await c.post(
                    f"{BASE}/api/retailers/admin/RTL_DOES_NOT_EXIST/signup-reminder",
                    headers=H,
                )
                assert r.status_code == 404, r.text

                sdb.retailers.update_one(
                    {"retailer_id": rid},
                    {
                        "$set": {
                            "status": "active",
                            "gst_cert_deferred": False,
                            "kyc": {
                                "gst_certificate": {"url": "x"},
                                "spoc_aadhaar": {"url": "x"},
                            },
                        }
                    },
                )
                r = await c.post(
                    f"{BASE}/api/retailers/admin/{rid}/signup-reminder", headers=H
                )
                assert r.status_code == 400, r.text
        finally:
            sdb.retailers.delete_many({"retailer_id": rid})

    asyncio.run(run())


# ---------- mobile GSTIN-check ----------
def test_mobile_gstin_check_unknown_and_qa():
    async def run():
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{BASE}/api/app/v2/auth/gstin-check",
                json={"gstin": "27ZZZZZ9999Z9Z9"},
            )
            assert r.status_code == 200, r.text
            assert r.json().get("registered") is False, r.text

            r = await c.post(
                f"{BASE}/api/app/v2/auth/gstin-check", json={"gstin": QA_GSTIN}
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("registered") is True, body
            assert body.get("business_name"), body

    asyncio.run(run())


# ---------- mobile password login — wrong pw / expected 503 ----------
def test_mobile_password_login_states():
    async def run():
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{BASE}/api/app/v2/auth/password-login",
                json={"gstin": B2B_GSTIN, "password": "wrong!!"},
            )
            assert r.status_code in (401, 429), r.text  # 429 only if locked

            r = await c.post(
                f"{BASE}/api/app/v2/auth/password-login",
                json={"gstin": B2B_GSTIN, "password": "Test@12345"},
            )
            # SUPABASE_SERVICE_KEY missing in this env => 503 by design
            assert r.status_code in (503, 200, 429), r.text
            if r.status_code == 503:
                assert (
                    "code" in r.text.lower() or "email" in r.text.lower()
                ), r.text

    asyncio.run(run())
