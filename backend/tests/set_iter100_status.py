"""Flip the seeded iter100 UI retailer's status. Usage: python set_iter100_status.py verified"""
import os
import sys
import requests
from dotenv import load_dotenv, dotenv_values
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE_URL = dotenv_values("/app/frontend-next/.env.local")["NEXT_PUBLIC_BACKEND_URL"].rstrip("/")
RETAILER_ID = "RTL_ITER100UI"
status = sys.argv[1] if len(sys.argv) > 1 else "under_processing"
reason = sys.argv[2] if len(sys.argv) > 2 else None

mc = MongoClient(os.environ["MONGO_URL"])
db = mc[os.environ["DB_NAME"]]
upd = {"status": status}
if reason:
    upd["suspended_reason"] = reason
db.retailers.update_one({"retailer_id": RETAILER_ID}, {"$set": upd})
print("status set to", status, db.retailers.find_one({"retailer_id": RETAILER_ID}, {"_id": 0, "status": 1}))
mc.close()

r = requests.post(
    f"{BASE_URL}/api/retailer-auth/login",
    json={"email": "test_iter100_ui@example.com", "password": "TestPass@12345"},
    timeout=30,
)
print("LOGIN", r.status_code, r.text[:250])
