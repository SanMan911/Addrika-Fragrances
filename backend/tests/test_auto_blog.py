"""Tests for the auto-blog orchestrator (mocked LLM + image gen)."""
from __future__ import annotations

import os
import asyncio
import json
import base64
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")

from server import db as motor_db  # noqa: E402
from services import auto_blog  # noqa: E402
from services.auto_blog_topics import TOPIC_BANK, SEASONAL_HINTS  # noqa: E402


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture
def cleanup_state(mongo):
    """Wipe auto-blog state before/after each test."""
    mongo.admin_settings.delete_one({"setting_key": "auto_blog"})
    # Don't delete real seeded blog posts — only tag-prefixed test ones
    mongo.blog_posts.delete_many({"auto_generated": True, "tags": "pytest-auto"})
    mongo.auto_blog_log.delete_many({"seed_title": {"$regex": "^pytest"}})
    # Force image staggers to 0 so tests don't sleep 36s waiting for Pollinations
    auto_blog.IMAGE_STAGGER_INLINE_1 = 0
    auto_blog.IMAGE_STAGGER_INLINE_2 = 0
    yield
    mongo.admin_settings.delete_one({"setting_key": "auto_blog"})
    mongo.blog_posts.delete_many({"auto_generated": True, "tags": "pytest-auto"})
    mongo.auto_blog_log.delete_many({"seed_title": {"$regex": "^pytest"}})


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Topic bank smoke
# ---------------------------------------------------------------------------
class TestTopicBank:
    def test_bank_has_30_plus_entries(self):
        assert len(TOPIC_BANK) >= 30

    def test_each_entry_has_4_fields(self):
        for entry in TOPIC_BANK:
            assert len(entry) == 4
            title, category, geo, keywords = entry
            assert isinstance(title, str) and len(title) > 10
            assert isinstance(category, str)
            assert geo is None or isinstance(geo, str)
            assert isinstance(keywords, list) and len(keywords) >= 2

    def test_seasonal_hints_cover_all_months(self):
        assert set(SEASONAL_HINTS.keys()) == set(range(1, 13))


# ---------------------------------------------------------------------------
# Settings + cycle
# ---------------------------------------------------------------------------
class TestSettings:
    def test_default_settings(self, cleanup_state):
        cfg = _run(auto_blog.get_settings(motor_db))
        assert cfg["enabled"] is True
        assert cfg["cadence_min_days"] == 2.0
        assert cfg["cadence_max_days"] == 4.0
        assert cfg["publish_mode"] == "auto"
        assert cfg["cycle_count"] == 0

    def test_update_settings(self, cleanup_state):
        cfg = _run(auto_blog.update_settings(
            motor_db,
            {"cadence_min_days": 3.0, "cadence_max_days": 5.0, "publish_mode": "draft"},
        ))
        assert cfg["cadence_min_days"] == 3.0
        assert cfg["cadence_max_days"] == 5.0
        assert cfg["publish_mode"] == "draft"

    def test_next_due_calculation(self):
        from datetime import datetime, timezone
        # Randomized: should land between base + 2d and base + 4d
        out = auto_blog._next_due("2026-04-26T10:00:00+00:00", 2.0, 4.0)
        due = datetime.fromisoformat(out)
        base = datetime(2026, 4, 26, 10, 0, tzinfo=timezone.utc)
        delta_days = (due - base).total_seconds() / 86400
        # Allow a small margin because hour-snap can shift slightly
        assert 1.5 <= delta_days <= 4.5


# ---------------------------------------------------------------------------
# Topic picker
# ---------------------------------------------------------------------------
class TestTopicPicker:
    def test_even_cycle_uses_bank(self, cleanup_state):
        topic = _run(auto_blog._pick_topic(motor_db, cycle_count=0))
        assert topic["source"] == "bank"
        assert topic["seed_title"]

    def test_odd_cycle_uses_trend(self, cleanup_state):
        topic = _run(auto_blog._pick_topic(motor_db, cycle_count=1))
        assert topic["source"] == "trend"
        assert "season_hint" in topic


# ---------------------------------------------------------------------------
# Full run cycle (LLM + image mocked)
# ---------------------------------------------------------------------------
FAKE_LLM_RESPONSE = json.dumps({
    "title": "Pytest Auto Blog Title — Premium Incense",
    "slug": "pytest-auto-blog-title",
    "excerpt": "Pytest-generated excerpt for testing the auto-blog pipeline.",
    "content": "## Hello\n\nThis is the body.\n\n## Frequently Asked Questions\n\n### What is this?\nA test post.",
    "tags": ["pytest-auto", "test"],
    "geo_city": "Delhi",
    "hero_image_prompt": "A hero image prompt",
    "inline_image_1_prompt": "Inline 1 prompt",
    "inline_image_2_prompt": "Inline 2 prompt",
    "faqs": [
        {"q": "What is this?", "a": "A test post."},
        {"q": "Why?", "a": "Because pytest."},
    ],
    "social_caption": "Pytest blog post 🧪 #addrika",
})


class TestRunCycle:
    def test_run_cycle_creates_post(self, cleanup_state, mongo, monkeypatch):
        monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
        # Force re-read in module
        auto_blog.GEMINI_API_KEY = "test-key"

        async def fake_generate_text(topic):
            data = json.loads(FAKE_LLM_RESPONSE)
            return data

        async def fake_generate_image(prompt, kind="hero"):
            # 1x1 PNG
            return base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
            )

        async def fake_save_image(post_id, kind, data):
            return f"addrika/blog-images/{post_id}/{kind}.png"

        with patch.object(auto_blog, "_generate_text", side_effect=fake_generate_text), \
             patch.object(auto_blog, "_generate_image", side_effect=fake_generate_image), \
             patch.object(auto_blog, "_save_image", side_effect=fake_save_image):
            result = _run(auto_blog.run_one_cycle(motor_db, force=True))

        assert result["ok"] is True
        assert result["slug"]
        assert result["is_published"] is True
        assert result["hero_image"] is True
        assert result["inline_images"] == 2

        # Persisted post
        post = mongo.blog_posts.find_one({"id": result["post_id"]})
        assert post is not None
        assert post["is_published"] is True
        assert post["auto_generated"] is True
        assert post["geo_city"] == "Delhi"
        assert len(post["faqs"]) == 2
        assert post["jsonld"]["article"]["@type"] == "BlogPosting"
        assert post["jsonld"]["faq"]["@type"] == "FAQPage"
        assert post["featured_image"].startswith("/api/blog/images/")
        assert len(post["inline_storage_paths"]) == 2

        # Cycle count incremented
        cfg = _run(auto_blog.get_settings(motor_db))
        assert cfg["cycle_count"] == 1
        assert cfg["last_run_at"]
        assert cfg["next_due_at"]

    def test_run_cycle_skipped_when_disabled(self, cleanup_state):
        _run(auto_blog.update_settings(motor_db, {"enabled": False}))
        result = _run(auto_blog.run_one_cycle(motor_db, force=False))
        assert result["ok"] is False
        assert result.get("skipped") == "disabled"

    def test_run_cycle_force_overrides_disabled(self, cleanup_state, monkeypatch):
        monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "")
        auto_blog.GEMINI_API_KEY = ""
        _run(auto_blog.update_settings(motor_db, {"enabled": False}))
        # force=True bypasses disabled, but still fails on no API key
        result = _run(auto_blog.run_one_cycle(motor_db, force=True))
        assert result["ok"] is False
        assert "GOOGLE_AI_STUDIO_API_KEY" in result.get("error", "")

    def test_draft_mode_does_not_publish(self, cleanup_state, mongo, monkeypatch):
        monkeypatch.setenv("GOOGLE_AI_STUDIO_API_KEY", "test-key")
        auto_blog.GEMINI_API_KEY = "test-key"
        _run(auto_blog.update_settings(motor_db, {"publish_mode": "draft"}))

        async def fake_text(t):
            return json.loads(FAKE_LLM_RESPONSE)

        async def fake_img(p, kind="hero"):
            return None

        async def fake_save(*a):
            return None

        with patch.object(auto_blog, "_generate_text", side_effect=fake_text), \
             patch.object(auto_blog, "_generate_image", side_effect=fake_img), \
             patch.object(auto_blog, "_save_image", side_effect=fake_save):
            result = _run(auto_blog.run_one_cycle(motor_db, force=True))

        assert result["ok"] is True
        assert result["is_published"] is False

        post = mongo.blog_posts.find_one({"id": result["post_id"]})
        assert post["is_published"] is False
        assert post["published_at"] is None


class TestJSONLDBuilder:
    def test_jsonld_includes_geo_when_set(self):
        from services.auto_blog import _build_jsonld
        gen = {
            "title": "T",
            "excerpt": "E",
            "tags": ["a", "b"],
            "faqs": [{"q": "Q?", "a": "A."}],
        }
        topic = {"geo_city": "Delhi"}
        out = _build_jsonld(gen, "test-slug", topic, "addrika/blog-images/X/hero.png", "X")
        assert out["article"]["contentLocation"]["name"] == "Delhi"
        assert out["faq"]["mainEntity"][0]["name"] == "Q?"

    def test_jsonld_no_faq_when_empty(self):
        from services.auto_blog import _build_jsonld
        gen = {"title": "T", "excerpt": "E", "tags": [], "faqs": []}
        out = _build_jsonld(gen, "s", {}, None, "X")
        assert out["faq"] is None
        assert out["article"]["@type"] == "BlogPosting"
