"""add missing columns

Revision ID: 005
Revises: 004
Create Date: 2026-04-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use IF NOT EXISTS to prevent crashes if the user manually ran add_columns.py
    op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS pasture_area_ha DOUBLE PRECISION;")
    op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS historical_mortality_rate DOUBLE PRECISION;")
    op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_head_count DOUBLE PRECISION;")


def downgrade() -> None:
    op.drop_column('applications', 'current_head_count')
    op.drop_column('applications', 'historical_mortality_rate')
    op.drop_column('applications', 'pasture_area_ha')