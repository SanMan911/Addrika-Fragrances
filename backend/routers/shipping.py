"""Shipping Routes - Real-time shipping rate calculation using ShipRocket"""
from fastapi import APIRouter, HTTPException, Query, Request, Header
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import logging
from datetime import datetime

from services.shiprocket_service import (
    get_domestic_shipping_rates,
    check_pincode_serviceability,
    track_shipment
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Shipping"])

# Default pickup pincode (Addrika warehouse)
DEFAULT_PICKUP_PINCODE = os.environ.get("ADDRIKA_PICKUP_PINCODE", "110078")

# ShipRocket Webhook Token (for validation) - REQUIRED in production
SHIPROCKET_WEBHOOK_TOKEN = os.environ.get("SHIPROCKET_WEBHOOK_TOKEN")
if not SHIPROCKET_WEBHOOK_TOKEN:
    logger.warning("SHIPROCKET_WEBHOOK_TOKEN not set - webhook verification will be skipped")


class ShippingRateRequest(BaseModel):
    """Request model for shipping rate calculation"""
    delivery_pincode: str = Field(..., min_length=6, max_length=6, description="6-digit delivery pincode")
    weight: float = Field(default=0.25, gt=0, description="Package weight in kg")
    country: Optional[str] = Field(default="IN", description="Country code (IN for India)")
    length: Optional[float] = Field(default=None, description="Package length in cm")
    breadth: Optional[float] = Field(default=None, description="Package breadth in cm")
    height: Optional[float] = Field(default=None, description="Package height in cm")
    cod: bool = Field(default=False, description="Cash on Delivery flag")


class CourierOption(BaseModel):
    """Model for courier option response"""
    courier_id: int
    courier_name: str
    rate: float
    etd: str
    estimated_delivery_days: int
    cod_charges: Optional[float] = 0
    freight_charge: Optional[float] = 0
    is_surface: Optional[bool] = False
    service_type: Optional[str] = "standard"


class ShippingRateResponse(BaseModel):
    """Response model for shipping rates"""
    success: bool
    couriers: List[CourierOption]
    recommended: Optional[CourierOption] = None
    currency: str = "INR"
    is_international: bool = False
    error: Optional[str] = None


@router.post("/shipping/rates", response_model=ShippingRateResponse)
async def calculate_shipping_rates(request: ShippingRateRequest):
    """
    Calculate real-time shipping rates for domestic (India) deliveries.
    
    Note: International shipping is currently disabled pending IEC documentation.
    
    Returns a list of available couriers sorted by price (cheapest first).
    """
    # Validate pincode format
    if not request.delivery_pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    # Check country - only domestic shipping enabled
    country_code = request.country.upper() if request.country else "IN"
    
    if country_code != "IN" and country_code != "INDIA":
        # International shipping disabled
        return ShippingRateResponse(
            success=False,
            couriers=[],
            error="International shipping is currently unavailable. We're working on expanding globally soon!",
            currency="INR",
            is_international=True
        )
    
    # Domestic shipping only
    result = await get_domestic_shipping_rates(
        pickup_postcode=DEFAULT_PICKUP_PINCODE,
        delivery_postcode=request.delivery_pincode,
        weight=request.weight,
        length=request.length,
        breadth=request.breadth,
        height=request.height,
        cod=request.cod
    )
    
    if not result.get("success"):
        # Return fallback rates if API fails
        return ShippingRateResponse(
            success=False,
            couriers=[],
            error=result.get("error", "Unable to fetch shipping rates"),
            currency="INR",
            is_international=country_code != "IN"
        )
    
    # Convert to response model
    couriers = []
    for c in result.get("couriers", []):
        couriers.append(CourierOption(
            courier_id=c.get("courier_id", 0),
            courier_name=c.get("courier_name", "Standard"),
            rate=c.get("rate", 0),
            etd=c.get("etd", "3-5 days"),
            estimated_delivery_days=c.get("estimated_delivery_days", 5),
            cod_charges=c.get("cod_charges", 0),
            freight_charge=c.get("freight_charge", 0),
            is_surface=c.get("is_surface", False),
            service_type=c.get("service_type", "standard")
        ))
    
    recommended = None
    if result.get("recommended"):
        r = result["recommended"]
        recommended = CourierOption(
            courier_id=r.get("courier_id", 0),
            courier_name=r.get("courier_name", "Standard"),
            rate=r.get("rate", 0),
            etd=r.get("etd", "3-5 days"),
            estimated_delivery_days=r.get("estimated_delivery_days", 5),
            cod_charges=r.get("cod_charges", 0),
            freight_charge=r.get("freight_charge", 0),
            is_surface=r.get("is_surface", False),
            service_type=r.get("service_type", "standard")
        )
    
    return ShippingRateResponse(
        success=True,
        couriers=couriers,
        recommended=recommended,
        currency=result.get("currency", "INR"),
        is_international=result.get("is_international", False)
    )


@router.get("/shipping/rates/quick")
async def get_quick_shipping_rate(
    pincode: str = Query(..., min_length=6, max_length=6, description="Delivery pincode"),
    weight: float = Query(default=0.25, gt=0, description="Package weight in kg"),
    country: str = Query(default="IN", description="Country code")
):
    """
    Quick endpoint to get the cheapest shipping rate for a pincode.
    Used for real-time shipping cost display on checkout.
    
    Note: International shipping is currently disabled.
    """
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    country_code = country.upper() if country else "IN"
    
    # Only domestic shipping enabled
    if country_code != "IN" and country_code != "INDIA":
        return {
            "success": False,
            "shipping_charge": 0,
            "courier_name": "N/A",
            "etd": "N/A",
            "estimated_days": 0,
            "currency": "INR",
            "error": "International shipping is currently unavailable"
        }
    
    result = await get_domestic_shipping_rates(
        pickup_postcode=DEFAULT_PICKUP_PINCODE,
        delivery_postcode=pincode,
        weight=weight
    )
    
    if result.get("success") and result.get("couriers"):
        cheapest = result["couriers"][0]  # Already sorted by price
        return {
            "success": True,
            "shipping_charge": cheapest["rate"],
            "courier_name": cheapest["courier_name"],
            "etd": cheapest["etd"],
            "estimated_days": cheapest.get("estimated_delivery_days", 5),
            "currency": "INR"
        }
    else:
        # Return fallback rate
        return {
            "success": False,
            "shipping_charge": 0,  # Free shipping fallback
            "courier_name": "Standard",
            "etd": "5-7 days",
            "estimated_days": 7,
            "currency": "INR",
            "error": result.get("error", "Unable to calculate shipping")
        }


@router.get("/shipping/calculate-charge")
async def calculate_dynamic_shipping_charge(
    pincode: str = Query(..., min_length=6, max_length=6, description="Delivery pincode"),
    weight: float = Query(default=0.25, gt=0, description="Package weight in kg"),
    subtotal: float = Query(default=0, ge=0, description="Order subtotal (post-discount) for shipping calculation")
):
    """
    Calculate final shipping charge for checkout:
    - Gets cheapest ShipRocket courier rate + ₹20 margin
    - Caps at slab maximum based on cart value:
      * <₹249: max ₹149
      * ₹249-998: max ₹49
      * ≥₹999: FREE (override)
    - Final charge = min(ShipRocket + ₹20, slab_max)
    
    This ensures frontend display matches Razorpay amount.
    """
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    # Shipping configuration
    FREE_SHIPPING_THRESHOLD = 999
    SHIPPING_MARGIN = 20  # ₹20 buffer over ShipRocket rate
    
    # Slab maximums based on cart value (post-discount)
    if subtotal >= FREE_SHIPPING_THRESHOLD:
        slab_max = 0
        slab_label = "Free Shipping"
    elif subtotal >= 249:
        slab_max = 49
        slab_label = "Reduced Shipping (max ₹49)"
    else:
        slab_max = 149
        slab_label = "Standard Shipping (max ₹149)"
    
    # Free shipping for orders ≥ ₹999
    if subtotal >= FREE_SHIPPING_THRESHOLD:
        return {
            "success": True,
            "shipping_charge": 0,
            "base_rate": 0,
            "margin": 0,
            "slab_max": 0,
            "is_free": True,
            "free_shipping_reason": f"Order value ≥ ₹{FREE_SHIPPING_THRESHOLD}",
            "courier_name": "Free Shipping",
            "etd": "3-5 days",
            "estimated_days": 5,
            "currency": "INR"
        }
    
    # Get ShipRocket rates
    from services.shipping_config import get_pickup_location_for_delivery
    
    # Determine pickup location based on delivery pincode
    try:
        pickup_info = get_pickup_location_for_delivery(pincode, None)
        pickup_pincode = pickup_info.get("pincode", DEFAULT_PICKUP_PINCODE)
    except Exception:
        pickup_pincode = DEFAULT_PICKUP_PINCODE
    
    result = await get_domestic_shipping_rates(
        pickup_postcode=pickup_pincode,
        delivery_postcode=pincode,
        weight=weight
    )
    
    if result.get("success") and result.get("couriers"):
        cheapest = result["couriers"][0]
        base_rate = cheapest["rate"]
        shiprocket_with_margin = base_rate + SHIPPING_MARGIN
        
        # Cap at slab maximum - customer pays the LESSER of dynamic rate and slab max
        final_charge = min(shiprocket_with_margin, slab_max)
        
        # Calculate amount needed for free shipping
        amount_for_free = max(0, FREE_SHIPPING_THRESHOLD - subtotal)
        
        return {
            "success": True,
            "shipping_charge": round(final_charge, 2),
            "base_rate": round(base_rate, 2),
            "margin": SHIPPING_MARGIN,
            "shiprocket_total": round(shiprocket_with_margin, 2),
            "slab_max": slab_max,
            "slab_label": slab_label,
            "is_capped": shiprocket_with_margin > slab_max,
            "is_free": False,
            "courier_name": cheapest["courier_name"],
            "etd": cheapest["etd"],
            "estimated_days": cheapest.get("estimated_delivery_days", 5),
            "currency": "INR",
            "amount_for_free_shipping": round(amount_for_free, 2),
            "free_shipping_threshold": FREE_SHIPPING_THRESHOLD
        }
    else:
        # Fallback to slab maximum if ShipRocket unavailable
        return {
            "success": False,
            "shipping_charge": slab_max,
            "base_rate": 0,
            "margin": 0,
            "slab_max": slab_max,
            "slab_label": slab_label,
            "is_free": slab_max == 0,
            "is_fallback": True,
            "fallback_reason": result.get("error", "ShipRocket unavailable"),
            "courier_name": "Standard Delivery",
            "etd": "5-7 days",
            "estimated_days": 7,
            "currency": "INR",
            "amount_for_free_shipping": max(0, FREE_SHIPPING_THRESHOLD - subtotal),
            "free_shipping_threshold": FREE_SHIPPING_THRESHOLD
        }


@router.get("/shipping/check-pincode")
async def check_pincode(
    pincode: str = Query(..., min_length=6, max_length=6, description="Pincode to check")
):
    """
    Check if a pincode is serviceable for delivery.
    Returns serviceability status along with city/state info.
    """
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    result = await check_pincode_serviceability(pincode)
    
    return {
        "pincode": pincode,
        "serviceable": result.get("serviceable", True),
        "city": result.get("city"),
        "state": result.get("state"),
        "cod_available": result.get("cod_available", True)
    }


# Source warehouse PIN codes for delivery time estimation
SOURCE_PINCODES = ["110078", "812002"]  # Delhi, Bihar


@router.get("/shipping/delivery-estimate")
async def get_delivery_estimate(
    pincode: str = Query(..., min_length=6, max_length=6, description="Delivery pincode")
):
    """
    Get estimated delivery time using ShipRocket API.
    Checks from both source warehouses (110078 - Delhi, 812002 - Bihar)
    and returns the fastest option.
    """
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    fastest_estimate = None
    all_estimates = []
    
    for source_pincode in SOURCE_PINCODES:
        try:
            # Get shipping rates which includes ETD (Estimated Time of Delivery)
            result = await get_domestic_shipping_rates(
                pickup_postcode=source_pincode,
                delivery_postcode=pincode,
                weight=0.25  # Default weight for agarbattis
            )
            
            if result.get("success") and result.get("couriers"):
                # Get the fastest courier option
                for courier in result["couriers"]:
                    etd = courier.get("etd", "5-7 days")
                    estimated_days = courier.get("estimated_delivery_days", 7)
                    # Ensure it's an integer
                    try:
                        estimated_days = int(estimated_days) if estimated_days else 7
                    except (ValueError, TypeError):
                        estimated_days = 7
                    
                    estimate_data = {
                        "source_pincode": source_pincode,
                        "source_location": "Delhi" if source_pincode == "110078" else "Bihar",
                        "courier_name": courier.get("courier_name"),
                        "etd": etd,
                        "estimated_days": estimated_days,
                        "rate": courier.get("rate", 0)
                    }
                    all_estimates.append(estimate_data)
                    
                    # Track fastest option
                    if fastest_estimate is None or estimated_days < fastest_estimate["estimated_days"]:
                        fastest_estimate = estimate_data
        
        except Exception as e:
            logger.error(f"Error getting delivery estimate from {source_pincode}: {e}")
    
    if fastest_estimate:
        # Format the ETD for display
        etd_display = fastest_estimate["etd"]
        estimated_days = int(fastest_estimate["estimated_days"]) if fastest_estimate["estimated_days"] else 5
        
        # Create user-friendly message
        if estimated_days <= 2:
            delivery_message = f"Express Delivery: {etd_display}"
        elif estimated_days <= 4:
            delivery_message = f"Fast Delivery: {etd_display}"
        elif estimated_days <= 7:
            delivery_message = f"Standard Delivery: {etd_display}"
        else:
            delivery_message = f"Estimated Delivery: {etd_display}"
        
        return {
            "success": True,
            "delivery_pincode": pincode,
            "estimated_days": estimated_days,
            "etd": etd_display,
            "delivery_message": delivery_message,
            "shipped_from": fastest_estimate["source_location"],
            "courier": fastest_estimate["courier_name"],
            "all_options": sorted(all_estimates, key=lambda x: int(x["estimated_days"]) if x["estimated_days"] else 999)[:3]
        }
    else:
        # Fallback estimate if ShipRocket fails
        return {
            "success": True,
            "delivery_pincode": pincode,
            "estimated_days": 5,
            "etd": "4-6 business days",
            "delivery_message": "Standard Delivery: 4-6 business days",
            "shipped_from": "Nearest warehouse",
            "courier": None,
            "is_fallback": True
        }


@router.get("/shipping/options")
async def get_shipping_options(
    pincode: str = Query(..., min_length=6, max_length=6, description="Delivery pincode"),
    subtotal: float = Query(..., gt=0, description="Order subtotal"),
    state: Optional[str] = Query(default=None, description="Delivery state")
):
    """
    Get comprehensive shipping options for checkout including:
    - Free shipping threshold and eligibility
    - Available premium options (Priority Despatch, Same-Day Delivery)
    - Pickup location that will be used
    """
    from services.shipping_config import (
        get_free_shipping_threshold,
        calculate_shipping_charge,
        get_available_premium_options,
        get_pickup_location_for_delivery
    )
    
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode format")
    
    # Get free shipping info
    threshold_info = get_free_shipping_threshold(pincode)
    
    # Get base shipping rate from ShipRocket
    base_rate_result = await get_domestic_shipping_rates(
        pickup_postcode=DEFAULT_PICKUP_PINCODE,
        delivery_postcode=pincode,
        weight=0.25  # Default weight
    )
    
    base_shipping = 0
    if base_rate_result.get("success") and base_rate_result.get("couriers"):
        base_shipping = base_rate_result["couriers"][0]["rate"]
    else:
        base_shipping = 60  # Fallback rate
    
    # Calculate final shipping charge
    shipping_calc = calculate_shipping_charge(pincode, subtotal, base_shipping)
    
    # Get premium options
    premium_options = get_available_premium_options(pincode, state)
    
    # Get pickup location
    pickup_location = get_pickup_location_for_delivery(pincode, state)
    
    # Build free shipping message based on availability
    free_shipping_available = shipping_calc.get("free_shipping_available", False)
    
    if not free_shipping_available:
        free_shipping_message = "Free delivery is not available for this location"
    elif shipping_calc["free_shipping"]:
        free_shipping_message = "You qualify for free delivery!"
    else:
        free_shipping_message = f"Free delivery on orders above ₹{threshold_info['threshold']}"
    
    return {
        "success": True,
        "pincode": pincode,
        "zone": threshold_info["zone_name"],
        "free_shipping": {
            "available": free_shipping_available,
            "eligible": shipping_calc["free_shipping"],
            "threshold": threshold_info["threshold"],
            "amount_for_free": shipping_calc["amount_for_free"],
            "message": free_shipping_message
        },
        "shipping_charge": shipping_calc["shipping_charge"],
        "base_shipping_rate": base_shipping,
        "premium_options": premium_options,
        "pickup_location": {
            "name": pickup_location["location_name"],
            "city": pickup_location["city"],
            "reason": pickup_location["reason"]
        },
        "ships_from_delhi": "delhi" in pickup_location["location_id"].lower()
    }


@router.get("/shipping/free-thresholds")
async def get_free_shipping_thresholds(pincode: str = None):
    """
    Get all free shipping thresholds for display on the website.
    If pincode is provided, also returns the specific threshold for that pincode.
    """
    from services.shipping_config import FREE_SHIPPING_THRESHOLDS, get_free_shipping_threshold, BHAGALPUR_LOCAL_PINCODES, DELHI_DWARKA_LOCAL_PINCODES
    
    thresholds = []
    
    # Bhagalpur Local (specific pincodes)
    thresholds.append({
        "zone": "Bhagalpur Local",
        "threshold": 249,
        "pincodes": BHAGALPUR_LOCAL_PINCODES,
        "description": "Free delivery in Bhagalpur (812001, 812002, 812005) on orders above ₹249"
    })
    
    # Delhi Dwarka Local (5km radius)
    thresholds.append({
        "zone": "Delhi Local (Dwarka)",
        "threshold": 249,
        "pincodes": DELHI_DWARKA_LOCAL_PINCODES,
        "description": "Free delivery in Dwarka area (5km radius) on orders above ₹249"
    })
    
    # Bhagalpur District
    bhag = FREE_SHIPPING_THRESHOLDS.get("bhagalpur", {})
    if bhag.get("free_shipping_available", False):
        thresholds.append({
            "zone": "Bhagalpur District",
            "threshold": bhag["threshold"],
            "description": f"Free delivery in Bhagalpur District on orders above ₹{bhag['threshold']}"
        })
    
    # Delhi NCR
    delhi = FREE_SHIPPING_THRESHOLDS.get("delhi_ncr", {})
    if delhi.get("free_shipping_available", False):
        thresholds.append({
            "zone": "Delhi NCR",
            "threshold": delhi["threshold"],
            "description": f"Free delivery in Delhi NCR on orders above ₹{delhi['threshold']}"
        })
    
    # Rest of India
    default = FREE_SHIPPING_THRESHOLDS.get("default", {})
    if default.get("free_shipping_available", False):
        thresholds.append({
            "zone": "Rest of India",
            "threshold": default["threshold"],
            "description": f"Free delivery across India on orders above ₹{default['threshold']}"
        })
    
    response = {
        "thresholds": thresholds
    }
    
    # If pincode provided, also return specific zone info
    if pincode:
        zone_info = get_free_shipping_threshold(pincode)
        response["your_zone"] = {
            "pincode": pincode,
            "zone_name": zone_info["zone_name"],
            "threshold": zone_info["threshold"],
            "free_shipping_available": zone_info.get("free_shipping_available", True)
        }
    
    return response


@router.get("/shipping/pickup-locations")
async def get_pickup_locations():
    """
    Get all available pickup locations (for admin reference).
    """
    from services.shipping_config import get_all_pickup_locations
    
    return {
        "locations": get_all_pickup_locations()
    }


@router.get("/shipping/track/{awb_number}")
async def track_shipment_status(awb_number: str):
    """
    Track a shipment using its AWB (Air Waybill) number.
    Returns current status and tracking history.
    """
    if not awb_number:
        raise HTTPException(status_code=400, detail="AWB number is required")
    
    result = await track_shipment(awb_number)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=404, 
            detail=result.get("error", "Unable to track shipment")
        )
    
    return result


@router.get("/shipping/countries")
async def get_supported_countries():
    """
    Get list of countries supported for international shipping.
    Returns country names with their ISO codes.
    """
    # Return popular destinations first, then alphabetically
    popular = [
        {"code": "US", "name": "United States"},
        {"code": "GB", "name": "United Kingdom"},
        {"code": "CA", "name": "Canada"},
        {"code": "AU", "name": "Australia"},
        {"code": "AE", "name": "United Arab Emirates"},
        {"code": "SG", "name": "Singapore"},
        {"code": "DE", "name": "Germany"},
        {"code": "FR", "name": "France"},
        {"code": "NL", "name": "Netherlands"},
        {"code": "SA", "name": "Saudi Arabia"},
    ]
    
    all_countries = [
        {"code": "AF", "name": "Afghanistan"},
        {"code": "AL", "name": "Albania"},
        {"code": "DZ", "name": "Algeria"},
        {"code": "AR", "name": "Argentina"},
        {"code": "AT", "name": "Austria"},
        {"code": "AU", "name": "Australia"},
        {"code": "AE", "name": "United Arab Emirates"},
        {"code": "BD", "name": "Bangladesh"},
        {"code": "BE", "name": "Belgium"},
        {"code": "BR", "name": "Brazil"},
        {"code": "CA", "name": "Canada"},
        {"code": "CH", "name": "Switzerland"},
        {"code": "CL", "name": "Chile"},
        {"code": "CN", "name": "China"},
        {"code": "CO", "name": "Colombia"},
        {"code": "CZ", "name": "Czech Republic"},
        {"code": "DE", "name": "Germany"},
        {"code": "DK", "name": "Denmark"},
        {"code": "EG", "name": "Egypt"},
        {"code": "ES", "name": "Spain"},
        {"code": "FI", "name": "Finland"},
        {"code": "FR", "name": "France"},
        {"code": "GB", "name": "United Kingdom"},
        {"code": "GR", "name": "Greece"},
        {"code": "HK", "name": "Hong Kong"},
        {"code": "HU", "name": "Hungary"},
        {"code": "ID", "name": "Indonesia"},
        {"code": "IE", "name": "Ireland"},
        {"code": "IL", "name": "Israel"},
        {"code": "IT", "name": "Italy"},
        {"code": "JP", "name": "Japan"},
        {"code": "KE", "name": "Kenya"},
        {"code": "KR", "name": "South Korea"},
        {"code": "KW", "name": "Kuwait"},
        {"code": "LK", "name": "Sri Lanka"},
        {"code": "MA", "name": "Morocco"},
        {"code": "MX", "name": "Mexico"},
        {"code": "MY", "name": "Malaysia"},
        {"code": "NG", "name": "Nigeria"},
        {"code": "NL", "name": "Netherlands"},
        {"code": "NO", "name": "Norway"},
        {"code": "NP", "name": "Nepal"},
        {"code": "NZ", "name": "New Zealand"},
        {"code": "OM", "name": "Oman"},
        {"code": "PE", "name": "Peru"},
        {"code": "PH", "name": "Philippines"},
        {"code": "PK", "name": "Pakistan"},
        {"code": "PL", "name": "Poland"},
        {"code": "PT", "name": "Portugal"},
        {"code": "QA", "name": "Qatar"},
        {"code": "RU", "name": "Russia"},
        {"code": "SA", "name": "Saudi Arabia"},
        {"code": "SE", "name": "Sweden"},
        {"code": "SG", "name": "Singapore"},
        {"code": "TH", "name": "Thailand"},
        {"code": "TR", "name": "Turkey"},
        {"code": "TW", "name": "Taiwan"},
        {"code": "UA", "name": "Ukraine"},
        {"code": "US", "name": "United States"},
        {"code": "VN", "name": "Vietnam"},
        {"code": "ZA", "name": "South Africa"},
    ]
    
    return {
        "popular": popular,
        "all": sorted(all_countries, key=lambda x: x["name"]),
        "notice": "International shipping is currently unavailable. Coming soon!"
    }


# ============================================================================
# ShipRocket Webhook Endpoint for Real-time Shipping Updates
# ============================================================================

class ShipRocketWebhookPayload(BaseModel):
    """Model for ShipRocket webhook payload"""
    awb: Optional[str] = None
    courier_name: Optional[str] = None
    current_status: Optional[str] = None
    current_status_id: Optional[int] = None
    shipment_status: Optional[str] = None
    shipment_status_id: Optional[int] = None
    order_id: Optional[str] = None
    etd: Optional[str] = None
    scans: Optional[List[dict]] = None
    current_timestamp: Optional[str] = None
    

@router.post("/shipping/webhook/tracking-updates")
async def shiprocket_webhook(
    request: Request,
    x_shiprocket_signature: Optional[str] = Header(None, alias="X-Shiprocket-Signature")
):
    """
    Webhook endpoint for real-time shipping updates.
    
    This endpoint receives shipping status updates and can:
    - Update order status in database
    - Send push/email notifications to customers
    - Trigger review request emails when delivered
    
    Configuration:
    - URL: https://your-domain.com/api/shipping/webhook/tracking-updates
    - Token: (use SHIPROCKET_WEBHOOK_TOKEN from env)
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        body_str = body.decode('utf-8')
        
        # Verify webhook token/signature (skip if not configured)
        provided_token = request.headers.get("X-Webhook-Token") or x_shiprocket_signature
        
        if SHIPROCKET_WEBHOOK_TOKEN and provided_token and provided_token != SHIPROCKET_WEBHOOK_TOKEN:
            logger.warning("Invalid webhook token received")
            raise HTTPException(status_code=401, detail="Invalid webhook token")
        
        # Parse the webhook payload
        import json
        try:
            payload = json.loads(body_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
        # Extract key information
        awb = payload.get("awb")
        order_id = payload.get("order_id")
        current_status = payload.get("current_status") or payload.get("shipment_status")
        current_status_id = payload.get("current_status_id") or payload.get("shipment_status_id")
        courier_name = payload.get("courier_name")
        etd = payload.get("etd")
        scans = payload.get("scans", [])
        
        logger.info(f"ShipRocket Webhook: AWB={awb}, Order={order_id}, Status={current_status} ({current_status_id})")
        
        # Status ID mapping (ShipRocket status codes):
        # 1 = AWB Assigned
        # 2 = Label Generated  
        # 3 = Pickup Scheduled
        # 4 = Pickup Queued
        # 5 = Manifest Generated
        # 6 = Shipped
        # 7 = Delivered
        # 8 = Cancelled
        # 9 = RTO Initiated
        # 10 = RTO Delivered
        # 17 = Out For Delivery
        # 18 = In Transit
        # 19 = Lost
        # 20 = Pickup Error
        # 38 = Reached at Destination
        
        # Map ShipRocket status to our order status
        status_mapping = {
            1: "processing",      # AWB Assigned
            2: "processing",      # Label Generated
            3: "processing",      # Pickup Scheduled
            4: "processing",      # Pickup Queued
            5: "processing",      # Manifest Generated
            6: "shipped",         # Shipped
            7: "delivered",       # Delivered
            8: "cancelled",       # Cancelled
            9: "rto",             # RTO Initiated
            10: "rto_delivered",  # RTO Delivered
            17: "out_for_delivery",  # Out For Delivery
            18: "in_transit",     # In Transit
            19: "lost",           # Lost
            20: "pickup_failed",  # Pickup Error
            38: "in_transit",     # Reached at Destination
        }
        
        new_status = status_mapping.get(current_status_id, "processing")
        
        # TODO: Update order in database based on order_id or AWB
        # This would require finding the order by shiprocket_order_id or awb_code
        # and updating its status
        
        # If status is "delivered" (status_id = 7), trigger review email scheduling
        if current_status_id == 7:
            logger.info(f"Order {order_id} delivered! Scheduling review request email for 3 days later.")
            # Import and schedule the review email
            try:
                from services.scheduler_service import schedule_review_email
                # We need to fetch the order data from database using order_id
                # For now, create a minimal order object for the email
                order_data = {
                    "orderNumber": order_id,
                    "shipping": {},  # Will be populated when we integrate with order lookup
                    "items": [],
                    "awb": awb,
                    "courier": courier_name
                }
                await schedule_review_email(order_data)
            except Exception as e:
                logger.error(f"Failed to schedule review email: {str(e)}")
        
        # Log the update
        webhook_log = {
            "timestamp": datetime.now().isoformat(),
            "awb": awb,
            "order_id": order_id,
            "shiprocket_status": current_status,
            "shiprocket_status_id": current_status_id,
            "mapped_status": new_status,
            "courier": courier_name,
            "etd": etd,
            "latest_scan": scans[-1] if scans else None
        }
        
        logger.info(f"Webhook processed: {webhook_log}")
        
        return {
            "success": True,
            "message": "Webhook received and processed",
            "awb": awb,
            "order_id": order_id,
            "status_received": current_status,
            "mapped_status": new_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.get("/shipping/webhook/test")
async def test_webhook_endpoint():
    """
    Test endpoint to verify webhook URL is accessible.
    Use this to confirm the webhook endpoint is live before configuring in ShipRocket.
    """
    return {
        "status": "active",
        "message": "ShipRocket webhook endpoint is ready",
        "webhook_url": "/api/shipping/webhook/tracking-updates",
        "token_configured": bool(SHIPROCKET_WEBHOOK_TOKEN),
        "timestamp": datetime.now().isoformat()
    }
