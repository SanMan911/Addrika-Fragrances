"""
Iteration 91 — Mobile 'Network request failed' hotfix verification.

Scope:
  * eas.json must have 3 build profiles with NO `env` block (no $VAR templating)
  * Render production backend reachability (the URL the APK actually calls)
  * URL-resolver hardening in lib/api.ts / lib/supabase.ts / lib/web.ts
  * EAS_BUILD_GUIDE.md troubleshooting section
  * Regression: app.json extra.* values, cart testID, web.ts exports
  * Regression: preview-host /api/app/config schema_version 2 + retailer_tier_perks
"""
import json
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

MOBILE = Path("/app/mobile")
RENDER_BASE = "https://addrika-fragrances-backend.onrender.com"

_next_env = dotenv_values("/app/frontend-next/.env.local")
_preview = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
    or _next_env.get("NEXT_PUBLIC_BACKEND_URL")
)
PREVIEW_BASE = _preview.rstrip("/") if _preview else None


# ---------------------------------------------------------------- eas.json
class TestEasJsonShape:
    def test_three_profiles_no_env_block(self):
        d = json.loads((MOBILE / "eas.json").read_text())
        profiles = d["build"]
        assert set(profiles) == {"development", "preview", "production"}, profiles.keys()
        assert [("env" in v) for v in profiles.values()] == [False, False, False]

    def test_no_dollar_template_anywhere_in_eas_json(self):
        raw = (MOBILE / "eas.json").read_text()
        assert "$EXPO_PUBLIC" not in raw
        assert "$" not in raw


# --------------------------------------------------- Render backend (APK target)
class TestRenderBackendReachability:
    def test_app_config_200_with_brand_name(self):
        r = requests.get(f"{RENDER_BASE}/api/app/config", timeout=60)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "brand" in body and body["brand"].get("name"), body

    def test_login_rejects_bad_credentials_with_401(self):
        r = requests.post(
            f"{RENDER_BASE}/api/auth/login",
            json={"identifier": "nonexistent@example.com", "password": "wrong"},
            timeout=60,
        )
        assert r.status_code == 401, f"{r.status_code} {r.text[:300]}"
        assert r.json().get("detail") == "Invalid credentials", r.text[:300]

    def test_constructed_url_from_app_json_extra_is_valid(self):
        extra = json.loads((MOBILE / "app.json").read_text())["expo"]["extra"]
        base = extra["apiBaseUrl"]
        assert re.match(r"^https://", base)
        r = requests.get(f"{base}/api/app/config", timeout=60)
        assert r.status_code == 200


# --------------------------------------------------- resolver hardening (source)
HTTP_RE = re.compile(r"^https?://", re.I)
HTTPS_RE = re.compile(r"^https://", re.I)


def _pick(regex, candidates):
    for c in candidates:
        if isinstance(c, str) and regex.match(c):
            return c
    return ""


def _pick_key(candidates):
    for c in candidates:
        if isinstance(c, str) and len(c) > 0 and not c.startswith("$"):
            return c
    return ""


class TestResolverLogic:
    """Replicates the pickUrl/pickHttps/pickKey semantics from the TS sources."""

    @pytest.mark.parametrize(
        "bad", ["$EXPO_PUBLIC_API_BASE_URL", "", None, "  ", "ftp://x.com", "addrika.com"]
    )
    def test_bad_candidate_falls_through_to_app_json(self, bad):
        good = "https://addrika-fragrances-backend.onrender.com"
        assert _pick(HTTP_RE, [bad, good]) == good

    def test_good_candidate_wins(self):
        assert (
            _pick(HTTP_RE, ["https://addrika-fragrances-backend.onrender.com", "https://z"])
            == "https://addrika-fragrances-backend.onrender.com"
        )

    def test_all_bad_returns_empty(self):
        assert _pick(HTTP_RE, ["$EXPO_PUBLIC_API_BASE_URL", None, ""]) == ""

    def test_anon_key_guard_rejects_dollar_template(self):
        real = "sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4"
        assert _pick_key(["$EXPO_PUBLIC_SUPABASE_ANON_KEY", real]) == real
        assert _pick_key(["", None, real]) == real

    def test_supabase_url_guard_https_only(self):
        real = "https://qzzwaqwgzvrdecheunpn.supabase.co"
        assert _pick(HTTPS_RE, ["$EXPO_PUBLIC_SUPABASE_URL", real]) == real
        assert _pick(HTTPS_RE, ["http://insecure.example.com", real]) == real


class TestSourceUsesHardenedHelpers:
    def test_api_ts_uses_pickurl_and_drops_fragile_chain(self):
        src = (MOBILE / "lib" / "api.ts").read_text()
        assert "function pickUrl(" in src
        assert "pickUrl(\n  process.env.EXPO_PUBLIC_API_BASE_URL" in src
        assert "process.env.EXPO_PUBLIC_API_BASE_URL ||" not in src
        assert re.search(r"/\^https\?:\\/\\//i", src)

    def test_supabase_ts_uses_pickhttps_and_pickkey(self):
        src = (MOBILE / "lib" / "supabase.ts").read_text()
        assert "function pickHttps(" in src and "function pickKey(" in src
        assert "c.startsWith('$')" in src
        assert "process.env.EXPO_PUBLIC_SUPABASE_URL ||" not in src
        assert "process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||" not in src

    def test_web_ts_uses_pickhttps_with_centraders_fallback(self):
        src = (MOBILE / "lib" / "web.ts").read_text()
        assert "function pickHttps(" in src
        assert "|| 'https://www.centraders.com'" in src
        assert "process.env.EXPO_PUBLIC_WEB_URL ||" not in src
        assert "export function buildShareableCartUrl" in src
        assert "export async function shareCartOnWhatsApp" in src

    def test_guide_has_network_request_failed_section(self):
        src = (MOBILE / "EAS_BUILD_GUIDE.md").read_text()
        assert "Network request failed" in src
        assert '"$EXPO_PUBLIC_API_BASE_URL"' in src
        assert "removed from all three build profiles" in src


# ------------------------------------------------------------- regressions
class TestAppJsonRegressions:
    def test_extra_and_slug_intact(self):
        cfg = json.loads((MOBILE / "app.json").read_text())["expo"]
        assert cfg["slug"] == "aaroviah-mobile"
        extra = cfg["extra"]
        assert extra["apiBaseUrl"] == "https://addrika-fragrances-backend.onrender.com"
        assert extra["supabaseUrl"] == "https://qzzwaqwgzvrdecheunpn.supabase.co"
        assert extra["webUrl"] == "https://www.centraders.com"
        assert extra["eas"]["projectId"] == "f152117c-57fb-4506-a44a-7c53d1043dd3"

    def test_cart_share_testid_present(self):
        src = (MOBILE / "app" / "cart.tsx").read_text()
        assert "cart-share-whatsapp-btn" in src


class TestPreviewHostRegressions:
    def test_app_config_schema_v2_with_tier_perks(self):
        if not PREVIEW_BASE:
            pytest.fail("Preview base URL missing from env")
        r = requests.get(f"{PREVIEW_BASE}/api/app/config", timeout=60)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert str(body.get("schema_version")) == "2", body.get("schema_version")
        perks = body.get("retailer_tier_perks")
        assert isinstance(perks, (dict, list)), type(perks)
        keys = set(perks.keys()) if isinstance(perks, dict) else {
            (p.get("tier") or p.get("id")) for p in perks
        }
        assert {"novice", "bronze", "silver", "gold"}.issubset(keys), keys

    def test_cart_deep_link_page_loads(self):
        if not PREVIEW_BASE:
            pytest.fail("Preview base URL missing from env")
        cart_param = "W3sicHJvZHVjdF9pZCI6InRlc3QiLCJxdWFudGl0eSI6MX1d"
        r = requests.get(
            f"{PREVIEW_BASE}/cart?cart={cart_param}&from=mobile-share", timeout=60
        )
        assert r.status_code == 200, r.status_code
