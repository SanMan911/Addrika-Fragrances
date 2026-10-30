# B2B pre-payment gate, checkout intents, dues killswitch, payment proofs, admin desk (iter127)
import os
import subprocess
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
GSTIN = "07AAAAA0000A1Z5"
PWD = "Test@12345"
RID = "RTL_TEST_B2B"
SKU = "regal-rose-b2b"
CART = {"items": [{"product_id": SKU, "quantity_boxes": 1}], "include_shipping": False}


def _mongo(js):
    return subprocess.run(
        ["mongosh", "--quiet", "mongodb://localhost:27017/addrika_db", "--eval", js],
        capture_output=True, text=True,
    ).stdout.strip()


@pytest.fixture(scope="module")
def rh():
    r = requests.post(f"{BASE_URL}/api/retailer-auth/login", json={"gstin": GSTIN, "password": PWD})
    if r.status_code != 200:
        pytest.skip(f"retailer login failed {r.status_code}")
    return {"Cookie": f"retailer_session={r.json()['token']}"}


@pytest.fixture(scope="module")
def ah():
    r = requests.post(f"{BASE_URL}/api/admin/login/initiate",
                      json={"email": "contact.us@centraders.com", "pin": "050499"})
    if r.status_code != 200:
        pytest.skip(f"admin initiate failed {r.status_code} {r.text[:200]}")
    tid = r.json()["token_id"]
    time.sleep(0.5)
    otp = _mongo(f'print(db.admin_2fa_tokens.findOne({{token_id:"{tid}"}}).otp)')
    v = requests.post(f"{BASE_URL}/api/admin/login/verify-otp", json={"token_id": tid, "otp": otp})
    if v.status_code != 200:
        pytest.skip(f"admin otp failed {v.status_code}")
    tok = v.json().get("session_token") or v.json().get("token")
    return {"Cookie": f"session_token={tok}"}


@pytest.fixture(scope="module", autouse=True)
def restore_settings(ah):
    yield
    requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                 json={"prepayment_required": True, "dues_killswitch_enabled": False,
                       "dues_grace_days": 30, "min_payment_percent": 70})
    requests.post(f"{BASE_URL}/api/admin/b2b-payments/retailers/{RID}/block", headers=ah,
                  json={"blocked": False})


# --- Gate status ---
def test_gate_status(rh):
    r = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh)
    assert r.status_code == 200
    d = r.json()
    assert d["prepayment_required"] is True
    assert d["allowed_payment_percents"] == [70, 80, 90, 100]
    assert d["can_order"] is True
    assert "dues" in d and "outstanding_amount" in d["dues"]


def test_direct_order_402(rh):
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/order", headers=rh, json=CART)
    assert r.status_code == 402, r.text
    assert "pay" in r.json()["detail"].lower()


def test_intent_below_min_400(rh):
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 50})
    assert r.status_code == 400
    det = r.json()["detail"]
    assert "70%" in det and "100%" in det and "50%" not in det


def test_intent_75_rejected(rh):
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 75})
    assert r.status_code == 400


# --- Intents & forged amount ---
def test_intent_70_no_order_created_and_forged_amount_ignored(rh):
    before = int(_mongo(f'print(db.b2b_orders.countDocuments({{retailer_id:"{RID}"}}))'))
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 70, "amount": 1, "amount_due_now": 1,
                            "grand_total": 1, "apply_cash_discount": True})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["awaiting_gateway"] is True and d["payment_url"] is None
    assert d["amount_due_now"] == round(d["grand_total"] * 0.7, 2)
    assert d["amount_due_now"] > 1
    assert abs(d["amount_due_now"] + d["balance_after_payment"] - d["grand_total"]) < 0.02
    after = int(_mongo(f'print(db.b2b_orders.countDocuments({{retailer_id:"{RID}"}}))'))
    assert after == before
    doc = _mongo(f'print(db.b2b_order_intents.findOne({{intent_id:"{d["intent_id"]}"}}).cash_discount)')
    assert float(doc) == 0.0  # forged apply_cash_discount ignored at 70%
    pytest.intent70 = d


def test_intent_100_cash_discount(rh):
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 100})
    assert r.status_code == 200
    d = r.json()
    assert d["balance_after_payment"] == 0
    assert d["grand_total"] < pytest.intent70["grand_total"]
    pytest.intent100 = d


# --- Admin desk ---
def test_admin_settings_validation(ah):
    r = requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"min_payment_percent": 50})
    assert r.status_code == 400
    r = requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"dues_grace_days": 400})
    assert r.status_code == 422


def test_admin_unauth():
    r = requests.get(f"{BASE_URL}/api/admin/b2b-payments/settings")
    assert r.status_code in (401, 403)


def test_admin_list_intents(ah):
    r = requests.get(f"{BASE_URL}/api/admin/b2b-payments/intents", headers=ah)
    assert r.status_code == 200
    ids = [i["intent_id"] for i in r.json()["intents"]]
    assert pytest.intent70["intent_id"] in ids


def test_admin_confirm_intent_70_partial(ah):
    iid = pytest.intent70["intent_id"]
    r = requests.post(f"{BASE_URL}/api/admin/b2b-payments/intents/{iid}/confirm", headers=ah,
                      json={"payment_reference": "TEST_UTR70"})
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    o = _mongo(f'const o=db.b2b_orders.findOne({{order_id:"{oid}"}}); print(o.payment_status+"|"+o.amount_paid+"|"+o.upfront_payment_percent+"|"+o.balance_outstanding)')
    status, paid, pct, bal = o.split("|")
    assert status == "partially_paid" and int(pct) == 70
    assert abs(float(paid) - pytest.intent70["amount_due_now"]) < 0.02
    assert float(bal) > 0
    # idempotent
    r2 = requests.post(f"{BASE_URL}/api/admin/b2b-payments/intents/{iid}/confirm", headers=ah,
                       json={"payment_reference": "TEST_UTR70"})
    assert r2.status_code == 200 and r2.json()["order_id"] == oid


def test_admin_confirm_intent_100_paid(ah):
    iid = pytest.intent100["intent_id"]
    r = requests.post(f"{BASE_URL}/api/admin/b2b-payments/intents/{iid}/confirm", headers=ah,
                      json={"payment_reference": "TEST_UTR100"})
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    st = _mongo(f'print(db.b2b_orders.findOne({{order_id:"{oid}"}}).payment_status)')
    assert st == "paid"


# --- Killswitch ---
def test_killswitch_blocks(ah, rh):
    r = requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"dues_killswitch_enabled": True, "dues_grace_days": 0})
    assert r.status_code == 200 and r.json()["dues_killswitch_enabled"] is True
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g["can_order"] is False and g["block"]["kind"] == "dues"
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 100})
    assert r.status_code == 403
    rl = requests.get(f"{BASE_URL}/api/admin/b2b-payments/retailers", headers=ah).json()
    row = [x for x in rl["retailers"] if x["retailer_id"] == RID][0]
    assert row["locked_by_killswitch"] is True
    requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                 json={"dues_killswitch_enabled": False, "dues_grace_days": 30})
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g["can_order"] is True


# --- Manual lock + proof verify clears it ---
def test_manual_lock_and_proof_verify(ah, rh):
    r = requests.post(f"{BASE_URL}/api/admin/b2b-payments/retailers/{RID}/block", headers=ah,
                      json={"blocked": True, "note": "TEST_lock"})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g["can_order"] is False and g["block"]["kind"] == "manual" and "TEST_lock" in g["block"]["reason"]
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**CART, "payment_percent": 100})
    assert r.status_code == 403
    p = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                      json={"mode": "neft_rtgs", "reference": "TEST_UTR_PROOF1", "paid_on": "2026-10-29",
                            "amount": 500})
    assert p.status_code == 200, p.text
    pid = p.json()["proof_id"]
    assert p.json()["status"] == "pending"
    hist = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proofs", headers=rh).json()
    assert pid in [x["proof_id"] for x in hist["proofs"]]
    v = requests.post(f"{BASE_URL}/api/admin/b2b-payments/proofs/{pid}/review", headers=ah,
                      json={"approve": True})
    assert v.status_code == 200 and v.json()["proof"]["status"] == "verified"
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g["can_order"] is True
    v2 = requests.post(f"{BASE_URL}/api/admin/b2b-payments/proofs/{pid}/review", headers=ah,
                       json={"approve": False})
    assert v2.status_code == 400


def test_proof_reject_and_validation(ah, rh):
    bad = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                        json={"mode": "bitcoin", "reference": "TEST_X1234", "paid_on": "2026-10-29", "amount": 5})
    assert bad.status_code == 400
    bad = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                        json={"mode": "upi", "reference": "TEST_X1234", "paid_on": "29/10/2026", "amount": 5})
    assert bad.status_code == 400
    p = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                      json={"mode": "upi", "reference": "TEST_UTR_REJ", "paid_on": "2026-10-29", "amount": 10})
    pid = p.json()["proof_id"]
    v = requests.post(f"{BASE_URL}/api/admin/b2b-payments/proofs/{pid}/review", headers=ah,
                      json={"approve": False, "admin_note": "TEST reject"})
    assert v.status_code == 200 and v.json()["proof"]["status"] == "rejected"


# --- Regression: gate off ---
def test_gate_off_classic_order(ah, rh):
    r = requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"prepayment_required": False})
    assert r.status_code == 200 and r.json()["prepayment_required"] is False
    try:
        g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
        assert g["prepayment_required"] is False
        o = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/order", headers=rh, json=CART)
        assert o.status_code == 200, o.text
        assert o.json().get("order_id") or o.json().get("order", {}).get("order_id")
    finally:
        requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"prepayment_required": True})
