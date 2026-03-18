"""
Rewards System Configuration
Centralized configuration for the loyalty/rewards system
"""

# ===================== Rewards Configuration =====================
COINS_PER_125_RUPEES = 6.9  # Coins earned per ₹125 spent
MINIMUM_SPEND_FOR_COINS = 125  # Minimum spend to earn coins
COIN_REDEMPTION_VALUE = 0.60  # ₹0.60 per coin when redeeming
MINIMUM_COINS_TO_REDEEM = 20  # Must have at least 20 coins to redeem
MAX_REDEMPTION_PERCENTAGE = 50  # Max 50% of cart value can be paid with coins
COINS_VALIDITY_DAYS = 90  # 3 months validity from last purchase
EXPIRY_REMINDER_DAYS = 7  # Send reminder 7 days before expiry
