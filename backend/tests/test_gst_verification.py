"""Tests for the GST-verification service Appyflow integration."""
from __future__ import annotations

from services.gst_verification import (
    _shape_appyflow,
    _shape_legacy,
    normalize_business_name,
    match_business_names,
)


class TestShapeAppyflow:
    def test_active_taxpayer_shape(self):
        payload = {
            "taxpayerInfo": {
                "lgnm": "Reliance Industries Limited",
                "tradeNam": "RIL",
                "sts": "Active",
                "rgdt": "01/07/2017",
                "stj": "Maharashtra",
                "dty": "Regular",
                "ctb": "Public Sector Undertaking",
                "pradr": {
                    "addr": {
                        "bnm": "Reliance Tower",
                        "loc": "Andheri",
                        "city": "Mumbai",
                        "stcd": "Maharashtra",
                        "pncd": "400001",
                    }
                },
            }
        }
        out = _shape_appyflow(payload, "27AAACR5055K1Z7")
        assert out["verified"] is True
        assert out["provider"] == "appyflow"
        assert out["taxpayer_name"] == "Reliance Industries Limited"
        assert out["trade_name"] == "RIL"
        assert out["is_active"] is True
        assert "Mumbai" in out["address"]
        assert out["state_code"] == "27"

    def test_missing_taxpayer_returns_unverified(self):
        out = _shape_appyflow({"error": True, "message": "Not found"}, "X")
        assert out["verified"] is False
        assert "Not found" in out["error"]


class TestShapeLegacy:
    def test_legacy_active(self):
        payload = {
            "flag": True,
            "data": {
                "lgnm": "X Co", "tradeNam": "X", "sts": "Active",
                "rgdt": "", "stj": "Delhi", "dty": "", "ctb": "",
                "pradr": {"addr": {"city": "Delhi"}},
            },
        }
        out = _shape_legacy(payload, "07AAAAA0000A1Z5")
        assert out["verified"] is True
        assert out["is_active"] is True
        assert out["provider"] == "gstincheck"

    def test_legacy_unverified(self):
        out = _shape_legacy({"flag": False, "message": "missing"}, "X")
        assert out["verified"] is False


class TestBusinessNameMatching:
    def test_normalize_strips_suffixes(self):
        assert normalize_business_name("Reliance Pvt Ltd") == "RELIANCE"

    def test_exact_legal_name_match(self):
        m = match_business_names("Acme Co", "Acme Co", "")
        assert m["matched"] is True and m["match_score"] == 100

    def test_partial_match(self):
        m = match_business_names("Acme", "Acme Industries Co", "")
        assert m["matched"] is True
        assert m["match_score"] >= 80

    def test_no_match(self):
        m = match_business_names("Foo", "Bar", "")
        assert m["matched"] is False
