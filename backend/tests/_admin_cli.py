# Tiny CLI helper used by iter127 testing: python tests/_admin_cli.py METHOD PATH [JSON]
import json
import subprocess
import sys
import time

import requests

B = "http://localhost:8001"
r = requests.post(f"{B}/api/admin/login/initiate", json={"email": "contact.us@centraders.com", "pin": "050499"})
tid = r.json()["token_id"]
time.sleep(0.3)
otp = subprocess.run(["mongosh", "--quiet", "mongodb://localhost:27017/addrika_db", "--eval",
                      f'print(db.admin_2fa_tokens.findOne({{token_id:"{tid}"}}).otp)'],
                     capture_output=True, text=True).stdout.strip()
v = requests.post(f"{B}/api/admin/login/verify-otp", json={"token_id": tid, "otp": otp}).json()
h = {"Cookie": f"session_token={v.get('session_token') or v.get('token')}"}
m, p = sys.argv[1], sys.argv[2]
body = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
resp = requests.request(m, f"{B}{p}", headers=h, json=body)
print(resp.status_code, resp.text[:1500])
