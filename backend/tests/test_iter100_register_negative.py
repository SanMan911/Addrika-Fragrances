"""Iteration 100 — negative-path tests for POST /api/retailer-auth/register.

We deliberately avoid the happy path (a real valid GSTIN) because it would
consume Appyflow credits and email the production admin inbox.
"""
import io
import os

import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend-next/.env.local")
BASE_URL = (
    os.environ.get("NEXT_PUBLIC_BACKEND_URL")
    or _env.get("NEXT_PUBLIC_BACKEND_URL")
).rstrip("/")

REGISTER_URL = f"{BASE_URL}/api/retailer-auth/register"

# A structurally-valid GSTIN that does not exist in the GSTN registry
INVALID_GSTIN = "22AAAAA0000A1Z5"
MALFORMED_GSTIN = "ABCDE12345XYZ99"

PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _base_form(gst=INVALID_GSTIN, email="TEST_iter100_neg@example.com"):
    return {
        "business_name": "TEST Negative Traders",
        "contact_name": "TEST Contact",
        "email": email,
        "country_code": "+91",
        "phone": "9876500011",
        "gst_number": gst,
        "password": "TestPass@12345",
        "city": "Delhi",
        "state": "Delhi",
        "address": "1 Test Street",
        "pincode": "110001",
    }


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


# --- Module: retailer_auth.register — GST hard-block ---
def test_register_hardblocks_unverifiable_gstin(client):
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = client.post(REGISTER_URL, data=_base_form(), files=files, timeout=90)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
    detail = r.json().get("detail", "")
    assert isinstance(detail, str) and len(detail) > 5
    assert "gst" in detail.lower() or "verif" in detail.lower(), detail


# --- Module: retailer_auth.register — certificate mime validation ---
def test_register_rejects_non_pdf_image_mime(client):
    files = {"gst_certificate": ("cert.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = client.post(REGISTER_URL, data=_base_form(), files=files, timeout=60)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
    assert "PDF" in r.json().get("detail", "")


def test_register_rejects_empty_file(client):
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(b""), "application/pdf")}
    r = client.post(REGISTER_URL, data=_base_form(), files=files, timeout=60)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
    assert "empty" in r.json().get("detail", "").lower()


# --- Module: retailer_auth.register — GST format validation ---
def test_register_rejects_malformed_gst_format(client):
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = client.post(REGISTER_URL, data=_base_form(gst=MALFORMED_GSTIN), files=files, timeout=60)
    assert r.status_code in (400, 422), f"got {r.status_code}: {r.text[:400]}"


def test_register_rejects_short_gst(client):
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = client.post(REGISTER_URL, data=_base_form(gst="22AAAAA"), files=files, timeout=60)
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:400]}"


# --- Module: retailer_auth.register — required-field validation ---
def test_register_requires_certificate(client):
    r = client.post(REGISTER_URL, data=_base_form(), timeout=60)
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:400]}"


def test_register_rejects_short_password(client):
    form = _base_form()
    form["password"] = "abc"
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = client.post(REGISTER_URL, data=form, files=files, timeout=60)
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:400]}"


def test_register_rejects_bad_email(client):
    form = _base_form(email="not-an-email")
    files = {"gst_certificate": ("cert.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = client.post(REGISTER_URL, data=form, files=files, timeout=60)
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:400]}"


def test_register_does_not_persist_rejected_registration():
    """No retailer doc should be created for any of the rejected attempts."""
    from pymongo import MongoClient

    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbname = os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env").get("DB_NAME")
    doc = mongo[dbname].retailers.find_one({"email": "test_iter100_neg@example.com"})
    mongo.close()
    assert doc is None, "rejected registration leaked a retailer record"
