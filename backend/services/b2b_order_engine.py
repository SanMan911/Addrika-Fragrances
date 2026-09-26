"""Channel-agnostic B2B order engine.

ONE code path places every wholesale order — web portal, AAROHMM mobile
handoff, and the Field-Sales-Manager external API — so pricing, KYC gating,
stock reservation, Supabase mirroring, Zoho sync and admin e-mails behave
identically no matter where the order originated.

    calculate(db, retailer, order_data)          → price breakdown (no side-effects)
    place_order(db, retailer, order_data, ...)   → persists order + side-effects
    mark_order_paid(db, order, retailer, ...)    → shared "payment landed" transition
    cancel_order(db, order, ...)                 → releases reserved stock

Stock policy
------------
▸ `online` (Razorpay checkout on web): pieces are deducted when the payment
  is verified (existing behaviour — abandoned checkouts never hold stock).
▸ `credit` / `pay_later` / `razorpay_link` (web credit orders + every FSM
  order): pieces are RESERVED the moment the order is placed, so the live
  stock every channel reads (Mongo → Supabase mirror → stock webhooks) drops
  immediately. Cancelling the order releases the reservation.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from services.b2b_pricing import calculate_b2b_order as calc_b2b_pricing
from services.b2b_pricing_extras import (
    add_rewards_projection,
    apply_preorder_terms,
    apply_rewards_redemption,
    apply_shipping,
)

logger = logging.getLogger(__name__)

RESERVE_AT_PLACEMENT_METHODS = {"credit", "pay_later", "razorpay_link"}
CANCELLABLE_STATUSES = {"ordered", "confirmed", "processing", "modified"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def calculate(db, retailer: dict, order_data) -> dict:
    """Full price breakdown for a cart. `order_data` is a B2BOrderCreate-like object."""
    shipping_quote = None
    if order_data.include_shipping and order_data.delivery_pincode:
        from services.b2b_shipping import get_b2b_shipping_quote
        shipping_quote = await get_b2b_shipping_quote(order_data.delivery_pincode, order_data.items)

    calc = await calc_b2b_pricing(
        db,
        retailer=retailer,
        items=order_data.items,
        apply_cash_discount=order_data.apply_cash_discount,
        voucher_code=order_data.voucher_code,
        credit_note_code=order_data.credit_note_code,
        is_preorder=order_data.is_preorder,
    )
    apply_preorder_terms(calc, is_preorder=order_data.is_preorder, accept_terms=order_data.accept_preorder_terms)
    apply_shipping(calc, shipping_quote)
    await apply_rewards_redemption(db, calc, retailer, float(order_data.redeem_rewards_inr or 0))
    await add_rewards_projection(db, calc, retailer)
    return calc


def _razorpay_client():
    import razorpay
    return razorpay.Client(auth=(os.environ.get("RAZORPAY_KEY_ID"), os.environ.get("RAZORPAY_KEY_SECRET")))


def _create_razorpay_order(order: dict, retailer: dict, charge_amount: float) -> Optional[dict]:
    try:
        return _razorpay_client().order.create({
            "amount": int(round(charge_amount * 100)),
            "currency": "INR",
            "receipt": order["order_id"],
            "notes": {
                "order_id": order["order_id"],
                "retailer_id": retailer["retailer_id"],
                "order_type": "B2B-PREORDER" if order.get("is_preorder") else "B2B",
                "charge_type": "token" if order.get("is_preorder") else "full",
            },
        })
    except Exception as e:
        logger.error("Razorpay order creation failed for %s: %s", order["order_id"], e)
        return None


def _create_razorpay_payment_link(order: dict, retailer: dict, charge_amount: float) -> Optional[dict]:
    """Hosted Razorpay Payment Link — Razorpay SMSes/e-mails it to the retailer."""
    from config.brand import BRAND
    public_url = os.environ.get("PUBLIC_APP_URL", "https://centraders.com").rstrip("/")
    phone = str(retailer.get("phone") or "").strip()
    if phone and not phone.startswith("+"):
        phone = "+91" + phone[-10:]
    try:
        return _razorpay_client().payment_link.create({
            "amount": int(round(charge_amount * 100)),
            "currency": "INR",
            "accept_partial": False,
            "reference_id": order["order_id"],
            "description": f"{BRAND.name} wholesale order {order['order_id']}",
            "customer": {
                "name": (retailer.get("business_name") or retailer.get("trade_name") or retailer.get("name") or "Retailer")[:100],
                "email": retailer.get("email"),
                "contact": phone or None,
            },
            "notify": {"sms": bool(phone), "email": bool(retailer.get("email"))},
            "reminder_enable": True,
            "notes": {"order_id": order["order_id"], "retailer_id": retailer["retailer_id"], "channel": order.get("channel")},
            "callback_url": f"{public_url}/retailer/b2b/orders/{order['order_id']}",
            "callback_method": "get",
        })
    except Exception as e:
        logger.error("Razorpay payment-link creation failed for %s: %s", order["order_id"], e)
        return None


async def place_order(
    db,
    retailer: dict,
    order_data,
    *,
    channel: str = "web",
    payment_mode: Optional[str] = None,
    placed_by: Optional[dict] = None,
    client_ref: Optional[str] = None,
) -> tuple[dict, dict]:
    """Create a B2B order and run every placement side-effect.

    payment_mode:
        None / "online"   → web behaviour (Razorpay order when cash-discount/voucher; else credit)
        "pay_later"       → credit; admin confirms payment offline; stock reserved now
        "razorpay_link"   → hosted payment link sent to retailer; stock reserved now

    Returns (order_doc, api_response).
    """
    if client_ref:
        dup = await db.b2b_orders.find_one({"client_ref": client_ref, "retailer_id": retailer["retailer_id"]}, {"_id": 0})
        if dup:
            return dup, _response_for(dup, duplicate=True)

    calculation = await calculate(db, retailer, order_data)
    now = datetime.now(timezone.utc)
    order_id = f"B2B-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    if payment_mode in ("pay_later", "razorpay_link"):
        payment_method = payment_mode
    else:
        payment_method = "online" if (order_data.apply_cash_discount or order_data.voucher_code) else "credit"

    order = {
        "order_id": order_id,
        "client_ref": client_ref,
        "channel": channel,
        "placed_by": placed_by,
        "retailer_id": retailer["retailer_id"],
        "retailer_email": retailer.get("email"),
        "retailer_phone": retailer.get("phone"),
        "retailer_gst": retailer.get("gst_number"),
        "billing_address": calculation["retailer_address"],
        "items": calculation["items"],
        "subtotal": calculation["subtotal"],
        "subtotal_after_loyalty": calculation.get("subtotal_after_loyalty", calculation["subtotal"]),
        "tier_discount_total": calculation.get("tier_discount_total", 0),
        "taxable_value": calculation.get("taxable_value", calculation["subtotal"]),
        "gst_total": calculation["gst_total"],
        "voucher_code": calculation.get("voucher_code"),
        "voucher_discount": calculation.get("voucher_discount", 0),
        "loyalty_discount": calculation.get("loyalty_discount", 0),
        "loyalty_discount_percent": calculation.get("loyalty_discount_percent", 0),
        "loyalty_milestone": calculation.get("loyalty_milestone"),
        "quarter_label": calculation.get("quarter_label"),
        "cash_discount": calculation.get("cash_discount", 0),
        "cash_discount_percent": calculation.get("cash_discount_percent", 0),
        "credit_note_code": calculation.get("credit_note_code"),
        "credit_note_discount": calculation.get("credit_note_discount", 0),
        "total_discount": calculation.get("total_discount", 0),
        "shipping_charges": float(calculation.get("shipping_charges") or 0),
        "shipping_quote": calculation.get("shipping_quote"),
        "delivery_pincode": order_data.delivery_pincode,
        "rewards_redeemed_inr": float(calculation.get("rewards_redeemed_inr") or 0),
        "rewards_redemption_preview": calculation.get("rewards_redemption"),
        "grand_total": calculation["grand_total"],
        "is_preorder": bool(calculation.get("is_preorder")),
        "token_amount_inr": float(calculation.get("token_amount_inr") or 0),
        "balance_due_inr": float(calculation.get("balance_due_inr") or 0),
        "terms_version": calculation.get("terms_version"),
        "terms_text": calculation.get("terms_text"),
        "terms_accepted_at": now.isoformat() if calculation.get("is_preorder") else None,
        "payment_method": payment_method,
        "payment_status": "pending",
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "payment_link_id": None,
        "payment_link_url": None,
        "stock_reserved": False,
        "order_status": "ordered",
        "status_history": [{
            "status": "ordered",
            "timestamp": now.isoformat(),
            "note": _placement_note(channel, placed_by),
        }],
        "notes": order_data.notes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    charge_amount = float(order["token_amount_inr"]) if order["is_preorder"] else float(calculation["grand_total"])
    razorpay_order = None
    if charge_amount > 0:
        if payment_method == "razorpay_link":
            link = _create_razorpay_payment_link(order, retailer, charge_amount)
            if link:
                order["payment_link_id"] = link.get("id")
                order["payment_link_url"] = link.get("short_url")
                order["razorpay_charge_amount"] = charge_amount
        elif payment_method == "online" or order["is_preorder"]:
            razorpay_order = _create_razorpay_order(order, retailer, charge_amount)
            if razorpay_order:
                order["razorpay_order_id"] = razorpay_order["id"]
                order["razorpay_charge_amount"] = charge_amount

    await db.b2b_orders.insert_one(order)
    order.pop("_id", None)

    # Reserve stock immediately for non-checkout channels
    if payment_method in RESERVE_AT_PLACEMENT_METHODS and not order["is_preorder"]:
        try:
            from services.b2b_inventory import reserve_for_order
            await reserve_for_order(db, order)
            await db.b2b_orders.update_one({"order_id": order_id}, {"$set": {"stock_reserved": True}})
            order["stock_reserved"] = True
        except Exception as e:
            logger.warning("Stock reservation failed for %s: %s", order_id, e)

    await _run_placement_side_effects(db, order, retailer, order_data, calculation)
    logger.info("B2B order %s placed via %s by %s: ₹%s", order_id, channel, retailer["retailer_id"], calculation["grand_total"])
    return order, _response_for(order, razorpay_order=razorpay_order)


def _placement_note(channel: str, placed_by: Optional[dict]) -> str:
    if channel == "fsm":
        who = (placed_by or {}).get("name") or (placed_by or {}).get("id") or "field sales rep"
        return f"Order placed by {who} (Field Sales app)"
    if channel == "mobile":
        return "Order placed by retailer (AAROHMM app)"
    return "Order placed by retailer"


def _response_for(order: dict, *, razorpay_order: Optional[dict] = None, duplicate: bool = False) -> dict:
    resp = {
        "message": "Order already placed (duplicate client_ref)" if duplicate else "B2B order placed successfully",
        "order_id": order["order_id"],
        "grand_total": order["grand_total"],
        "status": order.get("order_status", "ordered"),
        "payment_status": order.get("payment_status", "pending"),
        "payment_method": order.get("payment_method"),
        "stock_reserved": bool(order.get("stock_reserved")),
    }
    if razorpay_order or order.get("razorpay_order_id"):
        resp["razorpay_order_id"] = (razorpay_order or {}).get("id") or order.get("razorpay_order_id")
        resp["razorpay_key"] = os.environ.get("RAZORPAY_KEY_ID")
        resp["next_steps"] = "Complete payment to confirm your order."
    elif order.get("payment_link_url"):
        resp["payment_link_url"] = order["payment_link_url"]
        resp["payment_link_id"] = order.get("payment_link_id")
        resp["next_steps"] = "Payment link sent to the retailer. Order confirms automatically once paid."
    elif order.get("payment_method") == "razorpay_link":
        resp["next_steps"] = "Payment link could not be generated — admin will follow up for payment."
    else:
        resp["next_steps"] = "Our team will contact you to confirm the order and arrange delivery/payment."
    return resp


async def _run_placement_side_effects(db, order: dict, retailer: dict, order_data, calculation: dict) -> None:
    order_id = order["order_id"]
    try:
        from services.supabase_sync import mirror_collection_upsert
        mirror_collection_upsert("b2b_orders", order)
    except Exception as e:
        logger.warning("Supabase mirror upsert failed for %s: %s", order_id, e)

    try:
        from services.b2b_emails import send_b2b_admin_notification_email
        await send_b2b_admin_notification_email(order, retailer)
    except Exception as e:
        logger.error("B2B admin notification e-mail failed: %s", e)

    try:
        from services.zoho_books import push_sales_order, is_configured as _zoho_cfg
        zoho_so = await push_sales_order(order, retailer)
        if zoho_so:
            await db.b2b_orders.update_one(
                {"order_id": order_id},
                {"$set": {"zoho_salesorder_id": zoho_so.get("salesorder_id"), "zoho_synced_at": _now_iso()}},
            )
            try:
                from services.supabase_sync import mirror_order_snapshot
                await mirror_order_snapshot(db, order_id=order_id, collection="b2b_orders")
            except Exception:
                pass
        elif await _zoho_cfg():
            from services.zoho_errors import record_error
            await record_error("sales_order", order_id, retailer["retailer_id"],
                               "push_sales_order returned None (Zoho API likely rejected the payload — see server logs).")
    except Exception as e:
        logger.error("Zoho sales-order sync failed for %s: %s", order_id, e)
        try:
            from services.zoho_errors import record_error
            await record_error("sales_order", order_id, retailer["retailer_id"], str(e))
        except Exception:
            pass

    if order_data.voucher_code:
        await db.retailer_vouchers.update_one({"code": order_data.voucher_code.upper()}, {"$inc": {"used_count": 1}})

    if order_data.credit_note_code and calculation.get("credit_note_discount", 0) > 0:
        cn_used = calculation["credit_note_discount"]
        code = order_data.credit_note_code.upper()
        await db.credit_notes.update_one({"code": code}, {"$inc": {"balance": -cn_used}})
        await db.credit_notes.update_one({"code": code, "balance": {"$lte": 0}}, {"$set": {"status": "used"}})


async def mark_order_paid(
    db,
    order: dict,
    retailer: dict,
    *,
    payment_ref: str,
    method: str,
    note: Optional[str] = None,
    actor: str = "system",
) -> dict:
    """Shared 'payment landed' transition used by Razorpay verify, payment-link
    webhooks/polling and admin offline confirmation. Idempotent."""
    order_id = order["order_id"]
    if order.get("payment_status") == "paid":
        return order
    now = _now_iso()
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "payment_status": "paid",
                "paid_at": now,
                "payment_ref": payment_ref,
                "payment_confirmed_by": actor,
                "offline_payment_method": method if method not in ("razorpay", "razorpay_link") else None,
                "razorpay_payment_id": payment_ref if method in ("razorpay", "razorpay_link") else order.get("razorpay_payment_id"),
                "order_status": "confirmed" if order.get("order_status") == "ordered" else order.get("order_status"),
                "updated_at": now,
            },
            "$push": {"status_history": {
                "status": "confirmed",
                "timestamp": now,
                "note": note or f"Payment confirmed via {method}: {payment_ref}",
                "updated_by": actor,
            }},
        },
    )
    fresh = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0}) or order

    try:
        from services.b2b_emails import send_b2b_order_confirmation_email
        await send_b2b_order_confirmation_email(fresh, retailer)
    except Exception as e:
        logger.error("B2B confirmation e-mail failed for %s: %s", order_id, e)

    from services.b2b_payment_hooks import run_post_payment_hooks
    await run_post_payment_hooks(db, fresh, retailer, payment_ref)

    try:
        from services.supabase_sync import mirror_order_snapshot
        await mirror_order_snapshot(db, order_id=order_id, collection="b2b_orders")
    except Exception:
        pass
    return fresh


async def cancel_order(db, order: dict, *, reason: str, actor: str) -> dict:
    """Cancel an unpaid/unshipped order and release any reserved stock."""
    order_id = order["order_id"]
    if order.get("order_status") == "cancelled":
        return order
    if order.get("order_status") not in CANCELLABLE_STATUSES:
        raise ValueError(f"Order in status '{order.get('order_status')}' cannot be cancelled")
    now = _now_iso()
    await db.b2b_orders.update_one(
        {"order_id": order_id},
        {
            "$set": {"order_status": "cancelled", "cancelled_at": now, "cancel_reason": reason, "updated_at": now},
            "$push": {"status_history": {"status": "cancelled", "timestamp": now, "note": reason, "updated_by": actor}},
        },
    )
    try:
        from services.b2b_inventory import release_for_cancelled_order
        await release_for_cancelled_order(db, order)
    except Exception as e:
        logger.warning("Stock release failed for cancelled %s: %s", order_id, e)
    fresh = await db.b2b_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    try:
        from services.supabase_sync import mirror_order_snapshot
        await mirror_order_snapshot(db, order_id=order_id, collection="b2b_orders")
    except Exception:
        pass
    return fresh


async def refresh_payment_link_status(db, order: dict) -> dict:
    """Poll Razorpay for a payment-link order still pending. Marks paid when
    Razorpay says so — covers deployments without the webhook configured."""
    if order.get("payment_status") == "paid" or not order.get("payment_link_id"):
        return order
    try:
        link = _razorpay_client().payment_link.fetch(order["payment_link_id"])
    except Exception as e:
        logger.debug("payment_link.fetch failed for %s: %s", order["order_id"], e)
        return order
    if link.get("status") == "paid":
        payments = link.get("payments") or []
        pay_id = (payments[0].get("payment_id") if payments else None) or link.get("id")
        retailer = await db.retailers.find_one({"retailer_id": order["retailer_id"]}, {"_id": 0, "password_hash": 0}) or {}
        return await mark_order_paid(db, order, retailer, payment_ref=pay_id, method="razorpay_link", actor="razorpay")
    if link.get("status") in ("cancelled", "expired") and order.get("payment_link_status") != link.get("status"):
        await db.b2b_orders.update_one({"order_id": order["order_id"]}, {"$set": {"payment_link_status": link.get("status")}})
    return order
