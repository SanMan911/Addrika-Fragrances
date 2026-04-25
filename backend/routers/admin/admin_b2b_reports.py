"""
Admin B2B Sales Reports & Top-Retailer analytics.
- Quarterly tracking (calendar-quarter aligned)
- Indian FY total (Apr 1 → Mar 31)
- Custom date-range filter (+ group_by retailer | quarter | month)
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import logging

from dependencies import db, require_admin
from services.b2b_loyalty import (
    current_quarter_range,
    list_active_milestones,
    applicable_milestone,
    next_milestone,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/b2b/reports", tags=["Admin B2B Reports"])


def current_fy_range(now: Optional[datetime] = None):
    """Indian FY: Apr 1 → next Apr 1."""
    now = now or datetime.now(timezone.utc)
    if now.month >= 4:
        start = datetime(now.year, 4, 1, tzinfo=timezone.utc)
        end = datetime(now.year + 1, 4, 1, tzinfo=timezone.utc)
    else:
        start = datetime(now.year - 1, 4, 1, tzinfo=timezone.utc)
        end = datetime(now.year, 4, 1, tzinfo=timezone.utc)
    label = f"FY{start.year % 100:02d}-{end.year % 100:02d}"
    return start, end, label


def _resolve_range(period: str, from_date: Optional[str], to_date: Optional[str]):
    """Returns (start_iso, end_iso, label)."""
    if period == "quarter":
        s, e, lbl = current_quarter_range()
        return s.isoformat(), e.isoformat(), lbl
    if period == "fy":
        s, e, lbl = current_fy_range()
        return s.isoformat(), e.isoformat(), lbl
    if period == "custom":
        if not from_date or not to_date:
            raise HTTPException(
                status_code=400, detail="from and to required for custom period"
            )
        try:
            s = datetime.fromisoformat(from_date.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
            e = datetime.fromisoformat(to_date.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid ISO date")
        return s.isoformat(), e.isoformat(), f"{from_date} → {to_date}"
    raise HTTPException(status_code=400, detail="period must be quarter|fy|custom")


@router.get("/top-retailers")
async def admin_top_retailers(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "quarter",
    limit: int = 5,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Top retailers by paid B2B purchases in the chosen window."""
    await require_admin(request, session_token)
    s, e, lbl = _resolve_range(period, from_date, to_date)

    pipeline = [
        {
            "$match": {
                "payment_status": "paid",
                "created_at": {"$gte": s, "$lt": e},
            }
        },
        {
            "$group": {
                "_id": "$retailer_id",
                "purchases_total": {"$sum": "$grand_total"},
                "order_count": {"$sum": 1},
                "last_order_at": {"$max": "$created_at"},
            }
        },
        {"$sort": {"purchases_total": -1}},
        {"$limit": max(1, min(limit, 50))},
    ]
    results = await db.b2b_orders.aggregate(pipeline).to_list(50)
    milestones = await list_active_milestones(db)

    enriched = []
    for r in results:
        retailer_id = r["_id"]
        retailer = await db.retailers.find_one(
            {"retailer_id": retailer_id},
            {"_id": 0, "business_name": 1, "trade_name": 1, "email": 1, "phone": 1, "city": 1},
        ) or {}
        applied = applicable_milestone(milestones, r["purchases_total"])
        nxt = next_milestone(milestones, r["purchases_total"])
        gap = (
            round(float(nxt["min_purchase"]) - r["purchases_total"], 2)
            if nxt
            else 0
        )
        enriched.append(
            {
                "retailer_id": retailer_id,
                "retailer_name": retailer.get("business_name")
                or retailer.get("trade_name")
                or retailer_id,
                "retailer_email": retailer.get("email"),
                "retailer_phone": retailer.get("phone"),
                "retailer_country_code": retailer.get("country_code") or "+91",
                "retailer_city": retailer.get("city"),
                "purchases_total": round(r["purchases_total"], 2),
                "order_count": r["order_count"],
                "last_order_at": r["last_order_at"],
                "applied_milestone": applied,
                "next_milestone": nxt,
                "gap_to_next": gap,
                "is_close_to_next": bool(nxt) and gap > 0 and gap <= max(2000, float(nxt["min_purchase"]) * 0.1),
            }
        )

    return {
        "period": period,
        "period_label": lbl,
        "from": s,
        "to": e,
        "top_retailers": enriched,
    }


@router.get("/sales")
async def admin_sales_report(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    period: str = "fy",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    group_by: str = "retailer",
):
    """Combined + breakdown sales report for the chosen window.

    group_by: retailer | quarter | month
    """
    await require_admin(request, session_token)
    s, e, lbl = _resolve_range(period, from_date, to_date)

    base_match = {
        "$match": {
            "payment_status": "paid",
            "created_at": {"$gte": s, "$lt": e},
        }
    }

    # Combined totals
    combined = await db.b2b_orders.aggregate(
        [
            base_match,
            {
                "$group": {
                    "_id": None,
                    "purchases_total": {"$sum": "$grand_total"},
                    "gst_total": {"$sum": "$gst_total"},
                    "order_count": {"$sum": 1},
                    "unique_retailers": {"$addToSet": "$retailer_id"},
                }
            },
        ]
    ).to_list(1)

    combined_doc = (
        combined[0]
        if combined
        else {
            "purchases_total": 0,
            "gst_total": 0,
            "order_count": 0,
            "unique_retailers": [],
        }
    )
    combined_summary = {
        "purchases_total": round(combined_doc.get("purchases_total", 0), 2),
        "gst_total": round(combined_doc.get("gst_total", 0), 2),
        "order_count": combined_doc.get("order_count", 0),
        "unique_retailer_count": len(combined_doc.get("unique_retailers") or []),
    }

    # Breakdown
    if group_by == "retailer":
        rows = await db.b2b_orders.aggregate(
            [
                base_match,
                {
                    "$group": {
                        "_id": "$retailer_id",
                        "purchases_total": {"$sum": "$grand_total"},
                        "gst_total": {"$sum": "$gst_total"},
                        "order_count": {"$sum": 1},
                    }
                },
                {"$sort": {"purchases_total": -1}},
            ]
        ).to_list(500)
        breakdown = []
        for r in rows:
            retailer = await db.retailers.find_one(
                {"retailer_id": r["_id"]},
                {"_id": 0, "business_name": 1, "trade_name": 1, "email": 1},
            ) or {}
            breakdown.append(
                {
                    "key": r["_id"],
                    "label": retailer.get("business_name") or retailer.get("trade_name") or r["_id"],
                    "email": retailer.get("email"),
                    "purchases_total": round(r["purchases_total"], 2),
                    "gst_total": round(r["gst_total"], 2),
                    "order_count": r["order_count"],
                }
            )
    elif group_by in ("quarter", "month"):
        # We store created_at as ISO string; use $substr for month/quarter grouping
        if group_by == "month":
            key_expr = {"$substr": ["$created_at", 0, 7]}  # YYYY-MM
        else:
            # Quarter label: derive from month number
            key_expr = {
                "$concat": [
                    {"$substr": ["$created_at", 0, 4]},
                    "-Q",
                    {
                        "$toString": {
                            "$ceil": {
                                "$divide": [
                                    {"$toInt": {"$substr": ["$created_at", 5, 2]}},
                                    3,
                                ]
                            }
                        }
                    },
                ]
            }
        rows = await db.b2b_orders.aggregate(
            [
                base_match,
                {
                    "$group": {
                        "_id": key_expr,
                        "purchases_total": {"$sum": "$grand_total"},
                        "gst_total": {"$sum": "$gst_total"},
                        "order_count": {"$sum": 1},
                    }
                },
                {"$sort": {"_id": 1}},
            ]
        ).to_list(500)
        breakdown = [
            {
                "key": r["_id"],
                "label": r["_id"],
                "purchases_total": round(r["purchases_total"], 2),
                "gst_total": round(r["gst_total"], 2),
                "order_count": r["order_count"],
            }
            for r in rows
        ]
    else:
        raise HTTPException(
            status_code=400, detail="group_by must be retailer|quarter|month"
        )

    return {
        "period": period,
        "period_label": lbl,
        "from": s,
        "to": e,
        "group_by": group_by,
        "combined": combined_summary,
        "breakdown": breakdown,
    }
