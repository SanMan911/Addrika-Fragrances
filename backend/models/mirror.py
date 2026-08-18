"""
SQLAlchemy models for the Supabase Postgres mirror.

MongoDB is the source of truth. These tables are downstream projections.
Do NOT add business logic here. Schema changes go through Alembic.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base for all mirror tables. Isolated from the app's Mongo models."""


class UserMirror(Base):
    __tablename__ = "users_mirror"

    # Mongo _id (stringified ObjectId or slug). Primary key on the mirror.
    id = Column(String(64), primary_key=True)
    # 'b2c' | 'b2b' | 'admin'
    kind = Column(String(16), nullable=False, index=True)
    email = Column(String(320), index=True)
    phone = Column(String(32), index=True)
    name = Column(String(255))
    business_name = Column(String(255))
    gst_number = Column(String(32), index=True)
    status = Column(String(32), index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    # City / state helpful for leaderboard + analytics queries
    city = Column(String(128))
    state = Column(String(128))
    pincode = Column(String(16))
    # Full doc snapshot for anything not called out above
    raw = Column(JSONB, nullable=False, default=dict)
    mongo_created_at = Column(DateTime(timezone=True))
    mongo_updated_at = Column(DateTime(timezone=True))
    mirrored_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProductMirror(Base):
    __tablename__ = "products_mirror"

    # Mongo product_id / _id
    id = Column(String(64), primary_key=True)
    # 'b2c' | 'b2b'
    channel = Column(String(8), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), index=True)
    category = Column(String(64), index=True)
    hsn = Column(String(16))
    # Storefront-facing price (₹). B2C: MRP. B2B: wholesale.
    price_inr = Column(Numeric(12, 2))
    mrp_inr = Column(Numeric(12, 2))
    gst_pct = Column(Numeric(5, 2))
    stock_pieces = Column(Integer)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    ready_to_use = Column(Boolean, default=False, nullable=False)
    raw = Column(JSONB, nullable=False, default=dict)
    mongo_updated_at = Column(DateTime(timezone=True))
    mirrored_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SyncDeadLetter(Base):
    """
    Failed mirror writes land here. A background retry loop drains this table
    with exponential backoff. Admins can manually replay via
    `POST /api/admin/supabase-mirror/replay-dead-letter`.
    """

    __tablename__ = "sync_dead_letter"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    # 'user' | 'product' | 'collection'
    entity = Column(String(16), nullable=False, index=True)
    # 'upsert' | 'delete'
    op = Column(String(16), nullable=False)
    entity_id = Column(String(128), nullable=False, index=True)
    payload = Column(JSONB, nullable=False, default=dict)
    error = Column(Text)
    attempts = Column(Integer, nullable=False, default=0)
    next_retry_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # 'pending' | 'sent' | 'abandoned'
    status = Column(String(16), nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CollectionMirror(Base):
    """
    Generic mirror for every non-typed Mongo collection.

    Composite PK (collection, doc_id) lets a single table hold every
    downstream collection the mobile app might need — orders, blog posts,
    retailer messages, rewards ledger, inventory log, etc.

    Sensitive collections (sessions, credentials, OTPs, OAuth tokens) are
    excluded via services.supabase_sync._MIRROR_BLOCKLIST.
    """

    __tablename__ = "collections_mirror"

    collection = Column(String(64), primary_key=True)
    doc_id = Column(String(128), primary_key=True)
    raw = Column(JSONB, nullable=False, default=dict)
    mongo_updated_at = Column(DateTime(timezone=True), index=True)
    mirrored_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
