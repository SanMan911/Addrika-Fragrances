"""Grievance threads shared by the mobile app and the admin dashboard.

One conversation per ticket, appended to by BOTH sides. Retailers post through
Supabase under RLS (which forbids forging an 'admin' author or posting to a
closed ticket); the admin posts through here, server-side.

Every admin reply also alerts the shop: an in-app unread flag plus an email to
the retailer's registered address.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from services.supabase_app_sync import _connect

logger = logging.getLogger(__name__)

STATUSES = ("open", "in_progress", "closed")


async def list_grievances(status: Optional[str] = None, limit: int = 200) -> list[dict]:
    """Admin view: every ticket, newest activity first."""
    conn = await _connect()
    if conn is None:
        return []
    try:
        sql = """
            select g.id, g.retailer_id, r.business_name, r.gstin, r.email, r.phone,
                   g.order_number, g.category, g.subject, g.message, g.status,
                   g.created_at, g.last_message_at, g.unread_for_admin,
                   g.unread_for_retailer, g.closed_at, g.closed_by,
                   (select count(*) from public.app_grievance_messages m
                     where m.grievance_id = g.id) as reply_count,
                   (select count(*) from public.app_grievance_images i
                     where i.grievance_id = g.id) as image_count
            from public.app_grievances g
            left join public.app_retailers r on r.id = g.retailer_id
        """
        params: list = []
        if status in STATUSES:
            sql += " where g.status = $1"
            params.append(status)
        sql += " order by coalesce(g.last_message_at, g.created_at) desc limit "
        sql += str(int(limit))
        rows = await conn.fetch(sql, *params)
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_thread(grievance_id: str, retailer_id: Optional[str] = None) -> Optional[dict]:
    """Full readable thread. Pass `retailer_id` to scope it to one shop."""
    conn = await _connect()
    if conn is None:
        return None
    try:
        where = "g.id = $1" + (" and g.retailer_id = $2" if retailer_id else "")
        params = [grievance_id] + ([retailer_id] if retailer_id else [])
        row = await conn.fetchrow(
            f"""
            select g.*, r.business_name, r.gstin, r.email, r.phone, r.city, r.state
            from public.app_grievances g
            left join public.app_retailers r on r.id = g.retailer_id
            where {where}
            """,
            *params,
        )
        if not row:
            return None

        messages = await conn.fetch(
            """
            select id, author, author_name, body, created_at
            from public.app_grievance_messages
            where grievance_id = $1
            order by created_at
            """,
            grievance_id,
        )
        images = await conn.fetch(
            "select storage_path, created_at from public.app_grievance_images "
            "where grievance_id = $1 order by created_at",
            grievance_id,
        )

        ticket = dict(row)
        # The opening complaint is the first turn of the conversation, so the
        # UI can render one uniform list instead of special-casing it.
        thread = [
            {
                "id": f"{grievance_id}-origin",
                "author": "retailer",
                "author_name": ticket.get("business_name"),
                "body": ticket["message"],
                "created_at": ticket["created_at"],
                "is_origin": True,
            }
        ] + [dict(m) | {"is_origin": False} for m in messages]

        ticket["thread"] = thread
        ticket["images"] = [dict(i) for i in images]
        return ticket
    finally:
        await conn.close()


async def add_message(
    grievance_id: str,
    author: str,
    body: str,
    author_name: Optional[str] = None,
    retailer_id: Optional[str] = None,
) -> Optional[dict]:
    """Append a turn. `retailer_id` scopes retailer posts to their own ticket."""
    if author not in ("retailer", "admin"):
        raise ValueError("author must be 'retailer' or 'admin'")

    conn = await _connect()
    if conn is None:
        return None
    try:
        where = "id = $1" + (" and retailer_id = $2" if retailer_id else "")
        params = [grievance_id] + ([retailer_id] if retailer_id else [])
        ticket = await conn.fetchrow(
            f"select id, status, retailer_id from public.app_grievances where {where}",
            *params,
        )
        if not ticket:
            return None
        if ticket["status"] == "closed":
            return {"error": "closed"}

        msg = await conn.fetchrow(
            """
            insert into public.app_grievance_messages
              (grievance_id, author, author_name, body)
            values ($1,$2,$3,$4)
            returning id, author, author_name, body, created_at
            """,
            grievance_id,
            author,
            author_name,
            body.strip(),
        )

        # Flag the OTHER side as having something unread.
        await conn.execute(
            """
            update public.app_grievances
               set last_message_at = now(),
                   unread_for_retailer = $2,
                   unread_for_admin = $3,
                   status = case when status = 'open' and $4 = 'admin'
                                 then 'in_progress' else status end
             where id = $1
            """,
            grievance_id,
            author == "admin",
            author == "retailer",
            author,
        )
        return dict(msg) | {"retailer_id": ticket["retailer_id"]}
    finally:
        await conn.close()


async def set_status(grievance_id: str, status: str, actor: str) -> bool:
    if status not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}")
    conn = await _connect()
    if conn is None:
        return False
    try:
        result = await conn.execute(
            """
            update public.app_grievances
               set status = $2,
                   closed_at = case when $2 = 'closed' then now() else null end,
                   closed_by = case when $2 = 'closed' then $3 else null end,
                   unread_for_retailer = case when $2 = 'closed' then true
                                              else unread_for_retailer end
             where id = $1
            """,
            grievance_id,
            status,
            actor,
        )
        return result.split()[-1] != "0"
    finally:
        await conn.close()


async def mark_read(grievance_id: str, side: str, retailer_id: Optional[str] = None) -> bool:
    column = "unread_for_retailer" if side == "retailer" else "unread_for_admin"
    conn = await _connect()
    if conn is None:
        return False
    try:
        where = "id = $1" + (" and retailer_id = $2" if retailer_id else "")
        params = [grievance_id] + ([retailer_id] if retailer_id else [])
        result = await conn.execute(
            f"update public.app_grievances set {column} = false where {where}",
            *params,
        )
        return result.split()[-1] != "0"
    finally:
        await conn.close()


async def unread_count_for_retailer(retailer_id: str) -> int:
    conn = await _connect()
    if conn is None:
        return 0
    try:
        return int(
            await conn.fetchval(
                "select count(*) from public.app_grievances "
                "where retailer_id = $1 and unread_for_retailer",
                retailer_id,
            )
            or 0
        )
    finally:
        await conn.close()


# --------------------------------------------------------------------------
# Alerting the shop
# --------------------------------------------------------------------------
async def notify_retailer_of_reply(
    grievance_id: str, subject: str, reply_body: str, closed: bool = False
) -> bool:
    """Email the shop that their complaint has been answered."""
    ticket = await get_thread(grievance_id)
    if not ticket or not ticket.get("email"):
        return False

    try:
        from services.email_service import send_email
    except Exception:
        return False

    heading = "Your grievance has been resolved" if closed else "Aarohmm replied to your grievance"
    closing = (
        "<p style='margin-top:16px'>This ticket is now <strong>closed</strong>. "
        "If you need anything further, please raise a new grievance from the "
        "Aarohmm app.</p>"
        if closed
        else "<p style='margin-top:16px'>Open the Aarohmm app to read the full "
        "conversation and reply.</p>"
    )

    html = (
        "<html><body style=\"font-family:Arial,sans-serif;background:#f5f5f5;padding:20px\">"
        "<table cellpadding='0' cellspacing='0' style='max-width:640px;margin:0 auto;"
        "background:#fff;border-radius:10px;overflow:hidden'>"
        "<tr><td style='background:#1e3a52;padding:22px;text-align:center'>"
        f"<h1 style=\"color:#d4af37;margin:0;font-size:20px\">{heading}</h1>"
        "<p style=\"color:#fff;margin:4px 0 0;font-size:12px\">Aarohmm wholesale support</p>"
        "</td></tr>"
        "<tr><td style='padding:24px;color:#1e3a52'>"
        f"<p style='margin:0 0 6px;font-size:13px;color:#6b6357'>Ticket</p>"
        f"<p style='margin:0 0 18px;font-size:16px;font-weight:700'>{subject}</p>"
        "<div style='background:#f5f0e8;border-left:3px solid #d4af37;padding:14px 16px;"
        "border-radius:6px'>"
        f"<p style='margin:0;white-space:pre-wrap;line-height:1.55'>{reply_body}</p>"
        "</div>"
        f"{closing}"
        "</td></tr></table></body></html>"
    )

    try:
        return await send_email(
            to_email=ticket["email"],
            subject=f"[Aarohmm] {heading} — {subject[:70]}",
            html_content=html,
        )
    except Exception as e:
        logger.error(f"grievance reply notification failed for {grievance_id}: {e}")
        return False
