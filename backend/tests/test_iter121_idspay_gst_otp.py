"""Iter121 — IDSPay GST-to-contact + email-OTP ownership chain.

IDSPay credentials are placeholders in this environment, so the HTTP call is
simulated at the httpx layer. That still exercises the real nested-status
parsing, mask detection, caching, OTP issue/verify and session binding.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

import httpx

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"{'PASS' if cond else 'FAIL'} — {name}{(' :: ' + str(extra)) if extra and not cond else ''}")


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    @property
    def is_success(self):
        return 200 <= self.status_code < 300

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


def install_fake_http(payload, status_code=200, capture=None):
    async def fake_post(self, url, **kwargs):
        if capture is not None:
            capture.append({"url": url, "json": kwargs.get("json")})
        return FakeResponse(status_code, payload)

    httpx.AsyncClient.post = fake_post


_ORIGINAL_POST = httpx.AsyncClient.post


def ok_payload(mobile, email):
    return {
        "status": {"code": 200, "type": "success", "message": "Details fetched successfully."},
        "message": "Details fetched successfully.",
        "data": {"mobile": mobile, "email": email},
    }


async def main():
    from dependencies import db
    from services import idspay_gst_contacts as idspay
    from services import gst_email_otp as otp
    import services.email_service as email_service

    # Capture the OTP instead of emailing it
    sent_codes = []

    async def fake_send_email(to, subject, html, **kw):
        import re
        m = re.search(r"letter-spacing:8px;margin:0\">(\d{6})<", html)
        sent_codes.append({"to": to, "code": m.group(1) if m else None, "subject": subject})
        return True

    email_service.send_email = fake_send_email

    GST = "27AAACR5055K1Z7"
    GST2 = "29AAAAA0000A1Z5"

    async def clean():
        await db.idspay_contact_cache.delete_many({})
        await db.gst_otp_challenges.delete_many({})
        await db.gst_onboarding_sessions.delete_many({})
        sent_codes.clear()

    # ---------- 1. not configured (simulate placeholder keys) ----------
    await clean()
    _saved = {k: os.environ.get(k) for k in ("IDSPAY_API_ID", "IDSPAY_API_KEY", "IDSPAY_TOKEN_ID")}
    for k in _saved:
        os.environ[k] = f"REPLACE_WITH_{k}"
    res = await idspay.fetch_contacts(GST)
    check("placeholder keys => not_configured", res["status"] == "not_configured", res)
    check("is_configured() False with placeholders", idspay.is_configured() is False)

    # token_id is optional (IP-bound); api_id + api_key alone must configure
    os.environ["IDSPAY_API_ID"] = "test_api_id"
    os.environ["IDSPAY_API_KEY"] = "test_api_key"
    os.environ["IDSPAY_TOKEN_ID"] = ""
    check("configured without token_id (it is optional/IP-bound)", idspay.is_configured() is True)
    os.environ["IDSPAY_TOKEN_ID"] = "test_token_id"
    check("is_configured() True with real-looking creds", idspay.is_configured() is True)

    # ---------- 2. happy path, unmasked contact ----------
    await clean()
    calls = []
    install_fake_http(ok_payload("919876543210", "owner@realbiz.com"), capture=calls)
    res = await idspay.fetch_contacts(GST)
    check("unmasked lookup ok", res["status"] == "ok" and res["email"] == "owner@realbiz.com", res)
    check("mobile normalized", res["mobile"] == "919876543210", res)
    check("base url + body fields correct for IDSPAY_ENV",
          calls and calls[0]["url"] == f"{idspay.BASES[os.environ['IDSPAY_ENV'].lower()]}/srv2/validation/kyb/gst-to-contacts"
          and set(calls[0]["json"]) == {"api_id", "api_key", "token_id", "gstin"}, calls)

    # ---------- 3. 30-day cache prevents re-billing ----------
    before = len(calls)
    res2 = await idspay.fetch_contacts(GST)
    check("second lookup served from cache (no extra IDSPay call)",
          len(calls) == before and res2.get("cached") is True, res2)

    # ---------- 4. masked email => no OTP possible ----------
    await clean()
    install_fake_http(ok_payload("911XXXXXXXX9", "AjayXXXX09XX@gmail.com"))
    res = await idspay.fetch_contacts(GST)
    check("masked email rejected", res["status"] == "ok" and res["email"] is None and res["email_masked"] is True, res)
    check("masked mobile rejected", res["mobile"] is None and res["mobile_masked"] is True, res)

    # ---------- 5. nested error on HTTP 200 must NOT be success ----------
    await clean()
    install_fake_http({
        "status": {"code": 500, "type": "error", "message": "Details fetching failed"},
        "message": "Details fetching failed",
        "error": {"http_response_code": 400, "request_id": "r1", "error": "One or more parameters format is wrong or missing"},
    })
    res = await idspay.fetch_contacts(GST)
    check("HTTP200 + nested 500 => failed", res["status"] == "failed", res)
    check("definitive failure not flagged provider_down", res.get("provider_down") is False, res)
    check("IDSPay error message surfaced", "parameters format" in (res.get("error") or ""), res)

    # ---------- 6. HTTP 500 with nested 200 must NOT be success ----------
    await clean()
    install_fake_http(ok_payload("919876543210", "owner@realbiz.com"), status_code=500)
    res = await idspay.fetch_contacts(GST)
    check("HTTP500 + nested 200 => failed", res["status"] == "failed", res)

    # ---------- 7. OTP issue + verify happy path ----------
    await clean()
    install_fake_http(ok_payload("919876543210", "owner@realbiz.com"))
    issued = await otp.issue_otp(GST, "owner@realbiz.com", ip="1.2.3.4", business_name="Real Biz")
    check("otp issued", issued.get("ok") is True and issued.get("challenge_id"), issued)
    check("otp emailed to GST address", sent_codes and sent_codes[0]["to"] == "owner@realbiz.com", sent_codes)
    code = sent_codes[0]["code"]
    check("6-digit code present in email", bool(code) and len(code) == 6, sent_codes)

    stored = await db.gst_otp_challenges.find_one({"challenge_id": issued["challenge_id"]})
    check("raw code never stored", code not in str(stored), "code found in challenge doc!")
    check("digest stored instead", bool(stored.get("code_digest")) and len(stored["code_digest"]) == 64)

    bad = await otp.verify_otp(issued["challenge_id"], "000000")
    check("wrong code rejected", bad.get("ok") is False and bad.get("reason") == "invalid", bad)
    after_bad = await db.gst_otp_challenges.find_one({"challenge_id": issued["challenge_id"]})
    check("failed attempt counted", after_bad.get("attempts") == 1, after_bad.get("attempts"))

    good = await otp.verify_otp(issued["challenge_id"], code, ip="1.2.3.4")
    check("correct code verifies", good.get("ok") is True and good.get("onboarding_session"), good)
    check("session carries verified identity",
          good.get("gstin") == GST and good.get("email") == "owner@realbiz.com", good)

    replay = await otp.verify_otp(issued["challenge_id"], code)
    check("code is single-use (replay rejected)", replay.get("ok") is False, replay)

    # ---------- 8. resend cooldown ----------
    again = await otp.issue_otp(GST, "owner@realbiz.com", ip="1.2.3.4")
    check("resend cooldown enforced", again.get("ok") is False and again.get("reason") == "cooldown", again)

    # ---------- 9. max attempts lockout ----------
    await clean()
    iss = await otp.issue_otp(GST2, "two@realbiz.com", ip="9.9.9.9")
    real = sent_codes[-1]["code"]
    for _ in range(5):
        await otp.verify_otp(iss["challenge_id"], "111111")
    locked = await otp.verify_otp(iss["challenge_id"], real)
    check("locked out after 5 wrong attempts (correct code refused)",
          locked.get("ok") is False and locked.get("reason") == "too_many_attempts", locked)

    # ---------- 10. expiry ----------
    await clean()
    iss = await otp.issue_otp(GST, "exp@realbiz.com", ip="1.1.1.1")
    real = sent_codes[-1]["code"]
    await db.gst_otp_challenges.update_one(
        {"challenge_id": iss["challenge_id"]},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
    )
    exp = await otp.verify_otp(iss["challenge_id"], real)
    check("expired challenge rejected", exp.get("ok") is False and exp.get("reason") == "invalid", exp)

    # ---------- 11. per-GSTIN hourly rate limit ----------
    await clean()
    allowed = 0
    for n in range(8):
        r = await otp.issue_otp(GST, "rl@realbiz.com", ip=f"5.5.5.{n}")
        if r.get("ok"):
            allowed += 1
        # bypass the 60s cooldown to probe the hourly cap
        await db.gst_otp_challenges.update_many({}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(seconds=120)}})
    check("per-GSTIN hourly cap holds (<=5)", allowed <= otp.PER_GSTIN_HOURLY, f"allowed={allowed}")

    # ---------- 12. session claim is single-use ----------
    await clean()
    iss = await otp.issue_otp(GST, "sess@realbiz.com", ip="1.1.1.2")
    v = await otp.verify_otp(iss["challenge_id"], sent_codes[-1]["code"])
    sid = v["onboarding_session"]
    peek = await otp.peek_session(sid)
    check("peek_session returns unconsumed session", peek is not None and peek["gstin"] == GST)
    first = await otp.claim_session(sid)
    second = await otp.claim_session(sid)
    check("session consumable exactly once", first is not None and second is None)
    check("peek after claim returns None", await otp.peek_session(sid) is None)

    # ---------- 13. send failure invalidates the challenge ----------
    await clean()

    async def failing_send(to, subject, html, **kw):
        return False

    email_service.send_email = failing_send
    bad_issue = await otp.issue_otp(GST, "nodeliver@realbiz.com", ip="7.7.7.7")
    check("email delivery failure reported", bad_issue.get("ok") is False and bad_issue.get("reason") == "send_failed", bad_issue)
    ch = await db.gst_otp_challenges.find_one({"gstin": GST}, sort=[("created_at", -1)])
    check("undelivered challenge invalidated", ch and ch.get("invalidated_at") is not None)
    email_service.send_email = fake_send_email

    # ---------- 14. entered-vs-GST-record comparison + deny rule ----------
    fetched = {"email": "owner@realbiz.com", "mobile": "919876543210"}
    v = idspay.compare_contacts("owner@realbiz.com", "9876543210", fetched)
    check("both match => allowed", v["email"] == "match" and v["mobile"] == "match" and v["deny"] is False, v)

    v = idspay.compare_contacts("owner@realbiz.com", "9000000000", fetched)
    check("email matches, mobile differs => allowed + flagged",
          v["deny"] is False and v["mobile"] == "mismatch" and v["any_mismatch"] is True, v)

    v = idspay.compare_contacts("someoneelse@evil.com", "9876543210", fetched)
    check("mobile matches, email differs => allowed + flagged",
          v["deny"] is False and v["email"] == "mismatch" and v["any_mismatch"] is True, v)

    v = idspay.compare_contacts("someoneelse@evil.com", "9000000000", fetched)
    check("BOTH differ => DENY", v["deny"] is True, v)

    v = idspay.compare_contacts("owner@realbiz.com", "+91 98765 43210", fetched)
    check("mobile match tolerates +91/spaces", v["mobile"] == "match", v)
    v = idspay.compare_contacts("OWNER@RealBiz.com ", "9876543210", fetched)
    check("email match is case/whitespace insensitive", v["email"] == "match", v)

    masked = {"email": None, "mobile": None}
    v = idspay.compare_contacts("anything@x.com", "9000000000", masked)
    check("masked record => indeterminate, never denies",
          v["deny"] is False and v["email"] == "indeterminate" and v["mobile"] == "indeterminate", v)

    v = idspay.compare_contacts("owner@realbiz.com", "9000000000", {"email": "owner@realbiz.com", "mobile": None})
    check("masked mobile alone cannot deny", v["deny"] is False and v["mobile"] == "indeterminate", v)

    # ---------- 15. account-level errors must not blame the applicant ----------
    await clean()
    install_fake_http({
        "status": {"code": 422, "type": "error", "message": "Insufficient balance in api user wallet."},
        "message": "Insufficient balance in api user wallet.",
        "error": "Insufficient balance in api user wallet.",
    }, status_code=422)
    res = await idspay.fetch_contacts(GST)
    check("wallet-empty 422 parsed (string error field)", res["status"] == "failed", res)
    check("wallet-empty flagged account_issue (not applicant's fault)",
          res.get("account_issue") is True and res.get("provider_down") is True, res)

    # ---------- 16. mismatch metadata rides the session to registration ----------
    await clean()
    install_fake_http(ok_payload("919876543210", "owner@realbiz.com"))
    verdict = idspay.compare_contacts("typed@different.com", "9876543210", {"email": "owner@realbiz.com", "mobile": "919876543210"})
    iss = await otp.issue_otp(GST, "owner@realbiz.com", ip="3.3.3.3", meta=verdict)
    v2 = await otp.verify_otp(iss["challenge_id"], sent_codes[-1]["code"])
    check("verify returns mismatch meta", v2["ok"] and v2["meta"].get("any_mismatch") is True, v2.get("meta"))
    sess = await otp.peek_session(v2["onboarding_session"])
    check("session persists entered-vs-record detail",
          sess["meta"].get("entered_email") == "typed@different.com"
          and sess["meta"].get("gst_email") == "owner@realbiz.com", sess.get("meta"))

    await clean()
    httpx.AsyncClient.post = _ORIGINAL_POST
    for k, v in _saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v

    print(f"\n{'=' * 60}\nPASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  -", f)
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
