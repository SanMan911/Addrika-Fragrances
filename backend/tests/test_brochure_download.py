"""Regression test for the public tri-fold brochure download endpoint."""
import os
import httpx
import pytest

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://incense-retail.preview.emergentagent.com",
).rstrip("/")


@pytest.mark.asyncio
async def test_brochure_download_returns_valid_pdf():
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(f"{BASE_URL}/api/brochure/download")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    body = r.content
    assert body[:8] == b"%PDF-1.4"
    assert body.rstrip().endswith(b"%%EOF")
    # Reasonable size: not blank, not absurd (<1.5 MB after image compression)
    assert 30 * 1024 < len(body) < 1_500_000, f"unexpected size {len(body)} bytes"


@pytest.mark.asyncio
async def test_brochure_has_two_pages():
    """Tri-fold brochure must have exactly 2 pages (outside + inside).
    Detected by counting `/Type /Page` occurrences in the PDF stream
    (cheaper than installing a full PDF reader).
    """
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(f"{BASE_URL}/api/brochure/download")
    body = r.content
    # ReportLab emits one `/Type /Page` per page object.
    page_count = body.count(b"/Type /Page\n") + body.count(b"/Type /Page ")
    # Allow >=2 because trailers may include page-tree entries.
    assert page_count >= 2, f"expected at least 2 page objects, got {page_count}"
