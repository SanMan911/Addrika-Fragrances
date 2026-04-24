"""
B2B Retailer Loyalty Bonus Service
Quarterly purchase-based discount tiers (admin-configurable).
"""
from datetime import datetime, timezone
from typing import Optional, List
import logging
import uuid

logger = logging.getLogger(__name__)


def current_quarter_range(now: Optional[datetime] = None):
    """Return (start, end, label) for the calendar quarter containing `now` (UTC)."""
    now = now or datetime.now(timezone.utc)
    q = (now.month - 1) // 3  # 0..3
    start_month = q * 3 + 1
    start = datetime(now.year, start_month, 1, tzinfo=timezone.utc)
    # End = first day of next quarter
    if q == 3:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, start_month + 3, 1, tzinfo=timezone.utc)
    label = f"{now.year}-Q{q + 1}"
    return start, end, label


async def get_retailer_quarter_purchases(db, retailer_id: str) -> dict:
    """Sum retailer's paid B2B order totals in the current quarter."""
    start, end, label = current_quarter_range()
    pipeline = [
        {
            "$match": {
                "retailer_id": retailer_id,
                "payment_status": "paid",
                "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$grand_total"}, "count": {"$sum": 1}}},
    ]
    agg = await db.b2b_orders.aggregate(pipeline).to_list(1)
    total = float(agg[0]["total"]) if agg else 0.0
    count = int(agg[0]["count"]) if agg else 0
    return {
        "quarter_label": label,
        "quarter_start": start.isoformat(),
        "quarter_end": end.isoformat(),
        "purchases_total": round(total, 2),
        "order_count": count,
    }


async def list_active_milestones(db) -> List[dict]:
    """Return active milestones sorted ascending by min_purchase."""
    items = await db.loyalty_milestones.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(100)
    return sorted(items, key=lambda m: float(m.get("min_purchase", 0)))


def applicable_milestone(milestones: List[dict], purchases_total: float) -> Optional[dict]:
    """Pick the highest-min_purchase milestone whose threshold is met."""
    applied = None
    for m in milestones:
        if purchases_total + 1e-9 >= float(m.get("min_purchase", 0)):
            applied = m
    return applied


def next_milestone(milestones: List[dict], purchases_total: float) -> Optional[dict]:
    """Return the immediate next milestone the retailer can reach."""
    for m in milestones:
        if float(m.get("min_purchase", 0)) > purchases_total + 1e-9:
            return m
    return None


async def get_retailer_loyalty_state(db, retailer_id: str) -> dict:
    """Bundled state for retailer UI progress bar."""
    quarter = await get_retailer_quarter_purchases(db, retailer_id)
    milestones = await list_active_milestones(db)
    applied = applicable_milestone(milestones, quarter["purchases_total"])
    nxt = next_milestone(milestones, quarter["purchases_total"])

    progress_percent = 0.0
    gap_to_next = 0.0
    if milestones:
        top_threshold = float(milestones[-1]["min_purchase"])
        if top_threshold > 0:
            progress_percent = min(
                100.0, (quarter["purchases_total"] / top_threshold) * 100
            )
        if nxt:
            gap_to_next = max(
                0.0, float(nxt["min_purchase"]) - quarter["purchases_total"]
            )

    return {
        **quarter,
        "milestones": milestones,
        "applied_milestone": applied,
        "next_milestone": nxt,
        "gap_to_next": round(gap_to_next, 2),
        "progress_percent": round(progress_percent, 2),
    }


# ---------------------------------------------------------------------------
# Admin CRUD on milestones (pure service helpers)
# ---------------------------------------------------------------------------

async def create_milestone(
    db,
    min_purchase: float,
    discount_percent: float,
    label: Optional[str],
    admin_email: str,
) -> dict:
    if min_purchase < 0 or discount_percent < 0 or discount_percent > 50:
        raise ValueError("min_purchase >= 0 and discount_percent in [0, 50]")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "min_purchase": float(min_purchase),
        "discount_percent": float(discount_percent),
        "label": label or f"₹{int(min_purchase):,} → {discount_percent}%",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": admin_email,
    }
    await db.loyalty_milestones.insert_one(doc)
    logger.info(
        f"Loyalty milestone created: ₹{min_purchase} → {discount_percent}% by {admin_email}"
    )
    return {**doc, "_id": None}  # drop mongo _id before return (we already don't have it here)


async def update_milestone(
    db, milestone_id: str, updates: dict, admin_email: str
) -> dict:
    allowed = {"min_purchase", "discount_percent", "label", "is_active"}
    clean = {k: v for k, v in updates.items() if k in allowed and v is not None}
    if "min_purchase" in clean and clean["min_purchase"] < 0:
        raise ValueError("min_purchase >= 0")
    if "discount_percent" in clean and not (0 <= clean["discount_percent"] <= 50):
        raise ValueError("discount_percent in [0, 50]")
    clean["updated_at"] = datetime.now(timezone.utc).isoformat()
    clean["updated_by"] = admin_email
    result = await db.loyalty_milestones.update_one(
        {"id": milestone_id}, {"$set": clean}
    )
    if result.matched_count == 0:
        raise KeyError("Milestone not found")
    doc = await db.loyalty_milestones.find_one({"id": milestone_id}, {"_id": 0})
    return doc


async def delete_milestone(db, milestone_id: str) -> bool:
    result = await db.loyalty_milestones.delete_one({"id": milestone_id})
    return result.deleted_count > 0


async def seed_default_milestones_if_empty(db):
    """Seed the three starter milestones the user described, ONLY if empty."""
    count = await db.loyalty_milestones.count_documents({})
    if count > 0:
        return
    starters = [
        (10000, 0.5),
        (25000, 1.0),
        (50000, 2.0),
    ]
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for mp, dp in starters:
        docs.append(
            {
                "id": str(uuid.uuid4()),
                "min_purchase": float(mp),
                "discount_percent": float(dp),
                "label": f"₹{mp:,}+ → {dp}%",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "created_by": "system:init",
            }
        )
    await db.loyalty_milestones.insert_many(docs)
    logger.info(f"Seeded {len(docs)} default loyalty milestones")
