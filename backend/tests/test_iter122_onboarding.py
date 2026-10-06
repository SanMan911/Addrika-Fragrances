"""Iter122 — HTTP-level contract tests for the new onboarding chain.

Scope deliberately limited to paths that send NO email, so running this never
spams the real owner of the GSTIN under test. The full
send-OTP -> verify -> register -> auto-onboard chain lives in
`test_iter124_auto_onboard.py`, which stubs the mailer.

Covers:
  * `/gst-contact/preview` returns MASKED contact, or degrades to `unavailable`
  * `/gst-contact/send-otp` input validation + the both-contacts-wrong deny rule
  * `/register` refuses to run without a verified email session (no more SMS OTP)
  * Verified Brand Partner requires active status + both KYC docs
  * public `/brand-partners` only lists verified + listed retailers, phone included,
    and never leaks GSTIN / email

Run: cd /app/backend && python tests/test_iter122_onboarding.py
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

BASE = "http://localhost:8001"
GSTIN = "27AAACR5055K1Z7"  # real GSTIN, Deepvue + IDSPay resolvable

passed, failed = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"{'PASS' if ok else 'FAIL'} · {name}{(' — ' + detail) if detail and not ok else ''}")


async def main() -> None:
    from dependencies import db
    from services import idspay_gst_contacts as idspay

    async def clean():
        await db.retailers.delete_many({"gst_number": GSTIN})
        await db.gst_otp_challenges.delete_many({"gstin": GSTIN})
        await db.gst_onboarding_sessions.delete_many({"gstin": GSTIN})

    await clean()
    record = await idspay.fetch_contacts(GSTIN)
    readable = record.get("status") == "ok" and bool(record.get("email"))
    print(f"   (IDSPay record readable: {readable})")

    async with httpx.AsyncClient(timeout=90) as client:
        # ---------------- preview ----------------
        r = await client.post(f"{BASE}/api/retailer-auth/gst-contact/preview", json={"gstin": GSTIN})
        body = r.json()
        check("preview returns 200 with a status", r.status_code == 200 and "status" in body, r.text[:150])
        if readable:
            check("preview reports the record as available", body.get("status") == "available", str(body))
            hint = str(body.get("email_hint") or "")
            check("the email is MASKED, never returned in full", "*" in hint, hint)
            check(
                "masked email keeps only the domain readable",
                hint.split("@")[-1] == (record["email"] or "").split("@")[-1].lower(),
                hint,
            )
            mob = str(body.get("mobile_hint") or "")
            check("the mobile is MASKED", "*" in mob, mob)
            check("preview never returns an unmasked contact", record["email"] not in r.text, "leaked")
        else:
            check(
                "an IDSPay/account failure degrades to `unavailable`, not an error",
                body.get("status") in ("unavailable", "email_unavailable"),
                str(body),
            )

        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/preview", json={"gstin": "ZZ1234567890123"}
        )
        check("preview rejects a malformed GSTIN", r.status_code in (400, 422), r.text[:120])

        # ---------------- send-otp validation (no email leaves the system) ----------------
        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/send-otp",
            json={"gstin": GSTIN, "mode": "fallback", "email": "", "phone": "123"},
        )
        check(
            "an empty fallback form is a 400 (missing field), never a scary 403",
            r.status_code == 400,
            f"{r.status_code} {r.text[:150]}",
        )

        r = await client.post(
            f"{BASE}/api/retailer-auth/gst-contact/send-otp",
            json={"gstin": GSTIN, "mode": "nonsense", "email": "a@b.com", "phone": "9876543210"},
        )
        check("an unknown mode is rejected", r.status_code == 422, r.text[:120])

        if readable:
            # Both typed values contradict the GST record -> registration denied.
            r = await client.post(
                f"{BASE}/api/retailer-auth/gst-contact/send-otp",
                json={
                    "gstin": GSTIN,
                    "mode": "fallback",
                    "email": "definitely-not-the-owner@example.com",
                    "phone": "9000000001",
                },
            )
            check(
                "a wrong mobile AND wrong email is denied (403)",
                r.status_code == 403,
                f"{r.status_code} {r.text[:150]}",
            )
            check("the denial is recorded for audit", await db.gst_contact_denials.find_one({"gstin": GSTIN}) is not None)
            await db.gst_contact_denials.delete_many({"gstin": GSTIN})
        else:
            r = await client.post(
                f"{BASE}/api/retailer-auth/gst-contact/send-otp",
                json={"gstin": GSTIN, "mode": "confirm", "phone": "9876543210"},
            )
            check(
                "confirm mode refuses when the GST record is unreadable",
                r.status_code == 409,
                r.text[:150],
            )

        # ---------------- register demands the email OTP (the SMS step is gone) ----------------
        files = {"gst_certificate": ("cert.pdf", b"%PDF-1.4 test", "application/pdf")}
        form = {
            "business_name": "Iter122 Test Store",
            "contact_name": "Qa Tester",
            "email": f"iter122+{uuid.uuid4().hex[:8]}@centraders.com",
            "country_code": "+91",
            "phone": "9876543210",
            "gst_number": GSTIN,
            "password": "Test@12345",
        }
        r = await client.post(f"{BASE}/api/retailer-auth/register", data=form, files=files)
        check(
            "register without a verified email session is refused",
            r.status_code == 400 and "verify your email" in r.text.lower(),
            f"{r.status_code} {r.text[:200]}",
        )

        # ---------------- Verified Brand Partner gate + public locator ----------------
        # Seeded straight into Mongo: the registration chain itself is covered by
        # iter124, and going through it here would email the real GSTIN owner.
        rid = f"RTL_ITER122{uuid.uuid4().hex[:4].upper()}"
        await db.retailers.insert_one({
            "retailer_id": rid,
            "gst_number": GSTIN,
            "business_name": "Iter122 Locator Store",
            "contact_name": "Qa Tester",
            "email": f"iter122loc+{uuid.uuid4().hex[:6]}@centraders.com",
            "phone": "9876543210",
            "country_code": "+91",
            "address": "1 Test Road",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "status": "under_processing",
            "gst_cert_deferred": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        import routers.retailers as rr
        from fastapi import HTTPException

        class _Req:
            headers: dict = {}
            cookies: dict = {}

        orig_admin = rr.require_admin
        rr.require_admin = lambda *a, **k: asyncio.sleep(0)  # type: ignore
        try:
            # (a) not active yet
            raised = None
            try:
                await rr.admin_set_brand_partner(rid, rr.BrandPartnerUpdate(verified=True), _Req(), None)
            except HTTPException as e:
                raised = e
            check(
                "brand-partner verify blocked while the account is not active",
                raised is not None and raised.status_code == 400,
                str(raised.detail if raised else "no error raised"),
            )

            # (b) active, but the KYC documents are still missing
            await db.retailers.update_one({"retailer_id": rid}, {"$set": {"status": "active"}})
            raised = None
            try:
                await rr.admin_set_brand_partner(rid, rr.BrandPartnerUpdate(verified=True), _Req(), None)
            except HTTPException as e:
                raised = e
            check(
                "brand-partner verify blocked while KYC docs are missing",
                raised is not None and raised.status_code == 400,
                str(raised.detail if raised else "no error raised"),
            )

            pub = (await client.get(f"{BASE}/api/retailers/brand-partners")).json()
            check(
                "an unverified retailer is NOT on the public locator",
                all(x.get("retailer_id") != rid for x in pub.get("retailers", [])),
                str(pub)[:200],
            )

            # (c) KYC complete -> verification succeeds
            await db.retailers.update_one(
                {"retailer_id": rid},
                {"$set": {
                    "legal_documents": {"gst_certificate": "kyc/x.pdf"},
                    "spoc": {"id_proof_document": "kyc/y.pdf"},
                }},
            )
            res = await rr.admin_set_brand_partner(rid, rr.BrandPartnerUpdate(verified=True), _Req(), None)
            check("brand-partner verify succeeds once KYC is complete", res.get("success") is True, str(res)[:200])

            pub = (await client.get(f"{BASE}/api/retailers/brand-partners")).json()
            mine = [x for x in pub.get("retailers", []) if x.get("retailer_id") == rid]
            check("verified partner appears on the public locator", len(mine) == 1, str(pub)[:250])
            if mine:
                row = mine[0]
                check("locator row exposes a phone number", bool(row.get("phone")), str(row))
                check("locator row carries the verified flag", row.get("verified_brand_partner") is True, str(row))
                check("locator row has coordinates for the map", bool(row.get("coordinates")), str(row))
                check(
                    "locator row leaks no GSTIN / email / KYC",
                    not any(k in row for k in ("gst_number", "email", "kyc", "legal_documents", "spoc")),
                    str(list(row.keys())),
                )

            # (d) revoking takes it straight back off the locator
            await rr.admin_set_brand_partner(rid, rr.BrandPartnerUpdate(verified=False), _Req(), None)
            pub = (await client.get(f"{BASE}/api/retailers/brand-partners")).json()
            check(
                "revoking removes the store from the public locator",
                all(x.get("retailer_id") != rid for x in pub.get("retailers", [])),
                str(pub)[:200],
            )
        finally:
            rr.require_admin = orig_admin

        await clean()

    print(f"\n{len(passed)} passed / {len(failed)} failed")
    if failed:
        print("FAILED: " + ", ".join(failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
