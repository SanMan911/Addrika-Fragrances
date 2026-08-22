"""Helper: mint fresh handoff nonces (customer + retailer) for UI E2E testing."""
import json
import os

import requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend-next/.env")
BASE = os.environ.get("ITER98_BASE_URL") or "http://localhost:8001"


def mint_customer():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "identifier": "iter98_cust@e2e.test", "password": "Iter98@Cust1"}, timeout=20)
    r.raise_for_status()
    token = r.json().get("session_token")
    h = requests.post(f"{BASE}/api/auth/handoff/create",
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    return h.status_code, h.json()


def mint_retailer():
    r = requests.post(f"{BASE}/api/retailer-auth/login", json={
        "email": "iter98_e2e_retailer@e2e.test", "password": "Iter98@E2E1"}, timeout=20)
    r.raise_for_status()
    token = r.json().get("token")
    h = requests.post(f"{BASE}/api/auth/handoff/create",
                      headers={"Cookie": f"retailer_session={token}"}, timeout=20)
    return h.status_code, h.json()


if __name__ == "__main__":
    print("CUSTOMER:", json.dumps(mint_customer()))
    print("RETAILER:", json.dumps(mint_retailer()))
