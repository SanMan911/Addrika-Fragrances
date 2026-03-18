"""
Order Pricing Service for Addrika
Handles all pricing calculations including discounts, shipping, and delivery mode logic
"""
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Token amount for pay-at-store self-pickup orders
# Set to 0 to disable token payments - customer pays full amount at store
TOKEN_AMOUNT = 0

def calculate_mrp_total(items: List[Dict]) -> float:
    """Calculate total MRP value from order items"""
    return sum(item["mrp"] * item["quantity"] for item in items)


def calculate_order_pricing(
    items: List[Dict],
    delivery_mode: str,
    is_pay_at_store: bool,
    coupon_discount: float,
    has_coupon_applied: bool,
    base_pricing: Dict,
    shipping_charge_func
) -> Dict[str, Any]:
    """
    Calculate final pricing based on delivery mode and discounts.
    
    Args:
        items: List of order items with mrp and quantity
        delivery_mode: 'shipping' or 'self_pickup'
        is_pay_at_store: Whether this is a pay-at-store pickup order
        coupon_discount: Amount of coupon discount (only for shipping)
        has_coupon_applied: Whether a valid coupon is applied
        base_pricing: Initial pricing calculation from products
        shipping_charge_func: Function to calculate shipping charge
    
    Returns:
        Dictionary with all pricing details
    """
    mrp_total = calculate_mrp_total(items)
    is_self_pickup = delivery_mode == 'self_pickup'
    
    if is_self_pickup:
        # Self-pickup: MRP only, no shipping, no discounts
        bulk_discount = 0
        shipping = 0
        final_total = mrp_total
        value_for_shipping_calc = mrp_total
    elif has_coupon_applied:
        # Shipping with coupon: start from MRP, no bulk discount
        bulk_discount = 0
        value_for_shipping_calc = mrp_total - coupon_discount
        shipping = shipping_charge_func(value_for_shipping_calc)
        final_total = mrp_total - coupon_discount + shipping
    else:
        # Shipping without coupon: use normal subtotal
        bulk_discount = base_pricing.get("bulk_discount", 0)
        value_for_shipping_calc = base_pricing.get("subtotal", mrp_total) - bulk_discount
        shipping = shipping_charge_func(value_for_shipping_calc)
        final_total = base_pricing.get("subtotal", mrp_total) - bulk_discount + shipping
    
    # Calculate payment amounts
    amount_to_charge = TOKEN_AMOUNT if is_pay_at_store else final_total
    balance_at_store = (mrp_total - TOKEN_AMOUNT) if is_pay_at_store else 0
    
    return {
        "mrp_total": round(mrp_total, 2),
        "subtotal": round(base_pricing.get("subtotal", mrp_total), 2),
        "bulk_discount": round(bulk_discount, 2),
        "coupon_discount": round(coupon_discount, 2),
        "shipping": round(shipping, 2),
        "final_total": round(final_total, 2),
        "amount_to_charge": round(amount_to_charge, 2),
        "balance_at_store": round(balance_at_store, 2),
        "value_for_shipping_calc": round(value_for_shipping_calc, 2)
    }


async def validate_and_apply_coupon(
    db,
    coupon_code: str,
    mrp_total: float,
    delivery_mode: str,
    user_email: str = None
) -> Dict[str, Any]:
    """
    Validate and calculate coupon/voucher discount.
    Checks both discount_codes and rto_vouchers collections.
    
    Args:
        db: Database instance
        coupon_code: The coupon code to validate
        mrp_total: Total MRP value of the order
        delivery_mode: 'shipping' or 'self_pickup'
        user_email: User's email (required for RTO vouchers)
    
    Returns:
        Dictionary with coupon_discount, has_coupon_applied, and coupon_code
    """
    # Discount codes NOT allowed for self-pickup
    if delivery_mode == 'self_pickup' or not coupon_code:
        return {
            "coupon_discount": 0,
            "has_coupon_applied": False,
            "coupon_code": None
        }
    
    code_upper = coupon_code.upper()
    
    # First, check regular discount codes
    discount_code = await db.discount_codes.find_one({
        "code": code_upper,
        "is_active": True
    })
    
    if discount_code:
        min_order = discount_code.get("min_order_value", 0) or 0
        
        # ALL coupons: calculate discount from MRP (BASE PRICE)
        base_for_discount = mrp_total
        
        if base_for_discount < min_order:
            return {
                "coupon_discount": 0,
                "has_coupon_applied": False,
                "coupon_code": None,
                "error": f"Minimum order value of ₹{min_order} required for this coupon"
            }
        
        coupon_discount = 0
        if discount_code.get("discount_type") == "percentage":
            discount_value = discount_code.get("discount_value", 0) or 0
            coupon_discount = base_for_discount * (discount_value / 100)
            max_discount = discount_code.get("max_discount")
            if max_discount is not None:
                coupon_discount = min(coupon_discount, max_discount)
        else:
            coupon_discount = discount_code.get("discount_value", 0) or 0
        
        return {
            "coupon_discount": coupon_discount,
            "has_coupon_applied": True,
            "coupon_code": code_upper,
            "voucher_type": "discount_code"
        }
    
    # If not found in discount_codes, check RTO vouchers
    from datetime import datetime, timezone
    
    rto_voucher = await db.rto_vouchers.find_one({
        "voucher_code": code_upper,
        "status": "active"
    })
    
    if rto_voucher:
        # Check if voucher has expired
        expires_at_str = rto_voucher.get("expires_at")
        if expires_at_str:
            try:
                # Parse ISO format datetime
                if expires_at_str.endswith('Z'):
                    expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                elif '+' in expires_at_str or expires_at_str.endswith('+00:00'):
                    expires_at = datetime.fromisoformat(expires_at_str)
                else:
                    expires_at = datetime.fromisoformat(expires_at_str).replace(tzinfo=timezone.utc)
                
                if datetime.now(timezone.utc) > expires_at:
                    return {
                        "coupon_discount": 0,
                        "has_coupon_applied": False,
                        "coupon_code": None,
                        "error": "This RTO voucher has expired"
                    }
            except Exception as e:
                logger.warning(f"Error parsing RTO voucher expiry: {e}")
        
        # RTO vouchers are fixed-value vouchers
        voucher_value = rto_voucher.get("voucher_value", 0)
        
        # Cap the discount at the order total (can't have negative orders)
        coupon_discount = min(voucher_value, mrp_total)
        
        logger.info(f"RTO voucher {code_upper} applied: ₹{coupon_discount} (voucher value: ₹{voucher_value})")
        
        return {
            "coupon_discount": coupon_discount,
            "has_coupon_applied": True,
            "coupon_code": code_upper,
            "voucher_type": "rto_voucher",
            "rto_voucher_id": rto_voucher.get("id"),
            "original_voucher_value": voucher_value
        }
    
    # Code not found in either collection
    return {
        "coupon_discount": 0,
        "has_coupon_applied": False,
        "coupon_code": None
    }


def get_order_status_for_delivery_mode(delivery_mode: str, is_pay_at_store: bool) -> str:
    """
    Determine initial order status based on delivery mode.
    
    Args:
        delivery_mode: 'shipping' or 'self_pickup'
        is_pay_at_store: Whether this is a pay-at-store pickup order
    
    Returns:
        Initial order status string
    """
    if delivery_mode == 'self_pickup':
        return "pending_pickup" if is_pay_at_store else "ready_for_pickup"
    return "confirmed"


def calculate_package_details(items: List[Dict], order_subtotal: float = 0) -> Dict[str, Any]:
    """
    Calculate total package weight and dimensions from order items.
    
    Weight Formula:
    - Base: Net weight of all products
    - + 200g for orders below ₹999
    - + additional 100g for orders between ₹1000 and ₹2500
    - + additional 200g for every increase in ₹2500 subsequently
    
    Product weights:
    - 50g packet = 80g (includes packaging)
    - 200g jar = 350g (includes packaging)
    
    Args:
        items: List of order items
        order_subtotal: Total order value for calculating packaging weight
    
    Returns:
        Dictionary with weight, length, breadth, height
    """
    # Calculate net weight of all products
    net_weight = 0
    
    for item in items:
        size = item.get("size", "50g")
        quantity = item.get("quantity", 1)
        
        if size == "50g":
            # 50g packet treated as 80g with packaging
            net_weight += 0.08 * quantity
        elif size == "200g":
            # 200g jar treated as 350g with packaging
            net_weight += 0.35 * quantity
        else:
            # Default: use actual weight or estimate
            weight_str = size.replace("g", "").strip()
            try:
                actual_weight = int(weight_str)
                # Add 60% for packaging/volumetric
                net_weight += (actual_weight / 1000 * 1.6) * quantity
            except ValueError:
                net_weight += 0.15 * quantity  # Default fallback
    
    # Calculate additional packaging weight based on order value
    packaging_weight = 0
    
    if order_subtotal < 999:
        # Orders below ₹999: add 200g
        packaging_weight = 0.2
    elif order_subtotal < 2500:
        # Orders ₹999 to ₹2499: add 200g + 100g = 300g
        packaging_weight = 0.3
    else:
        # Orders ₹2500+: add 300g + 200g for every ₹2500 increment
        packaging_weight = 0.3  # Base for first ₹2500
        additional_increments = (order_subtotal - 2500) // 2500
        packaging_weight += 0.2 * (additional_increments + 1)
    
    total_weight = net_weight + packaging_weight
    
    # Minimum weight for shipping
    total_weight = max(total_weight, 0.25)
    
    # Estimate box dimensions based on item count
    item_count = sum(item.get("quantity", 1) for item in items)
    
    if item_count <= 2:
        length, breadth, height = 20, 15, 8
    elif item_count <= 5:
        length, breadth, height = 25, 18, 12
    else:
        length, breadth, height = 30, 22, 15
    
    logger.info(f"Package calculation: net={net_weight:.2f}kg, packaging={packaging_weight:.2f}kg, total={total_weight:.2f}kg (order value: ₹{order_subtotal})")
    
    return {
        "weight": round(total_weight, 2),
        "net_weight": round(net_weight, 2),
        "packaging_weight": round(packaging_weight, 2),
        "length": length,
        "breadth": breadth,
        "height": height
    }
