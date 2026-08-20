"""Iter93 regression suite.

Covers:
  * mobile/app/login.tsx  -> forgot-password-link + friendly 4xx error mapper
  * mobile/lib/web.ts     -> openWebUrl / openCustomerSignup regressions
  * mobile/EAS_BUILD_GUIDE.md -> new troubleshooting sections
  * preview backend       -> Iter82 products migration applied (9 products, Belpatra)
  * Render prod backend   -> EXPECTED-STALE (migration not yet deployed; user action)
  * web prod              -> /forgot-password + /retailer/login reachable
"""

import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = {
    **dotenv_values("/app/frontend/.env"),
    **dotenv_values("/app/frontend-next/.env.local"),
}
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("NEXT_PUBLIC_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("Backend base URL missing from env and frontend env files")
BASE_URL = base_url.rstrip("/")

RENDER_URL = "https://addrika-fragrances-backend.onrender.com"
WEB_URL = "https://www.centraders.com"

MOBILE = Path("/app/mobile")
LOGIN_TSX = (MOBILE / "app" / "login.tsx").read_text(encoding="utf-8")
WEB_TS = (MOBILE / "lib" / "web.ts").read_text(encoding="utf-8")
API_TS = (MOBILE / "lib" / "api.ts").read_text(encoding="utf-8")
GUIDE = (MOBILE / "EAS_BUILD_GUIDE.md").read_text(encoding="utf-8")


# --- mobile/app/login.tsx: forgot-password link -----------------------------
class TestMobileForgotPasswordLink:
    def test_pressable_with_testid_exists(self):
        assert 'testID="forgot-password-link"' in LOGIN_TSX
        assert "onPress={openForgotPassword}" in LOGIN_TSX
        assert "Forgot password?" in LOGIN_TSX

    def test_ternary_targets_correct_urls(self):
        # iter94 superseded the retailer branch: it now deep-links WhatsApp to
        # the admin line instead of dead-ending on the /retailer/login waitlist.
        assert "const openForgotPassword = () =>" in LOGIN_TSX
        assert "openWebUrl('/forgot-password')" in LOGIN_TSX
        assert "openWhatsAppTo(" in LOGIN_TSX

    def test_openweburl_imported_once(self):
        assert LOGIN_TSX.count("from '../lib/web'") == 1
        assert (
            "import { openCustomerSignup, openRetailerSignup, openWebUrl, openWhatsAppTo } from '../lib/web';"
            in LOGIN_TSX
        )


# --- mobile/app/login.tsx: friendly 4xx error mapper -----------------------
class TestMobileFriendlyErrorMapper:
    def test_invalid_credentials_branch(self):
        assert "/401.*Invalid credentials/i" in LOGIN_TSX
        assert "Wrong email/username or password." in LOGIN_TSX
        assert "Forgot password" in LOGIN_TSX

    def test_google_login_branch(self):
        assert "/400.*Google login/i" in LOGIN_TSX
        assert "This account uses Google sign-in." in LOGIN_TSX

    def test_other_errors_fall_through_unchanged(self):
        # `let msg = raw;` guarantees pass-through when no regex matches.
        assert "let msg = raw;" in LOGIN_TSX
        assert "setError(msg);" in LOGIN_TSX

    def test_api_error_string_shape_matches_regexes(self):
        # apiFetch throws `API <status> <path>: <body>` — the mapper regexes
        # rely on this exact shape.
        assert "`API ${res.status} ${path}: ${text || res.statusText}`" in API_TS


# --- mobile/lib/web.ts regressions ----------------------------------------
class TestMobileWebHelpers:
    def test_exports_intact(self):
        assert "export const openCustomerSignup = () => openWebUrl('/register');" in WEB_TS
        assert "export async function openWebUrl(path: string)" in WEB_TS

    def test_customer_checkout_path_is_cart(self):
        assert "userKind === 'retailer' ? '/retailer/b2b/cart' : '/cart'" in WEB_TS

    def test_share_url_uses_mobile_share_marker(self):
        assert "from=mobile-share" in WEB_TS


# --- EAS_BUILD_GUIDE.md troubleshooting sections ---------------------------
class TestEasBuildGuide:
    @pytest.mark.parametrize(
        "needle",
        [
            "Bambooless",
            "Iter82 tombstone",
            "Forgot password?",
            "Preview and prod have separate Mongo",
            "Network request failed",
            "mobile-share",
        ],
    )
    def test_contains_needle(self, needle):
        assert needle in GUIDE, f"missing troubleshooting content: {needle}"


# --- mobile config regressions --------------------------------------------
class TestMobileConfigFiles:
    def test_app_json(self):
        cfg = json.loads((MOBILE / "app.json").read_text(encoding="utf-8"))["expo"]
        assert cfg["slug"] == "aaroviah-mobile"
        assert cfg["extra"]["eas"]["projectId"] == "f152117c-57fb-4506-a44a-7c53d1043dd3"
        assert cfg["extra"]["apiBaseUrl"] == RENDER_URL

    def test_eas_json_three_profiles_no_env(self):
        eas = json.loads((MOBILE / "eas.json").read_text(encoding="utf-8"))
        assert set(eas["build"].keys()) == {"development", "preview", "production"}
        for profile in eas["build"].values():
            assert "env" not in profile

    def test_cart_share_testid_present(self):
        cart = (MOBILE / "app" / "cart.tsx").read_text(encoding="utf-8")
        assert 'testID="cart-share-whatsapp-btn"' in cart


# --- preview backend: Iter82 migration applied ----------------------------
def _products(url):
    r = requests.get(f"{url}/api/products", timeout=120)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    return data if isinstance(data, list) else data.get("products", data)


class TestPreviewProductsMigration:
    def test_nine_products_with_belpatra(self):
        items = _products(BASE_URL)
        assert len(items) == 9, [p.get("name") for p in items]
        names = [p["name"] for p in items]
        ids = [p["id"] for p in items]
        assert "Bilvapatra Fragrance" not in names
        assert '8" Bambooless Dhoop' not in names
        assert "bambooless-dhoop-8inch" not in ids
        assert "bilvapatra-fragrance" in ids
        belpatra = next(p for p in items if p["id"] == "bilvapatra-fragrance")
        assert belpatra["name"] == "Belpatra"

    def test_app_config_schema_v2(self):
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert str(body.get("schema_version")) == "2"
        assert "retailer_tier_perks" in json.dumps(body)


# --- Render prod backend: EXPECTED-STALE (user must redeploy) -------------
class TestRenderProdExpectedStale:
    def test_render_reachable(self):
        r = requests.get(f"{RENDER_URL}/api/app/config", timeout=120)
        assert r.status_code == 200
        assert r.json()["brand"]["name"]

    def test_render_login_rejects_bad_creds(self):
        r = requests.post(
            f"{RENDER_URL}/api/auth/login",
            json={"identifier": "x", "password": "y"},
            timeout=120,
        )
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid credentials"

    def test_render_products_still_stale(self):
        """EXPECTED-STALE: proves the Render service predates Iter82.

        Resolves on the user's next Render deploy — not a code defect.
        """
        items = _products(RENDER_URL)
        names = [p["name"] for p in items]
        stale = "Bilvapatra Fragrance" in names or '8" Bambooless Dhoop' in names
        if not stale:
            pytest.skip("Render redeployed — Iter82 migration now live in prod")
        assert len(items) == 10


# --- prod web destinations for the new mobile link ------------------------
class TestProdWebDestinations:
    @pytest.mark.parametrize("path", ["/forgot-password", "/retailer/login", "/register", "/cart"])
    def test_page_returns_200(self, path):
        r = requests.get(f"{WEB_URL}{path}", timeout=120)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
