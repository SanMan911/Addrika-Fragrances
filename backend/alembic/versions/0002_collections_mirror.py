"""add collections_mirror + widen sync_dead_letter.entity_id

Revision ID: 0002_collections_mirror
Revises: 0001_initial_mirror
Create Date: 2026-02-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002_collections_mirror"
down_revision: Union[str, None] = "0001_initial_mirror"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Some Mongo doc ids are composite (collection|doc) > 64 chars — widen it.
    op.alter_column(
        "sync_dead_letter",
        "entity_id",
        existing_type=sa.String(length=64),
        type_=sa.String(length=128),
        existing_nullable=False,
    )

    op.create_table(
        "collections_mirror",
        sa.Column("collection", sa.String(length=64), primary_key=True),
        sa.Column("doc_id", sa.String(length=128), primary_key=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("mongo_updated_at", sa.DateTime(timezone=True)),
        sa.Column("mirrored_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_collections_mirror_collection", "collections_mirror", ["collection"])
    op.create_index("ix_collections_mirror_doc_id", "collections_mirror", ["doc_id"])
    op.create_index("ix_collections_mirror_mongo_updated_at", "collections_mirror", ["mongo_updated_at"])


def downgrade() -> None:
    op.drop_table("collections_mirror")
    op.alter_column(
        "sync_dead_letter",
        "entity_id",
        existing_type=sa.String(length=128),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
