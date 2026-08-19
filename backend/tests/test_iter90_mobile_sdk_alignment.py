"""Iteration 90 — mobile SDK-51 package alignment + backend/config regression.

Covers:
 - mobile/package.json expo-web-browser pin and SDK-51 alignment of the whole block
 - mobile/yarn.lock + installed node_modules version
 - mobile/EAS_BUILD_GUIDE.md troubleshooting callout
 - mobile app.json / eas.json / cart.tsx / lib/web.ts regressions
 - backend GET /api/app/config and GET /api/products sanity
"""

import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

MOBILE = Path("/app/mobile")

_env = dotenv_values("/app/frontend-next/.env.local")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _env.get("NEXT_PUBLIC_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("Backend base URL missing from env and /app/frontend-next/.env.local")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def mobile_pkg():
    return json.loads((MOBILE / "package.json").read_text(encoding="utf-8"))


# --- mobile package alignment ---------------------------------------------
class TestMobilePackageAlignment:
    def test_expo_web_browser_pinned_to_sdk51(self, mobile_pkg):
        assert mobile_pkg["dependencies"]["expo-web-browser"] == "~13.0.3"

    def test_installed_version_is_13_0_3(self):
        installed = json.loads(
            (MOBILE / "node_modules/expo-web-browser/package.json").read_text(encoding="utf-8")
        )
        assert installed["version"] == "13.0.3"

    def test_yarn_lock_has_sdk51_entry(self):
        lock = (MOBILE / "yarn.lock").read_text(encoding="utf-8")
        assert "expo-web-browser@~13.0.3:" in lock
        assert "expo-web-browser-13.0.3.tgz" in lock
        assert "expo-web-browser@^57" not in lock

    @pytest.mark.parametrize(
        "name,version",
        [
            ("expo", "~51.0.28"),
            ("react", "18.2.0"),
            ("react-native", "0.74.5"),
            ("expo-router", "~3.5.23"),
            ("expo-constants", "~16.0.2"),
            ("expo-linking", "~6.3.1"),
            ("expo-secure-store", "~13.0.2"),
            ("expo-status-bar", "~1.12.1"),
            ("@react-native-async-storage/async-storage", "1.23.1"),
            ("react-native-gesture-handler", "~2.16.1"),
            ("react-native-reanimated", "~3.10.1"),
            ("react-native-safe-area-context", "4.10.5"),
            ("react-native-screens", "3.31.1"),
            ("react-native-url-polyfill", "^2.0.0"),
            ("react-native-web", "~0.19.10"),
            ("@supabase/supabase-js", "2.45.4"),
        ],
    )
    def test_other_deps_unchanged(self, mobile_pkg, name, version):
        assert mobile_pkg["dependencies"][name] == version


# --- EAS build guide docs --------------------------------------------------
class TestEasBuildGuide:
    @pytest.mark.parametrize(
        "substring",
        [
            "Plugin 'expo-module-gradle-plugin' was not found",
            "npx expo install --check",
        ],
    )
    def test_troubleshooting_substrings_present(self, substring):
        guide = (MOBILE / "EAS_BUILD_GUIDE.md").read_text(encoding="utf-8")
        assert substring in guide


# --- mobile config regressions --------------------------------------------
class TestMobileConfigRegression:
    def test_app_json_identity(self):
        cfg = json.loads((MOBILE / "app.json").read_text(encoding="utf-8"))["expo"]
        assert cfg["slug"] == "aaroviah-mobile"
        assert cfg["extra"]["eas"]["projectId"] == "f152117c-57fb-4506-a44a-7c53d1043dd3"
        assert cfg["extra"]["apiBaseUrl"] == "https://addrika-fragrances-backend.onrender.com"

    def test_eas_json_has_three_build_profiles(self):
        eas = json.loads((MOBILE / "eas.json").read_text(encoding="utf-8"))
        assert sorted(eas["build"].keys()) == ["development", "preview", "production"]

    def test_cart_share_testid_present(self):
        assert 'testID="cart-share-whatsapp-btn"' in (
            MOBILE / "app/cart.tsx"
        ).read_text(encoding="utf-8")

    def test_web_ts_exports(self):
        web = (MOBILE / "lib/web.ts").read_text(encoding="utf-8")
        assert "export async function shareCartOnWhatsApp" in web
        assert "export function buildShareableCartUrl" in web
        assert "from 'expo-web-browser'" in web


# --- backend sanity --------------------------------------------------------
class TestBackendRegression:
    def test_app_config_schema_v2_with_tier_perks(self):
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["schema_version"] == "2"
        perks = data["retailer_tier_perks"]
        assert isinstance(perks, dict)
        for tier in ("novice", "bronze", "silver", "gold"):
            assert tier in perks

    def test_products_returns_catalog(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=60)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("products", [])
        assert len(items) > 0
        assert all(isinstance(i.get("name"), str) and i["name"] for i in items)
        assert "_id" not in items[0]
