"""Индексы на merit_score и amount — ускорение сортировки и budget-simulate.

Revision ID: 003
Revises: 002
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Основной индекс для сортировки по баллу (DESC NULLS LAST — самый частый запрос)
    op.create_index(
        "ix_applications_merit_score",
        "applications",
        ["merit_score"],
    )
    # Композитный индекс для budget-simulate (score DESC + amount)
    op.create_index(
        "ix_applications_score_amount",
        "applications",
        ["merit_score", "amount"],
    )
    # Индекс на risk_level для группировки в /stats
    op.create_index(
        "ix_applications_risk_level",
        "applications",
        ["risk_level"],
    )


def downgrade() -> None:
    op.drop_index("ix_applications_risk_level", table_name="applications")
    op.drop_index("ix_applications_score_amount", table_name="applications")
    op.drop_index("ix_applications_merit_score", table_name="applications")
