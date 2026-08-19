"""Iter85: self-healing verification — inject an orphan bambooless mirror row and
NULL out price/stock on one b2c row, then restart backend and re-check."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
conn.autocommit = True
cur = conn.cursor()

# describe columns to build a valid insert
cur.execute("select column_name, is_nullable, data_type from information_schema.columns where table_name='products_mirror' order by ordinal_position")
cols = cur.fetchall()
print(cols)

cur.execute(
    """insert into products_mirror (id, name, channel, price_inr, stock_pieces, is_active)
       values ('bambooless-dhoop-8inch', '8" Bambooless Dhoop', 'b2c', NULL, NULL, true)
       on conflict (id) do update set is_active=true, price_inr=NULL, stock_pieces=NULL"""
)
cur.execute("update products_mirror set price_inr=NULL, stock_pieces=NULL where id='regal-rose'")
cur.execute("select id, price_inr, stock_pieces, is_active from products_mirror where id in ('bambooless-dhoop-8inch','regal-rose')")
print("injected:", cur.fetchall())
cur.close()
conn.close()
