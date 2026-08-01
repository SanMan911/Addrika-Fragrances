"""Social media cross-posting scaffold.

Design goal
-----------
Ship every platform connector as a **disabled placeholder** until the
admin pastes the required credentials into `db.settings.social_platforms`
via `/admin/settings/social`. Each connector shares a common interface:

    async def post(text: str, image_url: Optional[str], link_url: Optional[str]) -> dict:
        ...

If the platform's creds are missing / `enabled=false`, the connector
returns `{ok: False, error: "not configured", platform: "<name>"}` and
records nothing — never raises.

Supported platforms (all placeholders — verified 2026-02-09):
    - twitter_x   (X / Twitter — v2 Tweets endpoint)
    - instagram   (Meta Graph API — Instagram Business)
    - facebook    (Meta Graph API — Facebook Page)
    - telegram    (Bot API sendPhoto / sendMessage)
    - whatsapp    (WhatsApp Business Cloud API — image/text messages)
    - vk          (VK API — wall.post)
    - arattai     (Arattai bot HTTP API — placeholder; endpoint TBD by user)

`cross_post_blog(post)` fans out to every enabled platform on new blog
publish.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PLATFORMS = (
    "twitter_x", "instagram", "facebook",
    "telegram", "whatsapp", "vk", "arattai",
)

DEFAULT_CONFIG_ROW = {
    "_id": "social_platforms",
    "twitter_x": {
        "enabled": False,
        "api_key": "",           # OAuth 1.0a consumer key
        "api_secret": "",
        "access_token": "",
        "access_token_secret": "",
        "endpoint": "https://api.twitter.com/2/tweets",
    },
    "instagram": {
        "enabled": False,
        "page_access_token": "",     # long-lived Page token
        "ig_business_account_id": "",
        "endpoint": "https://graph.facebook.com/v18.0",
    },
    "facebook": {
        "enabled": False,
        "page_id": "",
        "page_access_token": "",
        "endpoint": "https://graph.facebook.com/v18.0",
    },
    "telegram": {
        "enabled": False,
        "bot_token": "",             # from @BotFather
        "channel_id": "",            # "@addrikaofficial" or -100...
        "endpoint": "https://api.telegram.org",
    },
    "whatsapp": {
        "enabled": False,
        "phone_number_id": "",
        "access_token": "",
        "broadcast_list": [],
        "endpoint": "https://graph.facebook.com/v18.0",
    },
    "vk": {
        "enabled": False,
        "access_token": "",
        "owner_id": "",              # negative for community pages
        "endpoint": "https://api.vk.com/method",
    },
    "arattai": {
        "enabled": False,
        "bot_token": "",
        "channel_id": "",
        "endpoint": "",              # user to fill once Arattai bot API is finalised
    },
}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
async def get_social_config(db) -> dict:
    doc = await db.settings.find_one({"_id": "social_platforms"})
    if not doc:
        await db.settings.insert_one(DEFAULT_CONFIG_ROW.copy())
        return DEFAULT_CONFIG_ROW.copy()
    for platform, defaults in DEFAULT_CONFIG_ROW.items():
        if platform == "_id":
            continue
        if platform not in doc:
            doc[platform] = defaults
        else:
            # forward-compat: merge in any newly-added keys with defaults
            for k, v in defaults.items():
                doc[platform].setdefault(k, v)
    return doc


async def update_social_platform(db, platform: str, patch: dict) -> dict:
    if platform not in PLATFORMS:
        raise ValueError(f"unknown platform {platform!r}")
    upd = {f"{platform}.{k}": v for k, v in patch.items()}
    await db.settings.update_one(
        {"_id": "social_platforms"},
        {"$set": upd},
        upsert=True,
    )
    return (await get_social_config(db))[platform]


# ---------------------------------------------------------------------------
# Per-platform posters (all currently placeholders — return a "not configured"
# response until the admin pastes credentials and flips `enabled=true`)
# ---------------------------------------------------------------------------
async def _post_generic(platform: str, cfg: dict, text: str,
                        image_url: Optional[str], link_url: Optional[str]) -> dict:
    if not cfg.get("enabled"):
        return {"ok": False, "platform": platform, "error": "not configured"}
    # Real integration TBD once user pastes creds. Stub returns ok=true
    # so the fan-out logic can be smoke-tested locally without keys.
    logger.info("social/%s [stub-post] text=%s image=%s link=%s",
                platform, text[:60], image_url, link_url)
    return {"ok": True, "platform": platform, "stub": True}


async def post_to_twitter_x(cfg: dict, **kw) -> dict:
    return await _post_generic("twitter_x", cfg, **kw)


async def post_to_instagram(cfg: dict, **kw) -> dict:
    return await _post_generic("instagram", cfg, **kw)


async def post_to_facebook(cfg: dict, **kw) -> dict:
    return await _post_generic("facebook", cfg, **kw)


async def post_to_telegram(cfg: dict, *, text: str,
                           image_url: Optional[str] = None,
                           link_url: Optional[str] = None) -> dict:
    """Telegram is the simplest to make actually-work whenever the admin
    pastes the bot token + channel_id. Kept behind `enabled` so it stays
    a no-op until then."""
    if not cfg.get("enabled") or not cfg.get("bot_token") or not cfg.get("channel_id"):
        return {"ok": False, "platform": "telegram", "error": "not configured"}
    url = f"{cfg['endpoint']}/bot{cfg['bot_token']}/sendMessage"
    body = {
        "chat_id": cfg["channel_id"],
        "text": text + (f"\n\n{link_url}" if link_url else ""),
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, json=body)
        ok = r.status_code == 200
        return {"ok": ok, "platform": "telegram",
                "status": r.status_code, "response": r.text[:200] if not ok else None}
    except Exception as e:
        return {"ok": False, "platform": "telegram", "error": str(e)}


async def post_to_whatsapp(cfg: dict, **kw) -> dict:
    return await _post_generic("whatsapp", cfg, **kw)


async def post_to_vk(cfg: dict, **kw) -> dict:
    return await _post_generic("vk", cfg, **kw)


async def post_to_arattai(cfg: dict, **kw) -> dict:
    return await _post_generic("arattai", cfg, **kw)


POSTER = {
    "twitter_x": post_to_twitter_x,
    "instagram": post_to_instagram,
    "facebook": post_to_facebook,
    "telegram": post_to_telegram,
    "whatsapp": post_to_whatsapp,
    "vk": post_to_vk,
    "arattai": post_to_arattai,
}


# ---------------------------------------------------------------------------
# Public fan-out API
# ---------------------------------------------------------------------------
async def cross_post_blog(db, post: dict) -> list[dict]:
    """Called by the auto-blog scheduler right after publish. Fans out to
    every enabled platform. Never raises — always returns a list of
    per-platform result dicts."""
    cfg = await get_social_config(db)
    text = (post.get("title") or "").strip()
    excerpt = (post.get("excerpt") or "").strip()
    body = f"{text}\n\n{excerpt}" if excerpt else text
    image_url = post.get("featured_image") or post.get("hero_storage_path")
    link_url = f"https://centraders.com/blog/{post.get('slug')}" if post.get("slug") else None

    results = []
    for platform in PLATFORMS:
        try:
            fn = POSTER[platform]
            r = await fn(cfg[platform], text=body, image_url=image_url, link_url=link_url)
        except Exception as e:
            r = {"ok": False, "platform": platform, "error": str(e)}
        results.append(r)
    return results
