"""
Iteration 100 tests — retailer self-registration + admin KYC workflow.
Uses live backend via requests. GST auto-verification path is exercised
against Appyflow only for the invalid-GSTIN hard-block case (safe: no
credits burned). Admin CRUD is tested against a fixture retailer seeded
directly in Mongo so we don't burn Appyflow credits on a valid GSTIN.
"""
import asyncio
import io
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import requests
from dotenv import dotenv_values

next_env = dotenv_values("/app/frontend-next/.env.local")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or next_env.get("NEXT_PUBLIC_BACKEND_URL")
    or ""
).rstrip("/")
if not BASE_URL:
    raise RuntimeError("Backend URL missing")

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
INVALID_GSTIN = "22AAAAA0000A1Z5"


@pytest.fixture(scope="module")
def api():
    return requests.Session()


@pytest.fixture(scope="module")
def admin(api):
    """Two-step admin login: initiate → read OTP from Mongo → verify."""
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    r = api.post(
        f"{BASE_URL}/api/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    token_id = r.json()["token_id"]

    mc = MongoClient(os.environ["MONGO_URL"])
    row = mc[os.environ["DB_NAME"]].admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    mc.close()
    assert row and row.get("otp"), "admin_2fa_tokens row missing"

    r2 = api.post(
        f"{BASE_URL}/api/admin/login/verify-otp",
        json={"token_id": token_id, "otp": row["otp"]},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    tok = r2.json().get("session_token")
    if tok:
        api.cookies.set("session_token", tok)
    return api


@pytest.fixture
def seeded_retailer():
    """Seed a self-registered retailer directly in Mongo (sync pymongo)."""
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    mc = MongoClient(os.environ["MONGO_URL"])
    dbh = mc[os.environ["DB_NAME"]]
    retailer_id = f"RTL_TEST{uuid.uuid4().hex[:6].upper()}"
    email = f"iter100.seed.{retailer_id.lower()}@example.com"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "retailer_id": retailer_id,
        "business_name": "Iter100 Seed LLP",
        "trade_name": "Iter100 Seed",
        "name": "Iter100 Seed Contact",
        "contact_name": "Iter100 Seed Contact",
        "email": email,
        "phone": "9999900123",
        "country_code": "+91",
        "gst_number": "27ABCDE1234F1Z5",
        "gst_verified": True,
        "gst_certificate": {
            "storage_path": f"addrika/kyc/gst-cert/{retailer_id}/fake.pdf",
            "original_filename": "fake.pdf",
            "content_type": "application/pdf",
            "size": 100,
            "uploaded_at": now,
            "is_deleted": False,
        },
        "city": "Mumbai",
        "state": "Maharashtra",
        "status": "under_processing",
        "admin_notes": [],
        "password_hash": "$2b$12$abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        "self_registered": True,
        "created_at": now,
    }
    dbh.retailers.insert_one(doc)
    yield {"retailer_id": retailer_id, "email": email, "doc": doc}
    dbh.retailers.delete_one({"retailer_id": retailer_id})
    dbh.retailer_sessions.delete_many({"retailer_id": retailer_id})
    mc.close()


def _cert_file():
    return {"gst_certificate": ("gst-cert.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}


def _reg_payload(email: str, gst: str = INVALID_GSTIN):
    return {
        "business_name": "Test Retailer LLP",
        "contact_name": "Jane Doe",
        "email": email,
        "phone": "9999900000",
        "country_code": "+91",
        "gst_number": gst,
        "password": "MyStrongPass1",
        "city": "Mumbai",
        "state": "Maharashtra",
    }


# ---------------------------- /register hard-block ---------------------------

class TestRegisterHardBlock:
    def test_reject_invalid_gstin(self, api):
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/register",
            data=_reg_payload("iter100.badgst@example.com", INVALID_GSTIN),
            files=_cert_file(),
            timeout=30,
        )
        assert r.status_code == 400
        assert "not found" in r.json()["detail"].lower()

    def test_reject_bad_mime(self, api):
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/register",
            data=_reg_payload("iter100.badmime@example.com", INVALID_GSTIN),
            files={"gst_certificate": ("bad.txt", io.BytesIO(b"nope"), "text/plain")},
            timeout=30,
        )
        assert r.status_code == 400
        assert "PDF" in r.json()["detail"] or "pdf" in r.json()["detail"].lower()

    def test_reject_bad_gst_format(self, api):
        r = api.post(
            f"{BASE_URL}/api/retailer-auth/register",
            data=_reg_payload("iter100.format@example.com", "INVALID"),
            files=_cert_file(),
            timeout=30,
        )
        assert r.status_code in (400, 422)


# ------------------- Admin CRUD workflow on seeded retailer ------------------

class TestAdminWorkflow:
    def test_list_includes_seeded(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.get(f"{BASE_URL}/api/admin/retailer-requests", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(x["retailer_id"] == rid for x in items)

    def test_status_filter(self, admin, seeded_retailer):
        r = admin.get(
            f"{BASE_URL}/api/admin/retailer-requests?status=under_processing",
            timeout=30,
        )
        assert r.status_code == 200
        items = r.json()["items"]
        rid = seeded_retailer["retailer_id"]
        assert any(x["retailer_id"] == rid for x in items)

    def test_approve(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.post(f"{BASE_URL}/api/admin/retailer-requests/{rid}/approve", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "verified"
        # Audit note auto-added
        assert any("Status changed to verified" in n["body"] for n in r.json()["admin_notes"])

    def test_revoke(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        admin.post(f"{BASE_URL}/api/admin/retailer-requests/{rid}/approve", timeout=30)
        r = admin.post(
            f"{BASE_URL}/api/admin/retailer-requests/{rid}/revoke",
            json={"reason": "Duplicate account"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "revoked"
        assert r.json()["revoked_reason"] == "Duplicate account"

    def test_suspend_requires_reason(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.post(
            f"{BASE_URL}/api/admin/retailer-requests/{rid}/suspend",
            json={"reason": "xx"},  # too short
            timeout=30,
        )
        assert r.status_code == 422

    def test_suspend_and_unsuspend(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.post(
            f"{BASE_URL}/api/admin/retailer-requests/{rid}/suspend",
            json={"reason": "Suspicious ordering pattern"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "suspended"
        assert "Suspicious" in r.json()["suspended_reason"]

        r2 = admin.post(f"{BASE_URL}/api/admin/retailer-requests/{rid}/unsuspend", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["status"] == "under_processing"
        # suspended_reason cleared
        assert not r2.json().get("suspended_reason")

    def test_add_note(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.post(
            f"{BASE_URL}/api/admin/retailer-requests/{rid}/notes",
            json={"body": "Called retailer — confirmed shop address."},
            timeout=30,
        )
        assert r.status_code == 200
        assert any("Called retailer" in n["body"] for n in r.json()["admin_notes"])

    def test_note_empty_rejected(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.post(
            f"{BASE_URL}/api/admin/retailer-requests/{rid}/notes",
            json={"body": ""},
            timeout=30,
        )
        assert r.status_code == 422

    def test_delete(self, admin, seeded_retailer):
        rid = seeded_retailer["retailer_id"]
        r = admin.delete(f"{BASE_URL}/api/admin/retailer-requests/{rid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["deleted"] == rid
        gone = admin.get(f"{BASE_URL}/api/admin/retailer-requests/{rid}", timeout=30)
        assert gone.status_code == 404
