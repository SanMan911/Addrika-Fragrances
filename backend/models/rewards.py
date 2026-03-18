"""
Rewards/Loyalty System Models
Coin earning, redemption, and expiry tracking
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta
import uuid

# Import configuration from centralized config
from config.rewards_config import (
    COINS_PER_125_RUPEES, MINIMUM_SPEND_FOR_COINS, COIN_REDEMPTION_VALUE,
    MINIMUM_COINS_TO_REDEEM, MAX_REDEMPTION_PERCENTAGE, COINS_VALIDITY_DAYS, EXPIRY_REMINDER_DAYS
)


# ===================== Base Config for JSON Encoding =====================
class BaseModelWithConfig(BaseModel):
    """Base model with datetime JSON encoding"""
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


# ===================== User Rewards Models =====================

class UserRewards(BaseModelWithConfig):
    """User rewards/coins balance and history"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email: EmailStr
    coins_balance: float = 0.0
    total_coins_earned: float = 0.0
    total_coins_redeemed: float = 0.0
    total_coins_expired: float = 0.0
    last_purchase_date: Optional[datetime] = None
    coins_expiry_date: Optional[datetime] = None
    expiry_reminder_sent: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CoinTransaction(BaseModelWithConfig):
    """Record of coin earn/redeem/expire transactions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email: EmailStr
    transaction_type: Literal['earned', 'redeemed', 'expired', 'adjusted']
    coins_amount: float
    coins_balance_after: float
    order_number: Optional[str] = None
    order_amount: Optional[float] = None
    redemption_value: Optional[float] = None
    qualifying_amount: Optional[float] = None
    coins_rate: Optional[float] = None
    adjusted_by: Optional[str] = None
    adjustment_reason: Optional[str] = None
    expired_batch_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CoinRedemptionRequest(BaseModel):
    """Request to redeem coins at checkout"""
    coins_to_redeem: float = Field(..., gt=0)


class CoinRedemptionValidation(BaseModel):
    """Validation result for coin redemption"""
    is_valid: bool
    coins_requested: float
    coins_available: float
    max_redeemable_coins: float
    redemption_value: float
    error_message: Optional[str] = None


# ===================== Store Pickup OTP Models =====================

class StorePickupOTP(BaseModelWithConfig):
    """OTP for store pickup verification"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    otp_code: str
    customer_email: EmailStr
    customer_phone: str
    retailer_id: str
    retailer_name: str
    status: Literal['pending', 'verified', 'expired'] = 'pending'
    verified_at: Optional[datetime] = None
    verified_by_retailer_id: Optional[str] = None
    balance_amount: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))


# ===================== Helper Functions =====================

def calculate_coins_earned(amount_paid: float, shipping_charge: float = 0, coins_used_value: float = 0) -> dict:
    """
    Calculate coins earned from a purchase.
    
    Rules:
    - 6.9 coins per ₹125 spent
    - Pro-rata calculation (rounded to 2 decimal places)
    - Minimum spend of ₹125 to earn any coins
    - Only count amount actually paid (excluding coins used and shipping)
    - No coins for ₹11 reserve price transactions
    """
    qualifying_amount = amount_paid - shipping_charge - coins_used_value
    
    if qualifying_amount < MINIMUM_SPEND_FOR_COINS:
        return {
            "coins_earned": 0,
            "qualifying_amount": round(qualifying_amount, 2),
            "reason": f"Minimum spend of ₹{MINIMUM_SPEND_FOR_COINS} required",
            "rate": COINS_PER_125_RUPEES
        }
    
    coins_earned = (qualifying_amount / 125) * COINS_PER_125_RUPEES
    coins_earned = round(coins_earned, 2)
    
    return {
        "coins_earned": coins_earned,
        "qualifying_amount": round(qualifying_amount, 2),
        "rate": COINS_PER_125_RUPEES,
        "calculation": f"({qualifying_amount:.2f} / 125) × {COINS_PER_125_RUPEES} = {coins_earned:.2f}"
    }


def calculate_max_redeemable_coins(cart_value: float, coins_balance: float) -> dict:
    """
    Calculate maximum coins that can be redeemed for an order.
    
    Rules:
    - Minimum 20 coins to redeem
    - Maximum 50% of cart value can be paid with coins
    - 1 coin = ₹0.60
    """
    if coins_balance < MINIMUM_COINS_TO_REDEEM:
        return {
            "can_redeem": False,
            "max_coins": 0,
            "max_value": 0,
            "reason": f"Minimum {MINIMUM_COINS_TO_REDEEM} coins required to redeem"
        }
    
    max_rupee_value = cart_value * (MAX_REDEMPTION_PERCENTAGE / 100)
    max_coins_by_value = max_rupee_value / COIN_REDEMPTION_VALUE
    max_redeemable = min(coins_balance, max_coins_by_value)
    max_redeemable = round(max_redeemable, 2)
    redemption_value = round(max_redeemable * COIN_REDEMPTION_VALUE, 2)
    
    return {
        "can_redeem": max_redeemable >= MINIMUM_COINS_TO_REDEEM,
        "max_coins": max_redeemable,
        "max_value": redemption_value,
        "coins_balance": coins_balance,
        "cart_value": cart_value,
        "max_percentage": MAX_REDEMPTION_PERCENTAGE,
        "coin_value": COIN_REDEMPTION_VALUE
    }


def calculate_coins_expiry_date(last_purchase_date: datetime) -> datetime:
    """Calculate when coins expire based on last purchase date."""
    return last_purchase_date + timedelta(days=COINS_VALIDITY_DAYS)


def should_send_expiry_reminder(expiry_date: datetime, reminder_already_sent: bool) -> bool:
    """Check if expiry reminder should be sent (7 days before expiry)."""
    if reminder_already_sent:
        return False
    
    now = datetime.now(timezone.utc)
    reminder_threshold = expiry_date - timedelta(days=EXPIRY_REMINDER_DAYS)
    
    return now >= reminder_threshold and now < expiry_date
