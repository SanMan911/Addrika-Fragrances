"""iter94 — brand-audit hardening + literal-template fixes + mobile retailer
forgot-password WhatsApp deep link.

Covers:
  * scripts/brand-audit.js  — literal-${BRAND.name} rule + newline-preserving
    stripComments (probe files created + deleted inside the test).
  * frontend-next literal-template regressions (quoted-string + JSX one-liners).
  * REGRESSION FINDING (iter94): multi-line JSX text nodes that still carry a
    stray `$` before `{BRAND.name}` render as "$Addrika" — the audit misses
    them.  These tests are xfail-marked so the suite documents the open bug.
  * mobile/lib/web.ts openWhatsAppTo + mobile/app/login.tsx branches.
  * preview-host rendered checks (/retailer/login, /low-smoke-incense).
"""

import os
import re
import subprocess
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    base_url = "https://b2b-handoff.preview.emergentagent.com"
BASE_URL = base_url.rstrip("/")

REPO = Path("/app")
AUDIT = REPO / "scripts" / "brand-audit.js"
FRONTEND = REPO / "frontend-next"
MOBILE = REPO / "mobile"

LITERAL = "${BRAND.name}"


def run_audit():
    return subprocess.run(
        ["node", str(AUDIT)], capture_output=True, text=True, cwd=str(REPO)
    )


# --- scripts/brand-audit.js -------------------------------------------------
class TestBrandAudit:
    def test_audit_clean_on_current_tree(self):
        proc = run_audit()
        assert proc.returncode == 0, proc.stderr
        assert "0 hardcoded" in proc.stdout

    def test_literal_template_rule_catches_quoted_string(self):
        probe = FRONTEND / "components" / "__audit_probe_literal__.js"
        probe.write_text(
            "export const X = () => <p>{'Hi from ${BRAND.name}'}</p>;\n", encoding="utf-8"
        )
        try:
            proc = run_audit()
            assert proc.returncode == 1
            assert "[literal-${BRAND.name}]" in proc.stderr
            assert "__audit_probe_literal__.js:1" in proc.stderr
        finally:
            probe.unlink(missing_ok=True)
        assert run_audit().returncode == 0

    def test_strip_comments_preserves_newline_offsets(self):
        probe = FRONTEND / "components" / "__audit_probe_newlines__.js"
        probe.write_text("/*\n\n\n\n\n\n*/\nexport const Y = 'Addrika';\n", encoding="utf-8")
        try:
            proc = run_audit()
            assert proc.returncode == 1
            assert "__audit_probe_newlines__.js:8" in proc.stderr, proc.stderr
        finally:
            probe.unlink(missing_ok=True)
        assert run_audit().returncode == 0

    # iter95: FIXED — brand-audit Rule B (no backtick on line) now catches this.
    def test_literal_rule_catches_multiline_jsx_text(self):
        probe = FRONTEND / "components" / "__audit_probe_multiline__.js"
        probe.write_text(
            "export const Z = () => (\n  <p>\n    At ${BRAND.name}, quality matters\n  </p>\n);\n",
            encoding="utf-8",
        )
        try:
            proc = run_audit()
            assert proc.returncode == 1, "audit did not flag multi-line JSX literal"
        finally:
            probe.unlink(missing_ok=True)


# --- frontend-next literal-template fixes ----------------------------------
FIXED_FILES = [
    "app/retailer/login/page.js",
    "app/checkout/page.js",
    "app/blog/[slug]/page.js",
    "app/find-retailers/page.js",
    "app/low-smoke-incense/page.js",
    "app/products/[slug]/page.js",
    "app/retailer/b2b/orders/[order_id]/page.js",
    "components/NudgeComposerModal.js",
    "components/RetailerMap.js",
    "components/ZohoSyncHealthCard.js",
]

QUOTED_LITERAL = re.compile(r"""(['"])[^'"`\n]*\$\{BRAND\.name\}[^'"`\n]*\1""")


class TestFrontendLiteralTemplateFixes:
    @pytest.mark.parametrize("rel", FIXED_FILES)
    def test_no_quoted_literal_template(self, rel):
        src = (FRONTEND / rel).read_text(encoding="utf-8")
        offenders = [
            f"{i}: {ln.strip()}"
            for i, ln in enumerate(src.split("\n"), 1)
            if QUOTED_LITERAL.search(ln)
        ]
        assert offenders == [], offenders

    def test_retailer_login_uses_jsx_brand_name(self):
        src = (FRONTEND / "app/retailer/login/page.js").read_text(encoding="utf-8")
        assert "Back to {BRAND.name}" in src
        assert "contacted by the {BRAND.name} team" in src
        assert "an {BRAND.name} retail partner" in src

    # iter95: FIXED — 41 lines mechanically patched to {BRAND.name}.
    def test_no_stray_dollar_before_brand_name_in_jsx(self):
        offenders = []
        for path in FRONTEND.rglob("*.js"):
            if "node_modules" in path.parts or ".next" in path.parts:
                continue
            for i, ln in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
                if LITERAL in ln and "`" not in ln:
                    offenders.append(f"{path.relative_to(FRONTEND)}:{i}")
        assert offenders == [], offenders


# --- mobile/lib/web.ts ------------------------------------------------------
WEB_TS = (MOBILE / "lib" / "web.ts").read_text(encoding="utf-8")
LOGIN_TSX = (MOBILE / "app" / "login.tsx").read_text(encoding="utf-8")


class TestMobileWhatsAppHelper:
    def test_open_whatsapp_to_exported(self):
        assert "export async function openWhatsAppTo(" in WEB_TS
        assert "whatsapp://send?phone=${phoneNoPlus}&text=${encoded}" in WEB_TS
        assert "https://wa.me/${phoneNoPlus}?text=${encoded}" in WEB_TS
        assert "Linking.canOpenURL(waUrl)" in WEB_TS

    def test_share_cart_still_intact(self):
        assert "export async function shareCartOnWhatsApp(" in WEB_TS
        assert "whatsapp://send?text=${encodeURIComponent(message)}" in WEB_TS
        assert "buildShareableCartUrl" in WEB_TS


class TestMobileLoginForgotPassword:
    def test_import_and_branches(self):
        assert (
            "import { openCustomerSignup, openRetailerSignup, openWebUrl, openWhatsAppTo } from '../lib/web';"
            in LOGIN_TSX
        )
        assert "if (tab === 'customer') return openWebUrl('/forgot-password');" in LOGIN_TSX
        assert "openWhatsAppTo(" in LOGIN_TSX
        assert "'918377020402'" in LOGIN_TSX

    def test_label_switches_per_tab(self):
        assert "tab === 'customer' ? 'Forgot password?' : 'Message admin on WhatsApp'" in LOGIN_TSX
        assert 'testID="forgot-password-link"' in LOGIN_TSX

    def test_error_copy_mentions_mobile_number(self):
        assert "reset uses your registered mobile number" in LOGIN_TSX
        # iter95: retailer 401 copy now matches the actual button label.
        assert 'Tap "Message admin on WhatsApp"' in LOGIN_TSX


# --- preview-host rendered / API regressions -------------------------------
class TestPreviewHost:
    def test_retailer_login_html_has_no_literal(self):
        r = requests.get(f"{BASE_URL}/retailer/login", timeout=30)
        assert r.status_code == 200
        assert r.text.count(LITERAL) == 0

    def test_low_smoke_incense_html_has_no_literal(self):
        r = requests.get(f"{BASE_URL}/low-smoke-incense", timeout=30)
        assert r.status_code == 200
        assert r.text.count(LITERAL) == 0

    def test_app_config_schema_v2(self):
        r = requests.get(f"{BASE_URL}/api/app/config", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["schema_version"] == "2"
        assert "retailer_tier_perks" in data
        assert data["brand"]["name"]

    def test_products_catalogue(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=30)
        assert r.status_code == 200
        payload = r.json()
        products = payload if isinstance(payload, list) else payload.get("products", [])
        assert len(products) == 9
        names = [p.get("name") for p in products]
        assert "Belpatra" in names
        assert not any("Bambooless" in (n or "") for n in names)
        assert all("_id" not in p for p in products)
