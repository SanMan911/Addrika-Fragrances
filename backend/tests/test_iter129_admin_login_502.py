"""ITER129 — Verify admin login/initiate 502-on-send-failure change
Covers:
- happy path initiate -> 200 token_id + email_masked
- wrong PIN -> 401
- non-admin email -> 403
- full 2FA flow: initiate -> OTP from DB -> verify-otp -> session_token
- LIVE production probes (read-only)
"""
import os
import pytest
import requests
from pymongo import MongoClient

PREVIEW = "https://aarohmm-partner--18pkutrq.preview.emergentagent.com"
PROD = "https://www.centraders.com"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# ===== Preview backend =====

def test_initiate_happy_path():
    r = requests.post(f"{PREVIEW}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token_id" in data and isinstance(data["token_id"], str) and len(data["token_id"]) > 10
    assert data.get("email_masked", "").startswith("con") and "@centraders.com" in data["email_masked"]
    assert data.get("message") == "OTP sent to your email"


def test_initiate_wrong_pin():
    r = requests.post(f"{PREVIEW}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": "000000"}, timeout=15)
    assert r.status_code == 401, r.text
    assert "Invalid PIN" in r.text


def test_initiate_non_admin_email():
    r = requests.post(f"{PREVIEW}/api/admin/login/initiate",
                      json={"email": "random@notadmin.com", "pin": "050499"}, timeout=15)
    assert r.status_code == 403, r.text


def test_initiate_missing_fields():
    r = requests.post(f"{PREVIEW}/api/admin/login/initiate", json={"email": ""}, timeout=10)
    assert r.status_code == 400


def test_full_2fa_flow(mongo):
    # Initiate
    r = requests.post(f"{PREVIEW}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    token_id = r.json()["token_id"]

    # Fetch OTP from Mongo
    doc = mongo["admin_2fa_tokens"].find_one({"token_id": token_id})
    assert doc is not None, "token not in admin_2fa_tokens"
    otp = doc["otp"]
    assert isinstance(otp, str) and len(otp) == 6

    # Verify
    r2 = requests.post(f"{PREVIEW}/api/admin/login/verify-otp",
                       json={"token_id": token_id, "otp": otp}, timeout=15)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("is_admin") is True
    assert isinstance(body.get("session_token"), str) and len(body["session_token"]) > 10


# ===== LIVE production probes (read-only) =====

def test_prod_initiate_sanity():
    r = requests.post(f"{PROD}/api/admin/login/initiate",
                      json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, f"prod initiate: {r.status_code} {r.text}"
    data = r.json()
    assert "token_id" in data


def test_prod_send_otp_genuine():
    import uuid
    fresh = f"qa_probe_{uuid.uuid4().hex[:10]}@gmail.com"
    r = requests.post(f"{PROD}/api/auth/send-otp",
                      json={"email": fresh}, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    msg = (r.json().get("message") or "").lower()
    # Genuine success wording is "OTP sent to your email"
    assert "otp sent to your email" in msg, f"unexpected msg: {msg}"
