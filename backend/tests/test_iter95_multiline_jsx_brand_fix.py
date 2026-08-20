"""iter95: multi-line JSX ${BRAND.name} fix + brand-audit Rule B + mobile login copy alignment."""
import json
import os
import re
import subprocess
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend-next/.env.local")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("NEXT_PUBLIC_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("Backend URL missing from env")
BASE_URL = base_url.rstrip("/")

FE = Path("/app/frontend-next")
MOBILE = Path("/app/mobile")
LITERAL = "${BRAND.name}"


# ---------- Module: multi-line JSX literal-template sweep (source level) ----------
class TestNoBacktickLessLiterals:
    def _offenders(self, roots):
        bad = []
        for root in roots:
            for path in (FE / root).rglob("*"):
                if path.suffix not in {".js", ".jsx", ".ts", ".tsx"} or not path.is_file():
                    continue
                for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                    if LITERAL in line and "`" not in line:
                        bad.append(f"{path}:{i}: {line.strip()}")
        return bad

    def test_whole_tree_has_no_backtickless_literal(self):
        assert self._offenders(["app", "components", "context", "lib"]) == []

    @pytest.mark.parametrize(
        "rel",
        [
            "app/our-quality/page.js",
            "app/why-choose-addrika/page.js",
            "app/why-zero-charcoal/page.js",
            "app/ingredients/page.js",
            "app/low-smoke-incense/page.js",
            "app/find-retailers/page.js",
            "app/blog/page.js",
            "app/community/page.js",
            "app/retailer/admin-chat/page.js",
            "app/retailer/bills/page.js",
            "app/retailer/b2b/rewards/page.js",
            "components/CSRSection.js",
            "components/NudgeComposerModal.js",
        ],
    )
    def test_patched_file_clean(self, rel):
        path = FE / rel
        assert path.exists(), f"missing {rel}"
        offenders = [
            f"{i}: {ln.strip()}"
            for i, ln in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
            if LITERAL in ln and "`" not in ln
        ]
        assert offenders == [], f"{rel} still has literal-template lines: {offenders}"


# ---------- Module: brand-audit.js Rule B ----------
class TestBrandAuditRuleB:
    def _run(self):
        return subprocess.run(
            ["node", "/app/scripts/brand-audit.js"],
            cwd=str(FE), capture_output=True, text=True, timeout=120,
        )

    def test_audit_clean_on_current_tree(self):
        res = self._run()
        assert res.returncode == 0, res.stdout + res.stderr
        assert "0 hardcoded" in res.stdout

    def test_audit_catches_multiline_jsx_probe(self):
        probe = FE / "components" / "__audit_probe_iter95__.js"
        probe.write_text(
            "export default function P() {\n"
            "  return (\n"
            "    <p>\n"
            "      Hello ${BRAND.name}, welcome\n"
            "    </p>\n"
            "  );\n"
            "}\n",
            encoding="utf-8",
        )
        try:
            res = self._run()
            out = res.stdout + res.stderr
            assert res.returncode == 1, f"audit should fail; got {res.returncode}\n{out}"
            assert "[literal-${BRAND.name}]" in out
            assert "__audit_probe_iter95__.js" in out
        finally:
            probe.unlink(missing_ok=True)
        after = self._run()
        assert after.returncode == 0, after.stdout


# ---------- Module: mobile login copy alignment ----------
class TestMobileLoginCopy:
    login = (MOBILE / "app" / "login.tsx").read_text(encoding="utf-8")

    def test_error_copy_matches_button_label(self):
        assert self.login.count("Message admin on WhatsApp") >= 2
        assert 'Tap "Message admin on WhatsApp"' in self.login
        assert "Contact admin to reset" not in self.login

    def test_whatsapp_message_uses_brand_constant(self):
        assert "Centraders/Aaroviah" not in self.login
        assert "MOBILE_BRAND_NAME" in self.login
        msg = re.search(r"resetting my B2B password", self.login)
        assert msg, "retailer whatsapp reset message missing"


# ---------- Module: mobile config immutability ----------
class TestMobileConfigUnchanged:
    def test_app_json(self):
        cfg = json.loads((MOBILE / "app.json").read_text())["expo"]
        assert cfg["slug"] == "aaroviah-mobile"
        assert cfg["extra"]["eas"]["projectId"].startswith("f152117c-")

    def test_eas_json_has_no_env_blocks(self):
        eas = json.loads((MOBILE / "eas.json").read_text())
        profiles = eas["build"]
        assert set(profiles) >= {"development", "preview", "production"}
        for name, prof in profiles.items():
            assert "env" not in prof, f"{name} profile must not embed env"


# ---------- Module: backend regressions ----------
class TestBackendRegressions:
    def test_app_config(self):
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert str(data.get("schema_version")) == "2", data.get("schema_version")
        assert "retailer_tier_perks" in data

    def test_products(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=30)
        assert r.status_code == 200
        items = r.json()
        items = items.get("products", items) if isinstance(items, dict) else items
        assert len(items) == 9, f"expected 9 products, got {len(items)}"
        blob = json.dumps(items)
        assert "_id" not in blob, "MongoDB _id leaked in /api/products"
        assert "Belpatra" in blob
        assert "bambooless-dhoop-8inch" not in blob
