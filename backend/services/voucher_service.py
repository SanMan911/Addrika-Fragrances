"""RTO Voucher Service for Addrika"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Import RTO calculation from shipping config
from services.shipping_config import calculate_rto_voucher_value


def generate_voucher_code() -> str:
    """Generate unique RTO voucher code"""
    return f"RTO-{str(uuid.uuid4())[:8].upper()}"


async def generate_rto_voucher(db, order: dict) -> Optional[dict]:
    """
    Generate an RTO voucher for a returned order.
    
    Policy (Updated):
    - Voucher value = Order amount - Payment Gateway Fee (2.36%) - Shipping Charges
    - Valid for 15 days from issue date
    - Can only be claimed from the same account
    - Unused vouchers may be donated to NGO partners after expiry
    """
    try:
        order_number = order.get("order_number")
        user_email = order.get("shipping", {}).get("email", "").lower()
        user_id = order.get("user_id")
        
        # Get original order amount (total paid by customer)
        pricing = order.get("pricing", {})
        original_amount = pricing.get("final_total", 0)
        shipping_charges = pricing.get("shipping", 0)
        
        if original_amount <= 0:
            logger.warning(f"Cannot generate RTO voucher for order {order_number}: Invalid amount")
            return None
        
        # Calculate voucher value using new formula
        rto_calc = calculate_rto_voucher_value(original_amount, shipping_charges)
        voucher_value = rto_calc["voucher_value"]
        
        if voucher_value <= 0:
            logger.warning(f"RTO voucher value is zero or negative for order {order_number}")
            voucher_value = 0  # Minimum voucher value
        
        # Create voucher
        voucher_code = generate_voucher_code()
        expires_at = datetime.now(timezone.utc) + timedelta(days=15)
        
        voucher = {
            "id": str(uuid.uuid4()),
            "voucher_code": voucher_code,
            "order_number": order_number,
            "user_email": user_email,
            "user_id": user_id,
            "original_amount": original_amount,
            # New detailed breakdown
            "payment_gateway_fee": rto_calc["payment_gateway_fee"],
            "payment_gateway_percentage": rto_calc["payment_gateway_percentage"],
            "shipping_charges_deducted": rto_calc["shipping_charges_deducted"],
            "total_deductions": rto_calc["total_deductions"],
            "voucher_value": voucher_value,
            # Legacy field for backward compatibility
            "rto_charges": rto_calc["total_deductions"],
            "rto_charge_percentage": rto_calc["payment_gateway_percentage"],
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
            "claimed_at": None,
            "claimed_order_number": None,
            "donated_at": None,
            "donation_reference": None
        }
        
        # Save to database
        await db.rto_vouchers.insert_one(voucher)
        
        logger.info(f"Generated RTO voucher {voucher_code} for order {order_number}, value: ₹{voucher_value} (deductions: gateway={rto_calc['payment_gateway_fee']}, shipping={shipping_charges})")
        
        # Clean up MongoDB _id before returning
        voucher.pop('_id', None)
        
        return voucher
        
    except Exception as e:
        logger.error(f"Failed to generate RTO voucher: {e}")
        return None


async def validate_rto_voucher(db, voucher_code: str, user_email: str) -> dict:
    """
    Validate an RTO voucher for use.
    
    Returns:
        dict with 'valid', 'message', and 'voucher' (if valid)
    """
    try:
        voucher = await db.rto_vouchers.find_one({
            "voucher_code": voucher_code.upper(),
            "user_email": user_email.lower()
        })
        
        if not voucher:
            return {
                "valid": False,
                "message": "Voucher not found or not associated with your account"
            }
        
        # Check status
        if voucher.get("status") != "active":
            status = voucher.get("status", "unknown")
            if status == "claimed":
                return {
                    "valid": False,
                    "message": f"Voucher has already been claimed on order {voucher.get('claimed_order_number')}"
                }
            elif status == "expired":
                return {
                    "valid": False,
                    "message": "Voucher has expired"
                }
            elif status == "donated":
                return {
                    "valid": False,
                    "message": "Voucher has expired and the amount was donated to our NGO partners"
                }
            else:
                return {
                    "valid": False,
                    "message": f"Voucher is not active (status: {status})"
                }
        
        # Check expiry
        expires_at = voucher.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at:
                # Mark as expired
                await db.rto_vouchers.update_one(
                    {"voucher_code": voucher_code.upper()},
                    {"$set": {"status": "expired"}}
                )
                return {
                    "valid": False,
                    "message": "Voucher has expired"
                }
        
        return {
            "valid": True,
            "message": "Voucher is valid",
            "voucher": {
                "code": voucher.get("voucher_code"),
                "value": voucher.get("voucher_value", 0),
                "original_order": voucher.get("order_number"),
                "expires_at": voucher.get("expires_at")
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to validate RTO voucher: {e}")
        return {
            "valid": False,
            "message": "Error validating voucher"
        }


async def claim_rto_voucher(db, voucher_code: str, user_email: str, new_order_number: str) -> dict:
    """
    Claim an RTO voucher for a new order.
    
    Returns:
        dict with 'success', 'message', and 'discount_amount' (if successful)
    """
    # First validate
    validation = await validate_rto_voucher(db, voucher_code, user_email)
    if not validation.get("valid"):
        return {
            "success": False,
            "message": validation.get("message"),
            "discount_amount": 0
        }
    
    try:
        voucher_value = validation.get("voucher", {}).get("value", 0)
        
        # Mark voucher as claimed
        result = await db.rto_vouchers.update_one(
            {
                "voucher_code": voucher_code.upper(),
                "user_email": user_email.lower(),
                "status": "active"
            },
            {
                "$set": {
                    "status": "claimed",
                    "claimed_at": datetime.now(timezone.utc).isoformat(),
                    "claimed_order_number": new_order_number
                }
            }
        )
        
        if result.modified_count == 0:
            return {
                "success": False,
                "message": "Voucher could not be claimed",
                "discount_amount": 0
            }
        
        logger.info(f"RTO voucher {voucher_code} claimed for order {new_order_number}")
        
        return {
            "success": True,
            "message": "Voucher applied successfully",
            "discount_amount": voucher_value
        }
        
    except Exception as e:
        logger.error(f"Failed to claim RTO voucher: {e}")
        return {
            "success": False,
            "message": "Error claiming voucher",
            "discount_amount": 0
        }


async def get_user_rto_vouchers(db, user_email: str) -> list:
    """Get all RTO vouchers for a user"""
    try:
        vouchers = await db.rto_vouchers.find({
            "user_email": user_email.lower()
        }).sort("created_at", -1).to_list(50)
        
        # Clean up MongoDB _id
        for v in vouchers:
            v["_id"] = str(v["_id"])
        
        return vouchers
    except Exception as e:
        logger.error(f"Failed to get user RTO vouchers: {e}")
        return []
