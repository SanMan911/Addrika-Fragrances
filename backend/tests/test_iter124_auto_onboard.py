"""Iter124 — the AUTO-ONBOARD path, now that IDSPay returns real GST contacts.

Drives confirm-mode and update_mobile-mode straight through the route functions
with the mailer STUBBED, so a genuine third party (the GSTIN owner) is never
emailed by a test.

Asserts:
  * confirm  -> email=match + mobile=match -> register AUTO-APPROVES (status active)
  * update_mobile -> mobile=mismatch -> manual review + lands in the mismatch queue
  * a deferred GST certificate blocks auto-approval even on a perfect match

Run: cd /app/backend && python tests/test_iter124_auto_onboard.py
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

GSTIN = "27AAACR5055K1Z7"
CODE = "424242"

passed, failed = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"{'PASS' if ok else 'FAIL'} · {name}{(' — ' + detail) if detail and not ok else ''}")


class FakeReq:
    client = type("c", (), {"host": "127.0.0.1"})()
    headers: dict = {}
    cookies: dict = {}


class FakeResp:
    def set_cookie(self, *a, **k):
        pass


async def main() -> None:
    from dependencies import db
    import services.email_service as email_service
    from services import gst_email_otp as otp_mod
    from services import idspay_gst_contacts as idspay
    import routers.retailer_auth as ra

    # ---- never email the real GSTIN owner from a test ----
    sent_to: list[str] = []

    async def fake_send_email(to_email, subject, html_content=None, **kw):
        sent_to.append(to_email)
        return True

    email_service.send_email = fake_send_email  # type: ignore

    contacts = await idspay.fetch_contacts(GSTIN, use_cache=True)
    check("IDSPay returns a usable GST record", contacts.get("status") == "ok", str(contacts)[:200])
    if contacts.get("status") != "ok":
        print("\nIDSPay is not answering — cannot exercise the auto-onboard path.")
        sys.exit(1)
    gst_email = contacts.get("email")
    gst_mobile = contacts.get("mobile")
    check("record exposes an unmasked email", bool(gst_email))
    check("record exposes an unmasked mobile", bool(gst_mobile))

    async def clean():
        await db.retailers.delete_many({"gst_number": GSTIN})
        if gst_email:
            await db.retailers.delete_many({"email": gst_email.lower()})
        await db.gst_otp_challenges.delete_many({"gstin": GSTIN})
        await db.gst_onboarding_sessions.delete_many({"gstin": GSTIN})

    async def send_and_verify(mode: str, phone: str | None):
        req = ra.GstContactSendOtpRequest(
            gstin=GSTIN, mode=mode, email=None, phone=phone, country_code="+91"
        )
        res = await ra.gst_contact_send_otp(req, FakeReq())
        cid = res["challenge_id"]
        await db.gst_otp_challenges.update_one(
            {"challenge_id": cid}, {"$set": {"code_digest": otp_mod._digest(cid, CODE)}}
        )
        ver = await ra.gst_contact_verify_otp(
            ra.GstContactVerifyRequest(challenge_id=cid, code=CODE), FakeReq()
        )
        return res, ver

    async def register(session: str, phone: str, defer: bool, with_cert: bool):
        cert = None
        if with_cert:
            import io

            from fastapi import UploadFile
            from starlette.datastructures import Headers

            cert = UploadFile(
                filename="cert.pdf",
                file=io.BytesIO(b"%PDF-1.4 test"),
                headers=Headers({"content-type": "application/pdf"}),
            )
        return await ra.retailer_register(
            response=FakeResp(),
            business_name="Iter124 Auto Store",
            contact_name="Qa Tester",
            email=f"typed+{uuid.uuid4().hex[:6]}@centraders.com",
            country_code="+91",
            phone=phone,
            gst_number=GSTIN,
            password="Test@12345",
            city="Mumbai",
            state="Maharashtra",
            address="1 Test Road",
            pincode="400001",
            alternate_phone=None,
            alternate_email=None,
            onboarding_session=session,
            defer_gst_certificate="true" if defer else None,
            gst_certificate=cert,
        )

    # ================= 1. confirm -> AUTO-ONBOARD =================
    await clean()
    res, ver = await send_and_verify("confirm", None)
    check("confirm mode targets the GST-registered email", res["target"] == "gst_email", str(res)[:150])
    check("the OTP went to the GST email", sent_to and sent_to[-1].lower() == gst_email.lower(), str(sent_to[-1:]))
    check("confirm mode reports no mismatch", res["mismatch"] is False, str(res)[:150])
    sess = ver["onboarding_session"]
    meta = (await db.gst_onboarding_sessions.find_one({"session_id": sess}) or {}).get("meta") or {}
    check("verdict email=match", meta.get("email") == "match", str(meta)[:200])
    check("verdict mobile=match", meta.get("mobile") == "match", str(meta)[:200])

    out = await register(sess, ver.get("mobile") or gst_mobile[-10:], defer=False, with_cert=True)
    check("perfect match + certificate -> AUTO-ONBOARDED", out.get("auto_onboarded") is True, str(out)[:250])
    doc = await db.retailers.find_one({"gst_number": GSTIN})
    check("auto-onboarded retailer is ACTIVE", doc.get("status") == "active", str(doc.get("status")))
    check("no manual review reason", doc.get("manual_review_reason") in (None, ""), str(doc.get("manual_review_reason")))
    check(
        "identity is the GST-registered email",
        (doc.get("email") or "").lower() == gst_email.lower(),
        str(doc.get("email")),
    )

    # ================= 2. confirm + deferred cert -> manual review =================
    await clean()
    res, ver = await send_and_verify("confirm", None)
    out = await register(ver["onboarding_session"], gst_mobile[-10:], defer=True, with_cert=False)
    check("perfect match but NO certificate -> NOT auto-onboarded", out.get("auto_onboarded") is False, str(out)[:250])
    doc = await db.retailers.find_one({"gst_number": GSTIN})
    check("deferred-cert retailer is under_processing", doc.get("status") == "under_processing", str(doc.get("status")))
    check(
        "reason names the missing certificate",
        "certificate" in (doc.get("manual_review_reason") or "").lower(),
        str(doc.get("manual_review_reason")),
    )

    # ================= 3. update_mobile -> mismatch + review queue =================
    await clean()
    res, ver = await send_and_verify("update_mobile", "9123456780")
    check("update_mobile still mails the GST email", res["target"] == "gst_email", str(res)[:150])
    check("update_mobile flags a mismatch", res["mismatch"] is True, str(res)[:150])
    check("update_mobile is recorded as a declared change", res["mobile_change_declared"] is True, str(res)[:150])
    sess = ver["onboarding_session"]
    meta = (await db.gst_onboarding_sessions.find_one({"session_id": sess}) or {}).get("meta") or {}
    check("verdict mobile=mismatch", meta.get("mobile") == "mismatch", str(meta)[:200])
    check("verdict email stays match", meta.get("email") == "match", str(meta)[:200])

    out = await register(sess, "9123456780", defer=False, with_cert=True)
    check("declared mobile change -> NOT auto-onboarded", out.get("auto_onboarded") is False, str(out)[:250])
    doc = await db.retailers.find_one({"gst_number": GSTIN})
    check("retailer held for review", doc.get("status") == "under_processing", str(doc.get("status")))
    check(
        "reason names the mobile",
        "mobile" in (doc.get("manual_review_reason") or "").lower(),
        str(doc.get("manual_review_reason")),
    )
    mm = await db.retailers.find_one(
        {"gst_number": GSTIN, "gst_contact_mismatch": True, "gst_contact_mismatch_reviewed": False}
    )
    check("mismatch landed in the admin review queue", mm is not None, "retailer not flagged for review")
    check("the new mobile was saved, not the GST one", doc.get("phone") == "9123456780", str(doc.get("phone")))

    await clean()
    print(f"\n{len(passed)} passed / {len(failed)} failed")
    if failed:
        print("FAILED: " + ", ".join(failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
