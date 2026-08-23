"""Iteration 99 — verifies the waitlist notification email code path executes
(admin notification to ADMIN_EMAIL + applicant confirmation) by calling the
router coroutine in-process with a stubbed GST verifier and stubbed send_email.
"""
import sys
import asyncio
from types import SimpleNamespace

import pytest

sys.path.insert(0, "/app/backend")

TEST_EMAIL = "test_iter99_email_path@example.com"


@pytest.mark.asyncio
async def test_admin_and_applicant_emails_attempted(monkeypatch):
    import routers.b2b_waitlist as wl
    import services.gst_verification as gstsvc
    import services.email_service as emailsvc

    sent = []

    async def fake_send_email(to_email, subject, html_content, **kw):
        sent.append({"to": to_email, "subject": subject, "html": html_content})
        return True

    async def fake_verify(gst):
        return {
            "verified": True,
            "taxpayer_name": "TEST ITER99 TRADERS",
            "trade_name": "TEST ITER99 TRADERS",
            "is_active": True,
            "status": "Active",
            "address": "1, Main Rd, Raipur, Chhattisgarh, 492001",
        }

    monkeypatch.setattr(emailsvc, "send_email", fake_send_email)
    monkeypatch.setattr(gstsvc, "verify_gst_number", fake_verify)

    payload = wl.WaitlistSignup(
        business_name="TEST_ Iter99 Traders",
        contact_name="TEST_ QA Agent",
        email=TEST_EMAIL,
        phone="9876500099",
        gst_number="22AAAAA0000A1Z5",
        legal_name="TEST ITER99 TRADERS",
        state="Chhattisgarh",
        pincode="492001",
    )
    req = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))

    result = await wl.create_waitlist_signup(payload, req)
    assert result["gst_verified"] is True
    assert result["email"] == TEST_EMAIL

    # Two emails: admin notification + applicant confirmation
    recipients = [s["to"] for s in sent]
    assert len(sent) == 2, f"expected 2 emails, got {recipients}"
    assert "contact.us@centraders.com" in recipients[0]
    assert recipients[1] == TEST_EMAIL
    assert "New retailer signup" in sent[0]["subject"]
    assert "22AAAAA0000A1Z5" in sent[0]["html"]
    assert "we've got your application" in sent[1]["subject"]

    # cleanup
    await wl.db.retailer_waitlist.delete_one({"email": TEST_EMAIL})
