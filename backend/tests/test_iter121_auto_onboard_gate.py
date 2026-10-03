"""Iter121d — auto-onboard gate: active ONLY when both contacts match AND email OTP verified."""
import asyncio
import os
import subprocess
import sys

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

GST = "27AAACR5055K1Z7"
CERT = "/tmp/iter121_cert.pdf"
PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"{'PASS' if cond else 'FAIL'} — {name}{(' :: ' + str(extra)) if extra and not cond else ''}")


async def make_session(meta):
    """Mint a genuinely verified onboarding session carrying `meta`."""
    from dependencies import db
    from services import gst_email_otp as otp
    import services.email_service as es

    async def ok(*a, **k):
        return True

    es.send_email = ok
    await db.gst_otp_challenges.delete_many({})
    await db.gst_onboarding_sessions.delete_many({})
    iss = await otp.issue_otp(GST, "owner@realbiz.com", ip="1.1.1.1", meta=meta)
    code = "424242"
    await db.gst_otp_challenges.update_one(
        {"challenge_id": iss["challenge_id"]},
        {"$set": {"code_digest": otp._digest(iss["challenge_id"], code)}},
    )
    v = await otp.verify_otp(iss["challenge_id"], code)
    assert v["ok"], v
    return v["onboarding_session"]


async def drop_retailer():
    from dependencies import db
    await db.retailers.delete_many({"gst_number": GST})


def register(session):
    out = subprocess.run([
        "curl", "-s", "-X", "POST", "http://localhost:8001/api/retailer-auth/register",
        "-F", "business_name=Gate Test Store", "-F", "contact_name=Gate Tester",
        "-F", "email=owner@realbiz.com", "-F", "country_code=+91", "-F", "phone=9876543210",
        "-F", f"gst_number={GST}", "-F", "password=Test@12345",
        "-F", f"onboarding_session={session}",
        "-F", f"gst_certificate=@{CERT};type=application/pdf",
    ], capture_output=True, text=True).stdout
    import json
    try:
        return json.loads(out)
    except Exception:
        return {"_raw": out[:300]}


async def main():
    from dependencies import db
    with open(CERT, "wb") as f:
        f.write(b"%PDF-1.4 iter121 gate test")

    MATCH_BOTH = {"email": "match", "mobile": "match", "any_mismatch": False,
                  "entered_email": "owner@realbiz.com", "entered_mobile": "9876543210",
                  "gst_email": "owner@realbiz.com", "gst_mobile": "919876543210"}
    PARTIAL = {"email": "match", "mobile": "mismatch", "any_mismatch": True,
               "entered_email": "owner@realbiz.com", "entered_mobile": "9000000000",
               "gst_email": "owner@realbiz.com", "gst_mobile": "919876543210"}

    # ---- CASE 1: both match + OTP verified => AUTO-ONBOARDED (active) ----
    await drop_retailer()
    sess = await make_session(MATCH_BOTH)
    res = register(sess)
    check("both-match + OTP => auto_onboarded", res.get("auto_onboarded") is True, res)
    check("both-match => status active", (res.get("retailer") or {}).get("status") == "active", res)
    doc = await db.retailers.find_one({"gst_number": GST})
    check("DB status active", doc and doc.get("status") == "active", doc and doc.get("status"))
    check("onboarding_mode=auto_idspay", doc and doc.get("onboarding_mode") == "auto_idspay", doc and doc.get("onboarding_mode"))
    check("no mismatch flag on a clean match", doc and doc.get("gst_contact_mismatch") is False, doc and doc.get("gst_contact_mismatch"))
    check("manual_review_reason empty", doc and doc.get("manual_review_reason") is None, doc and doc.get("manual_review_reason"))

    # ---- CASE 2: mobile differs (OTP still verified) => MANUAL REVIEW ----
    await drop_retailer()
    sess = await make_session(PARTIAL)
    res = register(sess)
    check("partial-match => NOT auto_onboarded", res.get("auto_onboarded") is False, res)
    check("partial-match => status under_processing",
          (res.get("retailer") or {}).get("status") == "under_processing", res)
    doc = await db.retailers.find_one({"gst_number": GST})
    check("DB status under_processing", doc and doc.get("status") == "under_processing", doc and doc.get("status"))
    check("onboarding_mode=manual_review", doc and doc.get("onboarding_mode") == "manual_review", doc and doc.get("onboarding_mode"))
    check("mismatch flagged for the queue", doc and doc.get("gst_contact_mismatch") is True, doc and doc.get("gst_contact_mismatch"))
    check("queue starts unreviewed", doc and doc.get("gst_contact_mismatch_reviewed") is False, doc and doc.get("gst_contact_mismatch_reviewed"))
    check("reason names the mobile", doc and "mobile" in (doc.get("manual_review_reason") or ""), doc and doc.get("manual_review_reason"))
    check("entered-vs-record kept", doc and (doc.get("gst_contact_check") or {}).get("gst_mobile") == "919876543210",
          doc and doc.get("gst_contact_check"))

    # ---- CASE 3: no IDSPay session at all (wallet/IP down) => manual review, any contact allowed ----
    await drop_retailer()
    from services.phone_otp import to_e164, _hash_code  # noqa
    # Mark the phone verified the same way the SMS flow does, then register with NO session.
    from services import phone_otp
    e164 = phone_otp.to_e164("+91", "9000000001")
    send = await phone_otp.send_otp(e164)
    code = send.get("dev_code")
    await phone_otp.verify_otp(e164, code)
    out = subprocess.run([
        "curl", "-s", "-X", "POST", "http://localhost:8001/api/retailer-auth/register",
        "-F", "business_name=Manual Fallback Store", "-F", "contact_name=Manual Tester",
        "-F", "email=anything.i.want@example.com", "-F", "country_code=+91", "-F", "phone=9000000001",
        "-F", f"gst_number={GST}", "-F", "password=Test@12345",
        "-F", f"gst_certificate=@{CERT};type=application/pdf",
    ], capture_output=True, text=True).stdout
    import json
    res = json.loads(out) if out.strip().startswith("{") else {"_raw": out[:300]}
    check("no-IDSPay path still registers (any email/mobile allowed)",
          (res.get("retailer") or {}).get("retailer_id") is not None, res)
    check("no-IDSPay => NOT auto_onboarded", res.get("auto_onboarded") is False, res)
    doc = await db.retailers.find_one({"gst_number": GST})
    check("no-IDSPay => under_processing (manual approval)", doc and doc.get("status") == "under_processing", doc and doc.get("status"))
    check("no-IDSPay => arbitrary email accepted as-is",
          doc and doc.get("email") == "anything.i.want@example.com", doc and doc.get("email"))
    check("no-IDSPay => no false mismatch flag", doc and not doc.get("gst_contact_mismatch"), doc and doc.get("gst_contact_mismatch"))
    check("no-IDSPay reason mentions OTP not completed",
          doc and "OTP not completed" in (doc.get("manual_review_reason") or ""), doc and doc.get("manual_review_reason"))

    # cleanup
    await drop_retailer()
    await db.gst_otp_challenges.delete_many({})
    await db.gst_onboarding_sessions.delete_many({})
    os.remove(CERT)

    print(f"\n{'=' * 60}\nPASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    for f in FAIL:
        print("  -", f)
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
