"""Apply the Supabase application schema (idempotent).

Usage:  python -m scripts.apply_supabase_app_schema
"""
import asyncio
import os
import sys
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SQL_FILE = ROOT / "sql" / "supabase_app_schema.sql"


async def main() -> int:
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("SUPABASE_DB_URL is not set", file=sys.stderr)
        return 1

    sql = SQL_FILE.read_text()
    conn = await asyncpg.connect(url, statement_cache_size=0)
    try:
        await conn.execute(sql)
        tables = await conn.fetch(
            "select table_name from information_schema.tables "
            "where table_schema='public' and table_name like 'app_%' order by 1"
        )
        print("Applied. app_* tables:", ", ".join(r["table_name"] for r in tables))
        bucket = await conn.fetchval(
            "select id from storage.buckets where id='grievance-uploads'"
        )
        print("storage bucket:", bucket or "MISSING")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
