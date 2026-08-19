"""Iter85 direct psycopg2 verification of products_mirror hydration + bambooless tombstone."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
dsn = os.environ.get("SUPABASE_DB_URL") or os.environ.get("SUPABASE_DB_DSN") or os.environ.get("DATABASE_URL")
print("DSN present:", bool(dsn))
conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute("select id, name, channel, price_inr, stock_pieces, is_active, updated_at from products_mirror order by channel, id")
rows = cur.fetchall()
print(f"total rows: {len(rows)}")
for r in rows:
    print(r)

b2c = [r for r in rows if r[2] == "b2c" and r[5]]
print("\nactive b2c count:", len(b2c))
bad = [r for r in b2c if r[3] is None or r[4] is None]
print("b2c rows with NULL price or stock:", bad)
bamboo = [r for r in rows if "bambooless" in (r[0] or "")]
print("bambooless rows:", bamboo)
b2b_null_price = [r for r in rows if r[2] == "b2b" and r[3] is None]
print("b2b rows with NULL price:", len(b2b_null_price))
cur.close()
conn.close()
