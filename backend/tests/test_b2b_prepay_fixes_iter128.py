# iter128 RETEST of iter127 fixes: confirm-amount guard, intent dedupe, atomic confirm, bypass-lock confirm,
# include_all dues list, cross-retailer proof, FIFO general-proof settlement unlocking killswitch, mobile v2.
import os
import subprocess
import threading
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
GSTIN = "07AAAAA0000A1Z5"
PWD = "Test@12345"
RID = "RTL_TEST_B2B"
SKU = "regal-rose-b2b"


def cart(boxes=1):
    return {"items": [{"product_id": SKU, "quantity_boxes": boxes}], "include_shipping": False}


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
        pytest.skip(f"admin initiate failed {r.status_code}")
    tid = r.json()["token_id"]
    time.sleep(0.5)
    otp = _mongo(f'print(db.admin_2fa_tokens.findOne({{token_id:"{tid}"}}).otp)')
    v = requests.post(f"{BASE_URL}/api/admin/login/verify-otp", json={"token_id": tid, "otp": otp})
    if v.status_code != 200:
        pytest.skip("admin otp failed")
    return {"Cookie": f"session_token={v.json().get('session_token') or v.json().get('token')}"}


@pytest.fixture(scope="module")
def mh():
    path = "/app/memory/.qa_refresh_token"
    try:
        rt = open(path).read().strip()
        r = requests.post(
            "https://qzzwaqwgzvrdecheunpn.supabase.co/auth/v1/token?grant_type=refresh_token",
            headers={"apikey": "sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4",
                     "Content-Type": "application/json"},
            json={"refresh_token": rt}, timeout=20)
        d = r.json()
        if r.status_code != 200 or "access_token" not in d:
            pytest.skip(f"mobile refresh failed {r.status_code}")
        open(path, "w").write(d["refresh_token"])
        return {"Authorization": f"Bearer {d['access_token']}"}
    except Exception as e:
        pytest.skip(f"mobile session error {e}")


@pytest.fixture(scope="module", autouse=True)
def restore(ah):
    yield
    requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                 json={"prepayment_required": True, "dues_killswitch_enabled": False,
                       "dues_grace_days": 30, "min_payment_percent": 70})
    requests.post(f"{BASE_URL}/api/admin/b2b-payments/retailers/{RID}/block", headers=ah,
                  json={"blocked": False})


def _intent(rh, pct=70, boxes=1):
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/checkout-intent", headers=rh,
                      json={**cart(boxes), "payment_percent": pct})
    assert r.status_code == 200, r.text
    return r.json()


def _confirm(ah, iid, **body):
    return requests.post(f"{BASE_URL}/api/admin/b2b-payments/intents/{iid}/confirm", headers=ah,
                         json={"payment_reference": "TEST_UTR128", **body})


# --- Intent dedupe ---
def test_intent_dedupe_same_cart_same_percent(rh):
    a = _intent(rh, 80, 3)
    b = _intent(rh, 80, 3)
    assert a["intent_id"] == b["intent_id"]
    c = _intent(rh, 90, 3)
    assert c["intent_id"] != a["intent_id"]
    n = int(_mongo(f'print(db.b2b_order_intents.countDocuments({{retailer_id:"{RID}",status:"awaiting_payment",payment_percent:80,"order_payload.items.quantity_boxes":3}}))') or 0)
    assert n == 1
    pytest.dedupe = a


# --- Confirm amount guard ---
@pytest.mark.parametrize("amt", [-5, 0])
def test_confirm_rejects_non_positive(ah, rh, amt):
    iid = pytest.dedupe["intent_id"]
    r = _confirm(ah, iid, amount=amt)
    assert r.status_code == 422, r.text
    assert "greater than 0" in r.text
    st = _mongo(f'print(db.b2b_order_intents.findOne({{intent_id:"{iid}"}}).status)')
    assert st == "awaiting_payment"


def test_confirm_rejects_underpay(ah):
    iid = pytest.dedupe["intent_id"]
    due = pytest.dedupe["amount_due_now"]
    r = _confirm(ah, iid, amount=round(due - 10, 2))
    assert r.status_code == 400, r.text
    det = r.json()["detail"]
    assert f"{due:,.2f}" in det and f"{due - 10:,.2f}" in det
    st = _mongo(f'print(db.b2b_order_intents.findOne({{intent_id:"{iid}"}}).status)')
    assert st == "awaiting_payment"


def test_confirm_with_exact_amount_ok_and_already_confirmed(ah):
    iid = pytest.dedupe["intent_id"]
    r = _confirm(ah, iid, amount=pytest.dedupe["amount_due_now"])
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    st = _mongo(f'const o=db.b2b_orders.findOne({{order_id:"{oid}"}}); print(o.payment_status+"|"+o.upfront_payment_percent)')
    assert st == "partially_paid|80"
    r2 = _confirm(ah, iid)
    assert r2.status_code == 200
    assert r2.json()["order_id"] == oid and r2.json().get("already_confirmed") is True


def test_confirm_overpay_ok(ah, rh):
    it = _intent(rh, 90, 3)
    r = _confirm(ah, it["intent_id"], amount=it["amount_due_now"] + 100)
    assert r.status_code == 200, r.text


# --- Atomic concurrent confirm ---
def test_concurrent_confirm_single_order(ah, rh):
    it = _intent(rh, 70, 2)
    iid = it["intent_id"]
    results = []

    def go():
        results.append(_confirm(ah, iid))

    ts = [threading.Thread(target=go) for _ in range(4)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    codes = [r.status_code for r in results]
    print("concurrent codes", codes, [r.text[:120] for r in results])
    assert codes.count(200) >= 1
    assert all(c in (200, 400, 409) for c in codes)
    n = int(_mongo(f'print(db.b2b_orders.countDocuments({{client_ref:"{iid}"}}))'))
    assert n == 1, f"{n} orders for {iid}"
    oids = {r.json()["order_id"] for r in results if r.status_code == 200}
    assert len(oids) == 1


# --- Bypass lock on confirm ---
def test_confirm_while_manually_locked(ah, rh):
    it = _intent(rh, 100, 2)
    r = requests.post(f"{BASE_URL}/api/admin/b2b-payments/retailers/{RID}/block", headers=ah,
                      json={"blocked": True, "note": "TEST_lock128"})
    assert r.status_code == 200
    try:
        g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
        assert g["can_order"] is False
        c = _confirm(ah, it["intent_id"])
        assert c.status_code == 200, c.text
        assert c.json()["order_id"]
    finally:
        requests.post(f"{BASE_URL}/api/admin/b2b-payments/retailers/{RID}/block", headers=ah,
                      json={"blocked": False})


# --- include_all ---
def test_retailers_include_all(ah):
    a = requests.get(f"{BASE_URL}/api/admin/b2b-payments/retailers", headers=ah).json()["retailers"]
    b = requests.get(f"{BASE_URL}/api/admin/b2b-payments/retailers?include_all=true", headers=ah).json()["retailers"]
    assert len(b) >= len(a)
    assert any(x["outstanding_amount"] == 0 for x in b)
    assert all(x["outstanding_amount"] > 0 or x.get("ordering_blocked") for x in a)


# --- Cross-retailer proof ---
def test_proof_foreign_order_400(rh):
    foreign = _mongo(f'const o=db.b2b_orders.findOne({{retailer_id:{{$ne:"{RID}"}}}},{{order_id:1}}); print(o?o.order_id:"")')
    if not foreign:
        foreign = "B2B-NOPE-000000"
    r = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                      json={"mode": "upi", "reference": "TEST_FOREIGN", "paid_on": "2026-01-10",
                            "amount": 10, "order_id": foreign})
    assert r.status_code == 400
    assert r.json()["detail"] == "That order number does not belong to your account"


# --- FIFO general proof unlocks killswitch ---
def test_general_proof_settles_fifo_and_unlocks(ah, rh):
    s = requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                     json={"dues_killswitch_enabled": True, "dues_grace_days": 0})
    assert s.status_code == 200
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g["can_order"] is False and g["block"]["kind"] == "dues", g
    outstanding = g["dues"]["outstanding_amount"]
    assert outstanding > 0
    # partial proof first -> still blocked
    p1 = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                       json={"mode": "neft_rtgs", "reference": "TEST_FIFO_PART", "paid_on": "2026-01-10",
                             "amount": 1})
    v1 = requests.post(f"{BASE_URL}/api/admin/b2b-payments/proofs/{p1.json()['proof_id']}/review",
                       headers=ah, json={"approve": True}).json()
    assert v1["can_order_now"] is False and v1["still_blocked"]["kind"] == "dues"
    assert len(v1["settled_orders"]) == 1 and abs(v1["settled_orders"][0]["applied"] - 1) < 0.01
    # full proof
    g = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    p = requests.post(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-proof", headers=rh,
                      json={"mode": "neft_rtgs", "reference": "TEST_FIFO_FULL", "paid_on": "2026-01-10",
                            "amount": g["dues"]["outstanding_amount"]})
    assert p.status_code == 200
    v = requests.post(f"{BASE_URL}/api/admin/b2b-payments/proofs/{p.json()['proof_id']}/review",
                      headers=ah, json={"approve": True})
    assert v.status_code == 200, v.text
    d = v.json()
    assert d["can_order_now"] is True and d["still_blocked"] is None
    assert len(d["settled_orders"]) >= 1
    g2 = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/payment-gate", headers=rh).json()
    assert g2["can_order"] is True and g2["dues"]["outstanding_amount"] == 0
    requests.put(f"{BASE_URL}/api/admin/b2b-payments/settings", headers=ah,
                 json={"dues_killswitch_enabled": False, "dues_grace_days": 30})


# --- Mobile v2 ---
def test_mobile_gate_and_intent(mh):
    g = requests.get(f"{BASE_URL}/api/app/v2/payment-gate", headers=mh)
    assert g.status_code == 200 and g.json()["allowed_payment_percents"] == [70, 80, 90, 100]
    bad = requests.post(f"{BASE_URL}/api/app/v2/orders/checkout-intent", headers=mh,
                        json={"items": [{"product_id": SKU, "quantity_boxes": 1}],
                              "payment_percent": 50})
    assert bad.status_code == 400
    ok = requests.post(f"{BASE_URL}/api/app/v2/orders/checkout-intent", headers=mh,
                       json={"items": [{"product_id": SKU, "quantity_boxes": 1}],
                             "payment_percent": 70})
    print("mobile intent", ok.status_code, ok.text[:300])
    assert ok.status_code in (200, 400)
    if ok.status_code == 200:
        d = ok.json()
        assert d["awaiting_gateway"] is True and d["payment_url"] is None
        ok2 = requests.post(f"{BASE_URL}/api/app/v2/orders/checkout-intent", headers=mh,
                            json={"items": [{"product_id": SKU, "quantity_boxes": 1}],
                                  "payment_percent": 70})
        assert ok2.json()["intent_id"] == d["intent_id"]


def test_mobile_proofs(mh):
    p = requests.post(f"{BASE_URL}/api/app/v2/payment-proofs", headers=mh,
                      json={"mode": "upi", "reference": "TEST_MOB128", "paid_on": "2026-01-10", "amount": 5})
    assert p.status_code == 200, p.text
    f = requests.post(f"{BASE_URL}/api/app/v2/payment-proofs", headers=mh,
                      json={"mode": "upi", "reference": "TEST_MOB128F", "paid_on": "2026-01-10", "amount": 5,
                            "order_id": "B2B-FOREIGN-XYZ"})
    assert f.status_code == 400
    h = requests.get(f"{BASE_URL}/api/app/v2/payment-proofs", headers=mh).json()
    assert p.json()["proof_id"] in [x["proof_id"] for x in h["proofs"]]
