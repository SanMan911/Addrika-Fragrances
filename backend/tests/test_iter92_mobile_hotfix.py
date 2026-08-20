"""
Iteration 92 — mobile hotfix verification.

Covers:
  * /app/mobile/lib/web.ts     — openCustomerSignup -> '/register', openWebCheckout customer -> '/cart'
  * /app/mobile/lib/api.ts     — network error embeds the attempted URL ([url=...])
  * www.centraders.com routing — /register, /cart, /api/products, /api/app/config reachable
  * Vercel staleness probe     — deployed chunks contain ZERO 'mobile-share' occurrences (EXPECTED-STALE)
  * Render backend health      — /api/app/config 200 + brand.name, /api/auth/login 401 on bogus creds
  * Regressions                — eas.json has no env block, app.json extras intact, cart.tsx wiring,
                                 CartContext.js mobile-link import handler
"""

import json
import re
import subprocess
from pathlib import Path

import pytest
import requests

MOBILE = Path("/app/mobile")
WEB_TS = MOBILE / "lib" / "web.ts"
API_TS = MOBILE / "lib" / "api.ts"
CART_TSX = MOBILE / "app" / "cart.tsx"
LOGIN_TSX = MOBILE / "app" / "login.tsx"
EAS_JSON = MOBILE / "eas.json"
APP_JSON = MOBILE / "app.json"
CART_CONTEXT = Path("/app/frontend-next/context/CartContext.js")

WEB_HOST = "https://www.centraders.com"
RENDER_HOST = "https://addrika-fragrances-backend.onrender.com"
TIMEOUT = 90  # Render free tier cold-start can take 10-30s


def read(path: Path) -> str:
    assert path.exists(), f"missing file: {path}"
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------- mobile/lib/web.ts
class TestWebTsDeepLinks:
    def test_customer_signup_targets_register_page(self):
        line = next(
            (ln for ln in read(WEB_TS).splitlines() if "export const openCustomerSignup" in ln),
            None,
        )
        assert line, "openCustomerSignup export not found in web.ts"
        assert "openWebUrl('/register')" in line, f"expected '/register', got: {line.strip()}"
        assert "'/login'" not in line, "openCustomerSignup must not point at /login"

    def test_retailer_signup_still_targets_homepage(self):
        line = next(
            (ln for ln in read(WEB_TS).splitlines() if "export const openRetailerSignup" in ln),
            None,
        )
        assert line, "openRetailerSignup export not found"
        assert "openWebUrl('/')" in line, f"expected '/', got: {line.strip()}"

    def test_login_screen_imports_both_signup_helpers(self):
        src = read(LOGIN_TSX)
        assert "openCustomerSignup" in src and "openRetailerSignup" in src
        assert re.search(r"from\s+'\.\./lib/web'", src), "login.tsx must import from ../lib/web"

    def test_open_web_checkout_customer_path_is_cart(self):
        """Read the function body — the literal '/cart' also appears elsewhere in web.ts."""
        src = read(WEB_TS)
        body = re.search(
            r"export function openWebCheckout\([\s\S]*?\n\}", src
        )
        assert body, "openWebCheckout function body not found"
        body_src = body.group(0)
        ternary = re.search(
            r"userKind === 'retailer'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'", body_src
        )
        assert ternary, f"path ternary not found in openWebCheckout:\n{body_src}"
        retailer_path, customer_path = ternary.group(1), ternary.group(2)
        assert customer_path == "/cart", f"customer path must be /cart, got {customer_path}"
        assert retailer_path == "/retailer/b2b/cart", f"retailer path regressed: {retailer_path}"
        assert "/checkout" not in body_src, "openWebCheckout must no longer route to /checkout"
        assert "from=mobile" in body_src, "hand-off must tag the link with from=mobile"

    def test_shareable_cart_url_uses_mobile_share_tag(self):
        src = read(WEB_TS)
        body = re.search(r"export function buildShareableCartUrl\([\s\S]*?\n\}", src)
        assert body, "buildShareableCartUrl not found"
        assert "/cart?cart=" in body.group(0)
        assert "from=mobile-share" in body.group(0)


# ---------------------------------------------------------------- mobile/lib/api.ts
class TestApiTsErrorSurfacing:
    def test_network_error_embeds_attempted_url(self):
        src = read(API_TS)
        catch = re.search(r"\}\s*catch\s*\(e: any\)\s*\{[\s\S]*?\n  \}", src)
        assert catch, "apiFetch fetch-catch branch not found"
        catch_src = catch.group(0)
        assert "[url=" in catch_src, f"network error must embed '[url=':\n{catch_src}"
        assert "${url}" in catch_src, "the attempted URL variable must be interpolated"

    def test_plain_network_error_suffix_pattern_is_gone(self):
        src = read(API_TS)
        assert "(network error)" not in src, "legacy '(network error)' suffix still present"

    def test_pick_url_guard_retained(self):
        """iteration_91 hardening must survive."""
        src = read(API_TS)
        assert "function pickUrl(" in src
        assert re.search(r"\/\^https\?:\\\/\\\/\/i", src) or "^https?:" in src
        assert "Constants.expoConfig?.extra?.apiBaseUrl" in src


# ---------------------------------------------------------------- centraders.com routing
@pytest.mark.parametrize("path", ["/register", "/cart", "/api/products", "/api/app/config"])
def test_centraders_routes_reachable(path):
    res = requests.get(f"{WEB_HOST}{path}", timeout=TIMEOUT)
    assert res.status_code == 200, f"{path} -> {res.status_code}"


# ---------------------------------------------------------------- Vercel staleness probe
def test_deployed_chunks_are_stale_no_mobile_share_handler():
    """
    EXPECTED-STALE assertion. The live www.centraders.com bundle predates the
    mobile-share import handler, so a shared cart lands empty. Asserting 0 here
    documents the current production state; the USER must redeploy Vercel.
    When the redeploy lands this test flips to failing -> update the expectation.
    """
    page = requests.get(f"{WEB_HOST}/cart", timeout=TIMEOUT).text
    chunks = sorted(set(re.findall(r'/_next/static/chunks/[^"]+\.js', page)))[:10]
    assert chunks, "no JS chunks discovered on /cart — page shape changed"
    hits = 0
    for chunk in chunks:
        body = requests.get(f"{WEB_HOST}{chunk}", timeout=TIMEOUT).text
        hits += body.count("mobile-share")
    assert hits == 0, (
        f"'mobile-share' now found {hits}x in deployed chunks — Vercel has been "
        "redeployed; flip this expectation to assert hits > 0."
    )


# ---------------------------------------------------------------- Render backend health
class TestRenderBackend:
    def test_app_config_returns_brand_name(self):
        res = requests.get(f"{RENDER_HOST}/api/app/config", timeout=TIMEOUT)
        assert res.status_code == 200, f"config -> {res.status_code}"
        data = res.json()
        assert "brand" in data, f"no brand key in payload: {list(data)[:10]}"
        name = data["brand"].get("name")
        assert isinstance(name, str) and name, f"brand.name missing/empty: {name!r}"

    def test_login_rejects_bogus_credentials_with_401(self):
        res = requests.post(
            f"{RENDER_HOST}/api/auth/login",
            json={"identifier": "x", "password": "y"},
            timeout=TIMEOUT,
        )
        assert res.status_code == 401, f"expected 401, got {res.status_code}: {res.text[:200]}"
        assert res.json().get("detail") == "Invalid credentials"


# ---------------------------------------------------------------- regressions
class TestBuildConfigRegressions:
    def test_eas_json_has_no_env_block(self):
        cfg = json.loads(read(EAS_JSON))
        profiles = cfg["build"]
        assert set(profiles) == {"development", "preview", "production"}
        for name, profile in profiles.items():
            assert "env" not in profile, f"eas.json profile '{name}' regained an env block"

    def test_app_json_extras_intact(self):
        expo = json.loads(read(APP_JSON))["expo"]
        assert expo["slug"] == "aaroviah-mobile"
        extra = expo["extra"]
        assert extra["apiBaseUrl"] == RENDER_HOST
        assert extra["webUrl"] == WEB_HOST
        assert extra["eas"]["projectId"] == "f152117c-57fb-4506-a44a-7c53d1043dd3"

    def test_cart_screen_wiring_unchanged(self):
        src = read(CART_TSX)
        assert "testID=\"cart-share-whatsapp-btn\"" in src
        assert "shareCartOnWhatsApp" in src
        assert "openWebCheckout" in src

    def test_cart_context_honours_both_mobile_link_flavours(self):
        src = read(CART_CONTEXT)
        assert "importCartFromMobileLink" in src
        assert "'mobile'" in src and "'mobile-share'" in src
        assert re.search(
            r"from !== 'mobile' && from !== 'mobile-share'", src
        ), "guard for both from= flavours not found"


def test_mobile_typecheck_passes():
    proc = subprocess.run(
        ["yarn", "typecheck"], cwd=str(MOBILE), capture_output=True, text=True, timeout=300
    )
    assert proc.returncode == 0, f"tsc failed:\n{proc.stdout[-3000:]}\n{proc.stderr[-2000:]}"


def test_frontend_next_brand_audit_passes():
    proc = subprocess.run(
        ["yarn", "--cwd", "/app/frontend-next", "brand-audit"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0, f"brand-audit failed:\n{proc.stdout[-3000:]}"
