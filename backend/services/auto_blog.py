"""
Auto-blog orchestrator — FREE STACK.

Generates a SEO-friendly + GEO-friendly (Generative-Engine + geographic) blog
post on a randomized cadence (2-3 posts per week, days picked organically by
randomizing each cycle's next-due time between 2-4 days). Uses:
  - **Google Gemini 2.0 Flash** (free tier, 1500 req/day) for body, FAQ, JSON-LD, geo meta
  - **Pollinations AI** (no key, no signup) for hero (16:9) + 2 inline images

Images are written to Emergent object storage under
`addrika/blog-images/{post_id}/{kind}.png` and served back to the public site
via `GET /api/blog/images/{post_id}/{kind}` (proxy in routers/blog.py).

Cycle settings live in `admin_settings.auto_blog`:
  - enabled (bool, default True)
  - cadence_min_days / cadence_max_days (default 2.0 / 4.0 — yields 2-3 posts/week)
  - publish_mode ('auto' | 'draft', default 'auto')
  - last_run_at (ISO)
  - cycle_count (int — alternates topic-bank vs trend-driven)
"""
from __future__ import annotations

import os
import json
import logging
import asyncio
import random
import re
import urllib.parse
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from markdown_it import MarkdownIt

from services.object_storage import put_object, is_configured as storage_configured
from services.auto_blog_topics import TOPIC_BANK, SEASONAL_HINTS

logger = logging.getLogger(__name__)

_md = MarkdownIt("commonmark", {"html": False, "linkify": True, "typographer": True})


def md_to_html(text: str) -> str:
    """Convert Gemini's markdown body to HTML so the existing blog renderer
    (which uses dangerouslySetInnerHTML) shows headings, lists and links
    correctly. Strips the FAQ section since we render it separately as an
    accordion + FAQ JSON-LD."""
    if not text:
        return ""
    parts = re.split(
        r"^##\s*Frequently Asked Questions\b.*$",
        text,
        maxsplit=1,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    body = parts[0]
    return _md.render(body).strip()


# ---------------------------------------------------------------------------
# FREE STACK: Gemini text + Pollinations images
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GOOGLE_AI_STUDIO_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"

# Stagger between parallel image-gen requests (seconds). Pollinations rate-limits
# bursts of 3 images aggressively. Tests override these to 0.
IMAGE_STAGGER_INLINE_1 = 18
IMAGE_STAGGER_INLINE_2 = 36

DEFAULTS = {
    "enabled": True,
    # Random next-due in [cadence_min_days, cadence_max_days] after each cycle
    # → naturally yields 2-3 posts per week with random days
    "cadence_min_days": 2.0,
    "cadence_max_days": 4.0,
    "publish_mode": "auto",  # 'auto' or 'draft'
    "last_run_at": None,
    "cycle_count": 0,
    "next_due_at": None,
}


# ---------------------------------------------------------------------------
# Settings helpers
# ---------------------------------------------------------------------------
async def get_settings(db) -> dict:
    doc = await db.admin_settings.find_one({"setting_key": "auto_blog"})
    cfg = (doc or {}).get("setting_value") or {}
    return {**DEFAULTS, **cfg}


async def update_settings(db, patch: dict, admin_email: str = "system") -> dict:
    cfg = await get_settings(db)
    cfg.update({k: v for k, v in patch.items() if k in DEFAULTS})
    await db.admin_settings.update_one(
        {"setting_key": "auto_blog"},
        {
            "$set": {
                "setting_value": cfg,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin_email,
            }
        },
        upsert=True,
    )
    return cfg


def _next_due(last_run_iso: Optional[str], cadence_min: float, cadence_max: float) -> str:
    """Random next-due time — uniform between cadence_min and cadence_max days,
    landing on a random hour 09:00-21:00 IST so posts publish during waking hours."""
    base = (
        datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
        if last_run_iso
        else datetime.now(timezone.utc)
    )
    # Random offset (real-valued days)
    offset_days = random.uniform(min(cadence_min, cadence_max), max(cadence_min, cadence_max))
    candidate = base + timedelta(days=offset_days)
    # Snap to a random hour in 09-21 IST (UTC 03:30 - 15:30)
    hour_utc = random.randint(3, 15)
    minute = random.choice([0, 15, 30, 45])
    candidate = candidate.replace(hour=hour_utc, minute=minute, second=0, microsecond=0)
    # Guard: must be at least cadence_min days from base
    min_due = base + timedelta(days=cadence_min)
    if candidate < min_due:
        candidate = min_due
    return candidate.isoformat()


# ---------------------------------------------------------------------------
# Topic selection
# ---------------------------------------------------------------------------
async def _pick_topic(db, cycle_count: int) -> dict:
    """Alternate between TOPIC_BANK (even cycles) and trend-driven (odd cycles)."""
    use_trend = cycle_count % 2 == 1
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    recent = await db.blog_posts.find(
        {"created_at": {"$gte": cutoff}}, {"_id": 0, "title": 1}
    ).to_list(200)
    recent_titles = {(p.get("title") or "").lower() for p in recent}

    if not use_trend:
        for offset in range(len(TOPIC_BANK)):
            idx = (cycle_count // 2 + offset) % len(TOPIC_BANK)
            seed_title, category, geo_city, keywords = TOPIC_BANK[idx]
            if seed_title.lower() not in recent_titles:
                return {
                    "source": "bank",
                    "seed_title": seed_title,
                    "category": category,
                    "geo_city": geo_city,
                    "keywords": keywords,
                }
        seed_title, category, geo_city, keywords = TOPIC_BANK[
            cycle_count // 2 % len(TOPIC_BANK)
        ]
        return {
            "source": "bank",
            "seed_title": seed_title,
            "category": category,
            "geo_city": geo_city,
            "keywords": keywords,
        }

    month = datetime.now(timezone.utc).month
    season_hint = SEASONAL_HINTS.get(month, "")
    return {
        "source": "trend",
        "seed_title": None,
        "category": "seasonal",
        "geo_city": None,
        "keywords": ["natural agarbatti", "premium incense"],
        "season_hint": season_hint,
    }


# ---------------------------------------------------------------------------
# Text generation — Gemini 2.0 Flash via direct REST (free tier)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are the senior content editor for Addrika, a premium hand-rolled, charcoal-free agarbatti & dhoop brand made in Delhi (centraders.com).

Voice:
- Warm, knowledgeable, gently poetic. Uses Indian English. Familiar with Vastu, Ayurveda, festivals, and ritual.
- Confident but never pushy. Uses concrete details (Delhi rolling room, bambooless 8" dhoop, Bilvapatra leaves).
- Aimed at 25-45-year-old urban Indians + their B2B retailers.

Constraints:
- 900-1300 word body in clean Markdown (use ##, ###, **, lists, > blockquotes).
- Mention Addrika products by name where natural. Never invent claims.
- Always include a 4-6 question FAQ section at the end (under "## Frequently Asked Questions" with each Q as ###).
- The article must be SEO-strong (keyword-rich H2s, internal-link suggestions to /products, /our-story, /blog) AND GEO-friendly (clearly-cited facts, simple Q&A structure that LLM search engines can quote).

You always respond with strict JSON matching the requested schema. NO preamble, NO markdown code fences."""

USER_TEMPLATE = """Write today's blog post for Addrika.

Topic source: {source}
{seed_section}
Geographic angle: {geo}
Target keywords: {keywords}
{season_hint}

Output STRICT JSON with these keys (no markdown wrapper, no preamble):
{{
  "title": "60-70 char SEO title (include 1 primary keyword)",
  "slug": "kebab-case-slug-max-60-chars",
  "excerpt": "150-200 char meta description for search results",
  "content": "Full Markdown body (900-1300 words). Include 3 internal-link suggestions as Markdown links to /products, /our-story or /blog. End with '## Frequently Asked Questions' and 4-6 ### questions.",
  "tags": ["5-7 relevant tags lowercase"],
  "geo_city": "{geo_city_value}",
  "hero_image_prompt": "120-180 char descriptive image prompt for the article hero (16:9, photorealistic, warm Indian aesthetic, natural light, NO text overlays, NO logos)",
  "inline_image_1_prompt": "image prompt for an inline image (close-up product or hand-rolled detail)",
  "inline_image_2_prompt": "image prompt for an inline image (lifestyle context — Indian home, ritual, festival)",
  "faqs": [{{"q": "Question?", "a": "1-3 sentence answer."}}, ...4-6 entries...],
  "social_caption": "120-200 char Instagram/X-friendly caption with 2-3 relevant hashtags"
}}

Return ONLY the JSON. No markdown code fences."""


def _build_user_prompt(topic: dict) -> str:
    seed = topic.get("seed_title")
    geo = topic.get("geo_city") or "Pan-India"
    season = topic.get("season_hint")
    return USER_TEMPLATE.format(
        source=topic["source"],
        seed_section=(
            f'Seed title (rewrite/improve): "{seed}"\n' if seed else "No seed title — pick a fresh angle.\n"
        ),
        geo=geo,
        geo_city_value=topic.get("geo_city") or "",
        keywords=", ".join(topic.get("keywords") or []),
        season_hint=(f"Seasonal hint (current month): {season}\n" if season else ""),
    )


def _strip_json_fence(text: str) -> str:
    """Gemini sometimes wraps in ```json ... ``` despite instruction. Defang."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _gemini_payload(topic: dict) -> dict:
    """Build a Gemini generateContent request body with a strict response schema
    so the body field's quotes/newlines are auto-escaped by Google's JSON
    serializer (avoids the unterminated-string parse failures we saw on long
    markdown bodies)."""
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "title": {"type": "STRING"},
            "slug": {"type": "STRING"},
            "excerpt": {"type": "STRING"},
            "content": {"type": "STRING"},
            "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
            "geo_city": {"type": "STRING"},
            "hero_image_prompt": {"type": "STRING"},
            "inline_image_1_prompt": {"type": "STRING"},
            "inline_image_2_prompt": {"type": "STRING"},
            "faqs": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "q": {"type": "STRING"},
                        "a": {"type": "STRING"},
                    },
                    "required": ["q", "a"],
                },
            },
            "social_caption": {"type": "STRING"},
        },
        "required": [
            "title", "slug", "excerpt", "content",
            "tags", "hero_image_prompt", "faqs",
        ],
    }
    return {
        "contents": [
            {"role": "user", "parts": [{"text": _build_user_prompt(topic)}]}
        ],
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }


async def _generate_text(topic: dict) -> dict:
    """Call Gemini 2.0 Flash via REST. Auto-retry on transient 5xx / 429."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GOOGLE_AI_STUDIO_API_KEY is not configured")

    last_err = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                    json=_gemini_payload(topic),
                    headers={"Content-Type": "application/json"},
                )
            if r.status_code in (429, 500, 502, 503, 504):
                logger.warning(f"Auto-blog: Gemini {r.status_code} attempt {attempt+1}: {r.text[:120]}")
                last_err = RuntimeError(f"Gemini HTTP {r.status_code}")
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt * 5)
                continue
            if r.status_code != 200:
                raise RuntimeError(f"Gemini HTTP {r.status_code}: {r.text[:200]}")
            body = r.json()
            text = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if not text:
                raise RuntimeError(f"Gemini returned empty content: {body}")
            data = json.loads(_strip_json_fence(text))
            for k in ("title", "slug", "excerpt", "content", "hero_image_prompt"):
                if not data.get(k):
                    raise ValueError(f"Generated post missing required key: {k}")
            return data
        except json.JSONDecodeError as e:
            logger.error(f"Auto-blog: Gemini returned invalid JSON: {e}")
            last_err = e
            if attempt < 2:
                await asyncio.sleep(3)
                continue
            raise
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_err = e
            logger.warning(f"Auto-blog: network error attempt {attempt+1}: {e}")
            if attempt < 2:
                await asyncio.sleep(2 ** attempt * 5)
                continue
    raise RuntimeError(f"Text generation failed after 3 attempts: {last_err}")


# ---------------------------------------------------------------------------
# Image generation — Pollinations AI (free, no key, no signup)
# ---------------------------------------------------------------------------
async def _generate_image(prompt: str, kind: str = "hero") -> Optional[bytes]:
    """Fetch a generated PNG from Pollinations. Hero is 16:9 (1920x1080); inline
    images are 4:3 (1024x768) to fit blog body width nicely.

    Retries up to 3x with exponential backoff on 429/5xx — Pollinations rate-
    limits aggressively when bursting 3 images at once."""
    if not prompt:
        return None
    width, height = (1920, 1080) if kind == "hero" else (1024, 768)
    full_prompt = (
        f"{prompt}, photorealistic, warm Indian aesthetic, soft natural light, "
        f"premium product photography, no text overlay, no watermark, no logo"
    )
    encoded = urllib.parse.quote(full_prompt[:500])

    for attempt in range(3):
        # Re-roll seed each attempt so a "stuck" prompt isn't retried verbatim
        seed = random.randint(1, 1_000_000)
        url = (
            f"{POLLINATIONS_BASE}/{encoded}"
            f"?width={width}&height={height}&nologo=true&seed={seed}&model=flux"
        )
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                r = await client.get(url)
            if r.status_code == 200 and r.content and len(r.content) >= 1000:
                return r.content
            logger.warning(
                f"Auto-blog: Pollinations {kind} attempt {attempt+1} → "
                f"HTTP {r.status_code}, len={len(r.content) if r.content else 0}"
            )
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                # Stagger 8s, 20s — Pollinations recovers from burst-limit fast
                await asyncio.sleep(8 * (attempt + 1) + random.uniform(0, 4))
                continue
            return None
        except Exception as e:
            logger.error(f"Auto-blog Pollinations error for {kind} attempt {attempt+1}: {e}")
            if attempt < 2:
                await asyncio.sleep(8 * (attempt + 1))
                continue
            return None
    return None


async def _save_image(post_id: str, kind: str, data: bytes) -> Optional[str]:
    """Returns the storage_path on success, None on failure."""
    if not data:
        return None
    if not storage_configured():
        logger.warning("Auto-blog: object storage not configured, skipping image save")
        return None
    path = f"addrika/blog-images/{post_id}/{kind}.png"
    res = await put_object(path, data, "image/png")
    if not res:
        return None
    return path


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------
async def run_one_cycle(db, force: bool = False, admin_email: str = "system:auto") -> dict:
    """Run a single auto-blog cycle. Pass `force=True` to skip the next-due check."""
    if not GEMINI_API_KEY:
        return {"ok": False, "error": "GOOGLE_AI_STUDIO_API_KEY not configured"}

    cfg = await get_settings(db)
    if not cfg["enabled"] and not force:
        return {"ok": False, "skipped": "disabled"}

    now = datetime.now(timezone.utc)
    if not force and cfg.get("next_due_at"):
        try:
            due = datetime.fromisoformat(cfg["next_due_at"].replace("Z", "+00:00"))
            if now < due:
                return {"ok": False, "skipped": "not_due", "next_due_at": cfg["next_due_at"]}
        except Exception:
            pass

    cycle_count = int(cfg.get("cycle_count") or 0)
    topic = await _pick_topic(db, cycle_count)
    logger.info(f"Auto-blog: cycle {cycle_count}, topic source={topic['source']}, seed={topic.get('seed_title')!r}")

    # 1) Generate text via Gemini
    try:
        gen = await _generate_text(topic)
    except Exception as e:
        await _log_run(db, ok=False, error=str(e), topic=topic)
        return {"ok": False, "error": f"text_gen_failed: {e}"}

    # 2) Generate images via Pollinations with staggered starts so we don't
    # trigger their per-IP burst rate-limit (3 images in <5s = guaranteed 429s).
    post_id = str(uuid.uuid4())

    async def _gen_with_gap(prompt, kind, gap):
        if gap:
            await asyncio.sleep(gap)
        return await _generate_image(prompt, kind)

    hero_bytes, in1_bytes, in2_bytes = await asyncio.gather(
        _gen_with_gap(gen["hero_image_prompt"], "hero", 0),
        _gen_with_gap(gen.get("inline_image_1_prompt") or "", "inline-1", IMAGE_STAGGER_INLINE_1),
        _gen_with_gap(gen.get("inline_image_2_prompt") or "", "inline-2", IMAGE_STAGGER_INLINE_2),
    )
    hero_path = await _save_image(post_id, "hero", hero_bytes) if hero_bytes else None
    in1_path = await _save_image(post_id, "inline-1", in1_bytes) if in1_bytes else None
    in2_path = await _save_image(post_id, "inline-2", in2_bytes) if in2_bytes else None

    # 3) Slug uniqueness
    slug = (gen["slug"] or "").strip("-")[:60] or post_id[:8]
    suffix = 0
    while await db.blog_posts.find_one({"slug": slug}):
        suffix += 1
        slug = f"{(gen['slug'] or 'post')[:55]}-{suffix}"

    # 4) JSON-LD
    jsonld = _build_jsonld(gen, slug, topic, hero_path, post_id)

    publish_mode = cfg.get("publish_mode", "auto")
    is_published = publish_mode == "auto"

    doc = {
        "id": post_id,
        "title": gen["title"][:200],
        "slug": slug,
        "excerpt": gen["excerpt"][:500],
        "content": md_to_html(gen["content"]),
        "tags": gen.get("tags") or [],
        "author_id": "auto-blog",
        "author_name": "Addrika Editorial",
        "is_published": is_published,
        "views": 0,
        "created_at": now,
        "updated_at": now,
        "published_at": now if is_published else None,
        "featured_image": (
            f"/api/blog/images/{post_id}/hero" if hero_path else None
        ),
        "auto_generated": True,
        "geo_city": gen.get("geo_city") or topic.get("geo_city") or "",
        "faqs": gen.get("faqs") or [],
        "social_caption": gen.get("social_caption") or "",
        "hero_storage_path": hero_path,
        "inline_storage_paths": [p for p in [in1_path, in2_path] if p],
        "jsonld": jsonld,
        "topic_source": topic["source"],
    }
    await db.blog_posts.insert_one(doc)
    logger.info(f"Auto-blog: created post {slug!r} (published={is_published})")

    # 5) Update settings — bump cycle, set last_run / next_due (RANDOMIZED)
    await update_settings(
        db,
        {
            "cycle_count": cycle_count + 1,
            "last_run_at": now.isoformat(),
            "next_due_at": _next_due(
                now.isoformat(),
                float(cfg.get("cadence_min_days", 2.0)),
                float(cfg.get("cadence_max_days", 4.0)),
            ),
        },
        admin_email=admin_email,
    )
    await _log_run(db, ok=True, post_id=post_id, slug=slug, topic=topic)

    return {
        "ok": True,
        "post_id": post_id,
        "slug": slug,
        "is_published": is_published,
        "hero_image": bool(hero_path),
        "inline_images": sum(1 for p in (in1_path, in2_path) if p),
    }


def _build_jsonld(gen: dict, slug: str, topic: dict, hero_path: Optional[str], post_id: str) -> dict:
    base = os.environ.get("PUBLIC_FRONTEND_URL", "https://centraders.com").rstrip("/")
    image_url = (
        f"{base}/api/blog/images/{post_id}/hero" if hero_path else f"{base}/og-default.png"
    )
    article = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": gen["title"],
        "description": gen["excerpt"],
        "image": [image_url],
        "datePublished": datetime.now(timezone.utc).isoformat(),
        "dateModified": datetime.now(timezone.utc).isoformat(),
        "author": {"@type": "Organization", "name": "Addrika"},
        "publisher": {
            "@type": "Organization",
            "name": "Addrika",
            "logo": {"@type": "ImageObject", "url": f"{base}/logo.png"},
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": f"{base}/blog/{slug}"},
        "keywords": ", ".join(gen.get("tags") or []),
    }
    if topic.get("geo_city"):
        article["contentLocation"] = {"@type": "Place", "name": topic["geo_city"]}
    faqs = gen.get("faqs") or []
    faq_jsonld = None
    if faqs:
        faq_jsonld = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": f.get("q", ""),
                    "acceptedAnswer": {"@type": "Answer", "text": f.get("a", "")},
                }
                for f in faqs
                if f.get("q") and f.get("a")
            ],
        }
    return {"article": article, "faq": faq_jsonld}


async def _log_run(db, ok: bool, post_id: str = None, slug: str = None,
                   topic: dict = None, error: str = None):
    await db.auto_blog_log.insert_one(
        {
            "id": str(uuid.uuid4()),
            "ok": ok,
            "post_id": post_id,
            "slug": slug,
            "topic_source": (topic or {}).get("source"),
            "seed_title": (topic or {}).get("seed_title"),
            "error": error,
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }
    )


async def get_recent_log(db, limit: int = 20) -> List[dict]:
    items = await db.auto_blog_log.find({}, {"_id": 0}).sort("ran_at", -1).to_list(limit)
    return items


# ---------------------------------------------------------------------------
# Scheduler — checks every hour whether we're due, fires run_one_cycle if so
# ---------------------------------------------------------------------------
SCHEDULER_INTERVAL_SECONDS = 3600  # 1 hour


async def scheduler_loop(db):
    """Long-running background task started on FastAPI startup. Cheap — only
    fires generation calls when actually due (2-3 times/week by default)."""
    logger.info("Auto-blog scheduler started")
    while True:
        try:
            await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)
            cfg = await get_settings(db)
            if not cfg["enabled"]:
                continue
            if not cfg.get("next_due_at"):
                await update_settings(
                    db,
                    {"next_due_at": datetime.now(timezone.utc).isoformat()},
                    admin_email="system:scheduler-init",
                )
                continue
            try:
                due = datetime.fromisoformat(cfg["next_due_at"].replace("Z", "+00:00"))
            except Exception:
                continue
            if datetime.now(timezone.utc) >= due:
                logger.info("Auto-blog: due — running cycle")
                res = await run_one_cycle(db, admin_email="system:scheduler")
                logger.info(f"Auto-blog cycle result: {res}")
        except asyncio.CancelledError:
            logger.info("Auto-blog scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"Auto-blog scheduler tick error: {e}")
