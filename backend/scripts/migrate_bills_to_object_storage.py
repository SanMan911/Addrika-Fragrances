"""
One-shot migrator: move legacy `retailer_bills.file_base64` records into
Emergent object storage. Idempotent — bills that already have
`storage_path` are skipped.

Run via the admin endpoint `POST /api/admin/b2b/maintenance/migrate-bills`
or directly `python -m scripts.migrate_bills_to_object_storage` from the
backend dir.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import sys
from typing import Optional

logger = logging.getLogger(__name__)


async def migrate_bills(db, *, dry_run: bool = False) -> dict:
    """Walk `retailer_bills`, move base64 payloads to object storage."""
    from services.object_storage import (
        is_configured as obj_configured,
        put_object,
        make_path,
    )

    if not obj_configured():
        return {
            "ok": False,
            "error": "Object storage not configured (EMERGENT_LLM_KEY missing)",
        }

    cursor = db.retailer_bills.find(
        {"file_base64": {"$exists": True}, "storage_path": {"$exists": False}},
        {"id": 1, "bill_id": 1, "retailer_id": 1, "file_base64": 1, "file_name": 1, "file_type": 1},
    )

    moved = 0
    skipped = 0
    failed = 0
    failures: list[dict] = []

    async for bill in cursor:
        bid = bill.get("bill_id") or bill.get("id")
        try:
            raw = bill.get("file_base64") or ""
            decoded = base64.b64decode(raw.split(",")[-1], validate=True)
            ext = (
                bill.get("file_name", "").rsplit(".", 1)[-1]
                if "." in bill.get("file_name", "")
                else "bin"
            )
            ext = ext.lower()[:6]
            file_type = (bill.get("file_type") or "application/octet-stream").lower()
            path = make_path("bills", bill.get("retailer_id") or "_", ext)

            if dry_run:
                moved += 1
                continue

            res = await put_object(path, decoded, file_type)
            if not res or not res.get("path"):
                failed += 1
                failures.append({"bill_id": bid, "error": "put_object returned empty"})
                continue

            await db.retailer_bills.update_one(
                {"bill_id": bid} if bill.get("bill_id") else {"id": bill.get("id")},
                {
                    "$set": {
                        "storage_path": res["path"],
                        "size_bytes": res.get("size") or len(decoded),
                    },
                    "$unset": {"file_base64": ""},
                },
            )
            moved += 1
        except Exception as e:
            failed += 1
            failures.append({"bill_id": bid, "error": str(e)[:200]})

    skipped = await db.retailer_bills.count_documents({"storage_path": {"$exists": True}})
    return {
        "ok": True,
        "dry_run": dry_run,
        "moved": moved,
        "already_in_storage": skipped,
        "failed": failed,
        "failures": failures[:20],
    }


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _main():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ.get("DB_NAME", "addrika_db")]
        dry = "--dry-run" in sys.argv
        result = await migrate_bills(db, dry_run=dry)
        print(result)

    asyncio.run(_main())
