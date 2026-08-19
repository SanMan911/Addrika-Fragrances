"""Idempotent seed for the test B2B retailer used by the pytest suite.

Ensures the `test_b2b_retailer@example.com / Test@12345` account with
retailer_id `RTL_TEST_B2B` exists and is active on every backend boot,
so tests that authenticate via `/api/retailer-auth/login` stop skipping.

Password is hashed via the same `hash_password` used everywhere else —
we never write plaintext.  Idempotent: if the account already exists
the seed only patches missing fields (`status`, `password_hash` if
absent) instead of rewriting the row.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TEST_B2B_EMAIL = "test_b2b_retailer@example.com"
TEST_B2B_USERNAME = "test_b2b_retailer"
TEST_B2B_RETAILER_ID = "RTL_TEST_B2B"
TEST_B2B_PASSWORD_ENV = "TEST_B2B_RETAILER_PASSWORD"
TEST_B2B_PASSWORD_DEFAULT = "Test@12345"


async def seed_test_b2b_retailer(db) -> None:
    """Ensure the pytest-only B2B retailer exists and can log in.

    Enabled ONLY when `SEED_TEST_B2B_RETAILER=1`. Default is off so a
    production deploy that forgets to override the env var can never
    end up with a live retailer using a known password.
    """
    if os.environ.get("SEED_TEST_B2B_RETAILER") != "1":
        return

    from services.auth_service import hash_password

    password = os.environ.get(TEST_B2B_PASSWORD_ENV) or TEST_B2B_PASSWORD_DEFAULT
    now = datetime.now(timezone.utc).isoformat()

    existing = await db.retailers.find_one({"email": TEST_B2B_EMAIL})
    if existing is None:
        retailer = {
            "id": str(uuid.uuid4()),
            "retailer_id": TEST_B2B_RETAILER_ID,
            "business_name": "Test B2B Retailer (Automated)",
            "trade_name": "Test B2B Retailer",
            "gst_number": "07AAAAA0000A1Z5",
            "gst_state_code": "07",
            "username": TEST_B2B_USERNAME,
            "email": TEST_B2B_EMAIL,
            "phone_country_code": "+91",
            "phone": "9999999999",
            "whatsapp_country_code": "+91",
            "whatsapp": "9999999999",
            "name": "Test B2B Retailer",  # login response uses `name` directly
            "registered_address": "Test Address, Delhi",
            "city": "Delhi",
            "district": "New Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "coordinates": None,
            "spoc": {
                "name": "Test SPOC",
                "email": TEST_B2B_EMAIL,
                "phone": "9999999999",
            },
            "legal_documents": {
                "gst_certificate": None,
                "gst_certificate_uploaded_at": None,
                "gst_certificate_valid_until": None,
                "business_registration": None,
                "trade_license": None,
                "other_documents": [],
            },
            "password_hash": hash_password(password),
            "status": "active",
            "is_verified": True,
            "gst_verified": True,
            "documents_complete": True,
            "total_orders_handled": 0,
            "total_pickups_completed": 0,
            "total_revenue": 0.0,
            "is_test_account": True,
            "created_at": now,
            "updated_at": now,
            "created_by": "system:seed_test_b2b_retailer",
            "last_updated_by": "system:seed_test_b2b_retailer",
        }
        await db.retailers.insert_one(retailer)
        logger.info("Seeded test B2B retailer %s", TEST_B2B_RETAILER_ID)
        # Best-effort mirror
        try:
            from services.supabase_sync import mirror_user_upsert
            mirror_user_upsert(retailer, kind="b2b")
        except Exception:  # noqa: BLE001
            pass
        return

    # Existing row — heal missing/broken fields so login always works
    patch: dict = {}
    if existing.get("status") in (None, "pending_verification", "suspended", "deleted"):
        patch["status"] = "active"
    if not existing.get("password_hash"):
        patch["password_hash"] = hash_password(password)
    if not existing.get("username"):
        patch["username"] = TEST_B2B_USERNAME
    if not existing.get("name"):
        patch["name"] = "Test B2B Retailer"
    if existing.get("retailer_id") != TEST_B2B_RETAILER_ID:
        patch["retailer_id"] = TEST_B2B_RETAILER_ID
    if patch:
        patch["updated_at"] = now
        patch["last_updated_by"] = "system:seed_test_b2b_retailer"
        await db.retailers.update_one({"email": TEST_B2B_EMAIL}, {"$set": patch})
        logger.info("Healed test B2B retailer (%s)", ", ".join(sorted(patch)))
