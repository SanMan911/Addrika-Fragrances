"""Public route to download the Addrika tri-fold product brochure as PDF."""
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from dependencies import db
from services.brochure_pdf import build_brochure_pdf, BRAND_NAME

router = APIRouter(tags=["Brochure"])


@router.get("/brochure/download")
async def download_brochure():
    """Generate and stream the latest tri-fold brochure PDF.

    The catalogue is read live from MongoDB, so any product added by the
    admin appears in the next downloaded brochure automatically.
    """
    products = await db.products.find(
        {"isActive": {"$ne": False}, "comingSoon": {"$ne": True}},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)

    pdf_bytes = build_brochure_pdf(products)

    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"{BRAND_NAME.replace(' ', '_')}_Brochure_{today}.pdf"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "public, max-age=300",  # CDN-friendly
    }
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers=headers,
    )
