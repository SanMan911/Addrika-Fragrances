"""ITER130 — admin destructive actions: user/retailer/grievance delete, tree-donation reset,
profile-change-ticket review/delete/reset. All successful-delete cases use throwaway TEST_ rows."""
import os
import json
import subprocess
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = "https://aarohmm-partner--18pkutrq.preview.emergentagent.com"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")
NOW = datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def s(db):
    r = requests.post(f"{BASE_URL}/api/admin/login/initiate", json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}, timeout=30)
    assert r.status_code == 200, r.text
    tid = r.json()["token_id"]
    otp = db.admin_2fa_tokens.find_one({"token_id": tid})["otp"]
    v = requests.post(f"{BASE_URL}/api/admin/login/verify-otp", json={"token_id": tid, "otp": otp}, timeout=30)
    assert v.status_code == 200, v.text
    tok = v.json().get("session_token")
    open("/tmp/iter130_admin_token", "w").write(tok)
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


# ---------------- Users ----------------
class TestUserDelete:
    def test_user_without_orders_deleted(self, s, db):
        uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
        email = f"{uid.lower()}@example.com"
        db.users.insert_one({"user_id": uid, "email": email, "name": "TEST throwaway", "created_at": NOW})
        r = s.delete(f"{BASE_URL}/api/admin/users/{uid}", params={"confirm_email": "wrong@x.com"})
        assert r.status_code == 400
        r = s.delete(f"{BASE_URL}/api/admin/users/{uid}", params={"confirm_email": email.upper()})
        assert r.status_code == 200, r.text
        assert db.users.find_one({"user_id": uid}) is None
        lst = s.get(f"{BASE_URL}/api/admin/users").json()
        users = lst.get("users", lst) if isinstance(lst, dict) else lst
        assert not any(u.get("email") == email for u in users)

    def test_user_with_orders_blocked(self, s, db):
        uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
        email = f"{uid.lower()}@example.com"
        db.users.insert_one({"user_id": uid, "email": email, "name": "TEST with order", "created_at": NOW})
        db.orders.insert_one({"order_number": f"TEST_ORD_{uid}", "user_id": uid, "shipping": {"email": email}, "created_at": NOW})
        try:
            r = s.delete(f"{BASE_URL}/api/admin/users/{uid}", params={"confirm_email": email})
            assert r.status_code == 409, r.text
            assert "1 order" in r.json()["detail"]
            assert db.users.find_one({"user_id": uid}) is not None
        finally:
            db.orders.delete_many({"order_number": f"TEST_ORD_{uid}"})
            db.users.delete_many({"user_id": uid})

    def test_user_unknown_404(self, s):
        r = s.delete(f"{BASE_URL}/api/admin/users/TEST_nope_xyz", params={"confirm_email": "a@b.c"})
        assert r.status_code == 404


# ---------------- Retailers ----------------
class TestRetailerDelete:
    def test_retailer_without_orders_deleted_with_cascade(self, s, db):
        rid = f"RTL_TEST_DEL_{uuid.uuid4().hex[:6].upper()}"
        name = "TEST_Throwaway Shop"
        db.retailers.insert_one({"retailer_id": rid, "business_name": name, "email": f"{rid.lower()}@example.com",
                                 "status": "active", "created_at": NOW})
        db.retailer_complaints.insert_one({"complaint_id": f"CMP-{rid}", "retailer_id": rid, "subject": "TEST"})
        db.profile_change_tickets.insert_one({"ticket_id": f"PCT-{rid}", "retailer_id": rid, "status": "pending", "created_at": NOW})
        db.retailer_sessions.insert_one({"retailer_id": rid, "session_token": "TEST"})
        r = s.delete(f"{BASE_URL}/api/retailers/admin/{rid}", params={"permanent": "true", "confirm_name": "wrong"})
        assert r.status_code == 400
        r = s.delete(f"{BASE_URL}/api/retailers/admin/{rid}", params={"permanent": "true", "confirm_name": name})
        assert r.status_code == 200, r.text
        assert r.json()["deletion_type"] == "permanent"
        assert db.retailers.find_one({"retailer_id": rid}) is None
        for c in ("retailer_complaints", "profile_change_tickets", "retailer_sessions"):
            assert db[c].count_documents({"retailer_id": rid}) == 0, c

    def test_retailer_with_b2b_orders_blocked(self, s, db):
        rid = f"RTL_TEST_DEL_{uuid.uuid4().hex[:6].upper()}"
        name = "TEST_Shop With Orders"
        db.retailers.insert_one({"retailer_id": rid, "business_name": name, "status": "active", "created_at": NOW})
        db.b2b_orders.insert_one({"order_id": f"TEST_B2B_{rid}", "retailer_id": rid, "created_at": NOW})
        try:
            r = s.delete(f"{BASE_URL}/api/retailers/admin/{rid}", params={"permanent": "true", "confirm_name": name})
            assert r.status_code == 409, r.text
            d = r.json()["detail"]
            assert "1 order" in d and "Suspend" in d
            assert db.retailers.find_one({"retailer_id": rid}) is not None
        finally:
            db.b2b_orders.delete_many({"retailer_id": rid})
            db.retailers.delete_many({"retailer_id": rid})

    def test_protected_rtl_test_b2b_blocked(self, s, db):
        r = db.retailers.find_one({"retailer_id": "RTL_TEST_B2B"})
        resp = s.delete(f"{BASE_URL}/api/retailers/admin/RTL_TEST_B2B",
                        params={"permanent": "true", "confirm_name": r.get("business_name")})
        assert resp.status_code == 409
        assert db.retailers.find_one({"retailer_id": "RTL_TEST_B2B"}) is not None


# ---------------- Grievances ----------------
def _supa(*args):
    out = subprocess.run(["python", "/app/backend/tests/_iter130_supa_helper.py", *args], capture_output=True,
                         text=True, cwd="/app/backend", env={**os.environ, "PYTHONPATH": "/app/backend"}, timeout=60)
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout.strip().splitlines()[-1])


class TestGrievanceDelete:
    def test_supabase_grievance_delete_cascade(self, s):
        gid = _supa("create")["id"]
        before = _supa("count", gid)
        assert before == {"app_grievances": 1, "app_grievance_messages": 1, "app_grievance_images": 1}
        r = s.delete(f"{BASE_URL}/api/admin/app-support/grievances/{gid}", params={"confirm": "nope"})
        assert r.status_code == 400
        r = s.delete(f"{BASE_URL}/api/admin/app-support/grievances/{gid}", params={"confirm": "DELETE"})
        assert r.status_code == 200, r.text
        assert _supa("count", gid) == {"app_grievances": 0, "app_grievance_messages": 0, "app_grievance_images": 0}

    def test_supabase_grievance_unknown_uuid_404(self, s):
        r = s.delete(f"{BASE_URL}/api/admin/app-support/grievances/{uuid.uuid4()}", params={"confirm": "DELETE"})
        assert r.status_code == 404

    def test_supabase_grievance_non_uuid_id(self, s):
        r = s.delete(f"{BASE_URL}/api/admin/app-support/grievances/not-a-uuid", params={"confirm": "DELETE"})
        assert r.status_code in (400, 404), f"non-uuid id gave {r.status_code}: {r.text[:200]}"

    def test_mongo_grievance_delete(self, s, db):
        cid = f"CMP-TEST{uuid.uuid4().hex[:6].upper()}"
        db.retailer_complaints.insert_one({"complaint_id": cid, "retailer_id": "RTL_DELHI001", "subject": "TEST_del"})
        r = s.delete(f"{BASE_URL}/api/admin/retailers/grievances/{cid}")
        assert r.status_code == 200, r.text
        assert db.retailer_complaints.find_one({"complaint_id": cid}) is None
        r = s.delete(f"{BASE_URL}/api/admin/retailers/grievances/{cid}")
        assert r.status_code == 404


# ---------------- Tree donations ----------------
class TestTreeReset:
    def test_guards(self, s):
        u = f"{BASE_URL}/api/admin/tree-donations/reset"
        assert s.post(u, params={"scope": "platform"}).status_code == 400
        assert s.post(u, params={"scope": "bad", "confirm": "RESET"}).status_code == 400
        assert s.post(u, params={"scope": "customer", "confirm": "RESET"}).status_code == 400

    def test_customer_then_platform(self, s, db):
        saved_counter = db.settings.find_one({"_id": "tree_counter"})
        pre_existing = list(db.orders.find({"pricing.tree_donation": {"$gt": 0}}, {"_id": 1, "pricing.tree_donation": 1}))
        a, b = "test_tree_a@example.com", "test_tree_b@example.com"
        docs = [
            {"order_number": "TEST_TREE_A1", "billing": {"email": a}, "payment_status": "paid", "created_at": NOW,
             "items": [{"sku": "X", "qty": 2}], "pricing": {"tree_donation": 5, "final_total": 505}},
            {"order_number": "TEST_TREE_B1", "billing": {"email": b}, "payment_status": "paid", "created_at": NOW,
             "items": [{"sku": "Y", "qty": 1}], "pricing": {"tree_donation": 10, "final_total": 210}},
        ]
        db.orders.insert_many(docs)
        db.settings.update_one({"_id": "tree_counter"}, {"$set": {"base_trees": 7, "manual_boost": 3}})
        try:
            m = s.get(f"{BASE_URL}/api/admin/tree-donations").json()
            assert m["summary"]["total_customer_donations"] >= 15
            r = s.post(f"{BASE_URL}/api/admin/tree-donations/reset", params={"scope": "customer", "email": a.upper(), "confirm": "reset"})
            assert r.status_code == 200, r.text
            assert r.json()["orders_reset"] == 1
            oa = db.orders.find_one({"order_number": "TEST_TREE_A1"})
            ob = db.orders.find_one({"order_number": "TEST_TREE_B1"})
            assert oa["pricing"]["tree_donation"] == 0 and oa["pricing"]["final_total"] == 505
            assert oa["items"] == [{"sku": "X", "qty": 2}]
            assert ob["pricing"]["tree_donation"] == 10
            assert db.settings.find_one({"_id": "tree_counter"})["base_trees"] == 7
            r = s.post(f"{BASE_URL}/api/admin/tree-donations/reset", params={"scope": "platform", "confirm": "RESET"})
            assert r.status_code == 200, r.text
            assert r.json()["public_counter_reset"] is True
            ob = db.orders.find_one({"order_number": "TEST_TREE_B1"})
            assert ob["pricing"]["tree_donation"] == 0 and ob["pricing"]["final_total"] == 210
            st = db.settings.find_one({"_id": "tree_counter"})
            assert st["base_trees"] == 0 and st["manual_boost"] == 0
            assert st.get("trees_per_week") == saved_counter.get("trees_per_week")
            assert db.orders.count_documents({"pricing.tree_donation": {"$gt": 0}}) == 0
        finally:
            db.orders.delete_many({"order_number": {"$in": ["TEST_TREE_A1", "TEST_TREE_B1"]}})
            for o in pre_existing:
                db.orders.update_one({"_id": o["_id"]}, {"$set": {"pricing.tree_donation": o["pricing"]["tree_donation"]}})
            if saved_counter:
                db.settings.replace_one({"_id": "tree_counter"}, saved_counter, upsert=True)


# ---------------- Profile change tickets ----------------
class TestProfileTickets:
    def test_list_and_filters(self, s):
        r = s.get(f"{BASE_URL}/api/retailers/admin/profile-change-tickets")
        assert r.status_code == 200
        d = r.json()
        assert d["status_counts"]["pending"] >= 8
        p = s.get(f"{BASE_URL}/api/retailers/admin/profile-change-tickets", params={"status": "pending"}).json()
        assert all(t["status"] == "pending" for t in p["tickets"])

    def test_review_delete_and_resets(self, s, db):
        backup = list(db.profile_change_tickets.find({}))
        ids = [f"PCT-TEST{i}{uuid.uuid4().hex[:4].upper()}" for i in range(3)]
        for t in ids:
            db.profile_change_tickets.insert_one({"id": str(uuid.uuid4()), "ticket_id": t, "retailer_id": "RTL_DELHI001",
                                                  "business_name": "TEST", "change_type": "other", "description": "TEST_iter130",
                                                  "status": "pending", "created_at": NOW, "updated_at": NOW})
        try:
            u = f"{BASE_URL}/api/retailers/admin/profile-change-tickets"
            assert s.put(f"{u}/{ids[0]}", json={"status": "approved"}).status_code == 200
            assert s.put(f"{u}/{ids[1]}", json={"status": "rejected", "admin_notes": "TEST"}).status_code == 200
            assert db.profile_change_tickets.find_one({"ticket_id": ids[0]})["status"] == "approved"
            assert db.profile_change_tickets.find_one({"ticket_id": ids[1]})["status"] == "rejected"
            assert s.delete(f"{u}/{ids[2]}").status_code == 200
            assert db.profile_change_tickets.find_one({"ticket_id": ids[2]}) is None
            assert s.delete(f"{u}/{ids[2]}").status_code == 404
            assert s.post(f"{u}/reset", params={"scope": "reviewed"}).status_code == 400
            assert s.post(f"{u}/reset", params={"scope": "bad", "confirm": "RESET"}).status_code == 400
            pending_before = db.profile_change_tickets.count_documents({"status": "pending"})
            r = s.post(f"{u}/reset", params={"scope": "reviewed", "confirm": "RESET"})
            assert r.status_code == 200
            assert db.profile_change_tickets.count_documents({"status": {"$in": ["approved", "rejected"]}}) == 0
            assert db.profile_change_tickets.count_documents({"status": "pending"}) == pending_before
            r = s.post(f"{u}/reset", params={"scope": "all", "confirm": "RESET"})
            assert r.status_code == 200
            assert db.profile_change_tickets.count_documents({}) == 0
        finally:
            db.profile_change_tickets.delete_many({})
            if backup:
                db.profile_change_tickets.insert_many(backup)
            assert db.profile_change_tickets.count_documents({}) == len(backup)
