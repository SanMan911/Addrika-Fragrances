"""
User and Authentication Models
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid


# ===================== User Authentication Models =====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    phone: Optional[str] = None
    salutation: Optional[str] = Field(None, max_length=10)


class UserLogin(BaseModel):
    identifier: str  # Can be email or username
    password: str


class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    password: str


class User(BaseModel):
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: EmailStr
    username: Optional[str] = None
    name: str
    phone: Optional[str] = None
    salutation: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: Literal['email', 'google'] = 'email'
    is_verified: bool = False
    fcm_token: Optional[str] = None
    push_enabled: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class UserSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AdminSettings(BaseModel):
    admin_email: str
    pin_hash: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== Product Reviews Models =====================

class ReviewCreate(BaseModel):
    productId: str
    rating: float = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=100)
    comment: str = Field(..., min_length=10, max_length=1000)


class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    productId: str
    userId: str
    userName: str
    userEmail: str
    orderId: str
    rating: float = Field(..., ge=1, le=5)
    title: Optional[str] = None
    comment: str
    status: Literal['pending', 'approved', 'rejected'] = 'pending'
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Inventory Models =====================

class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    productId: str
    productName: str
    size: str
    stock: int = 0
    lowStockThreshold: int = 10
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryUpdate(BaseModel):
    stock: int = Field(..., ge=0)
    lowStockThreshold: Optional[int] = Field(None, ge=0)
