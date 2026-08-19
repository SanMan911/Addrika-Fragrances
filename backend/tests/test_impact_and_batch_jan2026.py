"""Regression + new-feature tests for the Jan-2026 batch:
- tree-plantation counter endpoints (public + admin)
- admin products list (401 without auth)
- brochure download (PDF, 200)
- partner coupons rejects bad signature (401)
- public retailers listing does NOT leak PII (gst, spoc, email, phone)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fragrance-rewards.preview.emergentagent.com").rstrip("/")


# ---------- Impact / trees ----------
class TestImpactTrees:
    def test_public_trees_returns_expected_shape(self):
        r = requests.get(f"{BASE_URL}/api/impact/trees", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("trees"), int) and data["trees"] >= 0
        assert data.get("trees_per_week") == 1.5
        assert isinstance(data.get("start_date"), str) and data["start_date"].startswith("2026-")
        assert data.get("unit") == "trees"
        assert data.get("cta_href") == "/csr"
        assert "note" in data

    def test_admin_get_trees_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/impact/admin/trees", timeout=15)
        assert r.status_code == 401

    def test_admin_put_trees_requires_auth(self):
        r = requests.put(
            f"{BASE_URL}/api/impact/admin/trees",
            json={"trees_per_week": 2.0},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Admin products regression ----------
class TestAdminProducts:
    def test_admin_products_requires_auth_401_not_404(self):
        r = requests.get(f"{BASE_URL}/api/admin/products", timeout=15)
        assert r.status_code == 401


# ---------- Brochure ----------
class TestBrochure:
    def test_brochure_download_returns_pdf(self):
        r = requests.get(f"{BASE_URL}/api/brochure/download", timeout=30)
        assert r.status_code == 200
        assert len(r.content) > 1000
        # basic PDF sanity
        assert r.content[:4] == b"%PDF"


# ---------- Partner coupons signature ----------
class TestPartnerCoupons:
    def test_bad_signature_rejected_401(self):
        r = requests.post(
            f"{BASE_URL}/api/partner/coupons/issue",
            json={"campaign_code": "x", "signature": "bad", "email": "a@b.com"},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Public retailers listing PII check ----------
class TestRetailersPIILeak:
    _FORBIDDEN = ("gst_number", "spoc", "email", "phone")

    def test_no_pii_in_public_retailers(self):
        r = requests.get(f"{BASE_URL}/api/retailers/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        retailers = data.get("retailers", data if isinstance(data, list) else [])
        assert len(retailers) > 0
        for row in retailers:
            for k in self._FORBIDDEN:
                assert k not in row, f"Leaked field '{k}' in public retailer: {row}"
