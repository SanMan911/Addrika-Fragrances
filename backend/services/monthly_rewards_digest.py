"""Monthly Rewards Statement digest — auto-mailed to every retailer with
an optional CC to the retailer's or platform accountant.

Runs on the 1st of every month (scheduler task) and can also be manually
triggered via the admin panel.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 24 * 60 * 60  # daily poll; only fires on the 1st


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _accountant_email(db) -> str | None:
    """Platform-wide accountant CC configured via the admin integrations panel.
    Used as a fallback when a retailer has not set a per-account accountant."""
    try:
        from routers.admin.admin_integrations import get_effective
        e = (await get_effective("accountant_email") or "").strip()
        return e or None
    except Exception:
        return None


def _accountant_email_for_retailer(retailer: dict, platform_default: str | None) -> str | None:
    """Prefer the retailer's own accountant email; fall back to platform default."""
    personal = str(retailer.get("accountant_email") or "").strip()
    if personal and "@" in personal:
        return personal
    return platform_default


async def send_statement_to_retailer(db, retailer: dict) -> dict:
    """Build the reward statement PDF for one retailer and email it —
    with the platform accountant CC'd if configured."""
    from services.email_service import send_email, is_email_service_available
    from services.b2b_rewards_pdf import build_rewards_statement_pdf

    if not is_email_service_available():
        return {"sent": False, "reason": "email_service_unavailable"}
    if not retailer.get("email"):
        return {"sent": False, "reason": "no_email"}

    ledger = await db.rewards_ledger.find(
        {"retailer_id": retailer["retailer_id"]}, {"_id": 0}
    ).sort("earned_at", -1).limit(2000).to_list(2000)

    pdf = build_rewards_statement_pdf(retailer, ledger)
    biz = retailer.get("business_name") or retailer.get("trade_name") or "Retailer"
    month_label = _now().strftime("%B %Y")

    html = f"""
    <html><body style='font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;'>
      <table cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'>
        <tr><td style='background:#1e3a52;padding:22px;text-align:center;'>
          <h1 style='color:#d4af37;margin:0;'>ADDRIKA</h1>
          <p style='color:#fff;margin:6px 0 0;font-size:13px;'>Monthly Fragrance Rewards Statement · {month_label}</p>
        </td></tr>
        <tr><td style='padding:24px;color:#2B3A4A;'>
          <p>Dear {biz},</p>
          <p>Please find attached your monthly Fragrance Rewards statement — every earn,
          redeem, adjustment and expiry with a running balance.</p>
          <p>Handy for your accountant's bookkeeping. Reach us at
          <a href='mailto:contact.us@centraders.com'>contact.us@centraders.com</a> for any queries.</p>
        </td></tr>
      </table>
    </body></html>
    """

    cc = _accountant_email_for_retailer(retailer, await _accountant_email(db))
    ok = await send_email(
        to_email=retailer["email"],
        subject=f"Addrika · Fragrance Rewards Statement · {month_label}",
        html_content=html,
        cc=cc,
        attachments=[{"filename": f"addrika-rewards-{retailer['retailer_id']}.pdf", "content": pdf}],
    )
    await db.rewards_monthly_digest_log.insert_one({
        "retailer_id": retailer["retailer_id"],
        "sent_at": _now().isoformat(),
        "month": month_label,
        "ok": bool(ok),
        "cc": cc,
        "ledger_size": len(ledger),
    })
    return {"sent": bool(ok), "cc": cc, "ledger_size": len(ledger)}


async def run_monthly_digest(db, *, force: bool = False) -> dict:
    """Send this month's statement to every active retailer. Idempotent per
    calendar month via `rewards_monthly_digest_log`."""
    now = _now()
    month_label = now.strftime("%Y-%m")
    # Global de-dupe on calendar month unless forced
    if not force:
        already = await db.settings.find_one({"_id": "rewards_monthly_digest_state"})
        if already and already.get("last_month") == month_label:
            return {"sent": 0, "skipped_reason": "already_sent_this_month",
                    "last_month": already.get("last_month")}

    cursor = db.retailers.find(
        {}, {"_id": 0, "retailer_id": 1, "email": 1, "business_name": 1,
             "trade_name": 1, "gst_number": 1, "phone": 1,
             "address_line1": 1, "city": 1, "state": 1, "pincode": 1,
             "accountant_email": 1}
    )
    total = 0
    failed = 0
    async for r in cursor:
        try:
            res = await send_statement_to_retailer(db, r)
            if res.get("sent"):
                total += 1
            else:
                failed += 1
        except Exception as e:
            logger.warning("monthly digest failed for %s: %s", r.get("retailer_id"), e)
            failed += 1

    await db.settings.update_one(
        {"_id": "rewards_monthly_digest_state"},
        {"$set": {"last_month": month_label, "last_sent_at": now.isoformat(),
                  "total": total, "failed": failed}},
        upsert=True,
    )
    logger.info("Monthly rewards digest: %d sent · %d failed for %s",
                total, failed, month_label)
    return {"sent": total, "failed": failed, "month": month_label}


async def monthly_rewards_scheduler_loop(db):
    """Fire once on boot (idempotency-guarded so no re-sends within same month),
    then daily-poll — only actually sends on the 1st of the month."""
    await asyncio.sleep(120)
    while True:
        try:
            if _now().day == 1:
                await run_monthly_digest(db)
        except Exception as e:
            logger.warning("monthly rewards digest scheduler failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
