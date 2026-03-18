"""
Shipping Configuration Service for Addrika
Simplified shipping logic based on cart value tiers
"""
import os
from typing import Dict, List, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# SIMPLIFIED SHIPPING LOGIC
# Based on final discounted cart value (after all discounts applied):
# - < ₹249: ₹149 flat shipping
# - ≥ ₹249 and < ₹999: ₹49 shipping  
# - ≥ ₹999: FREE shipping
# ============================================================================

# ============================================================================
# PREMIUM SHIPPING OPTIONS
# ============================================================================

PREMIUM_OPTIONS = {
    "priority_despatch": {
        "code": "PRIORITY",
        "name": "Priority Despatch",
        "description": "Guaranteed dispatch within 1 hour",
        "price": 29,
        "available_zones": ["delhi_ncr", "default"],  # Only for Delhi-shipped orders
        "excluded_pickup_locations": ["bhagalpur"],  # Not available when shipping from Bhagalpur
        "icon": "zap"
    },
    "same_day_delivery": {
        "code": "SAMEDAY",
        "name": "Same-Day Delivery",
        "description": "Delivery today (order before 12 PM)",
        "price": 49,
        "available_zones": ["delhi_ncr"],  # Only Delhi NCR delivery
        "excluded_pickup_locations": ["bhagalpur"],  # Must ship from Delhi
        "cutoff_hour": 12,  # 12 PM IST
        "icon": "clock"
    }
}

# ============================================================================
# RETAILERS / PICKUP LOCATIONS
# These serve as both pickup points for self-collection and fulfillment centers for shipping
# ============================================================================

RETAILERS = {
    "delhi": {
        "id": "delhi_primary",
        "name": "M.G. Shoppie",
        "address": "745 Sector 17 Pocket A Phase II",
        "city": "Dwarka, South West Delhi",
        "state": "Delhi",
        "pincode": "110078",
        "phone": "6202311736",
        "whatsapp": "916202311736",
        "email": "amitkumar.911@proton.me",  # Test email
        "coordinates": {"lat": 28.5921, "lng": 77.0460},
        "is_primary": True,
        "shiprocket_location_name": "Primary",
        "order_count": 0  # For round-robin tracking
    },
    "bhagalpur": {
        "id": "bhagalpur_mela",
        "name": "Mela Stores",
        "address": "D.N. Singh Road, Variety Chowk",
        "city": "Bhagalpur",
        "state": "Bihar",
        "pincode": "812002",
        "phone": "7061483566",
        "whatsapp": "917061483566",
        "email": "mr.amitbgp@gmail.com",  # Test email
        "coordinates": {"lat": 25.2425, "lng": 87.0048},
        "is_primary": False,
        "shiprocket_location_name": "Bhagalpur",
        "order_count": 0
    }
}

# Alias for backward compatibility
PICKUP_LOCATIONS = RETAILERS

# Zone-based pickup location assignment
# Orders to these states ship from Bhagalpur
EAST_INDIA_STATES = ["bihar", "jharkhand", "west bengal", "odisha", "wb", "or", "jh", "br"]

# State code to full name mapping for zone detection
STATE_CODES = {
    "br": "bihar", "bihar": "bihar",
    "jh": "jharkhand", "jharkhand": "jharkhand",
    "wb": "west bengal", "west bengal": "west bengal", "westbengal": "west bengal",
    "or": "odisha", "odisha": "odisha", "orissa": "odisha",
    "dl": "delhi", "delhi": "delhi",
    "hr": "haryana", "haryana": "haryana",
    "up": "uttar pradesh", "uttar pradesh": "uttar pradesh", "uttarpradesh": "uttar pradesh"
}

# ============================================================================
# RTO CONFIGURATION (Configurable)
# ============================================================================

# Default RTO deduction percentage (payment gateway fee + processing)
# Can be overridden via environment variable
RTO_DEDUCTION_PERCENTAGE = float(os.environ.get("RTO_DEDUCTION_PERCENTAGE", "2.36"))


# ============================================================================
# SIMPLIFIED SHIPPING LOGIC
# Based on final discounted cart value (after all discounts applied):
# - < ₹249: ₹149 flat shipping
# - ≥ ₹249 and < ₹999: ₹49 shipping  
# - ≥ ₹999: FREE shipping
# ============================================================================


def get_shipping_charge(discounted_cart_value: float, shiprocket_rate: float = None) -> int:
    """
    Calculate shipping charge based on discounted cart value.
    
    Logic:
    - If ShipRocket rate provided: min(ShipRocket + ₹20, slab_max)
    - Otherwise: use slab maximum as fallback
    
    Slabs:
    - <₹249: max ₹149
    - ₹249-998: max ₹49
    - ≥₹999: FREE
    
    Returns shipping charge in INR.
    """
    SHIPPING_MARGIN = 20
    
    # Determine slab maximum
    if discounted_cart_value >= 999:
        return 0  # Free shipping override
    elif discounted_cart_value >= 249:
        slab_max = 49
    else:
        slab_max = 149
    
    # If ShipRocket rate provided, use lesser of dynamic and slab max
    if shiprocket_rate is not None and shiprocket_rate > 0:
        dynamic_charge = shiprocket_rate + SHIPPING_MARGIN
        return int(min(dynamic_charge, slab_max))
    
    # Fallback to slab maximum
    return slab_max


def get_free_shipping_threshold(pincode: str = None) -> Dict:
    """
    Get shipping threshold info.
    Pincode parameter kept for API compatibility but not used in simplified logic.
    """
    return {
        "threshold": 999,
        "zone_name": "All India",
        "zone_key": "all_india",
        "free_shipping_available": True,
        "shipping_tiers": [
            {"min": 0, "max": 248, "charge": 149, "label": "Standard Shipping (₹149)"},
            {"min": 249, "max": 998, "charge": 49, "label": "Reduced Shipping (₹49)"},
            {"min": 999, "max": None, "charge": 0, "label": "FREE Shipping"}
        ]
    }


def calculate_shipping_charge(pincode: str, subtotal: float, base_shipping: float = 0) -> Dict:
    """
    Calculate shipping charge based on simplified tier logic.
    
    Args:
        pincode: Delivery pincode (kept for compatibility)
        subtotal: Order subtotal after discounts
        base_shipping: Not used in simplified logic
    
    Returns:
        dict with shipping details
    """
    shipping = get_shipping_charge(subtotal)
    
    return {
        "shipping_charge": shipping,
        "free_shipping": shipping == 0,
        "threshold": 999,
        "zone_name": "All India",
        "amount_for_free": max(0, 999 - subtotal) if subtotal < 999 else 0
    }


def get_available_premium_options(pincode: str, delivery_state: Optional[str] = None) -> List[Dict]:
    """
    Get available premium shipping options for a pincode.
    Premium options are only available for orders shipped from Delhi.
    
    Returns list of available premium options with pricing.
    """
    # Determine pickup location to check if premium options are available
    pickup_location = get_pickup_location_for_delivery(pincode, delivery_state)
    pickup_id = pickup_location.get("location_id", "")
    is_delhi_pickup = "delhi" in pickup_id.lower()
    
    options = []
    
    # Priority Despatch - only for Delhi-shipped orders
    priority = PREMIUM_OPTIONS["priority_despatch"]
    excluded_pickups = priority.get("excluded_pickup_locations", [])
    
    if is_delhi_pickup and not any(exc in pickup_id.lower() for exc in excluded_pickups):
        options.append({
            "code": priority["code"],
            "name": priority["name"],
            "description": priority["description"],
            "price": priority["price"],
            "icon": priority["icon"],
            "available": True
        })
    
    # Same-Day Delivery - only for Delhi NCR delivery AND Delhi pickup
    same_day = PREMIUM_OPTIONS["same_day_delivery"]
    # Get zone for same-day availability check
    pincode_prefix = pincode[:3] if pincode else ""
    is_delhi_ncr = pincode_prefix in ["110", "120", "121", "122", "201", "202"]
    zone = "delhi_ncr" if is_delhi_ncr else "other"
    
    if zone in same_day.get("available_zones", []) and is_delhi_pickup:
        # Check if before cutoff time (12 PM IST)
        # IST is UTC+5:30
        from datetime import timedelta
        now_utc = datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now_utc + ist_offset
        ist_hour = now_ist.hour
        ist_minute = now_ist.minute
        
        cutoff = same_day["cutoff_hour"]
        is_before_cutoff = ist_hour < cutoff
        
        # Calculate time remaining
        if is_before_cutoff:
            hours_remaining = cutoff - ist_hour - 1
            minutes_remaining = 60 - ist_minute
            if minutes_remaining == 60:
                hours_remaining += 1
                minutes_remaining = 0
            time_message = f"Order within {hours_remaining}h {minutes_remaining}m for same-day delivery"
        else:
            time_message = "Same-day delivery cutoff passed for today"
        
        options.append({
            "code": same_day["code"],
            "name": same_day["name"],
            "description": same_day["description"],
            "price": same_day["price"],
            "icon": same_day["icon"],
            "available": is_before_cutoff,
            "cutoff_hour": cutoff,
            "is_before_cutoff": is_before_cutoff,
            "cutoff_message": time_message
        })
    
    return options


def get_pickup_location_for_delivery(delivery_pincode: str, delivery_state: Optional[str] = None) -> Dict:
    """
    Determine the optimal pickup location based on delivery destination.
    Uses zone-based logic for efficiency.
    
    Args:
        delivery_pincode: Customer's delivery pincode
        delivery_state: Customer's state (optional, for better accuracy)
    
    Returns:
        dict with pickup location details
    """
    # Normalize state name
    state_lower = (delivery_state or "").lower().strip()
    normalized_state = STATE_CODES.get(state_lower, state_lower)
    
    # Check if delivering to East India
    is_east_india = False
    
    # Check by state name
    if normalized_state in EAST_INDIA_STATES:
        is_east_india = True
    
    # Also check by pincode prefix for Bihar (81, 82, 83, 84, 85)
    if delivery_pincode and len(delivery_pincode) >= 2:
        bihar_prefixes = ["81", "82", "83", "84", "85"]  # Bihar pincodes
        jharkhand_prefixes = ["81", "82", "83"]  # Jharkhand pincodes (overlap with Bihar)
        wb_prefixes = ["70", "71", "72", "73", "74"]  # West Bengal pincodes
        odisha_prefixes = ["75", "76", "77"]  # Odisha pincodes
        
        pin_prefix = delivery_pincode[:2]
        if pin_prefix in bihar_prefixes + jharkhand_prefixes + wb_prefixes + odisha_prefixes:
            is_east_india = True
    
    if is_east_india:
        location = PICKUP_LOCATIONS["bhagalpur"]
    else:
        location = PICKUP_LOCATIONS["delhi"]
    
    return {
        "location_id": location["id"],
        "location_name": location["name"],
        "shiprocket_location": location["shiprocket_location_name"],
        "address": location["address"],
        "city": location["city"],
        "state": location["state"],
        "pincode": location["pincode"],
        "is_primary": location["is_primary"],
        "auto_selected": True,
        "reason": "East India zone - faster delivery" if is_east_india else "Default warehouse"
    }


def get_all_pickup_locations() -> List[Dict]:
    """Get all available pickup locations for admin selection."""
    return [
        {
            "location_id": loc["id"],
            "name": loc["name"],
            "shiprocket_location": loc["shiprocket_location_name"],
            "address": f"{loc['address']}, {loc['city']}, {loc['state']} - {loc['pincode']}",
            "pincode": loc["pincode"],
            "is_primary": loc["is_primary"]
        }
        for loc in PICKUP_LOCATIONS.values()
    ]


def calculate_rto_voucher_value(order_amount: float, shipping_charges: float) -> Dict:
    """
    Calculate RTO voucher value using the new formula:
    Order Value - Payment Gateway Fee (%) - Shipping Charges
    
    Args:
        order_amount: Total amount paid by customer (including shipping)
        shipping_charges: Shipping charges in the order
    
    Returns:
        dict with voucher_value, deductions breakdown
    """
    # Get configurable percentage
    deduction_pct = RTO_DEDUCTION_PERCENTAGE
    
    # Calculate deductions
    payment_gateway_fee = round(order_amount * (deduction_pct / 100), 2)
    
    # Voucher value = Order amount - gateway fee - shipping charges
    voucher_value = round(order_amount - payment_gateway_fee - shipping_charges, 2)
    voucher_value = max(0, voucher_value)  # Ensure non-negative
    
    return {
        "order_amount": order_amount,
        "payment_gateway_fee": payment_gateway_fee,
        "payment_gateway_percentage": deduction_pct,
        "shipping_charges_deducted": shipping_charges,
        "total_deductions": round(payment_gateway_fee + shipping_charges, 2),
        "voucher_value": voucher_value
    }


# ============================================================================
# ADMIN CONFIGURATION FUNCTIONS
# ============================================================================

async def update_rto_percentage(db, new_percentage: float, admin_email: str) -> Dict:
    """
    Update the RTO deduction percentage (stored in admin settings).
    """
    global RTO_DEDUCTION_PERCENTAGE
    
    if new_percentage < 0 or new_percentage > 50:
        return {"success": False, "error": "Percentage must be between 0 and 50"}
    
    try:
        # Store in database for persistence
        await db.admin_settings.update_one(
            {"setting_key": "rto_deduction_percentage"},
            {
                "$set": {
                    "setting_value": new_percentage,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": admin_email
                }
            },
            upsert=True
        )
        
        # Update runtime variable
        RTO_DEDUCTION_PERCENTAGE = new_percentage
        logger.info(f"RTO deduction percentage updated to {new_percentage}% by {admin_email}")
        
        return {
            "success": True,
            "new_percentage": new_percentage,
            "message": f"RTO deduction percentage updated to {new_percentage}%"
        }
    except Exception as e:
        logger.error(f"Failed to update RTO percentage: {e}")
        return {"success": False, "error": str(e)}


async def load_rto_percentage_from_db(db) -> float:
    """Load RTO percentage from database on startup."""
    global RTO_DEDUCTION_PERCENTAGE
    
    try:
        setting = await db.admin_settings.find_one({"setting_key": "rto_deduction_percentage"})
        if setting and "setting_value" in setting:
            RTO_DEDUCTION_PERCENTAGE = float(setting["setting_value"])
            logger.info(f"Loaded RTO deduction percentage from DB: {RTO_DEDUCTION_PERCENTAGE}%")
    except Exception as e:
        logger.error(f"Failed to load RTO percentage from DB: {e}")
    
    return RTO_DEDUCTION_PERCENTAGE



# ============================================================================
# RETAILER ASSIGNMENT FUNCTIONS
# ============================================================================

import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points on Earth using Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


# Pincode to approximate coordinates mapping (for major areas)
# This is a simplified mapping - in production, use a proper geocoding service
PINCODE_COORDINATES = {
    # Delhi NCR
    "110": {"lat": 28.6139, "lng": 77.2090},  # Delhi
    "120": {"lat": 28.4595, "lng": 77.0266},  # Gurgaon
    "121": {"lat": 28.4595, "lng": 77.0266},  # Gurgaon
    "122": {"lat": 28.4595, "lng": 77.0266},  # Gurgaon
    "201": {"lat": 28.5355, "lng": 77.3910},  # Noida
    "202": {"lat": 28.6692, "lng": 77.4538},  # Ghaziabad
    # Bihar
    "812": {"lat": 25.2425, "lng": 87.0048},  # Bhagalpur
    "800": {"lat": 25.5941, "lng": 85.1376},  # Patna
    "801": {"lat": 25.5941, "lng": 85.1376},  # Patna area
    "802": {"lat": 25.3176, "lng": 84.8530},  # Ara
    "803": {"lat": 25.3176, "lng": 84.8530},  # Nalanda area
    "804": {"lat": 25.0810, "lng": 85.3096},  # Jehanabad
    "805": {"lat": 24.7914, "lng": 84.9911},  # Gaya
    # Mumbai/Maharashtra
    "400": {"lat": 19.0760, "lng": 72.8777},  # Mumbai
    "401": {"lat": 19.2183, "lng": 72.9781},  # Thane
    "410": {"lat": 18.5204, "lng": 73.8567},  # Pune area
    "411": {"lat": 18.5204, "lng": 73.8567},  # Pune
    "421": {"lat": 19.2183, "lng": 72.9781},  # Thane
    # Bangalore/Karnataka
    "560": {"lat": 12.9716, "lng": 77.5946},  # Bengaluru
    "561": {"lat": 12.9716, "lng": 77.5946},  # Bengaluru Rural
    "562": {"lat": 12.9716, "lng": 77.5946},  # Bengaluru area
    "570": {"lat": 12.2958, "lng": 76.6394},  # Mysuru
    "580": {"lat": 15.3647, "lng": 75.1240},  # Hubli-Dharwad
    # Chennai/Tamil Nadu
    "600": {"lat": 13.0827, "lng": 80.2707},  # Chennai
    "601": {"lat": 13.0604, "lng": 80.0496},  # Kanchipuram
    "602": {"lat": 12.9165, "lng": 79.1325},  # Vellore
    # Hyderabad/Telangana
    "500": {"lat": 17.3850, "lng": 78.4867},  # Hyderabad
    "501": {"lat": 17.3850, "lng": 78.4867},  # Hyderabad area
    # Kolkata/West Bengal
    "700": {"lat": 22.5726, "lng": 88.3639},  # Kolkata
    "701": {"lat": 22.5726, "lng": 88.3639},  # Kolkata area
}


def get_coordinates_for_pincode(pincode: str) -> dict:
    """
    Get approximate coordinates for a pincode.
    Uses first 3 digits to determine region.
    """
    if not pincode or len(pincode) < 3:
        return None
    
    prefix = pincode[:3]
    if prefix in PINCODE_COORDINATES:
        return PINCODE_COORDINATES[prefix]
    
    # Fallback: check 2-digit prefix
    prefix2 = pincode[:2]
    for key, coords in PINCODE_COORDINATES.items():
        if key.startswith(prefix2):
            return coords
    
    return None


def get_retailers_within_radius(pincode: str, radius_km: float = 5.0) -> list:
    """
    Find all retailers within the specified radius of a pincode.
    Returns list of retailers sorted by distance.
    """
    coords = get_coordinates_for_pincode(pincode)
    if not coords:
        return []
    
    nearby = []
    for key, retailer in RETAILERS.items():
        retailer_coords = retailer.get("coordinates", {})
        if not retailer_coords:
            continue
        
        distance = haversine_distance(
            coords["lat"], coords["lng"],
            retailer_coords["lat"], retailer_coords["lng"]
        )
        
        if distance <= radius_km:
            nearby.append({
                **retailer,
                "key": key,
                "distance_km": round(distance, 2)
            })
    
    # Sort by distance
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


async def assign_retailer_for_shipping(db, delivery_pincode: str) -> dict:
    """
    Assign the best retailer for a shipping order using round-robin.
    
    Logic:
    1. Find retailers within 5km of delivery address
    2. If multiple, use round-robin based on order count
    3. If none within 5km, fallback to Delhi (primary) warehouse
    
    Returns retailer info with assignment details.
    """
    nearby_retailers = get_retailers_within_radius(delivery_pincode, radius_km=5.0)
    
    if not nearby_retailers:
        # Fallback to Delhi primary warehouse
        delhi = RETAILERS["delhi"]
        return {
            "retailer_id": delhi["id"],
            "retailer_key": "delhi",
            "retailer_name": delhi["name"],
            "retailer_email": delhi["email"],
            "retailer_phone": delhi["phone"],
            "retailer_address": f"{delhi['address']}, {delhi['city']}, {delhi['state']} - {delhi['pincode']}",
            "assignment_reason": "No retailers within 5km - assigned to primary warehouse",
            "distance_km": None,
            "is_fallback": True
        }
    
    if len(nearby_retailers) == 1:
        # Only one retailer nearby
        retailer = nearby_retailers[0]
        return {
            "retailer_id": retailer["id"],
            "retailer_key": retailer["key"],
            "retailer_name": retailer["name"],
            "retailer_email": retailer["email"],
            "retailer_phone": retailer["phone"],
            "retailer_address": f"{retailer['address']}, {retailer['city']}, {retailer['state']} - {retailer['pincode']}",
            "assignment_reason": f"Nearest retailer ({retailer['distance_km']}km)",
            "distance_km": retailer["distance_km"],
            "is_fallback": False
        }
    
    # Multiple retailers - use round-robin based on order count from database
    try:
        # Get order counts for each nearby retailer
        for retailer in nearby_retailers:
            count_doc = await db.retailer_order_counts.find_one({"retailer_id": retailer["id"]})
            retailer["db_order_count"] = count_doc.get("count", 0) if count_doc else 0
        
        # Select retailer with lowest order count (round-robin)
        nearby_retailers.sort(key=lambda x: (x["db_order_count"], x["distance_km"]))
        selected = nearby_retailers[0]
        
        # Increment order count for selected retailer
        await db.retailer_order_counts.update_one(
            {"retailer_id": selected["id"]},
            {"$inc": {"count": 1}, "$set": {"retailer_name": selected["name"]}},
            upsert=True
        )
        
        return {
            "retailer_id": selected["id"],
            "retailer_key": selected["key"],
            "retailer_name": selected["name"],
            "retailer_email": selected["email"],
            "retailer_phone": selected["phone"],
            "retailer_address": f"{selected['address']}, {selected['city']}, {selected['state']} - {selected['pincode']}",
            "assignment_reason": f"Round-robin selection ({selected['distance_km']}km, order #{selected['db_order_count'] + 1})",
            "distance_km": selected["distance_km"],
            "is_fallback": False
        }
        
    except Exception as e:
        logger.error(f"Round-robin assignment failed: {e}")
        # Fallback to first nearby retailer
        selected = nearby_retailers[0]
        return {
            "retailer_id": selected["id"],
            "retailer_key": selected["key"],
            "retailer_name": selected["name"],
            "retailer_email": selected["email"],
            "retailer_phone": selected["phone"],
            "retailer_address": f"{selected['address']}, {selected['city']}, {selected['state']} - {selected['pincode']}",
            "assignment_reason": "Nearest retailer (round-robin failed)",
            "distance_km": selected["distance_km"],
            "is_fallback": False
        }


def get_retailers_for_self_pickup(pincode: str = None) -> list:
    """
    Get list of retailers available for self-pickup.
    If pincode provided, sort by distance.
    """
    retailers_list = []
    
    for key, retailer in RETAILERS.items():
        retailers_list.append({
            "id": retailer["id"],
            "key": key,
            "name": retailer["name"],
            "address": retailer["address"],
            "city": retailer["city"],
            "state": retailer["state"],
            "pincode": retailer["pincode"],
            "phone": retailer["phone"],
            "whatsapp": retailer["whatsapp"],
            "email": retailer["email"],
            "coordinates": retailer.get("coordinates", {})
        })
    
    # Sort by distance if pincode provided
    if pincode:
        coords = get_coordinates_for_pincode(pincode)
        if coords:
            for retailer in retailers_list:
                retailer_coords = retailer.get("coordinates", {})
                if retailer_coords:
                    retailer["distance_km"] = round(haversine_distance(
                        coords["lat"], coords["lng"],
                        retailer_coords["lat"], retailer_coords["lng"]
                    ), 2)
                else:
                    retailer["distance_km"] = 9999
            retailers_list.sort(key=lambda x: x.get("distance_km", 9999))
    
    return retailers_list


def get_all_retailers() -> list:
    """Get all retailers with full details for Find Retailers page."""
    return [
        {
            "id": idx + 1,
            "retailer_id": retailer["id"],
            "name": retailer["name"],
            "address": retailer["address"],
            "city": retailer["city"],
            "state": retailer["state"],
            "pincode": retailer["pincode"],
            "phone": f"(+91) {retailer['phone'][:4]}-{retailer['phone'][4:7]}-{retailer['phone'][7:]}",
            "phone_raw": retailer["phone"],
            "whatsapp": retailer["whatsapp"],
            "email": retailer["email"],
            "coordinates": retailer.get("coordinates", {"lat": 0, "lng": 0})
        }
        for idx, (key, retailer) in enumerate(RETAILERS.items())
    ]
