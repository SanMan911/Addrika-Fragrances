"""
E-Commerce Models
Products, Cart, Orders, Discounts
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal, List
from datetime import datetime, timezone, timedelta
import uuid


# ===================== Product Models =====================

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    subtitle: str
    description: str
    image: str
    sizes: List[dict]  # [{"size": "50g", "mrp": 110, "price": 99}]
    category: str = "agarbatti"
    isActive: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Cart Models =====================

class CartItem(BaseModel):
    productId: str
    name: str
    subtitle: Optional[str] = None
    image: str
    size: str
    mrp: float
    price: float
    quantity: int = Field(..., gt=0)


class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sessionId: str
    items: List[CartItem] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Shipping & Address Models =====================

class ShippingAddress(BaseModel):
    salutation: Optional[str] = Field(None, max_length=10)
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    address: str = Field(..., min_length=5, max_length=500)
    landmark: Optional[str] = Field(None, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    pincode: str = Field(..., min_length=6, max_length=6)


class GSTInfo(BaseModel):
    is_b2b: bool = False
    gst_number: Optional[str] = None
    business_name: Optional[str] = None


class PickupStore(BaseModel):
    """Store selected for self-pickup"""
    id: str
    key: Optional[str] = None
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ShippingDetails(BaseModel):
    """Shipping carrier and tracking details"""
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    shipped_at: Optional[datetime] = None


# ===================== Order Models =====================

class OrderCreate(BaseModel):
    sessionId: str
    billing: ShippingAddress
    shipping: Optional[ShippingAddress] = None
    use_different_shipping: bool = False
    paymentMethod: Literal['cod', 'online', 'bank_transfer', 'razorpay'] = 'razorpay'
    discountCode: Optional[str] = None
    userId: Optional[str] = None
    items: Optional[List[dict]] = None
    gst_info: Optional[GSTInfo] = None
    delivery_mode: Literal['shipping', 'self_pickup'] = 'shipping'
    pickup_store: Optional[PickupStore] = None
    pickup_payment_option: Optional[Literal['pay_now', 'pay_at_store']] = None
    token_amount: Optional[float] = None
    pickup_time_slot: Optional[str] = None
    coin_redemption: Optional[dict] = None
    tree_donation: Optional[float] = 0  # Customer's tree donation amount (₹5)


class OrderItem(BaseModel):
    productId: str
    name: str
    subtitle: str
    image: str
    size: str
    mrp: float
    price: float
    quantity: int


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: str = Field(default_factory=lambda: f"ADD{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:4].upper()}")
    sessionId: str
    items: List[OrderItem]
    shipping: ShippingAddress
    subtotal: float
    bulkDiscount: float = 0
    shippingCharge: float = 0
    total: float
    paymentMethod: Literal['cod', 'online', 'bank_transfer', 'razorpay']
    paymentMode: Optional[str] = None
    paymentStatus: Literal['pending', 'paid', 'failed', 'refunded'] = 'pending'
    orderStatus: Literal['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'rto', 'cancelled'] = 'pending'
    shippingDetails: Optional[ShippingDetails] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Discount Code Models =====================

class DiscountCodeCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    discountType: Literal['percentage', 'fixed'] = 'percentage'
    discountValue: float = Field(..., gt=0)
    maxUses: Optional[int] = None
    usageType: Literal['universal', 'single_per_user', 'limited', 'time_bound'] = 'universal'
    expiresAt: Optional[datetime] = None
    minOrderValue: float = 0
    maxDiscount: Optional[float] = None
    description: Optional[str] = None


class DiscountCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discountType: Literal['percentage', 'fixed']
    discountValue: float
    maxUses: Optional[int] = None
    usedCount: int = 0
    expiresAt: Optional[datetime] = None
    minOrderValue: float = 0
    description: Optional[str] = None
    isActive: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class DiscountCodeUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code_id: str
    code: str
    order_id: str
    order_number: str
    user_id: Optional[str] = None
    email: str
    discount_type: str
    discount_value: float
    discount_amount: float
    cart_total: float
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Inquiry Models =====================

class InquiryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    fragrance: str = Field(..., min_length=1)
    packageSize: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)
    type: Literal['retail', 'wholesale']


class Inquiry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    fragrance: str
    packageSize: str
    quantity: int
    message: Optional[str] = None
    type: Literal['retail', 'wholesale']
    status: Literal['pending', 'contacted', 'completed'] = 'pending'
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== RTO Voucher Models =====================

class RTOVoucher(BaseModel):
    """Voucher generated for RTO (Return-To-Origin) orders"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_code: str = Field(default_factory=lambda: f"RTO-{str(uuid.uuid4())[:8].upper()}")
    order_number: str
    user_email: str
    user_id: Optional[str] = None
    original_amount: float
    rto_charges: float = 0
    voucher_value: float
    status: Literal['active', 'claimed', 'expired', 'donated'] = 'active'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=15))
    claimed_at: Optional[datetime] = None
    claimed_order_number: Optional[str] = None
    donated_at: Optional[datetime] = None
    donation_reference: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
