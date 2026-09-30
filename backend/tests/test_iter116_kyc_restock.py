"""ITER116 backend tests: KYC status/upload, cron auto-suspend, admin restock."""
import io
import os
import re
import subprocess
import pytest
import requests

BASE_URL = "https://aarohmm-expo.preview.emergentagent.com"
RETAILER_GSTIN = "07AAAAA0000A1Z5"
RETAILER_PASSWORD = "Test@12345"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
WEBHOOK_CRON_SECRET = "sbp_rem_c3f9a1d27b4e48f0b6a52e91c0d7348aa15e77bd"


@pytest.fixture(scope="module")
def retailer_token():
    r = requests.post(
        f"{BASE_URL}/api/retailer-auth/login",
        json={"gstin": RETAILER_GSTIN, "password": RETAILER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    j = r.json()
    tok = j.get("token") or j.get("session_token")
    assert tok, f"no token in login response: {j}"
    return tok


@pytest.fixture(scope="module")
def retailer_headers(retailer_token):
    return {"Authorization": f"Bearer {retailer_token}"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/login/initiate",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN},
        timeout=30,
    )
    assert r.status_code == 200, f"initiate failed: {r.status_code} {r.text}"
    token_id = r.json().get("token_id")
    assert token_id
    out = subprocess.run(
        [
            "mongosh",
            "mongodb://localhost:27017/addrika_db",
            "--quiet",
            "--eval",
            f'JSON.stringify(db.admin_2fa_tokens.findOne({{token_id:"{token_id}"}}))',
        ],
        capture_output=True,
        text=True,
        timeout=15,
    )
    m = re.search(r'"otp"\s*:\s*"?(\d{4,8})"?', out.stdout)
    assert m, f"could not read OTP from Mongo: {out.stdout} / {out.stderr}"
    otp = m.group(1)
    r2 = s.post(
        f"{BASE_URL}/api/admin/login/verify-otp",
        json={"token_id": token_id, "otp": otp},
        timeout=30,
    )
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    return s


# ------------------------- KYC status ------------------------------------
class TestKycStatus:
    def test_kyc_status_auth_bearer(self, retailer_headers):
        r = requests.get(
            f"{BASE_URL}/api/retailer-auth/kyc/status",
            headers=retailer_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("gst_certificate", "spoc_aadhaar", "complete", "deadline", "days_left", "at_risk"):
            assert k in j, f"missing key {k} in {j}"
        assert isinstance(j["gst_certificate"], bool)
        assert isinstance(j["spoc_aadhaar"], bool)
        assert isinstance(j["complete"], bool)

    def test_kyc_status_no_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/retailer-auth/kyc/status", timeout=20)
        assert r.status_code == 401


# ------------------------- KYC upload ------------------------------------
class TestKycUpload:
    def test_kyc_upload_invalid_doc_type(self, retailer_headers):
        files = {"file": ("x.pdf", b"%PDF-1.4 test", "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/api/retailer-auth/kyc/upload",
            headers=retailer_headers,
            data={"doc_type": "invalid_kind"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_kyc_upload_no_auth(self):
        files = {"file": ("x.pdf", b"%PDF-1.4 test", "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/api/retailer-auth/kyc/upload",
            data={"doc_type": "spoc_aadhaar"},
            files=files,
            timeout=30,
        )
        assert r.status_code == 401

    def test_kyc_upload_spoc_aadhaar_ok(self, retailer_headers):
        files = {"file": ("aadhaar_test.pdf", b"%PDF-1.4 iter116 test content", "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/api/retailer-auth/kyc/upload",
            headers=retailer_headers,
            data={"doc_type": "spoc_aadhaar"},
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("doc_type") == "spoc_aadhaar"
        assert j["kyc"]["spoc_aadhaar"] is True


# ------------------------- Cron auto-suspend -----------------------------
class TestCronAutosuspend:
    def test_cron_wrong_bearer(self):
        r = requests.post(
            f"{BASE_URL}/api/cron/kyc-autosuspend",
            headers={"Authorization": "Bearer wrong"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_cron_missing_bearer(self):
        r = requests.post(f"{BASE_URL}/api/cron/kyc-autosuspend", timeout=20)
        assert r.status_code == 401

    def test_cron_valid_bearer(self):
        r = requests.post(
            f"{BASE_URL}/api/cron/kyc-autosuspend",
            headers={"Authorization": f"Bearer {WEBHOOK_CRON_SECRET}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True


# ------------------------- Admin restock ---------------------------------
class TestAdminRestock:
    def test_list_b2b_inventory(self, admin_session):
        # try the inventory listing endpoint
        r = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("products") or []
        assert items, f"no inventory items returned: {data}"
        # keep for next test
        pytest.b2b_items = items

    def test_adjust_increments_stock(self, admin_session):
        items = getattr(pytest, "b2b_items", None)
        if not items:
            pytest.skip("no items")
        item = items[0]
        pid = item.get("id") or item.get("product_id") or item.get("_id")
        assert pid, f"no id in item: {item}"
        ppc = item.get("pieces_per_carton") or 1
        stock_before = item.get("stock_pieces") or 0

        r = admin_session.post(
            f"{BASE_URL}/api/admin/b2b/inventory/{pid}/adjust",
            json={"delta_pieces": ppc, "reason": "restock"},
            timeout=30,
        )
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"

        # verify by GET
        r2 = admin_session.get(f"{BASE_URL}/api/admin/b2b/inventory", timeout=30)
        items2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("items") or r2.json().get("products") or []
        match = next((x for x in items2 if (x.get("id") or x.get("product_id") or x.get("_id")) == pid), None)
        assert match, "item disappeared after adjust"
        stock_after = match.get("stock_pieces") or 0
        assert stock_after == stock_before + ppc, f"stock did not increase: {stock_before}->{stock_after} ppc={ppc}"


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
