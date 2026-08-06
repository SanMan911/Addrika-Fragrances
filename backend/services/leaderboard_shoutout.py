"""
Leaderboard Prize Cadence — Monthly Constant Companion Shout-Out.

Turns the weekly streak leaderboard cache into organic marketing content by
auto-publishing a "This Month's Constant Companion" blog post on the 1st of
every month. Uses the same `blog_posts` collection as the auto-blog pipeline,
so it shows up on `/blog` alongside editorial content and benefits from the
same subscriber email blast, JSON-LD SEO, and social cross-post fan-out.

Design principles
─────────────────
▸ **Idempotent per month**: keyed on `YYYY-MM`, so re-runs in the same month
  are no-ops (returns skipped=True).
▸ **Graceful no-op**: if the leaderboard is empty or nobody has an active
  streak >= 2 months, we skip silently — never publishes a hollow post.
▸ **Opt-in respected**: only names retailers who set `leaderboard_opt_in`.
  If the top streak-holder is not opted in, we publish an anonymised
  "This month's Constant Companion has been quietly keeping their streak
  alive for N months" post instead of naming them.
▸ **No external LLM call**: uses a hand-crafted template. Fast, free, and
  reliable — this is a monthly hero moment, not a content mill.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from services.retailer_milestones import (
    STREAK_CACHE_ID, refresh_streak_leaderboard,
)

logger = logging.getLogger(__name__)

SHOUTOUT_LOG_KEY = "constant_companion_shoutout"


def _month_key(now: Optional[datetime] = None) -> str:
    n = now or datetime.now(timezone.utc)
    return n.strftime("%Y-%m")


def _month_label(now: Optional[datetime] = None) -> str:
    n = now or datetime.now(timezone.utc)
    return n.strftime("%B %Y")


async def _get_leader(db) -> Optional[dict]:
    """Return `{retailer_id, streak_months, display_name?, city?, opted_in}`
    for the current #1 on the streak leaderboard, or None if empty."""
    cache = await db.leaderboard_cache.find_one(
        {"_id": STREAK_CACHE_ID}, {"_id": 0},
    )
    if not cache:
        cache = await refresh_streak_leaderboard(db)
    top = (cache or {}).get("top") or []
    if not top:
        return None
    leader_row = top[0]
    retailer = await db.retailers.find_one(
        {"retailer_id": leader_row["retailer_id"]},
        {"_id": 0, "business_name": 1, "trade_name": 1, "city": 1,
         "leaderboard_opt_in": 1, "status": 1},
    ) or {}
    if str(retailer.get("status") or "").lower() == "suspended":
        return None
    return {
        "retailer_id": leader_row["retailer_id"],
        "streak_months": int(leader_row.get("streak_months") or 0),
        "display_name": retailer.get("business_name") or retailer.get("trade_name"),
        "city": retailer.get("city"),
        "opted_in": bool(retailer.get("leaderboard_opt_in", False)),
    }


def _build_post(leader: dict, month_label: str) -> dict:
    """Return the full blog_posts document for this month's shout-out.
    Anonymises the leader if they haven't opted into the public leaderboard."""
    streak = leader["streak_months"]
    named = leader["opted_in"] and leader.get("display_name")

    slug_base = f"constant-companion-{_month_key().lower()}"

    if named:
        who = leader["display_name"]
        city = leader.get("city")
        city_line = f" from <b>{city}</b>" if city else ""
        title = f"This Month's Constant Companion — {who} · {month_label}"
        subhead = f"{who}{city_line} has kept an unbroken monthly ordering streak with Addrika for <b>{streak} months</b> running."
        excerpt = (
            f"{who} is our Constant Companion for {month_label}, with "
            f"{streak} unbroken months of ordering Addrika. Honoured on our leaderboard."
        )
    else:
        title = f"This Month's Constant Companion — {month_label}"
        subhead = f"An Addrika retailer has quietly kept an unbroken monthly ordering streak alive for <b>{streak} months</b> running."
        excerpt = (
            f"Meet this month's Constant Companion — {streak} unbroken months "
            f"of ordering Addrika. Honoured on our leaderboard."
        )

    tag_html_intro = (
        "<p>Every month we spotlight a retailer who best embodies the "
        "<b>Constant Companion</b> spirit — the partner whose monthly rhythm "
        "with Addrika has never skipped a beat.</p>"
    )

    body_paragraphs = [
        tag_html_intro,
        f"<h2>{month_label}'s Constant Companion</h2>",
        f"<p>{subhead}</p>",
        "<p>A monthly streak isn't just a number — it means every single "
        "calendar month, this partner has placed at least one order with "
        "us. Season after season, festival after festival, restock after "
        "restock. That's what we mean by <em>constant</em>.</p>",
        "<h2>Why the Constant Companion honour matters</h2>",
        "<p>At Addrika, we don't just count orders — we count "
        "<em>consistency</em>. Our Patron Journey rewards depth of "
        "partnership: aroma-themed tags like Cedar Patron, Sandalwood Sage "
        "and Oudh Master mark milestones you cross forever. But the "
        "Constant Companion honour is different — it recomputes each week "
        "and lives with the retailer who has never let their monthly "
        "cadence slip.</p>",
        "<h2>Want to be featured next month?</h2>",
        "<p>Two things matter: (1) order at least once every calendar "
        "month, and (2) opt into the Community Leaderboard from your "
        "<a href='/retailer/b2b/rewards'>Rewards page</a>. If you're "
        "already keeping a streak alive, opting in is all that stands "
        "between you and this shout-out.</p>",
        "<p><a href='/community'>See the full public leaderboard →</a></p>",
    ]

    body_html = "\n".join(body_paragraphs)
    now = datetime.now(timezone.utc)
    post_id = str(uuid.uuid4())

    return {
        "id": post_id,
        "title": title[:200],
        "slug": slug_base,
        "excerpt": excerpt[:500],
        "content": body_html,
        "tags": ["community", "constant-companion", "leaderboard", "retailer-spotlight"],
        "author_id": "auto-shoutout",
        "author_name": "Addrika Community",
        "is_published": True,
        "views": 0,
        "created_at": now,
        "updated_at": now,
        "published_at": now,
        "featured_image": None,
        "auto_generated": True,
        "geo_city": leader.get("city") if named else "",
        "faqs": [
            {"q": "How is the Constant Companion picked?",
             "a": "It's the retailer with the longest unbroken monthly ordering streak on the leaderboard on the 1st of each month."},
            {"q": "Do I need to opt in?",
             "a": "Only if you want your name shown publicly. Streaks are tracked either way — you can opt in from your Rewards page any time."},
        ],
        "social_caption": (
            f"🎉 This month's Addrika Constant Companion is celebrating "
            f"{streak} unbroken months. #AddrikaCommunity #ConstantCompanion"
        ),
        "shoutout_month": _month_key(),
        "shoutout_retailer_id": leader["retailer_id"] if named else None,
        "shoutout_streak_months": streak,
    }


async def has_run_this_month(db, month_key: Optional[str] = None) -> bool:
    """Idempotency gate — has a shout-out already been logged this month?"""
    key = month_key or _month_key()
    log = await db.constant_companion_shoutout_log.find_one({"_id": key})
    return bool(log)


async def run_monthly_shoutout(db, force: bool = False) -> dict:
    """Run the monthly shout-out. Returns a summary dict describing what
    happened. Idempotent unless `force=True`."""
    month_key = _month_key()
    month_label = _month_label()

    if not force and await has_run_this_month(db, month_key):
        return {"ok": True, "skipped": "already_run_this_month", "month": month_key}

    leader = await _get_leader(db)
    if not leader:
        return {"ok": True, "skipped": "no_leader_yet", "month": month_key}
    if leader["streak_months"] < 2:
        # A 1-month streak isn't really a "constant companion" story yet.
        return {
            "ok": True, "skipped": "streak_too_short",
            "streak_months": leader["streak_months"], "month": month_key,
        }

    doc = _build_post(leader, month_label)

    # Slug uniqueness — very unlikely to collide but be safe
    suffix = 0
    base_slug = doc["slug"]
    while await db.blog_posts.find_one({"slug": doc["slug"]}):
        suffix += 1
        doc["slug"] = f"{base_slug}-{suffix}"

    await db.blog_posts.insert_one(dict(doc))
    await db.constant_companion_shoutout_log.update_one(
        {"_id": month_key},
        {"$set": {
            "post_id": doc["id"],
            "post_slug": doc["slug"],
            "retailer_id": leader["retailer_id"],
            "opted_in": leader["opted_in"],
            "streak_months": leader["streak_months"],
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(
        "Constant Companion shout-out published for %s (post %s, retailer=%s, streak=%d, opted_in=%s)",
        month_key, doc["slug"], leader["retailer_id"], leader["streak_months"], leader["opted_in"],
    )

    # Best-effort social cross-post (all platforms are opt-in via admin_social)
    try:
        from services.social_crosspost import cross_post_blog
        await cross_post_blog(db, {
            "title": doc["title"],
            "excerpt": doc["excerpt"],
            "slug": doc["slug"],
            "featured_image": None,
        })
    except Exception as e:
        logger.debug("Constant Companion social cross-post skipped: %s", e)

    return {
        "ok": True,
        "post_id": doc["id"],
        "slug": doc["slug"],
        "retailer_id": leader["retailer_id"],
        "streak_months": leader["streak_months"],
        "opted_in": leader["opted_in"],
        "month": month_key,
    }
