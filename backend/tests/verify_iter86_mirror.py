"""Iter86: assert b2b products_mirror rows have non-null price_inr AND mrp_inr."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
dsn = os.environ.get("SUPABASE_DB_URL") or os.environ.get("SUPABASE_DB_DSN") or os.environ.get("DATABASE_URL")
conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute("select id, price_inr, mrp_inr from products_mirror where channel='b2b' order by id")
rows = cur.fetchall()
print("b2b row count:", len(rows))
null_price = [r for r in rows if r[1] is None]
null_mrp = [r for r in rows if r[2] is None]
print("NULL price_inr:", null_price)
print("NULL mrp_inr:", null_mrp)
sample = {r[0]: (r[1], r[2]) for r in rows}
print("belpatra-dhoop-b2b:", sample.get("belpatra-dhoop-b2b"))
print("bold-bakhoor-b2b:", sample.get("bold-bakhoor-b2b"))
assert len(rows) == 16, f"expected 16 b2b rows, got {len(rows)}"
assert not null_price, "NULL price_inr rows present"
assert not null_mrp, "NULL mrp_inr rows present"
assert float(sample["belpatra-dhoop-b2b"][0]) == 149.00
assert float(sample["bold-bakhoor-b2b"][0]) == 110.00
print("ALL B2B MIRROR ASSERTIONS PASSED")
cur.close()
conn.close()
