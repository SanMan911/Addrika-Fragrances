"""
Content Models
Blog, Subscriptions, Instagram
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ===================== Blog Models =====================

class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    slug: Optional[str] = None
    excerpt: str = Field(..., min_length=20, max_length=500)
    content: str = Field(..., min_length=100)
    featuredImage: Optional[str] = None
    tags: List[str] = ['fragrance', 'agarbatti', 'incense', 'aroma', 'aromatherapy']
    isPublished: bool = False


class BlogPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    slug: str
    excerpt: str
    content: str
    featuredImage: Optional[str] = None
    tags: List[str] = []
    authorId: str
    authorName: str
    isPublished: bool = False
    viewCount: int = 0
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    publishedAt: Optional[datetime] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Email Subscription Models =====================

class SubscriptionPreferences(BaseModel):
    blog_posts: bool = True
    new_retailers: bool = True
    promotions: bool = True
    instagram_updates: bool = True


class SubscriberCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    preferences: Optional[SubscriptionPreferences] = None


class Subscriber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    isActive: bool = True
    preferences: SubscriptionPreferences = Field(default_factory=SubscriptionPreferences)
    fcm_token: Optional[str] = None
    web_push_subscription: Optional[dict] = None
    subscribedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    unsubscribedAt: Optional[datetime] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ===================== Instagram Notification Models =====================

class InstagramNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    postUrl: str
    caption: Optional[str] = None
    imageUrl: Optional[str] = None
    notifiedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscribersNotified: int = 0
