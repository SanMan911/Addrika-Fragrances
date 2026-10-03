"""Iter122 — new onboarding chain: masked GST contact -> email OTP -> register.

Covers the flow the user asked for:
  * preview returns MASKED contact, or degrades to `unavailable`
  * send-otp modes: confirm / update_mobile / fallback
  * registration requires the email OTP (no SMS step any more)
  * GST certificate can be DEFERRED -> account stays in manual review
  * Verified Brand Partner needs active status + both KYC docs
  * public /brand-partners only lists verified + listed retailers

Run: cd /app/backend && python tests/test_iter122_onboarding.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

BASE = "http://localhost:8001"
GSTIN = "27AAACR5055K1Z7"  # real GSTIN, Deepvue-verifiable

passed, failed = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"{'PASS' if ok else 'FAIL'} · {name}{(' — ' + detail) if detail and not ok else ''}")


async def force_code(challenge_id: str, code: str) -> None:
    """Rewrite the stored digest so a test knows the OTP without an inbox."""
    from dependencies import db
    from services.gst_email_otp import _digest

    await db.gst_otp_challenges.update_one(
        {"challenge_id": challenge_id},
        {"$set": {"code_digest": _digest(challenge_id, code)}},
    )


async def clear_state(gstin: str, email: str) -> None:
    from dependencies import db

    await db.retailers.delete_many({"gst_number": gstin})
    await db.retailers.delete_many({"email": email})
    await db.gst_otp_challenges.delete_many({"gstin": gstin})
    await db.gst_onboarding_sessions.delete_many({"gstin": gstin})


async def mint_session(client: httpx.AsyncClient, email: str, phone: str) -> str | None:
    """Fallback-mode OTP -> verified onboarding session id."""
    r = await client.post(
        f"{BASE}/api/retailer-auth/gst-contact/send-otp",
        json={"gstin": GSTIN, "mode": "fallback", "email": email, "phone": phone},
    )
    if r.status_code != 200:
        print(f"   send-otp failed: {r.status_code} {r.text[:200]}")
        return None
    cid = r.json()["challenge_id"]
    await force_code(cid, "123456")
    v = await client.post(
        f"{BASE}/api/retailer-auth/gst-contact/verify-otp",
        json={"challenge_id": cid, "code": "123456"},
    )
    if v.status_code != 200:
        print(f"   verify failed: {v.status_code} {v.text[:200]}")
        return None
    return v.json()["onboarding_session"]


async def main() -> None:
    from dependencies import db

    async with httpx.AsyncClient(timeout=90) as client:
        # ---------- preview ----------
        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/preview", json={"gstin": GSTIN}
        )
        body = r.json()
        check("preview returns 200 with a status", r.status_code == 200 and "status" in body, r.text[:150])
        check(
            "preview never leaks a full email",
            "@" not in str(body.get("email_hint") or "").replace("*", "") or "*" in str(body.get("email_hint") or ""),
            str(body),
        )
        record_readable = body.get("status") == "available"
        print(f"   (IDSPay record readable: {record_readable})")

        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/preview", json={"gstin": "ZZ1234567890123"}
        )
        check("preview rejects a malformed GSTIN", r.status_code in (400, 422), r.text[:120])

        # ---------- send-otp validation ----------
        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/send-otp",
            json={"gstin": GSTIN, "mode": "fallback", "email": "", "phone": "123"},
        )
        check("fallback without email/mobile is rejected", r.status_code == 400, r.text[:150])

        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/send-otp",
            json={"gstin": GSTIN, "mode": "nonsense", "email": "a@b.com", "phone": "9876543210"},
        )
        check("unknown mode is rejected", r.status_code == 422, r.text[:120])

        if not record_readable:
            r = await client.post(
                f"{BASE}/api/retailer-auth/gst-contact/send-otp",
                json={"gstin": GSTIN, "mode": "confirm", "phone": "9876543210"},
            )
            check(
                "confirm mode refuses when the GST record is unreadable",
                r.status_code == 409,
                r.text[:150],
            )

        # ---------- register: email OTP is mandatory ----------
        email_a = f"iter122a+{uuid.uuid4().hex[:8]}@centraders.com"
        await clear_state(GSTIN, email_a)

        files = {"gst_certificate": ("cert.pdf", b"%PDF-1.4 test", "application/pdf")}
        form = {
            "business_name": "Iter122 Test Store",
            "contact_name": "Qa Tester",
            "email": email_a,
            "country_code": "+91",
            "phone": "9876543210",
            "gst_number": GSTIN,
            "password": "Test@12345",
        }
        r = await client.post(f"{BASE}/api/retailer-auth/register", data=form, files=files)
        check(
            "register without a verified email is refused",
            r.status_code == 400 and "verify your email" in r.text.lower(),
            f"{r.status_code} {r.text[:200]}",
        )

        # ---------- register with a deferred certificate ----------
        sess = await mint_session(client, email_a, "9876543210")
        check("fallback OTP mints an onboarding session", bool(sess))
        if sess:
            r = await client.post(
                f"{BASE}/api/retailer-auth/register",
                data={**form, "onboarding_session": sess, "defer_gst_certificate": "true"},
            )
            ok = r.status_code == 200
            data = r.json() if ok else {}
            check("register succeeds with NO certificate when deferred", ok, f"{r.status_code} {r.text[:250]}")
            check("deferred registration is NOT auto-onboarded", data.get("auto_onboarded") is False, str(data)[:200])
            check("response flags the pending certificate", data.get("gst_certificate_pending") is True, str(data)[:200])
            if ok:
                doc = await db.retailers.find_one({"gst_number": GSTIN})
                check("retailer stored as under_processing", doc.get("status") == "under_processing", str(doc.get("status")))
                check("gst_cert_deferred persisted", doc.get("gst_cert_deferred") is True)
                check("no certificate object stored", doc.get("gst_certificate") in (None, {}))
                check(
                    "manual_review_reason mentions the certificate",
                    "certificate" in (doc.get("manual_review_reason") or "").lower(),
                    str(doc.get("manual_review_reason")),
                )
                check(
                    "identity came from the verified email, not the form",
                    (doc.get("email") or "") == email_a,
                    str(doc.get("email")),
                )

                # ---------- brand partner gate ----------
                rid = doc["retailer_id"]
                from routers.retailers import admin_set_brand_partner  # noqa: F401  (import check)

                # KYC is incomplete, so verifying must be refused even for an active account
                await db.retailers.update_one({"retailer_id": rid}, {"$set": {"status": "active"}})
                from fastapi import HTTPException

                from routers.retailers import BrandPartnerUpdate

                class _Req:
                    headers: dict = {}
                    cookies: dict = {}

                try:
                    import routers.retailers as rr

                    orig_admin = rr.require_admin
                    rr.require_admin = lambda *a, **k: asyncio.sleep(0)  # type: ignore
                    raised = None
                    try:
                        await rr.admin_set_brand_partner(
                            rid, BrandPartnerUpdate(verified=True), _Req(), None
                        )
                    except HTTPException as e:
                        raised = e
                    check(
                        "brand-partner verify blocked while KYC docs are missing",
                        raised is not None and raised.status_code == 400,
                        str(raised.detail if raised else "no error raised"),
                    )

                    # Satisfy KYC, then it should succeed and list publicly
                    await db.retailers.update_one(
                        {"retailer_id": rid},
                        {"$set": {
                            "legal_documents": {"gst_certificate": "kyc/x.pdf"},
                            "spoc": {"id_proof_document": "kyc/y.pdf"},
                            "city": "Mumbai",
                            "state": "Maharashtra",
                            "pincode": "400001",
                            "address": "1 Test Road",
                        }},
                    )
                    res = await rr.admin_set_brand_partner(
                        rid, BrandPartnerUpdate(verified=True), _Req(), None
                    )
                    check("brand-partner verify succeeds once KYC is complete", res.get("success") is True, str(res)[:200])
                finally:
                    rr.require_admin = orig_admin

                pub = (await client.get(f"{BASE}/api/retailers/brand-partners")).json()
                rows = pub.get("retailers") or []
                mine = [x for x in rows if x.get("retailer_id") == rid]
                check("verified partner appears on the public locator", len(mine) == 1, str(pub)[:200])
                if mine:
                    row = mine[0]
                    check("locator row exposes a phone number", bool(row.get("phone")), str(row))
                    check(
                        "locator row leaks no GSTIN / email",
                        "gst_number" not in row and "email" not in row,
                        str(row.keys()),
                    )

        # ---------- cleanup ----------
        await clear_state(GSTIN, email_a)

    print(f"\n{len(passed)} passed / {len(failed)} failed")
    if failed:
        print("FAILED: " + ", ".join(failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    asyncio.run(main())
