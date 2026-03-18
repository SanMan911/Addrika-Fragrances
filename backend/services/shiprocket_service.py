"""
ShipRocket API Integration Service
Real-time shipping rates, order creation, and tracking for international delivery
"""
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

# ShipRocket API Configuration
SHIPROCKET_EMAIL = os.environ.get('SHIPROCKET_EMAIL')
SHIPROCKET_PASSWORD = os.environ.get('SHIPROCKET_PASSWORD')
SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external"

# Token cache
_token_cache = {
    "token": None,
    "expiry": None
}


async def get_shiprocket_token() -> Optional[str]:
    """
    Get or generate ShipRocket authentication token.
    Tokens are valid for 24 hours, we refresh at 20 hours for safety.
    """
    global _token_cache
    
    if not SHIPROCKET_EMAIL or not SHIPROCKET_PASSWORD:
        logger.warning("ShipRocket credentials not configured")
        return None
    
    # Check if cached token is still valid
    if _token_cache["token"] and _token_cache["expiry"]:
        if datetime.now() < _token_cache["expiry"]:
            return _token_cache["token"]
    
    # Generate new token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHIPROCKET_BASE_URL}/auth/login",
                json={
                    "email": SHIPROCKET_EMAIL,
                    "password": SHIPROCKET_PASSWORD
                },
                timeout=30.0
            )
            response.raise_for_status()
            
            data = response.json()
            token = data.get("token")
            
            if token:
                _token_cache["token"] = token
                _token_cache["expiry"] = datetime.now() + timedelta(hours=20)
                logger.info("ShipRocket token generated successfully")
                return token
            else:
                logger.error("No token in ShipRocket response")
                return None
                
        except httpx.HTTPError as e:
            logger.error(f"ShipRocket auth failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"ShipRocket auth error: {str(e)}")
            return None


def get_auth_headers(token: str) -> dict:
    """Get authorization headers for ShipRocket API requests"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }


async def get_domestic_shipping_rates(
    pickup_postcode: str,
    delivery_postcode: str,
    weight: float,
    length: Optional[float] = None,
    breadth: Optional[float] = None,
    height: Optional[float] = None,
    cod: bool = False
) -> Dict[str, Any]:
    """
    Get real-time domestic shipping rates from ShipRocket.
    
    Args:
        pickup_postcode: Origin pincode (6 digits)
        delivery_postcode: Destination pincode (6 digits)
        weight: Package weight in kg
        length, breadth, height: Package dimensions in cm (optional)
        cod: Whether it's Cash on Delivery
    
    Returns:
        Dict with available couriers and rates
    """
    token = await get_shiprocket_token()
    if not token:
        return {
            "success": False,
            "error": "ShipRocket not configured",
            "couriers": []
        }
    
    headers = get_auth_headers(token)
    
    params = {
        "pickup_postcode": pickup_postcode,
        "delivery_postcode": delivery_postcode,
        "weight": weight,
        "cod": 1 if cod else 0
    }
    
    # Add dimensions if provided
    if length and breadth and height:
        params["length"] = length
        params["breadth"] = breadth
        params["height"] = height
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SHIPROCKET_BASE_URL}/courier/serviceability/",
                params=params,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") == 200 or data.get("status") is True:
                courier_data = data.get("data", {})
                available_couriers = courier_data.get("available_courier_companies", [])
                
                # Format courier options
                couriers = []
                for courier in available_couriers:
                    couriers.append({
                        "courier_id": courier.get("courier_company_id"),
                        "courier_name": courier.get("courier_name"),
                        "rate": float(courier.get("rate", 0)),
                        "etd": courier.get("etd", "3-5 days"),
                        "estimated_delivery_days": courier.get("estimated_delivery_days", 5),
                        "cod_charges": float(courier.get("cod_charges", 0)),
                        "freight_charge": float(courier.get("freight_charge", 0)),
                        "is_surface": courier.get("is_surface", False),
                        "min_weight": courier.get("min_weight", 0.5)
                    })
                
                # Sort by rate (cheapest first)
                couriers.sort(key=lambda x: x["rate"])
                
                return {
                    "success": True,
                    "couriers": couriers,
                    "recommended": couriers[0] if couriers else None,
                    "currency": "INR"
                }
            else:
                return {
                    "success": False,
                    "error": data.get("message", "No couriers available"),
                    "couriers": []
                }
                
        except httpx.HTTPError as e:
            logger.error(f"ShipRocket rate fetch failed: {str(e)}")
            return {
                "success": False,
                "error": f"API error: {str(e)}",
                "couriers": []
            }
        except Exception as e:
            logger.error(f"ShipRocket rate error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "couriers": []
            }


async def get_international_shipping_rates(
    pickup_postcode: str,
    delivery_country: str,
    weight: float,
    length: Optional[float] = None,
    breadth: Optional[float] = None,
    height: Optional[float] = None
) -> Dict[str, Any]:
    """
    Get real-time international shipping rates from ShipRocket X.
    
    Args:
        pickup_postcode: Origin pincode in India (6 digits)
        delivery_country: Destination country code (2-letter ISO code, e.g., 'US', 'UK')
        weight: Package weight in kg
        length, breadth, height: Package dimensions in cm (optional)
    
    Returns:
        Dict with available international couriers and rates
    """
    token = await get_shiprocket_token()
    if not token:
        return {
            "success": False,
            "error": "ShipRocket not configured",
            "couriers": []
        }
    
    headers = get_auth_headers(token)
    
    payload = {
        "pickup_postcode": int(pickup_postcode),
        "delivery_country": delivery_country.upper(),
        "weight": weight
    }
    
    if length and breadth and height:
        payload["length"] = length
        payload["breadth"] = breadth
        payload["height"] = height
    
    async with httpx.AsyncClient() as client:
        try:
            # Try the international rates endpoint
            response = await client.get(
                f"{SHIPROCKET_BASE_URL}/courier/international/serviceability",
                params=payload,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") == 200 or data.get("data"):
                courier_data = data.get("data", {})
                available_couriers = courier_data.get("available_courier_companies", [])
                
                if not available_couriers:
                    # Fallback: Try alternate endpoint format
                    available_couriers = data.get("data", [])
                
                couriers = []
                for courier in available_couriers:
                    couriers.append({
                        "courier_id": courier.get("courier_company_id") or courier.get("courier_id"),
                        "courier_name": courier.get("courier_name"),
                        "rate": float(courier.get("rate", 0)),
                        "etd": courier.get("etd", "7-14 days"),
                        "estimated_delivery_days": courier.get("estimated_delivery_days", 14),
                        "freight_charge": float(courier.get("freight_charge", 0)),
                        "service_type": courier.get("service_type", "standard")
                    })
                
                couriers.sort(key=lambda x: x["rate"])
                
                return {
                    "success": True,
                    "couriers": couriers,
                    "recommended": couriers[0] if couriers else None,
                    "currency": "INR",
                    "is_international": True
                }
            else:
                return {
                    "success": False,
                    "error": data.get("message", "International shipping not available"),
                    "couriers": []
                }
                
        except httpx.HTTPError as e:
            logger.error(f"ShipRocket international rate fetch failed: {str(e)}")
            return {
                "success": False,
                "error": f"API error: {str(e)}",
                "couriers": []
            }
        except Exception as e:
            logger.error(f"ShipRocket international rate error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "couriers": []
            }


async def check_pincode_serviceability(pincode: str) -> Dict[str, Any]:
    """
    Check if a pincode is serviceable for delivery.
    
    Args:
        pincode: Indian pincode to check (6 digits)
    
    Returns:
        Dict with serviceability status
    """
    token = await get_shiprocket_token()
    if not token:
        return {
            "success": False,
            "serviceable": True,  # Default to serviceable if API not configured
            "error": "ShipRocket not configured"
        }
    
    headers = get_auth_headers(token)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SHIPROCKET_BASE_URL}/open/postcode/details",
                params={"postcode": pincode},
                headers=headers,
                timeout=15.0
            )
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("success") or data.get("postcode_details"):
                details = data.get("postcode_details", {})
                return {
                    "success": True,
                    "serviceable": True,
                    "city": details.get("city"),
                    "state": details.get("state"),
                    "cod_available": details.get("cod", True)
                }
            else:
                return {
                    "success": True,
                    "serviceable": False,
                    "error": "Pincode not serviceable"
                }
                
        except Exception as e:
            logger.error(f"Pincode check failed: {str(e)}")
            return {
                "success": False,
                "serviceable": True,  # Default to serviceable on error
                "error": str(e)
            }


def clean_phone_number(phone: str) -> str:
    """
    Clean phone number for ShipRocket API.
    ShipRocket requires E.164 format with country code (e.g., +919876543210).
    For Indian numbers, we ensure it starts with 91.
    """
    if not phone:
        return ""
    
    # Remove any non-digit characters except leading +
    clean = phone.strip()
    if clean.startswith('+'):
        digits = ''.join(c for c in clean[1:] if c.isdigit())
    else:
        digits = ''.join(c for c in clean if c.isdigit())
    
    # Handle different formats
    if len(digits) == 10:
        # Indian number without country code, add 91
        return digits
    elif len(digits) == 12 and digits.startswith('91'):
        # Already has 91 prefix, return 10 digits
        return digits[2:]
    elif len(digits) == 11 and digits.startswith('0'):
        # Starts with 0, remove it
        return digits[1:]
    elif len(digits) > 10:
        # Take last 10 digits
        return digits[-10:]
    
    return digits


async def create_shiprocket_order(order_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create an order in ShipRocket for fulfillment.
    
    Args:
        order_data: Dict containing order details
    
    Returns:
        Dict with ShipRocket order/shipment IDs
    """
    token = await get_shiprocket_token()
    if not token:
        return {
            "success": False,
            "error": "ShipRocket not configured"
        }
    
    headers = get_auth_headers(token)
    
    # Import products to validate prices
    try:
        from routers.products import PRODUCTS
    except ImportError:
        PRODUCTS = []
    
    # Format order items with validated prices
    order_items = []
    for item in order_data.get("items", []):
        # Generate SKU from product name and size if not provided
        name = item.get("name", "Product")
        size = item.get("size", "")
        sku = item.get("productId") or item.get("sku") or f"ADD-{name[:3].upper()}-{size}".replace(" ", "")
        
        # Get the correct price from products catalog
        item_price = float(item.get("price", 0))
        product_id = item.get("productId", "")
        
        # Validate price against product catalog
        if PRODUCTS and product_id:
            product = next((p for p in PRODUCTS if p["id"] == product_id), None)
            if product:
                size_variant = next((s for s in product.get("sizes", []) if s["size"] == size), None)
                if size_variant:
                    catalog_price = float(size_variant.get("price", 0))
                    if catalog_price > 0 and catalog_price != item_price:
                        logger.warning(f"Price mismatch for {name} ({size}): order has ₹{item_price}, catalog has ₹{catalog_price}. Using catalog price.")
                        item_price = catalog_price
        
        order_items.append({
            "name": f"{name} ({size})" if size else name,
            "sku": sku,
            "units": item.get("quantity", 1),
            "selling_price": item_price,
            "discount": 0,
            "tax": 0,
            "hsn": "33074100"  # HSN code for incense/agarbatti
        })
    
    shipping = order_data.get("shipping", {})
    billing = order_data.get("billing", shipping)
    
    # Clean phone numbers
    billing_phone = clean_phone_number(billing.get("phone", ""))
    shipping_phone = clean_phone_number(shipping.get("phone", billing.get("phone", "")))
    
    # Ensure we have valid phone number (required by ShipRocket)
    if not billing_phone and not shipping_phone:
        return {
            "success": False,
            "error": "Phone number is required for ShipRocket order"
        }
    
    # Calculate subtotal if not provided
    subtotal = order_data.get("subtotal", 0)
    if not subtotal:
        subtotal = sum(
            float(item.get("price", 0)) * int(item.get("quantity", 1))
            for item in order_data.get("items", [])
        )
    
    # Determine pickup location based on zone or override
    pickup_location_name = "Primary"  # Default
    
    # Check for pickup location override
    pickup_override = order_data.get("pickup_location_override")
    if pickup_override:
        pickup_location_name = pickup_override.get("shiprocket_location", "Primary")
        logger.info(f"Using overridden pickup location: {pickup_location_name}")
    else:
        # Auto-select based on delivery zone
        try:
            from services.shipping_config import get_pickup_location_for_delivery
            delivery_pincode = shipping.get("pincode", "") or billing.get("pincode", "")
            delivery_state = shipping.get("state", "") or billing.get("state", "")
            
            auto_pickup = get_pickup_location_for_delivery(delivery_pincode, delivery_state)
            pickup_location_name = auto_pickup.get("shiprocket_location", "Primary")
            logger.info(f"Auto-selected pickup location: {pickup_location_name} for delivery to {delivery_pincode}")
        except Exception as e:
            logger.warning(f"Failed to auto-select pickup location: {e}, using Primary")
            pickup_location_name = "Primary"
    
    payload = {
        "order_id": order_data.get("order_number"),
        "order_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "pickup_location": pickup_location_name,
        "channel_id": "",
        "comment": "Order from Addrika website",
        "billing_customer_name": billing.get("name", "Customer"),
        "billing_last_name": "",
        "billing_address": billing.get("address", "") or "Address",
        "billing_address_2": billing.get("landmark", "") or "",
        "billing_city": billing.get("city", "") or "Delhi",
        "billing_pincode": billing.get("pincode", "") or "110001",
        "billing_state": billing.get("state", "") or "Delhi",
        "billing_country": "India",
        "billing_email": billing.get("email", "") or "noreply@centraders.com",
        "billing_phone": billing_phone or shipping_phone,
        "shipping_is_billing": order_data.get("shipping_is_billing", True),
        "shipping_customer_name": shipping.get("name", "") or billing.get("name", "Customer"),
        "shipping_last_name": "",
        "shipping_address": shipping.get("address", "") or billing.get("address", "") or "Address",
        "shipping_address_2": shipping.get("landmark", "") or billing.get("landmark", "") or "",
        "shipping_city": shipping.get("city", "") or billing.get("city", "") or "Delhi",
        "shipping_pincode": shipping.get("pincode", "") or billing.get("pincode", "") or "110001",
        "shipping_state": shipping.get("state", "") or billing.get("state", "") or "Delhi",
        "shipping_country": "India",
        "shipping_email": shipping.get("email", "") or billing.get("email", "") or "noreply@centraders.com",
        "shipping_phone": shipping_phone or billing_phone,
        "order_items": order_items,
        "payment_method": "Prepaid",  # Since we use Razorpay
        "shipping_charges": float(order_data.get("shipping_charges", 0)),
        "giftwrap_charges": 0,
        "transaction_charges": 0,
        "total_discount": float(order_data.get("discount", 0)),
        "sub_total": float(subtotal),
        "length": int(order_data.get("length", 20)),
        "breadth": int(order_data.get("breadth", 15)),
        "height": int(order_data.get("height", 10)),
        "weight": float(order_data.get("weight", 0.25))  # Default weight for incense
    }
    
    logger.info(f"Creating ShipRocket order: {order_data.get('order_number')}")
    logger.info(f"ShipRocket payload phones - billing: {payload.get('billing_phone')}, shipping: {payload.get('shipping_phone')}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHIPROCKET_BASE_URL}/orders/create/adhoc",
                json=payload,
                headers=headers,
                timeout=30.0
            )
            
            data = response.json()
            
            # Check for error responses
            if response.status_code >= 400:
                error_msg = data.get("message") or data.get("errors") or f"HTTP {response.status_code}"
                logger.error(f"ShipRocket order creation failed: {error_msg}, Response: {data}")
                return {
                    "success": False,
                    "error": str(error_msg),
                    "details": data
                }
            
            if data.get("order_id") or data.get("shipment_id"):
                logger.info(f"ShipRocket order created successfully: order_id={data.get('order_id')}, shipment_id={data.get('shipment_id')}")
                return {
                    "success": True,
                    "order_id": data.get("order_id"),
                    "shipment_id": data.get("shipment_id"),
                    "awb_code": data.get("awb_code"),
                    "courier_name": data.get("courier_name"),
                    "message": "Order created in ShipRocket"
                }
            else:
                return {
                    "success": False,
                    "error": data.get("message", "Failed to create order - no order_id returned"),
                    "details": data
                }
                
        except httpx.HTTPStatusError as e:
            error_detail = ""
            try:
                error_detail = e.response.json()
            except Exception:
                error_detail = e.response.text[:500] if e.response.text else ""
            logger.error(f"ShipRocket order creation failed: {str(e)}, Details: {error_detail}")
            return {
                "success": False,
                "error": f"API error: {str(e)}",
                "details": error_detail
            }
        except httpx.HTTPError as e:
            logger.error(f"ShipRocket order creation failed: {str(e)}")
            return {
                "success": False,
                "error": f"API error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"ShipRocket order error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


async def track_shipment(awb_number: str) -> Dict[str, Any]:
    """
    Track a shipment using its AWB number.
    
    Args:
        awb_number: Air Waybill number from the courier
    
    Returns:
        Dict with tracking status and history
    """
    token = await get_shiprocket_token()
    if not token:
        return {
            "success": False,
            "error": "ShipRocket not configured"
        }
    
    headers = get_auth_headers(token)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SHIPROCKET_BASE_URL}/courier/track/awb/{awb_number}",
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            
            data = response.json()
            
            tracking_data = data.get("tracking_data", {})
            
            return {
                "success": True,
                "awb_number": awb_number,
                "current_status": tracking_data.get("shipment_status"),
                "current_status_id": tracking_data.get("shipment_status_id"),
                "track_url": tracking_data.get("track_url"),
                "etd": tracking_data.get("etd"),
                "shipment_track": tracking_data.get("shipment_track", []),
                "shipment_track_activities": tracking_data.get("shipment_track_activities", [])
            }
                
        except httpx.HTTPError as e:
            logger.error(f"ShipRocket tracking failed: {str(e)}")
            return {
                "success": False,
                "error": f"API error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"ShipRocket tracking error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Country code mapping for international shipping
COUNTRY_CODES = {
    "united states": "US",
    "usa": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "canada": "CA",
    "australia": "AU",
    "germany": "DE",
    "france": "FR",
    "italy": "IT",
    "spain": "ES",
    "netherlands": "NL",
    "belgium": "BE",
    "switzerland": "CH",
    "austria": "AT",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "finland": "FI",
    "ireland": "IE",
    "portugal": "PT",
    "poland": "PL",
    "czech republic": "CZ",
    "hungary": "HU",
    "greece": "GR",
    "uae": "AE",
    "united arab emirates": "AE",
    "dubai": "AE",
    "saudi arabia": "SA",
    "qatar": "QA",
    "kuwait": "KW",
    "bahrain": "BH",
    "oman": "OM",
    "singapore": "SG",
    "malaysia": "MY",
    "thailand": "TH",
    "indonesia": "ID",
    "philippines": "PH",
    "vietnam": "VN",
    "japan": "JP",
    "south korea": "KR",
    "korea": "KR",
    "china": "CN",
    "hong kong": "HK",
    "taiwan": "TW",
    "new zealand": "NZ",
    "south africa": "ZA",
    "brazil": "BR",
    "mexico": "MX",
    "argentina": "AR",
    "chile": "CL",
    "colombia": "CO",
    "peru": "PE",
    "egypt": "EG",
    "nigeria": "NG",
    "kenya": "KE",
    "morocco": "MA",
    "israel": "IL",
    "turkey": "TR",
    "russia": "RU",
    "ukraine": "UA",
    "india": "IN"
}


def get_country_code(country_name: str) -> Optional[str]:
    """Convert country name to ISO 2-letter code"""
    if not country_name:
        return None
    
    # Check if already a 2-letter code
    if len(country_name) == 2:
        return country_name.upper()
    
    # Lookup in mapping
    return COUNTRY_CODES.get(country_name.lower().strip())
