"""
Addrika Backend Models Package
Centralized data models for the application
"""

# E-commerce models
from .ecommerce import (
    Product, CartItem, Cart,
    ShippingAddress, GSTInfo, PickupStore, ShippingDetails,
    OrderCreate, OrderItem, Order,
    DiscountCodeCreate, DiscountCode, DiscountCodeUsage,
    InquiryCreate, Inquiry, RTOVoucher
)

# User models
from .users import (
    UserCreate, UserLogin, EmailChangeRequest, User, UserSession,
    AdminSettings, ReviewCreate, Review, InventoryItem, InventoryUpdate
)

# Rewards models
from .rewards import (
    UserRewards, CoinTransaction, CoinRedemptionRequest, CoinRedemptionValidation,
    StorePickupOTP, calculate_coins_earned, calculate_max_redeemable_coins,
    calculate_coins_expiry_date, should_send_expiry_reminder
)

# Retailer models
from .retailers import (
    RetailerCreate, Retailer, RetailerMessage, RetailerComplaint
)

# Content models
from .content import (
    BlogPostCreate, BlogPost,
    SubscriptionPreferences, SubscriberCreate, Subscriber,
    InstagramNotification
)

# Base utilities
from .base import BaseModelWithConfig, generate_uuid, utc_now

__all__ = [
    # E-commerce
    'Product', 'CartItem', 'Cart', 'ShippingAddress', 'GSTInfo', 'PickupStore',
    'ShippingDetails', 'OrderCreate', 'OrderItem', 'Order', 'DiscountCodeCreate',
    'DiscountCode', 'DiscountCodeUsage', 'InquiryCreate', 'Inquiry', 'RTOVoucher',
    # Users
    'UserCreate', 'UserLogin', 'EmailChangeRequest', 'User', 'UserSession',
    'AdminSettings', 'ReviewCreate', 'Review', 'InventoryItem', 'InventoryUpdate',
    # Rewards
    'UserRewards', 'CoinTransaction', 'CoinRedemptionRequest', 'CoinRedemptionValidation',
    'StorePickupOTP', 'calculate_coins_earned', 'calculate_max_redeemable_coins',
    'calculate_coins_expiry_date', 'should_send_expiry_reminder',
    # Retailers
    'RetailerCreate', 'Retailer', 'RetailerMessage', 'RetailerComplaint',
    # Content
    'BlogPostCreate', 'BlogPost', 'SubscriptionPreferences', 'SubscriberCreate',
    'Subscriber', 'InstagramNotification',
    # Base
    'BaseModelWithConfig', 'generate_uuid', 'utc_now'
]
