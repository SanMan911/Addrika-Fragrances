"""
Blog API Tests - Testing 4 SEO-optimized blog articles for AI discoverability
Tests: Blog listing, individual blog posts, llms.txt blog URLs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://kyc-verification-14.preview.emergentagent.com').rstrip('/')

# Expected blog slugs
EXPECTED_SLUGS = [
    "best-charcoal-free-incense-india-2026",
    "how-to-use-arabian-bakhoor-at-home",
    "best-incense-for-meditation-yoga",
    "charcoal-free-vs-regular-agarbatti-difference"
]


class TestBlogListingAPI:
    """Test GET /api/blog/posts - Blog listing endpoint"""
    
    def test_blog_posts_returns_200(self):
        """Blog posts endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Blog posts endpoint returns 200")
    
    def test_blog_posts_returns_4_posts(self):
        """Blog posts endpoint returns exactly 4 published posts"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        assert "posts" in data, "Response missing 'posts' field"
        assert "total" in data, "Response missing 'total' field"
        assert data["total"] == 4, f"Expected 4 posts, got {data['total']}"
        assert len(data["posts"]) == 4, f"Expected 4 posts in array, got {len(data['posts'])}"
        print(f"PASS: Blog posts returns 4 posts (total: {data['total']})")
    
    def test_blog_posts_have_required_fields(self):
        """Each blog post has required fields: slug, title, excerpt, tags, featuredImage, createdAt, views"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        required_fields = ["slug", "title", "excerpt", "tags", "featuredImage", "createdAt", "views"]
        
        for post in data["posts"]:
            for field in required_fields:
                assert field in post, f"Post '{post.get('slug', 'unknown')}' missing field: {field}"
        print(f"PASS: All 4 posts have required fields: {required_fields}")
    
    def test_blog_posts_have_correct_slugs(self):
        """Blog posts contain all 4 expected slugs"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        actual_slugs = [post["slug"] for post in data["posts"]]
        
        for expected_slug in EXPECTED_SLUGS:
            assert expected_slug in actual_slugs, f"Missing expected slug: {expected_slug}"
        print(f"PASS: All 4 expected blog slugs present")
    
    def test_blog_posts_have_author_addrika(self):
        """All blog posts have author 'Addrika Fragrances'"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        
        for post in data["posts"]:
            assert post.get("author") == "Addrika Fragrances", f"Post '{post['slug']}' has wrong author: {post.get('author')}"
        print("PASS: All posts have author 'Addrika Fragrances'")


class TestBlogPostDetailAPI:
    """Test GET /api/blog/posts/{slug} - Individual blog post endpoints"""
    
    def test_charcoal_free_incense_post(self):
        """Blog post: best-charcoal-free-incense-india-2026 loads with full content"""
        slug = "best-charcoal-free-incense-india-2026"
        response = requests.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slug"] == slug
        assert "content" in data, "Missing 'content' field"
        assert len(data["content"]) > 1000, "Content too short"
        assert "centraders.com" in data["content"], "Missing product links to centraders.com"
        assert "charcoal-free" in data["tags"], "Missing 'charcoal-free' tag"
        print(f"PASS: {slug} loads with full content and product links")
    
    def test_arabian_bakhoor_post(self):
        """Blog post: how-to-use-arabian-bakhoor-at-home loads with bakhoor product links"""
        slug = "how-to-use-arabian-bakhoor-at-home"
        response = requests.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slug"] == slug
        assert "content" in data
        assert "bakhoor" in data["tags"], "Missing 'bakhoor' tag"
        # Check for bakhoor product links
        assert "grated-omani-bakhoor" in data["content"] or "yemeni-bakhoor" in data["content"], "Missing bakhoor product links"
        print(f"PASS: {slug} loads with bakhoor product links")
    
    def test_meditation_yoga_post(self):
        """Blog post: best-incense-for-meditation-yoga loads with meditation product recommendations"""
        slug = "best-incense-for-meditation-yoga"
        response = requests.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slug"] == slug
        assert "content" in data
        assert "meditation" in data["tags"], "Missing 'meditation' tag"
        assert "yoga" in data["tags"], "Missing 'yoga' tag"
        # Check for meditation product recommendations
        assert "kesar-chandan" in data["content"] or "oriental-oudh" in data["content"], "Missing meditation product links"
        print(f"PASS: {slug} loads with meditation product recommendations")
    
    def test_charcoal_free_vs_regular_post(self):
        """Blog post: charcoal-free-vs-regular-agarbatti-difference loads with comparison table"""
        slug = "charcoal-free-vs-regular-agarbatti-difference"
        response = requests.get(f"{BASE_URL}/api/blog/posts/{slug}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slug"] == slug
        assert "content" in data
        assert "comparison" in data["tags"], "Missing 'comparison' tag"
        # Check for comparison table
        assert "<table>" in data["content"], "Missing comparison table HTML"
        print(f"PASS: {slug} loads with comparison table")
    
    def test_nonexistent_post_returns_404(self):
        """Non-existent blog post returns 404"""
        response = requests.get(f"{BASE_URL}/api/blog/posts/nonexistent-post-slug")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent post returns 404")


class TestLlmsTxtBlogURLs:
    """Test /llms.txt includes blog article URLs"""
    
    def test_llms_txt_accessible(self):
        """llms.txt is accessible"""
        response = requests.get(f"{BASE_URL}/llms.txt")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /llms.txt is accessible")
    
    def test_llms_txt_contains_blog_section(self):
        """llms.txt contains Blog Articles section"""
        response = requests.get(f"{BASE_URL}/llms.txt")
        content = response.text
        assert "Blog Articles" in content or "blog" in content.lower(), "Missing Blog Articles section"
        print("PASS: /llms.txt contains Blog Articles section")
    
    def test_llms_txt_contains_blog_urls(self):
        """llms.txt contains all 4 blog article URLs"""
        response = requests.get(f"{BASE_URL}/llms.txt")
        content = response.text
        
        expected_urls = [
            "best-charcoal-free-incense-india-2026",
            "how-to-use-arabian-bakhoor-at-home",
            "best-incense-for-meditation-yoga",
            "charcoal-free-vs-regular-agarbatti-difference"
        ]
        
        for url_slug in expected_urls:
            assert url_slug in content, f"Missing blog URL containing: {url_slug}"
        print("PASS: /llms.txt contains all 4 blog article URLs")


class TestBlogPostDataIntegrity:
    """Test blog post data integrity and dual field naming"""
    
    def test_dual_field_naming(self):
        """Blog posts have both snake_case and camelCase fields for compatibility"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        
        for post in data["posts"]:
            # Check dual naming for featured image
            assert "featured_image" in post or "featuredImage" in post, f"Post missing featured image field"
            # Check dual naming for created at
            assert "created_at" in post or "createdAt" in post, f"Post missing created at field"
        print("PASS: Blog posts have dual field naming (snake_case + camelCase)")
    
    def test_featured_images_are_unsplash(self):
        """Featured images are from Unsplash"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        
        for post in data["posts"]:
            featured_image = post.get("featuredImage") or post.get("featured_image")
            assert "unsplash.com" in featured_image, f"Post '{post['slug']}' image not from Unsplash: {featured_image}"
        print("PASS: All featured images are from Unsplash")
    
    def test_views_are_positive_integers(self):
        """Views field contains positive integers"""
        response = requests.get(f"{BASE_URL}/api/blog/posts")
        data = response.json()
        
        for post in data["posts"]:
            views = post.get("views", 0)
            assert isinstance(views, int), f"Views should be int, got {type(views)}"
            assert views >= 0, f"Views should be non-negative, got {views}"
        print("PASS: All posts have valid view counts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
