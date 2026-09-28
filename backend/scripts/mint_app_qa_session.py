"""Mint a Supabase Auth session for a retailer email WITHOUT needing the
inbox — used by automated tests and local QA only.

How it works: request an email OTP, then read the token_hash Supabase
persisted in `auth.one_time_tokens` and exchange it at /auth/v1/verify.
This is the same token_hash that the real email link carries, so the
resulting session is a genuine Supabase session with no backdoor in
application code.

Usage:
    python -m scripts.mint_app_qa_session qa.aarohmm-test@centraders.com
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import asyncpg
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


async def mint(email: str) -> dict:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    anon = os.environ["SUPABASE_ANON_KEY"]
    headers = {"apikey": anon, "Content-Type": "application/json"}

    otp = requests.post(
        f"{base}/auth/v1/otp",
        headers=headers,
        json={"email": email, "create_user": True},
        timeout=30,
    )
    if otp.status_code >= 400 and "rate" not in otp.text.lower():
        raise SystemExit(f"OTP request failed: {otp.status_code} {otp.text}")

    conn = await asyncpg.connect(os.environ["SUPABASE_DB_URL"], statement_cache_size=0)
    try:
        row = await conn.fetchrow(
            """
            select t.token_hash, t.token_type
            from auth.one_time_tokens t
            join auth.users u on u.id = t.user_id
            where lower(u.email) = lower($1)
            order by t.created_at desc
            limit 1
            """,
            email,
        )
    finally:
        await conn.close()
    if not row:
        raise SystemExit(f"No pending token for {email} (rate limited? wait an hour)")

    verify = requests.post(
        f"{base}/auth/v1/verify",
        headers=headers,
        json={"type": "email", "token_hash": row["token_hash"]},
        timeout=30,
    )
    if verify.status_code >= 400:
        raise SystemExit(f"verify failed: {verify.status_code} {verify.text}")
    return verify.json()


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "qa.aarohmm-test@centraders.com"
    data = asyncio.run(mint(target))
    print(data["access_token"])
