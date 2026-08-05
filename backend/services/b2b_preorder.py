"""B2B Pre-Order flow — token payment on out-of-stock SKUs.

Business rules (Feb 2026, per user spec):
    ▸ Out-of-stock SKUs must still be orderable via a 50% token payment.
    ▸ The retailer sees "prioritized in Next Production Batch" — never
      a delivery date or ETA in days.
    ▸ Legal block on the receipt:
        · non-refundable
        · non-cancellable
        · no credit notes issued
        · amendable ONLY upward from prepaid value
        · exchange only on manufacturing defects with intact seal
        · damage must be reported at delivery
    ▸ Receipt has a signature line for the retailer to sign upon
      delivery — one copy retained by the sales person/delivery boy.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Percentage of order value the retailer must pre-pay to lock a pre-order slot.
TOKEN_PERCENTAGE = 50

# Version-stamp on every pre-order so future policy changes leave old
# receipts unambiguously governed by the terms that were shown at buy time.
TERMS_VERSION = "PRE-ORDER-V1-2026-02"

TERMS_TEXT = (
    "1. This order is a Pre-Order against the Next Production Batch. "
    "The token/part-payment made hereto shall be strictly "
    "NON-REFUNDABLE under any circumstance.\n"
    "2. This Pre-Order is NON-CANCELLABLE once the token payment is received. "
    "No Credit Notes (CNs) shall be issued for any amount whatsoever.\n"
    "3. The Pre-Order may be AMENDED only prior to dispatch and only in a "
    "manner such that the total order value never falls below the token "
    "amount already prepaid (since no refunds shall be issued).\n"
    "4. Exchange is entertained ONLY for items with visible manufacturing "
    "defect(s), and only if the product seal remains fully intact. Any "
    "tampering shall render the product ineligible for exchange.\n"
    "5. Any damage to the goods MUST be brought to the attention of "
    "the sales representative / delivery personnel AT THE TIME OF DELIVERY "
    "ITSELF — claims raised after signed receipt shall not be entertained.\n"
    "6. Retailer signature on the delivery receipt shall be treated as "
    "conclusive acceptance of the goods and closure of this Pre-Order."
)


def token_amount_for(grand_total_inr: float) -> float:
    """Server-side computation — never trust the client's amount."""
    return round(float(grand_total_inr or 0) * (TOKEN_PERCENTAGE / 100.0), 2)


def is_preorder_eligible(product: dict) -> bool:
    """A SKU is pre-order-eligible if it's currently out-of-stock OR
    in a restocking/manufacturing/delayed state. In-stock SKUs go through
    the normal order flow — pre-order is reserved for stock-blocked SKUs."""
    status = (product.get("stock_status") or "").lower()
    if status in ("out_of_stock", "restocking", "manufacturing", "delayed"):
        return True
    # Also allow pre-order if stock_pieces = 0 regardless of label
    if int(product.get("stock_pieces") or 0) <= 0:
        return True
    return False


def stamp_terms_acceptance(order: dict) -> dict:
    """Append the current terms version + acceptance stamp to a pre-order."""
    order["is_preorder"] = True
    order["terms_version"] = TERMS_VERSION
    order["terms_accepted_at"] = datetime.now(timezone.utc).isoformat()
    order["terms_text"] = TERMS_TEXT
    return order
