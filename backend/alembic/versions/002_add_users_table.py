"""Добавление таблицы users — аутентификация email/пароль + Google OAuth.

Revision ID: 002
Revises: 001
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False, comment="Email пользователя"),
        sa.Column("hashed_password", sa.String(128), nullable=True, comment="Хеш bcrypt (null для OAuth)"),
        sa.Column("full_name", sa.String(255), nullable=False, server_default="", comment="Полное имя"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true", comment="Активен ли аккаунт"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false", comment="Права администратора"),
        sa.Column("auth_provider", sa.String(20), nullable=False, server_default="local", comment="local / google"),
        sa.Column("google_sub", sa.String(255), nullable=True, comment="Google subject ID"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("google_sub"),
    )
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_table("users")
