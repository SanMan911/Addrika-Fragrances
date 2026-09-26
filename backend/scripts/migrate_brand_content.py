"""Rename brand inside stored user-facing content. Idempotent.

Usage: python3 scripts/migrate_brand_content.py [--dry-run]

Touches ONLY human-readable text fields. Storage paths, partner protocol
values (`partner_redeemable_on`), badge keys and emails are left alone.
"""
import asyncio
import os
import re
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OLD, NEW = "Addrika", "AAROHMM"
RULES = [
    (re.compile(r"#AddrikaCommunity"), "#AarohmmCommunity"),
    (re.compile(r"@addrika\.fragrances"), "@aarohmm.fragrances"),
    (re.compile(r"instagram\.com/addrika\.fragrances"), "instagram.com/aarohmm.fragrances"),
    (re.compile(r"/why-choose-addrika"), "/why-choose-aarohmm"),
    (re.compile(r"\bADDRIKA\b"), NEW),
    (re.compile(r"\bAddrika\b"), NEW),
    (re.compile(r"\bAAROVIAH\b"), NEW),
    (re.compile(r"\bAaroviah\b"), NEW),
    (re.compile(r"#Addrika([A-Za-z]*)"), r"#Aarohmm\1"),
    # standalone lowercase keyword/tag (not inside a slug or URL path)
    (re.compile(r"(?<![-/\w.])addrika(?![-\w.])"), "aarohmm"),
    (re.compile(r"(?<![-/\w.])aaroviah(?![-\w.])"), "aarohmm"),
]

# collection -> list of top-level fields whose nested strings are safe to rewrite
TARGETS = {
    "blog_posts": ["title", "excerpt", "content", "author", "author_name", "faqs", "jsonld",
                   "social_caption", "meta_title", "meta_description", "keywords", "tags"],
    "retailer_admin_messages": ["sender_name", "message", "body"],
    "retailer_admin_threads": ["subject", "last_message_preview"],
    "retailer_milestones": ["description", "milestone_name_at_time", "name"],
    "admin_settings": ["value"],
    "platform_config": ["brand", "social"],
    "discount_codes": ["description", "name"],
    "notify_me": ["message"],
    "subscribers": ["source_label"],
}

SKIP_KEYS = {"storage_path", "hero_storage_path", "inline_storage_paths", "partner_redeemable_on", "email",
             "retailer_email", "issued_by", "site"}


def rewrite(v):
    if isinstance(v, str):
        out = v
        for rx, rep in RULES:
            out = rx.sub(rep, out)
        return out
    if isinstance(v, list):
        return [rewrite(x) for x in v]
    if isinstance(v, dict):
        return {k: (x if k in SKIP_KEYS else rewrite(x)) for k, x in v.items()}
    return v


async def main(dry: bool):
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    total = 0
    for coll, fields in TARGETS.items():
        proj = {f: 1 for f in fields}
        async for doc in db[coll].find({}, proj):
            updates = {}
            for f in fields:
                if f not in doc:
                    continue
                new_val = rewrite(doc[f])
                if new_val != doc[f]:
                    updates[f] = new_val
            if updates:
                total += 1
                if not dry:
                    await db[coll].update_one({"_id": doc["_id"]}, {"$set": updates})
                print(f"  {coll}/{doc['_id']}: {sorted(updates)}")
    print(f"{'would update' if dry else 'updated'} {total} documents")


if __name__ == "__main__":
    asyncio.run(main("--dry-run" in sys.argv))
