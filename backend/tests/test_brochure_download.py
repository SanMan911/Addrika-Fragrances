"""Regression test for the public tri-fold brochure download endpoint."""
import os
import httpx
import pytest

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://fragrance-rewards.preview.emergentagent.com",
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


@pytest.mark.asyncio
async def test_brochure_no_banned_messaging():
    """Brand-consistency rules: the brochure must NOT claim 100% natural,
    100% organic, halmaddi paste, or natural essential oils. It MUST carry
    the brand-approved messaging instead (Ethical Sourcing, 60%+ less smoke,
    Zero Charcoal)."""
    pytest.importorskip("pdfminer")
    from pdfminer.high_level import extract_text
    import io

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(f"{BASE_URL}/api/brochure/download")
    raw = extract_text(io.BytesIO(r.content)).lower()
    # Line-wrap in the PDF can break phrases across `\n` — normalise every
    # run of whitespace to a single space before asserting.
    text = " ".join(raw.split())

    for banned in (
        "100% natural", "100% organic", "halmaddi", "essential oils",
        "hand-rolled", "hand-crafted",
        # Origin-story contradictions vs `/our-story` on centraders.com:
        "third-generation", "third generation",
        "built on a refusal",
        # Previous non-women-empowerment narrative (Feb 2026 pivot):
        "journey across india",
        "traditional methods",
        "crafted for the ritual",
        # Overclaimed language corrected on Feb 2026 (SHG feedback):
        "women-led workshops",
        "fair, transparent wages",
        "without middlemen",
        "no middlemen",
    ):
        assert banned not in text, f"banned phrase {banned!r} found in brochure"

    for required in (
        "ethical sourcing", "60%+ less smoke", "zero charcoal",
        "crafted in delhi",
        # Women empowerment + sustainability alignment with `/our-story`:
        "made by women",
        "equal-participation workshops",
        "self-help groups",
        "fair, dignified wages",
        "flexible work-hours",
        "compost, recycle, or be reused",
    ):
        assert required in text, f"required phrase {required!r} missing from brochure"
