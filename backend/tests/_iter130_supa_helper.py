# Helper for iter130 tests: create/inspect throwaway Supabase grievances (run from /app/backend)
import asyncio, sys, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from services.supabase_app_sync import _connect


async def main(cmd, arg=None):
    conn = await _connect()
    try:
        if cmd == 'schema':
            for t in ('app_grievances', 'app_grievance_messages', 'app_grievance_images'):
                rows = await conn.fetch("select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=$1", t)
                print(t, [(r['column_name'], r['data_type'], r['is_nullable'], r['column_default']) for r in rows])
            r = await conn.fetchrow("select id from public.app_retailers limit 1")
            print('retailer', r)
        elif cmd == 'create':
            rid = await conn.fetchval("select id from public.app_retailers where gstin='29AAAAA0000A1Z5'")
            gid = await conn.fetchval(
                "insert into public.app_grievances (retailer_id, category, subject, message, status) values ($1,'other','TEST_iter130 throwaway','TEST_iter130 delete me','open') returning id", rid)
            await conn.execute("insert into public.app_grievance_messages (grievance_id, author, body) values ($1,'retailer','TEST_iter130 reply')", gid)
            await conn.execute("insert into public.app_grievance_images (grievance_id, storage_path) values ($1,'TEST_iter130/fake.jpg')", gid)
            print(json.dumps({'id': str(gid)}))
        elif cmd == 'count':
            out = {}
            for t, c in (('app_grievances', 'id'), ('app_grievance_messages', 'grievance_id'), ('app_grievance_images', 'grievance_id')):
                out[t] = await conn.fetchval(f"select count(*) from public.{t} where {c}::text=$1", arg)
            print(json.dumps(out))
    finally:
        await conn.close()

asyncio.run(main(*sys.argv[1:]))
