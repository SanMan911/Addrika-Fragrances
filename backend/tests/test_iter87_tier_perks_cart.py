"""Iteration 87 — tier perks in app config/manifest + retailer patron tier regression."""
import os

import pytest
import requests
from dotenv import dotenv_values

next_env = dotenv_values("/app/frontend-next/.env.local")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or next_env.get("NEXT_PUBLIC_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

RETAILER_EMAIL = "test_b2b_retailer@example.com"
RETAILER_PASSWORD = "Test@12345"
TIERS = ["novice", "bronze", "silver", "gold"]


def _assert_tier_perks(perks):
    assert isinstance(perks, dict), f"retailer_tier_perks not a dict: {type(perks)}"
    for tier in TIERS:
        assert tier in perks, f"missing tier {tier}"
        entry = perks[tier]
        assert isinstance(entry, dict)
        assert isinstance(entry.get("label"), str) and entry["label"]
        assert isinstance(entry.get("medal"), str) and entry["medal"]
        plist = entry.get("perks")
        assert isinstance(plist, list) and len(plist) > 0, f"{tier} perks empty"
        assert all(isinstance(p, str) and p.strip() for p in plist)
    assert len(perks["gold"]["perks"]) >= 5, "gold needs >=5 perks"
    assert len(perks["silver"]["perks"]) >= 4, "silver needs >=4 perks"


# --- /api/app/config ---
class TestAppConfig:
    def test_config_schema_v2_and_tier_perks(self):
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("schema_version") == "2", data.get("schema_version")
        _assert_tier_perks(data.get("retailer_tier_perks"))
        # additive: existing keys still present
        for key in ("brand", "contact", "routes", "features", "impact", "catalog"):
            assert key in data, f"missing {key}"

    def test_manifest_schema_v2_and_tier_perks(self):
        r = requests.get(f"{BASE_URL}/api/app/manifest", timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("schema_version") == "2"
        _assert_tier_perks(data.get("retailer_tier_perks"))
        assert data["stable_endpoints"]["retailer_patron"] == "/api/retailer-dashboard/patron"

    def test_config_and_manifest_perks_identical(self):
        c = requests.get(f"{BASE_URL}/api/app/config", timeout=30).json()["retailer_tier_perks"]
        m = requests.get(f"{BASE_URL}/api/app/manifest", timeout=30).json()["retailer_tier_perks"]
        assert c == m


# --- retailer auth + patron tier ---
@pytest.fixture(scope="module")
def retailer_token():
    r = requests.post(
        f"{BASE_URL}/api/retailer-auth/login",
        json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.fail(f"retailer login failed {r.status_code}: {r.text[:400]}")
    token = r.json().get("token")
    if not token or not isinstance(token, str):
        pytest.fail(f"no token in login response: {r.text[:400]}")
    return token


class TestRetailerPatronTier:
    def test_login_regression(self, retailer_token):
        assert len(retailer_token) > 10

    def test_patron_tier_keys_into_perks(self, retailer_token):
        r = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/patron",
            headers={"Cookie": f"retailer_session={retailer_token}"},
            timeout=45,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        tier = data.get("tier")
        assert isinstance(tier, dict), f"tier missing/not dict: {data.keys()}"
        assert tier.get("id") in TIERS, tier
        perks = requests.get(f"{BASE_URL}/api/app/config", timeout=30).json()["retailer_tier_perks"]
        assert tier["id"] in perks
        assert len(perks[tier["id"]]["perks"]) >= 3, "current tier must have >=3 perks for hover card"

    def test_patron_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/retailer-dashboard/patron", timeout=30)
        assert r.status_code in (401, 403), r.status_code


# --- products endpoint used by cart deep-link hydration ---
class TestCartDeepLinkHydration:
    def test_products_contains_deeplink_ids(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=45)
        assert r.status_code == 200, r.text[:300]
        payload = r.json()
        items = payload if isinstance(payload, list) else payload.get("products", [])
        ids = {str(p.get("id")) for p in items}
        for pid in ("kesar-chandan", "regal-rose"):
            assert pid in ids, f"{pid} not in /api/products (deep-link hydration would fail)"
