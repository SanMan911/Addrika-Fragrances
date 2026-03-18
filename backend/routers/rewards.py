"""
Rewards/Coins Router
Handles coin earning, redemption, and balance management
"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import logging

from dependencies import db, get_current_user
from config.rewards_config import (
    COINS_PER_125_RUPEES, MINIMUM_SPEND_FOR_COINS, COIN_REDEMPTION_VALUE,
    MINIMUM_COINS_TO_REDEEM, MAX_REDEMPTION_PERCENTAGE, COINS_VALIDITY_DAYS
)
from models.rewards import (
    CoinRedemptionRequest, CoinRedemptionValidation,
    calculate_coins_earned, calculate_max_redeemable_coins, calculate_coins_expiry_date
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rewards", tags=["Rewards"])


# ===================== Public Endpoints =====================

@router.get("/balance")
async def get_rewards_balance(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get current user's rewards/coins balance"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find or create rewards record
    rewards = await db.user_rewards.find_one({"user_id": user['user_id']}, {"_id": 0})
    
    if not rewards:
        # Create new rewards record for user
        rewards = {
            "user_id": user['user_id'],
            "email": user['email'],
            "coins_balance": 0.0,
            "total_coins_earned": 0.0,
            "total_coins_redeemed": 0.0,
            "total_coins_expired": 0.0,
            "last_purchase_date": None,
            "coins_expiry_date": None,
            "expiry_reminder_sent": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_rewards.insert_one(rewards)
        if "_id" in rewards:
            del rewards["_id"]
    
    # Calculate days until expiry
    days_until_expiry = None
    if rewards.get('coins_expiry_date') and rewards.get('coins_balance', 0) > 0:
        expiry_date = rewards['coins_expiry_date']
        if isinstance(expiry_date, str):
            expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        if expiry_date > now:
            days_until_expiry = (expiry_date - now).days
    
    return {
        "balance": {
            "coins": round(rewards.get('coins_balance', 0), 2),
            "value": round(rewards.get('coins_balance', 0) * COIN_REDEMPTION_VALUE, 2),
            "currency_value_per_coin": COIN_REDEMPTION_VALUE
        },
        "stats": {
            "total_earned": round(rewards.get('total_coins_earned', 0), 2),
            "total_redeemed": round(rewards.get('total_coins_redeemed', 0), 2),
            "total_expired": round(rewards.get('total_coins_expired', 0), 2)
        },
        "expiry": {
            "last_purchase_date": rewards.get('last_purchase_date'),
            "expiry_date": rewards.get('coins_expiry_date'),
            "days_until_expiry": days_until_expiry,
            "validity_days": COINS_VALIDITY_DAYS
        },
        "rules": {
            "earn_rate": f"{COINS_PER_125_RUPEES} coins per ₹125 spent",
            "minimum_spend": MINIMUM_SPEND_FOR_COINS,
            "redemption_value": f"₹{COIN_REDEMPTION_VALUE} per coin",
            "minimum_to_redeem": MINIMUM_COINS_TO_REDEEM,
            "max_redemption_percent": MAX_REDEMPTION_PERCENTAGE
        }
    }


@router.get("/history")
async def get_rewards_history(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    page: int = 1,
    limit: int = 20
):
    """Get user's coin transaction history"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    skip = (page - 1) * limit
    
    # Get transactions
    transactions = await db.coin_transactions.find(
        {"user_id": user['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total_count = await db.coin_transactions.count_documents({"user_id": user['user_id']})
    
    return {
        "transactions": transactions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": (total_count + limit - 1) // limit
        }
    }


@router.post("/validate-redemption")
async def validate_coin_redemption(
    redemption: CoinRedemptionRequest,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Validate if user can redeem specified number of coins.
    Called during checkout to validate redemption.
    """
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's rewards balance
    rewards = await db.user_rewards.find_one({"user_id": user['user_id']}, {"_id": 0})
    
    if not rewards:
        return CoinRedemptionValidation(
            is_valid=False,
            coins_requested=redemption.coins_to_redeem,
            coins_available=0,
            max_redeemable_coins=0,
            redemption_value=0,
            error_message="No rewards account found"
        )
    
    coins_balance = rewards.get('coins_balance', 0)
    
    # Check minimum coins
    if coins_balance < MINIMUM_COINS_TO_REDEEM:
        return CoinRedemptionValidation(
            is_valid=False,
            coins_requested=redemption.coins_to_redeem,
            coins_available=coins_balance,
            max_redeemable_coins=0,
            redemption_value=0,
            error_message=f"Minimum {MINIMUM_COINS_TO_REDEEM} coins required to redeem"
        )
    
    # Check if requested amount exceeds balance
    if redemption.coins_to_redeem > coins_balance:
        return CoinRedemptionValidation(
            is_valid=False,
            coins_requested=redemption.coins_to_redeem,
            coins_available=coins_balance,
            max_redeemable_coins=coins_balance,
            redemption_value=round(coins_balance * COIN_REDEMPTION_VALUE, 2),
            error_message=f"Requested {redemption.coins_to_redeem} coins but only {coins_balance} available"
        )
    
    # Check expiry
    if rewards.get('coins_expiry_date'):
        expiry_date = rewards['coins_expiry_date']
        if isinstance(expiry_date, str):
            expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        if expiry_date < datetime.now(timezone.utc):
            return CoinRedemptionValidation(
                is_valid=False,
                coins_requested=redemption.coins_to_redeem,
                coins_available=0,
                max_redeemable_coins=0,
                redemption_value=0,
                error_message="Your coins have expired. Make a purchase to earn new coins."
            )
    
    # Valid redemption
    redemption_value = round(redemption.coins_to_redeem * COIN_REDEMPTION_VALUE, 2)
    
    return CoinRedemptionValidation(
        is_valid=True,
        coins_requested=redemption.coins_to_redeem,
        coins_available=coins_balance,
        max_redeemable_coins=coins_balance,
        redemption_value=redemption_value,
        error_message=None
    )


class CartRedemptionCheck(BaseModel):
    """Request model for checking max redemption for a cart"""
    cart_value: float = Field(..., gt=0)


@router.post("/max-redemption")
async def get_max_redemption_for_cart(
    cart_data: CartRedemptionCheck,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """
    Calculate maximum coins that can be redeemed for a given cart value.
    Used in checkout to show user their redemption options.
    """
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's rewards balance
    rewards = await db.user_rewards.find_one({"user_id": user['user_id']}, {"_id": 0})
    coins_balance = rewards.get('coins_balance', 0) if rewards else 0
    
    # Check expiry
    if rewards and rewards.get('coins_expiry_date'):
        expiry_date = rewards['coins_expiry_date']
        if isinstance(expiry_date, str):
            expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        if expiry_date < datetime.now(timezone.utc):
            coins_balance = 0  # Expired coins
    
    # Calculate max redeemable
    result = calculate_max_redeemable_coins(cart_data.cart_value, coins_balance)
    
    return {
        "can_redeem": result['can_redeem'],
        "coins_balance": round(coins_balance, 2),
        "max_redeemable_coins": result['max_coins'],
        "max_redemption_value": result['max_value'],
        "cart_value": cart_data.cart_value,
        "max_percentage_allowed": MAX_REDEMPTION_PERCENTAGE,
        "coin_value": COIN_REDEMPTION_VALUE,
        "minimum_to_redeem": MINIMUM_COINS_TO_REDEEM,
        "message": result.get('reason') if not result['can_redeem'] else None
    }


@router.get("/info")
async def get_rewards_program_info():
    """Get information about the rewards program (public endpoint)"""
    return {
        "program_name": "Addrika Rewards",
        "earning": {
            "rate": COINS_PER_125_RUPEES,
            "per_amount": 125,
            "description": f"Earn {COINS_PER_125_RUPEES} coins for every ₹125 spent",
            "minimum_spend": MINIMUM_SPEND_FOR_COINS,
            "exclusions": [
                "Shipping charges",
                "₹11 reserve price (store pickup token)",
                "Amount paid using coins"
            ]
        },
        "redemption": {
            "coin_value": COIN_REDEMPTION_VALUE,
            "minimum_coins": MINIMUM_COINS_TO_REDEEM,
            "max_percentage": MAX_REDEMPTION_PERCENTAGE,
            "description": f"Redeem coins at ₹{COIN_REDEMPTION_VALUE} per coin (max {MAX_REDEMPTION_PERCENTAGE}% of cart)"
        },
        "validity": {
            "days": COINS_VALIDITY_DAYS,
            "description": f"Coins are valid for {COINS_VALIDITY_DAYS} days from your last purchase",
            "reminder": "You'll receive a reminder email 7 days before expiry"
        }
    }


# ===================== Internal Functions (called from orders.py) =====================

async def credit_coins_for_order(
    user_id: str,
    email: str,
    order_number: str,
    amount_paid: float,
    shipping_charge: float = 0,
    coins_redeemed_value: float = 0,
    is_token_payment: bool = False
):
    """
    Credit coins to user after a successful order.
    Called from orders.py after payment verification.
    
    Args:
        user_id: User's ID
        email: User's email
        order_number: Order number for reference
        amount_paid: Total amount paid by customer
        shipping_charge: Shipping charges (excluded from coin calculation)
        coins_redeemed_value: Rupee value of coins used in this order (excluded)
        is_token_payment: If True (₹11 token), no coins are earned
    
    Returns:
        dict with coins earned and new balance
    """
    try:
        # No coins for ₹11 token payments
        if is_token_payment:
            logger.info(f"No coins for token payment order {order_number}")
            return {"coins_earned": 0, "reason": "Token payment - no coins earned"}
        
        # Calculate coins earned
        calc_result = calculate_coins_earned(amount_paid, shipping_charge, coins_redeemed_value)
        coins_earned = calc_result['coins_earned']
        
        if coins_earned <= 0:
            logger.info(f"No coins earned for order {order_number}: {calc_result['reason']}")
            return {"coins_earned": 0, "reason": calc_result.get('reason', 'Below minimum spend')}
        
        now = datetime.now(timezone.utc)
        
        # Get or create user rewards
        rewards = await db.user_rewards.find_one({"user_id": user_id})
        
        if rewards:
            new_balance = rewards.get('coins_balance', 0) + coins_earned
            new_total_earned = rewards.get('total_coins_earned', 0) + coins_earned
            
            # Update rewards
            await db.user_rewards.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "coins_balance": round(new_balance, 2),
                        "total_coins_earned": round(new_total_earned, 2),
                        "last_purchase_date": now.isoformat(),
                        "coins_expiry_date": calculate_coins_expiry_date(now).isoformat(),
                        "expiry_reminder_sent": False,  # Reset reminder flag
                        "updated_at": now.isoformat()
                    }
                }
            )
        else:
            new_balance = coins_earned
            new_total_earned = coins_earned
            
            # Create new rewards record
            await db.user_rewards.insert_one({
                "user_id": user_id,
                "email": email.lower(),
                "coins_balance": round(coins_earned, 2),
                "total_coins_earned": round(coins_earned, 2),
                "total_coins_redeemed": 0.0,
                "total_coins_expired": 0.0,
                "last_purchase_date": now.isoformat(),
                "coins_expiry_date": calculate_coins_expiry_date(now).isoformat(),
                "expiry_reminder_sent": False,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            })
        
        # Record transaction
        transaction = {
            "user_id": user_id,
            "email": email.lower(),
            "transaction_type": "earned",
            "coins_amount": round(coins_earned, 2),
            "coins_balance_after": round(new_balance, 2),
            "order_number": order_number,
            "order_amount": amount_paid,
            "qualifying_amount": calc_result['qualifying_amount'],
            "coins_rate": calc_result['rate'],
            "created_at": now.isoformat()
        }
        await db.coin_transactions.insert_one(transaction)
        
        logger.info(f"Credited {coins_earned} coins to user {user_id} for order {order_number}. New balance: {new_balance}")
        
        return {
            "coins_earned": round(coins_earned, 2),
            "new_balance": round(new_balance, 2),
            "calculation": calc_result.get('calculation'),
            "qualifying_amount": calc_result['qualifying_amount']
        }
        
    except Exception as e:
        logger.error(f"Failed to credit coins for order {order_number}: {str(e)}")
        return {"coins_earned": 0, "error": str(e)}


async def debit_coins_for_redemption(
    user_id: str,
    email: str,
    order_number: str,
    coins_to_debit: float
):
    """
    Debit coins from user when they redeem at checkout.
    Called from orders.py during order creation.
    
    Args:
        user_id: User's ID
        email: User's email
        order_number: Order number for reference
        coins_to_debit: Number of coins to debit
    
    Returns:
        dict with success status and redemption value
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get user rewards
        rewards = await db.user_rewards.find_one({"user_id": user_id})
        
        if not rewards:
            return {"success": False, "error": "No rewards account found"}
        
        current_balance = rewards.get('coins_balance', 0)
        
        if coins_to_debit > current_balance:
            return {"success": False, "error": f"Insufficient coins. Requested: {coins_to_debit}, Available: {current_balance}"}
        
        if coins_to_debit < MINIMUM_COINS_TO_REDEEM:
            return {"success": False, "error": f"Minimum {MINIMUM_COINS_TO_REDEEM} coins required"}
        
        # Calculate redemption value
        redemption_value = round(coins_to_debit * COIN_REDEMPTION_VALUE, 2)
        new_balance = round(current_balance - coins_to_debit, 2)
        new_total_redeemed = round(rewards.get('total_coins_redeemed', 0) + coins_to_debit, 2)
        
        # Update rewards
        await db.user_rewards.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "coins_balance": new_balance,
                    "total_coins_redeemed": new_total_redeemed,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Record transaction
        transaction = {
            "user_id": user_id,
            "email": email.lower(),
            "transaction_type": "redeemed",
            "coins_amount": round(-coins_to_debit, 2),  # Negative for debit
            "coins_balance_after": new_balance,
            "order_number": order_number,
            "redemption_value": redemption_value,
            "created_at": now.isoformat()
        }
        await db.coin_transactions.insert_one(transaction)
        
        logger.info(f"Debited {coins_to_debit} coins from user {user_id} for order {order_number}. Redemption value: ₹{redemption_value}")
        
        return {
            "success": True,
            "coins_debited": round(coins_to_debit, 2),
            "redemption_value": redemption_value,
            "new_balance": new_balance
        }
        
    except Exception as e:
        logger.error(f"Failed to debit coins for order {order_number}: {str(e)}")
        return {"success": False, "error": str(e)}


async def expire_user_coins(user_id: str, email: str):
    """
    Expire coins for a user (called by scheduler or admin).
    
    Returns:
        dict with expired coins count
    """
    try:
        now = datetime.now(timezone.utc)
        
        rewards = await db.user_rewards.find_one({"user_id": user_id})
        
        if not rewards or rewards.get('coins_balance', 0) <= 0:
            return {"expired": 0, "reason": "No coins to expire"}
        
        coins_to_expire = rewards.get('coins_balance', 0)
        new_total_expired = rewards.get('total_coins_expired', 0) + coins_to_expire
        
        # Update rewards
        await db.user_rewards.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "coins_balance": 0,
                    "total_coins_expired": round(new_total_expired, 2),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Record transaction
        transaction = {
            "user_id": user_id,
            "email": email.lower(),
            "transaction_type": "expired",
            "coins_amount": round(-coins_to_expire, 2),
            "coins_balance_after": 0,
            "expired_batch_date": now.isoformat(),
            "created_at": now.isoformat()
        }
        await db.coin_transactions.insert_one(transaction)
        
        logger.info(f"Expired {coins_to_expire} coins for user {user_id}")
        
        return {"expired": round(coins_to_expire, 2)}
        
    except Exception as e:
        logger.error(f"Failed to expire coins for user {user_id}: {str(e)}")
        return {"expired": 0, "error": str(e)}
