"""initial mirror schema

Revision ID: 0001_initial_mirror
Revises:
Create Date: 2026-02-01

Creates users_mirror, products_mirror, sync_dead_letter tables.
MongoDB stays the source of truth. These tables are downstream projections.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001_initial_mirror"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users_mirror",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("email", sa.String(length=320)),
        sa.Column("phone", sa.String(length=32)),
        sa.Column("name", sa.String(length=255)),
        sa.Column("business_name", sa.String(length=255)),
        sa.Column("gst_number", sa.String(length=32)),
        sa.Column("status", sa.String(length=32)),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("city", sa.String(length=128)),
        sa.Column("state", sa.String(length=128)),
        sa.Column("pincode", sa.String(length=16)),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("mongo_created_at", sa.DateTime(timezone=True)),
        sa.Column("mongo_updated_at", sa.DateTime(timezone=True)),
        sa.Column("mirrored_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_mirror_kind", "users_mirror", ["kind"])
    op.create_index("ix_users_mirror_email", "users_mirror", ["email"])
    op.create_index("ix_users_mirror_phone", "users_mirror", ["phone"])
    op.create_index("ix_users_mirror_gst_number", "users_mirror", ["gst_number"])
    op.create_index("ix_users_mirror_status", "users_mirror", ["status"])

    op.create_table(
        "products_mirror",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("channel", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255)),
        sa.Column("category", sa.String(length=64)),
        sa.Column("hsn", sa.String(length=16)),
        sa.Column("price_inr", sa.Numeric(12, 2)),
        sa.Column("mrp_inr", sa.Numeric(12, 2)),
        sa.Column("gst_pct", sa.Numeric(5, 2)),
        sa.Column("stock_pieces", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("ready_to_use", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("mongo_updated_at", sa.DateTime(timezone=True)),
        sa.Column("mirrored_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_products_mirror_channel", "products_mirror", ["channel"])
    op.create_index("ix_products_mirror_name", "products_mirror", ["name"])
    op.create_index("ix_products_mirror_slug", "products_mirror", ["slug"])
    op.create_index("ix_products_mirror_category", "products_mirror", ["category"])
    op.create_index("ix_products_mirror_is_active", "products_mirror", ["is_active"])

    op.create_table(
        "sync_dead_letter",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("entity", sa.String(length=16), nullable=False),
        sa.Column("op", sa.String(length=16), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error", sa.Text()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sync_dead_letter_entity", "sync_dead_letter", ["entity"])
    op.create_index("ix_sync_dead_letter_entity_id", "sync_dead_letter", ["entity_id"])
    op.create_index("ix_sync_dead_letter_status", "sync_dead_letter", ["status"])


def downgrade() -> None:
    op.drop_table("sync_dead_letter")
    op.drop_table("products_mirror")
    op.drop_table("users_mirror")
