"""Pre-payment gate, dues killswitch and manual payment proofs for B2B ordering.

Product rules (agreed with the brand owner, Oct 2026):
▸ A wholesale order does not exist until an upfront payment of at least
  `min_payment_percent` of the order total has been VERIFIED. Nothing is
  reserved and no order number is issued before that — the cart lives in
  `b2b_order_intents` until the money lands.
▸ The shop chooses how much to pay now from a fixed ladder (70/80/90/100%).
  The rupee amount is derived server-side from the stored calculation; the
  client never supplies it.
▸ Paying 100% earns the cash discount, so the ladder doubles as a nudge.
▸ Killswitch: when enabled, any shop whose outstanding dues are older than
  `grace_days` is locked out of new orders. Admins can also lock a single
  shop by hand. A locked shop can submit payment details (mode, reference,
  date, amount) for an admin to verify, which clears the lock.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

ALLOWED_PAYMENT_PERCENTS = (70, 80, 90, 100)
CASH_DISCOUNT_PERCENT_THRESHOLD = 100

DEFAULT_PREPAYMENT_REQUIRED = True
DEFAULT_MIN_PAYMENT_PERCENT = 70
DEFAULT_KILLSWITCH_ENABLED = False
DEFAULT_GRACE_DAYS = 30

PAYMENT_MODES = ("upi", "net_banking", "credit_card", "debit_card", "neft_rtgs", "cheque", "cash")

SETTLED_PAYMENT_STATUSES = {"paid", "refunded"}
DEAD_ORDER_STATUSES = {"cancelled", "rejected", "returned"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
async def _get(db, key: str, default):
    doc = await db.admin_settings.find_one({"setting_key": key})
    if doc and "setting_value" in doc:
        return doc["setting_value"]
    return default


async def _set(db, key: str, value, admin_email: str):
    await db.admin_settings.update_one(
        {"setting_key": key},
        {"$set": {"setting_value": value, "updated_at": _now_iso(), "updated_by": admin_email}},
        upsert=True,
    )
    return value


async def get_settings(db) -> dict:
    return {
        "prepayment_required": bool(
            await _get(db, "b2b_prepayment_required", DEFAULT_PREPAYMENT_REQUIRED)
        ),
        "min_payment_percent": int(
            await _get(db, "b2b_min_payment_percent", DEFAULT_MIN_PAYMENT_PERCENT)
        ),
        "dues_killswitch_enabled": bool(
            await _get(db, "b2b_dues_killswitch_enabled", DEFAULT_KILLSWITCH_ENABLED)
        ),
        "dues_grace_days": int(await _get(db, "b2b_dues_grace_days", DEFAULT_GRACE_DAYS)),
        "allowed_payment_percents": list(ALLOWED_PAYMENT_PERCENTS),
        "payment_modes": list(PAYMENT_MODES),
    }


async def update_settings(
    db,
    admin_email: str,
    *,
    prepayment_required: Optional[bool] = None,
    min_payment_percent: Optional[int] = None,
    dues_killswitch_enabled: Optional[bool] = None,
    dues_grace_days: Optional[int] = None,
) -> dict:
    if prepayment_required is not None:
        await _set(db, "b2b_prepayment_required", bool(prepayment_required), admin_email)
    if min_payment_percent is not None:
        if int(min_payment_percent) not in ALLOWED_PAYMENT_PERCENTS:
            raise ValueError(
                f"Minimum payment must be one of {', '.join(str(p) for p in ALLOWED_PAYMENT_PERCENTS)}%"
            )
        await _set(db, "b2b_min_payment_percent", int(min_payment_percent), admin_email)
    if dues_killswitch_enabled is not None:
        await _set(db, "b2b_dues_killswitch_enabled", bool(dues_killswitch_enabled), admin_email)
    if dues_grace_days is not None:
        if int(dues_grace_days) < 0 or int(dues_grace_days) > 365:
            raise ValueError("Grace period must be between 0 and 365 days")
        await _set(db, "b2b_dues_grace_days", int(dues_grace_days), admin_email)
    return await get_settings(db)


async def allowed_percents(db) -> list[int]:
    """The ladder a shop may choose from, floored by the configured minimum."""
    minimum = (await get_settings(db))["min_payment_percent"]
    return [p for p in ALLOWED_PAYMENT_PERCENTS if p >= minimum]


# ---------------------------------------------------------------------------
# Outstanding dues
# ---------------------------------------------------------------------------
def order_outstanding(order: dict) -> float:
    """Rupees still owed on one order. Never negative."""
    if order.get("payment_status") in SETTLED_PAYMENT_STATUSES:
        return 0.0
    if order.get("order_status") in DEAD_ORDER_STATUSES:
        return 0.0
    total = float(order.get("grand_total") or 0)
    paid = float(order.get("amount_paid") or 0)
    return round(max(0.0, total - paid), 2)


async def dues_summary(db, retailer_id: str) -> dict:
    """Outstanding total for a shop plus how old the oldest unpaid order is."""
    settings = await get_settings(db)
    grace_days = settings["dues_grace_days"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=grace_days)

    outstanding = 0.0
    overdue = 0.0
    oldest_days = 0
    unpaid_orders = []

    cursor = db.b2b_orders.find(
        {"retailer_id": retailer_id, "payment_status": {"$nin": list(SETTLED_PAYMENT_STATUSES)}},
        {
            "_id": 0,
            "order_id": 1,
            "grand_total": 1,
            "amount_paid": 1,
            "payment_status": 1,
            "order_status": 1,
            "created_at": 1,
        },
    )
    async for order in cursor:
        due = order_outstanding(order)
        if due <= 0:
            continue
        outstanding += due
        placed = _parse_dt(order.get("created_at"))
        age_days = (datetime.now(timezone.utc) - placed).days if placed else 0
        oldest_days = max(oldest_days, age_days)
        if placed and placed < cutoff:
            overdue += due
        unpaid_orders.append(
            {
                "order_id": order.get("order_id"),
                "outstanding": due,
                "age_days": age_days,
                "placed_at": order.get("created_at"),
            }
        )

    unpaid_orders.sort(key=lambda o: o["age_days"], reverse=True)
    return {
        "outstanding_amount": round(outstanding, 2),
        "overdue_amount": round(overdue, 2),
        "oldest_unpaid_days": oldest_days,
        "grace_days": grace_days,
        "unpaid_orders": unpaid_orders[:20],
    }


def _parse_dt(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# Ordering lock
# ---------------------------------------------------------------------------
async def ordering_block(db, retailer: dict) -> Optional[dict]:
    """Return a block descriptor when this shop may not place orders, else None."""
    if retailer.get("ordering_blocked"):
        return {
            "blocked": True,
            "kind": "manual",
            "reason": retailer.get("ordering_block_note")
            or "Ordering has been paused on your account. Please contact the AAROHMM wholesale desk.",
            "blocked_at": retailer.get("ordering_blocked_at"),
        }

    settings = await get_settings(db)
    if not settings["dues_killswitch_enabled"]:
        return None

    dues = await dues_summary(db, retailer["retailer_id"])
    if dues["overdue_amount"] <= 0:
        return None
    return {
        "blocked": True,
        "kind": "dues",
        "reason": (
            f"New orders are paused because ₹{dues['overdue_amount']:,.0f} is outstanding "
            f"beyond the {dues['grace_days']}-day settlement window. Share your payment "
            "details so our team can verify and reopen ordering."
        ),
        "outstanding_amount": dues["outstanding_amount"],
        "overdue_amount": dues["overdue_amount"],
        "oldest_unpaid_days": dues["oldest_unpaid_days"],
        "grace_days": dues["grace_days"],
    }


async def set_manual_block(db, retailer_id: str, blocked: bool, admin_email: str, note: str = "") -> dict:
    update = {
        "ordering_blocked": bool(blocked),
        "ordering_block_note": note or None,
        "ordering_blocked_at": _now_iso() if blocked else None,
        "ordering_blocked_by": admin_email if blocked else None,
    }
    result = await db.retailers.update_one({"retailer_id": retailer_id}, {"$set": update})
    if result.matched_count == 0:
        raise ValueError("Retailer not found")
    logger.info("B2B ordering block for %s set to %s by %s", retailer_id, blocked, admin_email)
    return {"retailer_id": retailer_id, "ordering_blocked": bool(blocked), "note": note or None}


# ---------------------------------------------------------------------------
# Status payload shared by the web portal and the mobile app
# ---------------------------------------------------------------------------
async def gate_status(db, retailer: dict) -> dict:
    from services.b2b_settings import get_cash_discount_percent

    settings = await get_settings(db)
    dues = await dues_summary(db, retailer["retailer_id"])
    block = await ordering_block(db, retailer)
    return {
        "prepayment_required": settings["prepayment_required"],
        "min_payment_percent": settings["min_payment_percent"],
        "allowed_payment_percents": [
            p for p in ALLOWED_PAYMENT_PERCENTS if p >= settings["min_payment_percent"]
        ],
        "cash_discount_percent": await get_cash_discount_percent(db),
        "cash_discount_at_percent": CASH_DISCOUNT_PERCENT_THRESHOLD,
        "payment_modes": list(PAYMENT_MODES),
        "can_order": block is None,
        "block": block,
        "dues": dues,
    }


# ---------------------------------------------------------------------------
# Manual payment proofs (shop declares a transfer, admin verifies)
# ---------------------------------------------------------------------------
async def submit_proof(
    db,
    retailer: dict,
    *,
    mode: str,
    reference: str,
    paid_on: str,
    amount: float,
    order_id: Optional[str] = None,
    note: Optional[str] = None,
    channel: str = "web",
) -> dict:
    mode = (mode or "").strip().lower()
    if mode not in PAYMENT_MODES:
        raise ValueError(f"Payment mode must be one of: {', '.join(PAYMENT_MODES)}")
    if amount is None or float(amount) <= 0:
        raise ValueError("Enter the amount you paid")
    reference = (reference or "").strip()
    if len(reference) < 4:
        raise ValueError("Enter the transaction / UTR / cheque reference")
    if not _parse_date_only(paid_on):
        raise ValueError("Enter the payment date as YYYY-MM-DD")

    order_ref = (order_id or "").strip() or None
    if order_ref:
        owned = await db.b2b_orders.find_one(
            {"order_id": order_ref, "retailer_id": retailer["retailer_id"]}, {"_id": 1}
        )
        if not owned:
            raise ValueError("That order number does not belong to your account")

    proof = {
        "proof_id": f"PAY-{uuid.uuid4().hex[:10].upper()}",
        "retailer_id": retailer["retailer_id"],
        "retailer_business_name": retailer.get("business_name") or retailer.get("trade_name"),
        "retailer_gst": retailer.get("gst_number"),
        "order_id": order_ref,
        "mode": mode,
        "reference": reference,
        "paid_on": paid_on,
        "amount": round(float(amount), 2),
        "note": (note or "").strip() or None,
        "channel": channel,
        "status": "pending",
        "created_at": _now_iso(),
        "reviewed_at": None,
        "reviewed_by": None,
        "admin_note": None,
    }
    await db.b2b_payment_proofs.insert_one(proof)
    proof.pop("_id", None)
    logger.info(
        "Payment proof %s submitted by %s: %s ₹%s", proof["proof_id"], retailer["retailer_id"], mode, amount
    )
    try:
        await _notify_admin_of_proof(db, proof, retailer)
    except Exception as e:
        logger.warning("Admin notification for proof %s failed: %s", proof["proof_id"], e)
    return proof


def _parse_date_only(value: str) -> bool:
    try:
        datetime.strptime((value or "").strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


async def _notify_admin_of_proof(db, proof: dict, retailer: dict):
    from dependencies import NOTIFICATION_EMAIL
    from services.email_service import send_email

    rows = "".join(
        f"<tr><td style='padding:6px 12px;color:#666'>{label}</td>"
        f"<td style='padding:6px 12px;font-weight:600'>{value}</td></tr>"
        for label, value in (
            ("Shop", proof.get("retailer_business_name") or proof["retailer_id"]),
            ("GSTIN", proof.get("retailer_gst") or "—"),
            ("Mode", proof["mode"].replace("_", " ").title()),
            ("Reference", proof["reference"]),
            ("Paid on", proof["paid_on"]),
            ("Amount", f"₹{proof['amount']:,.2f}"),
            ("Against order", proof.get("order_id") or "General settlement"),
        )
    )
    await send_email(
        to_email=NOTIFICATION_EMAIL,
        subject=f"Payment confirmation to verify — {proof.get('retailer_business_name') or proof['retailer_id']}",
        html_content=(
            f"<h2 style='font-family:sans-serif'>A shop has declared a payment</h2>"
            f"<table style='font-family:sans-serif;border-collapse:collapse'>{rows}</table>"
            f"<p style='font-family:sans-serif'>Verify it in Admin → App Desk → Payments to reopen their ordering.</p>"
        ),
    )


async def review_proof(
    db, proof_id: str, *, approve: bool, admin_email: str, admin_note: str = ""
) -> dict:
    proof = await db.b2b_payment_proofs.find_one({"proof_id": proof_id}, {"_id": 0})
    if not proof:
        raise ValueError("Payment confirmation not found")
    if proof["status"] != "pending":
        raise ValueError("This payment confirmation has already been reviewed")

    status = "verified" if approve else "rejected"
    await db.b2b_payment_proofs.update_one(
        {"proof_id": proof_id},
        {
            "$set": {
                "status": status,
                "reviewed_at": _now_iso(),
                "reviewed_by": admin_email,
                "admin_note": (admin_note or "").strip() or None,
            }
        },
    )

    credited_order = None
    settled = []
    if approve:
        if proof.get("order_id"):
            credited_order = await _credit_order(db, proof["order_id"], proof["amount"])
        else:
            # General settlement — apply it to the oldest unpaid orders first,
            # so a verified transfer actually reduces the dues the killswitch
            # watches instead of only clearing a manual lock.
            settled = await _settle_oldest_first(db, proof["retailer_id"], proof["amount"])
        # A verified settlement clears any manual lock on that shop.
        await db.retailers.update_one(
            {"retailer_id": proof["retailer_id"]},
            {
                "$set": {
                    "ordering_blocked": False,
                    "ordering_block_note": None,
                    "ordering_blocked_at": None,
                    "ordering_unblocked_by": admin_email,
                    "ordering_unblocked_at": _now_iso(),
                }
            },
        )

    proof.update({"status": status, "reviewed_by": admin_email})
    retailer = await db.retailers.find_one(
        {"retailer_id": proof["retailer_id"]}, {"_id": 0, "retailer_id": 1, "ordering_blocked": 1}
    ) or {}
    still_blocked = await ordering_block(db, retailer) if approve else None
    return {
        "proof": proof,
        "credited_order": credited_order,
        "settled_orders": settled,
        "can_order_now": still_blocked is None if approve else None,
        "still_blocked": still_blocked,
    }


async def _settle_oldest_first(db, retailer_id: str, amount: float) -> list[dict]:
    """Apply a verified payment to this shop's oldest unpaid orders (FIFO)."""
    remaining = round(float(amount), 2)
    settled: list[dict] = []
    cursor = (
        db.b2b_orders.find(
            {"retailer_id": retailer_id, "payment_status": {"$nin": list(SETTLED_PAYMENT_STATUSES)}},
            {"_id": 0, "order_id": 1, "grand_total": 1, "amount_paid": 1, "payment_status": 1,
             "order_status": 1, "created_at": 1},
        )
        .sort("created_at", 1)
    )
    async for order in cursor:
        if remaining <= 0.01:
            break
        due = order_outstanding(order)
        if due <= 0:
            continue
        applied = min(due, remaining)
        result = await _credit_order(db, order["order_id"], applied)
        remaining = round(remaining - applied, 2)
        if result:
            settled.append({**result, "applied": applied})
    return settled


async def _credit_order(db, order_id: str, amount: float) -> Optional[dict]:
    order = await db.b2b_orders.find_one({"order_id": order_id})
    if not order:
        return None
    already = float(order.get("amount_paid") or 0)
    total = float(order.get("grand_total") or 0)
    new_paid = round(min(total, already + float(amount)), 2)
    fully_paid = new_paid >= total - 0.01
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "amount_paid": new_paid,
                "payment_status": "paid" if fully_paid else "partially_paid",
                "updated_at": _now_iso(),
            }
        },
    )
    return {"order_id": order_id, "amount_paid": new_paid, "fully_paid": fully_paid}


async def list_proofs(db, *, status: Optional[str] = None, retailer_id: Optional[str] = None, limit: int = 100):
    query: dict = {}
    if status:
        query["status"] = status
    if retailer_id:
        query["retailer_id"] = retailer_id
    cursor = db.b2b_payment_proofs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [doc async for doc in cursor]
