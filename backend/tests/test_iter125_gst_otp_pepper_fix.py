"""Iteration 125 — verify gst-contact/send-otp bug fix.

Covers:
  * happy path returns 200 otp_sent (mode=fallback, delivered@resend.dev)
  * cooldown returns 429 on an immediate 2nd send with same GSTIN
  * already-registered GSTIN returns 409
"""
import os
import random
import string
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
EP = f"{BASE_URL}/api/retailer-auth/gst-contact/send-otp"


def _fresh_gstin() -> str:
    """2 digits + 5 upper + 4 digits + 1 letter + 1 alnum + 'Z' + 1 alnum."""
    rng = random.Random()
    d2 = "".join(rng.choice(string.digits) for _ in range(2))
    u5 = "".join(rng.choice(string.ascii_uppercase) for _ in range(5))
    d4 = "".join(rng.choice(string.digits) for _ in range(4))
    l1 = rng.choice(string.ascii_uppercase)
    a1 = rng.choice(string.ascii_uppercase + string.digits)
    a2 = rng.choice(string.ascii_uppercase + string.digits)
    return f"{d2}{u5}{d4}{l1}{a1}Z{a2}"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _body(gstin, email="delivered@resend.dev", phone="9876543210"):
    return {"gstin": gstin, "mode": "fallback", "email": email,
            "phone": phone, "country_code": "+91"}


def test_happy_path_send_otp_returns_200(client):
    gstin = _fresh_gstin()
    r = client.post(EP, json=_body(gstin))
    assert r.status_code == 200, f"{r.status_code} body={r.text[:400]}"
    data = r.json()
    assert data["status"] == "otp_sent"
    assert isinstance(data.get("challenge_id"), str) and len(data["challenge_id"]) > 10
    assert "target_hint" in data
    assert data.get("expires_in", 0) > 0


def test_cooldown_within_60s_returns_429(client):
    gstin = _fresh_gstin()
    r1 = client.post(EP, json=_body(gstin))
    assert r1.status_code == 200, r1.text[:400]
    time.sleep(0.3)
    r2 = client.post(EP, json=_body(gstin))
    assert r2.status_code == 429, f"expected 429 cooldown, got {r2.status_code} {r2.text[:200]}"
    detail = r2.json().get("detail", "")
    assert "wait" in detail.lower() or "cool" in detail.lower() or "s before" in detail


def test_already_registered_gstin_returns_409(client):
    # Seeded registered retailer per request brief
    r = client.post(EP, json=_body("29AAAAA0000A1Z5"))
    assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text[:300]}"
    detail = r.json().get("detail", "").lower()
    assert "account" in detail or "exist" in detail or "already" in detail
