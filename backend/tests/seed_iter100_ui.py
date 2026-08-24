"""Seed helper for iteration-100 UI testing.

Creates (idempotently):
  • a self-registered retailer with status=under_processing and a known password
  • prints an admin session token obtained via the real 2FA flow
"""
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests
from dotenv import dotenv_values, load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
next_env = dotenv_values("/app/frontend-next/.env.local")
BASE_URL = next_env["NEXT_PUBLIC_BACKEND_URL"].rstrip("/")

RETAILER_EMAIL = "test_iter100_ui@example.com"
RETAILER_PASSWORD = "TestPass@12345"
RETAILER_ID = "RTL_ITER100UI"

ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def seed_retailer():
    from services.auth_service import hash_password

    mc = MongoClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "retailer_id": RETAILER_ID,
        "business_name": "TEST Iter100 UI Traders",
        "contact_name": "TEST UI Contact",
        "name": "TEST UI Contact",
        "email": RETAILER_EMAIL,
        "phone": "9876500099",
        "country_code": "+91",
        "gst_number": "07AAACT2727Q1ZW",
        "gst_verified": True,
        "city": "Delhi",
        "state": "Delhi",
        "pincode": "110001",
        "address": "1 Test Street",
        "status": "under_processing",
        "admin_notes": [],
        "password_hash": hash_password(RETAILER_PASSWORD),
        "created_at": now,
        "self_registered": True,
        "gst_certificate": {
            "storage_path": "kyc/gst-cert/seeded.pdf",
            "original_filename": "seeded-cert.pdf",
            "content_type": "application/pdf",
            "size": 100,
            "uploaded_at": now,
            "is_deleted": False,
        },
    }
    db.retailers.update_one({"retailer_id": RETAILER_ID}, {"$set": doc}, upsert=True)
    print(f"RETAILER_SEEDED {RETAILER_ID} {RETAILER_EMAIL} / {RETAILER_PASSWORD}")
    mc.close()


def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    r.raise_for_status()
    token_id = r.json()["token_id"]
    mc = MongoClient(os.environ["MONGO_URL"])
    row = mc[os.environ["DB_NAME"]].admin_2fa_tokens.find_one({"email": ADMIN_EMAIL})
    mc.close()
    otp = row["otp"]
    r2 = s.post(
        f"{BASE_URL}/api/admin/login/verify-otp",
        json={"token_id": token_id, "otp": otp, "email": ADMIN_EMAIL},
        timeout=30,
    )
    r2.raise_for_status()
    body = r2.json()
    token = body.get("session_token") or s.cookies.get("session_token")
    print(f"ADMIN_SESSION_TOKEN {token}")
    return token


def retailer_login_check():
    r = requests.post(
        f"{BASE_URL}/api/retailer-auth/login",
        json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD},
        timeout=30,
    )
    print("RETAILER_LOGIN", r.status_code, r.text[:300])
    if r.status_code == 200:
        print("RETAILER_TOKEN", r.json()["token"])
        print("RETAILER_STATUS", r.json()["retailer"]["status"])


if __name__ == "__main__":
    seed_retailer()
    retailer_login_check()
    admin_session()
